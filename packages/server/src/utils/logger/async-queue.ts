/**
 * Async Queue System
 * Phase 5: Async queue with batching for non-blocking logging
 */

import { QueueEntry } from './types'
import { getLogger } from './logger-manager'

const logQueue: QueueEntry[] = []
const maxQueueSize = 500
const batchSize = 100
const flushInterval = 5000 // 5 seconds
let flushTimer: NodeJS.Timeout | null = null
let isProcessing = false

/**
 * Add log entry to queue
 * Auto-flushes when batch size reached
 *
 * @param entry - Queue entry to add
 */
export async function addToQueue(entry: QueueEntry): Promise<void> {
    // ✅ Ensure userId is present
    if (!entry.context.userId) {
        entry.context.userId = 'anonymous'
    }

    // Add to queue (remove oldest if queue is full)
    if (logQueue.length >= maxQueueSize) {
        logQueue.shift() // Remove oldest entry
    }
    logQueue.push(entry)

    // Auto-flush if batch size reached
    if (logQueue.length >= batchSize) {
        await flushQueue()
    }

    // Start flush timer if not running
    if (!flushTimer) {
        startFlushTimer()
    }
}

/**
 * Flush queue - process batch and write to loggers
 */
async function flushQueue(): Promise<void> {
    if (isProcessing || logQueue.length === 0) {
        return
    }

    isProcessing = true

    try {
        const batch = logQueue.splice(0, batchSize)

        // Group entries by logger key (group-module-orgId)
        const grouped = new Map<string, QueueEntry[]>()

        for (const entry of batch) {
            // For system group, orgId is not used (set to 'system' for key)
            // For other groups, orgId is required (from context.orgId)
            const orgId = entry.group === 'system' ? 'system' : entry.context.orgId || 'missing'

            const key = `${entry.group}-${entry.module}-${orgId}`

            if (!grouped.has(key)) {
                grouped.set(key, [])
            }
            grouped.get(key)!.push(entry)
        }

        // Write to each logger in parallel
        await Promise.all(
            Array.from(grouped.entries()).map(async ([key, entries]) => {
                const [group, module, orgIdStr] = key.split('-')
                // For system group, orgId is undefined
                // For other groups, orgId is required (from the key)
                const orgId = group === 'system' || orgIdStr === 'system' ? undefined : orgIdStr

                try {
                    const logger = await getLogger(group, module, orgId)

                    if (logger) {
                        for (const entry of entries) {
                            logger.log(entry.level, entry.message, {
                                ...entry.context,
                                group,
                                module,
                                timestamp: new Date(entry.timestamp).toISOString()
                            })
                        }
                    }
                } catch (error) {
                    // Log to console - this is the logging system itself, can't use logging system to log its own errors
                    // This is the only appropriate place for console.error in the logging system
                    console.error(
                        `[Logging System Error] Failed to write logs for ${key}:`,
                        error instanceof Error ? error.message : String(error)
                    )
                }
            })
        )
    } catch (error) {
        // Log to console - this is the logging system itself, can't use logging system to log its own errors
        // This is the only appropriate place for console.error in the logging system
        console.error('[Logging System Error] Failed to flush log queue:', error instanceof Error ? error.message : String(error))
    } finally {
        isProcessing = false
    }
}

/**
 * Start flush timer for periodic log writing
 */
function startFlushTimer(): void {
    if (flushTimer) {
        return // Timer already running
    }

    flushTimer = setInterval(async () => {
        await flushQueue()

        // Stop timer if queue is empty
        if (logQueue.length === 0 && flushTimer) {
            clearInterval(flushTimer)
            flushTimer = null
        }
    }, flushInterval)
}

/**
 * Get queue statistics (for monitoring)
 */
export function getQueueStats() {
    return {
        queueLength: logQueue.length,
        isProcessing,
        maxQueueSize,
        batchSize
    }
}

/**
 * Force flush all pending logs in the queue
 * Used during shutdown to ensure all logs are written before process exits
 */
export async function flushAllLogs(): Promise<void> {
    // Stop the flush timer
    if (flushTimer) {
        clearInterval(flushTimer)
        flushTimer = null
    }

    // Flush all remaining logs
    while (logQueue.length > 0 || isProcessing) {
        await flushQueue()
        // Small delay to allow processing to complete
        if (isProcessing) {
            await new Promise((resolve) => setTimeout(resolve, 10))
        }
    }
}
