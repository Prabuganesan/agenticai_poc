import { StatusCodes } from 'http-status-codes'
import { QueryRunner } from 'typeorm'
import { Tool } from '../../database/entities/Tool'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { getErrorMessage } from '../../errors/utils'
import { AUTONOMOUS_COUNTER_STATUS, AUTONOMOUS_METRIC_COUNTERS } from '../../Interface.Metrics'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { getDataSource } from '../../DataSource'
import { generateGuid } from '../../utils/guidGenerator'

const createTool = async (requestBody: any, orgId: string, userId?: string | number): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const dataSource = getDataSource(parseInt(orgId))
        // Map frontend 'id' (which is actually guid) to 'guid', and remove 'id' to prevent it from being assigned to numeric id field
        const { id, ...requestBodyWithoutId } = requestBody
        const requestBodyWithGuid = id ? { ...requestBodyWithoutId, guid: id } : requestBodyWithoutId
        const newTool = new Tool()
        Object.assign(newTool, requestBodyWithGuid)
        // Generate GUID if not provided
        if (!newTool.guid) {
            newTool.guid = generateGuid()
        }
        // Set created_by and created_on
        const userIdNum = userId ? (typeof userId === 'number' ? userId : parseInt(userId)) : undefined
        if (userIdNum === undefined) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'User ID is required')
        }
        newTool.created_by = userIdNum
        newTool.created_on = Date.now()
        const tool = await dataSource.getRepository(Tool).create(newTool)
        const dbResponse = await dataSource.getRepository(Tool).save(tool)
        // Telemetry removed
        appServer.metricsProvider?.incrementCounter(AUTONOMOUS_METRIC_COUNTERS.TOOL_CREATED, { status: AUTONOMOUS_COUNTER_STATUS.SUCCESS })
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.createTool - ${getErrorMessage(error)}`)
    }
}

const deleteTool = async (toolId: string, orgId: string, userId?: number): Promise<any> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const whereClause: any = {
            guid: toolId
        }
        // User-based isolation: only allow deletion of own tools
        if (userId !== undefined) {
            whereClause.created_by = userId
        }
        const dbResponse = await dataSource.getRepository(Tool).delete(whereClause)
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.deleteTool - ${getErrorMessage(error)}`)
    }
}

const getAllTools = async (orgId: string, userId?: number, page: number = -1, limit: number = -1) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const queryBuilder = dataSource.getRepository(Tool).createQueryBuilder('tool').orderBy('tool.last_modified_on', 'DESC')

        // Org-level sharing: Show ALL tools in the organization
        // NO userId filtering

        if (page > 0 && limit > 0) {
            queryBuilder.skip((page - 1) * limit)
            queryBuilder.take(limit)
        }
        const [data, total] = await queryBuilder.getManyAndCount()

        // Add isCreator flag
        const dataWithCreatorFlag = data.map((tool) => ({
            ...tool,
            isCreator: userId && tool.created_by === userId,
            creatorId: tool.created_by
        }))

        if (page > 0 && limit > 0) {
            return { data: dataWithCreatorFlag, total }
        } else {
            return dataWithCreatorFlag
        }
    } catch (error) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.getAllTools - ${getErrorMessage(error)}`)
    }
}

const getToolById = async (toolId: string, orgId: string, userId?: number): Promise<any> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))

        // Org-level sharing: Allow access to any tool in the org
        const dbResponse = await dataSource.getRepository(Tool).findOneBy({
            guid: toolId
        })

        if (!dbResponse) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Tool ${toolId} not found`)
        }

        // Add isCreator flag
        return {
            ...dbResponse,
            isCreator: userId && dbResponse.created_by === userId,
            creatorId: dbResponse.created_by
        }
    } catch (error) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.getToolById - ${getErrorMessage(error)}`)
    }
}

const updateTool = async (toolId: string, toolBody: any, orgId: string, userId?: string | number): Promise<any> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const userIdNum = userId ? (typeof userId === 'number' ? userId : parseInt(userId)) : undefined
        const whereClause: any = {
            guid: toolId
        }
        // User-based isolation: only allow update of own tools
        if (userIdNum !== undefined) {
            whereClause.created_by = userIdNum
        }
        const tool = await dataSource.getRepository(Tool).findOneBy(whereClause)
        if (!tool) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Tool ${toolId} not found`)
        }
        // Map frontend 'id' (which is actually guid) to 'guid', and remove 'id' to prevent it from being assigned to numeric id field
        const { id, ...toolBodyWithoutId } = toolBody
        const toolBodyWithGuid = id ? { ...toolBodyWithoutId, guid: id } : toolBodyWithoutId
        const updateTool = new Tool()
        Object.assign(updateTool, toolBodyWithGuid)
        // Set last_modified_by and last_modified_on
        if (userIdNum !== undefined) {
            updateTool.last_modified_by = userIdNum
            updateTool.last_modified_on = Date.now()
        }
        dataSource.getRepository(Tool).merge(tool, updateTool)
        const dbResponse = await dataSource.getRepository(Tool).save(tool)
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.updateTool - ${getErrorMessage(error)}`)
    }
}

const importTools = async (newTools: Partial<Tool>[], orgId: string, userId: number, queryRunner?: QueryRunner) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const repository = queryRunner ? queryRunner.manager.getRepository(Tool) : dataSource.getRepository(Tool)

        // step 1 - check whether file tools array is zero
        if (newTools.length == 0) return

        // step 2 - check whether guids are duplicate in database
        let guids = '('
        let count: number = 0
        const lastCount = newTools.length - 1
        newTools.forEach((newTool) => {
            const guid = newTool.guid || generateGuid()
            guids += `'${guid}'`
            if (lastCount != count) guids += ','
            if (lastCount == count) guids += ')'
            count += 1
        })

        const selectResponse = await repository.createQueryBuilder('t').select('t.guid').where(`t.guid IN ${guids}`).getMany()
        const foundGuids = selectResponse.map((response) => {
            return response.guid
        })

        // step 3 - remove guids that are duplicate and generate new ones, set created_by and created_on
        const prepTools: Partial<Tool>[] = newTools.map((newTool) => {
            let guid: string = newTool.guid || generateGuid()
            if (foundGuids.includes(guid)) {
                guid = generateGuid()
                newTool.name = (newTool.name || '') + ' (1)'
            }
            newTool.guid = guid
            newTool.created_by = userId
            newTool.created_on = Date.now()
            return newTool
        })

        // step 4 - transactional insert array of entities
        const insertResponse = await repository.insert(prepTools)

        return insertResponse
    } catch (error) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.importTools - ${getErrorMessage(error)}`)
    }
}

export default {
    createTool,
    deleteTool,
    getAllTools,
    getToolById,
    updateTool,
    importTools
}
