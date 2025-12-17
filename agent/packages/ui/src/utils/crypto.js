import CryptoJS from 'crypto-js'
import JSEncrypt from 'jsencrypt'

let sessionKey = null
let publicKey = null
let encryptionEnabled = false
let sessionId = null

/**
 * Generate or get session ID
 */
const getSessionId = () => {
    if (sessionId) return sessionId

    // Try to get from cookie
    const cookies = document.cookie.split(';')
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=')
        if (name === 'AUTOID') {
            sessionId = value
            return sessionId
        }
    }

    // Generate new session ID
    sessionId = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex)
    return sessionId
}

/**
 * Initialize encryption on app startup
 */
export const initializeEncryption = async (baseURL) => {
    try {
        if (import.meta.env.DEV) {
            console.log('[Encryption] Initializing E2E encryption...')
        }

        // Check if encryption is enabled
        const statusRes = await fetch(`${baseURL}/api/v1/crypto/status`, {
            credentials: 'include'
        })
        const statusData = await statusRes.json()
        encryptionEnabled = statusData.enabled

        if (!encryptionEnabled) {
            if (import.meta.env.DEV) {
                console.log('[Encryption] E2E encryption is DISABLED on server')
            }
            return false
        }

        // Get public key
        const keyRes = await fetch(`${baseURL}/api/v1/crypto/public-key`, {
            credentials: 'include'
        })
        const keyData = await keyRes.json()
        publicKey = keyData.publicKey

        // Generate session key (32 bytes = 256 bits)
        sessionKey = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Base64)

        // Encrypt session key with RSA public key
        const encrypt = new JSEncrypt()
        encrypt.setPublicKey(publicKey)
        const encryptedSessionKey = encrypt.encrypt(sessionKey)

        if (!encryptedSessionKey) {
            throw new Error('Failed to encrypt session key')
        }

        // Get or generate session ID
        const sid = getSessionId()

        // Send handshake
        const handshakeRes = await fetch(`${baseURL}/api/v1/crypto/handshake`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                encryptedSessionKey,
                sessionId: sid
            })
        })

        if (!handshakeRes.ok) {
            throw new Error('Handshake failed')
        }

        if (import.meta.env.DEV) {
            console.log('[Encryption] ✅ E2E encryption initialized successfully')
        }
        return true
    } catch (error) {
        console.error('[Encryption] ❌ Failed to initialize:', error)
        encryptionEnabled = false
        return false
    }
}

/**
 * Check if encryption is enabled
 */
export const isEncryptionEnabled = () => {
    return encryptionEnabled
}

/**
 * Encrypt request data (simplified AES for compatibility)
 */
export const encryptRequest = (data) => {
    if (!encryptionEnabled || !sessionKey) {
        return data
    }

    try {
        const plaintext = JSON.stringify(data)
        const encrypted = CryptoJS.AES.encrypt(plaintext, sessionKey).toString()

        // For simplified implementation, we use crypto-js which doesn't expose IV/tag separately
        // In production, use Web Crypto API for proper AES-GCM
        return {
            encrypted,
            iv: '', // Included in ciphertext
            tag: '' // Included in ciphertext
        }
    } catch (error) {
        console.error('[Encryption] Failed to encrypt request:', error)
        return data
    }
}

/**
 * Decrypt response data
 */
export const decryptResponse = (encryptedData) => {
    if (!encryptionEnabled || !sessionKey) {
        return encryptedData
    }

    try {
        const { encrypted } = encryptedData
        const decrypted = CryptoJS.AES.decrypt(encrypted, sessionKey)
        const plaintext = decrypted.toString(CryptoJS.enc.Utf8)

        if (!plaintext) {
            throw new Error('Decryption resulted in empty string')
        }

        return JSON.parse(plaintext)
    } catch (error) {
        console.error('[Encryption] Failed to decrypt response:', error)
        return encryptedData
    }
}

/**
 * Decrypt SSE event data (simple)
 */
export const decryptSSEData = (encryptedData) => {
    if (!encryptionEnabled || !sessionKey) {
        return encryptedData
    }

    try {
        if (typeof encryptedData !== 'string') {
            return encryptedData
        }

        const decrypted = CryptoJS.AES.decrypt(encryptedData, sessionKey)
        const plaintext = decrypted.toString(CryptoJS.enc.Utf8)

        if (!plaintext) {
            return encryptedData
        }

        return plaintext
    } catch (error) {
        console.error('[Encryption] Failed to decrypt SSE data:', error)
        return encryptedData
    }
}

/**
 * Get session ID for headers
 */
export const getEncryptionSessionId = () => {
    return getSessionId()
}
