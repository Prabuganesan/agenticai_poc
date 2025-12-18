import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { getErrorMessage } from '../../errors/utils'
import { MODE } from '../../Interface'
import chatflowService from '../../services/chatflows'
import { utilBuildChatflow } from '../../utils/buildChatflow'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'
import { logWarn } from '../../utils/logger/system-helper'
import { v4 as uuidv4 } from 'uuid'

// Send input message and get prediction result (Internal)
const createInternalPrediction = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const chatflow = await chatflowService.getChatflowById(req.params.id, orgId)
        if (!chatflow) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Chatflow ${req.params.id} not found`)
        }

        if (req.body.streaming || req.body.streaming === 'true') {
            createAndStreamInternalPrediction(req as any, res, next)
            return
        } else {
            const apiResponse = await utilBuildChatflow(req as any, true)
            if (apiResponse) return res.json(apiResponse)
        }
    } catch (error) {
        next(error)
    }
}

// Send input message and stream prediction result using SSE (Internal)
const createAndStreamInternalPrediction = async (req: Request, res: Response, next: NextFunction) => {
    // Auto-generate chatId if not provided (same as external predictions)
    let chatId = req.body.chatId ?? req.body.overrideConfig?.sessionId ?? uuidv4()
    if (!chatId || typeof chatId !== 'string') {
        chatId = uuidv4()
    }
    // Set chatId in request body so utilBuildChatflow can use it
    req.body.chatId = chatId
    
    const sseStreamer = getRunningExpressApp().sseStreamer

    try {
        const orgId = (req as any).orgId
        const userId = (req as any).userId
        sseStreamer.addClient(chatId, res, orgId, userId)
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.setHeader('X-Accel-Buffering', 'no') //nginx config: https://serverfault.com/a/801629
        res.flushHeaders()

        if (process.env.MODE === MODE.QUEUE) {
            const orgId = (req as any).orgId
            if (orgId !== undefined && orgId !== null) {
                const orgIdNum = typeof orgId === 'number' ? orgId : parseInt(String(orgId), 10)
                if (!isNaN(orgIdNum)) {
                    getRunningExpressApp().redisSubscriber.subscribe(chatId, orgIdNum)
                } else {
                    logWarn(`[createAndStreamInternalPrediction] Invalid orgId: ${orgId}, skipping Redis subscription`).catch(() => {})
                }
            } else {
                logWarn(`[createAndStreamInternalPrediction] orgId is undefined, skipping Redis subscription`).catch(() => {})
            }
        }

        const apiResponse = await utilBuildChatflow(req, true)
        sseStreamer.streamMetadataEvent(apiResponse.chatId, apiResponse)
    } catch (error) {
        if (chatId) {
            sseStreamer.streamErrorEvent(chatId, getErrorMessage(error))
        }
        next(error)
    } finally {
        sseStreamer.removeClient(chatId)
    }
}
export default {
    createInternalPrediction
}
