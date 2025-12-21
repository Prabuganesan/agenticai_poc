import { UsageCacheManager } from '../UsageCacheManager'

type UsageType = 'flows' | 'users'
// Quota checking simplified - all quotas are unlimited in kodivian server

// For usage that doesn't renew per month, we just get the count from database and check
// No limits enforced in kodivian server - quotas are always unlimited
export const checkUsageLimit = async (type: UsageType, usageCacheManager: UsageCacheManager, currentUsage: number) => {
    // No-op: quotas are always unlimited in kodivian server
    return
}

// As predictions limit renew per month, we set to cache with 1 month TTL
export const updatePredictionsUsage = async (orgId: string, _: string = '', usageCacheManager?: UsageCacheManager) => {
    if (!usageCacheManager) return

    let currentPredictions = 0
    const existingPredictions = await usageCacheManager.get(`predictions:${orgId}`)
    if (existingPredictions) {
        currentPredictions = 1 + (existingPredictions as number)
    } else {
        currentPredictions = 1
    }

    const currentTTL = await usageCacheManager.getTTL(`predictions:${orgId}`)
    if (currentTTL) {
        const currentTimestamp = Date.now()
        const timeLeft = currentTTL - currentTimestamp
        usageCacheManager.set(`predictions:${orgId}`, currentPredictions, timeLeft)
    } else {
        // Fallback to default 30 days TTL (no subscription concept in kodivian server)
        const MS_PER_DAY = 24 * 60 * 60 * 1000
        const DAYS = 30
        const approximateMonthMs = DAYS * MS_PER_DAY
        usageCacheManager.set(`predictions:${orgId}`, currentPredictions, approximateMonthMs)
    }
}

export const checkPredictions = async (orgId: string, usageCacheManager: UsageCacheManager) => {
    // No-op: quotas are always unlimited in kodivian server
    return
}

// Storage does not renew per month nor do we store the total size in database, so we just store the total size in cache
export const updateStorageUsage = (orgId: string, totalSize: number, usageCacheManager?: UsageCacheManager) => {
    if (!usageCacheManager) return
    usageCacheManager.set(`storage:${orgId}`, totalSize)
}

export const checkStorage = async (orgId: string, usageCacheManager: UsageCacheManager) => {
    // No-op: quotas are always unlimited in kodivian server
    return
}
