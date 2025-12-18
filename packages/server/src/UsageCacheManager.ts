import { Keyv } from 'keyv'
import KeyvRedis from '@keyv/redis'
import { Cache, createCache } from 'cache-manager'
import { MODE } from './Interface'
import { LICENSE_QUOTAS } from './utils/constants'
import { OrganizationConfigService } from './services/org-config.service'
import { logInfo, logWarn } from './utils/logger/system-helper'
// Subscription-related code removed - autonomous server has unlimited quotas
// StripeManager removed - Stripe/Pricing removed for autonomous server deployment

const UNLIMITED_QUOTAS = {
    [LICENSE_QUOTAS.PREDICTIONS_LIMIT]: -1,
    [LICENSE_QUOTAS.STORAGE_LIMIT]: -1,
    [LICENSE_QUOTAS.FLOWS_LIMIT]: -1
}

export class UsageCacheManager {
    private cache: Cache
    private static instance: UsageCacheManager
    private orgConfigService?: OrganizationConfigService

    public static async getInstance(orgConfigService?: OrganizationConfigService): Promise<UsageCacheManager> {
        if (!UsageCacheManager.instance) {
            UsageCacheManager.instance = new UsageCacheManager()
            UsageCacheManager.instance.orgConfigService = orgConfigService
            await UsageCacheManager.instance.initialize()
        }
        return UsageCacheManager.instance
    }

    private async initialize(): Promise<void> {
        if (process.env.MODE === MODE.QUEUE) {
            // Get Redis config from first org's config (loaded from main database)
            let redisConfig: string | Record<string, any> | undefined

            if (this.orgConfigService) {
                const orgIds = this.orgConfigService.getAllOrgIds()
                if (orgIds.length > 0) {
                    const firstOrgId = orgIds[0]
                    const orgConfig = this.orgConfigService.getOrgConfig(firstOrgId)
                    const redisConfigData = orgConfig?.redis

                    if (redisConfigData) {
                        redisConfig = {
                            username: undefined, // Redis doesn't use username in this config
                            password:
                                redisConfigData.password && redisConfigData.password.trim().length > 0
                                    ? redisConfigData.password.trim()
                                    : undefined,
                            socket: {
                                host: redisConfigData.host,
                                port: redisConfigData.port,
                                keepAlive:
                                    process.env.REDIS_KEEP_ALIVE && !isNaN(parseInt(process.env.REDIS_KEEP_ALIVE, 10))
                                        ? parseInt(process.env.REDIS_KEEP_ALIVE, 10)
                                        : undefined
                            },
                            pingInterval:
                                process.env.REDIS_KEEP_ALIVE && !isNaN(parseInt(process.env.REDIS_KEEP_ALIVE, 10))
                                    ? parseInt(process.env.REDIS_KEEP_ALIVE, 10)
                                    : undefined
                        }
                        logInfo(
                            `[UsageCacheManager] Using Redis config from orgId ${firstOrgId}: ${redisConfigData.host}:${redisConfigData.port}`
                        ).catch(() => {})
                    }
                }
            }

            // Fallback: if no org config available, use in-memory cache (shouldn't happen in production)
            if (!redisConfig) {
                logWarn('[UsageCacheManager] No Redis config found from org configs, using in-memory cache').catch(() => {})
                this.cache = createCache()
            } else {
                this.cache = createCache({
                    stores: [
                        new Keyv({
                            store: new KeyvRedis(redisConfig)
                        })
                    ]
                })
            }
        } else {
            this.cache = createCache()
        }
    }

    // getSubscriptionDetails removed - not used in autonomous server

    public async getQuotas(_subscriptionId?: string, withoutCache: boolean = false): Promise<Record<string, number>> {
        // No subscription concept in autonomous server - always return unlimited quotas
        return UNLIMITED_QUOTAS
    }

    // getSubscriptionDataFromCache and updateSubscriptionDataToCache removed - not used in autonomous server

    public async get<T>(key: string): Promise<T | null> {
        if (!this.cache) await this.initialize()
        const value = await this.cache.get<T>(key)
        return value
    }

    public async getTTL(key: string): Promise<number | null> {
        if (!this.cache) await this.initialize()
        const value = await this.cache.ttl(key)
        return value
    }

    public async mget<T>(keys: string[]): Promise<(T | null)[]> {
        if (this.cache) {
            const values = await this.cache.mget<T>(keys)
            return values
        } else {
            return []
        }
    }

    public set<T>(key: string, value: T, ttl?: number) {
        if (this.cache) {
            this.cache.set(key, value, ttl)
        }
    }

    public mset<T>(keys: [{ key: string; value: T; ttl: number }]) {
        if (this.cache) {
            this.cache.mset(keys)
        }
    }

    public async del(key: string): Promise<void> {
        await this.cache.del(key)
    }

    public async mdel(keys: string[]): Promise<void> {
        await this.cache.mdel(keys)
    }

    public async clear(): Promise<void> {
        await this.cache.clear()
    }

    public async wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
        return this.cache.wrap(key, fn, ttl)
    }
}
