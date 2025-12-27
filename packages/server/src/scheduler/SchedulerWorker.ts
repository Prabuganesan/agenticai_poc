import { DataSource } from 'typeorm'
import { SchedulePoller } from './SchedulePoller'
import { ScheduleEvaluator } from './ScheduleEvaluator'
import { ScheduleLockManager } from './ScheduleLockManager'
import { ScheduleExecutor } from './ScheduleExecutor'
import { ISchedulerWorkerOptions } from './types'
import { Schedule, ScheduleStatus, ScheduleType } from '../database/entities/Schedule'
import { logInfo, logError, logDebug, logWarn } from '../utils/logger/system-helper'

export class SchedulerWorker {
    private poller: SchedulePoller
    private evaluator: ScheduleEvaluator
    private lockManager: ScheduleLockManager
    private executor: ScheduleExecutor
    private isRunning: boolean = false
    private pollInterval: number = 5000 // 5 seconds default
    private pollTimer: NodeJS.Timeout | null = null

    constructor(
        private dataSource: DataSource,
        private options: ISchedulerWorkerOptions
    ) {
        this.poller = new SchedulePoller(dataSource)
        this.evaluator = new ScheduleEvaluator()
        this.lockManager = new ScheduleLockManager()
        this.executor = new ScheduleExecutor(
            dataSource,
            options.queueManager,
            options.componentNodes,
            options.cachePool,
            options.usageCacheManager
        )

        if (options.pollIntervalMs) {
            this.pollInterval = options.pollIntervalMs
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            await logWarn('[SchedulerWorker] Already running')
            return
        }

        await logInfo('[SchedulerWorker] Starting scheduler worker...')

        // Initialize lock manager
        await this.lockManager.initialize()

        this.isRunning = true

        // Start poll cycle
        this.schedulePollCycle()

        await logInfo(`[SchedulerWorker] Scheduler worker started (poll interval: ${this.pollInterval}ms)`)
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            return
        }

        await logInfo('[SchedulerWorker] Stopping scheduler worker...')

        this.isRunning = false

        // Clear poll timer
        if (this.pollTimer) {
            clearTimeout(this.pollTimer)
            this.pollTimer = null
        }

        // Shutdown lock manager
        await this.lockManager.shutdown()

        await logInfo('[SchedulerWorker] Scheduler worker stopped')
    }

    private schedulePollCycle(): void {
        if (!this.isRunning) {
            return
        }

        this.pollTimer = setTimeout(async () => {
            try {
                await this.pollCycle()
            } catch (error) {
                await logError('[SchedulerWorker] Error in poll cycle:', error)
            } finally {
                // Schedule next cycle
                this.schedulePollCycle()
            }
        }, this.pollInterval)
    }

    private async pollCycle(): Promise<void> {
        await logDebug('[SchedulerWorker] Starting poll cycle')

        try {
            // Get all due schedules
            const dueSchedules = await this.poller.getDueSchedules()

            if (dueSchedules.length === 0) {
                await logDebug('[SchedulerWorker] No due schedules found')
                return
            }

            await logInfo(`[SchedulerWorker] Found ${dueSchedules.length} due schedules`)

            // Process each schedule
            for (const schedule of dueSchedules) {
                try {
                    await this.processSchedule(schedule)
                } catch (error) {
                    await logError(`[SchedulerWorker] Error processing schedule ${schedule.guid}:`, error)
                }
            }
        } catch (error) {
            await logError('[SchedulerWorker] Error in poll cycle:', error)
        }
    }

    private async processSchedule(schedule: Schedule): Promise<void> {
        await logDebug(`[SchedulerWorker] Processing schedule ${schedule.guid}`)

        // Check if schedule has ended
        if (this.evaluator.hasEnded(schedule)) {
            await logInfo(`[SchedulerWorker] Schedule ${schedule.guid} has ended, marking as completed`)
            await this.poller.updateSchedule(schedule.guid, {
                status: ScheduleStatus.COMPLETED
            })
            return
        }

        // Try to acquire lock
        const lock = await this.lockManager.acquireLock(schedule.guid)

        if (!lock) {
            // Lock already held by another worker
            await logDebug(`[SchedulerWorker] Schedule ${schedule.guid} is locked by another worker, skipping`)
            return
        }

        try {
            await logInfo(`[SchedulerWorker] Acquired lock for schedule ${schedule.guid}`)

            // Execute the schedule
            const runId = await this.executor.execute(schedule)

            // Calculate next run time
            const nextRunAt = this.evaluator.calculateNextRun(schedule)

            // Update schedule
            const updates: Partial<Schedule> = {
                lastRunAt: new Date(),
                runCount: schedule.runCount + 1
            }

            if (nextRunAt) {
                updates.nextRunAt = nextRunAt
            } else {
                // One-time schedule or no more runs
                updates.status = ScheduleStatus.COMPLETED
            }

            await this.poller.updateSchedule(schedule.guid, updates)

            await logInfo(`[SchedulerWorker] Successfully processed schedule ${schedule.guid} (run: ${runId})`)
        } catch (error: any) {
            await logError(`[SchedulerWorker] Error executing schedule ${schedule.guid}:`, error)

            // Increment failure count
            await this.poller.updateSchedule(schedule.guid, {
                failureCount: schedule.failureCount + 1
            })

            // Check if max retries exceeded
            if (schedule.failureCount + 1 >= schedule.maxRetries) {
                await logWarn(`[SchedulerWorker] Schedule ${schedule.guid} exceeded max retries, marking as failed`)
                await this.poller.updateSchedule(schedule.guid, {
                    status: ScheduleStatus.FAILED
                })
            }
        } finally {
            // Release lock
            await this.lockManager.releaseLock(lock)
            await logDebug(`[SchedulerWorker] Released lock for schedule ${schedule.guid}`)
        }
    }
}
