import { logInfo, logError, logWarn } from '../utils/logger/system-helper'
import { QueueManager } from '../queue/QueueManager'
import { BaseCommand } from './base'
import { NodesPool } from '../NodesPool'
import { CachePool } from '../CachePool'
import { QueueEvents, QueueEventsListener } from 'bullmq'
import { AbortControllerPool } from '../AbortControllerPool'
import { UsageCacheManager } from '../UsageCacheManager'
import { OrganizationConfigService } from '../services/org-config.service'
import express from 'express'
import http from 'http'
import { IMetricsProvider } from '../Interface.Metrics'
import { Prometheus } from '../metrics/Prometheus'
import { OpenTelemetry } from '../metrics/OpenTelemetry'
import { setWorkerInstance } from '../index'

interface CustomListener extends QueueEventsListener {
    abort: (args: { id: string }, id: string) => void
}

export default class Worker extends BaseCommand {
    private workers: Map<string, any> = new Map() // Key: `${orgId}-${queueType}`
    private metricsApp: express.Application | null = null
    private metricsServer: http.Server | null = null
    public metricsProvider: IMetricsProvider | null = null

    async run(): Promise<void> {
        logInfo('Starting Kodivian Worker...').catch(() => { })

        // Register worker instance globally so getInstance() can access it
        setWorkerInstance(this)

        // Initialize metrics provider if enabled
        await this.initializeMetrics()

        const { componentNodes, cachePool, abortControllerPool, usageCacheManager, orgConfigService } = await this.prepareData()

        const queueManager = QueueManager.getInstance()

        // Initialize per-org queues
        await queueManager.initializeOrgQueues(orgConfigService)
        logInfo('✅ [Worker]: Per-org queues initialized').catch(() => { })

        // Setup all queues for all organizations
        queueManager.setupAllQueues({
            componentNodes,
            cachePool,
            abortControllerPool,
            usageCacheManager,
            orgConfigService
        })
        logInfo('✅ [Worker]: All queues setup successfully').catch(() => { })

        // Get all orgIds
        const orgIds = queueManager.getAllOrgIds()
        logInfo(`[Worker] Creating workers for ${orgIds.length} organizations: [${orgIds.join(', ')}]`).catch(() => { })

        // Create workers for each organization
        for (const orgId of orgIds) {
            /** Prediction Worker */
            const predictionQueue = queueManager.getQueue(orgId, 'prediction')
            const predictionWorker = predictionQueue.createWorker()
            const predictionWorkerKey = `${orgId}-prediction`
            this.workers.set(predictionWorkerKey, predictionWorker)
            logInfo(`[Worker] Prediction Worker ${predictionWorker.id} created for orgId ${orgId}`).catch(() => { })

            const predictionQueueName = predictionQueue.getQueueName()
            const connection = queueManager.getOrgConnection(orgId)
            const queueEvents = new QueueEvents(predictionQueueName, { connection })

            queueEvents.on<CustomListener>('abort', async ({ id }: { id: string }) => {
                abortControllerPool.abort(id)
            })

            /** Upsertion Worker */
            const upsertionQueue = queueManager.getQueue(orgId, 'upsert')
            const upsertionWorker = upsertionQueue.createWorker()
            const upsertionWorkerKey = `${orgId}-upsert`
            this.workers.set(upsertionWorkerKey, upsertionWorker)
            logInfo(`[Worker] Upsertion Worker ${upsertionWorker.id} created for orgId ${orgId}`).catch(() => { })
        }

        logInfo(`[Worker] Successfully created ${this.workers.size} workers across ${orgIds.length} organizations`).catch(() => { })

        // Keep the process running
        process.stdin.resume()
    }

    async initializeMetrics(): Promise<void> {
        if (process.env.ENABLE_METRICS === 'true') {
            // Create minimal Express app for metrics endpoint
            this.metricsApp = express()

            // Add basic middleware for metrics endpoint
            this.metricsApp.use(express.json())
            this.metricsApp.use(express.urlencoded({ extended: true }))

            const metricsProvider = process.env.METRICS_PROVIDER?.toLowerCase()
            switch (metricsProvider) {
                case 'prometheus':
                case undefined:
                    this.metricsProvider = new Prometheus(this.metricsApp)
                    break
                case 'open_telemetry':
                    this.metricsProvider = new OpenTelemetry(this.metricsApp)
                    break
            }

            if (this.metricsProvider) {
                await this.metricsProvider.initializeCounters()
                logInfo(`📊 [Worker]: Metrics Provider [${this.metricsProvider.getName()}] has been initialized!`).catch(() => { })

                // Setup metrics endpoint
                if (this.metricsProvider instanceof Prometheus) {
                    const contextPath = process.env.CONTEXT_PATH || '/autonomous'
                    const metricsPath = contextPath && contextPath !== '/' ? `${contextPath}/api/v1/metrics` : '/api/v1/metrics'

                    // Use GET method explicitly and handle errors
                    this.metricsApp.get(metricsPath, async (req, res) => {
                        try {
                            const register = (this.metricsProvider as Prometheus).getRegister()
                            res.set('Content-Type', register.contentType)
                            const currentMetrics = await register.metrics()
                            res.send(currentMetrics).end()
                        } catch (error: any) {
                            logError(`[Worker] Error serving metrics: ${error.message}`).catch(() => { })
                            res.status(500).send(`Error generating metrics: ${error.message}`).end()
                        }
                    })

                    // Also handle the path without context path for compatibility
                    if (contextPath && contextPath !== '/') {
                        this.metricsApp.get('/api/v1/metrics', async (req, res) => {
                            try {
                                const register = (this.metricsProvider as Prometheus).getRegister()
                                res.set('Content-Type', register.contentType)
                                const currentMetrics = await register.metrics()
                                res.send(currentMetrics).end()
                            } catch (error: any) {
                                logError(`[Worker] Error serving metrics: ${error.message}`).catch(() => { })
                                res.status(500).send(`Error generating metrics: ${error.message}`).end()
                            }
                        })
                    }

                    // Start metrics server on a different port
                    const metricsPort = process.env.WORKER_METRICS_PORT || '3031'
                    const host = process.env.WORKER_METRICS_HOST || '0.0.0.0'

                    this.metricsServer = this.metricsApp.listen(parseInt(metricsPort), host, () => {
                        logInfo(`📊 [Worker]: Metrics endpoint available at http://${host}:${metricsPort}${metricsPath}`).catch(() => { })
                    })
                }
            } else {
                logError(
                    "❌ [Worker]: Metrics collection is enabled, but failed to initialize provider (valid values are 'prometheus' or 'open_telemetry')."
                ).catch(() => { })
            }
        }
    }

    async prepareData() {
        // Initialize organization config service (required for per-org databases and Redis)
        const orgConfigService = new OrganizationConfigService()
        await orgConfigService.initialize()
        await orgConfigService.loadAllOrganizations()
        logInfo('✅ [Worker]: Organization configs loaded').catch(() => { })

        // Initialize per-org DataSources
        const { getDataSourceManager } = await import('../DataSourceManager')
        const dataSourceManager = getDataSourceManager()
        await dataSourceManager.initializeAllOrgDataSources(orgConfigService)
        logInfo('✅ [Worker]: Per-org DataSources initialized').catch(() => { })

        // Initialize abortcontroller pool
        const abortControllerPool = new AbortControllerPool()

        // Initialize nodes pool
        const nodesPool = new NodesPool()
        await nodesPool.initialize()

        // Initialize cache pool (pass orgConfigService to use per-org Redis)
        const cachePool = new CachePool(orgConfigService)

        // Initialize usage cache manager (pass orgConfigService to use per-org Redis)
        const usageCacheManager = await UsageCacheManager.getInstance(orgConfigService)

        // Queues will use getDataSource(orgId) dynamically
        return { componentNodes: nodesPool.componentNodes, cachePool, abortControllerPool, usageCacheManager, orgConfigService }
    }

    async catch(error: Error) {
        if (error.stack) logError(error.stack).catch(() => { })
        await new Promise((resolve) => {
            setTimeout(resolve, 1000)
        })
        await this.failExit()
    }

    async stopProcess() {
        try {
            logInfo(`[Worker] Shutting down ${this.workers.size} workers...`).catch(() => { })
            const closePromises: Promise<void>[] = []

            // Close all workers with timeout
            for (const [workerKey, worker] of this.workers.entries()) {
                closePromises.push(
                    Promise.race([
                        worker
                            .close()
                            .then(() => {
                                logInfo(`[Worker] Worker ${workerKey} (${worker.id}) closed`).catch(() => { })
                            })
                            .catch((error: Error) => {
                                logError(`[Worker] Error closing worker ${workerKey}:`, error).catch(() => { })
                            }),
                        new Promise<void>((resolve) => {
                            setTimeout(() => {
                                logWarn(`[Worker] Worker ${workerKey} close timeout after 5s, forcing shutdown`).catch(() => { })
                                resolve()
                            }, 5000)
                        })
                    ])
                )
            }

            // Wait for all workers to close (with timeout)
            await Promise.allSettled(closePromises)
            this.workers.clear()
            logInfo('[Worker] All workers shut down successfully').catch(() => { })

            // Close metrics server if running (with timeout)
            if (this.metricsServer) {
                await Promise.race([
                    new Promise<void>((resolve) => {
                        this.metricsServer!.close(() => {
                            logInfo('[Worker] Metrics server closed').catch(() => { })
                            resolve()
                        })
                    }),
                    new Promise<void>((resolve) => {
                        setTimeout(() => {
                            logWarn('[Worker] Metrics server close timeout after 2s, forcing shutdown').catch(() => { })
                            resolve()
                        }, 2000)
                    })
                ])
            }

            // Close database connections
            try {
                const { getDataSourceManager } = await import('../DataSourceManager')
                const dataSourceManager = getDataSourceManager()
                if (dataSourceManager) {
                    await Promise.race([
                        dataSourceManager.closeAll(),
                        new Promise<void>((resolve) => {
                            setTimeout(() => {
                                logWarn('[Worker] Database close timeout after 3s, forcing shutdown').catch(() => { })
                                resolve()
                            }, 3000)
                        })
                    ])
                }
            } catch (dbError) {
                logError('[Worker] Error closing database connections:', dbError).catch(() => { })
            }

            // Flush all pending logs before exit
            try {
                const { flushAllLogs } = await import('../utils/logger/async-queue')
                await Promise.race([
                    flushAllLogs(),
                    new Promise<void>((resolve) => {
                        setTimeout(() => {
                            logWarn('[Worker] Log flush timeout after 2s, forcing exit').catch(() => { })
                            resolve()
                        }, 2000)
                    })
                ])
            } catch (logError) {
                // Silently fail - logging should not block shutdown
            }
        } catch (error) {
            logError('There was an error shutting down Kodivian Worker...', error).catch(() => { })
            await this.failExit()
        }

        await this.gracefullyExit()
    }
}
