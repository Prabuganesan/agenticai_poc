import { DataSource } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import { Schedule, ScheduleTargetType } from '../database/entities/Schedule'
import { ScheduleRun, ScheduleRunStatus } from '../database/entities/ScheduleRun'
import { ChatFlow } from '../database/entities/ChatFlow'
import { QueueManager } from '../queue/QueueManager'
import { IComponentNodes, MODE } from '../Interface'
import { CachePool } from '../CachePool'
import { UsageCacheManager } from '../UsageCacheManager'
import { executeFlow } from '../utils/buildChatflow'
import { getDataSource } from '../DataSource'
import { logInfo, logError, logDebug } from '../utils/logger/system-helper'

export class ScheduleExecutor {
    constructor(
        private dataSource: DataSource,
        private queueManager: QueueManager,
        private componentNodes: IComponentNodes,
        private cachePool: CachePool,
        private usageCacheManager: UsageCacheManager
    ) { }

    /**
     * Execute a schedule - either enqueue to BullMQ or execute directly
     * @param schedule The schedule to execute
     * @returns The schedule run GUID
     */
    async execute(schedule: Schedule): Promise<string> {
        let runId = ''

        try {
            // Create schedule run record
            runId = await this.createScheduleRun(schedule)

            await logInfo(`[ScheduleExecutor] Executing schedule ${schedule.guid} (run: ${runId})`)

            // Create a timeout promise to prevent infinite hangs
            // Increased to 5 minutes for complex multi-agent flows
            const timeoutMs = 300000
            const timeoutPromise = new Promise<string>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Schedule execution timed out after ${timeoutMs}ms`))
                }, timeoutMs)
            })

            // Run execution logic with race against timeout
            return await Promise.race([
                this.executeInternal(schedule, runId),
                timeoutPromise
            ])

        } catch (error: any) {
            await logError(`[ScheduleExecutor] Error executing schedule ${schedule.guid}:`, error)

            // Update schedule run with error
            if (runId) {
                const completedAt = new Date()
                await this.updateScheduleRun(runId, {
                    status: ScheduleRunStatus.FAILED,
                    completedAt,
                    errorMessage: error.message || String(error)
                })
            }

            throw error
        }
    }

    /**
     * Internal execution logic separated for cleaner timeout handling
     */
    private async executeInternal(schedule: Schedule, runId: string): Promise<string> {
        const now = new Date()

        // Load chatflow (use frozen version if available)
        const chatflow = await this.loadChatflow(schedule)

        const chatId = `schedule-${schedule.guid}-${runId}`
        const incomingInput = schedule.inputPayload ? JSON.parse(schedule.inputPayload) : {}

        // Add schedule metadata
        const scheduleMeta = {
            scheduleId: schedule.guid,
            runId: runId,
            scheduledAt: now.toISOString()
        }

        // Determine orgId from schedule (you'll need to add orgId to Schedule entity)
        // For now, defaulting to 1 (single-org mode)
        const orgId = 1

        // Check if queue mode is enabled
        if (process.env.MODE === MODE.QUEUE) {
            // Queue Mode: Enqueue to BullMQ
            await logDebug(`[ScheduleExecutor] Using queue mode for schedule ${schedule.guid}`)

            const predictionQueue = this.queueManager.getQueue(orgId, 'prediction')

            const jobData = {
                chatflow,
                chatId,
                incomingInput,
                orgId,
                isInternal: true,
                _scheduleMeta: scheduleMeta,
                userId: schedule.created_by ? schedule.created_by.toString() : '0'
            }

            const job = await predictionQueue.addJob(jobData)

            // Update schedule run with job ID
            await this.updateScheduleRun(runId, {
                jobId: job.id?.toString(),
                status: ScheduleRunStatus.PENDING,
                startedAt: now
            })

            await logInfo(`[ScheduleExecutor] Enqueued job ${job.id} for schedule ${schedule.guid}`)
        } else {
            // Direct Mode: Execute immediately
            await logDebug(`[ScheduleExecutor] Using direct execution mode for schedule ${schedule.guid}`)

            const appDataSource = getDataSource(orgId)

            const executeData = {
                chatflow,
                chatId,
                incomingInput,
                appDataSource,
                componentNodes: this.componentNodes,
                cachePool: this.cachePool,
                usageCacheManager: this.usageCacheManager,
                sseStreamer: undefined as any, // Scheduler doesn't use SSE streaming
                baseURL: process.env.BASE_URL || 'http://localhost:3000',
                isInternal: true,
                orgId: orgId.toString(),
                productId: '1',
                _scheduleMeta: scheduleMeta,
                userId: schedule.created_by ? schedule.created_by.toString() : '0'
            }

            // Update status to running
            await this.updateScheduleRun(runId, {
                status: ScheduleRunStatus.RUNNING,
                startedAt: now
            })

            // Execute directly
            const result = await executeFlow(executeData)

            const completedAt = new Date()
            const durationMs = completedAt.getTime() - now.getTime()

            // Update with result
            await this.updateScheduleRun(runId, {
                status: ScheduleRunStatus.COMPLETED,
                completedAt,
                durationMs,
                result: JSON.stringify(result)
            })

            await logInfo(`[ScheduleExecutor] Completed direct execution for schedule ${schedule.guid} in ${durationMs}ms`)
        }

        return runId
    }

    private async loadChatflow(schedule: Schedule): Promise<ChatFlow> {
        // Use frozen version if available
        if (schedule.frozenVersion) {
            return JSON.parse(schedule.frozenVersion) as ChatFlow
        }

        // Otherwise load latest version from database
        const chatflow = await this.dataSource
            .getRepository(ChatFlow)
            .findOne({ where: { guid: schedule.targetId } })

        if (!chatflow) {
            throw new Error(`Chatflow not found: ${schedule.targetId}`)
        }

        return chatflow
    }

    private async createScheduleRun(schedule: Schedule): Promise<string> {
        // Generate short GUID (max 15 chars for VARCHAR(15))
        const runGuid = `run-${Math.random().toString(36).substring(2, 12)}`  // e.g. "run-abc123def"

        const scheduleRun = this.dataSource.getRepository(ScheduleRun).create({
            guid: runGuid,
            scheduleId: schedule.guid,
            status: ScheduleRunStatus.PENDING,
            scheduledAt: new Date(),
            attempt: 1,
            created_on: Date.now()
        })

        await this.dataSource.getRepository(ScheduleRun).save(scheduleRun)
        return runGuid
    }

    private async updateScheduleRun(runId: string, updates: Partial<ScheduleRun>): Promise<void> {
        await this.dataSource
            .getRepository(ScheduleRun)
            .update({ guid: runId }, updates)
    }
}
