import {
    IComponentNodes,
    IExecuteDocStoreUpsert,
    IExecuteFlowParams,
    IExecutePreviewLoader,
    IExecuteProcessLoader,
    IExecuteVectorStoreInsert
} from '../Interface'
import { CachePool } from '../CachePool'
import { BaseQueue } from './BaseQueue'
import { executeUpsert } from '../utils/upsertVector'
import { executeDocStoreUpsert, insertIntoVectorStore, previewChunks, processLoader } from '../services/documentstore'
import { RedisOptions } from 'bullmq'
import { logInfo } from '../utils/logger/system-helper'
import { UsageCacheManager } from '../UsageCacheManager'
import { getDataSource } from '../DataSource'
import { getDataSourceManager } from '../DataSourceManager'

interface UpsertQueueOptions {
    cachePool: CachePool
    usageCacheManager: UsageCacheManager
    componentNodes: IComponentNodes
}

export class UpsertQueue extends BaseQueue {
    private componentNodes: IComponentNodes
    private cachePool: CachePool
    private usageCacheManager: UsageCacheManager
    private queueName: string
    protected orgId: number

    constructor(orgId: number, name: string, connection: RedisOptions, options: UpsertQueueOptions) {
        super(orgId, name, connection)
        this.orgId = orgId
        this.queueName = name
        this.componentNodes = options.componentNodes || {}
        this.cachePool = options.cachePool
        this.usageCacheManager = options.usageCacheManager
    }

    public getQueueName() {
        return this.queueName
    }

    public getQueue() {
        return this.queue
    }

    async processJob(
        data: IExecuteFlowParams | IExecuteDocStoreUpsert | IExecuteProcessLoader | IExecuteVectorStoreInsert | IExecutePreviewLoader
    ) {
        // Use per-org DataSource dynamically based on orgId from job data or queue's orgId
        const jobOrgId = (data as any).orgId || this.orgId

        // Ensure DataSource is initialized (in case it wasn't loaded at startup)
        const dataSourceManager = getDataSourceManager()
        await dataSourceManager.ensureDataSourceInitialized(jobOrgId)

        const appDataSource = getDataSource(jobOrgId)
        data.appDataSource = appDataSource
        if (this.cachePool) data.cachePool = this.cachePool
        if (this.usageCacheManager) data.usageCacheManager = this.usageCacheManager
        if (this.componentNodes) data.componentNodes = this.componentNodes

        // document-store/loader/preview
        if (Object.prototype.hasOwnProperty.call(data, 'isPreviewOnly')) {
            logInfo('Previewing loader...').catch(() => {})
            return await previewChunks(data as IExecutePreviewLoader)
        }

        // document-store/loader/process/:loaderId
        if (Object.prototype.hasOwnProperty.call(data, 'isProcessWithoutUpsert')) {
            logInfo('Processing loader...').catch(() => {})
            return await processLoader(data as IExecuteProcessLoader)
        }

        // document-store/vectorstore/insert/:loaderId
        if (Object.prototype.hasOwnProperty.call(data, 'isVectorStoreInsert')) {
            logInfo('Inserting vector store...').catch(() => {})
            return await insertIntoVectorStore(data as IExecuteVectorStoreInsert)
        }

        // document-store/upsert/:storeId
        if (Object.prototype.hasOwnProperty.call(data, 'storeId')) {
            logInfo('Upserting to vector store via document loader...').catch(() => {})
            return await executeDocStoreUpsert(data as IExecuteDocStoreUpsert)
        }

        // upsert-vector/:chatflowid
        logInfo('Upserting to vector store via chatflow...').catch(() => {})
        return await executeUpsert(data as IExecuteFlowParams)
    }
}
