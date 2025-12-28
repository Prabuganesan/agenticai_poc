import { StatusCodes } from 'http-status-codes'
import { getDataSource } from '../../DataSource'
import { Schedule, ScheduleStatus, ScheduleTargetType } from '../../database/entities/Schedule'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import { getErrorMessage } from '../../errors/utils'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'
import { logInfo } from '../../utils/logger/system-helper'
import { generateGuid } from '../../utils/guidGenerator'
import { FindOptionsWhere } from 'typeorm'

interface CreateSchedulePayload {
    name: string
    chatflowId: string
    scheduleType: any
    cronExpression?: string
    interval?: number
    startDate?: Date
    status?: ScheduleStatus
}

const createSchedule = async (req: AuthenticatedRequest, payload: CreateSchedulePayload): Promise<Schedule> => {
    try {
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))

        // Basic validation
        if (!payload.name || !payload.chatflowId || !payload.scheduleType) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Name, Chatflow ID, and Schedule Type are required')
        }

        const newSchedule = new Schedule()
        newSchedule.name = payload.name
        newSchedule.guid = generateGuid()
        newSchedule.targetType = ScheduleTargetType.CHATFLOW // Default to chatflow for now
        newSchedule.targetId = payload.chatflowId
        newSchedule.scheduleType = payload.scheduleType
        newSchedule.cronExpression = payload.cronExpression
        newSchedule.intervalMs = payload.interval
        newSchedule.status = payload.status || ScheduleStatus.ACTIVE

        // Handle start date if provided (e.g. for one-time or initial delay)
        // For simple cron/interval, nextRunAt will be calculated by evaluator, 
        // but we can set it initially if user provided a specific start time.
        if (payload.startDate) {
            newSchedule.nextRunAt = new Date(payload.startDate)
        }

        // Set created metadata
        newSchedule.created_on = Date.now()
        newSchedule.created_by = parseInt(req.user?.userId || req.userId || '0')

        const savedSchedule = await dataSource.getRepository(Schedule).save(newSchedule)

        await logInfo(`[server]: Schedule ${savedSchedule.id} (${savedSchedule.name}) created`)

        return savedSchedule

    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: schedulesService.createSchedule - ${getErrorMessage(error)}`
        )
    }
}

const getAllSchedules = async (req: AuthenticatedRequest, page: number = -1, limit: number = -1): Promise<any> => {
    try {
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))

        const queryBuilder = dataSource
            .getRepository(Schedule)
            .createQueryBuilder('schedule')
            .orderBy('schedule.created_on', 'DESC') // Correct column name

        // Pagination
        if (page > 0 && limit > 0) {
            queryBuilder.skip((page - 1) * limit)
            queryBuilder.take(limit)
        }

        const [data, total] = await queryBuilder.getManyAndCount()

        if (page > 0 && limit > 0) {
            return { data, total }
        } else {
            return data
        }

    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: schedulesService.getAllSchedules - ${getErrorMessage(error)}`
        )
    }
}

const getScheduleById = async (req: AuthenticatedRequest, scheduleId: string): Promise<Schedule> => {
    try {
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))

        // Try finding by ID (PK) or GUID
        const where: FindOptionsWhere<Schedule>[] = [{ guid: scheduleId }]
        if (!isNaN(Number(scheduleId))) {
            where.push({ id: Number(scheduleId) })
        }

        const schedule = await dataSource.getRepository(Schedule).findOne({ where })

        if (!schedule) {
            throw new InternalKodivianError(StatusCodes.NOT_FOUND, `Schedule ${scheduleId} not found`)
        }

        return schedule

    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: schedulesService.getScheduleById - ${getErrorMessage(error)}`
        )
    }
}

const updateSchedule = async (req: AuthenticatedRequest, scheduleId: string, payload: Partial<CreateSchedulePayload>): Promise<Schedule> => {
    try {
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))

        const existingSchedule = await dataSource.getRepository(Schedule).findOne({
            where: { guid: scheduleId }
        })

        if (!existingSchedule) {
            throw new InternalKodivianError(StatusCodes.NOT_FOUND, `Schedule ${scheduleId} not found`)
        }

        // Update fields
        if (payload.name) existingSchedule.name = payload.name
        if (payload.chatflowId) {
            existingSchedule.targetId = payload.chatflowId
            existingSchedule.targetType = ScheduleTargetType.CHATFLOW
        }
        if (payload.scheduleType) existingSchedule.scheduleType = payload.scheduleType
        if (payload.cronExpression !== undefined) existingSchedule.cronExpression = payload.cronExpression
        if (payload.interval !== undefined) existingSchedule.intervalMs = payload.interval
        if (payload.status) existingSchedule.status = payload.status
        if (payload.startDate) existingSchedule.nextRunAt = new Date(payload.startDate)

        existingSchedule.last_modified_on = Date.now()

        const updatedSchedule = await dataSource.getRepository(Schedule).save(existingSchedule)

        return updatedSchedule

    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: schedulesService.updateSchedule - ${getErrorMessage(error)}`
        )
    }
}

const deleteSchedule = async (req: AuthenticatedRequest, scheduleId: string): Promise<any> => {
    try {
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))

        await dataSource.getRepository(Schedule).delete({ guid: scheduleId })

        return { deleted: true }

    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: schedulesService.deleteSchedule - ${getErrorMessage(error)}`
        )
    }
}

export default {
    createSchedule,
    getAllSchedules,
    getScheduleById,
    updateSchedule,
    deleteSchedule
}
