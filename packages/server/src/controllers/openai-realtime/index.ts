import { Request, Response, NextFunction } from 'express'
import openaiRealTimeService from '../../services/openai-realtime'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { StatusCodes } from 'http-status-codes'

const getAgentTools = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: openaiRealTimeController.getAgentTools - id not provided!`
            )
        }
        const orgId = (req as any).orgId || (req as any).user?.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const apiResponse = await openaiRealTimeService.getAgentTools(req.params.id, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const executeAgentTool = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: openaiRealTimeController.executeAgentTool - id not provided!`
            )
        }
        if (!req.body) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: openaiRealTimeController.executeAgentTool - body not provided!`
            )
        }
        if (!req.body.chatId) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: openaiRealTimeController.executeAgentTool - body chatId not provided!`
            )
        }
        if (!req.body.toolName) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: openaiRealTimeController.executeAgentTool - body toolName not provided!`
            )
        }
        if (!req.body.inputArgs) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: openaiRealTimeController.executeAgentTool - body inputArgs not provided!`
            )
        }
        const orgId = (req as any).orgId || (req as any).user?.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const apiResponse = await openaiRealTimeService.executeAgentTool(
            req.params.id,
            orgId,
            req.body.chatId,
            req.body.toolName,
            req.body.inputArgs,
            req.body.apiMessageId
        )
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    getAgentTools,
    executeAgentTool
}
