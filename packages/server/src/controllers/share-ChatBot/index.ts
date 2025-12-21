import { Response, NextFunction } from 'express'
const SimpleCryptoConfig = require('simple-crypto-js').default
const simpleCrypto = new SimpleCryptoConfig(process.env.SIMPLE_CRYPTO_KEY || '$mrT@pP-6!dr')

const shareChatBot = async (req: any, res: Response, next: NextFunction) => {
    // Get services from request (attached by route middleware)
    const orgConfigService = req.orgConfigService
    const kodivianSessionService = req.kodivianSessionService
    const sessionService = req.sessionService

    // Validate required dependencies
    if (!orgConfigService || !kodivianSessionService || !sessionService) {
        return res.status(500).json({ error: 'Server configuration error' })
    }

    const orgId = req.orgId
    const existingToken = req.cookies?.KODIID
    const chatId = req.params.id

    try {
        if (existingToken) {
            const existingSession = await kodivianSessionService.validateKodivianSession(existingToken, orgId)

            if (existingSession) {
                await kodivianSessionService.extendKodivianSessionWithData(existingToken, orgId, existingSession)

                const proxyUrl = process.env.PROXY_URL || ''
                const contextPath = orgConfigService.getContextPath(parseInt(orgId)) || '/autonomous'
                const cleanContextPath = contextPath.startsWith('/') ? contextPath.substring(1) : contextPath
                const chatBotPageUrl = `${proxyUrl}/${cleanContextPath}/chatbot/${chatId}`
                const baseUrl = `${proxyUrl}/${cleanContextPath}/api/v1`

                let userData: any
                const chainsysSessionId = existingSession['chainsysSessionId']
                try {
                    userData = await sessionService.validateChainsysSession(orgId, chainsysSessionId)
                } catch (sessionError) {
                    return res.status(500).json({
                        error: `Failed to validate session: ${sessionError instanceof Error ? sessionError.message : String(sessionError)}`
                    })
                }

                // Format user data for localStorage (exact logic from kodivian server)
                const formattedUserData = sessionService.getUserDataForLocalStorage(userData)

                const kodivianStore = {
                    sessionId: existingToken, // KODIID for session validation
                    baseUrl: baseUrl, // API base URL for requests
                    orgId: orgId, // Organization ID
                    userId: formattedUserData.userId, // User ID
                    userName: formattedUserData.userName, // User name for display
                    email: formattedUserData.email // User email for display
                }

                // Encrypt only kodivianStore (exact logic from kodivian server)
                const encryptionResult = {
                    kodivianStore: JSON.stringify(simpleCrypto.encryptObject(kodivianStore))
                }

                // Set KODIID cookie (exact settings from kodivian server)
                const cookieDomain = process.env.COOKIE_DOMAIN || undefined
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

                res.cookie('KODIID', existingToken, cookieOptions)

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
            // Set kodivianStore (separate from Browser App's localStore to avoid collision)
            // Note: kodivianStore is encrypted and JSON stringified, so we need to quote it
            localStorage.setItem('kodivianStore', '${encryptionResult.kodivianStore.replace(/'/g, "\\'")}');
            
            window.location.href = '${chatBotPageUrl}';
        } catch (error) {
            console.error('Error setting up localStorage:', error);
            document.body.innerHTML = '<div class="loading-container"><p>Error setting up session. Please try again.</p></div>';
        }
    </script>
</body>
</html>`

                return res.type('text/html').send(htmlContent)

                // return res.redirect(chatBotPageUrl)
            } else {
                // Invalid or expired session - could create new session or redirect to auth
                return res.status(401).json({ error: 'Session invalid or expired' })
            }
        } else {
            // No existing token - could create new session or redirect to auth flow
            return res.status(401).json({ error: 'No authentication token provided' })
        }
    } catch (error) {
        return res.status(500).json({
            error: 'Failed to process share chatbot request',
            details: error instanceof Error ? error.message : String(error)
        })
    }
}

export default {
    shareChatBot
}
