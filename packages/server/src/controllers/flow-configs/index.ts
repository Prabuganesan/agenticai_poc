import { Request, Response, NextFunction } from 'express'
import flowConfigsService from '../../services/flow-configs'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import { StatusCodes } from 'http-status-codes'

const getSingleFlowConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: flowConfigsController.getSingleFlowConfig - id not provided!`
            )
        }
        const orgId = (req as any).orgId || req.user?.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.NOT_FOUND,
                `Error: flowConfigsController.getSingleFlowConfig - organization ${orgId} not found!`
            )
        }
        const apiResponse = await flowConfigsService.getSingleFlowConfig(req.params.id, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    getSingleFlowConfig
}
