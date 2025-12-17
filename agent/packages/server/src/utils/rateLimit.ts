import { NextFunction, Request, Response } from 'express'
import { rateLimit, RateLimitRequestHandler } from 'express-rate-limit'
import { IChatFlow, MODE } from '../Interface'
import { Mutex } from 'async-mutex'
import { RedisStore } from 'rate-limit-redis'
import Redis from 'ioredis'
import { QueueEvents, QueueEventsListener, QueueEventsProducer } from 'bullmq'
import { OrganizationConfigService } from '../services/org-config.service'
import { logInfo, logWarn } from './logger/system-helper'

interface CustomListener extends QueueEventsListener {
    updateRateLimiter: (args: { limitDuration: number; limitMax: number; limitMsg: string; id: string }) => void
}

const QUEUE_NAME = 'ratelimit'
const QUEUE_EVENT_NAME = 'updateRateLimiter'

export class RateLimiterManager {
    private rateLimiters: Record<string, RateLimitRequestHandler> = {}
    private rateLimiterMutex: Mutex = new Mutex()
    private redisClient: Redis | null = null
    private static instance: RateLimiterManager
    private queueEventsProducer: QueueEventsProducer | null = null
    private queueEvents: QueueEvents | null = null
    private orgConfigService?: OrganizationConfigService

    constructor(orgConfigService?: OrganizationConfigService) {
        this.orgConfigService = orgConfigService
        if (process.env.MODE === MODE.QUEUE) {
            // Get Redis config from first org's config (loaded from main database)
            const redisConfig = this.getRedisConfigFromOrg()

            if (redisConfig) {
                this.redisClient = new Redis({
                    host: redisConfig.host,
                    port: redisConfig.port,
                    password: redisConfig.password,
                    keepAlive:
                        process.env.REDIS_KEEP_ALIVE && !isNaN(parseInt(process.env.REDIS_KEEP_ALIVE, 10))
                            ? parseInt(process.env.REDIS_KEEP_ALIVE, 10)
                            : undefined
                })
                const connection = this.getConnection()
                this.queueEventsProducer = new QueueEventsProducer(QUEUE_NAME, { connection })
                this.queueEvents = new QueueEvents(QUEUE_NAME, { connection })
                logInfo(`[RateLimiterManager] Using Redis config from org config: ${redisConfig.host}:${redisConfig.port}`).catch(() => {})
            } else {
                logWarn('[RateLimiterManager] No Redis config found from org configs, rate limiting will use in-memory store').catch(
                    () => {}
                )
            }
        }
    }

    private getRedisConfigFromOrg(): { host: string; port: number; password?: string } | null {
        if (this.orgConfigService) {
            const orgIds = this.orgConfigService.getAllOrgIds()
            if (orgIds.length > 0) {
                const firstOrgId = orgIds[0]
                const orgConfig = this.orgConfigService.getOrgConfig(firstOrgId)
                const redisConfigData = orgConfig?.redis

                if (redisConfigData) {
                    return {
                        host: redisConfigData.host,
                        port: redisConfigData.port,
                        password:
                            redisConfigData.password && redisConfigData.password.trim().length > 0
                                ? redisConfigData.password.trim()
                                : undefined
                    }
                }
            }
        }
        return null
    }

    getConnection() {
        const redisConfig = this.getRedisConfigFromOrg()
        if (!redisConfig) {
            throw new Error('Redis connection not available - no org config found')
        }

        return {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            maxRetriesPerRequest: null,
            enableReadyCheck: true,
            keepAlive:
                process.env.REDIS_KEEP_ALIVE && !isNaN(parseInt(process.env.REDIS_KEEP_ALIVE, 10))
                    ? parseInt(process.env.REDIS_KEEP_ALIVE, 10)
                    : undefined
        }
    }

    public static getInstance(orgConfigService?: OrganizationConfigService): RateLimiterManager {
        if (!RateLimiterManager.instance) {
            RateLimiterManager.instance = new RateLimiterManager(orgConfigService)
        }
        return RateLimiterManager.instance
    }

    public async addRateLimiter(id: string, duration: number, limit: number, message: string): Promise<void> {
        const release = await this.rateLimiterMutex.acquire()
        try {
            if (process.env.MODE === MODE.QUEUE && this.redisClient) {
                this.rateLimiters[id] = rateLimit({
                    windowMs: duration * 1000,
                    max: limit,
                    standardHeaders: true,
                    legacyHeaders: false,
                    message,
                    store: new RedisStore({
                        prefix: `rl:${id}`,
                        // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
                        sendCommand: (...args: string[]) => this.redisClient!.call(...args)
                    })
                })
            } else {
                this.rateLimiters[id] = rateLimit({
                    windowMs: duration * 1000,
                    max: limit,
                    message
                })
            }
        } finally {
            release()
        }
    }

    public removeRateLimiter(id: string): void {
        if (this.rateLimiters[id]) {
            delete this.rateLimiters[id]
        }
    }

    public getRateLimiter(): (req: Request, res: Response, next: NextFunction) => void {
        return (req: Request, res: Response, next: NextFunction) => {
            const id = req.params.id
            if (!this.rateLimiters[id]) return next()
            const idRateLimiter = this.rateLimiters[id]
            return idRateLimiter(req, res, next)
        }
    }

    public async updateRateLimiter(chatFlow: IChatFlow, isInitialized?: boolean): Promise<void> {
        if (!chatFlow.apiConfig) return
        const apiConfig = JSON.parse(chatFlow.apiConfig)

        const rateLimit: { limitDuration: number; limitMax: number; limitMsg: string; status?: boolean } = apiConfig.rateLimit
        if (!rateLimit) return

        const { limitDuration, limitMax, limitMsg, status } = rateLimit

        if (!isInitialized && process.env.MODE === MODE.QUEUE && this.queueEventsProducer && this.queueEvents) {
            await this.queueEventsProducer.publishEvent({
                eventName: QUEUE_EVENT_NAME,
                limitDuration,
                limitMax,
                limitMsg,
                id: chatFlow.guid
            })
        } else {
            if (status === false) {
                this.removeRateLimiter(chatFlow.guid)
            } else if (limitMax && limitDuration && limitMsg) {
                await this.addRateLimiter(chatFlow.guid, limitDuration, limitMax, limitMsg)
            }
        }
    }

    public async initializeRateLimiters(chatflows: IChatFlow[]): Promise<void> {
        await Promise.all(
            chatflows.map(async (chatFlow) => {
                await this.updateRateLimiter(chatFlow, true)
            })
        )

        if (process.env.MODE === MODE.QUEUE && this.queueEvents) {
            this.queueEvents.on<CustomListener>(
                QUEUE_EVENT_NAME,
                async ({
                    limitDuration,
                    limitMax,
                    limitMsg,
                    id
                }: {
                    limitDuration: number
                    limitMax: number
                    limitMsg: string
                    id: string
                }) => {
                    await this.addRateLimiter(id, limitDuration, limitMax, limitMsg)
                }
            )
        }
    }
}
