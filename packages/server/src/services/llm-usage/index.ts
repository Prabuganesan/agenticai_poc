import { FindManyOptions, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm'
import { LlmUsage } from '../../database/entities/LlmUsage'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { StatusCodes } from 'http-status-codes'
import { getErrorMessage } from '../../errors/utils'
import { getDataSource } from '../../DataSource'
import { trackLLMUsage, TrackLLMUsageOptions } from '../../utils/llm-usage-tracker'

export interface QueryUsageFilters {
    orgId: string
    userId?: string
    requestId?: string
    executionId?: string
    chatflowId?: string
    feature?: string
    provider?: string
    model?: string
    startDate?: Date
    endDate?: Date
    success?: boolean
    page?: number
    limit?: number
}

export interface UsageStats {
    totalRequests: number
    totalTokens: number
    totalPromptTokens: number
    totalCompletionTokens: number
    totalCost: number
    successRate: number
    averageProcessingTime: number
    byProvider: { [provider: string]: { requests: number; tokens: number; cost: number } }
    byModel: { [model: string]: { requests: number; tokens: number; cost: number } }
    byFeature: { [feature: string]: { requests: number; tokens: number; cost: number } }
}

/**
 * Track LLM usage
 */
const trackUsage = async (options: TrackLLMUsageOptions): Promise<LlmUsage> => {
    try {
        await trackLLMUsage(options)
        // Return a mock object since trackLLMUsage doesn't return the saved entity
        // In a production system, you might want to modify trackLLMUsage to return the entity
        const orgIdNum = parseInt(options.orgId)
        if (isNaN(orgIdNum)) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Invalid orgId')
        }
        const dataSource = getDataSource(orgIdNum)
        const repository = dataSource.getRepository(LlmUsage)
        // Find the most recent usage record matching the requestId
        const usage = await repository.findOne({
            where: { requestId: options.requestId },
            order: { createdAt: 'DESC' }
        })
        if (!usage) {
            throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to retrieve tracked usage')
        }
        return usage
    } catch (error) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error tracking LLM usage: ${getErrorMessage(error)}`)
    }
}

/**
 * Query LLM usage records
 */
const queryUsage = async (filters: QueryUsageFilters): Promise<{ data: LlmUsage[]; total: number }> => {
    try {
        const orgIdNum = parseInt(filters.orgId)
        if (isNaN(orgIdNum)) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Invalid orgId')
        }

        const dataSource = getDataSource(orgIdNum)
        const repository = dataSource.getRepository(LlmUsage)

        const queryOptions: FindManyOptions<LlmUsage> = {
            where: {},
            order: { createdAt: 'DESC' },
            skip: ((filters.page || 1) - 1) * (filters.limit || 50),
            take: filters.limit || 50
        }

        // Build where conditions
        const where: any = {}

        if (filters.requestId) {
            where.requestId = filters.requestId
        }

        if (filters.executionId) {
            where.executionId = filters.executionId
        }

        if (filters.chatflowId) {
            where.chatflowId = filters.chatflowId
        }

        if (filters.feature) {
            where.feature = filters.feature
        }

        if (filters.provider) {
            where.provider = filters.provider
        }

        if (filters.model) {
            where.model = filters.model
        }

        if (filters.success !== undefined) {
            where.success = filters.success
        }

        // Date range filter
        if (filters.startDate || filters.endDate) {
            if (filters.startDate && filters.endDate) {
                where.createdAt = Between(filters.startDate, filters.endDate)
            } else if (filters.startDate) {
                where.createdAt = MoreThanOrEqual(filters.startDate)
            } else if (filters.endDate) {
                where.createdAt = LessThanOrEqual(filters.endDate)
            }
        }

        queryOptions.where = where

        const [data, total] = await repository.findAndCount(queryOptions)

        return { data, total }
    } catch (error) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error querying LLM usage: ${getErrorMessage(error)}`)
    }
}

/**
 * Get aggregated statistics
 */
const getStats = async (filters: Omit<QueryUsageFilters, 'page' | 'limit'>): Promise<UsageStats> => {
    try {
        const orgIdNum = parseInt(filters.orgId)
        if (isNaN(orgIdNum)) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Invalid orgId')
        }

        const dataSource = getDataSource(orgIdNum)
        const repository = dataSource.getRepository(LlmUsage)

        // Build where conditions (same as queryUsage)
        const where: any = {}

        if (filters.requestId) {
            where.requestId = filters.requestId
        }

        if (filters.executionId) {
            where.executionId = filters.executionId
        }

        if (filters.chatflowId) {
            where.chatflowId = filters.chatflowId
        }

        if (filters.feature) {
            where.feature = filters.feature
        }

        if (filters.provider) {
            where.provider = filters.provider
        }

        if (filters.model) {
            where.model = filters.model
        }

        if (filters.success !== undefined) {
            where.success = filters.success
        }

        if (filters.startDate || filters.endDate) {
            if (filters.startDate && filters.endDate) {
                where.createdAt = Between(filters.startDate, filters.endDate)
            } else if (filters.startDate) {
                where.createdAt = MoreThanOrEqual(filters.startDate)
            } else if (filters.endDate) {
                where.createdAt = LessThanOrEqual(filters.endDate)
            }
        }

        // Get all records matching filters
        const records = await repository.find({ where })

        // Calculate statistics
        const stats: UsageStats = {
            totalRequests: records.length,
            totalTokens: 0,
            totalPromptTokens: 0,
            totalCompletionTokens: 0,
            totalCost: 0,
            successRate: 0,
            averageProcessingTime: 0,
            byProvider: {},
            byModel: {},
            byFeature: {}
        }

        let totalProcessingTime = 0
        let successCount = 0

        for (const record of records) {
            stats.totalTokens += record.totalTokens
            stats.totalPromptTokens += record.promptTokens
            stats.totalCompletionTokens += record.completionTokens
            // Cost is stored as DECIMAL(20,12) - convert properly from string or number
            const costValue = typeof record.cost === 'string' ? parseFloat(record.cost) : Number(record.cost) || 0
            stats.totalCost += costValue

            if (record.success) {
                successCount++
            }

            if (record.processingTimeMs) {
                totalProcessingTime += record.processingTimeMs
            }

            // Aggregate by provider
            if (!stats.byProvider[record.provider]) {
                stats.byProvider[record.provider] = { requests: 0, tokens: 0, cost: 0 }
            }
            stats.byProvider[record.provider].requests++
            stats.byProvider[record.provider].tokens += record.totalTokens
            const providerCost = typeof record.cost === 'string' ? parseFloat(record.cost) : Number(record.cost) || 0
            stats.byProvider[record.provider].cost += providerCost

            // Aggregate by model
            const modelKey = `${record.provider}/${record.model}`
            if (!stats.byModel[modelKey]) {
                stats.byModel[modelKey] = { requests: 0, tokens: 0, cost: 0 }
            }
            stats.byModel[modelKey].requests++
            stats.byModel[modelKey].tokens += record.totalTokens
            const modelCost = typeof record.cost === 'string' ? parseFloat(record.cost) : Number(record.cost) || 0
            stats.byModel[modelKey].cost += modelCost

            // Aggregate by feature
            if (!stats.byFeature[record.feature]) {
                stats.byFeature[record.feature] = { requests: 0, tokens: 0, cost: 0 }
            }
            stats.byFeature[record.feature].requests++
            stats.byFeature[record.feature].tokens += record.totalTokens
            const featureCost = typeof record.cost === 'string' ? parseFloat(record.cost) : Number(record.cost) || 0
            stats.byFeature[record.feature].cost += featureCost
        }

        if (records.length > 0) {
            stats.successRate = (successCount / records.length) * 100
            stats.averageProcessingTime = totalProcessingTime / records.length
        }

        return stats
    } catch (error) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting LLM usage stats: ${getErrorMessage(error)}`)
    }
}

/**
 * Get unique filter values (providers, models, features)
 */
const getFilters = async (orgId: string): Promise<{ providers: string[]; models: string[]; features: string[] }> => {
    try {
        const orgIdNum = parseInt(orgId)
        if (isNaN(orgIdNum)) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Invalid orgId')
        }

        const dataSource = getDataSource(orgIdNum)
        const repository = dataSource.getRepository(LlmUsage)

        // Get unique providers
        const providers = await repository
            .createQueryBuilder('usage')
            .select('DISTINCT usage.provider', 'provider')
            .where('usage.provider IS NOT NULL')
            .getRawMany()

        // Get unique models
        const models = await repository
            .createQueryBuilder('usage')
            .select('DISTINCT usage.model', 'model')
            .where('usage.model IS NOT NULL')
            .getRawMany()

        // Get unique features
        const features = await repository
            .createQueryBuilder('usage')
            .select('DISTINCT usage.feature', 'feature')
            .where('usage.feature IS NOT NULL')
            .getRawMany()

        return {
            providers: providers
                .map((p) => p.provider)
                .filter(Boolean)
                .sort(),
            models: models
                .map((m) => m.model)
                .filter(Boolean)
                .sort(),
            features: features
                .map((f) => f.feature)
                .filter(Boolean)
                .sort()
        }
    } catch (error) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting LLM usage filters: ${getErrorMessage(error)}`)
    }
}

/**
 * Get time-series data grouped by date
 */
const getTimeSeries = async (
    filters: Omit<QueryUsageFilters, 'page' | 'limit'>
): Promise<
    Array<{
        date: string
        requests: number
        tokens: number
        cost: number
        promptTokens: number
        completionTokens: number
    }>
> => {
    try {
        const orgIdNum = parseInt(filters.orgId)
        if (isNaN(orgIdNum)) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Invalid orgId')
        }

        const dataSource = getDataSource(orgIdNum)
        const repository = dataSource.getRepository(LlmUsage)

        // Build where conditions (same as getStats)
        const where: any = {}

        if (filters.requestId) {
            where.requestId = filters.requestId
        }

        if (filters.executionId) {
            where.executionId = filters.executionId
        }

        if (filters.chatflowId) {
            where.chatflowId = filters.chatflowId
        }

        if (filters.feature) {
            where.feature = filters.feature
        }

        if (filters.provider) {
            where.provider = filters.provider
        }

        if (filters.model) {
            where.model = filters.model
        }

        if (filters.success !== undefined) {
            where.success = filters.success
        }

        if (filters.startDate || filters.endDate) {
            if (filters.startDate && filters.endDate) {
                where.createdAt = Between(filters.startDate, filters.endDate)
            } else if (filters.startDate) {
                where.createdAt = MoreThanOrEqual(filters.startDate)
            } else if (filters.endDate) {
                where.createdAt = LessThanOrEqual(filters.endDate)
            }
        }

        // Get all records matching filters
        const records = await repository.find({ where, order: { createdAt: 'ASC' } })

        // Group by date
        const dateMap: {
            [date: string]: { requests: number; tokens: number; cost: number; promptTokens: number; completionTokens: number }
        } = {}

        for (const record of records) {
            const dateKey = new Date(record.createdAt).toISOString().split('T')[0] // YYYY-MM-DD

            if (!dateMap[dateKey]) {
                dateMap[dateKey] = {
                    requests: 0,
                    tokens: 0,
                    cost: 0,
                    promptTokens: 0,
                    completionTokens: 0
                }
            }

            dateMap[dateKey].requests++
            dateMap[dateKey].tokens += record.totalTokens
            dateMap[dateKey].promptTokens += record.promptTokens
            dateMap[dateKey].completionTokens += record.completionTokens
            const timeSeriesCost = typeof record.cost === 'string' ? parseFloat(record.cost) : Number(record.cost) || 0
            dateMap[dateKey].cost += timeSeriesCost
        }

        // Convert to array and sort by date
        const timeSeries = Object.entries(dateMap)
            .map(([date, data]) => ({
                date,
                ...data
            }))
            .sort((a, b) => a.date.localeCompare(b.date))

        return timeSeries
    } catch (error) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting time-series data: ${getErrorMessage(error)}`)
    }
}

export default {
    trackUsage,
    queryUsage,
    getStats,
    getFilters,
    getTimeSeries
}
