import { Request, Response, NextFunction } from 'express'
import { RateLimiterManager } from '../../utils/rateLimit'
import chatflowsService from '../../services/chatflows'
import { logInfo, logWarn } from '../../utils/logger/system-helper'
import predictionsServices from '../../services/predictions'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { v4 as uuidv4 } from 'uuid'
import { getErrorMessage } from '../../errors/utils'
import { MODE } from '../../Interface'

// Send input message and get prediction result (External)
const createPrediction = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: predictionsController.createPrediction - id not provided!`
            )
        }
        if (!req.body) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: predictionsController.createPrediction - body not provided!`
            )
        }
        // Require orgId upfront - no cross-org search
        const authReq = req as any
        // For internal tool requests (e.g., ExecuteFlow), check x-org-id header
        // Otherwise, use orgId from session (set by middleware)
        let orgId: string | undefined = authReq.orgId || (req.headers['x-org-id'] as string | undefined)
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        // Set orgId on request so utilBuildChatflow can access it
        authReq.orgId = orgId

        // For tool requests, also check x-user-id header (for user-based isolation)
        // If not provided, userId will be undefined and messages will use system user (0)
        const userId = authReq.userId || (req.headers['x-user-id'] as string | undefined)
        if (userId) {
            authReq.userId = userId
        }

        const chatflow = await chatflowsService.getChatflowById(req.params.id, orgId)
        if (!chatflow) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Chatflow ${req.params.id} not found`)
        }
        let isDomainAllowed = true
        let unauthorizedOriginError = 'This site is not allowed to access this chatbot'
        logInfo(`[server]: Request originated from ${req.headers.origin || 'UNKNOWN ORIGIN'}`).catch(() => {})
        if (chatflow.chatbotConfig) {
            const parsedConfig = JSON.parse(chatflow.chatbotConfig)
            // check whether the first one is not empty. if it is empty that means the user set a value and then removed it.
            const isValidAllowedOrigins = parsedConfig.allowedOrigins?.length && parsedConfig.allowedOrigins[0] !== ''
            unauthorizedOriginError = parsedConfig.allowedOriginsError || 'This site is not allowed to access this chatbot'
            if (isValidAllowedOrigins && req.headers.origin) {
                const originHeader = req.headers.origin
                const origin = new URL(originHeader).host
                isDomainAllowed =
                    parsedConfig.allowedOrigins.filter((domain: string) => {
                        try {
                            const allowedOrigin = new URL(domain).host
                            return origin === allowedOrigin
                        } catch (e) {
                            return false
                        }
                    }).length > 0
            }
        }
        if (isDomainAllowed) {
            const streamable = await chatflowsService.checkIfChatflowIsValidForStreaming(req.params.id, orgId)
            const isStreamingRequested = req.body.streaming === 'true' || req.body.streaming === true
            if (streamable?.isStreaming && isStreamingRequested) {
                const sseStreamer = getRunningExpressApp().sseStreamer

                let chatId = req.body.chatId
                if (!req.body.chatId) {
                    chatId = req.body.chatId ?? req.body.overrideConfig?.sessionId ?? uuidv4()
                    req.body.chatId = chatId
                }
                try {
                    sseStreamer.addExternalClient(chatId, res)
                    res.setHeader('Content-Type', 'text/event-stream')
                    res.setHeader('Cache-Control', 'no-cache')
                    res.setHeader('Connection', 'keep-alive')
                    res.setHeader('X-Accel-Buffering', 'no') //nginx config: https://serverfault.com/a/801629
                    res.flushHeaders()

                    if (process.env.MODE === MODE.QUEUE) {
                        if (chatId && typeof chatId === 'string') {
                            if (orgId !== undefined && orgId !== null) {
                                const orgIdNum = typeof orgId === 'number' ? orgId : parseInt(String(orgId), 10)
                                if (!isNaN(orgIdNum)) {
                                    getRunningExpressApp().redisSubscriber.subscribe(chatId, orgIdNum)
                                } else {
                                    logWarn(`[predictions] Invalid orgId: ${orgId}, skipping Redis subscription`).catch(() => {})
                                }
                            } else {
                                logWarn(`[predictions] orgId is undefined, skipping Redis subscription`).catch(() => {})
                            }
                        } else {
                            logWarn(`[predictions] Invalid chatId: ${chatId}, skipping Redis subscription`).catch(() => {})
                        }
                    }

                    const apiResponse = await predictionsServices.buildChatflow(req)
                    sseStreamer.streamMetadataEvent(apiResponse.chatId, apiResponse)
                } catch (error) {
                    if (chatId) {
                        sseStreamer.streamErrorEvent(chatId, getErrorMessage(error))
                    }
                    next(error)
                } finally {
                    sseStreamer.removeClient(chatId)
                }
            } else {
                const apiResponse = await predictionsServices.buildChatflow(req)
                return res.json(apiResponse)
            }
        } else {
            const isStreamingRequested = req.body.streaming === 'true' || req.body.streaming === true
            if (isStreamingRequested) {
                return res.status(StatusCodes.FORBIDDEN).send(unauthorizedOriginError)
            }
            throw new InternalAutonomousError(StatusCodes.FORBIDDEN, unauthorizedOriginError)
        }
    } catch (error) {
        next(error)
    }
}

const getRateLimiterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        return RateLimiterManager.getInstance().getRateLimiter()(req, res, next)
    } catch (error) {
        next(error)
    }
}

export default {
    createPrediction,
    getRateLimiterMiddleware
}
