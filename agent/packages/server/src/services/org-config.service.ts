import { Pool as PgPool } from 'pg'
import oracledb from 'oracledb'
import { logInfo, logError, logWarn, logDebug } from '../utils/logger/system-helper'
import { OracleConnectionHelper } from '../utils/oracle-connection-helper'
import * as crypto from 'crypto'

interface OrgConfig {
    orgId: number
    nodeInfo?: any
    couchDb?: any
    platformDB?: any
    redis?: any
    license?: string
    contextPath?: string
    designerInfo?: any
}

class OrgConfigStore {
    private orgConfigs: Map<number, OrgConfig> = new Map()
    private contextPathMap: Map<number, string> = new Map()

    setNodeInfo(orgId: number, nodeInfo: any): void {
        // Match autonomous server: use getOrCreate but ensure we don't overwrite existing nodeInfo
        // This prevents duplicate orgIds from being added to the Map
        if (!this.orgConfigs.has(orgId)) {
            const config = this.getOrCreate(orgId)
            config.nodeInfo = nodeInfo
            this.orgConfigs.set(orgId, config)
        } else {
            // Update existing config's nodeInfo if it doesn't exist
            const existingConfig = this.orgConfigs.get(orgId)!
            if (!existingConfig.nodeInfo) {
                existingConfig.nodeInfo = nodeInfo
                this.orgConfigs.set(orgId, existingConfig)
            }
        }
    }

    setCouchDbConfig(orgId: number, config: any): void {
        const orgConfig = this.getOrCreate(orgId)
        orgConfig.couchDb = config
        this.orgConfigs.set(orgId, orgConfig)
    }

    setPlatformDBConfig(orgId: number, config: any): void {
        const orgConfig = this.getOrCreate(orgId)
        orgConfig.platformDB = config
        this.orgConfigs.set(orgId, orgConfig)
    }

    setRedisConfig(orgId: number, config: any): void {
        // Ensure orgId exists in map (getOrCreate handles this)
        const orgConfig = this.getOrCreate(orgId)
        orgConfig.redis = config
        // Map.set will overwrite if key exists, ensuring no duplicates
        this.orgConfigs.set(orgId, orgConfig)
    }

    setLicense(orgId: number, license: string): void {
        const orgConfig = this.getOrCreate(orgId)
        orgConfig.license = license
        this.orgConfigs.set(orgId, orgConfig)
    }

    setContextPath(orgId: number, contextPath: string): void {
        this.contextPathMap.set(orgId, contextPath)
    }

    setDesignerInfo(orgId: number, designerInfo: any): void {
        const orgConfig = this.getOrCreate(orgId)
        orgConfig.designerInfo = designerInfo
        this.orgConfigs.set(orgId, orgConfig)
    }

    getOrgConfig(orgId: number): OrgConfig | undefined {
        const config = this.orgConfigs.get(orgId)
        return config
    }

    getAllOrgIds(): number[] {
        // Map keys are already unique, but we use Set as extra safety
        // This ensures we never return duplicates even if there's a bug
        const uniqueOrgIds = new Set<number>()
        this.orgConfigs.forEach((_, orgId) => {
            uniqueOrgIds.add(orgId)
        })
        const result = Array.from(uniqueOrgIds)
        // Note: Map.size should always equal result.length since Map keys are unique
        // If they don't match, there's a critical bug (should never happen)
        return result
    }

    getContextPath(orgId: number): string | undefined {
        return this.contextPathMap.get(orgId)
    }

    private getOrCreate(orgId: number): OrgConfig {
        if (!this.orgConfigs.has(orgId)) {
            // logInfo(`[DEBUG] Creating new config entry for orgId: ${orgId} (type: ${typeof orgId})`).catch(() => {})
            this.orgConfigs.set(orgId, { orgId })
        }
        return this.orgConfigs.get(orgId)!
    }
}

export class OrganizationConfigService {
    private orgConfig: OrgConfigStore = new OrgConfigStore()
    private pool: PgPool | oracledb.Pool | null = null
    private dbType: 'postgres' | 'oracle' = 'postgres'
    private readonly blockSize = 16
    private readonly AES_KEY_SIZE = 256
    public readonly instanceId = Math.random().toString(36).substring(7)

    constructor() {}

    /**
     * Initialize PostgreSQL connection to main server
     * Uses environment variables (secure, not committed to version control)
     */
    async initialize(): Promise<void> {
        // Validate required environment variables
        const requiredEnvVars = ['MAIN_DB_HOST', 'MAIN_DB_DATABASE', 'MAIN_DB_USER', 'MAIN_DB_PASSWORD']

        const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}. Please check your .env file.`)
        }

        // Determine database type from environment
        this.dbType = process.env.MAIN_DB_TYPE?.toUpperCase() === 'ORACLE' ? 'oracle' : 'postgres'

        // Get license code for password decryption (if password is encrypted)
        const licenseCode = process.env.LICENSE_CODE
        let password = process.env.MAIN_DB_PASSWORD!

        // Decrypt password if it's encrypted (base64 format)
        if (password && password.length > 0 && licenseCode) {
            try {
                // Check if password is encrypted (base64 format)
                if (password.includes('=') && Buffer.from(password, 'base64').length > 0) {
                    password = this.decryptPassword(password, licenseCode)
                }
            } catch (error) {
                const errorContext: Record<string, any> =
                    error instanceof Error ? { error: error.message, stack: error.stack } : { error: String(error) }
                logWarn('Password decryption failed, using plain text password', errorContext).catch(() => {})
                // Continue with plain text password
            }
        }

        // Create database-specific connection pool
        if (this.dbType === 'oracle') {
            // Configure Oracle settings (matching autonomous_old pattern)
            ;(oracledb as any).fetchAsBuffer = [(oracledb as any).BLOB]
            ;(oracledb as any).fetchAsString = [(oracledb as any).CLOB]

            // Oracle connection with retry logic
            const connectString = OracleConnectionHelper.createConnectionString(
                process.env.MAIN_DB_HOST!,
                parseInt(process.env.MAIN_DB_PORT || '1521'),
                process.env.MAIN_DB_DATABASE!
            )

            try {
                this.pool = await OracleConnectionHelper.createPoolWithRetry(
                    {
                        host: process.env.MAIN_DB_HOST!,
                        port: parseInt(process.env.MAIN_DB_PORT || '1521'),
                        database: process.env.MAIN_DB_DATABASE!,
                        username: process.env.MAIN_DB_USER!,
                        password: password,
                        poolMin: 2,
                        poolMax: parseInt(process.env.DB_POOL_SIZE || '10'),
                        poolIncrement: 1,
                        poolTimeout: 60,
                        poolPingInterval: 60
                    },
                    {
                        maxRetries: 3,
                        retryDelay: 2000,
                        exponentialBackoff: true
                    }
                )

                // Test connection
                await OracleConnectionHelper.testPoolConnection(this.pool as oracledb.Pool)

                logInfo(`Main Oracle connection established (${connectString})`).catch(() => {})
            } catch (error) {
                const errorDetails = OracleConnectionHelper.getErrorDetails(error instanceof Error ? error : new Error(String(error)))
                logError(`Failed to establish Oracle connection: ${errorDetails.message}`, error).catch(() => {})
                logError(`Suggestion: ${errorDetails.suggestion}`).catch(() => {})
                throw error
            }
        } else {
            // PostgreSQL connection
            this.pool = new PgPool({
                host: process.env.MAIN_DB_HOST!,
                port: parseInt(process.env.MAIN_DB_PORT || '5432'),
                database: process.env.MAIN_DB_DATABASE!,
                user: process.env.MAIN_DB_USER!,
                password: password,
                max: parseInt(process.env.DB_POOL_SIZE || '10'),
                ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
            })

            // Test connection
            const client = await (this.pool as PgPool).connect()
            await client.query('SELECT 1')
            client.release()

            logInfo('Main PostgreSQL connection established').catch(() => {})
        }
    }

    /**
     * Execute query on appropriate database (PostgreSQL or Oracle)
     * Handles parameter syntax conversion and result normalization
     * Includes retry logic for Oracle connections
     */
    private async executeQuery(query: string, params: any[] = []): Promise<any> {
        if (this.dbType === 'oracle') {
            // Oracle: Convert $1, $2 to :1, :2 (matching autonomous_old pattern)
            const oracleQuery = query.replace(/\$(\d+)/g, ':$1')

            // Use retry logic for Oracle queries
            return await OracleConnectionHelper.executeWithRetry(this.pool as oracledb.Pool, oracleQuery, params)
        } else {
            // PostgreSQL
            return await (this.pool as PgPool).query(query, params)
        }
    }

    /**
     * Load all organization configurations at startup
     * Exact process from autonomous server
     */
    async loadAllOrganizations(): Promise<void> {
        try {
            logInfo('🚀 Starting organization configuration loading...').catch(() => {})

            // Step 1: Fetch Node Info (required first - populates getAllOrgIds())
            await this.fetchNodeInfo()

            // Steps 2-4: Execute in parallel (independent operations)
            // These can run concurrently since they don't depend on each other
            await Promise.all([this.fetchCouchDbDetails(), this.fetchPostgresDbDetails(), this.fetchRedisDetails()])

            // Step 5: Load Context Path Mappings (NON-BLOCKING)
            this.fetchOrgDeploymentInfo().catch((err) => {
                logWarn('Context path loading failed (non-blocking)', err).catch(() => {})
            })

            const finalOrgIds = this.orgConfig.getAllOrgIds()
            const uniqueFinalOrgIds = Array.from(new Set(finalOrgIds))
            if (finalOrgIds.length !== uniqueFinalOrgIds.length) {
                logWarn(
                    `⚠️ Found ${finalOrgIds.length} orgIds with ${uniqueFinalOrgIds.length} unique after loading: [${finalOrgIds.join(
                        ', '
                    )}]`
                ).catch(() => {})
            }
            logInfo(
                `✅ Successfully loaded ${uniqueFinalOrgIds.length} organization configurations: [${uniqueFinalOrgIds.join(', ')}]`
            ).catch(() => {})
        } catch (error) {
            logError('Failed to load organization configurations', error).catch(() => {})
            throw error
        }
    }

    /**
     * Step 1: Fetch Node Info (EXACT QUERY from autonomous server)
     */
    private async fetchNodeInfo(): Promise<void> {
        logInfo('🔍 Step 1: Fetching node info...').catch(() => {})

        const appBuilderShortCode = process.env.APPBUILDER_SHORT_CODE || 'BLDR'
        const appDesignerShortCode = process.env.APPDESIGNER_SHORT_CODE || 'DSNGR'
        const appPublisherShortCode = process.env.APPPUBLISHER_SHORT_CODE || 'APIGW'

        const shortCodes = [appDesignerShortCode, appBuilderShortCode, appPublisherShortCode, 'FILE']

        // EXACT QUERY from autonomous server
        const query = `
            SELECT INFO.GUID, INFO.SERVER_PORT, INFO.CONTEXT_PATH, INFO.HOST_NAME, INFO.PORT_NUMBER, 
                   INFO.ENTITY1, INFO.NODE_INSTALL_PATH, INFO.ENTITY3, INFO.ENTITY4, INFO.ENTITY5, 
                   INFO.ENTITY7, INFO.NODE_NAME, INFO.PROXY_HOST_NAME, INFO.IS_SSL_ENABLED, 
                   INFO.NODE_TYPE, A.ORGANIZATION_ID_S 
            FROM PFM_NODE_INFO INFO 
            JOIN PFM_NODE_ORG_APPS_A A ON INFO.NODE_ID = A.NODE_ID_P 
            WHERE A.APP_SHORT_CODE IN ($1, $2, $3, $4)
        `

        const result = await this.executeQuery(query, shortCodes)

        logInfo(`🔍 Found ${result.rows.length} node records`).catch(() => {})

        // Store only BUILDER nodes (exact logic from autonomous server)
        // NOTE: This populates getAllOrgIds() which is used in subsequent steps
        // Use Set to track processed orgIds to prevent duplicates
        const processedOrgIds = new Set<number>()
        result.rows.forEach((row: any) => {
            const isBuilder = row.node_type?.toUpperCase() === appBuilderShortCode.toUpperCase()

            if (isBuilder) {
                const orgId = parseInt(row.organization_id_s)
                // Skip if already processed (prevent duplicate orgIds)
                if (processedOrgIds.has(orgId)) {
                    logDebug(`Skipping duplicate BUILDER node for orgId ${orgId}`).catch(() => {})
                    return
                }
                processedOrgIds.add(orgId)

                // Store node info - this adds orgId to getAllOrgIds() list
                this.orgConfig.setNodeInfo(orgId, {
                    guid: row.guid,
                    serverPort: row.server_port,
                    contextPath: row.context_path,
                    hostName: row.host_name,
                    portNumber: row.port_number,
                    entity1: row.entity1,
                    nodeInstallPath: row.node_install_path,
                    entity3: row.entity3,
                    entity4: row.entity4,
                    entity5: row.entity5,
                    entity7: row.entity7,
                    nodeName: row.node_name,
                    proxyHostName: row.proxy_host_name,
                    isSslEnabled: row.is_ssl_enabled,
                    nodeType: row.node_type
                })
            }

            // Process designer info (exact logic from autonomous server)
            // Designer info is stored separately (doesn't populate getAllOrgIds())
            const isDesigner = row.node_type === appDesignerShortCode
            if (isDesigner) {
                const orgId = parseInt(row.organization_id_s)
                this.orgConfig.setDesignerInfo(orgId, {
                    is_ssl_enabled: row.is_ssl_enabled,
                    dsngr_host_name: row.host_name,
                    dsngrproxy_host_name: row.proxy_host_name,
                    app_designer_port: row.server_port,
                    app_designer_path: row.context_path || '/designer',
                    node_name: row.node_name,
                    node_type: row.node_type
                })
            }
        })

        // After storing BUILDER nodes, getAllOrgIds() is populated
        // This list is used in subsequent steps to iterate through orgs

        const storedOrgIds = this.orgConfig.getAllOrgIds()
        logInfo(`✅ Stored ${storedOrgIds.length} BUILDER organizations: [${storedOrgIds.join(', ')}]`).catch(() => {})
    }

    /**
     * Step 2: Fetch CouchDB Details (EXACT QUERY from autonomous server)
     * NOTE: Autonomous server uses direct string interpolation for orgId (not parameterized)
     */
    private async fetchCouchDbDetails(): Promise<void> {
        logInfo('🛋️ Step 2: Fetching CouchDB details...').catch(() => {})

        // Get orgIds from node info (already loaded in step 1)
        const orgIds = this.orgConfig.getAllOrgIds()
        // Remove duplicates as safety measure
        const uniqueOrgIds = Array.from(new Set(orgIds))
        const processedOrgIds = new Set<number>()

        if (orgIds.length !== uniqueOrgIds.length) {
            logWarn(
                `⚠️ Found ${orgIds.length} orgIds with ${uniqueOrgIds.length} unique in fetchCouchDbDetails: [${orgIds.join(
                    ', '
                )}] -> [${uniqueOrgIds.join(', ')}]`
            ).catch(() => {})
        }

        const couchDbConfigs = []

        // EXACT QUERY from autonomous server - executed for each org in parallel
        // NOTE: Uses direct string interpolation for orgId (as in autonomous server)
        const couchDbPromises = uniqueOrgIds.map(async (orgId) => {
            // Skip if already processed (defensive check)
            if (processedOrgIds.has(orgId)) {
                logWarn(`⚠️ Skipping duplicate CouchDB config fetch for orgId ${orgId}`).catch(() => {})
                return []
            }
            processedOrgIds.add(orgId)
            // Oracle-compatible query: Use fully qualified column names and proper table aliases
            const query = `
                SELECT A.host_name, A.port, A.user_name, A.password, A.service_name, A.proxy_pass, A.org_id, 
                       A.client_username, A.client_password, B.code as license_code
                FROM pfm_org_data_store_info A, PFM_LICENSES B 
                WHERE A.org_id = ${orgId} 
                AND A.db_type = 'COUCH' 
                AND A.org_id = B.ORGANIZATION_ID
            `

            const result = await this.executeQuery(query)
            return result.rows
        })

        const couchDbResults = await Promise.all(couchDbPromises)
        couchDbConfigs.push(...couchDbResults.flat())

        logInfo(`🔍 Found ${couchDbConfigs.length} CouchDB configuration rows`).catch(() => {})

        // Process each organization (exact logic from autonomous server)
        // Use Set to track processed orgIds to prevent duplicates
        const processedCouchDbOrgIds = new Set<number>()
        for (const row of couchDbConfigs) {
            const orgId = parseInt(row.org_id) // Ensure it's a number
            const licenseCode = row.license_code

            // Skip if already processed (prevent duplicate processing)
            if (processedCouchDbOrgIds.has(orgId)) {
                logWarn(`⚠️ Skipping duplicate CouchDB config for orgId ${orgId} (already processed)`).catch(() => {})
                continue
            }
            processedCouchDbOrgIds.add(orgId)

            // Decrypt password using license code (exact method from autonomous server)
            const decryptedPassword = this.decryptPassword(row.password, licenseCode)

            // Store CouchDB config (exact structure from autonomous server)
            // NOTE: Uses proxy_pass as URL (exact logic from autonomous server)
            this.orgConfig.setCouchDbConfig(orgId, {
                host: row.host_name,
                port: row.port,
                username: row.user_name,
                password: decryptedPassword,
                database: row.service_name,
                proxyPass: row.proxy_pass, // Use proxy_pass for connection
                clientUsername: row.client_username,
                clientPassword: row.client_password,
                protocol: 'https', // Hardcoded as in autonomous server
                url: row.proxy_pass, // Use proxy_pass as URL
                enabled: true
            })

            // Store license
            this.orgConfig.setLicense(orgId, licenseCode)

            logInfo(`✅ CouchDB config stored for orgId: ${orgId}`).catch(() => {})
        }

        logInfo(`✅ Processed ${processedCouchDbOrgIds.size} unique organization(s) with CouchDB configurations`).catch(() => {})
    }

    /**
     * Step 3: Fetch PostgreSQL Details (EXACT QUERY from autonomous server)
     */
    private async fetchPostgresDbDetails(): Promise<void> {
        logInfo('🐘 Step 3: Fetching PostgreSQL DB details...').catch(() => {})

        const orgIds = this.orgConfig.getAllOrgIds()
        // Remove duplicates as safety measure
        const uniqueOrgIds = Array.from(new Set(orgIds))
        const processedOrgIds = new Set<number>()

        if (orgIds.length !== uniqueOrgIds.length) {
            logWarn(
                `⚠️ Found ${orgIds.length} orgIds with ${uniqueOrgIds.length} unique in fetchPostgresDbDetails: [${orgIds.join(
                    ', '
                )}] -> [${uniqueOrgIds.join(', ')}]`
            ).catch(() => {})
        }

        const dbType = (process.env.MAIN_DB_TYPE || 'POSTGRES').toUpperCase()
        const appBuilderShortCode = process.env.APPBUILDER_SHORT_CODE || 'BLDR'

        // EXACT LOGIC from autonomous server: execute queries in parallel for all orgs
        const postgresPromises = uniqueOrgIds.map(async (orgId) => {
            // Skip if already processed (defensive check)
            if (processedOrgIds.has(orgId)) {
                logWarn(`⚠️ Skipping duplicate PostgreSQL config fetch for orgId ${orgId}`).catch(() => {})
                return null
            }
            processedOrgIds.add(orgId)
            // Oracle-compatible query: Use ROW_NUMBER() instead of DISTINCT ON, and fully qualify all columns
            const query =
                this.dbType === 'oracle'
                    ? `
                SELECT host_name, port, user_name, password, service_name, org_id, db_type, 
                       license_code, max_pool_size
                FROM (
                    SELECT DBINFO.host_name, DBINFO.port, DBINFO.user_name, DBINFO.password, 
                           DBINFO.service_name, DBINFO.org_id, DBINFO.db_type, 
                           LICENSE.code as license_code, DBPOOLINFO.max_pool_size,
                           ROW_NUMBER() OVER (PARTITION BY DBINFO.org_id ORDER BY DBPOOLINFO.max_pool_size DESC) as rn
                    FROM pfm_org_database_info DBINFO, PFM_LICENSES LICENSE, pfm_org_apps_db_pool_info DBPOOLINFO 
                    WHERE DBINFO.org_id = :1 
                    AND DBINFO.db_type = :2 
                    AND DBINFO.org_id = LICENSE.ORGANIZATION_ID 
                    AND DBPOOLINFO.org_database_info_id = DBINFO.org_database_info_id 
                    AND DBPOOLINFO.app_short_code = :3
                ) WHERE rn = 1
            `
                    : `
                SELECT DISTINCT ON (DBINFO.org_id) 
                       DBINFO.host_name, DBINFO.port, DBINFO.user_name, DBINFO.password, 
                       DBINFO.service_name, DBINFO.org_id, DBINFO.db_type, 
                       LICENSE.code as license_code, DBPOOLINFO.max_pool_size
                FROM pfm_org_database_info DBINFO, PFM_LICENSES LICENSE, pfm_org_apps_db_pool_info DBPOOLINFO 
                WHERE DBINFO.org_id = $1 
                AND DBINFO.db_type = $2 
                AND DBINFO.org_id = LICENSE.ORGANIZATION_ID 
                AND DBPOOLINFO.org_database_info_id = DBINFO.org_database_info_id 
                AND DBPOOLINFO.app_short_code = $3
                ORDER BY DBINFO.org_id, DBPOOLINFO.max_pool_size DESC
            `

            const result = await this.executeQuery(query, [orgId, dbType, appBuilderShortCode])

            if (result.rows.length > 0) {
                // Match autonomous server: use first row only (result.rows[0])
                const row = result.rows[0]
                const licenseCode = row.license_code

                // Decrypt password using license code
                const decryptedPassword = this.decryptPassword(row.password, licenseCode)

                // Store database config (exact structure from autonomous server)
                // Match autonomous server: always store (no duplicate check needed as query returns unique rows)
                this.orgConfig.setPlatformDBConfig(orgId, {
                    host: row.host_name,
                    port: row.port,
                    username: row.user_name,
                    password: decryptedPassword,
                    database: row.service_name,
                    maxPoolSize: row.max_pool_size || 10,
                    minPoolSize: 2,
                    dbType: row.db_type
                })

                logInfo(`✅ Stored PostgreSQL config for orgId ${orgId}`).catch(() => {})
                return { orgId, success: true }
            } else {
                logWarn(`⚠️ No PostgreSQL config found for orgId ${orgId}`).catch(() => {})
                return { orgId, success: false }
            }
        })

        await Promise.all(postgresPromises)
    }

    /**
     * Step 4: Fetch Redis Details (EXACT QUERY from autonomous server)
     */
    private async fetchRedisDetails(): Promise<void> {
        logInfo('🔴 Step 4: Fetching Redis cache details...').catch(() => {})

        const orgIds = this.orgConfig.getAllOrgIds()

        // Remove duplicates to prevent processing same orgId multiple times
        // This is a safety measure in case getAllOrgIds() somehow returns duplicates
        const uniqueOrgIds = Array.from(new Set(orgIds))
        const processedOrgIds = new Set<number>()

        if (orgIds.length !== uniqueOrgIds.length) {
            logError(
                `❌ CRITICAL: getAllOrgIds() returned ${orgIds.length} orgIds with ${uniqueOrgIds.length} unique: [${orgIds.join(
                    ', '
                )}] -> [${uniqueOrgIds.join(', ')}]`
            ).catch(() => {})
            logError(`❌ This should never happen - Map keys are unique!`).catch(() => {})
        }

        // EXACT LOGIC from autonomous server: execute queries in parallel for all orgs
        const redisPromises = uniqueOrgIds.map(async (orgId) => {
            // Skip if already processed (defensive check)
            if (processedOrgIds.has(orgId)) {
                logError(`❌ CRITICAL: Attempted to process orgId ${orgId} twice in fetchRedisDetails!`).catch(() => {})
                return null
            }
            processedOrgIds.add(orgId)

            // EXACT QUERY from autonomous server (no DISTINCT ON, simpler query)
            const query = `
                SELECT HOST_NAME, PORT, POOL_SIZE, PASSWORD, ORG_ID, 1 AS DATABASE
                FROM PFM_ORG_CACHE_INFO 
                WHERE ORG_ID = ${this.dbType.toLowerCase() === 'postgres' ? `$1` : `:1`}
            `

            logInfo(`🔴 Fetching Redis details for orgId: ${orgId}`).catch(() => {})
            const result = await this.executeQuery(query, [orgId])

            if (result.rows.length > 0) {
                // Match autonomous server: use first row only (result.rows[0])
                const row = result.rows[0]

                logInfo(`🔴 Found Redis config for orgId ${orgId}: ${row.host_name}:${row.port}`).catch(() => {})

                // Get license code from orgConfig (stored in CouchDB step)
                const licenseCode = this.orgConfig.getOrgConfig(orgId)?.license

                // Decrypt password using license code if password exists
                // EXACT LOGIC from autonomous server
                let decryptedPassword = ''
                if (row.password && row.password.length > 0) {
                    if (licenseCode && typeof licenseCode === 'string') {
                        try {
                            decryptedPassword = this.decryptPassword(row.password, licenseCode)
                            logInfo(`🔓 Decrypted Redis password for orgId ${orgId}`).catch(() => {})
                        } catch (error) {
                            logWarn(
                                `⚠️ Failed to decrypt Redis password for orgId ${orgId}, using empty password: ${
                                    error instanceof Error ? error.message : String(error)
                                }`
                            ).catch(() => {})
                            decryptedPassword = ''
                        }
                    } else {
                        logWarn(`⚠️ No valid license code found for orgId ${orgId}, using empty password`).catch(() => {})
                        decryptedPassword = ''
                    }
                }

                // Store Redis config in memory (exact structure from autonomous server)
                // Only store once per orgId (setRedisConfig will overwrite if exists)
                this.orgConfig.setRedisConfig(orgId, {
                    host: row.host_name,
                    port: row.port,
                    poolSize: row.pool_size,
                    password: decryptedPassword,
                    database: row.database
                })

                logInfo(`✅ Stored Redis config for orgId ${orgId}`).catch(() => {})
                return { orgId, success: true }
            } else {
                logWarn(`⚠️ No Redis config found for orgId ${orgId}`).catch(() => {})
                return { orgId, success: false }
            }
        })

        await Promise.all(redisPromises)

        // Log using uniqueOrgIds.length, not orgIds.length (which may have duplicates)
        logInfo(`✅ Fetched Redis details for ${uniqueOrgIds.length} unique organization(s)`).catch(() => {})
    }

    /**
     * Step 5: Fetch Context Path Mappings (EXACT QUERY from autonomous server)
     * NON-BLOCKING - failures don't stop startup
     */
    private async fetchOrgDeploymentInfo(): Promise<void> {
        try {
            logInfo('🔍 Loading organization context path mappings...').catch(() => {})

            // EXACT QUERY from autonomous server
            const query = `
                SELECT org_id, login_url_context
                FROM org_deployment 
                WHERE app_type = 'agent'
            `

            const result = await this.executeQuery(query)

            if (result && result.rows) {
                let successCount = 0
                for (const row of result.rows) {
                    try {
                        const orgId = parseInt(row.org_id)
                        const contextPath = row.login_url_context

                        if (orgId && contextPath) {
                            this.orgConfig.setContextPath(orgId, contextPath)
                            successCount++
                        }
                    } catch (rowError) {
                        const errorContext: Record<string, any> =
                            rowError instanceof Error ? { error: rowError.message, stack: rowError.stack } : { error: String(rowError) }
                        logWarn('Error processing org deployment row', errorContext).catch(() => {})
                    }
                }

                logInfo(`✅ Loaded ${successCount} context path mappings`).catch(() => {})
            }
        } catch (error) {
            // NEVER throw - just log warning (NON-BLOCKING)
            const errorContext: Record<string, any> =
                error instanceof Error ? { error: error.message, stack: error.stack } : { error: String(error) }
            logWarn('Failed to load context path mappings - validation will be skipped', errorContext).catch(() => {})
        }
    }

    /**
     * Decrypt password using license code (EXACT METHOD from autonomous server)
     */
    private decryptPassword(encryptedPassword: string, licenseCode: string): string {
        try {
            if (!encryptedPassword || typeof encryptedPassword !== 'string') {
                return ''
            }
            if (!licenseCode || typeof licenseCode !== 'string') {
                return encryptedPassword
            }

            const privateKey = licenseCode + licenseCode
            const concatenatedBuffer = Buffer.from(encryptedPassword, 'base64')
            const encryptedDatas = concatenatedBuffer.subarray(0, concatenatedBuffer.length - this.blockSize)
            const authTags = concatenatedBuffer.subarray(concatenatedBuffer.length - this.blockSize)
            const iv = Buffer.from(privateKey, 'utf8')
            const key = crypto.pbkdf2Sync(privateKey + privateKey, privateKey + privateKey, 65536, this.AES_KEY_SIZE / 8, 'sha256')
            const decipher = crypto.createDecipheriv('aes-256-gcm', key as any, iv as any)
            decipher.setAuthTag(authTags as any)
            const updateResult = decipher.update(encryptedDatas as any) as any
            const finalResult = decipher.final() as any
            const decryptedData = Buffer.concat([updateResult, finalResult] as any)
            return decryptedData.toString('utf8')
        } catch (err) {
            logWarn(`Decryption failed (using plain text instead): ${err}`).catch(() => {})
            return encryptedPassword
        }
    }

    /**
     * Get organization configuration by ID
     */
    getOrgConfig(orgId: number): OrgConfig | undefined {
        return this.orgConfig.getOrgConfig(orgId)
    }

    /**
     * Check if organization exists
     */
    hasOrg(orgId: number): boolean {
        return this.orgConfig.getOrgConfig(orgId) !== undefined
    }

    /**
     * Get all organization IDs
     */
    getAllOrgIds(): number[] {
        return this.orgConfig.getAllOrgIds()
    }

    /**
     * Get context path for organization
     */
    getContextPath(orgId: number): string | undefined {
        return this.orgConfig.getContextPath(orgId) || process.env.CONTEXT_PATH || '/autonomous'
    }

    /**
     * Get connection pool status (Oracle only)
     */
    getPoolStatus(): { dbType: string; isConnected: boolean } {
        return {
            dbType: this.dbType,
            isConnected: this.pool !== null
        }
    }

    /**
     * Health check for database connection
     */
    async healthCheck(): Promise<{
        healthy: boolean
        message: string
        dbType: string
        poolStatus?: any
    }> {
        if (!this.pool) {
            return {
                healthy: false,
                message: 'Database connection pool is not initialized',
                dbType: this.dbType
            }
        }

        if (this.dbType === 'oracle') {
            const healthResult = await OracleConnectionHelper.healthCheck(this.pool as oracledb.Pool)
            const poolStatus = await OracleConnectionHelper.getPoolStatus(this.pool as oracledb.Pool)
            return {
                healthy: healthResult.healthy,
                message: healthResult.message,
                dbType: this.dbType,
                poolStatus
            }
        } else {
            // PostgreSQL health check
            try {
                const client = await (this.pool as PgPool).connect()
                await client.query('SELECT 1')
                client.release()
                return {
                    healthy: true,
                    message: 'PostgreSQL connection pool is healthy',
                    dbType: this.dbType
                }
            } catch (error) {
                return {
                    healthy: false,
                    message: `PostgreSQL connection health check failed: ${error instanceof Error ? error.message : String(error)}`,
                    dbType: this.dbType
                }
            }
        }
    }

    /**
     * Get connection pool monitoring information
     */
    async getPoolMonitoring(): Promise<any> {
        if (!this.pool) {
            return { error: 'Connection pool is not initialized' }
        }

        if (this.dbType === 'oracle') {
            return await OracleConnectionHelper.getPoolStatus(this.pool as oracledb.Pool)
        } else {
            // PostgreSQL pool stats
            const pgPool = this.pool as PgPool
            return {
                totalCount: pgPool.totalCount,
                idleCount: pgPool.idleCount,
                waitingCount: pgPool.waitingCount
            }
        }
    }

    /**
     * Close database connection
     */
    async close(): Promise<void> {
        if (this.pool) {
            if (this.dbType === 'oracle') {
                try {
                    await (this.pool as oracledb.Pool).close()
                    logInfo('Oracle connection pool closed successfully').catch(() => {})
                } catch (error) {
                    logError('Error closing Oracle connection pool:', error).catch(() => {})
                }
            } else {
                try {
                    await (this.pool as PgPool).end()
                    logInfo('PostgreSQL connection pool closed successfully').catch(() => {})
                } catch (error) {
                    logError('Error closing PostgreSQL connection pool:', error).catch(() => {})
                }
            }
            this.pool = null
        }
    }
}
