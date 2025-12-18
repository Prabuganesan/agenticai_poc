import { Request, Response, NextFunction } from 'express'
import validationService from '../../services/validation'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { StatusCodes } from 'http-status-codes'

const checkFlowValidation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const flowId = req.params?.id as string | undefined
        if (!flowId) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: validationController.checkFlowValidation - id not provided!`
            )
        }
        // Get orgId from request object (set by session validation middleware) - single source
        const authReq = req as any
        const orgId = authReq.orgId
        const apiResponse = await validationService.checkFlowValidation(flowId, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    checkFlowValidation
}
