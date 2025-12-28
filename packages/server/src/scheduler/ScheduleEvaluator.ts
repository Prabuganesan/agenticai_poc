import parser from 'cron-parser'
import { Schedule, ScheduleType } from '../database/entities/Schedule'
import { logError } from '../utils/logger/system-helper'

export class ScheduleEvaluator {
    /**
     * Calculate the next run time for a schedule
     * @param schedule The schedule to evaluate
     * @returns Date of next run, or null if schedule is complete (one-time)
     */
    calculateNextRun(schedule: Schedule): Date | null {
        try {
            switch (schedule.scheduleType) {
                case ScheduleType.ONE_TIME:
                case 'once' as any: // Fallback for legacy/UI mismatch
                    // One-time schedules don't have next run after completion
                    return null

                case ScheduleType.INTERVAL:
                    if (!schedule.intervalMs) {
                        throw new Error('Interval schedule missing intervalMs')
                    }
                    // Calculate next run from now
                    // intervalMs might be a string (from bigint column), so parse it
                    const ms = parseInt(String(schedule.intervalMs))
                    return new Date(Date.now() + ms)

                case ScheduleType.CRON:
                    if (!schedule.cronExpression) {
                        throw new Error('Cron schedule missing cronExpression')
                    }
                    // Parse cron expression with timezone support
                    const interval = parser.parseExpression(schedule.cronExpression, {
                        tz: schedule.timezone || 'UTC',
                        currentDate: new Date()
                    })
                    return interval.next().toDate()

                default:
                    throw new Error(`Unknown schedule type: ${schedule.scheduleType}`)
            }
        } catch (error) {
            logError(`[ScheduleEvaluator] Error calculating next run for schedule ${schedule.guid}:`, error).catch(() => { })
            throw error
        }
    }

    /**
     * Check if a schedule is due to run
     * @param schedule The schedule to check
     * @returns true if schedule should run now
     */
    isDue(schedule: Schedule): boolean {
        if (!schedule.nextRunAt) {
            return false
        }

        const now = new Date()
        const nextRun = new Date(schedule.nextRunAt)

        // Check if next run is in the past or now
        return nextRun <= now
    }

    /**
     * Check if schedule has ended (passed its endsAt date)
     * @param schedule The schedule to check
     * @returns true if schedule has ended
     */
    hasEnded(schedule: Schedule): boolean {
        if (!schedule.endsAt) {
            return false
        }

        const now = new Date()
        const endsAt = new Date(schedule.endsAt)

        return endsAt <= now
    }
}
