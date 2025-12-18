/**
 * Convenience Module Methods
 * Phase 4: Convenience methods for backward compatibility
 * Each method calls the appropriate group method with correct moduleType
 */

import { LogContext } from './types'
import { systemLog, workflowsLog, servicesLog, storageLog, infrastructureLog } from './group-methods'

// ============================================
// System Group Convenience Methods
// ============================================

/**
 * Log to system module
 * Writes to logs/system/system.json
 */
export async function systemSystemLog(level: string, message: string, context?: LogContext): Promise<void> {
    await systemLog(level, message, { ...context, moduleType: 'system' })
}

/**
 * Log to API module
 * Writes to logs/system/api.json
 */
export async function apiLog(level: string, message: string, context?: LogContext): Promise<void> {
    await systemLog(level, message, { ...context, moduleType: 'api' })
}

/**
 * Log to security module
 * Writes to logs/system/security.json
 */
export async function securityLog(level: string, message: string, context?: LogContext): Promise<void> {
    await systemLog(level, message, { ...context, moduleType: 'security' })
}

// ============================================
// Workflows Group Convenience Methods
// ============================================

/**
 * Log to chatflow module
 * Writes to logs/{orgId}/workflows/chatflow.json or logs/workflows/chatflow.json
 */
export async function chatflowLog(level: string, message: string, context?: LogContext): Promise<void> {
    await workflowsLog(level, message, { ...context, moduleType: 'chatflow' })
}

/**
 * Log to agentflow module
 * Writes to logs/{orgId}/workflows/agentflow.json or logs/workflows/agentflow.json
 */
export async function agentflowLog(level: string, message: string, context?: LogContext): Promise<void> {
    await workflowsLog(level, message, { ...context, moduleType: 'agentflow' })
}

/**
 * Log to execution module
 * Writes to logs/{orgId}/workflows/execution.json or logs/workflows/execution.json
 */
export async function executionLog(level: string, message: string, context?: LogContext): Promise<void> {
    await workflowsLog(level, message, { ...context, moduleType: 'execution' })
}

// ============================================
// Services Group Convenience Methods
// ============================================

/**
 * Log to assistant module
 * Writes to logs/{orgId}/services/assistant.json or logs/services/assistant.json
 */
export async function assistantLog(level: string, message: string, context?: LogContext): Promise<void> {
    await servicesLog(level, message, { ...context, moduleType: 'assistant' })
}

/**
 * Log to usage module
 * Writes to logs/{orgId}/services/usage.json or logs/services/usage.json
 */
export async function usageLog(level: string, message: string, context?: LogContext): Promise<void> {
    await servicesLog(level, message, { ...context, moduleType: 'usage' })
}

/**
 * Log to tool module
 * Writes to logs/{orgId}/services/tool.json or logs/services/tool.json
 */
export async function toolLog(level: string, message: string, context?: LogContext): Promise<void> {
    await servicesLog(level, message, { ...context, moduleType: 'tool' })
}

// ============================================
// Storage Group Convenience Methods
// ============================================

/**
 * Log to documentstore module
 * Writes to logs/{orgId}/storage/documentstore.json or logs/storage/documentstore.json
 */
export async function documentStoreLog(level: string, message: string, context?: LogContext): Promise<void> {
    await storageLog(level, message, { ...context, moduleType: 'documentstore' })
}

/**
 * Log to database module
 * Writes to logs/{orgId}/storage/database.json or logs/storage/database.json
 */
export async function databaseLog(level: string, message: string, context?: LogContext): Promise<void> {
    await storageLog(level, message, { ...context, moduleType: 'database' })
}

/**
 * Log to file module
 * Writes to logs/{orgId}/storage/file.json or logs/storage/file.json
 */
export async function fileLog(level: string, message: string, context?: LogContext): Promise<void> {
    await storageLog(level, message, { ...context, moduleType: 'file' })
}

// ============================================
// Infrastructure Group Convenience Methods
// ============================================

/**
 * Log to queue module
 * Writes to logs/{orgId}/infrastructure/queue.json or logs/infrastructure/queue.json
 */
export async function queueLog(level: string, message: string, context?: LogContext): Promise<void> {
    await infrastructureLog(level, message, { ...context, moduleType: 'queue' })
}

/**
 * Log to cache module
 * Writes to logs/{orgId}/infrastructure/cache.json or logs/infrastructure/cache.json
 */
export async function cacheLog(level: string, message: string, context?: LogContext): Promise<void> {
    await infrastructureLog(level, message, { ...context, moduleType: 'cache' })
}

/**
 * Log to session module
 * Writes to logs/{orgId}/infrastructure/session.json or logs/infrastructure/session.json
 */
export async function sessionLog(level: string, message: string, context?: LogContext): Promise<void> {
    await infrastructureLog(level, message, { ...context, moduleType: 'session' })
}

/**
 * Log to streaming module
 * Writes to logs/{orgId}/infrastructure/streaming.json or logs/infrastructure/streaming.json
 */
export async function streamingLog(level: string, message: string, context?: LogContext): Promise<void> {
    await infrastructureLog(level, message, { ...context, moduleType: 'streaming' })
}
