import 'reflect-metadata'
import dotenv from 'dotenv'
import path from 'path'
import { DataSource } from 'typeorm'

// Load .env file BEFORE importing entities to ensure environment variables are available
// when entity classes are evaluated (e.g., when getTextColumnType() is called)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), override: true })

import { entities } from './database/entities'
import { logInfo, logError, logWarn } from './utils/logger/system-helper'
import { OrganizationConfigService } from './services/org-config.service'
import { getDatabaseSSLFromEnv } from './DataSource'
import { createDatabaseSchema } from './database/schema/startup-schema'
import { OracleConnectionHelper } from './utils/oracle-connection-helper'
import { OracleNamingStrategy } from './database/utils/oracle-naming-strategy'

export class DataSourceManager {
    private dataSources: Map<number, DataSource> = new Map()
    private orgConfigService: OrganizationConfigService | null = null
    private isInitialized = false

    /**
     * Initialize all organization DataSources at startup
     * Uses orgConfig.platformDB configuration from OrganizationConfigService
     */
    async initializeAllOrgDataSources(orgConfigService: OrganizationConfigService): Promise<void> {
        this.orgConfigService = orgConfigService
        const orgIds = orgConfigService.getAllOrgIds()
        const uniqueOrgIds = Array.from(new Set(orgIds))

        if (uniqueOrgIds.length === 0) {
            logWarn('⚠️ [DataSourceManager]: No organizations found to initialize DataSources').catch(() => {})
            return
        }

        logInfo(`🔌 [DataSourceManager]: Initializing DataSources for ${uniqueOrgIds.length} organizations...`).catch(() => {})

        const useLocalDb = process.env.USE_LOCAL_DB === 'true'
        if (useLocalDb) {
            logWarn('⚠️ [DataSourceManager]: USING LOCAL DATABASE OVERRIDE - This is for testing only!').catch(() => {})
        }

        const initializationPromises = uniqueOrgIds.map(async (orgId) => {
            try {
                const orgConfig = orgConfigService.getOrgConfig(orgId)
                if (!orgConfig?.platformDB) {
                    logWarn(`⚠️ [DataSourceManager]: No platformDB config found for orgId ${orgId}, skipping`).catch(() => {})
                    return { orgId, success: false, error: 'No platformDB config' }
                }

                const platformDB = orgConfig.platformDB

                // Apply local database override if enabled
                let dbConfig: any
                if (useLocalDb) {
                    dbConfig = {
                        host: process.env.LOCAL_DB_HOST || 'localhost',
                        port: parseInt(process.env.LOCAL_DB_PORT || '5432'),
                        username: process.env.LOCAL_DB_USER || 'chainsys',
                        password: process.env.LOCAL_DB_PASSWORD || '',
                        database: process.env.LOCAL_DB_DATABASE || 'autonomous',
                        maxPoolSize: parseInt(process.env.LOCAL_DB_MAX_POOL_SIZE || '10')
                    }
                    logInfo(`🔧 [DataSourceManager]: Using LOCAL database override for orgId ${orgId}: ${dbConfig.database}`).catch(
                        () => {}
                    )
                } else {
                    dbConfig = {
                        host: platformDB.host,
                        port: platformDB.port,
                        username: platformDB.username,
                        password: platformDB.password,
                        database: platformDB.database,
                        maxPoolSize: platformDB.maxPoolSize || 10,
                        dbType: platformDB.dbType
                    }
                }

                // Determine database type (default to postgres for backward compatibility with existi            ng configs)
                const dbType = dbConfig.dbType?.toUpperCase() === 'ORACLE' ? 'oracle' : 'postgres'

                // Create database-specific DataSource configuration
                const dataSourceConfig: any = {
                    type: dbType,
                    host: dbConfig.host,
                    port: dbConfig.port,
                    username: dbConfig.username,
                    password: dbConfig.password,
                    synchronize: false,
                    migrationsRun: false,
                    entities: Object.values(entities),
                    logging: ['error', 'warn'],
                    logger: 'advanced-console'
                }

                // Add database-specific configuration
                if (dbType === 'oracle') {
                    // Oracle-specific configuration
                    dataSourceConfig.sid = dbConfig.database // Use SID (can also use serviceName)
                    dataSourceConfig.extra = {
                        poolMin: 2,
                        poolMax: dbConfig.maxPoolSize,
                        poolIncrement: 1,
                        poolTimeout: 60
                    }
                    // Use custom naming strategy to convert table/column names to uppercase for Oracle
                    // This ensures TypeORM queries use uppercase table names that match Oracle's unquoted identifier storage
                    dataSourceConfig.namingStrategy = new OracleNamingStrategy(true)
                    logInfo(
                        `🔧 [DataSourceManager]: Configuring Oracle connection for orgId ${orgId}: ${dbConfig.database} (with uppercase naming strategy)`
                    ).catch(() => {})
                } else {
                    // PostgreSQL-specific configuration
                    dataSourceConfig.database = dbConfig.database
                    dataSourceConfig.ssl = getDatabaseSSLFromEnv()
                    dataSourceConfig.extra = {
                        idleTimeoutMillis: 120000,
                        max: dbConfig.maxPoolSize,
                        min: 2
                    }
                    dataSourceConfig.logNotifications = true
                    dataSourceConfig.poolErrorHandler = (err: any) => {
                        logError(`[DataSourceManager] Database pool error for orgId ${orgId}: ${JSON.stringify(err)}`).catch(() => {})
                    }
                    dataSourceConfig.applicationName = `Autonomous-Org-${orgId}`
                    logInfo(`🔧 [DataSourceManager]: Configuring PostgreSQL connection for orgId ${orgId}: ${dbConfig.database}`).catch(
                        () => {}
                    )
                }

                // Create DataSource with appropriate configuration
                const dataSource = new DataSource(dataSourceConfig)

                // Initialize connection with retry logic for Oracle
                if (dbType === 'oracle') {
                    await this.initializeDataSourceWithRetry(dataSource, orgId, dbConfig.database)
                } else {
                    await dataSource.initialize()
                }

                // Validate connection before storing
                await this.validateDataSourceConnection(dataSource, dbType, orgId)

                const dbTypeName = dbType === 'oracle' ? 'Oracle' : 'PostgreSQL'
                logInfo(`✅ [DataSourceManager]: Connected to ${dbTypeName} for orgId ${orgId} (${dbConfig.database})`).catch(() => {})

                // Create all tables and columns at startup (if enabled via ENABLE_TABLE_CREATION flag)
                const enableTableCreation = process.env.ENABLE_TABLE_CREATION === 'true'
                if (enableTableCreation) {
                    try {
                        await createDatabaseSchema(dataSource, orgId)
                        logInfo(`✅ [DataSourceManager]: Schema creation completed for orgId ${orgId}`).catch(() => {})
                    } catch (schemaError) {
                        logError(`❌ [DataSourceManager]: Schema creation failed for orgId ${orgId}:`, schemaError).catch(() => {})
                        // Continue - don't fail startup if schema creation fails
                    }
                } else {
                    logInfo(
                        `⏭️  [DataSourceManager]: Table creation skipped for orgId ${orgId} (ENABLE_TABLE_CREATION not set or false)`
                    ).catch(() => {})
                }

                // Store DataSource
                this.dataSources.set(orgId, dataSource)
                return { orgId, success: true }
            } catch (error) {
                logError(`❌ [DataSourceManager]: Failed to initialize DataSource for orgId ${orgId}:`, error).catch(() => {})
                // Continue with other orgs - don't fail startup
                return { orgId, success: false, error: error instanceof Error ? error.message : String(error) }
            }
        })

        const results = await Promise.all(initializationPromises)
        const successCount = results.filter((r) => r.success).length
        const failureCount = results.filter((r) => !r.success).length

        this.isInitialized = true
        logInfo(`✅ [DataSourceManager]: Initialized ${successCount} DataSources successfully, ${failureCount} failed`).catch(() => {})

        if (failureCount > 0) {
            const failedOrgs = results.filter((r) => !r.success).map((r) => r.orgId)
            logWarn(`⚠️ [DataSourceManager]: Failed to initialize DataSources for orgIds: [${failedOrgs.join(', ')}]`).catch(() => {})
        }
    }

    /**
     * Initialize DataSource for a single organization
     */
    async initializeOrgDataSource(orgIdInput: number | string): Promise<{ orgId: number; success: boolean; error?: string }> {
        // Normalize orgId to number for consistent map storage
        const orgId = typeof orgIdInput === 'string' ? parseInt(orgIdInput, 10) : Number(orgIdInput)
        if (isNaN(orgId)) {
            return { orgId: 0, success: false, error: `Invalid orgId: ${orgIdInput} (cannot convert to number)` }
        }

        try {
            if (!this.orgConfigService) {
                throw new Error('OrganizationConfigService not initialized')
            }

            // Check if already initialized
            if (this.dataSources.has(orgId) && this.dataSources.get(orgId)?.isInitialized) {
                return { orgId, success: true }
            }

            let orgConfig = this.orgConfigService.getOrgConfig(orgId)

            if (!orgConfig?.platformDB) {
                // Try to reload config for all orgs if not found
                await this.orgConfigService.loadAllOrganizations()

                orgConfig = this.orgConfigService.getOrgConfig(orgId)

                if (!orgConfig?.platformDB) {
                    logWarn(`⚠️ [DataSourceManager]: No platformDB config found for orgId ${orgId}, skipping`).catch(() => {})
                    return { orgId, success: false, error: 'No platformDB config' }
                }
            }

            const platformDB = orgConfig.platformDB

            // Get dbConfig (either from local override or platformDB)
            let dbConfig: any
            const useLocalDb = process.env.USE_LOCAL_DB === 'true'
            if (useLocalDb) {
                dbConfig = {
                    host: process.env.LOCAL_DB_HOST || 'localhost',
                    port: parseInt(process.env.LOCAL_DB_PORT || '5432'),
                    username: process.env.LOCAL_DB_USER || 'chainsys',
                    password: process.env.LOCAL_DB_PASSWORD || '',
                    database: process.env.LOCAL_DB_DATABASE || 'autonomous',
                    maxPoolSize: parseInt(process.env.LOCAL_DB_MAX_POOL_SIZE || '10'),
                    dbType: 'postgres'
                }
                logInfo(`🔧 [DataSourceManager]: Using LOCAL database override for orgId ${orgId}: ${dbConfig.database}`).catch(() => {})
            } else {
                dbConfig = {
                    host: platformDB.host,
                    port: platformDB.port,
                    username: platformDB.username,
                    password: platformDB.password,
                    database: platformDB.database,
                    maxPoolSize: platformDB.maxPoolSize || 10,
                    dbType: platformDB.dbType
                }
            }

            // Determine database type (default to postgres for backward compatibility with existing configs)
            const dbType = dbConfig.dbType?.toUpperCase() === 'ORACLE' ? 'oracle' : 'postgres'

            // Create DataSource configuration
            const dataSourceConfig: any = {
                type: dbType,
                host: dbConfig.host,
                port: dbConfig.port,
                username: dbConfig.username,
                password: dbConfig.password,
                synchronize: false,
                migrationsRun: false,
                entities: Object.values(entities),
                logging: ['error', 'warn'],
                logger: 'advanced-console'
            }

            // Add database-specific configuration
            if (dbType === 'oracle') {
                // Oracle-specific configuration
                dataSourceConfig.sid = dbConfig.database // Use SID (can also use serviceName)
                dataSourceConfig.extra = {
                    poolMin: 2,
                    poolMax: dbConfig.maxPoolSize,
                    poolIncrement: 1,
                    poolTimeout: 60
                }
                // Use custom naming strategy to convert table/column names to uppercase for Oracle
                // This ensures TypeORM queries use uppercase table names that match Oracle's unquoted identifier storage
                dataSourceConfig.namingStrategy = new OracleNamingStrategy(true)
                logInfo(
                    `🔧 [DataSourceManager]: Configuring Oracle connection for orgId ${orgId}: ${dbConfig.database} (with uppercase naming strategy)`
                ).catch(() => {})
            } else {
                // PostgreSQL-specific configuration
                dataSourceConfig.database = dbConfig.database
                dataSourceConfig.ssl = getDatabaseSSLFromEnv()
                dataSourceConfig.extra = {
                    idleTimeoutMillis: 120000,
                    max: dbConfig.maxPoolSize,
                    min: 2
                }
                dataSourceConfig.logNotifications = true
                dataSourceConfig.poolErrorHandler = (err: any) => {
                    logError(`[DataSourceManager] Database pool error for orgId ${orgId}: ${JSON.stringify(err)}`).catch(() => {})
                }
                dataSourceConfig.applicationName = `Autonomous-Org-${orgId}`
                logInfo(`🔧 [DataSourceManager]: Configuring PostgreSQL connection for orgId ${orgId}: ${dbConfig.database}`).catch(
                    () => {}
                )
            }

            // Create DataSource with appropriate configuration
            const dataSource = new DataSource(dataSourceConfig)

            // Initialize connection with retry logic for Oracle
            if (dbType === 'oracle') {
                await this.initializeDataSourceWithRetry(dataSource, orgId, dbConfig.database)
            } else {
                await dataSource.initialize()
            }

            // Validate connection before storing
            await this.validateDataSourceConnection(dataSource, dbType, orgId)

            const dbTypeName = dbType === 'oracle' ? 'Oracle' : 'PostgreSQL'
            logInfo(`✅ [DataSourceManager]: Connected to ${dbTypeName} for orgId ${orgId} (${dbConfig.database})`).catch(() => {})

            // Create all tables and columns at startup (if enabled via ENABLE_TABLE_CREATION flag)
            const enableTableCreation = process.env.ENABLE_TABLE_CREATION === 'true'
            if (enableTableCreation) {
                try {
                    await createDatabaseSchema(dataSource, orgId)
                    logInfo(`✅ [DataSourceManager]: Schema creation completed for orgId ${orgId}`).catch(() => {})
                } catch (schemaError) {
                    logError(`❌ [DataSourceManager]: Schema creation failed for orgId ${orgId}:`, schemaError).catch(() => {})
                    // Continue - don't fail startup if schema creation fails
                }
            } else {
                logInfo(
                    `⏭️  [DataSourceManager]: Table creation skipped for orgId ${orgId} (ENABLE_TABLE_CREATION not set or false)`
                ).catch(() => {})
            }

            // Verify DataSource is initialized before storing
            if (!dataSource.isInitialized) {
                const errorMsg = `DataSource for orgId ${orgId} is not initialized after initialize() call`
                logError(`❌ [DataSourceManager]: ${errorMsg}`).catch(() => {})
                throw new Error(errorMsg)
            }

            // Store DataSource
            this.dataSources.set(orgId, dataSource)
            logInfo(`✅ [DataSourceManager]: DataSource stored for orgId ${orgId} (isInitialized: ${dataSource.isInitialized})`).catch(
                () => {}
            )
            return { orgId, success: true }
        } catch (error) {
            logError(`❌ [DataSourceManager]: Failed to initialize DataSource for orgId ${orgId}:`, error).catch(() => {})
            return { orgId, success: false, error: error instanceof Error ? error.message : String(error) }
        }
    }

    /**
     * Ensure DataSource is initialized for an organization
     * If not found, attempts to initialize it
     */
    async ensureDataSourceInitialized(orgId: number | string): Promise<DataSource> {
        // Normalize orgId to number for consistent map lookups
        const numericOrgId = typeof orgId === 'string' ? parseInt(orgId, 10) : Number(orgId)
        if (isNaN(numericOrgId)) {
            throw new Error(`Invalid orgId: ${orgId} (cannot convert to number)`)
        }

        // Check if DataSource exists and is initialized
        const existingDataSource = this.dataSources.get(numericOrgId)
        if (existingDataSource && existingDataSource.isInitialized) {
            return existingDataSource
        }

        logInfo(`🔄 [DataSourceManager]: DataSource for orgId ${numericOrgId} not found, attempting to initialize...`).catch(() => {})

        // Ensure orgConfigService is set
        if (!this.orgConfigService) {
            logError(
                `❌ [DataSourceManager]: orgConfigService is not set. This usually means initializeAllOrgDataSources() was not called with an orgConfigService instance.`
            ).catch(() => {})
            throw new Error(
                `OrganizationConfigService not initialized. Cannot initialize DataSource for orgId ${numericOrgId}. Make sure initializeAllOrgDataSources() was called first.`
            )
        }

        const result = await this.initializeOrgDataSource(numericOrgId)

        if (!result.success) {
            const errorMsg = result.error || 'Unknown error'
            logError(`❌ [DataSourceManager]: Failed to initialize DataSource for orgId ${numericOrgId}: ${errorMsg}`).catch(() => {})
            throw new Error(`Failed to initialize DataSource for orgId ${numericOrgId}: ${errorMsg}`)
        }

        // Get the DataSource after initialization - use numericOrgId consistently
        const dataSource = this.dataSources.get(numericOrgId)

        if (!dataSource) {
            logError(`❌ [DataSourceManager]: DataSource for orgId ${numericOrgId} was not found in map after initialization`).catch(
                () => {}
            )
            throw new Error(`DataSource for orgId ${numericOrgId} was not found in map after initialization`)
        }

        if (!dataSource.isInitialized) {
            logError(
                `❌ [DataSourceManager]: DataSource for orgId ${numericOrgId} exists but is not initialized. State: ${JSON.stringify({
                    isInitialized: dataSource.isInitialized,
                    options: dataSource.options?.type
                })}`
            ).catch(() => {})
            throw new Error(
                `DataSource for orgId ${numericOrgId} was not properly initialized (isInitialized: ${dataSource.isInitialized})`
            )
        }

        logInfo(`✅ [DataSourceManager]: DataSource for orgId ${numericOrgId} is ready`).catch(() => {})
        return dataSource
    }

    /**
     * Get DataSource for a specific organization
     */
    getDataSource(orgId: number | string): DataSource {
        // Normalize orgId to number for consistent map lookups
        const numericOrgId = typeof orgId === 'string' ? parseInt(orgId, 10) : Number(orgId)
        if (isNaN(numericOrgId)) {
            throw new Error(`Invalid orgId: ${orgId} (cannot convert to number)`)
        }

        const dataSource = this.dataSources.get(numericOrgId)
        if (!dataSource) {
            throw new Error(
                `DataSource not found for orgId ${numericOrgId}. Make sure the organization is configured and DataSourceManager is initialized.`
            )
        }
        if (!dataSource.isInitialized) {
            throw new Error(`DataSource for orgId ${numericOrgId} is not initialized`)
        }
        return dataSource
    }

    /**
     * Check if DataSource exists for an organization
     */
    hasDataSource(orgId: number | string): boolean {
        // Normalize orgId to number for consistent map lookups
        const numericOrgId = typeof orgId === 'string' ? parseInt(orgId, 10) : Number(orgId)
        if (isNaN(numericOrgId)) {
            return false
        }

        const dataSource = this.dataSources.get(numericOrgId)
        return dataSource !== undefined && dataSource.isInitialized
    }

    /**
     * Get all initialized orgIds
     */
    getAllOrgIds(): number[] {
        return Array.from(this.dataSources.keys())
    }

    /**
     * Close all DataSource connections
     */
    async closeAll(): Promise<void> {
        logInfo(`🔌 [DataSourceManager]: Closing all DataSource connections...`).catch(() => {})
        const closePromises = Array.from(this.dataSources.entries()).map(async ([orgId, dataSource]) => {
            try {
                if (dataSource.isInitialized) {
                    await dataSource.destroy()
                    logInfo(`✅ [DataSourceManager]: Closed DataSource for orgId ${orgId}`).catch(() => {})
                }
            } catch (error) {
                logError(`❌ [DataSourceManager]: Error closing DataSource for orgId ${orgId}:`, error).catch(() => {})
            }
        })

        await Promise.all(closePromises)
        this.dataSources.clear()
        this.isInitialized = false
        logInfo(`✅ [DataSourceManager]: All DataSource connections closed`).catch(() => {})
    }

    /**
     * Check if DataSourceManager is initialized
     */
    isReady(): boolean {
        return this.isInitialized && this.dataSources.size > 0
    }

    /**
     * Initialize DataSource with retry logic (for Oracle)
     */
    private async initializeDataSourceWithRetry(
        dataSource: DataSource,
        orgId: number,
        database: string,
        maxRetries: number = 3,
        retryDelay: number = 2000
    ): Promise<void> {
        let lastError: Error | null = null

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logInfo(
                    `[DataSourceManager] Initializing Oracle DataSource for orgId ${orgId} (attempt ${attempt}/${maxRetries})...`
                ).catch(() => {})
                await dataSource.initialize()
                logInfo(`[DataSourceManager] Oracle DataSource initialized successfully for orgId ${orgId}`).catch(() => {})
                return
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error))
                const errorDetails = OracleConnectionHelper.getErrorDetails(lastError)
                logWarn(
                    `[DataSourceManager] DataSource initialization attempt ${attempt} failed for orgId ${orgId}: ${errorDetails.message}`
                ).catch(() => {})

                if (attempt < maxRetries && errorDetails.isRetryable) {
                    const delay = retryDelay * Math.pow(2, attempt - 1) // Exponential backoff
                    logInfo(`[DataSourceManager] Retrying in ${delay}ms...`).catch(() => {})
                    await this.sleep(delay)
                } else if (!errorDetails.isRetryable) {
                    // Non-retryable error, throw immediately
                    throw lastError
                }
            }
        }

        // All retries exhausted
        logError(
            `[DataSourceManager] Failed to initialize DataSource for orgId ${orgId} after ${maxRetries} attempts: ${lastError?.message}`,
            lastError || undefined
        ).catch(() => {})
        throw lastError || new Error(`Failed to initialize DataSource for orgId ${orgId}`)
    }

    /**
     * Validate DataSource connection with a test query
     */
    private async validateDataSourceConnection(dataSource: DataSource, dbType: 'oracle' | 'postgres', orgId: number): Promise<void> {
        try {
            if (!dataSource.isInitialized) {
                throw new Error('DataSource is not initialized')
            }

            // Test connection with a simple query
            if (dbType === 'oracle') {
                const result = await dataSource.query('SELECT 1 as test_value, SYSDATE as current_date FROM DUAL')
                if (!result || result.length === 0) {
                    throw new Error('Oracle connection test query returned no results')
                }
                logInfo(`[DataSourceManager] Oracle connection validated for orgId ${orgId}`).catch(() => {})
            } else {
                const result = await dataSource.query('SELECT 1 as test_value, NOW() as current_date')
                if (!result || result.length === 0) {
                    throw new Error('PostgreSQL connection test query returned no results')
                }
                logInfo(`[DataSourceManager] PostgreSQL connection validated for orgId ${orgId}`).catch(() => {})
            }
        } catch (error) {
            logError(`[DataSourceManager] Connection validation failed for orgId ${orgId}:`, error).catch(() => {})
            // Destroy the DataSource if validation fails
            try {
                if (dataSource.isInitialized) {
                    await dataSource.destroy()
                }
            } catch (destroyError) {
                logWarn(
                    `[DataSourceManager] Error destroying DataSource after validation failure: ${
                        destroyError instanceof Error ? destroyError.message : String(destroyError)
                    }`
                ).catch(() => {})
            }
            throw error
        }
    }

    /**
     * Get pool monitoring information for all DataSources
     */
    async getPoolMonitoring(): Promise<Record<number, any>> {
        const monitoring: Record<number, any> = {}

        for (const [orgId, dataSource] of this.dataSources.entries()) {
            try {
                if (dataSource.isInitialized) {
                    const dbType = dataSource.options.type
                    if (dbType === 'oracle') {
                        // Oracle pool stats (if available through driver)
                        const oracleOptions = dataSource.options as any
                        monitoring[orgId] = {
                            type: 'oracle',
                            isInitialized: true,
                            database: oracleOptions.sid || oracleOptions.serviceName,
                            host: oracleOptions.host,
                            port: oracleOptions.port
                        }
                    } else if (dbType === 'postgres') {
                        // PostgreSQL pool stats
                        const postgresOptions = dataSource.options as any
                        monitoring[orgId] = {
                            type: 'postgres',
                            isInitialized: true,
                            database: postgresOptions.database,
                            host: postgresOptions.host,
                            port: postgresOptions.port
                            // Note: TypeORM doesn't expose pool stats directly
                        }
                    } else {
                        // Other database types
                        monitoring[orgId] = {
                            type: dbType,
                            isInitialized: true,
                            database: (dataSource.options as any).database,
                            host: (dataSource.options as any).host,
                            port: (dataSource.options as any).port
                        }
                    }
                } else {
                    monitoring[orgId] = {
                        isInitialized: false,
                        error: 'DataSource exists but is not initialized'
                    }
                }
            } catch (error) {
                monitoring[orgId] = {
                    error: error instanceof Error ? error.message : String(error)
                }
            }
        }

        return monitoring
    }

    /**
     * Sleep utility for retry delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}

// Singleton instance
let dataSourceManagerInstance: DataSourceManager | null = null

export function getDataSourceManager(): DataSourceManager {
    if (!dataSourceManagerInstance) {
        dataSourceManagerInstance = new DataSourceManager()
    }
    return dataSourceManagerInstance
}
