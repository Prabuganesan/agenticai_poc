import { Response, NextFunction } from 'express'
import variablesService from '../../services/variables'
import { Variable } from '../../database/entities/Variable'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { StatusCodes } from 'http-status-codes'
import { getPageAndLimitParams } from '../../utils/pagination'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'
import { transformEntityForResponse, transformPaginatedResponse } from '../../utils/responseTransform'

const createVariable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined') {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: variablesController.createVariable - body not provided!`
            )
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                `Error: variablesController.createVariable - organization ${orgId} not found!`
            )
        }
        const body = req.body
        const userId = req.userId
        // Map frontend 'id' (which is actually guid) to 'guid', and remove 'id' to prevent it from being assigned to numeric id field
        const { id, ...bodyWithoutId } = body
        const bodyWithGuid = id ? { ...bodyWithoutId, guid: id } : bodyWithoutId
        const newVariable = new Variable()
        Object.assign(newVariable, bodyWithGuid)
        const apiResponse = await variablesService.createVariable(newVariable, orgId, userId)
        return res.json(transformEntityForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const deleteVariable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                'Error: variablesController.deleteVariable - id not provided!'
            )
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                `Error: variablesController.deleteVariable - organization ${orgId} not found!`
            )
        }
        const userId = req.userId ? parseInt(req.userId) : undefined
        const apiResponse = await variablesService.deleteVariable(req.params.id, orgId, userId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllVariables = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { page, limit } = getPageAndLimitParams(req as any)
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                `Error: variablesController.getAllVariables - organization ${orgId} not found!`
            )
        }
        const userId = req.userId ? parseInt(req.userId) : undefined
        const apiResponse = await variablesService.getAllVariables(orgId, userId, page, limit)
        return res.json(transformPaginatedResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const updateVariable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                'Error: variablesController.updateVariable - id not provided!'
            )
        }
        if (typeof req.body === 'undefined') {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                'Error: variablesController.updateVariable - body not provided!'
            )
        }
        // Get orgId from request object (set by session validation middleware) - single source
        const authReq = req as any
        const orgId = authReq.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const userId = req.userId
        const userIdNum = userId ? parseInt(userId) : undefined
        const variable = await variablesService.getVariableById(req.params.id, orgId, userIdNum)
        if (!variable) {
            return res.status(404).send(`Variable ${req.params.id} not found in the database`)
        }
        const body = req.body
        // Map frontend 'id' (which is actually guid) to 'guid', and remove 'id' to prevent it from being assigned to numeric id field
        const { id, ...bodyWithoutId } = body
        const bodyWithGuid = id ? { ...bodyWithoutId, guid: id } : bodyWithoutId
        const updatedVariable = new Variable()
        Object.assign(updatedVariable, bodyWithGuid)
        const apiResponse = await variablesService.updateVariable(variable, updatedVariable, orgId, userId)
        return res.json(transformEntityForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

export default {
    createVariable,
    deleteVariable,
    getAllVariables,
    updateVariable
}
