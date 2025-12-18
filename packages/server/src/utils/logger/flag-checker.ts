/**
 * Flag Checker Functions
 * Phase 1.3: Check if logging should proceed based on flags
 */

import { SimplifiedFlags } from './types'
import { loadFlagsFromEnv } from './env-flag-loader'

let cachedFlags: SimplifiedFlags | null = null

/**
 * Get cached flags or load from environment
 * @returns SimplifiedFlags structure
 */
export function getFlags(): SimplifiedFlags {
    if (!cachedFlags) {
        cachedFlags = loadFlagsFromEnv()
    }
    return cachedFlags
}

/**
 * Refresh flags cache from environment variables
 * Call this after environment variables change
 */
export function refreshFlags(): void {
    cachedFlags = loadFlagsFromEnv()
}

/**
 * Check if logging is globally enabled
 * @returns true if global logging is enabled
 */
export function isLoggingEnabled(): boolean {
    const flags = getFlags()
    return flags.global.enabled
}

/**
 * Check if a specific group is enabled
 * @param group - Group name (e.g., 'system', 'workflows')
 * @returns true if group is enabled (and global is enabled)
 */
export function isGroupEnabled(group: string): boolean {
    const flags = getFlags()

    // First check global flag - if disabled, all groups are disabled
    if (!flags.global.enabled) {
        return false
    }

    // Map group names to flag keys
    const groupMap: Record<string, keyof typeof flags.groups> = {
        system: 'system',
        workflows: 'workflows',
        services: 'services',
        storage: 'storage',
        infrastructure: 'infrastructure'
    }

    const flagKey = groupMap[group.toLowerCase()]
    if (!flagKey) {
        // Unknown group - default to enabled (for backward compatibility)
        return true
    }

    return flags.groups[flagKey] ?? true
}

/**
 * Check if logging should proceed for a group/module
 * @param group - Group name
 * @param module - Module name (optional, for future use)
 * @returns true if logging should proceed
 */
export function shouldLog(group: string, module?: string): boolean {
    // Check global flag first
    if (!isLoggingEnabled()) {
        return false
    }

    // Check group flag
    if (!isGroupEnabled(group)) {
        return false
    }

    return true
}
