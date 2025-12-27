import { createClient, RedisClientType } from 'redis'
import { logError, logWarn, logInfo, logDebug } from '../utils/logger/system-helper'

// Simple lock object to match Redlock interface
interface SimpleLock {
    key: string
    value: string
    expiration: number
}

export class ScheduleLockManager {
    private redisClient: RedisClientType | null = null
    private lockTTL: number = 60000 // 60 seconds default
    private isConnected: boolean = false

    constructor(lockTTL?: number) {
        if (lockTTL) {
            this.lockTTL = lockTTL
        }
    }

    async initialize(): Promise<void> {
        if (this.isConnected) {
            return
        }

        try {
            // Create Redis client
            this.redisClient = createClient({
                socket: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379')
                },
                password: process.env.REDIS_PASSWORD && process.env.REDIS_PASSWORD.trim().length > 0
                    ? process.env.REDIS_PASSWORD.trim()
                    : undefined,
                database: parseInt(process.env.REDIS_DB_QUEUE || '3')
            })

            await this.redisClient.connect()

            this.isConnected = true
            await logInfo('[ScheduleLockManager] Initialized and connected to Redis (simple locking)')
        } catch (error) {
            await logError('[ScheduleLockManager] Failed to initialize:', error)
            throw error
        }
    }

    async acquireLock(scheduleId: string): Promise<SimpleLock | null> {
        if (!this.redisClient) {
            await logWarn('[ScheduleLockManager] Not initialized, cannot acquire lock')
            return null
        }

        try {
            const lockKey = `schedule:lock:${scheduleId}`
            const lockValue = `${Date.now()}-${Math.random()}` // Unique lock value
            const ttlSeconds = Math.ceil(this.lockTTL / 1000)

            await logDebug(`[ScheduleLockManager] Attempting to acquire lock: ${lockKey}`)

            // Try to set the key with NX (only if not exists) and EX (expiration)
            const result = await this.redisClient.set(lockKey, lockValue, {
                NX: true, // Only set if key doesn't exist
                EX: ttlSeconds // Expire after N seconds
            })

            if (result === 'OK') {
                await logDebug(`[ScheduleLockManager] Successfully acquired lock: ${lockKey}`)
                return {
                    key: lockKey,
                    value: lockValue,
                    expiration: Date.now() + this.lockTTL
                }
            } else {
                await logDebug(`[ScheduleLockManager] Lock already held for ${scheduleId}`)
                return null
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            await logWarn(`[ScheduleLockManager] Failed to acquire lock for ${scheduleId}: ${errorMsg}`)
            return null
        }
    }

    async releaseLock(lock: SimpleLock | null): Promise<void> {
        if (!lock || !this.redisClient) {
            return
        }

        try {
            // Delete the lock key
            await this.redisClient.del(lock.key)
            await logDebug(`[ScheduleLockManager] Released lock: ${lock.key}`)
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            await logWarn(`[ScheduleLockManager] Error releasing lock (may have expired): ${errorMsg}`)
        }
    }

    async extendLock(lock: SimpleLock | null, durationMs: number): Promise<SimpleLock | null> {
        if (!lock || !this.redisClient) {
            return null
        }

        try {
            const ttlSeconds = Math.ceil(durationMs / 1000)
            await this.redisClient.expire(lock.key, ttlSeconds)
            return {
                ...lock,
                expiration: Date.now() + durationMs
            }
        } catch (error) {
            await logError('[ScheduleLockManager] Failed to extend lock:', error)
            return null
        }
    }

    async shutdown(): Promise<void> {
        if (this.redisClient) {
            await this.redisClient.quit()
            this.isConnected = false
            await logInfo('[ScheduleLockManager] Disconnected from Redis')
        }
    }
}
