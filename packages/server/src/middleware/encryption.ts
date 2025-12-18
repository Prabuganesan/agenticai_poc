import { Request, Response, NextFunction } from 'express'
import { isEncryptionEnabled, decryptDataSimple, encryptDataSimple } from '../utils/crypto'
import { getSessionKey } from '../controllers/crypto'
import { logError, logDebug } from '../utils/logger/system-helper'

/**
 * Middleware to decrypt incoming encrypted requests
 */
export const decryptRequestMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Skip if encryption is disabled
        if (!isEncryptionEnabled()) {
            return next()
        }

        // Check if request is encrypted
        const isEncrypted = req.headers['x-encrypted'] === 'true'
        if (!isEncrypted || !req.body?.encrypted) {
            return next()
        }

        // Get session ID from cookie or header
        const sessionId = (req as any).sessionID || (req.headers['x-session-id'] as string)
        if (!sessionId) {
            logDebug('[Encryption] No session ID found, skipping decryption').catch(() => {})
            return next()
        }

        // Get session key
        const sessionKey = await getSessionKey(sessionId)
        if (!sessionKey) {
            logDebug('[Encryption] No session key found, skipping decryption').catch(() => {})
            return next()
        }

        // Decrypt request body (using simplified crypto-js for client compatibility)
        const { encrypted } = req.body
        const decrypted = decryptDataSimple(encrypted, sessionKey)
        req.body = JSON.parse(decrypted)

        logDebug('[Encryption] Request decrypted successfully').catch(() => {})
        next()
    } catch (error) {
        logError('[Encryption] Failed to decrypt request:', error).catch(() => {})
        next(error)
    }
}

/**
 * Middleware to encrypt outgoing responses
 */
export const encryptResponseMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Skip if encryption is disabled
        if (!isEncryptionEnabled()) {
            res.setHeader('X-Encryption-Enabled', 'false')
            return next()
        }

        res.setHeader('X-Encryption-Enabled', 'true')

        // Check if client requested encryption
        const clientWantsEncryption = req.headers['x-encrypted'] === 'true'
        if (!clientWantsEncryption) {
            return next()
        }

        // Get session ID
        const sessionId = (req as any).sessionID || (req.headers['x-session-id'] as string)
        if (!sessionId) {
            return next()
        }

        // Get session key
        const sessionKey = await getSessionKey(sessionId)
        if (!sessionKey) {
            return next()
        }

        // Intercept res.json to encrypt response
        const originalJson = res.json.bind(res)
        res.json = function (body: any) {
            try {
                const plaintext = JSON.stringify(body)
                const encrypted = encryptDataSimple(plaintext, sessionKey)

                res.setHeader('X-Encrypted', 'true')
                return originalJson({ encrypted })
            } catch (error) {
                logError('[Encryption] Failed to encrypt response:', error).catch(() => {})
                return originalJson(body)
            }
        }

        next()
    } catch (error) {
        logError('[Encryption] Encryption middleware error:', error).catch(() => {})
        next()
    }
}
