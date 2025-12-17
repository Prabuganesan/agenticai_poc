/**
 * Logging System Initialization
 * Creates directory structure for log groups on startup
 *
 * File structure:
 * - System group: logs/system/ (created here)
 * - Other groups: logs/{orgId}/{group}/ (created for each orgId)
 */

import * as path from 'path'
import * as fs from 'fs'
import config from '../config'
import { isGroupEnabled } from './flag-checker'

// Non-system groups that require orgId
const NON_SYSTEM_GROUPS = ['workflows', 'services', 'storage', 'infrastructure']

/**
 * Initialize logging directory structure
 * Creates the system group directory (logs/system/)
 *
 * Behavior:
 * - Checks if directories exist before creating (safe to call multiple times)
 * - Only creates directories if they don't exist
 * - Leaves existing directories/files untouched
 * - Only creates system directory if group is enabled (based on flags)
 */
export function initializeLogDirectories(): void {
    const baseDir = config.logging.dir

    // Ensure base logs directory exists
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true })
    }

    // Only create system group directory (logs/system/)
    // System group is always system-level (no orgId)
    if (isGroupEnabled('system')) {
        const systemDir = path.join(baseDir, 'system')
        // Check if directory exists before creating (safe to call multiple times)
        if (!fs.existsSync(systemDir)) {
            fs.mkdirSync(systemDir, { recursive: true })
        }
    }
}

/**
 * Initialize org-specific log directories for all organizations
 * Creates directories for all enabled non-system groups under each orgId
 *
 * Structure created:
 * - logs/{orgId}/workflows/
 * - logs/{orgId}/services/
 * - logs/{orgId}/storage/
 * - logs/{orgId}/infrastructure/
 *
 * @param orgIds - Array of organization IDs to create directories for
 */
export function initializeOrgLogDirectories(orgIds: (string | number)[]): void {
    const baseDir = config.logging.dir

    if (!orgIds || orgIds.length === 0) {
        return
    }

    // Create org-specific directories for each orgId and enabled group
    for (const orgId of orgIds) {
        const orgDir = path.join(baseDir, orgId.toString())

        // Ensure org directory exists
        if (!fs.existsSync(orgDir)) {
            fs.mkdirSync(orgDir, { recursive: true })
        }

        // Create group directories for each enabled non-system group
        for (const group of NON_SYSTEM_GROUPS) {
            if (isGroupEnabled(group)) {
                const groupDir = path.join(orgDir, group)
                // Check if directory exists before creating (safe to call multiple times)
                if (!fs.existsSync(groupDir)) {
                    fs.mkdirSync(groupDir, { recursive: true })
                }
            }
        }
    }
}
