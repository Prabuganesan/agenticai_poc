import { IServerSideEventStreamer } from 'autonomous-components'
import { createClient } from 'redis'
import { logInfo, logError, logWarn, logDebug } from '../utils/logger/system-helper'
import { OrganizationConfigService } from '../services/org-config.service'

export class RedisEventPublisher implements IServerSideEventStreamer {
    private orgConnections: Map<number, ReturnType<typeof createClient>> = new Map()
    private orgConfigService?: OrganizationConfigService
    private defaultOrgId?: number // Store the queue's orgId as fallback when data doesn't have orgId

    constructor(orgConfigService?: OrganizationConfigService, defaultOrgId?: number) {
        this.orgConfigService = orgConfigService
        this.defaultOrgId = defaultOrgId // Store queue's orgId (dynamic, not hardcoded)
        if (defaultOrgId) {
            logInfo(`[RedisEventPublisher] Created with defaultOrgId: ${defaultOrgId} (from queue)`).catch(() => {})
        }
    }

    /**
     * Initialize Redis connections for all organizations
     * Must be called after orgConfigService.loadAllOrganizations()
     */
    public async initializeOrgConnections(orgConfigService: OrganizationConfigService): Promise<void> {
        this.orgConfigService = orgConfigService
        const orgIds = orgConfigService.getAllOrgIds()
        const uniqueOrgIds = Array.from(new Set(orgIds))

        logInfo(`[RedisEventPublisher] Initializing connections for ${uniqueOrgIds.length} organizations`).catch(() => {})

        for (const orgId of uniqueOrgIds) {
            await this.connect(orgId)
        }

        logInfo(`[RedisEventPublisher] Initialized ${this.orgConnections.size} organization Redis connections`).catch(() => {})
    }

    /**
     * Get Redis client for specific organization
     */
    private getRedisClient(orgId: number): ReturnType<typeof createClient> {
        const client = this.orgConnections.get(orgId)
        if (!client) {
            throw new Error(`Redis connection not found for organization ${orgId}. Please ensure connection is initialized.`)
        }
        return client
    }

    private setupEventListeners(orgId: number, client: ReturnType<typeof createClient>) {
        client.on('connect', () => {
            logInfo(`[RedisEventPublisher] Redis client connecting for orgId ${orgId}...`).catch(() => {})
        })

        client.on('ready', () => {
            logInfo(`[RedisEventPublisher] Redis client ready and connected for orgId ${orgId}`).catch(() => {})
        })

        client.on('error', (err) => {
            logError(`[RedisEventPublisher] Redis client error for orgId ${orgId}:`, err).catch(() => {})
        })

        client.on('end', () => {
            logWarn(`[RedisEventPublisher] Redis client connection ended for orgId ${orgId}`).catch(() => {})
        })

        client.on('reconnecting', () => {
            logInfo(`[RedisEventPublisher] Redis client reconnecting for orgId ${orgId}...`).catch(() => {})
        })
    }

    isConnected(orgId: number): boolean {
        const client = this.orgConnections.get(orgId)
        return client ? client.isReady : false
    }

    async connect(orgId: number): Promise<void> {
        if (this.orgConnections.has(orgId)) {
            logDebug(`[RedisEventPublisher] Connection already exists for orgId ${orgId}`).catch(() => {})
            return
        }

        if (!this.orgConfigService) {
            throw new Error('OrganizationConfigService not provided. Cannot create Redis connection.')
        }

        const orgConfig = this.orgConfigService.getOrgConfig(orgId)
        const redisConfig = orgConfig?.redis

        if (!redisConfig) {
            throw new Error(`Redis configuration not found for organization ${orgId}. Redis config is required.`)
        }

        const client = createClient({
            username: undefined, // Redis doesn't use username in this config
            password: redisConfig.password && redisConfig.password.trim().length > 0 ? redisConfig.password.trim() : undefined,
            socket: {
                host: redisConfig.host,
                port: redisConfig.port,
                keepAlive:
                    process.env.REDIS_KEEP_ALIVE && !isNaN(parseInt(process.env.REDIS_KEEP_ALIVE, 10))
                        ? parseInt(process.env.REDIS_KEEP_ALIVE, 10)
                        : undefined
            },
            pingInterval:
                process.env.REDIS_KEEP_ALIVE && !isNaN(parseInt(process.env.REDIS_KEEP_ALIVE, 10))
                    ? parseInt(process.env.REDIS_KEEP_ALIVE, 10)
                    : undefined
        })

        this.setupEventListeners(orgId, client)
        await client.connect()
        this.orgConnections.set(orgId, client)
        logInfo(`[RedisEventPublisher] Connected to Redis for orgId ${orgId}: ${redisConfig.host}:${redisConfig.port}`).catch(() => {})
    }

    streamCustomEvent(chatId: string, eventType: string, data: any) {
        // Extract orgId from data dynamically, fallback to queue's orgId if not in data
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback (dynamic, not hardcoded)
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamCustomEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        try {
            const client = this.getRedisClient(orgId)
            client.publish(
                chatId,
                JSON.stringify({
                    chatId,
                    eventType,
                    data
                })
            )
        } catch (error) {
            logError(`[RedisEventPublisher] Error streaming custom event for orgId ${orgId}:`, error).catch(() => {})
        }
    }

    private extractOrgIdFromChatId(chatId: string): number | null {
        // Try to extract orgId from chatId if it contains orgId information
        // This is a fallback - ideally orgId should be in the data
        // For now, return null and let the caller handle it
        return null
    }

    private publishEvent(orgId: number, chatId: string, eventType: string, data: any): void {
        try {
            const client = this.getRedisClient(orgId)
            client.publish(
                chatId,
                JSON.stringify({
                    chatId,
                    eventType,
                    data
                })
            )
        } catch (error) {
            logError(`[RedisEventPublisher] Error streaming ${eventType} event for orgId ${orgId}:`, error).catch(() => {})
        }
    }

    streamStartEvent(chatId: string, data: string) {
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamStartEvent, chatId: ${chatId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'start', data)
    }

    streamTokenEvent(chatId: string, data: string) {
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamTokenEvent, chatId: ${chatId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'token', data)
    }

    streamSourceDocumentsEvent(chatId: string, data: any) {
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamSourceDocumentsEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'sourceDocuments', data)
    }

    streamArtifactsEvent(chatId: string, data: any) {
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamArtifactsEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'artifacts', data)
    }

    streamUsedToolsEvent(chatId: string, data: any) {
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamUsedToolsEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'usedTools', data)
    }

    streamCalledToolsEvent(chatId: string, data: any) {
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamCalledToolsEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'calledTools', data)
    }

    streamFileAnnotationsEvent(chatId: string, data: any) {
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamFileAnnotationsEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'fileAnnotations', data)
    }

    streamToolEvent(chatId: string, data: any): void {
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamToolEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'tool', data)
    }

    streamAgentReasoningEvent(chatId: string, data: any): void {
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamAgentReasoningEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'agentReasoning', data)
    }

    streamAgentFlowEvent(chatId: string, data: any): void {
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamAgentFlowEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'agentFlowEvent', data)
    }

    streamAgentFlowExecutedDataEvent(chatId: string, data: any): void {
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamAgentFlowExecutedDataEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'agentFlowExecutedData', data)
    }

    streamNextAgentEvent(chatId: string, data: any): void {
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamNextAgentEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'nextAgent', data)
    }

    streamNextAgentFlowEvent(chatId: string, data: any): void {
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamNextAgentFlowEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'nextAgentFlow', data)
    }

    streamActionEvent(chatId: string, data: any): void {
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamActionEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'action', data)
    }

    streamAbortEvent(chatId: string, data?: any): void {
        // Extract orgId from data if provided, otherwise try chatId, then use queue's orgId
        let orgId = data ? this.extractOrgIdFromData(data) : this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamAbortEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'abort', '[DONE]')
    }

    streamEndEvent(_: string) {
        // placeholder for future use
    }

    streamErrorEvent(chatId: string, msg: string, data?: any) {
        // Extract orgId from data if provided, otherwise try chatId, then use queue's orgId
        let orgId = data ? this.extractOrgIdFromData(data) : this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamErrorEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'error', msg)
    }

    private extractOrgIdFromData(data: any): number | null {
        if (typeof data === 'object' && data !== null && data.orgId) {
            return typeof data.orgId === 'number' ? data.orgId : parseInt(String(data.orgId), 10)
        }
        return null
    }

    streamMetadataEvent(chatId: string, apiResponse: any) {
        try {
            let orgId = this.extractOrgIdFromData(apiResponse) || this.extractOrgIdFromChatId(chatId)
            if (!orgId && this.defaultOrgId !== undefined) {
                orgId = this.defaultOrgId // Use queue's orgId as fallback
            }
            if (!orgId) {
                logError(
                    `[RedisEventPublisher] Cannot determine orgId for streamMetadataEvent, chatId: ${chatId}, apiResponse.orgId: ${apiResponse?.orgId}, defaultOrgId: ${this.defaultOrgId}`
                )
                return
            }
            const metadataJson: any = {}
            if (apiResponse.chatId) {
                metadataJson['chatId'] = apiResponse.chatId
            }
            if (apiResponse.chatMessageId) {
                metadataJson['chatMessageId'] = apiResponse.chatMessageId
            }
            if (apiResponse.question) {
                metadataJson['question'] = apiResponse.question
            }
            if (apiResponse.sessionId) {
                metadataJson['sessionId'] = apiResponse.sessionId
            }
            if (apiResponse.memoryType) {
                metadataJson['memoryType'] = apiResponse.memoryType
            }
            if (Object.keys(metadataJson).length > 0) {
                this.publishEvent(orgId, chatId, 'metadata', metadataJson)
            }
        } catch (error) {
            logError('Error streaming metadata event:', error).catch(() => {})
        }
    }

    streamUsageMetadataEvent(chatId: string, data: any): void {
        let orgId = this.extractOrgIdFromData(data) || this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamUsageMetadataEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'usageMetadata', data)
    }

    streamTTSStartEvent(chatId: string, chatMessageId: string, format: string, data?: any): void {
        let orgId = data ? this.extractOrgIdFromData(data) : this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamTTSStartEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'tts_start', { format, chatMessageId })
    }

    streamTTSDataEvent(chatId: string, chatMessageId: string, audioChunk: string, data?: any): void {
        let orgId = data ? this.extractOrgIdFromData(data) : this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamTTSDataEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'tts_data', { audioChunk, chatMessageId })
    }

    streamTTSEndEvent(chatId: string, chatMessageId: string, data?: any): void {
        let orgId = data ? this.extractOrgIdFromData(data) : this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamTTSEndEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'tts_end', { chatMessageId })
    }

    streamTTSAbortEvent(chatId: string, chatMessageId: string, data?: any): void {
        let orgId = data ? this.extractOrgIdFromData(data) : this.extractOrgIdFromChatId(chatId)
        if (!orgId && this.defaultOrgId !== undefined) {
            orgId = this.defaultOrgId // Use queue's orgId as fallback
        }
        if (!orgId) {
            logError(
                `[RedisEventPublisher] Cannot determine orgId for streamTTSAbortEvent, chatId: ${chatId}, data.orgId: ${data?.orgId}, defaultOrgId: ${this.defaultOrgId}`
            )
            return
        }
        this.publishEvent(orgId, chatId, 'tts_abort', { chatMessageId })
    }

    async disconnect() {
        const disconnectPromises: Promise<void>[] = []
        for (const [orgId, client] of this.orgConnections.entries()) {
            disconnectPromises.push(
                client
                    .quit()
                    .then(() => {
                        logInfo(`[RedisEventPublisher] Disconnected Redis client for orgId ${orgId}`).catch(() => {})
                    })
                    .catch((error) => {
                        logError(`[RedisEventPublisher] Error disconnecting Redis client for orgId ${orgId}:`, error).catch(() => {})
                    })
            )
        }
        await Promise.allSettled(disconnectPromises)
        this.orgConnections.clear()
    }
}
