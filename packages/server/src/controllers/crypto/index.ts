import { Request, Response, NextFunction } from 'express'
import { getPublicKey, isEncryptionEnabled, decryptSessionKey } from '../../utils/crypto'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'

/**
 * Get RSA public key for client
 */
const getPublicKeyHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!isEncryptionEnabled()) {
            throw new InternalKodivianError(StatusCodes.NOT_FOUND, 'Encryption is not enabled')
        }

        const publicKey = getPublicKey()
        if (!publicKey) {
            throw new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, 'Public key not available')
        }

        return res.json({ publicKey })
    } catch (error) {
        next(error)
    }
}

/**
 * Get encryption status
 */
const getEncryptionStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        return res.json({
            enabled: isEncryptionEnabled()
        })
    } catch (error) {
        next(error)
    }
}

/**
 * Session key handshake
 * Client sends session key encrypted with RSA public key
 * Server decrypts and stores in Redis
 */
const handshake = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!isEncryptionEnabled()) {
            throw new InternalKodivianError(StatusCodes.NOT_FOUND, 'Encryption is not enabled')
        }

        const { encryptedSessionKey, sessionId } = req.body

        if (!encryptedSessionKey || !sessionId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Missing encryptedSessionKey or sessionId')
        }

        // Decrypt session key
        const sessionKey = decryptSessionKey(encryptedSessionKey)

        // Store session key in Redis (TTL: 24 hours)
        const serverApp = getRunningExpressApp()
        if (serverApp.cachePool) {
            const cacheKey = `e2e_session_key:${sessionId}`
            // Use Redis directly via CachePool
            const redisClient = (serverApp.cachePool as any).redisClient
            if (redisClient) {
                await redisClient.set(cacheKey, sessionKey, 'EX', 86400) // 24 hours
            } else {
                // Fallback to in-memory (for non-queue mode)
                ;(serverApp.cachePool as any).ssoTokenCache[cacheKey] = sessionKey
            }
        }

        return res.json({ success: true })
    } catch (error) {
        next(error)
    }
}

/**
 * Get session key from Redis
 */
export const getSessionKey = async (sessionId: string): Promise<string | null> => {
    try {
        const serverApp = getRunningExpressApp()
        if (!serverApp.cachePool) {
            return null
        }

        const cacheKey = `e2e_session_key:${sessionId}`
        const redisClient = (serverApp.cachePool as any).redisClient
        if (redisClient) {
            return await redisClient.get(cacheKey)
        } else {
            // Fallback to in-memory
            return (serverApp.cachePool as any).ssoTokenCache[cacheKey] || null
        }
    } catch (error) {
        return null
    }
}

export default {
    getPublicKey: getPublicKeyHandler,
    getEncryptionStatus,
    handshake
}
