import { randomBytes, createCipheriv, createDecipheriv, generateKeyPairSync, privateDecrypt } from 'crypto'
import { AES, enc } from 'crypto-js'
import { logInfo, logError } from './logger/system-helper'

/**
 * Check if end-to-end encryption is enabled
 */
export const isEncryptionEnabled = (): boolean => {
    return process.env.ENABLE_E2E_ENCRYPTION === 'true'
}

/**
 * RSA Key Pair for session key exchange
 */
let rsaKeyPair: { publicKey: string; privateKey: string } | null = null

/**
 * Initialize RSA key pair for encryption
 * Only called if encryption is enabled
 */
export const initializeEncryption = async (): Promise<void> => {
    if (!isEncryptionEnabled()) {
        logInfo('🔓 [Encryption]: E2E encryption is DISABLED').catch(() => {})
        return
    }

    try {
        // Generate RSA key pair (2048-bit)
        const { publicKey, privateKey } = generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        })

        rsaKeyPair = { publicKey, privateKey }
        logInfo('🔐 [Encryption]: E2E encryption is ENABLED - RSA key pair generated').catch(() => {})
    } catch (error) {
        logError('❌ [Encryption]: Failed to initialize encryption:', error).catch(() => {})
        throw error
    }
}

/**
 * Get RSA public key for client
 */
export const getPublicKey = (): string | null => {
    if (!isEncryptionEnabled() || !rsaKeyPair) {
        return null
    }
    return rsaKeyPair.publicKey
}

/**
 * Decrypt session key sent by client (encrypted with RSA public key)
 */
export const decryptSessionKey = (encryptedSessionKey: string): string => {
    if (!rsaKeyPair) {
        throw new Error('RSA key pair not initialized')
    }

    try {
        const buffer = Buffer.from(encryptedSessionKey, 'base64')
        const decrypted = privateDecrypt(
            {
                key: rsaKeyPair.privateKey,
                padding: 1 // RSA_PKCS1_PADDING
            },
            buffer
        )
        return decrypted.toString('utf8')
    } catch (error) {
        logError('❌ [Encryption]: Failed to decrypt session key:', error).catch(() => {})
        throw new Error('Failed to decrypt session key')
    }
}

/**
 * Generate random AES session key (256-bit)
 */
export const generateSessionKey = (): string => {
    return randomBytes(32).toString('base64')
}

/**
 * Encrypt data with AES-256-GCM
 */
export const encryptData = (data: string, sessionKey: string): { encrypted: string; iv: string; tag: string } => {
    try {
        // Generate random IV (12 bytes for GCM)
        const iv = randomBytes(12)
        const key = Buffer.from(sessionKey, 'base64')

        const cipher = createCipheriv('aes-256-gcm', key, iv)
        let encrypted = cipher.update(data, 'utf8', 'base64')
        encrypted += cipher.final('base64')

        const tag = cipher.getAuthTag()

        return {
            encrypted,
            iv: iv.toString('base64'),
            tag: tag.toString('base64')
        }
    } catch (error) {
        logError('❌ [Encryption]: Failed to encrypt data:', error).catch(() => {})
        throw new Error('Encryption failed')
    }
}

/**
 * Decrypt data with AES-256-GCM
 */
export const decryptData = (encrypted: string, sessionKey: string, iv: string, tag: string): string => {
    try {
        const key = Buffer.from(sessionKey, 'base64')
        const ivBuffer = Buffer.from(iv, 'base64')
        const tagBuffer = Buffer.from(tag, 'base64')

        const decipher = createDecipheriv('aes-256-gcm', key, ivBuffer)
        decipher.setAuthTag(tagBuffer)

        let decrypted = decipher.update(encrypted, 'base64', 'utf8')
        decrypted += decipher.final('utf8')

        return decrypted
    } catch (error) {
        logError('❌ [Encryption]: Failed to decrypt data:', error).catch(() => {})
        throw new Error('Decryption failed')
    }
}

/**
 * Encrypt data using crypto-js (for SSE compatibility - Base64 output)
 */
export const encryptDataSimple = (data: string, sessionKey: string): string => {
    try {
        return AES.encrypt(data, sessionKey).toString()
    } catch (error) {
        logError('❌ [Encryption]: Failed to encrypt data (simple):', error).catch(() => {})
        throw new Error('Encryption failed')
    }
}

/**
 * Decrypt data using crypto-js (for SSE compatibility)
 */
export const decryptDataSimple = (encrypted: string, sessionKey: string): string => {
    try {
        const decrypted = AES.decrypt(encrypted, sessionKey)
        return decrypted.toString(enc.Utf8)
    } catch (error) {
        logError('❌ [Encryption]: Failed to decrypt data (simple):', error).catch(() => {})
        throw new Error('Decryption failed')
    }
}
