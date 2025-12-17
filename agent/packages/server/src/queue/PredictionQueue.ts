import { executeFlow } from '../utils/buildChatflow'
import { IComponentNodes, IExecuteFlowParams } from '../Interface'
import { CachePool } from '../CachePool'
import { RedisEventPublisher } from './RedisEventPublisher'
import { AbortControllerPool } from '../AbortControllerPool'
import { BaseQueue } from './BaseQueue'
import { RedisOptions } from 'bullmq'
import { UsageCacheManager } from '../UsageCacheManager'
import { logInfo, logError } from '../utils/logger/system-helper'
import { generateAgentflowv2 as generateAgentflowv2_json } from 'autonomous-components'
import { databaseEntities } from '../utils'
import { executeCustomNodeFunction } from '../utils/executeCustomNodeFunction'
import { getDataSource } from '../DataSource'
import { getDataSourceManager } from '../DataSourceManager'

interface PredictionQueueOptions {
    cachePool: CachePool
    componentNodes: IComponentNodes
    abortControllerPool: AbortControllerPool
    usageCacheManager: UsageCacheManager
}

interface IGenerateAgentflowv2Params extends IExecuteFlowParams {
    prompt: string
    componentNodes: IComponentNodes
    toolNodes: IComponentNodes
    selectedChatModel: Record<string, any>
    question: string
    isAgentFlowGenerator: boolean
}

export class PredictionQueue extends BaseQueue {
    private componentNodes: IComponentNodes
    private cachePool: CachePool
    private abortControllerPool: AbortControllerPool
    private usageCacheManager: UsageCacheManager
    private redisPublisher: RedisEventPublisher
    private queueName: string
    protected orgId: number

    constructor(orgId: number, name: string, connection: RedisOptions, options: PredictionQueueOptions & { orgConfigService?: any }) {
        super(orgId, name, connection)
        this.orgId = orgId
        this.queueName = name
        this.componentNodes = options.componentNodes || {}
        this.cachePool = options.cachePool
        this.abortControllerPool = options.abortControllerPool
        this.usageCacheManager = options.usageCacheManager
        // RedisEventPublisher will be initialized per-org at server startup
        // Pass orgId to RedisEventPublisher so it can use it as fallback when data doesn't have orgId
        this.redisPublisher = new RedisEventPublisher(options.orgConfigService, orgId)
        // Connect to Redis for this org (async, don't block)
        if (options.orgConfigService) {
            this.redisPublisher.connect(orgId).catch((error) => {
                logError(`[PredictionQueue] Failed to connect RedisEventPublisher for orgId ${orgId}:`, error).catch(() => {})
            })
        }
    }

    public getQueueName() {
        return this.queueName
    }

    public getQueue() {
        return this.queue
    }

    async processJob(data: IExecuteFlowParams | IGenerateAgentflowv2Params) {
        // Use per-org DataSource dynamically based on orgId from job data or queue's orgId
        const rawOrgId = (data as any).orgId || this.orgId
        const jobOrgId = typeof rawOrgId === 'string' ? parseInt(rawOrgId, 10) : rawOrgId

        // Ensure DataSource is initialized (in case it wasn't loaded at startup)
        const dataSourceManager = getDataSourceManager()
        await dataSourceManager.ensureDataSourceInitialized(jobOrgId)

        const appDataSource = getDataSource(jobOrgId)
        data.appDataSource = appDataSource
        if (this.cachePool) data.cachePool = this.cachePool
        if (this.usageCacheManager) data.usageCacheManager = this.usageCacheManager
        if (this.componentNodes) data.componentNodes = this.componentNodes
        if (this.redisPublisher) data.sseStreamer = this.redisPublisher

        if (Object.prototype.hasOwnProperty.call(data, 'isAgentFlowGenerator')) {
            logInfo(`Generating Agentflow...`).catch(() => {})
            const { prompt, componentNodes, toolNodes, selectedChatModel, question } = data as IGenerateAgentflowv2Params
            const options: Record<string, any> = {
                appDataSource: appDataSource,
                databaseEntities: databaseEntities
                // logger removed - generateAgentflowv2_json should use new logging system internally
            }
            return await generateAgentflowv2_json({ prompt, componentNodes, toolNodes, selectedChatModel }, question, options)
        }

        if (Object.prototype.hasOwnProperty.call(data, 'isExecuteCustomFunction')) {
            const executeCustomFunctionData = data as any
            logInfo(`[${executeCustomFunctionData.orgId}]: Executing Custom Function...`).catch(() => {})
            return await executeCustomNodeFunction({
                appDataSource: appDataSource,
                componentNodes: this.componentNodes,
                data: executeCustomFunctionData.data,
                orgId: executeCustomFunctionData.orgId
            })
        }

        if (this.abortControllerPool) {
            const abortControllerId = `${data.chatflow.guid}_${data.chatId}`
            const signal = new AbortController()
            this.abortControllerPool.add(abortControllerId, signal)
            data.signal = signal
        }

        return await executeFlow(data)
    }
}
