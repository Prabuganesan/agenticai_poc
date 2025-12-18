import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'
import chatSessionsService from '../../services/chat-sessions'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { StatusCodes } from 'http-status-codes'
import { getPageAndLimitParams } from '../../utils/pagination'
import { transformEntityForResponse, transformEntitiesForResponse } from '../../utils/responseTransform'

// Create a new chat session
const createChatSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const orgId = req.orgId!
        const userId = req.userId!

        if (!orgId || !userId) {
            throw new InternalAutonomousError(
                StatusCodes.UNAUTHORIZED,
                'Error: chatSessionsController.createChatSession - orgId or userId not found in request!'
            )
        }

        const { chatflowId, title } = req.body || {}

        if (!chatflowId) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                'Error: chatSessionsController.createChatSession - chatflowId not provided!'
            )
        }

        const session = await chatSessionsService.createChatSession(chatflowId, orgId, userId, title)
        return res.json(transformEntityForResponse(session))
    } catch (error) {
        next(error)
    }
}

// Get all chat sessions for a chatflow
const getAllChatSessions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const orgId = req.orgId!
        const userId = req.userId!

        if (!orgId || !userId) {
            throw new InternalAutonomousError(
                StatusCodes.UNAUTHORIZED,
                'Error: chatSessionsController.getAllChatSessions - orgId or userId not found in request!'
            )
        }

        const { chatflowId } = req.body

        if (!chatflowId) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                'Error: chatSessionsController.getAllChatSessions - chatflowId not provided!'
            )
        }

        const { page, limit } = getPageAndLimitParams(req as any)

        const result = await chatSessionsService.getAllChatSessions(chatflowId, orgId, userId, page, limit)
        // Transform sessions and return in format expected by frontend
        const transformedSessions = transformEntitiesForResponse(result.sessions)
        const response = {
            sessions: transformedSessions,
            sessionsCount: transformedSessions.length,
            total: result.total,
            // Also include 'data' for backward compatibility
            data: transformedSessions
        }
        return res.json(response)
    } catch (error) {
        next(error)
    }
}

// Get a chat session by chatId
const getChatSessionById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const orgId = req.orgId!
        const userId = req.userId!

        if (!orgId || !userId) {
            throw new InternalAutonomousError(
                StatusCodes.UNAUTHORIZED,
                'Error: chatSessionsController.getChatSessionById - orgId or userId not found in request!'
            )
        }

        const { chatId } = req.body

        if (!chatId) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                'Error: chatSessionsController.getChatSessionById - chatId not provided!'
            )
        }

        const session = await chatSessionsService.getChatSessionById(chatId, orgId, userId)

        if (!session) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                'Error: chatSessionsController.getChatSessionById - Chat session not found!'
            )
        }

        return res.json(transformEntityForResponse(session))
    } catch (error) {
        next(error)
    }
}

// Update a chat session
const updateChatSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const orgId = req.orgId!
        const userId = req.userId!

        if (!orgId || !userId) {
            throw new InternalAutonomousError(
                StatusCodes.UNAUTHORIZED,
                'Error: chatSessionsController.updateChatSession - orgId or userId not found in request!'
            )
        }

        const { chatId, title, preview, messageCount } = req.body

        if (!chatId) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                'Error: chatSessionsController.updateChatSession - chatId not provided!'
            )
        }

        const updates: any = {}
        if (title !== undefined) updates.title = title
        if (preview !== undefined) updates.preview = preview
        if (messageCount !== undefined) updates.messageCount = messageCount

        const session = await chatSessionsService.updateChatSession(chatId, orgId, userId, updates)
        return res.json(transformEntityForResponse(session))
    } catch (error) {
        next(error)
    }
}

// Delete a chat session
const deleteChatSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const orgId = req.orgId!
        const userId = req.userId!

        if (!orgId || !userId) {
            throw new InternalAutonomousError(
                StatusCodes.UNAUTHORIZED,
                'Error: chatSessionsController.deleteChatSession - orgId or userId not found in request!'
            )
        }

        const { chatId } = req.body

        if (!chatId) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                'Error: chatSessionsController.deleteChatSession - chatId not provided!'
            )
        }

        await chatSessionsService.deleteChatSession(chatId, orgId, userId)
        return res.json({ success: true, message: 'Chat session deleted successfully' })
    } catch (error) {
        next(error)
    }
}

export default {
    createChatSession,
    getAllChatSessions,
    getChatSessionById,
    updateChatSession,
    deleteChatSession
}
