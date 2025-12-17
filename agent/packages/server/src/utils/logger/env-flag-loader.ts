/**
 * Environment Variable Flag Loader
 * Phase 1.2: Load flags from environment variables
 */

import { SimplifiedFlags, FlagStatus } from './types'

const GROUP_NAMES = ['SYSTEM', 'WORKFLOWS', 'SERVICES', 'STORAGE', 'INFRASTRUCTURE'] as const

/**
 * Parse boolean value from environment variable
 * @param value - Environment variable value
 * @param defaultValue - Default value if not set
 * @returns Parsed boolean value
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) return defaultValue
    const lower = value.toLowerCase().trim()
    if (lower === 'true' || lower === '1' || lower === 'yes') return true
    if (lower === 'false' || lower === '0' || lower === 'no') return false
    return defaultValue
}

/**
 * Load flags from environment variables
 * @returns SimplifiedFlags structure
 */
export function loadFlagsFromEnv(): SimplifiedFlags {
    // Load global flag (default: enabled)
    const globalEnabled = parseBoolean(process.env.LOG_ENABLED, true)

    // Load group flags
    const groups: Record<string, boolean> = {}

    for (const groupName of GROUP_NAMES) {
        const envKey = `LOG_${groupName}_ENABLED`
        const groupKey = groupName.toLowerCase()
        groups[groupKey] = parseBoolean(process.env[envKey], true)
    }

    return {
        global: {
            enabled: globalEnabled
        },
        groups: {
            system: groups['system'] ?? true,
            workflows: groups['workflows'] ?? true,
            services: groups['services'] ?? true,
            storage: groups['storage'] ?? true,
            infrastructure: groups['infrastructure'] ?? true
        }
    }
}

/**
 * Get flag status for API responses
 * @returns FlagStatus structure
 */
export function getFlagStatus(): FlagStatus {
    const flags = loadFlagsFromEnv()
    return {
        globalEnabled: flags.global.enabled,
        groups: flags.groups
    }
}
