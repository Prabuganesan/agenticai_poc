import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import llmUsageService from '../../services/llm-usage'
import { QueryUsageFilters } from '../../services/llm-usage'

const getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as any
        // Get orgId from request object (set by session validation middleware) - single source
        const orgId = authReq.orgId
        const userId = authReq.userId

        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const filters: Omit<QueryUsageFilters, 'page' | 'limit'> = {
            orgId,
            feature: req.query.feature as string,
            provider: req.query.provider as string,
            model: req.query.model as string,
            chatflowId: req.query.chatflowId as string,
            executionId: req.query.executionId as string,
            requestId: req.query.requestId as string,
            success: req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined,
            startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
            endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
        }

        const stats = await llmUsageService.getStats(filters)
        return res.json(stats)
    } catch (error) {
        next(error)
    }
}

const queryUsage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as any
        // Get orgId from request object (set by session validation middleware) - single source
        const orgId = authReq.orgId
        const userId = authReq.userId

        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const filters: QueryUsageFilters = {
            orgId,
            feature: req.query.feature as string,
            provider: req.query.provider as string,
            model: req.query.model as string,
            chatflowId: req.query.chatflowId as string,
            executionId: req.query.executionId as string,
            requestId: req.query.requestId as string,
            success: req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined,
            startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
            endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
            page: req.query.page ? parseInt(req.query.page as string) : 1,
            limit: req.query.limit ? parseInt(req.query.limit as string) : 50
        }

        const result = await llmUsageService.queryUsage(filters)
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

const getFilters = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as any
        // Get orgId from request object (set by session validation middleware) - single source
        const orgId = authReq.orgId

        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const filters = await llmUsageService.getFilters(orgId)
        return res.json(filters)
    } catch (error) {
        next(error)
    }
}

const getTimeSeries = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as any
        const orgId = authReq.orgId
        const userId = authReq.userId

        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const filters: Omit<import('../../services/llm-usage').QueryUsageFilters, 'page' | 'limit'> = {
            orgId,
            feature: req.query.feature as string,
            provider: req.query.provider as string,
            model: req.query.model as string,
            chatflowId: req.query.chatflowId as string,
            executionId: req.query.executionId as string,
            requestId: req.query.requestId as string,
            success: req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined,
            startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
            endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
        }

        const timeSeries = await llmUsageService.getTimeSeries(filters)
        return res.json(timeSeries)
    } catch (error) {
        next(error)
    }
}

export default {
    getStats,
    queryUsage,
    getFilters,
    getTimeSeries
}
