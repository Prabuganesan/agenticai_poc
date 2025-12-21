import { Request, Response, NextFunction } from 'express'
import nodeConfigsService from '../../services/node-configs'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import { StatusCodes } from 'http-status-codes'

const getAllNodeConfigs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: nodeConfigsController.getAllNodeConfigs - body not provided!`
            )
        }
        const apiResponse = await nodeConfigsService.getAllNodeConfigs(req.body)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    getAllNodeConfigs
}
