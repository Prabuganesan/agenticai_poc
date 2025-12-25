// Import SimpleCrypto at the top level (ES6 import for browser)
import SimpleCrypto from 'simple-crypto-js'

// Cache for decrypted store to avoid decrypting every time
let cachedDecryptedStore = null
let cacheTimestamp = 0
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes cache

// loadSimpleCrypto function removed - SimpleCrypto is imported directly

/**
 * Get decrypted kodivianStore with caching
 * This avoids decrypting on every orgId/userId access
 */
const getDecryptedStore = () => {
    const now = Date.now()

    // Return cached store if still valid
    if (cachedDecryptedStore && (now - cacheTimestamp) < CACHE_TTL) {
        return cachedDecryptedStore
    }

    try {
        const kodivianStoreStr = localStorage.getItem('kodivianStore')
        if (!kodivianStoreStr) {
            return null
        }

        let encryptedString = kodivianStoreStr
        try {
            const parsed = JSON.parse(kodivianStoreStr)
            encryptedString = typeof parsed === 'string' ? parsed : kodivianStoreStr
        } catch (parseError) {
            encryptedString = kodivianStoreStr
        }

        const cryptoKey = import.meta.env.VITE_SIMPLE_CRYPTO_KEY || process.env.REACT_APP_SIMPLE_CRYPTO_KEY || '$mrT@pP-6!dr'
        // SimpleCrypto is already imported at top level - use it directly
        const simpleCrypto = new SimpleCrypto(cryptoKey)
        const decryptedStore = simpleCrypto.decryptObject(encryptedString)

        // Cache the result
        cachedDecryptedStore = decryptedStore
        cacheTimestamp = now

        return decryptedStore
    } catch (error) {
        // Silently fail - return null if decryption fails
        return null
    }
}

/**
 * Clear the cache (useful when kodivianStore is updated)
 */
const clearCache = () => {
    cachedDecryptedStore = null
    cacheTimestamp = 0
}

const getCurrentUser = () => {
    if (!localStorage.getItem('user') || localStorage.getItem('user') === 'undefined') return undefined
    return JSON.parse(localStorage.getItem('user'))
}

const updateCurrentUser = (user) => {
    let stringifiedUser = user
    if (typeof user === 'object') {
        stringifiedUser = JSON.stringify(user)
    }
    localStorage.setItem('user', stringifiedUser)
}

const removeCurrentUser = () => {
    _removeFromStorage()
    clearAllCookies()
}

const _removeFromStorage = () => {
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('isGlobal')
    localStorage.removeItem('user')
    localStorage.removeItem('permissions')
    localStorage.removeItem('features')
    localStorage.removeItem('isSSO')
}

const clearAllCookies = () => {
    document.cookie.split(';').forEach((cookie) => {
        const name = cookie.split('=')[0].trim()
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
    })
}

/**
 * Extract user data from login response
 * Only extract essential fields: id, email, name
 * orgId and userId are NOT stored in Redux - they come from kodivianStore (encrypted)
 */
const extractUser = (payload) => {
    const user = {
        id: payload.id || payload.userId,
        email: payload.email || '',
        name: payload.name || payload.userName || ''
        // orgId and userId are NOT included - use getOrgIdFromStore()/getUserIdFromStore() instead
    }
    return user
}

/**
 * Update Redux state and localStorage
 * Note: orgId and userId are NOT stored in localStorage or Redux - they come from kodivianStore (encrypted)
 * Clear cache when user updates to ensure fresh data
 */
const updateStateAndLocalStorage = (state, payload) => {
    const user = extractUser(payload)
    state.user = user
    state.token = payload.token
    state.permissions = payload.permissions || []
    state.features = payload.features || {}
    state.isAuthenticated = true
    state.isGlobal = true // Always true for kodivian server

    // Store only non-sensitive user info in localStorage
    const userForStorage = {
        id: user.id,
        email: user.email,
        name: user.name
        // orgId and userId are NOT stored here - use getOrgIdFromStore() instead
    }

    localStorage.setItem('isAuthenticated', 'true')
    localStorage.setItem('isGlobal', 'true')
    localStorage.setItem('user', JSON.stringify(userForStorage))
    localStorage.setItem('permissions', JSON.stringify(payload.permissions || []))
    localStorage.setItem('features', JSON.stringify(payload.features || {}))

    // Clear cache to ensure fresh data if kodivianStore was updated
    clearCache()
}

/**
 * Get orgId from kodivianStore (encrypted, in-memory)
 * This is the source of truth for orgId - NOT stored in localStorage
 * Uses caching to avoid decrypting on every call
 */
const getOrgIdFromStore = () => {
    const decryptedStore = getDecryptedStore()
    if (!decryptedStore) {
        return undefined
    }

    const orgId = decryptedStore?.orgId
    return orgId ? String(orgId) : undefined
}

/**
 * Get userId from kodivianStore (encrypted, in-memory)
 * This is the source of truth for userId - NOT stored in localStorage
 * Uses caching to avoid decrypting on every call
 */
const getUserIdFromStore = () => {
    const decryptedStore = getDecryptedStore()
    if (!decryptedStore) {
        return undefined
    }

    const userId = decryptedStore?.userId
    return userId ? String(userId) : undefined
}

const AuthUtils = {
    getCurrentUser,
    updateCurrentUser,
    removeCurrentUser,
    updateStateAndLocalStorage,
    extractUser,
    getOrgIdFromStore,
    getUserIdFromStore,
    clearCache
}

export default AuthUtils
