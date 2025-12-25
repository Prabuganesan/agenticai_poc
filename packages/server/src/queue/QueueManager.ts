import { BaseQueue } from './BaseQueue'
import { PredictionQueue } from './PredictionQueue'
import { UpsertQueue } from './UpsertQueue'
import { IComponentNodes } from '../Interface'
import { CachePool } from '../CachePool'
import { AbortControllerPool } from '../AbortControllerPool'
import { QueueEventsProducer, RedisOptions } from 'bullmq'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { Express } from 'express'
import { UsageCacheManager } from '../UsageCacheManager'
import { ExpressAdapter } from '@bull-board/express'
import { OrganizationConfigService } from '../services/org-config.service'
import { logInfo, logWarn } from '../utils/logger/system-helper'
import { getErrorMessage } from '../errors/utils'

const QUEUE_NAME = process.env.QUEUE_NAME || 'kodivian-queue'

type QUEUE_TYPE = 'prediction' | 'upsert'

export class QueueManager {
    private static instance: QueueManager
    private orgQueues: Map<string, BaseQueue> = new Map() // Key: `${orgId}-${queueType}`
    private orgConnections: Map<number, RedisOptions> = new Map()
    private orgQueueEventsProducers: Map<number, QueueEventsProducer> = new Map()
    private bullBoardRouter?: Express
    private isInitialized: boolean = false

    private constructor() {
        // Constructor no longer initializes connection - will be done per-org
    }

    public static getInstance(): QueueManager {
        if (!QueueManager.instance) {
            QueueManager.instance = new QueueManager()
        }
        return QueueManager.instance
    }

    /**
     * Initialize queues for all organizations
     * Must be called after orgConfigService.loadAllOrganizations()
     */
    public async initializeOrgQueues(orgConfigService: OrganizationConfigService): Promise<void> {
        if (this.isInitialized) {
            logWarn('[QueueManager] Queues already initialized, skipping').catch(() => {})
            return
        }

        const orgIds = orgConfigService.getAllOrgIds()
        const uniqueOrgIds = Array.from(new Set(orgIds))

        if (uniqueOrgIds.length === 0) {
            throw new Error('No organizations found. Cannot initialize queues without org configs.')
        }

        logInfo(`[QueueManager] Initializing queues for ${uniqueOrgIds.length} organizations: [${uniqueOrgIds.join(', ')}]`).catch(() => {})

        for (const orgId of uniqueOrgIds) {
            const orgConfig = orgConfigService.getOrgConfig(orgId)
            const redisConfig = orgConfig?.redis

            if (!redisConfig) {
                throw new Error(`Redis configuration not found for organization ${orgId}. Redis config is required for all organizations.`)
            }

            // Convert org Redis config to BullMQ RedisOptions format
            const dbNumber = parseInt(process.env.REDIS_DB_QUEUE || '3')
            const connection: RedisOptions = {
                host: redisConfig.host,
                port: redisConfig.port,
                password: redisConfig.password && redisConfig.password.trim().length > 0 ? redisConfig.password.trim() : undefined,
                db: dbNumber, // Required for correct org isolation - each org uses same Redis but different DB
                enableReadyCheck: true,
                maxRetriesPerRequest: null, // Required for BullMQ
                keepAlive:
                    process.env.REDIS_KEEP_ALIVE && !isNaN(parseInt(process.env.REDIS_KEEP_ALIVE, 10))
                        ? parseInt(process.env.REDIS_KEEP_ALIVE, 10)
                        : undefined
            }

            this.orgConnections.set(orgId, connection)
            logInfo(
                `[QueueManager] Stored Redis connection config for orgId ${orgId}: ${redisConfig.host}:${redisConfig.port}, db=${dbNumber}`
            ).catch(() => {})
        }

        this.isInitialized = true
        logInfo(`[QueueManager] Initialized ${this.orgConnections.size} organization Redis connections`).catch(() => {})
    }

    /**
     * Get Redis connection options for a specific organization
     */
    public getOrgConnection(orgId: number): RedisOptions {
        const connection = this.orgConnections.get(orgId)
        if (!connection) {
            throw new Error(`Queue not configured for organization ${orgId}. Please ensure Redis config exists for this organization.`)
        }
        return connection
    }

    /**
     * Get queue for specific organization and queue type
     */
    public getQueue(orgId: number, name: QUEUE_TYPE): BaseQueue {
        const queueKey = `${orgId}-${name}`
        const queue = this.orgQueues.get(queueKey)
        if (!queue) {
            throw new Error(`Queue ${name} not found for organization ${orgId}. Queue may not be initialized.`)
        }
        return queue
    }

    /**
     * Get prediction queue events producer for specific organization
     */
    public getPredictionQueueEventsProducer(orgId: number): QueueEventsProducer {
        const producer = this.orgQueueEventsProducers.get(orgId)
        if (!producer) {
            throw new Error(`Prediction queue events producer not found for organization ${orgId}`)
        }
        return producer
    }

    public getBullBoardRouter(): Express {
        if (!this.bullBoardRouter) throw new Error('BullBoard router not found')
        return this.bullBoardRouter
    }

    /**
     * Get all job counts aggregated across all organizations
     */
    public async getAllJobCounts(): Promise<{ [queueName: string]: { [status: string]: number } }> {
        const counts: { [queueName: string]: { [status: string]: number } } = {}

        for (const [queueKey, queue] of this.orgQueues) {
            counts[queueKey] = await queue.getJobCounts()
        }

        return counts
    }

    /**
     * Register a queue for an organization
     */
    private registerOrgQueue(orgId: number, queueType: QUEUE_TYPE, queue: BaseQueue) {
        const queueKey = `${orgId}-${queueType}`
        this.orgQueues.set(queueKey, queue)
    }

    public setupAllQueues({
        componentNodes,
        cachePool,
        abortControllerPool,
        usageCacheManager,
        serverAdapter,
        orgConfigService,
        dashboardPath
    }: {
        componentNodes: IComponentNodes
        cachePool: CachePool
        abortControllerPool: AbortControllerPool
        usageCacheManager: UsageCacheManager
        serverAdapter?: ExpressAdapter
        orgConfigService: OrganizationConfigService
        dashboardPath?: string
    }) {
        if (!this.isInitialized) {
            throw new Error('QueueManager not initialized. Call initializeOrgQueues() first.')
        }

        const orgIds = Array.from(this.orgConnections.keys())
        const bullBoardQueues: BullMQAdapter[] = []

        logInfo(`[QueueManager] Setting up queues for ${orgIds.length} organizations`).catch(() => {})

        for (const orgId of orgIds) {
            const connection = this.getOrgConnection(orgId)

            // Create prediction queue for this org
            const predictionQueueName = `${QUEUE_NAME}-${orgId}-prediction`
            const predictionQueue = new PredictionQueue(orgId, predictionQueueName, connection, {
                componentNodes,
                cachePool,
                abortControllerPool,
                usageCacheManager,
                orgConfigService
            })
            this.registerOrgQueue(orgId, 'prediction', predictionQueue)

            // Create queue events producer for this org
            const predictionQueueEventsProducer = new QueueEventsProducer(predictionQueue.getQueueName(), {
                connection: connection
            })
            this.orgQueueEventsProducers.set(orgId, predictionQueueEventsProducer)

            // Create upsert queue for this org
            const upsertionQueueName = `${QUEUE_NAME}-${orgId}-upsertion`
            const upsertionQueue = new UpsertQueue(orgId, upsertionQueueName, connection, {
                componentNodes,
                cachePool,
                usageCacheManager
            })
            this.registerOrgQueue(orgId, 'upsert', upsertionQueue)

            // Add to BullBoard
            bullBoardQueues.push(new BullMQAdapter(predictionQueue.getQueue()))
            bullBoardQueues.push(new BullMQAdapter(upsertionQueue.getQueue()))

            logInfo(`[QueueManager] Created queues for orgId ${orgId}: prediction, upsert`).catch(() => {})
        }

        // Setup BullBoard with all org queues
        if (serverAdapter) {
            if (bullBoardQueues.length === 0) {
                logWarn(`[QueueManager] No queues to display in BullBoard dashboard`).catch(() => {})
                // Create an empty router
                const express = require('express')
                const emptyRouter = express.Router()
                emptyRouter.get('*', (req: any, res: any) => {
                    res.status(404).json({ error: 'No queues available' })
                })
                this.bullBoardRouter = emptyRouter
            } else {
                try {
                    // CRITICAL FIX: Patch path-to-regexp to add match method that router@2.1.0 expects
                    // path-to-regexp@0.1.12 exports a function, but router calls pathRegexp.match() which doesn't exist
                    try {
                        const pathToRegexpModule = require('path-to-regexp')
                        // path-to-regexp@0.1.12 is a function, not an object with methods
                        // Router expects pathRegexp.match(pattern, options) which returns a matcher function
                        if (typeof pathToRegexpModule === 'function' && !pathToRegexpModule.match) {
                            // Add match method to the function
                            pathToRegexpModule.match = function (pattern: any, options?: any) {
                                // path-to-regexp@0.1.12 signature: pathToRegexp(path, keys, options)
                                // We need to create a regexp and return a matcher function
                                const keys: any[] = []
                                const regexp = pathToRegexpModule(pattern, keys, options)

                                // Return a matcher function that router expects
                                return (pathname: string) => {
                                    const match = regexp.exec(pathname)
                                    if (match) {
                                        const params: any = {}
                                        keys.forEach((key, i) => {
                                            if (key.name && match[i + 1] !== undefined) {
                                                params[key.name] = match[i + 1]
                                            }
                                        })
                                        return {
                                            path: match[0],
                                            index: match.index,
                                            params: params
                                        }
                                    }
                                    return null
                                }
                            }
                            logInfo(`[QueueManager] Added match method to path-to-regexp@0.1.12 for router compatibility`).catch(() => {})
                        }
                    } catch (pathRegexpError) {
                        logWarn(`[QueueManager] Could not patch path-to-regexp: ${getErrorMessage(pathRegexpError)}`).catch(() => {})
                    }

                    // Also try to patch router Layer if possible
                    try {
                        const routerModule = require('router')
                        const Layer = routerModule.Layer || (routerModule as any).default?.Layer
                        if (Layer && Layer.prototype && Layer.prototype.matcher) {
                            const originalMatcher = Layer.prototype.matcher
                            Layer.prototype.matcher = function (path: any, opts: any) {
                                try {
                                    return originalMatcher.call(this, path, opts)
                                } catch (error: any) {
                                    // If pathRegexp.match fails, provide a fallback matcher
                                    if (
                                        error &&
                                        (error.message?.includes('pathRegexp.match') || error.message?.includes('match is not a function'))
                                    ) {
                                        // Simple fallback matcher
                                        return (req: any) => {
                                            const reqPath = req.path || req.url
                                            if (reqPath === path || reqPath.startsWith(path + '/')) {
                                                return { path: reqPath }
                                            }
                                            return null
                                        }
                                    }
                                    throw error
                                }
                            }
                            logInfo(`[QueueManager] Patched router Layer.matcher as fallback`).catch(() => {})
                        }
                    } catch (routerPatchError) {
                        // Ignore - adapter patch should be sufficient
                    }

                    // Patch ExpressAdapter methods using Object.defineProperty to ensure they can't be bypassed
                    const adapterAny = serverAdapter as any
                    const ExpressAdapterClass = serverAdapter.constructor as any

                    // Create safe functions that work with patched path-to-regexp
                    // Now that path-to-regexp has a match method, setStaticPath should work
                    const express = require('express')

                    const safeSetStaticPath = function (this: any, staticsRoute: string, staticsPath: string) {
                        // Now that path-to-regexp is patched, we can use app.use() safely
                        // But wrap in try-catch just in case
                        try {
                            this.app.use(staticsRoute, express.static(staticsPath))
                            logInfo(`[QueueManager] Served static files from: ${staticsPath} at route: ${staticsRoute}`).catch(() => {})
                        } catch (error) {
                            // If it still fails, log but don't break
                            logWarn(
                                `[QueueManager] Could not serve static files (will try manual serving): ${getErrorMessage(error)}`
                            ).catch(() => {})
                            // Try to serve manually as fallback
                            try {
                                const path = require('path')
                                const fs = require('fs')
                                if (fs.existsSync(staticsPath)) {
                                    this.app.get(staticsRoute + '/*', (req: any, res: any) => {
                                        const filePath = path.join(staticsPath, req.params[0] || '')
                                        if (fs.existsSync(filePath)) {
                                            res.sendFile(path.resolve(filePath))
                                        } else {
                                            res.status(404).send('Not found')
                                        }
                                    })
                                }
                            } catch (fallbackError) {
                                logWarn(`[QueueManager] Manual static file serving also failed: ${getErrorMessage(fallbackError)}`).catch(
                                    () => {}
                                )
                            }
                        }
                        return this
                    }

                    const safeSetBasePath = function (this: any, basePath: string) {
                        // Store base path - this is safe, doesn't use router
                        // This is important for BullBoard to generate correct HTML with proper base href
                        this.basePath = basePath
                        logInfo(`[QueueManager] Set base path to: ${basePath}`).catch(() => {})
                        return this
                    }

                    // Patch at prototype level first
                    if (ExpressAdapterClass && ExpressAdapterClass.prototype) {
                        Object.defineProperty(ExpressAdapterClass.prototype, 'setStaticPath', {
                            value: safeSetStaticPath,
                            writable: true,
                            configurable: true
                        })

                        if (ExpressAdapterClass.prototype.setBasePath) {
                            Object.defineProperty(ExpressAdapterClass.prototype, 'setBasePath', {
                                value: safeSetBasePath,
                                writable: true,
                                configurable: true
                            })
                        }
                    }

                    // Also patch the instance directly
                    Object.defineProperty(adapterAny, 'setStaticPath', {
                        value: safeSetStaticPath,
                        writable: true,
                        configurable: true
                    })

                    if (adapterAny.setBasePath) {
                        Object.defineProperty(adapterAny, 'setBasePath', {
                            value: safeSetBasePath,
                            writable: true,
                            configurable: true
                        })
                    }

                    logInfo(`[QueueManager] Patched ExpressAdapter methods using Object.defineProperty`).catch(() => {})

                    logInfo(`[QueueManager] Patched ExpressAdapter methods to avoid Express 5.x compatibility issues`).catch(() => {})

                    // Set base path BEFORE createBullBoard so HTML is generated with correct base href
                    // This ensures static files are requested from the correct path
                    if (dashboardPath) {
                        try {
                            safeSetBasePath.call(adapterAny, dashboardPath)
                        } catch (e) {
                            logWarn(`[QueueManager] Could not set base path: ${getErrorMessage(e)}`).catch(() => {})
                        }
                    }

                    // Create BullBoard - our patches should prevent the error
                    createBullBoard({
                        queues: bullBoardQueues,
                        serverAdapter: serverAdapter
                    })

                    // Get the router after BullBoard is created
                    const router = serverAdapter.getRouter()

                    if (!router) {
                        throw new Error('Failed to get router from ExpressAdapter')
                    }

                    // Use the router directly - it will be mounted at the correct path in index.ts
                    this.bullBoardRouter = router

                    logInfo(
                        `[QueueManager] BullBoard dashboard configured with ${bullBoardQueues.length} queues. Router will be mounted at: ${
                            dashboardPath || '/admin/queues'
                        }`
                    ).catch(() => {})
                } catch (error) {
                    // If createBullBoard fails, log the error with full details
                    const errorMessage = error instanceof Error ? error.message : String(error)
                    const errorStack = error instanceof Error ? error.stack : undefined
                    logWarn(
                        `[QueueManager] Failed to setup BullBoard dashboard: ${errorMessage}${errorStack ? '\n' + errorStack : ''}`
                    ).catch(() => {})
                    // Create an empty router to avoid errors when trying to mount
                    const express = require('express')
                    const errorRouter = express.Router()
                    errorRouter.get('*', (req: any, res: any) => {
                        res.status(503).json({
                            error: 'BullBoard dashboard is not available due to compatibility issues',
                            details: errorMessage
                        })
                    })
                    this.bullBoardRouter = errorRouter
                }
            }
        }

        logInfo(`[QueueManager] Successfully setup ${this.orgQueues.size} queues across ${orgIds.length} organizations`).catch(() => {})
    }

    /**
     * Get all organization IDs that have queues configured
     */
    public getAllOrgIds(): number[] {
        return Array.from(this.orgConnections.keys())
    }
}
