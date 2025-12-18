import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { ChatflowType } from '../../Interface'
import apiKeyService from '../../services/apikey'
import chatflowsService from '../../services/chatflows'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { checkUsageLimit } from '../../utils/quotaUsage'
import { RateLimiterManager } from '../../utils/rateLimit'
import { getPageAndLimitParams } from '../../utils/pagination'
import { canModifyResource } from '../../utils/permissions'
// WorkspaceUserService removed for autonomous server
import { GeneralErrorMessage } from '../../utils/constants'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'
import { transformEntityForResponse, transformPaginatedResponse } from '../../utils/responseTransform'

const checkIfChatflowIsValidForStreaming = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Handle both / and /:id routes
        const chatflowId = req.params.id
        if (!chatflowId) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.checkIfChatflowIsValidForStreaming - id not provided!`
            )
        }
        const authReq = req as AuthenticatedRequest
        const orgId = authReq.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        // Extract userId for user-based isolation (optional - allows access to public flows)
        const userId = authReq.userId ? parseInt(authReq.userId) : undefined
        const apiResponse = await chatflowsService.checkIfChatflowIsValidForStreaming(chatflowId, orgId, userId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const checkIfChatflowIsValidForUploads = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.checkIfChatflowIsValidForUploads - id not provided!`
            )
        }
        // Require orgId upfront - no cross-org search
        const authReq = req as AuthenticatedRequest
        const orgId = authReq.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const apiResponse = await chatflowsService.checkIfChatflowIsValidForUploads(req.params.id, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deleteChatflow = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.deleteChatflow - id not provided!`
            )
        }

        // Check if user has permission to delete (creator-only)
        const { canModify } = await canModifyResource('chatflow', req.params.id, req.userId!, req.orgId!)

        if (!canModify) {
            throw new InternalAutonomousError(StatusCodes.FORBIDDEN, 'Only the creator can delete this chatflow')
        }

        const apiResponse = await chatflowsService.deleteChatflow(req, req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllChatflows = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // Get orgId from authenticated request, or fallback to query/header (for API access)
        let orgId = req.orgId
        if (!orgId) {
            orgId = (req.query?.orgId as string) || (req.headers['x-org-id'] as string)
        }

        if (!orgId) {
            throw new InternalAutonomousError(
                StatusCodes.BAD_REQUEST,
                'Organization ID (orgId) is required. Provide orgId in query parameter, X-Org-Id header, or ensure you are authenticated.'
            )
        }

        // Org-level sharing: userId is optional but used for isCreator flag
        // All users in the org can see all chatflows

        const { page, limit } = getPageAndLimitParams(req as any)

        // Create a minimal request-like object for the service
        const serviceReq = {
            orgId,
            userId: req.userId
        } as AuthenticatedRequest

        const apiResponse = await chatflowsService.getAllChatflows(serviceReq, req.query?.type as ChatflowType, page, limit)
        return res.json(transformPaginatedResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

// Get specific chatflow via api key
const getChatflowByApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.apikey) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.getChatflowByApiKey - apikey not provided!`
            )
        }
        // Extract orgId from query parameter or header (GET request)
        const orgId = (req.query?.orgId as string) || (req.headers['x-org-id'] as string)
        if (!orgId) {
            throw new InternalAutonomousError(
                StatusCodes.BAD_REQUEST,
                'Organization ID (orgId) is required. Provide orgId in query parameter or X-Org-Id header.'
            )
        }
        const apikey = await apiKeyService.getApiKey(req.params.apikey, orgId)
        if (!apikey) {
            return res.status(401).send('Unauthorized')
        }
        const apiResponse = await chatflowsService.getChatflowByApiKey(apikey.guid, orgId, req.query.keyonly)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getChatflowById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.getChatflowById - id not provided!`
            )
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        // Extract userId for user-based isolation (optional - allows access to public flows)
        const userId = req.userId ? parseInt(req.userId) : undefined
        const apiResponse = await chatflowsService.getChatflowById(req.params.id, orgId, userId)
        return res.json(transformEntityForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const saveChatflow = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.saveChatflow - body not provided!`
            )
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const body = req.body

        const existingChatflowCount = await chatflowsService.getAllChatflowsCountByOrganization(body.type, orgId)
        const newChatflowCount = 1
        await checkUsageLimit('flows', getRunningExpressApp().usageCacheManager, existingChatflowCount + newChatflowCount)

        // Map frontend 'id' (which is actually guid) to 'guid', and remove 'id' to prevent it from being assigned to numeric id field
        const { id, ...bodyWithoutId } = body
        const bodyWithGuid = id ? { ...bodyWithoutId, guid: id } : bodyWithoutId

        const newChatFlow = new ChatFlow()
        Object.assign(newChatFlow, bodyWithGuid)
        // orgId will be set by service from req.orgId
        const apiResponse = await chatflowsService.saveChatflow(req, newChatFlow, getRunningExpressApp().usageCacheManager)

        return res.json(transformEntityForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const updateChatflow = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.updateChatflow - id not provided!`
            )
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        // Check if user has permission to update (creator-only)
        const { canModify } = await canModifyResource('chatflow', req.params.id, req.userId!, req.orgId!)

        if (!canModify) {
            throw new InternalAutonomousError(StatusCodes.FORBIDDEN, 'Only the creator can modify this chatflow')
        }

        const chatflow = await chatflowsService.getChatflowById(req.params.id, orgId)
        if (!chatflow) {
            return res.status(404).send(`Chatflow ${req.params.id} not found`)
        }
        const body = req.body
        // Map frontend 'id' (which is actually guid) to 'guid', and remove 'id' to prevent it from being assigned to numeric id field
        const { id, ...bodyWithoutId } = body
        const bodyWithGuid = id ? { ...bodyWithoutId, guid: id } : bodyWithoutId

        const updateChatFlow = new ChatFlow()
        Object.assign(updateChatFlow, bodyWithGuid)

        updateChatFlow.guid = chatflow.guid
        const rateLimiterManager = RateLimiterManager.getInstance()
        await rateLimiterManager.updateRateLimiter(updateChatFlow)

        const apiResponse = await chatflowsService.updateChatflow(req, chatflow, updateChatFlow)
        return res.json(transformEntityForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const getSinglePublicChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.getSinglePublicChatflow - id not provided!`
            )
        }
        // Require orgId upfront - no cross-org search
        const authReq = req as AuthenticatedRequest
        const orgId = authReq.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const appServer = getRunningExpressApp()
        const { getDataSource } = await import('../../DataSource')
        const dataSource = getDataSource(parseInt(orgId))
        const chatflow = await dataSource.getRepository(ChatFlow).findOne({
            where: { guid: req.params.id }
        })
        if (!chatflow) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: 'Chatflow not found' })
        }
        if (chatflow.isPublic) {
            return res.status(StatusCodes.OK).json(chatflow)
        }

        // For non-public chatflows, require authentication
        if (!authReq.user || !authReq.orgId) {
            return res.status(StatusCodes.UNAUTHORIZED).json({ message: GeneralErrorMessage.UNAUTHORIZED })
        }

        // Database isolation provides security - no need to check orgId match
        return res.status(StatusCodes.OK).json(chatflow)
    } catch (error) {
        next(error)
    }
}

const getSinglePublicChatbotConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.getSinglePublicChatbotConfig - id not provided!`
            )
        }
        const httpProtocol = req.get('x-forwarded-proto') || req.protocol
        const host = req.get('host') || `${process.env.HOST || 'localhost'}:${process.env.SERVER_PORT || '3030'}`
        const baseURL = `${httpProtocol}://${host}`
        const authReq = req as AuthenticatedRequest
        const orgId = authReq.orgId
        // Extract userId for user-based isolation (optional - allows access to public flows)
        const userId = authReq.userId ? parseInt(authReq.userId) : undefined
        const apiResponse = await chatflowsService.getSinglePublicChatbotConfig(req.params.id, baseURL, orgId, userId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const checkIfChatflowHasChanged = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.checkIfChatflowHasChanged - id not provided!`
            )
        }
        const authReq = req as AuthenticatedRequest
        const orgId = authReq.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        // lastUpdatedDateTime is optional - if not provided, just check if chatflow exists and has been modified
        const lastUpdatedDateTime = req.params.lastUpdatedDateTime || undefined
        const apiResponse = await chatflowsService.checkIfChatflowHasChanged(req.params.id, lastUpdatedDateTime, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getEmbedTheme = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.getEmbedTheme - id not provided!`
            )
        }
        const httpProtocol = req.get('x-forwarded-proto') || req.protocol
        const host = req.get('host') || `${process.env.HOST || 'localhost'}:${process.env.SERVER_PORT || '3030'}`
        const baseURL = `${httpProtocol}://${host}`
        const theme = await chatflowsService.getEmbedTheme(req.params.id, baseURL)
        return res.json(theme)
    } catch (error) {
        next(error)
    }
}

export default {
    checkIfChatflowIsValidForStreaming,
    checkIfChatflowIsValidForUploads,
    deleteChatflow,
    getAllChatflows,
    getChatflowByApiKey,
    getChatflowById,
    saveChatflow,
    updateChatflow,
    getSinglePublicChatflow,
    getSinglePublicChatbotConfig,
    checkIfChatflowHasChanged,
    getEmbedTheme
}
