/**
 * Logging System Type Definitions
 * Phase 1.1: Flag Types Interface
 */

/**
 * Simplified flags structure loaded from environment variables
 */
export interface SimplifiedFlags {
    global: {
        enabled: boolean
    }
    groups: {
        system: boolean
        workflows: boolean
        services: boolean
        storage: boolean
        infrastructure: boolean
    }
}

/**
 * Flag status structure for API responses
 */
export interface FlagStatus {
    globalEnabled: boolean
    groups: {
        system: boolean
        workflows: boolean
        services: boolean
        storage: boolean
        infrastructure: boolean
    }
}

/**
 * Log context interface
 * Every log entry must include userId
 */
export interface LogContext {
    /** REQUIRED - Every log must have userId */
    userId?: string
    orgId?: string | number
    sessionId?: string
    requestId?: string
    chatflowId?: string
    chatflowName?: string
    agentflowId?: string
    agentflowName?: string
    executionId?: string
    assistantId?: string
    assistantName?: string
    toolId?: string
    toolName?: string
    storeId?: string
    storeName?: string
    // System group context fields
    method?: string
    endpoint?: string
    statusCode?: number
    duration?: number
    ip?: string
    userAgent?: string
    action?: string
    resource?: string
    // Workflows group context fields
    nodeId?: string
    nodeType?: string
    provider?: string
    model?: string
    tokens?: number
    promptTokens?: number
    completionTokens?: number
    cost?: number
    state?: string
    // Storage group context fields
    operation?: string
    table?: string
    rowCount?: number
    fileCount?: number
    chunkCount?: number
    fileId?: string
    fileName?: string
    fileSize?: number
    fileType?: string
    // Infrastructure group context fields
    queueName?: string
    jobId?: string
    jobType?: string
    status?: string
    retryCount?: number
    cacheKey?: string
    hit?: boolean
    ttl?: number
    eventType?: string
    channel?: string
    connected?: boolean
    // Allow additional fields
    [key: string]: any
}

/**
 * Queue entry structure for async logging
 */
export interface QueueEntry {
    level: string
    message: string
    group: string
    module: string
    context: LogContext
    timestamp: number
}
