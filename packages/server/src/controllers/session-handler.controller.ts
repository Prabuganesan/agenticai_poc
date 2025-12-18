/**
 * Simplified Session Handler Controller for Single-Org Kodivian
 * Simplified auth flow - set cookie directly, no Redis for session storage (Redis still available for prediction queue)
 */

import { Request, Response } from 'express'
import { OrganizationConfigService } from '../services/org-config.service'
import { SessionService } from '../services/session.service'
import { AutonomousSessionService } from '../services/autonomous-session.service'
import { logInfo, logWarn, logError } from '../utils/logger/system-helper'
const SimpleCrypto = require('simple-crypto-js').default

export class SessionHandlerController {
    private simpleCrypto: any

    constructor(
        private orgConfigService: OrganizationConfigService,
        private sessionService: SessionService,
        private autonomousSessionService: AutonomousSessionService
    ) {
        this.simpleCrypto = new SimpleCrypto(process.env.SIMPLE_CRYPTO_KEY || '$mrT@pP-6!dr')
    }

    /**
     * Create session - simplified for single-org
     * GET /api/v1/sessionhandler?params={base64({orgId, chainsysSessionId})}
     */
    async createSession(req: Request, res: Response) {
        try {
            logInfo(`Session handler createSession called`).catch(() => { })

            // For single-org mode, we can accept requests with or without params
            // IMPORTANT: In single-org mode, we ALWAYS use orgId 1 regardless of client params
            const orgId = '1' // Always force org 1 for single-org mode
            let SessionId = ''

            // Try to parse params if provided (only use chainsysSessionId, ignore orgId from client)
            const params = req.query.params as string
            if (params) {
                try {
                    const cleanParams = params.startsWith('"') && params.endsWith('"') ? params.slice(1, -1) : params
                    const decodedString = Buffer.from(cleanParams, 'base64').toString('utf-8')
                    const decodedParams = JSON.parse(decodedString)
                    // Note: We ignore decodedParams.orgId - always use 1 for single-org
                    SessionId = decodedParams.chainsysSessionId || ''
                    if (decodedParams.orgId && decodedParams.orgId !== '1') { // Changed 1 to '1' for string comparison
                        logInfo(`Session validated (single-org mode) - ignoring client orgId: ${decodedParams.orgId}, using orgId: 1`).catch(() => { })
                    }
                } catch (error) {
                    // Use defaults if parsing fails
                    logWarn('Using default org 1 (params parse failed)').catch(() => { })
                }
            }

            // Check existing KODIID cookie
            const existingToken = req.cookies?.KODIID
            if (existingToken) {
                const existingSession = await this.autonomousSessionService.validateAutonomousSession(existingToken, orgId)
                if (existingSession) {
                    await this.autonomousSessionService.extendAutonomousSessionWithData(existingToken, orgId, existingSession)
                    const proxyUrl = process.env.PROXY_URL || ''
                    const contextPath = this.orgConfigService.getContextPath(parseInt(orgId)) || '/kodivian'
                    const cleanContextPath = contextPath.startsWith('/') ? contextPath.substring(1) : contextPath
                    return res.redirect(`${proxyUrl}/${cleanContextPath}`)
                }
            }

            // Get default user data (single-org mode)
            const userData = await this.sessionService.validateChainsysSession(orgId, SessionId)
            const formattedUserData = this.sessionService.getUserDataForLocalStorage(userData)

            // Create session
            const autonomousToken = await this.autonomousSessionService.createAutonomousSession(
                SessionId || 'single-org-session',
                formattedUserData.userId,
                orgId,
                userData
            )

            // Prepare localStorage data
            const proxyUrl = process.env.PROXY_URL || ''
            const contextPath = this.orgConfigService.getContextPath(parseInt(orgId)) || '/kodivian'
            const cleanContextPath = contextPath.startsWith('/') ? contextPath.substring(1) : contextPath
            const baseUrl = `${proxyUrl}/${cleanContextPath}/api/v1`

            const autonomousStore = {
                sessionId: autonomousToken,
                baseUrl: baseUrl,
                orgId: orgId,
                userId: formattedUserData.userId,
                userName: formattedUserData.userName,
                email: formattedUserData.email
            }

            const encryptionResult = {
                autonomousStore: JSON.stringify(this.simpleCrypto.encryptObject(autonomousStore))
            }

            // Set KODIID cookie
            const cookieOptions: any = {
                path: '/',
                httpOnly: true,
                maxAge: 900 * 1000, // 15 minutes
                sameSite: 'lax' as const,
                secure: process.env.NODE_ENV === 'production'
            }

            res.cookie('KODIID', autonomousToken, cookieOptions)

            // Generate redirect HTML
            const homePageUrl = `${proxyUrl}/${cleanContextPath}`
            const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8' />
    <title>Setting up your session...</title>
    <style>
        body { font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
        .loading { text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="loading"><div class="spinner"></div><p>Setting up session...</p></div>
    <script>
        try {
            localStorage.setItem('autonomousStore', '${encryptionResult.autonomousStore.replace(/'/g, "\\'")}');
            window.location.href = '${homePageUrl}';
        } catch (e) {
            document.body.innerHTML = '<div class="loading"><p>Error. Please try again.</p></div>';
        }
    </script>
</body>
</html>`

            return res.type('text/html').send(htmlContent)
        } catch (error) {
            logError(`Session creation failed: ${error instanceof Error ? error.message : String(error)}`, error).catch(() => { })
            return res.status(500).json({ error: 'Failed to create session' })
        }
    }

    /**
     * Check session validity
     */
    async checkSession(req: Request, res: Response) {
        try {
            const autonomousToken = req.cookies?.KODIID

            if (!autonomousToken) {
                return res.json({ valid: false, message: 'No session cookie found' })
            }

            // Extract orgId from token
            const parts = autonomousToken.split('$$')
            const autoPart = parts[parts.length - 1]

            if (!autoPart?.startsWith('Auto')) {
                return res.json({ valid: false, message: 'Invalid token format' })
            }

            const orgId = autoPart.substring(4)
            const sessionData = await this.autonomousSessionService.validateAutonomousSession(autonomousToken, orgId)

            if (sessionData) {
                await this.autonomousSessionService.extendAutonomousSessionWithData(autonomousToken, orgId, sessionData)
                return res.json({ valid: true, message: 'Session valid', orgId })
            }

            return res.json({ valid: false, message: 'Session expired' })
        } catch (error) {
            logError(`Session check error: ${error instanceof Error ? error.message : String(error)}`, error).catch(() => { })
            return res.json({ valid: false, message: 'Session validation error' })
        }
    }
}
