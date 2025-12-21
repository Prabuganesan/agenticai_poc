import { Response, NextFunction } from "express"
import axios from 'axios';
const SimpleCryptoConfig = require('simple-crypto-js').default
const simpleCrypto = new SimpleCryptoConfig(process.env.SIMPLE_CRYPTO_KEY || '$mrT@pP-6!dr')

const previous = async (req: any, res: Response, next: NextFunction) => {
    const orgConfigService = req.orgConfigService
    const kodivianSessionService = req.kodivianSessionService
    const sessionService = req.sessionService
    
    if (!orgConfigService || !kodivianSessionService || !sessionService) {
        return res.status(500).json({ error: 'Server configuration error' })
    }

    const orgId = req.orgId
    const existingToken = req.cookies?.KODIID

    try {

        if (!existingToken) {
            return res.status(401).json({ error: 'No authentication token provided' })
        }

        // Validate the session
        const existingSession = await kodivianSessionService.validateKodivianSession(
            existingToken,
            orgId
        )

        if (existingSession) {
            // Extend session
            await kodivianSessionService.extendKodivianSessionWithData(existingToken, orgId, existingSession)
            
            // Parse session_id cookie (it might be a string or object)
            let sessionIdData: any = req.cookies?.session_id
            if (typeof sessionIdData === 'string') {
                try {
                    sessionIdData = JSON.parse(sessionIdData)
                } catch (e) {
                    // If parsing fails, sessionIdData remains as string
                }
            }
            
            // Build redirect URL if session_id data is available
            if (sessionIdData && sessionIdData.appBuilderURL) {
                const inputs = {
                    session_id: sessionIdData.logged_session_id,
                    user_id: sessionIdData.user_id,
                    orgId: Number(sessionIdData.org_id),
                    context_path: sessionIdData.contextpath,
                    session_time: 900,
                    url: sessionIdData.designer_url ? sessionIdData.designer_url.split('?')[0] : '',
                    mode: sessionIdData.web_mode,
                    timeZone: sessionIdData.web_timeZone 
                }
                
                const redirectUrl = `${sessionIdData.appBuilderURL}/auth/login?data=${encodeURIComponent(JSON.stringify(inputs))}`
                
                // Return redirect URL for client to handle
                return res.status(200).json({ 
                    success: true,
                    message: 'Back navigation processed successfully',
                    redirectUrl: redirectUrl
                })
            } else {
                // Return success response without redirect URL if session_id data is not available
                return res.status(200).json({ 
                    success: true,
                    message: 'Back navigation processed successfully'
                })
            }
        } else {
            // Invalid session - try to redirect to designer_url if available
            let designerUrl = null
            
            // Try to get designer URL from session_id cookie
            let sessionIdData: any = req.cookies?.session_id
            if (typeof sessionIdData === 'string') {
                try {
                    sessionIdData = JSON.parse(sessionIdData)
                } catch (e) {
                    // If parsing fails, sessionIdData remains as string
                }
            }
            
            if (sessionIdData && sessionIdData.designer_url) {
                designerUrl = sessionIdData.designer_url
            } else if (req.cookies?.session_id?.designer_url) {
                designerUrl = req.cookies.session_id.designer_url
            } else if (sessionIdData && sessionIdData.appBuilderURL) {
                // Fallback to appBuilderURL if designer_url not available
                designerUrl = sessionIdData.appBuilderURL
            }
            
            if (designerUrl) {
                return res.status(401).json({ 
                    error: 'Session invalid or expired',
                    redirectUrl: designerUrl
                })
            }
            return res.status(401).json({ error: 'Session invalid or expired' })
        }
    } catch (error) {
        return res.status(500).json({
            error: 'Failed to process back navigation',
            details: error instanceof Error ? error.message : String(error)
        })
    }
}

export default { previous };