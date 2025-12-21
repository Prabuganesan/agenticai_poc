import { StatusCodes } from 'http-status-codes'
import { Variable } from '../../database/entities/Variable'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import { getErrorMessage } from '../../errors/utils'
import { QueryRunner } from 'typeorm'
import { getDataSource } from '../../DataSource'
import { generateGuid } from '../../utils/guidGenerator'

const createVariable = async (newVariable: Variable, orgId: string, userId?: string | number) => {
    // Runtime variables are allowed in kodivian server (no platform restrictions)
    try {
        const dataSource = getDataSource(parseInt(orgId))
        // Generate GUID if not provided
        if (!newVariable.guid) {
            newVariable.guid = generateGuid()
        }
        // Set created_by and created_on
        const userIdNum = userId ? (typeof userId === 'number' ? userId : parseInt(userId)) : undefined
        if (userIdNum === undefined) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'User ID is required')
        }
        newVariable.created_by = userIdNum
        newVariable.created_on = Date.now()
        const variable = await dataSource.getRepository(Variable).create(newVariable)
        const dbResponse = await dataSource.getRepository(Variable).save(variable)
        // Telemetry removed
        return dbResponse
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: variablesServices.createVariable - ${getErrorMessage(error)}`
        )
    }
}

const deleteVariable = async (variableId: string, orgId: string, userId?: number): Promise<any> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const whereClause: any = {
            guid: variableId
        }
        // User-based isolation: only allow deletion of own variables
        if (userId !== undefined) {
            whereClause.created_by = userId
        }
        const dbResponse = await dataSource.getRepository(Variable).delete(whereClause)
        return dbResponse
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: variablesServices.deleteVariable - ${getErrorMessage(error)}`
        )
    }
}

const getAllVariables = async (orgId: string, userId?: number, page: number = -1, limit: number = -1) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const queryBuilder = dataSource.getRepository(Variable).createQueryBuilder('variable').orderBy('variable.last_modified_on', 'DESC')

        // Org-level sharing: Show ALL variables in the organization
        // NO userId filtering

        if (page > 0 && limit > 0) {
            queryBuilder.skip((page - 1) * limit)
            queryBuilder.take(limit)
        }

        const [data, total] = await queryBuilder.getManyAndCount()

        // Add isCreator flag
        const dataWithCreatorFlag = data.map((variable) => ({
            ...variable,
            isCreator: userId && variable.created_by === userId,
            creatorId: variable.created_by
        }))

        if (page > 0 && limit > 0) {
            return { data: dataWithCreatorFlag, total }
        } else {
            return dataWithCreatorFlag
        }
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: variablesServices.getAllVariables - ${getErrorMessage(error)}`
        )
    }
}

const getVariableById = async (variableId: string, orgId: string, userId?: number) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))

        // Org-level sharing: Allow access to any variable in the org
        const dbResponse = await dataSource.getRepository(Variable).findOneBy({
            guid: variableId
        })

        if (!dbResponse) {
            return null
        }

        // Add isCreator flag
        return {
            ...dbResponse,
            isCreator: userId && dbResponse.created_by === userId,
            creatorId: dbResponse.created_by
        }
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: variablesServices.getVariableById - ${getErrorMessage(error)}`
        )
    }
}

const updateVariable = async (variable: Variable, updatedVariable: Variable, orgId: string, userId?: string | number) => {
    // Runtime variables are allowed in kodivian server (no platform restrictions)
    try {
        const dataSource = getDataSource(parseInt(orgId))
        // Set last_modified_by and last_modified_on
        const userIdNum = userId ? (typeof userId === 'number' ? userId : parseInt(userId)) : undefined
        if (userIdNum !== undefined) {
            updatedVariable.last_modified_by = userIdNum
            updatedVariable.last_modified_on = Date.now()
        }
        const tmpUpdatedVariable = await dataSource.getRepository(Variable).merge(variable, updatedVariable)
        const dbResponse = await dataSource.getRepository(Variable).save(tmpUpdatedVariable)
        return dbResponse
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: variablesServices.updateVariable - ${getErrorMessage(error)}`
        )
    }
}

const importVariables = async (
    newVariables: Partial<Variable>[],
    orgId: string,
    userId: number,
    queryRunner?: QueryRunner
): Promise<any> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const repository = queryRunner ? queryRunner.manager.getRepository(Variable) : dataSource.getRepository(Variable)

        // step 1 - check whether array is zero
        if (newVariables.length == 0) return

        // step 2 - check whether guids are duplicate in database
        let guids = '('
        let count: number = 0
        const lastCount = newVariables.length - 1
        newVariables.forEach((newVariable) => {
            const guid = newVariable.guid || generateGuid()
            guids += `'${guid}'`
            if (lastCount != count) guids += ','
            if (lastCount == count) guids += ')'
            count += 1
        })

        const selectResponse = await repository.createQueryBuilder('v').select('v.guid').where(`v.guid IN ${guids}`).getMany()
        const foundGuids = selectResponse.map((response) => {
            return response.guid
        })

        // step 3 - remove guids that are duplicate and generate new ones, set created_by and created_on
        let prepVariables: Partial<Variable>[] = newVariables.map((newVariable) => {
            let guid: string = newVariable.guid || generateGuid()
            if (foundGuids.includes(guid)) {
                guid = generateGuid()
                newVariable.name = (newVariable.name || '') + ' (1)'
            }
            newVariable.guid = guid
            newVariable.created_by = userId
            newVariable.created_on = Date.now()
            return newVariable
        })

        // Runtime variables are allowed in kodivian server (no platform restrictions)

        // step 4 - transactional insert array of entities
        const insertResponse = await repository.insert(prepVariables)

        return insertResponse
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: variableService.importVariables - ${getErrorMessage(error)}`
        )
    }
}

export default {
    createVariable,
    deleteVariable,
    getAllVariables,
    getVariableById,
    updateVariable,
    importVariables
}
