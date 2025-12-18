/**
 * Simplified Autonomous Session Service for Single-Org Kodivian
 * No Redis for session storage - uses in-memory Map (suitable for single-instance deployment)
 * Redis can still be used for prediction queue elsewhere
 */

import { logInfo, logError, logWarn } from '../utils/logger/system-helper'
import { v4 as uuidv4 } from 'uuid'

interface SessionData {
    userId: string
    chainsysSessionId: string
    orgId: string
    userData: any
    createdAt: number
}

export class AutonomousSessionService {
    // In-memory session store (for single-instance deployment)
    private sessions: Map<string, SessionData> = new Map()
    private readonly SESSION_TTL = parseInt(process.env.SESSION_COOKIE_MAX_AGE || '900') * 1000 // Convert to ms

    // Accept optional orgConfigService for backward compatibility (not used in single-org mode)
    constructor(private orgConfigService?: any) { }

    /**
     * Initialize - no Redis pools needed for single-org
     */
    async initializeRedisPools(): Promise<void> {
        logInfo('✅ Session service initialized (in-memory mode for single-org)').catch(() => { })
    }

    /**
     * Create autonomous session
     * Token format: {uuid}$${chainsysSessionId}$${userId}$$Auto{orgId}
     */
    async createAutonomousSession(
        chainsysSessionId: string,
        userId: string,
        orgId: string,
        userData: any
    ): Promise<string> {
        try {
            // Generate token (exact format from autonomous server)
            const token = `${uuidv4()}$$${chainsysSessionId}$$${userId}$$Auto${orgId}`

            // Store session in memory
            const sessionData: SessionData = {
                userId,
                chainsysSessionId,
                orgId,
                userData,
                createdAt: Date.now()
            }

            this.sessions.set(token, sessionData)

            // Clean up expired sessions periodically
            this.cleanupExpiredSessions()

            logInfo(`Session created (userId: ${userId}, orgId: ${orgId})`).catch(() => { })
            return token
        } catch (error) {
            logError(`Failed to create session: ${error instanceof Error ? error.message : String(error)}`, error).catch(() => { })
            throw error
        }
    }

    /**
     * Validate autonomous session
     */
    async validateAutonomousSession(token: string, orgId: string): Promise<any> {
        try {
            const sessionData = this.sessions.get(token)

            if (!sessionData) {
                logWarn(`Session not found: ${token.substring(0, 30)}...`).catch(() => { })
                return null
            }

            // Check if session expired
            if (Date.now() - sessionData.createdAt > this.SESSION_TTL) {
                this.sessions.delete(token)
                logWarn(`Session expired: ${token.substring(0, 30)}...`).catch(() => { })
                return null
            }

            return sessionData
        } catch (error) {
            logError(`Session validation error: ${error instanceof Error ? error.message : String(error)}`, error).catch(() => { })
            return null
        }
    }

    /**
     * Extend session TTL
     */
    async extendAutonomousSession(token: string, orgId: string): Promise<boolean> {
        const sessionData = await this.validateAutonomousSession(token, orgId)
        if (sessionData) {
            return this.extendAutonomousSessionWithData(token, orgId, sessionData)
        }
        return false
    }

    /**
     * Extend session using already-validated data
     */
    async extendAutonomousSessionWithData(token: string, orgId: string, sessionData: any): Promise<boolean> {
        try {
            // Reset creation time to extend TTL
            sessionData.createdAt = Date.now()
            this.sessions.set(token, sessionData)
            return true
        } catch (error) {
            logError(`Failed to extend session: ${error instanceof Error ? error.message : String(error)}`, error).catch(() => { })
            return false
        }
    }

    /**
     * Delete session
     */
    async deleteAutonomousSession(token: string, orgId: string): Promise<boolean> {
        try {
            this.sessions.delete(token)
            return true
        } catch (error) {
            logError(`Failed to delete session: ${error instanceof Error ? error.message : String(error)}`, error).catch(() => { })
            return false
        }
    }

    /**
     * Cleanup expired sessions (called periodically)
     */
    private cleanupExpiredSessions(): void {
        const now = Date.now()
        for (const [token, sessionData] of this.sessions.entries()) {
            if (now - sessionData.createdAt > this.SESSION_TTL) {
                this.sessions.delete(token)
            }
        }
    }
}
