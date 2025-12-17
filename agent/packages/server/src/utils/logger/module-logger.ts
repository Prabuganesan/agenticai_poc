/**
 * Module Logger Factory
 * Phase 2.2: Create Winston logger for each module
 *
 * Creates standardized Winston loggers with:
 * - Pure JSON format
 * - Simple filenames (no rotation, no date/time suffixes)
 * - Flag-based enable/disable
 */

import winston from 'winston'
import { getLogFilePath } from './file-structure'
import { isGroupEnabled } from './flag-checker'

/**
 * Create Winston logger for a specific module
 * Returns null if group is disabled via flags
 *
 * Standard configuration:
 * - Format: Pure JSON
 * - Filename: Simple module.json (no date/time suffixes)
 * - Level: info
 *
 * @param group - Group name (system, workflows, services, storage, infrastructure)
 * @param module - Module name (system, api, security, chatflow, etc.)
 * @param orgId - Organization ID (optional - creates org-specific logger if provided)
 * @returns Winston logger or null if group is disabled via flags
 */
export function createModuleLogger(group: string, module: string, orgId?: string | number): winston.Logger | null {
    // Check if group is enabled via flags
    if (!isGroupEnabled(group)) {
        return null
    }

    const filePath = getLogFilePath(group, module, orgId)

    // Standard logger configuration
    return winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
            winston.format.errors({ stack: true }),
            winston.format.json() // Pure JSON format - standard for all logs
        ),
        transports: [
            // Console transport (JSON format)
            new winston.transports.Console({
                level: 'info',
                format: winston.format.json(),
                silent: process.env.NODE_ENV === 'test'
            }),
            // File transport - simple filename, no rotation
            new winston.transports.File({
                filename: filePath,
                level: 'info',
                format: winston.format.combine(
                    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
                    winston.format.errors({ stack: true }),
                    winston.format.json() // Pure JSON format - standard
                )
            })
        ],
        exitOnError: false, // Don't exit on logging errors
        silent: process.env.NODE_ENV === 'test' // Silent in test environment
    })
}
