import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import schedulesService from '../../services/schedules'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'
import { getPageAndLimitParams } from '../../utils/pagination'

const createSchedule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: schedulesController.createSchedule - body not provided!`
            )
        }

        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const apiResponse = await schedulesService.createSchedule(req, req.body)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllSchedules = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const { page, limit } = getPageAndLimitParams(req as any)

        const apiResponse = await schedulesService.getAllSchedules(req, page, limit)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getScheduleById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: schedulesController.getScheduleById - id not provided!`
            )
        }

        const apiResponse = await schedulesService.getScheduleById(req, req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const updateSchedule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: schedulesController.updateSchedule - id not provided!`
            )
        }

        if (!req.body) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: schedulesController.updateSchedule - body not provided!`
            )
        }

        const apiResponse = await schedulesService.updateSchedule(req, req.params.id, req.body)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deleteSchedule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: schedulesController.deleteSchedule - id not provided!`
            )
        }

        const apiResponse = await schedulesService.deleteSchedule(req, req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    createSchedule,
    getAllSchedules,
    getScheduleById,
    updateSchedule,
    deleteSchedule
}
