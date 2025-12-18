import { NextFunction, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import toolsService from '../../services/tools'
import { getPageAndLimitParams } from '../../utils/pagination'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'
import { transformEntityForResponse, transformPaginatedResponse } from '../../utils/responseTransform'

const createTool = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalAutonomousError(StatusCodes.PRECONDITION_FAILED, `Error: toolsController.createTool - body not provided!`)
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Error: toolsController.createTool - organization ${orgId} not found!`)
        }
        const body = req.body
        const userId = req.userId

        const apiResponse = await toolsService.createTool(body, orgId, userId)
        return res.json(transformEntityForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const deleteTool = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(StatusCodes.PRECONDITION_FAILED, `Error: toolsController.deleteTool - id not provided!`)
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Error: toolsController.deleteTool - organization ${orgId} not found!`)
        }
        const userId = req.userId ? parseInt(req.userId) : undefined
        const apiResponse = await toolsService.deleteTool(req.params.id, orgId, userId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllTools = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { page, limit } = getPageAndLimitParams(req as any)
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                `Error: toolsController.getAllTools - organization ${orgId} not found!`
            )
        }
        const userId = req.userId ? parseInt(req.userId) : undefined
        const apiResponse = await toolsService.getAllTools(orgId, userId, page, limit)
        return res.json(transformPaginatedResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const getToolById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(StatusCodes.PRECONDITION_FAILED, `Error: toolsController.getToolById - id not provided!`)
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                `Error: toolsController.getToolById - organization ${orgId} not found!`
            )
        }
        const userId = req.userId ? parseInt(req.userId) : undefined
        const apiResponse = await toolsService.getToolById(req.params.id, orgId, userId)
        return res.json(transformEntityForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const updateTool = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(StatusCodes.PRECONDITION_FAILED, `Error: toolsController.updateTool - id not provided!`)
        }
        if (!req.body) {
            throw new InternalAutonomousError(StatusCodes.PRECONDITION_FAILED, `Error: toolsController.deleteTool - body not provided!`)
        }
        const orgId = req.orgId
        const userId = req.userId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Error: toolsController.updateTool - organization ${orgId} not found!`)
        }
        const apiResponse = await toolsService.updateTool(req.params.id, req.body, orgId, userId)
        return res.json(transformEntityForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

export default {
    createTool,
    deleteTool,
    getAllTools,
    getToolById,
    updateTool
}
