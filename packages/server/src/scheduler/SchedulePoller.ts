import { DataSource } from 'typeorm'
import { Schedule, ScheduleStatus } from '../database/entities/Schedule'
import { logDebug } from '../utils/logger/system-helper'

export class SchedulePoller {
    constructor(private dataSource: DataSource) { }

    /**
     * Get all schedules that are due to run
     * @param limit Maximum number of schedules to return
     * @returns Array of schedules that should be processed
     */
    async getDueSchedules(limit: number = 100): Promise<Schedule[]> {
        const now = new Date()

        const schedules = await this.dataSource
            .getRepository(Schedule)
            .createQueryBuilder('schedule')
            .where('schedule.status = :status', { status: ScheduleStatus.ACTIVE })
            .andWhere('schedule.next_run_at <= :now', { now })
            .andWhere('(schedule.ends_at IS NULL OR schedule.ends_at > :now)', { now })
            .orderBy('schedule.next_run_at', 'ASC')
            .limit(limit)
            .getMany()

        await logDebug(`[SchedulePoller] Found ${schedules.length} due schedules`)

        return schedules
    }

    /**
     * Get a single schedule by ID
     * @param scheduleId Schedule GUID
     * @returns Schedule or null if not found
     */
    async getSchedule(scheduleId: string): Promise<Schedule | null> {
        return await this.dataSource
            .getRepository(Schedule)
            .findOne({ where: { guid: scheduleId } })
    }

    /**
     * Update schedule after execution
     * @param scheduleId Schedule GUID
     * @param updates Partial schedule updates
     */
    async updateSchedule(scheduleId: string, updates: Partial<Schedule>): Promise<void> {
        await this.dataSource
            .getRepository(Schedule)
            .update({ guid: scheduleId }, updates)
    }
}
