/**
 * File Structure Helper
 * Phase 2.1: Get log file paths (system vs org-specific)
 *
 * Standard file structure:
 * - System group: logs/system/{module}.json (always system-level, no orgId)
 * - Other groups: logs/{orgId}/{group}/{module}.json (ALWAYS org-specific, orgId required)
 */

import * as path from 'path'
import * as fs from 'fs'
import config from '../config'

/**
 * Get log file path based on group and orgId
 *
 * File structure rules:
 * 1. System group: Always logs/system/{module}.json (no orgId allowed)
 * 2. Other groups: ALWAYS logs/{orgId}/{group}/{module}.json (orgId REQUIRED for non-system groups)
 *
 * Directories are created automatically if they don't exist.
 *
 * Behavior:
 * - Checks if directory exists before creating (safe to call multiple times)
 * - Only creates directories if they don't exist
 * - Leaves existing directories/files untouched
 * - For non-system groups, orgId is required (throws error if missing)
 *
 * @param group - Group name (system, workflows, services, storage, infrastructure)
 * @param module - Module name (system, api, security, chatflow, etc.)
 * @param orgId - Organization ID (required for non-system groups, ignored for system group)
 * @returns Full path to log file (JSON format)
 * @throws Error if orgId is missing for non-system groups
 */
export function getLogFilePath(group: string, module: string, orgId?: string | number): string {
    const baseDir = config.logging.dir // .autonomous/logs or AUTONOMOUS_DATA_PATH/.autonomous/logs

    // System group is ALWAYS system-level (no orgId)
    if (group === 'system') {
        const groupDir = path.join(baseDir, group)
        // Check if directory exists before creating (safe to call multiple times)
        if (!fs.existsSync(groupDir)) {
            fs.mkdirSync(groupDir, { recursive: true })
        }
        return path.join(groupDir, `${module}.json`)
    }

    // Other groups: ALWAYS org-specific (orgId REQUIRED)
    if (!orgId) {
        throw new Error(
            `orgId is required for non-system groups. ` +
                `Group: ${group}, Module: ${module}. ` +
                `Logs for non-system groups must be written to logs/{orgId}/{group}/{module}.json`
        )
    }

    const orgDir = path.join(baseDir, orgId.toString(), group)
    // Check if directory exists before creating (safe to call multiple times)
    if (!fs.existsSync(orgDir)) {
        fs.mkdirSync(orgDir, { recursive: true })
    }
    return path.join(orgDir, `${module}.json`)
}
