import Redis, { RedisOptions } from 'ioredis'
import { logInfo, logError, logWarn } from './utils/logger/system-helper'

/**
 * Global Redis Connection Pool
 * Reads configuration from environment variables and creates a connection pool
 * that can be used across the application for scheduling, caching, and pub/sub
 */
export class GlobalRedisPool {
    private static instance: GlobalRedisPool | null = null
    private client: Redis | null = null
    private subscriber: Redis | null = null
    private publisher: Redis | null = null
    private isConnected: boolean = false
    private connectionPromise: Promise<boolean> | null = null

    private constructor() { }

    /**
     * Get singleton instance
     */
    static getInstance(): GlobalRedisPool {
        if (!GlobalRedisPool.instance) {
            GlobalRedisPool.instance = new GlobalRedisPool()
        }
        return GlobalRedisPool.instance
    }

    /**
     * Get Redis configuration from environment variables
     */
    private getConfig(): RedisOptions | null {
        const host = process.env.REDIS_HOST
        const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined
        const url = process.env.REDIS_URL
        const user = process.env.REDIS_USER
        const password = process.env.REDIS_PASSWORD

        // If no host or URL is configured, Redis is disabled
        if (!host && !url) {
            return null
        }

        const config: RedisOptions = {
            // Connection settings
            host: host || 'localhost',
            port: port || 6379,

            // Authentication (only if password is provided and not empty)
            ...(password && password.trim().length > 0 && {
                password: password.trim()
            }),

            // Username (only if user is provided and not empty - Redis 6+ ACL)
            ...(user && user.trim().length > 0 && {
                username: user.trim()
            }),

            // Connection behavior
            retryStrategy: (times: number) => {
                if (times > 10) {
                    logError(`[GlobalRedisPool] Max retry attempts reached (${times})`).catch(() => { })
                    return null // Stop retrying
                }
                const delay = Math.min(times * 200, 5000) // Max 5 second delay
                logWarn(`[GlobalRedisPool] Connection retry attempt ${times}, waiting ${delay}ms`).catch(() => { })
                return delay
            },

            // Performance settings
            enableReadyCheck: true,
            maxRetriesPerRequest: 3,
            lazyConnect: false, // Connect immediately

            // Keep-alive settings
            keepAlive: process.env.REDIS_KEEP_ALIVE
                ? parseInt(process.env.REDIS_KEEP_ALIVE, 10)
                : 30000, // Default 30 seconds

            // Connection name for debugging
            connectionName: 'kodivian-global'
        }

        return config
    }

    /**
     * Initialize the Redis connection pool
     * Should be called at application startup
     */
    async initialize(): Promise<boolean> {
        // If already connecting, wait for that promise
        if (this.connectionPromise) {
            return this.connectionPromise
        }

        // If already connected, return true
        if (this.isConnected && this.client) {
            return true
        }

        this.connectionPromise = this._doConnect()
        return this.connectionPromise
    }

    private async _doConnect(): Promise<boolean> {
        const config = this.getConfig()

        if (!config) {
            logInfo('[GlobalRedisPool] Redis not configured (REDIS_HOST or REDIS_URL not set). Skipping Redis initialization.').catch(() => { })
            return false
        }

        try {
            logInfo(`[GlobalRedisPool] Connecting to Redis at ${config.host}:${config.port}...`).catch(() => { })

            // Create main client
            this.client = new Redis(config)

            // Set up event handlers
            this.client.on('connect', () => {
                logInfo('[GlobalRedisPool] Redis connection established').catch(() => { })
            })

            this.client.on('ready', () => {
                this.isConnected = true
                logInfo('[GlobalRedisPool] Redis client ready').catch(() => { })
            })

            this.client.on('error', (err) => {
                logError(`[GlobalRedisPool] Redis error: ${err.message}`).catch(() => { })
            })

            this.client.on('close', () => {
                this.isConnected = false
                logWarn('[GlobalRedisPool] Redis connection closed').catch(() => { })
            })

            this.client.on('reconnecting', () => {
                logInfo('[GlobalRedisPool] Redis reconnecting...').catch(() => { })
            })

            // Create subscriber client (separate connection for pub/sub)
            this.subscriber = new Redis({
                ...config,
                connectionName: 'kodivian-subscriber'
            })

            // Create publisher client
            this.publisher = new Redis({
                ...config,
                connectionName: 'kodivian-publisher'
            })

            // Test connection with PING
            const pong = await this.client.ping()
            if (pong === 'PONG') {
                this.isConnected = true
                logInfo('[GlobalRedisPool] ✅ Redis connection verified (PONG received)').catch(() => { })

                // Log Redis server info
                const info = await this.client.info('server')
                const versionMatch = info.match(/redis_version:(.+)/m)
                if (versionMatch) {
                    logInfo(`[GlobalRedisPool] Redis version: ${versionMatch[1].trim()}`).catch(() => { })
                }

                return true
            } else {
                throw new Error('Unexpected PING response')
            }
        } catch (error: any) {
            logError(`[GlobalRedisPool] Failed to connect to Redis: ${error.message}`).catch(() => { })
            this.isConnected = false
            this.connectionPromise = null
            return false
        }
    }

    /**
     * Get the main Redis client (for general operations)
     */
    getClient(): Redis | null {
        return this.client
    }

    /**
     * Get the subscriber client (for pub/sub subscriptions)
     */
    getSubscriber(): Redis | null {
        return this.subscriber
    }

    /**
     * Get the publisher client (for pub/sub publishing)
     */
    getPublisher(): Redis | null {
        return this.publisher
    }

    /**
     * Check if Redis is connected and ready
     */
    isReady(): boolean {
        return this.isConnected && this.client !== null
    }

    /**
     * Execute a Redis command on the main client
     */
    async execute<T>(command: string, ...args: any[]): Promise<T | null> {
        if (!this.client || !this.isConnected) {
            logWarn('[GlobalRedisPool] Redis not connected, command skipped').catch(() => { })
            return null
        }
        try {
            // @ts-ignore - dynamic command execution
            return await this.client[command](...args)
        } catch (error: any) {
            logError(`[GlobalRedisPool] Command failed: ${command} - ${error.message}`).catch(() => { })
            throw error
        }
    }

    /**
     * Gracefully close all Redis connections
     */
    async disconnect(): Promise<void> {
        const closePromises: Promise<string>[] = []

        if (this.client) {
            closePromises.push(this.client.quit())
        }
        if (this.subscriber) {
            closePromises.push(this.subscriber.quit())
        }
        if (this.publisher) {
            closePromises.push(this.publisher.quit())
        }

        await Promise.allSettled(closePromises)

        this.client = null
        this.subscriber = null
        this.publisher = null
        this.isConnected = false
        this.connectionPromise = null

        logInfo('[GlobalRedisPool] All Redis connections closed').catch(() => { })
    }

    /**
     * Get connection status info
     */
    getStatus(): { connected: boolean; host?: string; port?: number } {
        const config = this.getConfig()
        return {
            connected: this.isConnected,
            host: config?.host as string | undefined,
            port: config?.port
        }
    }
}

// Export singleton getter function
export function getGlobalRedis(): GlobalRedisPool {
    return GlobalRedisPool.getInstance()
}

// Export convenience function to get client directly
export function getRedisClient(): Redis | null {
    return GlobalRedisPool.getInstance().getClient()
}
