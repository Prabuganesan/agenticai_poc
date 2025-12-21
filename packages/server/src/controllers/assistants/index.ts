import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import { AssistantType } from '../../Interface'
import assistantsService from '../../services/assistants'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { checkUsageLimit } from '../../utils/quotaUsage'
import { transformEntityForResponse, transformEntitiesForResponse } from '../../utils/responseTransform'

const createAssistant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.createAssistant - body not provided!`
            )
        }
        const body = req.body
        const orgId = (req as any).orgId || req.user?.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.NOT_FOUND,
                `Error: assistantsController.createAssistant - organization ${orgId} not found!`
            )
        }
        const existingAssistantCount = await assistantsService.getAssistantsCountByOrganization(body.type, orgId)
        const newAssistantCount = 1
        await checkUsageLimit('flows', getRunningExpressApp().usageCacheManager, existingAssistantCount + newAssistantCount)
        const userId = (req as any).userId
        const apiResponse = await assistantsService.createAssistant(body, orgId, userId)

        return res.json(transformEntityForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const deleteAssistant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.deleteAssistant - id not provided!`
            )
        }
        const orgId = (req as any).orgId || req.user?.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.NOT_FOUND,
                `Error: assistantsController.deleteAssistant - organization ${orgId} not found!`
            )
        }
        const userId = (req as any).userId ? parseInt((req as any).userId) : undefined
        const apiResponse = await assistantsService.deleteAssistant(req.params.id, req.query.isDeleteBoth, orgId, userId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllAssistants = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const type = req.query.type as AssistantType
        const orgId = (req as any).orgId || req.user?.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.NOT_FOUND,
                `Error: assistantsController.getAllAssistants - organization ${orgId} not found!`
            )
        }
        const userId = (req as any).userId ? parseInt((req as any).userId) : undefined
        const apiResponse = await assistantsService.getAllAssistants(orgId, userId, type)
        return res.json(transformEntitiesForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const getAssistantById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.getAssistantById - id not provided!`
            )
        }
        const orgId = (req as any).orgId || req.user?.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.NOT_FOUND,
                `Error: assistantsController.getAssistantById - organization ${orgId} not found!`
            )
        }
        const userId = (req as any).userId ? parseInt((req as any).userId) : undefined
        const apiResponse = await assistantsService.getAssistantById(req.params.id, orgId, userId)
        return res.json(transformEntityForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const updateAssistant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.updateAssistant - id not provided!`
            )
        }
        if (!req.body) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.updateAssistant - body not provided!`
            )
        }
        const orgId = (req as any).orgId || req.user?.orgId
        const userId = (req as any).userId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.NOT_FOUND,
                `Error: assistantsController.updateAssistant - organization ${orgId} not found!`
            )
        }
        const apiResponse = await assistantsService.updateAssistant(req.params.id, req.body, orgId, userId)
        return res.json(transformEntityForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const getChatModels = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiResponse = await assistantsService.getChatModels()
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getDocumentStores = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Try multiple sources for orgId (GET requests may have it in query params)
        let orgId = (req as any).orgId || req.user?.orgId || (req.query?.orgId as string) || (req.headers['x-org-id'] as string)

        // Fallback: Try to extract orgId from session token if available
        if (!orgId && req.cookies?.KODIID) {
            try {
                const token = req.cookies.KODIID
                const parts = token.split('$$')
                const autoPart = parts[parts.length - 1] // "Auto{orgId}"
                if (autoPart && autoPart.startsWith('Auto')) {
                    orgId = autoPart.substring(4) // Remove "Auto" prefix to get orgId
                }
            } catch (tokenError) {
                // Silently fail - token parsing is just a fallback
            }
        }

        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.NOT_FOUND,
                `Error: assistantsController.getDocumentStores - organization ID is required. Provide orgId in query parameter (GET) or ensure session/API key authentication is configured.`
            )
        }
        const apiResponse = await assistantsService.getDocumentStores(orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getTools = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiResponse = await assistantsService.getTools()
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const generateAssistantInstruction = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.generateAssistantInstruction - body not provided!`
            )
        }
        const authReq = req as any
        const orgId = authReq.orgId || (req as any).orgId
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const apiResponse = await assistantsService.generateAssistantInstruction(req.body.task, req.body.selectedChatModel, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    createAssistant,
    deleteAssistant,
    getAllAssistants,
    getAssistantById,
    updateAssistant,
    getChatModels,
    getDocumentStores,
    getTools,
    generateAssistantInstruction
}
