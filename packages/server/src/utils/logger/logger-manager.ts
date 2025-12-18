/**
 * Logger Manager
 * Manages logger instances and caching
 * Provides singleton pattern for Winston loggers per module
 */

import winston from 'winston'
import { createModuleLogger } from './module-logger'

const moduleLoggers = new Map<string, winston.Logger>()

/**
 * Get or create logger for a module
 * Uses caching to avoid creating duplicate loggers
 *
 * @param group - Group name (system, workflows, services, storage, infrastructure)
 * @param module - Module name (system, api, security, chatflow, etc.)
 * @param orgId - Organization ID (optional - creates org-specific logger if provided)
 * @returns Winston logger or null if group is disabled via flags
 */
export async function getLogger(group: string, module: string, orgId?: string | number): Promise<winston.Logger | null> {
    const loggerKey = `${group}-${module}-${orgId || 'system'}`
    let logger = moduleLoggers.get(loggerKey)

    if (!logger) {
        const newLogger = createModuleLogger(group, module, orgId)
        if (newLogger) {
            logger = newLogger
            moduleLoggers.set(loggerKey, logger)
        } else {
            // Group disabled via flags, return null
            return null
        }
    }

    return logger
}

/**
 * Clear logger cache (useful for testing or when flags change)
 */
export function clearLoggerCache(): void {
    moduleLoggers.clear()
}
