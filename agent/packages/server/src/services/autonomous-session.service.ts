import Redis from 'ioredis'
import { logInfo, logError, logWarn, logDebug } from '../utils/logger/system-helper'
import { v4 as uuidv4 } from 'uuid'
import { OrganizationConfigService } from './org-config.service'

export class AutonomousSessionService {
    private redisPools: Map<number, Redis> = new Map()
    private authenticationFlags: Map<number, boolean> = new Map() // Track authentication state per orgId

    // Cache env vars to avoid parsing on every call
    private readonly SESSION_TTL = parseInt(process.env.SESSION_COOKIE_MAX_AGE || '900')
    private readonly REDIS_DB = parseInt(process.env.REDIS_DB_SESSION || '1')
    private readonly REDIS_MAX_RETRIES = parseInt(process.env.REDIS_MAX_RETRIES_PER_REQUEST || '3')
    private readonly REDIS_CONNECT_TIMEOUT = parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000')

    constructor(private orgConfigService: OrganizationConfigService) {
        // Don't initialize Redis pools in constructor - call initializeRedisPools() explicitly after org configs are loaded
    }

    /**
     * Initialize Redis pools for each organization and wait for connections to be ready
     * This should be called after loadAllOrganizations() in the startup sequence
     * EXACT PATTERN from autonomous server: createOrgRedisPools()
     */
    async initializeRedisPools(): Promise<void> {
        const orgIds = this.orgConfigService.getAllOrgIds()

        // Remove duplicates - use Set to ensure unique orgIds
        const uniqueOrgIds = Array.from(new Set(orgIds))

        if (uniqueOrgIds.length !== orgIds.length) {
            logWarn(
                `Found ${orgIds.length} orgIds with ${uniqueOrgIds.length} unique: [${orgIds.join(', ')}] -> [${uniqueOrgIds.join(', ')}]`
            ).catch(() => { })
        }

        logInfo(`🔴 Initializing Redis pools for ${uniqueOrgIds.length} unique organizations: [${uniqueOrgIds.join(', ')}]`).catch(() => { })

        if (uniqueOrgIds.length === 0) {
            logWarn('⚠️ No valid organizations found to create Redis pools').catch(() => { })
            return
        }

        // Track processed orgIds to prevent duplicates
        const processedOrgIds = new Set<number>()
        const connectionPromises: Promise<void>[] = []
        let successCount = 0
        let failureCount = 0

        for (const orgId of uniqueOrgIds) {
            // Skip if already processed (prevent duplicates)
            if (processedOrgIds.has(orgId)) {
                logWarn(`Redis pool already processed for orgId ${orgId}, skipping duplicate`).catch(() => { })
                continue
            }

            // Skip if already initialized (double-check to prevent duplicates)
            if (this.redisPools.has(orgId)) {
                logWarn(`Redis pool already exists for orgId ${orgId}, skipping duplicate initialization`).catch(() => { })
                continue
            }

            // Mark as processed
            processedOrgIds.add(orgId)

            const orgConfig = this.orgConfigService.getOrgConfig(orgId)
            const redisConfig = orgConfig?.redis

            if (!redisConfig) {
                logError(`❌ No Redis configuration found for org ${orgId}. Redis config is required for all organizations.`).catch(
                    () => { }
                )
                failureCount++
                continue
            }

            logInfo(`🔴 Creating Redis pool for org ${orgId}: ${redisConfig.host}:${redisConfig.port}`).catch(() => { })

            // Create Redis connection config (matching autonomous server pattern)
            // Only include password if it exists and has length > 0
            const redisConnectionConfig: any = {
                host: redisConfig.host,
                port: redisConfig.port,
                db: this.REDIS_DB,
                maxRetriesPerRequest: this.REDIS_MAX_RETRIES,
                connectTimeout: this.REDIS_CONNECT_TIMEOUT,
                retryStrategy: (times: number) => {
                    // Exponential backoff: 50ms, 100ms, 200ms, 400ms, max 2000ms
                    const delay = Math.min(times * 50, 2000)
                    if (times > 10) {
                        // After 10 retries, stop retrying
                        logError(`Redis retry strategy: giving up after ${times} attempts`).catch(() => { })
                        return null
                    }
                    logDebug(`Redis retry strategy: retrying in ${delay}ms (attempt ${times})`).catch(() => { })
                    return delay
                }
                // Don't use lazyConnect - connect immediately like autonomous server
                // This ensures authentication happens during connection
            }

            // Only add password if it exists and has length > 0 (exact match to autonomous server)
            if (redisConfig.password && typeof redisConfig.password === 'string' && redisConfig.password.trim().length > 0) {
                redisConnectionConfig.password = redisConfig.password.trim()
                logInfo(`🔐 Redis connection with password for orgId ${orgId}`).catch(() => { })
            } else {
                logInfo(`🔓 Redis connection without password for orgId ${orgId}`).catch(() => { })
            }

            // Create Redis client (connects immediately, authentication happens during connection)
            // Match autonomous server: no special options, just host, port, db, and password if exists
            const redisClient = new Redis(redisConnectionConfig)

            // Initialize authentication flag for this orgId
            this.authenticationFlags.set(orgId, false)

            // Handle connection errors gracefully (don't crash server)
            // Match autonomous server: log errors but don't crash
            redisClient.on('error', (error) => {
                const errorMsg = error.message || ''
                const isAuthenticated = this.authenticationFlags.get(orgId) || false

                // Only log NOAUTH errors as ERROR if we haven't authenticated yet
                // After authentication succeeds, NOAUTH errors are likely from retries or other operations
                // and can be safely ignored
                if (errorMsg.includes('NOAUTH')) {
                    if (!isAuthenticated) {
                        // Haven't authenticated yet - this is a real authentication failure
                        logError(`❌ Redis authentication failed for orgId ${orgId}: ${errorMsg}. Check if password is correct.`).catch(
                            () => { }
                        )
                    }
                    // If already authenticated, suppress the error completely (don't log at all)
                } else if (!errorMsg.includes('ECONNREFUSED') && !errorMsg.includes('ENOTFOUND')) {
                    logDebug(`Redis connection error for orgId ${orgId}: ${errorMsg}`).catch(() => { })
                }
            })

            // Handle successful connection (TCP connection established)
            redisClient.on('connect', () => {
                logDebug(`Redis TCP connection established for orgId ${orgId}`).catch(() => { })
            })

            // Handle ready event (connection established AND authenticated)
            // This is the event we should wait for before using Redis
            const readyPromise = new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    redisClient.removeListener('ready', onReady)
                    redisClient.removeListener('error', onError)
                    reject(new Error(`Redis connection timeout for orgId ${orgId} after 10 seconds`))
                }, 10000) // 10 second timeout for initial connection

                const onReady = () => {
                    clearTimeout(timeout)
                    redisClient.removeListener('ready', onReady)
                    redisClient.removeListener('error', onError)
                    // Mark as authenticated - use the Map to persist state
                    this.authenticationFlags.set(orgId, true)
                    logInfo(`✅ Redis ready for orgId ${orgId} (connected and authenticated)`).catch(() => { })
                    successCount++
                    resolve()
                }

                const onError = (err: Error) => {
                    clearTimeout(timeout)
                    redisClient.removeListener('ready', onReady)
                    redisClient.removeListener('error', onError)
                    const errorMsg = err.message || ''
                    // For connection errors (ECONNREFUSED, ENOTFOUND), reject after timeout
                    // These are fatal errors that won't recover
                    if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND')) {
                        logError(`❌ Redis connection failed for orgId ${orgId}: ${errorMsg}`).catch(() => { })
                        failureCount++
                        reject(err)
                    } else if (errorMsg.includes('NOAUTH')) {
                        // NOAUTH errors during initial connection are fatal
                        logError(`❌ Redis authentication failed for orgId ${orgId}: ${errorMsg}`).catch(() => { })
                        failureCount++
                        reject(err)
                    } else {
                        // Other errors - log but don't reject immediately, wait for timeout
                        logWarn(`⚠️ Redis connection issue for orgId ${orgId}: ${errorMsg}`).catch(() => { })
                        // Don't reject - let timeout handle it
                    }
                }

                // Check if already ready
                if (redisClient.status === 'ready') {
                    clearTimeout(timeout)
                    this.authenticationFlags.set(orgId, true)
                    logInfo(`✅ Redis already ready for orgId ${orgId}`).catch(() => { })
                    successCount++
                    resolve()
                } else {
                    redisClient.once('ready', onReady)
                    redisClient.once('error', onError)
                }
            })

            // Reset authentication flag if connection ends
            redisClient.on('end', () => {
                this.authenticationFlags.set(orgId, false)
                logDebug(`Redis connection ended for orgId ${orgId}`).catch(() => { })
            })

            redisClient.on('close', () => {
                this.authenticationFlags.set(orgId, false)
                logDebug(`Redis connection closed for orgId ${orgId}`).catch(() => { })
            })

            this.redisPools.set(orgId, redisClient)
            connectionPromises.push(readyPromise)
        }

        // Wait for all Redis connections to be ready (matching autonomous server pattern)
        // This ensures all connections are established before proceeding with startup
        // Use allSettled to allow partial failures (some orgs may have Redis issues)
        const results = await Promise.allSettled(connectionPromises)

        // Count successes and failures from results
        let actualSuccessCount = 0
        let actualFailureCount = 0
        for (const result of results) {
            if (result.status === 'fulfilled') {
                actualSuccessCount++
            } else {
                actualFailureCount++
                logError(
                    `Redis pool initialization failed for one organization: ${result.reason instanceof Error ? result.reason.message : String(result.reason)
                    }`,
                    result.reason
                ).catch(() => { })
            }
        }

        logInfo(`✅ Org redis pools creation completed: ${actualSuccessCount} successful, ${actualFailureCount} failed`).catch(() => { })

        if (actualSuccessCount === 0) {
            logWarn('⚠️ No organization Redis pools were created successfully').catch(() => { })
        } else if (actualFailureCount > 0) {
            logWarn(
                `⚠️ ${actualFailureCount} organization(s) failed to initialize Redis pools - server will continue but those orgs may have issues`
            ).catch(() => { })
        }
    }

    /**
     * Get Redis client for organization and ensure it's ready
     * This method ensures the connection is ready and authenticated before returning
     */
    private async ensureRedisReady(orgId: number): Promise<Redis> {
        const client = this.redisPools.get(orgId)
        if (!client) {
            throw new Error(`Redis pool not found for orgId: ${orgId}`)
        }

        // If already ready, return immediately
        if (client.status === 'ready') {
            return client
        }

        // Wait for ready event if connecting or connected but not ready
        if (client.status === 'connecting' || client.status === 'connect') {
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    client.removeListener('ready', onReady)
                    client.removeListener('error', onError)
                    reject(new Error(`Redis connection timeout for orgId ${orgId} after 5 seconds, status: ${client.status}`))
                }, 5000)

                const onReady = () => {
                    clearTimeout(timeout)
                    client.removeListener('ready', onReady)
                    client.removeListener('error', onError)
                    resolve()
                }

                const onError = (err: Error) => {
                    clearTimeout(timeout)
                    client.removeListener('ready', onReady)
                    client.removeListener('error', onError)
                    // Don't reject on error - let the caller handle it
                    resolve()
                }

                if (client.status === 'ready') {
                    clearTimeout(timeout)
                    resolve()
                } else {
                    client.once('ready', onReady)
                    client.once('error', onError)
                }
            })
            return client
        }

        // If disconnected, try to reconnect
        if (client.status === 'end' || client.status === 'close') {
            logWarn(`Redis connection closed for orgId ${orgId}, attempting to reconnect...`).catch(() => { })
            await client.connect()
            // Wait for ready after reconnect
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    client.removeListener('ready', onReady)
                    client.removeListener('error', onError)
                    reject(new Error(`Redis reconnection timeout for orgId ${orgId} after 5 seconds`))
                }, 5000)

                const onReady = () => {
                    clearTimeout(timeout)
                    client.removeListener('ready', onReady)
                    client.removeListener('error', onError)
                    resolve()
                }

                const onError = (err: Error) => {
                    clearTimeout(timeout)
                    client.removeListener('ready', onReady)
                    client.removeListener('error', onError)
                    reject(err)
                }

                if (client.status === 'ready') {
                    clearTimeout(timeout)
                    resolve()
                } else {
                    client.once('ready', onReady)
                    client.once('error', onError)
                }
            })
            return client
        }

        // If in an unexpected state, throw error
        throw new Error(`Redis client in invalid state for orgId ${orgId}: ${client.status}`)
    }

    /**
     * Create autonomous session
     * Token format: {uuid}$${chainsysSessionId}$${userId}$$Auto{orgId}
     * EXACT IMPLEMENTATION from autonomous server
     */
    async createAutonomousSession(chainsysSessionId: string, userId: string, orgId: string, userData: any): Promise<string> {
        logDebug(
            `Creating autonomous session (orgId: ${orgId}, userId: ${userId}, chainsysSessionId: ${chainsysSessionId.substring(0, 20)}...)`
        ).catch(() => { })
        const sessionId = uuidv4()
        const token = `${sessionId}$$${chainsysSessionId}$$${userId}$$Auto${orgId}`
        const redisKey = `AUTONOMOUS_SESSION_${token}`

        const sessionData = {
            chainsysSessionId,
            userId,
            orgId,
            userData,
            createdAt: Date.now()
        }

        // Store in Redis with TTL - use SESSION_COOKIE_MAX_AGE
        const ttl = this.SESSION_TTL
        let redisClient: Redis
        try {
            // Ensure Redis is ready and authenticated before use
            redisClient = await this.ensureRedisReady(parseInt(orgId))
        } catch (error) {
            logError(
                `Failed to get Redis client for autonomous session (orgId: ${orgId}, availableOrgIds: [${Array.from(
                    this.redisPools.keys()
                ).join(', ')}]): ${error instanceof Error ? error.message : String(error)}`,
                error
            ).catch(() => { })
            throw new Error(`Redis client not available for orgId ${orgId}: ${error instanceof Error ? error.message : String(error)}`)
        }

        // Retry logic for Redis operations with connection recovery
        const maxRetries = 3
        let lastError: Error | null = null

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Check connection status before operation
                if (redisClient.status !== 'ready') {
                    logWarn(
                        `Redis not ready (status: ${redisClient.status}), attempting to reconnect... (orgId: ${orgId}, attempt: ${attempt}/${maxRetries})`
                    ).catch(() => { })
                    // Try to ensure connection is ready again
                    redisClient = await this.ensureRedisReady(parseInt(orgId))
                }

                // Now safe to use Redis - connection is ready and authenticated
                logDebug(
                    `Storing session in Redis (orgId: ${orgId}, ttl: ${ttl}, redisStatus: ${redisClient.status}, attempt: ${attempt}/${maxRetries})`
                ).catch(() => { })

                await redisClient.setex(redisKey, ttl, JSON.stringify(sessionData))
                logDebug(`Session stored successfully in Redis (orgId: ${orgId}, attempt: ${attempt})`).catch(() => { })

                // Verify it was stored by reading it back
                const verifyData = await redisClient.get(redisKey)
                logDebug(`Session verification (orgId: ${orgId}, wasStored: ${!!verifyData})`).catch(() => { })

                // Success - break out of retry loop
                break
            } catch (redisError) {
                lastError = redisError instanceof Error ? redisError : new Error(String(redisError))
                const errorMessage = lastError.message || ''

                logError(
                    `Failed to store session in Redis (orgId: ${orgId}, redisKey: ${redisKey.substring(0, 50)}..., redisStatus: ${redisClient.status
                    }, attempt: ${attempt}/${maxRetries}, willRetry: ${attempt < maxRetries}): ${errorMessage}`,
                    lastError
                ).catch(() => { })

                // If this is the last attempt, throw the error
                if (attempt === maxRetries) {
                    // Check if it's a connection issue and try one more reconnection
                    if (
                        errorMessage.includes('max retries') ||
                        errorMessage.includes('ECONNREFUSED') ||
                        errorMessage.includes('ENOTFOUND')
                    ) {
                        logWarn(`Connection issue detected, attempting final reconnection... (orgId: ${orgId})`).catch(() => { })
                        try {
                            // Force reconnection
                            if (redisClient.status !== 'ready') {
                                await redisClient.connect()
                                await new Promise<void>((resolve, reject) => {
                                    const timeout = setTimeout(() => reject(new Error('Reconnection timeout')), 5000)
                                    redisClient.once('ready', () => {
                                        clearTimeout(timeout)
                                        resolve()
                                    })
                                    redisClient.once('error', (err) => {
                                        clearTimeout(timeout)
                                        reject(err)
                                    })
                                })
                            }
                            // Try one more time after reconnection
                            await redisClient.setex(redisKey, ttl, JSON.stringify(sessionData))
                            logDebug(`Session stored successfully after reconnection (orgId: ${orgId})`).catch(() => { })
                            break
                        } catch (finalError) {
                            // Final attempt failed, throw the original error
                            throw new Error(`Failed to store session in Redis after ${maxRetries} attempts: ${errorMessage}`)
                        }
                    } else {
                        throw new Error(`Failed to store session in Redis: ${errorMessage}`)
                    }
                }

                // Wait before retrying (exponential backoff)
                const delay = Math.min(attempt * 100, 1000)
                logInfo(`Retrying Redis operation in ${delay}ms... (orgId: ${orgId}, attempt: ${attempt}/${maxRetries})`).catch(() => { })
                await new Promise((resolve) => setTimeout(resolve, delay))
            }
        }

        logDebug(`Autonomous server session created (orgId: ${orgId}, userId: ${userId}, token: ${token.substring(0, 30)}...)`).catch(
            () => { }
        )

        return token
    }

    /**
     * Validate autonomous session
     * EXACT IMPLEMENTATION from autonomous server
     */
    async validateAutonomousSession(token: string, orgId: string): Promise<any> {
        const redisKey = `AUTONOMOUS_SESSION_${token}`
        logDebug(`Validating autonomous session (orgId: ${orgId}, token: ${token.substring(0, 30)}...)`).catch(() => { })

        const redisClient = await this.ensureRedisReady(parseInt(orgId))
        logDebug(`Redis client ready, fetching session (orgId: ${orgId}, redisStatus: ${redisClient.status})`).catch(() => { })

        const sessionData = await redisClient.get(redisKey)

        logDebug(`Session validation result (orgId: ${orgId}, found: ${!!sessionData})`).catch(() => { })

        if (!sessionData) {
            return null
        }

        const parsed = JSON.parse(sessionData)
        // Verify orgId matches (compare as strings to handle type differences)
        // This is a security check to ensure token orgId matches session orgId
        const parsedOrgId = String(parsed.orgId)
        const providedOrgId = String(orgId)

        if (parsedOrgId !== providedOrgId) {
            logWarn(
                `orgId mismatch in session validation (parsedOrgId: ${parsedOrgId}, providedOrgId: ${providedOrgId}, token: ${token.substring(
                    0,
                    30
                )}...)`
            ).catch(() => { })
            return null
        }

        logDebug(`Session validated successfully (orgId: ${parsedOrgId}, userId: ${parsed.userId})`).catch(() => { })

        return parsed
    }

    /**
     * Extend autonomous session TTL
     * EXACT IMPLEMENTATION from autonomous server
     * @deprecated Use extendAutonomousSessionWithData to avoid double validation
     */
    async extendAutonomousSession(token: string, orgId: string): Promise<boolean> {
        const sessionData = await this.validateAutonomousSession(token, orgId)
        if (!sessionData) {
            return false
        }

        return await this.extendAutonomousSessionWithData(token, orgId, sessionData)
    }

    /**
     * Extend autonomous session TTL using already-validated session data
     * This avoids double validation and improves performance
     * Optimized: Uses EXPIRE instead of SETEX to avoid rewriting session data
     */
    async extendAutonomousSessionWithData(token: string, orgId: string, sessionData: any): Promise<boolean> {
        try {
            const redisKey = `AUTONOMOUS_SESSION_${token}`
            const ttl = this.SESSION_TTL
            const redisClient = await this.ensureRedisReady(parseInt(orgId))

            // Use EXPIRE instead of SETEX - more efficient, just extends TTL without rewriting data
            const result = await redisClient.expire(redisKey, ttl)

            if (result === 1) {
                logDebug(`Session TTL extended successfully (orgId: ${orgId}, ttl: ${ttl})`).catch(() => { })
                return true
            } else {
                // Key doesn't exist or already expired - re-save it
                logDebug(`Session key not found for EXPIRE, re-saving with SETEX (orgId: ${orgId})`).catch(() => { })
                await redisClient.setex(redisKey, ttl, JSON.stringify(sessionData))
                return true
            }
        } catch (error) {
            logError(
                `Failed to extend session TTL (orgId: ${orgId}, token: ${token.substring(0, 30)}...): ${error instanceof Error ? error.message : String(error)
                }`,
                error
            ).catch(() => { })
            // Don't throw - let the caller handle it
            return false
        }
    }

    /**
     * Delete autonomous session
     */
    async deleteAutonomousSession(token: string, orgId: string): Promise<boolean> {
        const redisKey = `AUTONOMOUS_SESSION_${token}`
        const redisClient = await this.ensureRedisReady(parseInt(orgId))
        const result = await redisClient.del(redisKey)
        return result > 0
    }
}
