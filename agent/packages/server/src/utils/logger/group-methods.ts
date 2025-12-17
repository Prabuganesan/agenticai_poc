/**
 * Group Logging Methods
 * Phase 3.1: Single method per group that handles module routing internally
 */

import { LogContext } from './types'
import { shouldLog } from './flag-checker'
import { logToModule } from './core'

/**
 * System group logging (handles: system, api, security)
 * All write to logs/system/{module}.json (always system-level, no orgId)
 */
export async function systemLog(
    level: string,
    message: string,
    context?: LogContext & { moduleType?: 'system' | 'api' | 'security' }
): Promise<void> {
    if (!shouldLog('system')) {
        return
    }

    // ✅ Ensure userId is present
    if (!context?.userId) {
        context = { ...context, userId: 'anonymous' }
    }

    const moduleType = context.moduleType || 'system'
    // System group is always system-level (no orgId)
    await logToModule('system', moduleType, level, message, context)
}

/**
 * Workflows group logging (handles: chatflow, agentflow, execution)
 * Writes to logs/{orgId}/workflows/{module}.json or logs/workflows/{module}.json
 */
export async function workflowsLog(
    level: string,
    message: string,
    context?: LogContext & { moduleType?: 'chatflow' | 'agentflow' | 'execution' }
): Promise<void> {
    if (!shouldLog('workflows')) {
        return
    }

    // ✅ Ensure userId is present
    if (!context?.userId) {
        context = { ...context, userId: 'anonymous' }
    }

    const moduleType = context.moduleType || 'chatflow'
    const orgId = context.orgId
    await logToModule('workflows', moduleType, level, message, context, orgId)
}

/**
 * Services group logging (handles: assistant, usage, tool)
 * Writes to logs/{orgId}/services/{module}.json or logs/services/{module}.json
 */
export async function servicesLog(
    level: string,
    message: string,
    context?: LogContext & { moduleType?: 'assistant' | 'usage' | 'tool' }
): Promise<void> {
    if (!shouldLog('services')) {
        return
    }

    // ✅ Ensure userId is present
    if (!context?.userId) {
        context = { ...context, userId: 'anonymous' }
    }

    const moduleType = context.moduleType || 'assistant'
    const orgId = context.orgId
    await logToModule('services', moduleType, level, message, context, orgId)
}

/**
 * Storage group logging (handles: documentstore, database, file)
 * Writes to logs/{orgId}/storage/{module}.json or logs/storage/{module}.json
 */
export async function storageLog(
    level: string,
    message: string,
    context?: LogContext & { moduleType?: 'documentstore' | 'database' | 'file' }
): Promise<void> {
    if (!shouldLog('storage')) {
        return
    }

    // ✅ Ensure userId is present
    if (!context?.userId) {
        context = { ...context, userId: 'anonymous' }
    }

    const moduleType = context.moduleType || 'documentstore'
    const orgId = context.orgId
    await logToModule('storage', moduleType, level, message, context, orgId)
}

/**
 * Infrastructure group logging (handles: queue, cache, session, streaming)
 * Writes to logs/{orgId}/infrastructure/{module}.json or logs/infrastructure/{module}.json
 */
export async function infrastructureLog(
    level: string,
    message: string,
    context?: LogContext & { moduleType?: 'queue' | 'cache' | 'session' | 'streaming' }
): Promise<void> {
    if (!shouldLog('infrastructure')) {
        return
    }

    // ✅ Ensure userId is present
    if (!context?.userId) {
        context = { ...context, userId: 'anonymous' }
    }

    const moduleType = context.moduleType || 'queue'
    const orgId = context.orgId
    await logToModule('infrastructure', moduleType, level, message, context, orgId)
}
