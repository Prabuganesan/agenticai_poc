import { logInfo, logError, logWarn } from '../utils/logger/system-helper'
import { SchedulerWorker } from '../scheduler/SchedulerWorker'
import { getDataSource } from '../DataSource'
import * as Server from '../index'
import { BaseCommand } from './base'

export default class Scheduler extends BaseCommand {
    private schedulerWorker: SchedulerWorker | null = null

    async run(): Promise<void> {
        logInfo('Starting Kodivian Scheduler Worker...').catch(() => { })

        // Initialize infrastructure manually (no HTTP server)
        await this.initializeInfrastructure()

        // Get orgId - hardcoded to 1 for single-org mode
        const orgId = 1
        const dataSource = getDataSource(orgId)

        // Get server instance for initialized components
        const serverApp = Server.getInstance()
        if (!serverApp) {
            throw new Error('Failed to initialize server infrastructure')
        }

        // Create scheduler worker
        this.schedulerWorker = new SchedulerWorker(dataSource, {
            componentNodes: serverApp.nodesPool.componentNodes,
            cachePool: serverApp.cachePool,
            usageCacheManager: serverApp.usageCacheManager,
            queueManager: serverApp.queueManager,
            pollIntervalMs: parseInt(process.env.SCHEDULER_POLL_INTERVAL || '5000')
        })

        // Start scheduler
        await this.schedulerWorker.start()

        logInfo('[Scheduler] Successfully started scheduler worker').catch(() => { })

        // Setup graceful shutdown
        this.setupGracefulShutdown()

        // Keep the process running
        process.stdin.resume()
    }

    private async initializeInfrastructure(): Promise<void> {
        const { App, setInstance } = await import('../index')
        const { OrganizationConfigService } = await import('../services/org-config.service')
        const { getDataSourceManager } = await import('../DataSourceManager')
        const { NodesPool } = await import('../NodesPool')
        const { CachePool } = await import('../CachePool')
        const { UsageCacheManager } = await import('../UsageCacheManager')
        const { QueueManager } = await import('../queue/QueueManager')
        const { getEncryptionKey } = await import('../utils')

        try {
            // Step 1: Initialize organization config service
            const orgConfigService = new OrganizationConfigService()
            await orgConfigService.initialize()
            await orgConfigService.loadAllOrganizations()

            // Step 2: Initialize DataSources
            const dataSourceManager = getDataSourceManager()
            await dataSourceManager.initializeAllOrgDataSources(orgConfigService)

            // Step 3: Create App instance and set components
            const app = new App()
            app.orgConfigService = orgConfigService
            app.dataSourceManager = dataSourceManager

            // Step 4: Initialize nodes pool
            app.nodesPool = new NodesPool()
            await app.nodesPool.initialize()

            // Step 5: Initialize encryption key
            await getEncryptionKey()

            // Step 6: Initialize cache pool
            app.cachePool = new CachePool(orgConfigService)

            // Step 7: Initialize usage cache manager
            app.usageCacheManager = await UsageCacheManager.getInstance(orgConfigService)

            // Step 8: Initialize queue manager
            app.queueManager = QueueManager.getInstance()
            await app.queueManager.initializeOrgQueues(orgConfigService)

            // Set as global instance
            setInstance(app)

            await logInfo('✅ [Scheduler]: Infrastructure initialized (no HTTP server)').catch(() => { })
        } catch (error) {
            await logError('[Scheduler] Failed to initialize infrastructure:', error)
            throw error
        }
    }

    setupGracefulShutdown() {
        const shutdown = async (signal: string) => {
            logInfo(`[Scheduler] Received ${signal} signal, shutting down gracefully...`).catch(() => { })

            if (this.schedulerWorker) {
                await this.schedulerWorker.stop()
            }

            // Shutdown server infrastructure
            const serverApp = Server.getInstance()
            if (serverApp) {
                await serverApp.stopApp()
            }

            logInfo('[Scheduler] Shutdown complete').catch(() => { })
            process.exit(0)
        }

        process.on('SIGTERM', () => shutdown('SIGTERM'))
        process.on('SIGINT', () => shutdown('SIGINT'))
    }

    async catch(error: Error) {
        if (error.stack) logError(error.stack).catch(() => { })
        await new Promise((resolve) => {
            setTimeout(resolve, 1000)
        })
        await this.failExit()
    }
}
