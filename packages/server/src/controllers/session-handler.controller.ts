/**
 * Simplified Session Handler Controller for Single-Org Kodivian
 * Simplified auth flow - set cookie directly, no Redis for session storage (Redis still available for prediction queue)
 */

import { Request, Response } from 'express'
import { OrganizationConfigService } from '../services/org-config.service'
import { SessionService } from '../services/session.service'
import { KodivianSessionService } from '../services/kodivian-session.service'
import { logInfo, logWarn, logError } from '../utils/logger/system-helper'
const SimpleCrypto = require('simple-crypto-js').default

export class SessionHandlerController {
    private simpleCrypto: any

    constructor(
        private orgConfigService: OrganizationConfigService,
        private sessionService: SessionService,
        private kodivianSessionService: KodivianSessionService
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

            // For single-org mode, we ALWAYS use orgId 1 explicitly
            const orgId = '1'
            const SessionId = 'single-org-session'

            // Get default user data (single-org mode)
            // No validation against external session ID needed
            const userData = this.sessionService.getDefaultUserData()
            const formattedUserData = this.sessionService.getUserDataForLocalStorage(userData)

            // Create session
            const autonomousToken = await this.kodivianSessionService.createKodivianSession(
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

            const kodivianStore = {
                sessionId: autonomousToken,
                baseUrl: baseUrl,
                orgId: orgId,
                userId: formattedUserData.userId,
                userName: formattedUserData.userName,
                email: formattedUserData.email
            }

            const encryptionResult = {
                kodivianStore: JSON.stringify(this.simpleCrypto.encryptObject(kodivianStore))
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
            localStorage.setItem('kodivianStore', '${encryptionResult.kodivianStore.replace(/'/g, "\\'")}');
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

            if (!autoPart?.startsWith('Kodi')) {
                return res.json({ valid: false, message: 'Invalid token format' })
            }

            const orgId = autoPart.substring(4)
            const sessionData = await this.kodivianSessionService.validateKodivianSession(autonomousToken, orgId)

            if (sessionData) {
                await this.kodivianSessionService.extendKodivianSessionWithData(autonomousToken, orgId, sessionData)
                return res.json({ valid: true, message: 'Session valid', orgId })
            }

            return res.json({ valid: false, message: 'Session expired' })
        } catch (error) {
            logError(`Session check error: ${error instanceof Error ? error.message : String(error)}`, error).catch(() => { })
            return res.json({ valid: false, message: 'Session validation error' })
        }
    }
}
