/**
 * Core Logging Function
 * Phase 3.2: Core function that writes to specific module file
 */

import { LogContext, QueueEntry } from './types'
import { addToQueue } from './async-queue'
import { getLogger } from './logger-manager'
import { sanitizeLogContext } from './sanitize'

/**
 * Core function to log to a specific module
 * Ensures userId is present in context
 *
 * @param group - Group name
 * @param module - Module name
 * @param level - Log level (error, warn, info, debug)
 * @param message - Log message
 * @param context - Log context (must include userId)
 * @param orgId - Organization ID (optional)
 */
export async function logToModule(
    group: string,
    module: string,
    level: string,
    message: string,
    context: LogContext,
    orgId?: string | number
): Promise<void> {
    // ✅ Validate and ensure userId is present
    if (!context.userId) {
        context.userId = 'anonymous'
    }

    // For non-system groups, orgId is REQUIRED
    // Extract from parameter first, then from context
    const finalOrgId = orgId || context.orgId

    if (group !== 'system' && !finalOrgId) {
        // For non-system groups, orgId is required
        // Log error but don't throw (to avoid breaking the application)
        console.error(
            `[Logging Error] orgId is required for non-system groups. ` + `Group: ${group}, Module: ${module}. ` + `Skipping log entry.`
        )
        return
    }

    // Get or create logger (orgId is required for non-system groups)
    const logger = await getLogger(group, module, finalOrgId)
    if (!logger) {
        return // Group disabled, skip logging
    }

    // Sanitize context to remove sensitive data before logging
    const sanitizedContext = sanitizeLogContext({
        ...context,
        userId: context.userId, // ✅ Always include userId
        orgId: finalOrgId // ✅ Always include orgId (required for non-system groups)
    })

    // Create queue entry with sanitized context
    const queueEntry: QueueEntry = {
        level: level.toLowerCase(),
        message,
        group,
        module,
        context: sanitizedContext,
        timestamp: Date.now()
    }

    // Add to async queue
    await addToQueue(queueEntry)
}
