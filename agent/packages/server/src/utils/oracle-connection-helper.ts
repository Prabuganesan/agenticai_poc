import oracledb from 'oracledb'
import { logWarn } from './logger/system-helper'

/**
 * Oracle Connection Helper
 * Centralized utilities for Oracle connection management, health checks, and error handling
 */
export class OracleConnectionHelper {
    private static readonly MAX_RETRIES = 3
    private static readonly RETRY_DELAY_MS = 1000
    private static readonly CONNECTION_TIMEOUT_MS = 30000

    /**
     * Execute Oracle query with retry logic
     */
    static async executeWithRetry<T>(
        pool: oracledb.Pool,
        query: string,
        params: any[] = [],
        retries: number = this.MAX_RETRIES
    ): Promise<T> {
        let lastError: Error | null = null

        for (let attempt = 1; attempt <= retries; attempt++) {
            let connection: oracledb.Connection | null = null
            try {
                connection = await pool.getConnection()
                const result = await connection.execute(query, params, {
                    outFormat: (oracledb as any).OUT_FORMAT_OBJECT
                })

                // Normalize result format to match PostgreSQL
                const normalizedResult = {
                    rows: (result.rows || []).map((row: any) =>
                        Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]))
                    )
                }

                await connection.close()
                return normalizedResult as T
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error))

                if (connection) {
                    try {
                        await connection.close()
                    } catch (closeError) {
                        logWarn(
                            `Failed to close connection after error: ${
                                closeError instanceof Error ? closeError.message : String(closeError)
                            }`
                        ).catch(() => {})
                    }
                }

                // Check if error is retryable
                if (this.isRetryableError(error) && attempt < retries) {
                    const delay = this.RETRY_DELAY_MS * attempt
                    logWarn(`Oracle query failed (attempt ${attempt}/${retries}), retrying in ${delay}ms: ${lastError.message}`).catch(
                        () => {}
                    )
                    await this.delay(delay)
                    continue
                }

                // Not retryable or max retries reached
                throw lastError
            }
        }

        throw lastError || new Error('Oracle query execution failed after retries')
    }

    /**
     * Check if error is retryable
     */
    private static isRetryableError(error: any): boolean {
        if (!error) return false

        const errorMessage = error.message || String(error)
        const errorCode = error.errorNum || error.code

        // Retryable Oracle errors
        const retryableErrors = [
            'ORA-03113', // end-of-file on communication channel
            'ORA-03114', // not connected to ORACLE
            'ORA-12535', // TNS:operation timed out
            'ORA-12537', // TNS:connection closed
            'ORA-12547', // TNS:lost contact
            'NJS-', // Node.js Oracle driver errors
            'DPI-', // Oracle client errors
            'ENOTFOUND', // DNS lookup failed
            'ECONNREFUSED', // Connection refused
            'ETIMEDOUT' // Connection timeout
        ]

        return retryableErrors.some((retryable) => errorMessage.includes(retryable) || String(errorCode).includes(retryable))
    }

    /**
     * Health check for Oracle connection pool
     */
    static async healthCheck(pool: oracledb.Pool): Promise<{
        healthy: boolean
        message: string
        poolSize?: number
        connectionsOpen?: number
        connectionsInUse?: number
    }> {
        let connection: oracledb.Connection | null = null
        try {
            // Try to get a connection with timeout
            const connectionPromise = pool.getConnection()
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Connection timeout')), this.CONNECTION_TIMEOUT_MS)
            )

            connection = (await Promise.race([connectionPromise, timeoutPromise])) as oracledb.Connection

            // Execute a simple query to verify connection works
            await connection.execute('SELECT 1 FROM DUAL')

            // Get pool statistics if available
            const poolStats = (pool as any).poolMin || 0
            const connectionsOpen = (pool as any).connectionsOpen || 0
            const connectionsInUse = (pool as any).connectionsInUse || 0

            await connection.close()

            return {
                healthy: true,
                message: 'Oracle connection pool is healthy',
                poolSize: poolStats,
                connectionsOpen,
                connectionsInUse
            }
        } catch (error) {
            if (connection) {
                try {
                    await connection.close()
                } catch (closeError) {
                    // Ignore close errors
                }
            }

            const errorMessage = error instanceof Error ? error.message : String(error)
            return {
                healthy: false,
                message: `Oracle connection health check failed: ${errorMessage}`
            }
        }
    }

    /**
     * Get connection pool status
     */
    static async getPoolStatus(pool: oracledb.Pool): Promise<{
        poolMin?: number
        poolMax?: number
        poolIncrement?: number
        connectionsOpen?: number
        connectionsInUse?: number
        poolTimeout?: number
    }> {
        try {
            // Oracle pool properties (may not all be accessible)
            return {
                poolMin: (pool as any).poolMin,
                poolMax: (pool as any).poolMax,
                poolIncrement: (pool as any).poolIncrement,
                connectionsOpen: (pool as any).connectionsOpen,
                connectionsInUse: (pool as any).connectionsInUse,
                poolTimeout: (pool as any).poolTimeout
            }
        } catch (error) {
            logWarn(`Failed to get pool status: ${error instanceof Error ? error.message : String(error)}`).catch(() => {})
            return {}
        }
    }

    /**
     * Validate Oracle connection string format
     */
    static validateConnectionString(
        host: string,
        port: string | number,
        database: string
    ): {
        valid: boolean
        connectString: string
        message?: string
    } {
        if (!host || !port || !database) {
            return {
                valid: false,
                connectString: '',
                message: 'Host, port, and database are required'
            }
        }

        const portNum = typeof port === 'string' ? parseInt(port, 10) : port
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            return {
                valid: false,
                connectString: '',
                message: `Invalid port number: ${port}`
            }
        }

        const connectString = `${host}:${portNum}/${database}`
        return {
            valid: true,
            connectString
        }
    }

    /**
     * Test Oracle connection with detailed error reporting
     */
    static async testConnection(
        user: string,
        password: string,
        connectString: string
    ): Promise<{
        success: boolean
        message: string
        version?: string
        error?: any
    }> {
        let connection: oracledb.Connection | null = null
        try {
            connection = await oracledb.getConnection({
                user,
                password,
                connectString
            })

            // Get database version
            const versionResult = await connection.execute("SELECT BANNER FROM v$version WHERE BANNER LIKE 'Oracle%'")
            const version = versionResult.rows && versionResult.rows.length > 0 ? (versionResult.rows[0] as any)[0] : 'Unknown'

            await connection.close()

            return {
                success: true,
                message: 'Connection test successful',
                version
            }
        } catch (error) {
            if (connection) {
                try {
                    await connection.close()
                } catch (closeError) {
                    // Ignore close errors
                }
            }

            const errorMessage = error instanceof Error ? error.message : String(error)
            const errorCode = (error as any)?.errorNum || (error as any)?.code || 'UNKNOWN'

            // Provide helpful error messages
            let message = `Connection test failed: ${errorMessage}`
            if (errorMessage.includes('ORA-12154')) {
                message = 'TNS:could not resolve the connect identifier. Check host, port, and database name.'
            } else if (errorMessage.includes('ORA-12541')) {
                message = 'TNS:no listener. Database server may not be running or port is incorrect.'
            } else if (errorMessage.includes('ORA-01017')) {
                message = 'Invalid username/password. Check credentials.'
            } else if (errorMessage.includes('ORA-12514')) {
                message = 'TNS:listener does not currently know of service. Database service name may be incorrect.'
            } else if (errorMessage.includes('NJS-') || errorMessage.includes('DPI-')) {
                message = 'Oracle client library error. Verify Oracle Instant Client is correctly installed.'
            }

            return {
                success: false,
                message,
                error: {
                    code: errorCode,
                    message: errorMessage,
                    fullError: error
                }
            }
        }
    }

    /**
     * Delay utility for retries
     */
    private static delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /**
     * Format Oracle error for logging
     */
    static formatError(error: any): string {
        if (!error) return 'Unknown error'

        const errorCode = (error as any)?.errorNum || (error as any)?.code || ''
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (errorCode) {
            return `ORA-${errorCode}: ${errorMessage}`
        }

        return errorMessage
    }

    /**
     * Create connection string from components
     */
    static createConnectionString(host: string, port: number, database: string): string {
        return `${host}:${port}/${database}`
    }

    /**
     * Create Oracle pool with retry logic
     */
    static async createPoolWithRetry(
        config: {
            host: string
            port: number
            database: string
            username: string
            password: string
            poolMin: number
            poolMax: number
            poolIncrement: number
            poolTimeout: number
            poolPingInterval: number
        },
        retryOptions: {
            maxRetries?: number
            retryDelay?: number
            exponentialBackoff?: boolean
        } = {}
    ): Promise<oracledb.Pool> {
        const maxRetries = retryOptions.maxRetries || 3
        const baseDelay = retryOptions.retryDelay || 1000
        const exponentialBackoff = retryOptions.exponentialBackoff !== false

        const connectString = this.createConnectionString(config.host, config.port, config.database)
        let lastError: Error | null = null

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const pool = await oracledb.createPool({
                    user: config.username,
                    password: config.password,
                    connectString: connectString,
                    poolMin: config.poolMin,
                    poolMax: config.poolMax,
                    poolIncrement: config.poolIncrement,
                    poolTimeout: config.poolTimeout,
                    poolPingInterval: config.poolPingInterval,
                    poolAlias: 'meta-db-pool'
                } as any)

                return pool
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error))

                if (attempt < maxRetries) {
                    const delay = exponentialBackoff ? baseDelay * Math.pow(2, attempt - 1) : baseDelay
                    logWarn(
                        `Oracle pool creation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms: ${lastError.message}`
                    ).catch(() => {})
                    await this.delay(delay)
                    continue
                }
            }
        }

        throw lastError || new Error('Oracle pool creation failed after retries')
    }

    /**
     * Test pool connection
     */
    static async testPoolConnection(pool: oracledb.Pool): Promise<void> {
        const connection = await pool.getConnection()
        try {
            await connection.execute('SELECT 1 FROM DUAL')
        } finally {
            await connection.close()
        }
    }

    /**
     * Get error details with suggestions
     */
    static getErrorDetails(error: Error): { message: string; suggestion: string; isRetryable: boolean } {
        const errorMessage = error.message || String(error)
        let suggestion = 'Check your connection parameters and network connectivity.'
        let isRetryable = this.isRetryableError(error)

        if (errorMessage.includes('ORA-12154')) {
            suggestion = 'Check if the host, port, and database name are correct. Verify network connectivity to the database server.'
            isRetryable = true
        } else if (errorMessage.includes('ORA-12541')) {
            suggestion = 'The database server may not be running or the port is incorrect. Check if the Oracle listener is running.'
            isRetryable = true
        } else if (errorMessage.includes('ORA-01017')) {
            suggestion = 'Check if the username and password are correct.'
            isRetryable = false // Authentication errors are not retryable
        } else if (errorMessage.includes('ORA-12514')) {
            suggestion = 'The database service name may be incorrect. Verify the service name in your connection string.'
            isRetryable = false // Configuration errors are not retryable
        } else if (errorMessage.includes('NJS-') || errorMessage.includes('DPI-')) {
            suggestion = 'Verify the Oracle Instant Client is correctly installed and all required library files are present.'
            isRetryable = false // Client library errors are not retryable
        }

        return {
            message: this.formatError(error),
            suggestion,
            isRetryable
        }
    }
}
