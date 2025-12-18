import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import marketplacesService from '../../services/marketplaces'
import { transformEntityForResponse, transformEntitiesForResponse } from '../../utils/responseTransform'

// Get all templates for marketplaces
const getAllTemplates = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiResponse = await marketplacesService.getAllTemplates()
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deleteCustomTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: marketplacesService.deleteCustomTemplate - id not provided!`
            )
        }
        const orgId = (req as any).orgId || req.user?.orgId
        if (!orgId) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                `Error: marketplacesController.deleteCustomTemplate - organization ${orgId} not found!`
            )
        }
        const apiResponse = await marketplacesService.deleteCustomTemplate(req.params.id, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllCustomTemplates = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orgId = (req as any).orgId || req.user?.orgId
        const apiResponse = await marketplacesService.getAllCustomTemplates(orgId)
        return res.json(transformEntitiesForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const saveCustomTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Check if req.body exists first to avoid TypeError when accessing properties
        if (!req.body || (!req.body.name && !(req.body.chatflowId || req.body.tool))) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: marketplacesService.saveCustomTemplate - body not provided!`
            )
        }
        const body = req.body
        const orgId = (req as any).orgId || req.user?.orgId
        const userId = (req as any).userId
        if (!orgId) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                `Error: marketplacesController.saveCustomTemplate - organization ${orgId} not found!`
            )
        }
        const apiResponse = await marketplacesService.saveCustomTemplate(body, orgId, userId)
        return res.json(transformEntityForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

export default {
    getAllTemplates,
    getAllCustomTemplates,
    saveCustomTemplate,
    deleteCustomTemplate
}
