import { Request, Response, NextFunction } from 'express'
import { rateLimit } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import Redis from 'ioredis'
import { validateAPIKey } from './validateKey'
import { logInfo, logWarn } from './logger/system-helper'
import { OrganizationConfigService } from '../services/org-config.service'

let apiKeyRateLimiter: ReturnType<typeof rateLimit> | null = null

export function initializeApiKeyRateLimiter(orgConfigService?: OrganizationConfigService): void {
    if (apiKeyRateLimiter) {
        return
    }

    const windowMs = parseInt(process.env.API_KEY_RATE_LIMIT_WINDOW_MS || '900000', 10)
    const maxAttempts = parseInt(process.env.API_KEY_RATE_LIMIT_MAX_ATTEMPTS || '10', 10)

    const rateLimitConfig: any = {
        windowMs,
        max: maxAttempts,
        message: 'Too many API key validation attempts. Please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req: Request) => {
            const forwarded = req.headers['x-forwarded-for']
            const ip = forwarded ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]) : req.ip || req.socket.remoteAddress
            return `api-key-rate-limit:${ip || 'unknown'}`
        },
        skipSuccessfulRequests: true,
        skip: async (req: Request) => {
            try {
                // Extract orgId from request for rate limiting validation
                // This is called before main authentication, so we extract orgId here too
                let orgId: string | undefined
                if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                    orgId = req.body?.orgId
                } else if (req.method === 'GET') {
                    orgId = (req.query?.orgId as string) || (req.headers['x-org-id'] as string)
                }

                // If orgId is missing, don't skip rate limiting (rate limit will apply)
                if (!orgId) {
                    return false
                }

                const { isValid } = await validateAPIKey(req, orgId)
                return isValid
            } catch (error) {
                return false
            }
        }
    }

    // Get Redis config from first org's config (loaded from main database)
    const redisConfig = getRedisConfigFromOrg(orgConfigService)

    if (redisConfig) {
        try {
            const redisClient = new Redis({
                host: redisConfig.host,
                port: redisConfig.port,
                password: redisConfig.password,
                maxRetriesPerRequest: null
            })

            rateLimitConfig.store = new RedisStore({
                prefix: 'rl:apikey:',
                // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
                sendCommand: (...args: string[]) => redisClient.call(...args)
            })

            logInfo(`API Key rate limiter initialized with Redis store from org config: ${redisConfig.host}:${redisConfig.port}`).catch(
                () => {}
            )
        } catch (error) {
            const errorContext: Record<string, any> =
                error instanceof Error ? { error: error.message, stack: error.stack } : { error: String(error) }
            logWarn(
                `Failed to initialize Redis for API key rate limiter, using memory store: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                errorContext
            ).catch(() => {})
        }
    }

    apiKeyRateLimiter = rateLimit(rateLimitConfig)
}

function getRedisConfigFromOrg(orgConfigService?: OrganizationConfigService): { host: string; port: number; password?: string } | null {
    if (orgConfigService) {
        const orgIds = orgConfigService.getAllOrgIds()
        if (orgIds.length > 0) {
            const firstOrgId = orgIds[0]
            const orgConfig = orgConfigService.getOrgConfig(firstOrgId)
            const redisConfigData = orgConfig?.redis

            if (redisConfigData) {
                return {
                    host: redisConfigData.host,
                    port: redisConfigData.port,
                    password:
                        redisConfigData.password && redisConfigData.password.trim().length > 0 ? redisConfigData.password.trim() : undefined
                }
            }
        }
    }
    return null
}

export function apiKeyRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!apiKeyRateLimiter) {
        initializeApiKeyRateLimiter()
    }

    if (apiKeyRateLimiter) {
        return apiKeyRateLimiter(req, res, next)
    }

    logWarn('API key rate limiter not initialized').catch(() => {})
    next()
}
