import { Request, Response, NextFunction } from 'express'
import feedbackService from '../../services/feedback'
import { validateFeedbackForCreation, validateFeedbackForUpdate } from '../../services/feedback/validation'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import { StatusCodes } from 'http-status-codes'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'

const getAllChatMessageFeedback = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: feedbackController.getAllChatMessageFeedback - id not provided!`
            )
        }
        const authReq = req as AuthenticatedRequest
        const orgId = authReq.orgId || (req as any).orgId
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const chatflowid = req.params.id
        const chatId = req.query?.chatId as string | undefined
        const sortOrder = req.query?.order as string | undefined
        const startDate = req.query?.startDate as string | undefined
        const endDate = req.query?.endDate as string | undefined
        const apiResponse = await feedbackService.getAllChatMessageFeedback(chatflowid, orgId, chatId, sortOrder, startDate, endDate)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const createChatMessageFeedbackForChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: feedbackController.createChatMessageFeedbackForChatflow - body not provided!`
            )
        }
        const authReq = req as AuthenticatedRequest
        const orgId = authReq.orgId || (req as any).orgId
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        await validateFeedbackForCreation(req.body, orgId)
        // Get userId from authenticated request and pass it to service
        const userId = authReq.userId || (req as any).userId
        const apiResponse = await feedbackService.createChatMessageFeedbackForChatflow(req.body, orgId, userId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const updateChatMessageFeedbackForChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: feedbackController.updateChatMessageFeedbackForChatflow - body not provided!`
            )
        }
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: feedbackController.updateChatMessageFeedbackForChatflow - id not provided!`
            )
        }
        const authReq = req as AuthenticatedRequest
        const orgId = authReq.orgId || (req as any).orgId
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        await validateFeedbackForUpdate(req.params.id, orgId, req.body)
        const apiResponse = await feedbackService.updateChatMessageFeedbackForChatflow(req.params.id, orgId, req.body)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    getAllChatMessageFeedback,
    createChatMessageFeedbackForChatflow,
    updateChatMessageFeedbackForChatflow
}
