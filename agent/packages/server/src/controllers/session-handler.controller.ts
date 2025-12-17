import { Request, Response } from 'express'
import { OrganizationConfigService } from '../services/org-config.service'
import { SessionService } from '../services/session.service'
import { AutonomousSessionService } from '../services/autonomous-session.service'
import { logInfo, logWarn, logError, logDebug } from '../utils/logger/system-helper'
const SimpleCrypto = require('simple-crypto-js').default

export class SessionHandlerController {
    private simpleCrypto: any

    constructor(
        private orgConfigService: OrganizationConfigService,
        private sessionService: SessionService,
        private autonomousSessionService: AutonomousSessionService
    ) {
        // Initialize SimpleCrypto with the same key as autonomous server
        this.simpleCrypto = new SimpleCrypto(process.env.SIMPLE_CRYPTO_KEY || '$mrT@pP-6!dr')
    }

    /**
     * Create session from main server
     * GET /api/v1/sessionhandler?params={base64({orgId, chainsysSessionId})}
     * EXACT IMPLEMENTATION from autonomous server
     */
    async createSession(req: Request, res: Response) {
        try {
            logInfo(`Session handler createSession called (path: ${req.path}, url: ${req.url}, method: ${req.method})`).catch(() => { })

            // Validate required parameters
            let params = req.query.params as string
            if (!params) {
                logWarn(`Session handler: params parameter missing (query: ${JSON.stringify(req.query)})`).catch(() => { })
                return res.status(400).json({ error: 'params parameter is required' })
            }

            // Handle URL-encoded quotes (params might come as %22...%22 which decodes to "..."")
            // Remove surrounding quotes if present
            if (params.startsWith('"') && params.endsWith('"')) {
                params = params.slice(1, -1)
                logDebug('Removed surrounding quotes from params').catch(() => { })
            }

            // Decode btoa encrypted parameters (exact logic from autonomous server)
            let decodedParams: { orgId: string; chainsysSessionId: string }
            try {
                const decodedString = Buffer.from(params, 'base64').toString('utf-8')
                decodedParams = JSON.parse(decodedString)
                logInfo(
                    `Successfully decoded params (orgId: ${decodedParams.orgId
                    }, chainsysSessionId: ${decodedParams.chainsysSessionId?.substring(0, 10)}...)`
                ).catch(() => { })
            } catch (error) {
                logError(
                    `Failed to decode params (paramsLength: ${params.length}, params: ${params.substring(0, 50)}...): ${error instanceof Error ? error.message : String(error)
                    }`,
                    error
                ).catch(() => { })
                return res.status(400).json({
                    error: 'Invalid base64 encoding or JSON format',
                    details: error instanceof Error ? error.message : String(error)
                })
            }

            // Validate decoded parameters
            if (!decodedParams.orgId || !decodedParams.chainsysSessionId) {
                return res.status(400).json({ error: 'Missing orgId or chainsysSessionId in params' })
            }

            const orgId = decodedParams.orgId
            const chainsysSessionId = decodedParams.chainsysSessionId

            // Validate organization configuration (exact logic from autonomous server)
            if (!this.orgConfigService.hasOrg(parseInt(orgId))) {
                return res.status(400).json({ error: `Organization ${orgId} is not configured` })
            }
            let sessionIdFromCookie = req.cookies?.session_id || null

            // Check existing AUTOID cookie (exact logic from autonomous server)
            const existingToken = req.cookies?.AUTOID
            if (existingToken) {
                const existingSession = await this.autonomousSessionService.validateAutonomousSession(existingToken, orgId)

                if (existingSession) {
                    // Use extendAutonomousSessionWithData to avoid double validation
                    await this.autonomousSessionService.extendAutonomousSessionWithData(existingToken, orgId, existingSession)

                    // Redirect to home page with existing session
                    const proxyUrl = process.env.PROXY_URL || ''
                    const contextPath = this.orgConfigService.getContextPath(parseInt(orgId)) || '/autonomous'
                    const cleanContextPath = contextPath.startsWith('/') ? contextPath.substring(1) : contextPath
                    const homePageUrl = `${proxyUrl}/${cleanContextPath}`
                    if (!process.env.SKIP_DESIGNER_SERVICE || process.env.SKIP_DESIGNER_SERVICE !== 'true') {
                    sessionIdFromCookie['appBuilderURL'] = existingSession?.userData?.UserInfoDetails?.appBuilderURL || ''
                    sessionIdFromCookie['contextpath'] = existingSession?.userData?.UserInfoDetails?.contextName || ''
                    res.cookie('session_id', sessionIdFromCookie);
                    }
                    return res.redirect(homePageUrl)
                } else {
                    // Clear invalid cookie
                    res.clearCookie('AUTOID', {
                        path: '/',
                        domain: process.env.SESSION_COOKIE_DOMAIN || undefined
                    })
                }
            }

            // Validate chainsysSessionId and fetch user data (exact logic from autonomous server)
            let userData: any
            try {
                userData = await this.sessionService.validateChainsysSession(orgId, chainsysSessionId)
                if (!process.env.SKIP_DESIGNER_SERVICE || process.env.SKIP_DESIGNER_SERVICE !== 'true') {
                sessionIdFromCookie['appBuilderURL'] = userData?.UserInfoDetails?.appBuilderURL || ''
                sessionIdFromCookie['contextpath'] = userData?.UserInfoDetails?.contextName || ''
                res.cookie('session_id', sessionIdFromCookie);
                }
            } catch (sessionError) {
                logError(
                    `Chainsys session validation failed (orgId: ${orgId}, chainsysSessionId: ${chainsysSessionId}): ${sessionError instanceof Error ? sessionError.message : String(sessionError)
                    }`,
                    sessionError
                ).catch(() => { })
                return res.status(500).json({
                    error: `Failed to validate session: ${sessionError instanceof Error ? sessionError.message : String(sessionError)}`
                })
            }

            // Format user data for localStorage (exact logic from autonomous server)
            const formattedUserData = this.sessionService.getUserDataForLocalStorage(userData)

            // Create lightweight autonomous server session (exact logic from autonomous server)
            let autonomousToken: string
            try {
                autonomousToken = await this.autonomousSessionService.createAutonomousSession(
                    chainsysSessionId,
                    formattedUserData.userId,
                    orgId,
                    userData
                )
            } catch (sessionError) {
                logError(
                    `Autonomous session creation failed (orgId: ${orgId}, chainsysSessionId: ${chainsysSessionId}, userId: ${formattedUserData.userId
                    }): ${sessionError instanceof Error ? sessionError.message : String(sessionError)}`,
                    sessionError
                ).catch(() => { })
                return res.status(500).json({
                    error: `Failed to create autonomous session: ${sessionError instanceof Error ? sessionError.message : String(sessionError)
                        }`
                })
            }

            // Prepare localStorage data (exact logic from autonomous server)
            // Build baseUrl: proxyUrl + contextPath + /api/v1
            const proxyUrl = process.env.PROXY_URL || ''
            const contextPath = this.orgConfigService.getContextPath(parseInt(orgId)) || '/autonomous'

            // Remove leading slash from contextPath to avoid double slashes
            const cleanContextPath = contextPath.startsWith('/') ? contextPath.substring(1) : contextPath
            const baseUrl = `${proxyUrl}/${cleanContextPath}/api/v1`

            logInfo(
                `Setting baseUrl in localStorage (orgId: ${orgId}, proxyUrl: ${proxyUrl}, contextPath: ${contextPath}, baseUrl: ${baseUrl})`
            ).catch(() => { })

            // Send only necessary fields for autonomous frontend (exact structure from autonomous server)
            const autonomousStore = {
                sessionId: autonomousToken, // AUTOID for session validation
                baseUrl: baseUrl, // API base URL for requests
                orgId: orgId, // Organization ID
                userId: formattedUserData.userId, // User ID
                userName: formattedUserData.userName, // User name for display
                email: formattedUserData.email // User email for display
            }

            // Encrypt only autonomousStore (exact logic from autonomous server)
            const encryptionResult = {
                autonomousStore: JSON.stringify(this.simpleCrypto.encryptObject(autonomousStore))
            }

            // Set AUTOID cookie (exact settings from autonomous server)
            const cookieDomain = process.env.SESSION_COOKIE_DOMAIN || undefined
            let cleanCookieDomain = cookieDomain?.startsWith('.') ? cookieDomain.substring(1) : cookieDomain

            // For localhost, don't set domain (cookies work better without domain on localhost)
            if (!cleanCookieDomain || cleanCookieDomain === 'localhost' || cleanCookieDomain.includes('localhost')) {
                cleanCookieDomain = undefined
            }

            const cookieOptions: any = {
                path: '/',
                httpOnly: true,
                signed: false,
                maxAge: 900 * 1000, // 15 minutes in milliseconds
                sameSite: 'lax' as const,
                secure: process.env.NODE_ENV === 'production'
            }

            // Only set domain if it's not localhost
            if (cleanCookieDomain) {
                cookieOptions.domain = cleanCookieDomain
            }

            logInfo(
                `Setting AUTOID cookie (orgId: ${orgId}, domain: ${cleanCookieDomain || 'not set (localhost)'}, path: ${cookieOptions.path
                }, httpOnly: ${cookieOptions.httpOnly}, sameSite: ${cookieOptions.sameSite}, secure: ${cookieOptions.secure})`
            ).catch(() => { })

            res.cookie('AUTOID', autonomousToken, cookieOptions)

            // Generate HTML exactly like autonomous server (exact HTML from autonomous server)
            const homePageUrl = `${proxyUrl}/${cleanContextPath}`
            const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8' />
    <meta name='viewport' content='initial-scale=1, maximum-scale=1, user-scalable=no, width=device-width' />
    <title>Setting up your session...</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
        }
        .loading-container {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="spinner"></div>
        <p>Setting up your session...</p>
    </div>
    <script>
        try {
            // Set autonomousStore (separate from Browser App's localStore to avoid collision)
            // Note: autonomousStore is encrypted and JSON stringified, so we need to quote it
            localStorage.setItem('autonomousStore', '${encryptionResult.autonomousStore.replace(/'/g, "\\'")}');
            
            window.location.href = '${homePageUrl}';
        } catch (error) {
            console.error('Error setting up localStorage:', error);
            document.body.innerHTML = '<div class="loading-container"><p>Error setting up session. Please try again.</p></div>';
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
     * GET /api/v1/sessionhandler/check-session
     * EXACT IMPLEMENTATION from autonomous server
     */
    async checkSession(req: Request, res: Response) {
        try {
            const autonomousToken = req.cookies?.AUTOID

            if (!autonomousToken) {
                return res.json({ valid: false, message: 'No session cookie found' })
            }

            // Extract orgId from token (format: {uuid}$${chainsysSessionId}$${userId}$$Auto{orgId})
            const parts = autonomousToken.split('$$')
            const autoPart = parts[parts.length - 1] // "Auto{orgId}"

            if (!autoPart || !autoPart.startsWith('Auto')) {
                return res.json({ valid: false, message: 'Invalid token format' })
            }

            const orgId = autoPart.substring(4) // Remove "Auto" prefix to get orgId

            if (!orgId) {
                return res.json({ valid: false, message: 'Invalid token format - missing orgId' })
            }

            logInfo(`Checking autonomous session (orgId: ${orgId}, token: ${autonomousToken.substring(0, 30)}...)`).catch(() => { })

            // Validate autonomous session from Redis (exact logic from autonomous server)
            const sessionData = await this.autonomousSessionService.validateAutonomousSession(autonomousToken, orgId)

            if (sessionData) {
                // Extend session TTL using already-validated session data
                await this.autonomousSessionService.extendAutonomousSessionWithData(autonomousToken, orgId, sessionData)

                logInfo(
                    `Autonomous session validation successful and extended (orgId: ${orgId}, userId: ${sessionData.userId
                    }, token: ${autonomousToken.substring(0, 30)}...)`
                ).catch(() => { })

                return res.json({ valid: true, message: 'Session is valid and extended', orgId })
            } else {
                logWarn(
                    `Autonomous session validation failed - session not found or expired (orgId: ${orgId}, token: ${autonomousToken.substring(
                        0,
                        30
                    )}...)`
                ).catch(() => { })

                return res.json({ valid: false, message: 'Session expired or not found' })
            }
        } catch (error) {
            logError(`Autonomous session validation error: ${error instanceof Error ? error.message : String(error)}`, error).catch(
                () => { }
            )

            let errorMessage = 'Session validation error'
            if (error instanceof Error && error.message.includes('Redis pool not found')) {
                // Try to extract orgId from token if available
                const token = (req.query?.token as string) || ''
                const parts = token.split('$$')
                const autoPart = parts[parts.length - 1]
                const orgId = autoPart?.startsWith('Auto') ? autoPart.substring(4) : 'unknown'
                errorMessage = `Organization ${orgId} is not configured. Please contact administrator.`
            } else if (error instanceof Error && error.message.includes('Invalid token format')) {
                errorMessage = 'Invalid session token'
            }

            return res.json({ valid: false, message: errorMessage })
        }
    }
}
