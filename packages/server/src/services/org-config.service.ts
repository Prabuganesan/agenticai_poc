/**
 * Simplified Organization Config Service for Single-Org Kodivian
 * Hardcoded to org 1 - no multi-org, no meta DB lookup
 */

import { Pool as PgPool } from 'pg'
import { logInfo, logError } from '../utils/logger/system-helper'

interface OrgConfig {
    orgId: number
    nodeInfo?: any
    platformDB?: any
    contextPath?: string
    redis?: any  // For queue/cache managers (not used for auth)
}

/**
 * Simplified OrganizationConfigService for single-org deployment
 * Hardcoded to org 1 with PostgreSQL only
 */
export class OrganizationConfigService {
    private orgConfig: OrgConfig = { orgId: 1 }
    private pool: PgPool | null = null
    public readonly instanceId = Math.random().toString(36).substring(7)

    constructor() { }

    /**
     * Initialize PostgreSQL connection
     * Uses DATABASE_* env vars for local Kodivian DB (not meta DB)
     */
    async initialize(): Promise<void> {
        try {
            // For single-org, we just set up the default org 1 config
            this.orgConfig = {
                orgId: 1,
                nodeInfo: {
                    nodeName: 'kodivian',
                    contextPath: process.env.CONTEXT_PATH || '/kodivian'
                },
                platformDB: {
                    host: process.env.DATABASE_HOST || 'localhost',
                    port: parseInt(process.env.DATABASE_PORT || '5432'),
                    username: process.env.DATABASE_USER || 'postgres',
                    password: process.env.DATABASE_PASSWORD || '',
                    database: process.env.DATABASE_NAME || 'kodivian',
                    maxPoolSize: 10,
                    minPoolSize: 2,
                    dbType: 'POSTGRES'
                },
                contextPath: process.env.CONTEXT_PATH || '/kodivian'
            }

            logInfo('✅ Single-org configuration initialized (org 1)').catch(() => { })
        } catch (error) {
            logError('Failed to initialize org config', error).catch(() => { })
            throw error
        }
    }

    /**
     * Load organization - for single-org just log success
     */
    async loadAllOrganizations(): Promise<void> {
        logInfo('🚀 Single-org mode: Using hardcoded org 1').catch(() => { })
        logInfo('✅ Organization configuration loaded').catch(() => { })
    }

    /**
     * Get organization configuration by ID
     * Returns org 1 config for any orgId (single-org mode)
     */
    getOrgConfig(orgId: number): OrgConfig | undefined {
        return this.orgConfig
    }

    /**
     * Check if organization exists - always true for org 1
     */
    hasOrg(orgId: number): boolean {
        return orgId === 1 || orgId === this.orgConfig.orgId
    }

    /**
     * Get all organization IDs - just org 1
     */
    getAllOrgIds(): number[] {
        return [1]
    }

    /**
     * Get context path for organization
     */
    getContextPath(orgId: number): string | undefined {
        return this.orgConfig.contextPath || process.env.CONTEXT_PATH || '/kodivian'
    }

    /**
     * Get connection pool status
     */
    getPoolStatus(): { dbType: string; isConnected: boolean } {
        return {
            dbType: 'postgres',
            isConnected: true
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{
        healthy: boolean
        message: string
        dbType: string
    }> {
        return {
            healthy: true,
            message: 'Single-org mode - configuration healthy',
            dbType: 'postgres'
        }
    }

    /**
     * Close database connection
     */
    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end()
            this.pool = null
        }
    }
}

// Singleton instance
let instance: OrganizationConfigService | null = null

export function getOrganizationConfigService(): OrganizationConfigService {
    if (!instance) {
        instance = new OrganizationConfigService()
    }
    return instance
}
