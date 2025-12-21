import { Request, Response, NextFunction } from 'express'
import { KodivianSessionService } from '../services/kodivian-session.service'
import { OrganizationConfigService } from '../services/org-config.service'
import { logError, logWarn } from '../utils/logger/system-helper'

export interface AuthenticatedRequest extends Omit<Request, 'user'> {
    user?: {
        userId: string
        userName: string
        email: string
        orgId: string
    }
    orgId?: string
    userId?: string
    sessionType?: string
}

/**
 * Create session validation middleware
 * EXACT IMPLEMENTATION from kodivian server SessionAuthGuard, adapted to Express
 */
export function createSessionValidationMiddleware(
    kodivianSessionService: KodivianSessionService,
    orgConfigService: OrganizationConfigService
) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            // Only check for kodivian server token (KODIID) - exact logic from kodivian server
            const autonomousToken = req.cookies?.KODIID

            if (!autonomousToken) {
                return res.status(401).json({ error: 'Session Expired' })
            }

            // Validate autonomous token (exact logic from kodivian server)
            return await validateAutonomousToken(autonomousToken, req, res, next)
        } catch (error) {
            logError(
                `Session authentication error (url: ${req.url}): ${error instanceof Error ? error.message : String(error)}`,
                error
            ).catch(() => { })
            return res.status(401).json({ error: 'Session Expired' })
        }
    }

    /**
     * Validate kodivian server session
     * EXACT IMPLEMENTATION from kodivian server
     */
    async function validateAutonomousToken(token: string, req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        // Extract orgId from token (format: {uuid}$${chainsysSessionId}$${userId}$$Auto{orgId})
        // EXACT LOGIC from kodivian server
        const parts = token.split('$$')
        const autoPart = parts[parts.length - 1] // "Kodi{orgId}"

        if (!autoPart || !autoPart.startsWith('Kodi')) {
            res.status(401).json({ error: 'Invalid token format' })
            return
        }

        const orgId = autoPart.substring(4) // Remove "Kodi" prefix to get orgId

        // Validate session (exact logic from kodivian server)
        const session = await kodivianSessionService.validateKodivianSession(token, orgId)

        if (!session) {
            logWarn(`Kodivian server session not found or expired (token: ${token.substring(0, 30)}...)`).catch(() => { })

            // Log security event - session validation failed
            try {
                const { securityLog } = await import('../utils/logger/module-methods')
                await securityLog('warn', 'Session validation failed', {
                    userId: 'unknown',
                    orgId: orgId || 'unknown',
                    ip: req.ip || req.socket.remoteAddress || 'unknown',
                    userAgent: req.headers['user-agent'] || 'unknown',
                    endpoint: req.path,
                    method: req.method,
                    reason: 'Session not found or expired'
                }).catch(() => { })
            } catch (logError) {
                // Silently fail - logging should not break authentication
            }

            res.status(401).json({ error: 'Autonomous session expired' })
            return
        }

        // Extend session TTL (exact logic from kodivian server)
        // Use the already-validated session data to avoid double validation
        // CRITICAL: Also refresh cookie to prevent browser from deleting it after initial expiration
        try {
            const extended = await kodivianSessionService.extendKodivianSessionWithData(token, orgId, session)

            if (extended) {
                // Refresh cookie expiration to match Redis TTL
                const { getCookieOptions } = await import('../utils/cookie')
                const ttl = parseInt(process.env.SESSION_COOKIE_MAX_AGE || '900')
                const cookieOptions = getCookieOptions(ttl)

                // Refresh the cookie with updated expiration
                res.cookie('KODIID', token, cookieOptions)
            } else {
                // Extension returned false - log warning
                logWarn(`Session extension returned false (orgId: ${orgId}, userId: ${session.userId})`).catch(() => { })
            }
        } catch (extensionError) {
            // Log error but don't fail the request - session is still valid for this request
            const errorContext: Record<string, any> =
                extensionError instanceof Error
                    ? { error: extensionError.message, stack: extensionError.stack }
                    : { error: String(extensionError) }
            logError(
                `Failed to extend session TTL (orgId: ${orgId}, userId: ${session.userId}, token: ${token.substring(0, 30)}...): ${extensionError instanceof Error ? extensionError.message : String(extensionError)
                }`,
                errorContext
            ).catch(() => { })
        }

        // Attach to request (exact structure from kodivian server)
        req.user = {
            userId: session.userId,
            userName: session.userData?.userName || session.userData?.UserInfoDetails?.UserInfo?.personalInfo?.userName || '',
            email: session.userData?.email || session.userData?.UserInfoDetails?.UserInfo?.personalInfo?.email || '',
            orgId: orgId
        }
        req.orgId = orgId
        req.userId = session.userId
        req.sessionType = 'AUTONOMOUS'

        // Validate orgId in request body matches session orgId (if provided)
        if (req.body && req.body.orgId && req.body.orgId !== orgId) {
            logWarn(`orgId mismatch in request (sessionOrgId: ${orgId}, bodyOrgId: ${req.body.orgId}, userId: ${session.userId})`).catch(
                () => { }
            )

            // Log security event - orgId mismatch
            try {
                const { securityLog } = await import('../utils/logger/module-methods')
                await securityLog('warn', 'Organization ID mismatch in request body', {
                    userId: session.userId || 'unknown',
                    orgId: orgId,
                    requestedOrgId: req.body.orgId,
                    ip: req.ip || req.socket.remoteAddress || 'unknown',
                    userAgent: req.headers['user-agent'] || 'unknown',
                    endpoint: req.path,
                    method: req.method
                }).catch(() => { })
            } catch (logError) {
                // Silently fail - logging should not break authentication
            }

            res.status(403).json({ error: 'Organization ID mismatch' })
            return
        }

        // Validate orgId in query parameters matches session orgId (if provided)
        if (req.query && req.query.orgId && req.query.orgId !== orgId) {
            logWarn(`orgId mismatch in query (sessionOrgId: ${orgId}, queryOrgId: ${req.query.orgId}, userId: ${session.userId})`).catch(
                () => { }
            )

            // Log security event - orgId mismatch
            try {
                const { securityLog } = await import('../utils/logger/module-methods')
                await securityLog('warn', 'Organization ID mismatch in query', {
                    userId: session.userId || 'unknown',
                    orgId: orgId,
                    requestedOrgId: req.query.orgId as string,
                    ip: req.ip || req.socket.remoteAddress || 'unknown',
                    userAgent: req.headers['user-agent'] || 'unknown',
                    endpoint: req.path,
                    method: req.method
                }).catch(() => { })
            } catch (logError) {
                // Silently fail - logging should not break authentication
            }

            res.status(403).json({ error: 'Organization ID mismatch' })
            return
        }

        // Log security event - successful session validation
        try {
            const { securityLog } = await import('../utils/logger/module-methods')
            await securityLog('info', 'Session validation successful', {
                userId: session.userId || 'unknown',
                orgId: orgId,
                ip: req.ip || req.socket.remoteAddress || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown',
                endpoint: req.path,
                method: req.method
            }).catch(() => { })
        } catch (logError) {
            // Silently fail - logging should not break authentication
        }

        // Ensure orgId is set in request body for POST/PUT/PATCH/DELETE requests
        if (req.body && typeof req.body === 'object') {
            req.body.orgId = orgId
        }

        // Ensure orgId is set in query parameters for GET requests (if not already set)
        if (req.method === 'GET' && req.query && typeof req.query === 'object') {
            req.query.orgId = orgId
        }

        next()
    }
}
