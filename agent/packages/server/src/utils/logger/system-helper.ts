/**
 * System Logging Helper
 * Convenience functions for system-level logging
 * These are synchronous wrappers for common system logging patterns
 */

import { systemSystemLog } from './module-methods'

/**
 * Log system info message
 * @param message - Log message
 * @param context - Optional context
 */
export async function logInfo(message: string, context?: Record<string, any>): Promise<void> {
    await systemSystemLog('info', message, {
        userId: 'system',
        ...context
    })
}

/**
 * Log system error message
 * @param message - Log message
 * @param error - Error object or context
 */
export async function logError(message: string, error?: any): Promise<void> {
    const context: Record<string, any> = {
        userId: 'system'
    }

    if (error instanceof Error) {
        context.error = error.message
        context.stack = error.stack
    } else if (error) {
        context.error = String(error)
    }

    await systemSystemLog('error', message, context)
}

/**
 * Log system warning message
 * @param message - Log message
 * @param context - Optional context
 */
export async function logWarn(message: string, context?: Record<string, any>): Promise<void> {
    await systemSystemLog('warn', message, {
        userId: 'system',
        ...context
    })
}

/**
 * Log system debug message
 * @param message - Log message
 * @param context - Optional context
 */
export async function logDebug(message: string, context?: Record<string, any>): Promise<void> {
    await systemSystemLog('debug', message, {
        userId: 'system',
        ...context
    })
}
