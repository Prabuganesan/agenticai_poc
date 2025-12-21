import { StatusCodes } from 'http-status-codes'
import { In } from 'typeorm'
import { ChatMessage } from '../../database/entities/ChatMessage'
import { Execution } from '../../database/entities/Execution'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import { getErrorMessage } from '../../errors/utils'
import { ExecutionState, IAgentflowExecutedData } from '../../Interface'
import { _removeCredentialId } from '../../utils'
import { getDataSource } from '../../DataSource'

export interface ExecutionFilters {
    guid?: string
    agentflowId?: string
    agentflowName?: string
    sessionId?: string
    state?: ExecutionState
    startDate?: number
    endDate?: number
    page?: number
    limit?: number
    orgId?: string
    userId?: number
}

const getExecutionById = async (executionId: string, orgId?: string): Promise<Execution | null> => {
    try {
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const dataSource = getDataSource(parseInt(orgId))
        const executionRepository = dataSource.getRepository(Execution)

        const res = await executionRepository.findOne({ where: { guid: executionId } })
        if (!res) {
            throw new InternalKodivianError(StatusCodes.NOT_FOUND, `Execution ${executionId} not found`)
        }
        return res
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: executionsService.getExecutionById - ${getErrorMessage(error)}`
        )
    }
}

const getPublicExecutionById = async (executionId: string, orgId?: string): Promise<Execution | null> => {
    try {
        // Require orgId upfront - no cross-org search
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))
        const executionRepository = dataSource.getRepository(Execution)
        const res = await executionRepository.findOne({ where: { guid: executionId, isPublic: true } })
        if (!res) {
            throw new InternalKodivianError(StatusCodes.NOT_FOUND, `Execution ${executionId} not found`)
        }
        const executionData = typeof res?.executionData === 'string' ? JSON.parse(res?.executionData) : res?.executionData
        const executionDataWithoutCredentialId = executionData.map((data: IAgentflowExecutedData) => _removeCredentialId(data))
        const stringifiedExecutionData = JSON.stringify(executionDataWithoutCredentialId)
        return { ...res, executionData: stringifiedExecutionData }
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: executionsService.getPublicExecutionById - ${getErrorMessage(error)}`
        )
    }
}

const getAllExecutions = async (filters: ExecutionFilters = {}): Promise<{ data: Execution[]; total: number }> => {
    try {
        const { guid, agentflowId, agentflowName, sessionId, state, startDate, endDate, page = 1, limit = 12, orgId, userId } = filters

        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))
        // Handle GUID fields properly using raw parameters
        const queryBuilder = dataSource
            .getRepository(Execution)
            .createQueryBuilder('execution')
            .leftJoinAndSelect('execution.agentflow', 'agentflow')
            // Order by created_on DESC to show latest executions first (newest to oldest)
            // This ensures Dec 11 appears before Dec 1, with most recent executions on first page
            .orderBy('execution.created_on', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)

        if (guid) queryBuilder.andWhere('execution.guid = :guid', { guid })
        if (agentflowId) queryBuilder.andWhere('execution.agentflowid = :agentflowId', { agentflowId })
        if (agentflowName)
            queryBuilder.andWhere('LOWER(agentflow.name) LIKE LOWER(:agentflowName)', { agentflowName: `%${agentflowName}%` })
        if (sessionId) queryBuilder.andWhere('execution.sessionid = :sessionId', { sessionId })
        if (state) queryBuilder.andWhere('execution.state = :state', { state })
        // Date range conditions (numeric timestamps)
        if (startDate && endDate) {
            queryBuilder.andWhere('execution.created_on BETWEEN :startDate AND :endDate', { startDate, endDate })
        } else if (startDate) {
            queryBuilder.andWhere('execution.created_on >= :startDate', { startDate })
        } else if (endDate) {
            queryBuilder.andWhere('execution.created_on <= :endDate', { endDate })
        }

        const [data, total] = await queryBuilder.getManyAndCount()

        return { data, total }
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: executionsService.getAllExecutions - ${getErrorMessage(error)}`
        )
    }
}

const updateExecution = async (executionId: string, data: Partial<Execution>, orgId?: string): Promise<Execution | null> => {
    try {
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))
        const execution = await dataSource.getRepository(Execution).findOneBy({ guid: executionId })
        if (!execution) {
            throw new InternalKodivianError(StatusCodes.NOT_FOUND, `Execution ${executionId} not found`)
        }
        const updateExecution = new Execution()
        Object.assign(updateExecution, data)
        // Set last_modified_on if not provided
        if (!updateExecution.last_modified_on) {
            updateExecution.last_modified_on = Date.now()
        }
        await dataSource.getRepository(Execution).merge(execution, updateExecution)
        const dbResponse = await dataSource.getRepository(Execution).save(execution)
        return dbResponse
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: executionsService.updateExecution - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Delete multiple executions by their IDs
 * @param executionIds Array of execution IDs to delete
 * @param orgId Optional organization ID to filter executions
 * @returns Object with success status and count of deleted executions
 */
const deleteExecutions = async (executionIds: string[], orgId?: string): Promise<{ success: boolean; deletedCount: number }> => {
    try {
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))
        const executionRepository = dataSource.getRepository(Execution)

        // Delete executions where guid is in the provided array
        const result = await executionRepository.delete({ guid: In(executionIds) })

        // Update chat message executionId column to NULL
        await dataSource.getRepository(ChatMessage).update({ executionId: In(executionIds) }, { executionId: null as any })

        return {
            success: true,
            deletedCount: result.affected || 0
        }
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: executionsService.deleteExecutions - ${getErrorMessage(error)}`
        )
    }
}

export default {
    getExecutionById,
    getAllExecutions,
    deleteExecutions,
    getPublicExecutionById,
    updateExecution
}
