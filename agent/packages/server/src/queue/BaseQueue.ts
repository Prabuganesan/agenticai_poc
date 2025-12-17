import { Queue, Worker, Job, QueueEvents, RedisOptions, KeepJobs } from 'bullmq'
import { v4 as uuidv4 } from 'uuid'
import { logInfo, logError } from '../utils/logger/system-helper'

const QUEUE_REDIS_EVENT_STREAM_MAX_LEN = process.env.QUEUE_REDIS_EVENT_STREAM_MAX_LEN
    ? parseInt(process.env.QUEUE_REDIS_EVENT_STREAM_MAX_LEN)
    : 10000
const WORKER_CONCURRENCY = process.env.WORKER_CONCURRENCY ? parseInt(process.env.WORKER_CONCURRENCY) : 100000
const REMOVE_ON_AGE = process.env.REMOVE_ON_AGE ? parseInt(process.env.REMOVE_ON_AGE) : -1
const REMOVE_ON_COUNT = process.env.REMOVE_ON_COUNT ? parseInt(process.env.REMOVE_ON_COUNT) : -1

export abstract class BaseQueue {
    protected queue: Queue
    protected queueEvents: QueueEvents
    protected connection: RedisOptions
    protected orgId: number
    private worker: Worker

    constructor(orgId: number, queueName: string, connection: RedisOptions) {
        this.orgId = orgId
        this.connection = connection
        this.queue = new Queue(queueName, {
            connection: this.connection,
            streams: { events: { maxLen: QUEUE_REDIS_EVENT_STREAM_MAX_LEN } }
        })
        this.queueEvents = new QueueEvents(queueName, { connection: this.connection })
    }

    abstract processJob(data: any): Promise<any>

    abstract getQueueName(): string

    abstract getQueue(): Queue

    public getWorker(): Worker {
        return this.worker
    }

    public async addJob(jobData: any): Promise<Job> {
        const jobId = jobData.id || uuidv4()

        let removeOnFail: number | boolean | KeepJobs | undefined = true
        let removeOnComplete: number | boolean | KeepJobs | undefined = undefined

        // Only override removal options if age or count is specified
        if (REMOVE_ON_AGE !== -1 || REMOVE_ON_COUNT !== -1) {
            const keepJobObj: KeepJobs = {}
            if (REMOVE_ON_AGE !== -1) {
                keepJobObj.age = REMOVE_ON_AGE
            }
            if (REMOVE_ON_COUNT !== -1) {
                keepJobObj.count = REMOVE_ON_COUNT
            }
            removeOnFail = keepJobObj
            removeOnComplete = keepJobObj
        }

        const job = await this.queue.add(jobId, jobData, { removeOnFail, removeOnComplete })

        // Log queue operation
        try {
            const { queueLog } = await import('../utils/logger/module-methods')
            const orgId = this.orgId?.toString() || jobData?.orgId?.toString() || 'unknown'
            await queueLog('info', 'Job added to queue', {
                userId: jobData?.userId?.toString() || 'system',
                orgId: orgId,
                queueName: this.queue.name,
                jobId: job.id || jobId,
                jobType: jobData?.type || 'unknown'
            }).catch(() => {})
        } catch (logError) {
            // Silently fail - logging should not break queue operations
        }

        return job
    }

    public createWorker(concurrency: number = WORKER_CONCURRENCY): Worker {
        try {
            this.worker = new Worker(
                this.queue.name,
                async (job: Job) => {
                    const start = new Date().getTime()
                    logInfo(`[BaseQueue] Processing job ${job.id} in ${this.queue.name} at ${new Date().toISOString()}`).catch(() => {})

                    // Log queue operation - job started
                    try {
                        const { queueLog } = await import('../utils/logger/module-methods')
                        const orgId = this.orgId?.toString() || job.data?.orgId?.toString() || 'unknown'
                        await queueLog('info', 'Job processing started', {
                            userId: job.data?.userId?.toString() || 'system',
                            orgId: orgId,
                            queueName: this.queue.name,
                            jobId: job.id || 'unknown'
                        }).catch(() => {})
                    } catch (logError) {
                        // Silently fail
                    }

                    try {
                        const result = await this.processJob(job.data)
                        const end = new Date().getTime()
                        const duration = end - start
                        logInfo(
                            `[BaseQueue] Completed job ${job.id} in ${this.queue.name} at ${new Date().toISOString()} (${duration}ms)`
                        ).catch(() => {})

                        // Log queue operation - job completed
                        try {
                            const { queueLog } = await import('../utils/logger/module-methods')
                            const orgId = this.orgId?.toString() || job.data?.orgId?.toString() || 'unknown'
                            await queueLog('info', 'Job completed successfully', {
                                userId: job.data?.userId?.toString() || 'system',
                                orgId: orgId,
                                queueName: this.queue.name,
                                jobId: job.id || 'unknown',
                                durationMs: duration
                            }).catch(() => {})
                        } catch (logError) {
                            // Silently fail
                        }

                        return result
                    } catch (error) {
                        const end = new Date().getTime()
                        const duration = end - start
                        logError(
                            `[BaseQueue] Job ${job.id} failed in ${this.queue.name} at ${new Date().toISOString()} (${duration}ms):`,
                            error
                        ).catch(() => {})

                        // Log queue operation - job failed
                        try {
                            const { queueLog } = await import('../utils/logger/module-methods')
                            const orgId = this.orgId?.toString() || job.data?.orgId?.toString() || 'unknown'
                            await queueLog('error', 'Job failed', {
                                userId: job.data?.userId?.toString() || 'system',
                                orgId: orgId,
                                queueName: this.queue.name,
                                jobId: job.id || 'unknown',
                                durationMs: duration,
                                error: error instanceof Error ? error.message : String(error)
                            }).catch(() => {})
                        } catch (logError) {
                            // Silently fail
                        }

                        throw error
                    }
                },
                {
                    connection: this.connection,
                    concurrency
                }
            )

            // Add error listeners to the worker
            this.worker.on('error', (err) => {
                logError(`[BaseQueue] Worker error for queue "${this.queue.name}":`, err).catch(() => {})
            })

            this.worker.on('closed', () => {
                logInfo(`[BaseQueue] Worker closed for queue "${this.queue.name}"`).catch(() => {})
            })

            this.worker.on('failed', (job, err) => {
                logError(`[BaseQueue] Worker job ${job?.id} failed in queue "${this.queue.name}":`, err).catch(() => {})
            })

            logInfo(`[BaseQueue] Worker created successfully for queue "${this.queue.name}"`).catch(() => {})
            return this.worker
        } catch (error) {
            logError(`[BaseQueue] Failed to create worker for queue "${this.queue.name}":`, error).catch(() => {})
            throw error
        }
    }

    public async getJobs(): Promise<Job[]> {
        return await this.queue.getJobs()
    }

    public async getJobCounts(): Promise<{ [index: string]: number }> {
        return await this.queue.getJobCounts()
    }

    public async getJobByName(jobName: string): Promise<Job> {
        const jobs = await this.queue.getJobs()
        const job = jobs.find((job) => job.name === jobName)
        if (!job) throw new Error(`Job name ${jobName} not found`)
        return job
    }

    public getQueueEvents(): QueueEvents {
        return this.queueEvents
    }

    public async clearQueue(): Promise<void> {
        await this.queue.obliterate({ force: true })
    }
}
