import { createClient } from 'redis'
import { SSEStreamer } from '../utils/SSEStreamer'
import { logInfo, logError, logWarn, logDebug } from '../utils/logger/system-helper'
import { OrganizationConfigService } from '../services/org-config.service'

export class RedisEventSubscriber {
    private orgSubscribers: Map<number, ReturnType<typeof createClient>> = new Map()
    private sseStreamer: SSEStreamer
    private subscribedChannels: Map<number, Set<string>> = new Map() // Key: orgId, Value: Set of channels
    private orgConfigService?: OrganizationConfigService

    constructor(sseStreamer: SSEStreamer, orgConfigService?: OrganizationConfigService) {
        this.sseStreamer = sseStreamer
        this.orgConfigService = orgConfigService
    }

    /**
     * Initialize Redis subscribers for all organizations
     * Must be called after orgConfigService.loadAllOrganizations()
     */
    public async initializeOrgSubscribers(orgConfigService: OrganizationConfigService): Promise<void> {
        this.orgConfigService = orgConfigService
        const orgIds = orgConfigService.getAllOrgIds()
        const uniqueOrgIds = Array.from(new Set(orgIds))

        logInfo(`[RedisEventSubscriber] Initializing subscribers for ${uniqueOrgIds.length} organizations`).catch(() => {})

        for (const orgId of uniqueOrgIds) {
            await this.connect(orgId)
        }

        logInfo(`[RedisEventSubscriber] Initialized ${this.orgSubscribers.size} organization Redis subscribers`).catch(() => {})
    }

    /**
     * Get Redis subscriber for specific organization
     */
    private getRedisSubscriber(orgId: number): ReturnType<typeof createClient> {
        const subscriber = this.orgSubscribers.get(orgId)
        if (!subscriber) {
            throw new Error(`Redis subscriber not found for organization ${orgId}. Please ensure subscriber is initialized.`)
        }
        return subscriber
    }

    private setupEventListeners(orgId: number, subscriber: ReturnType<typeof createClient>) {
        subscriber.on('connect', () => {
            logInfo(`[RedisEventSubscriber] Redis client connecting for orgId ${orgId}...`).catch(() => {})
        })

        subscriber.on('ready', () => {
            logInfo(`[RedisEventSubscriber] Redis client ready and connected for orgId ${orgId}`).catch(() => {})
        })

        subscriber.on('error', (err) => {
            const channels = this.subscribedChannels.get(orgId) || new Set()
            logError(
                `[RedisEventSubscriber] Redis client error for orgId ${orgId}: ${
                    err instanceof Error ? err.message : String(err)
                } (isReady: ${subscriber.isReady}, isOpen: ${subscriber.isOpen}, subscribedChannelsCount: ${channels.size})`,
                err
            ).catch(() => {})
        })

        subscriber.on('end', () => {
            logWarn(`[RedisEventSubscriber] Redis client connection ended for orgId ${orgId}`).catch(() => {})
        })

        subscriber.on('reconnecting', () => {
            logInfo(`[RedisEventSubscriber] Redis client reconnecting for orgId ${orgId}...`).catch(() => {})
        })
    }

    async connect(orgId: number): Promise<void> {
        if (this.orgSubscribers.has(orgId)) {
            logDebug(`[RedisEventSubscriber] Subscriber already exists for orgId ${orgId}`).catch(() => {})
            return
        }

        if (!this.orgConfigService) {
            throw new Error('OrganizationConfigService not provided. Cannot create Redis subscriber.')
        }

        const orgConfig = this.orgConfigService.getOrgConfig(orgId)
        const redisConfig = orgConfig?.redis

        if (!redisConfig) {
            throw new Error(`Redis configuration not found for organization ${orgId}. Redis config is required.`)
        }

        const subscriber = createClient({
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

        this.setupEventListeners(orgId, subscriber)
        await subscriber.connect()
        this.orgSubscribers.set(orgId, subscriber)
        this.subscribedChannels.set(orgId, new Set())
        logInfo(`[RedisEventSubscriber] Connected to Redis for orgId ${orgId}: ${redisConfig.host}:${redisConfig.port}`).catch(() => {})
    }

    subscribe(channel: string, orgId?: number) {
        // If orgId is provided, subscribe to that specific org's Redis
        // Otherwise, subscribe to all org Redis instances (for backward compatibility)
        if (orgId !== undefined) {
            const subscriber = this.getRedisSubscriber(orgId)
            const orgChannels = this.subscribedChannels.get(orgId) || new Set()

            if (orgChannels.has(channel)) {
                return // Prevent duplicate subscription
            }

            subscriber.subscribe(channel, (message) => {
                this.handleEvent(message)
            })

            orgChannels.add(channel)
            this.subscribedChannels.set(orgId, orgChannels)
            logDebug(`[RedisEventSubscriber] Subscribed to channel ${channel} for orgId ${orgId}`).catch(() => {})
        } else {
            // Subscribe to all org Redis instances for backward compatibility
            // This allows existing code to work without specifying orgId
            for (const [orgIdKey, subscriber] of this.orgSubscribers.entries()) {
                const orgChannels = this.subscribedChannels.get(orgIdKey) || new Set()

                if (orgChannels.has(channel)) {
                    continue // Already subscribed for this org
                }

                subscriber.subscribe(channel, (message) => {
                    this.handleEvent(message)
                })

                orgChannels.add(channel)
                this.subscribedChannels.set(orgIdKey, orgChannels)
                logDebug(`[RedisEventSubscriber] Subscribed to channel ${channel} for orgId ${orgIdKey}`).catch(() => {})
            }
        }
    }

    private handleEvent(message: string) {
        // Parse the message from Redis
        const event = JSON.parse(message)
        const { eventType, chatId, chatMessageId, data } = event

        // Stream the event to the client
        switch (eventType) {
            case 'start':
                this.sseStreamer.streamStartEvent(chatId, data)
                break
            case 'token':
                this.sseStreamer.streamTokenEvent(chatId, data)
                break
            case 'sourceDocuments':
                this.sseStreamer.streamSourceDocumentsEvent(chatId, data)
                break
            case 'artifacts':
                this.sseStreamer.streamArtifactsEvent(chatId, data)
                break
            case 'usedTools':
                this.sseStreamer.streamUsedToolsEvent(chatId, data)
                break
            case 'calledTools':
                this.sseStreamer.streamCalledToolsEvent(chatId, data)
                break
            case 'fileAnnotations':
                this.sseStreamer.streamFileAnnotationsEvent(chatId, data)
                break
            case 'tool':
                this.sseStreamer.streamToolEvent(chatId, data)
                break
            case 'agentReasoning':
                this.sseStreamer.streamAgentReasoningEvent(chatId, data)
                break
            case 'nextAgent':
                this.sseStreamer.streamNextAgentEvent(chatId, data)
                break
            case 'agentFlowEvent':
                this.sseStreamer.streamAgentFlowEvent(chatId, data)
                break
            case 'agentFlowExecutedData':
                this.sseStreamer.streamAgentFlowExecutedDataEvent(chatId, data)
                break
            case 'nextAgentFlow':
                this.sseStreamer.streamNextAgentFlowEvent(chatId, data)
                break
            case 'action':
                this.sseStreamer.streamActionEvent(chatId, data)
                break
            case 'abort':
                this.sseStreamer.streamAbortEvent(chatId)
                break
            case 'error':
                this.sseStreamer.streamErrorEvent(chatId, data)
                break
            case 'metadata':
                this.sseStreamer.streamMetadataEvent(chatId, data)
                break
            case 'usageMetadata':
                this.sseStreamer.streamUsageMetadataEvent(chatId, data)
                break
            case 'tts_start':
                this.sseStreamer.streamTTSStartEvent(chatId, chatMessageId, data.format)
                break
            case 'tts_data':
                this.sseStreamer.streamTTSDataEvent(chatId, chatMessageId, data)
                break
            case 'tts_end':
                this.sseStreamer.streamTTSEndEvent(chatId, chatMessageId)
                break
            case 'tts_abort':
                this.sseStreamer.streamTTSAbortEvent(chatId, chatMessageId)
                break
        }
    }

    async disconnect() {
        const disconnectPromises: Promise<void>[] = []
        for (const [orgId, subscriber] of this.orgSubscribers.entries()) {
            disconnectPromises.push(
                subscriber
                    .quit()
                    .then(() => {
                        logInfo(`[RedisEventSubscriber] Disconnected Redis subscriber for orgId ${orgId}`).catch(() => {})
                    })
                    .catch((error) => {
                        logError(`[RedisEventSubscriber] Error disconnecting Redis subscriber for orgId ${orgId}:`, error).catch(() => {})
                    })
            )
        }
        await Promise.allSettled(disconnectPromises)
        this.orgSubscribers.clear()
        this.subscribedChannels.clear()
    }
}
