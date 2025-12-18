import { Request, Response, NextFunction } from 'express'
import sanitizeHtml from 'sanitize-html'
import { isPredictionRequest, extractChatflowId, validateChatflowDomain } from './domainValidation'

export function sanitizeMiddleware(req: Request, res: Response, next: NextFunction): void {
    // decoding is necessary as the url is encoded by the browser
    const decodedURI = decodeURI(req.url)
    req.url = sanitizeHtml(decodedURI)
    for (let p in req.query) {
        if (Array.isArray(req.query[p])) {
            const sanitizedQ = []
            for (const q of req.query[p] as string[]) {
                sanitizedQ.push(sanitizeHtml(q))
            }
            req.query[p] = sanitizedQ
        } else {
            req.query[p] = sanitizeHtml(req.query[p] as string)
        }
    }
    next()
}

export function getAllowedCorsOrigins(): string {
    // Expects FQDN separated by commas, otherwise nothing.
    const origins = process.env.CORS_ORIGINS ?? ''

    // Security warning for wildcard CORS in production
    if (origins === '*' && process.env.NODE_ENV === 'production') {
        console.error('⚠️  SECURITY WARNING: CORS_ORIGINS is set to "*" (allow all origins) in production!')
        console.error('   This is a security risk. Please configure specific allowed origins.')
        console.error('   Example: CORS_ORIGINS=https://example.com,https://app.example.com')
    }

    return origins
}

function parseAllowedOrigins(allowedOrigins: string): string[] {
    if (!allowedOrigins) {
        return []
    }
    if (allowedOrigins === '*') {
        return ['*']
    }
    return allowedOrigins
        .split(',')
        .map((origin) => origin.trim().toLowerCase())
        .filter((origin) => origin.length > 0)
}

export function getCorsOptions(): any {
    return (req: any, callback: (err: Error | null, options?: any) => void) => {
        const corsOptions = {
            credentials: true, // Allow cookies to be sent with requests (required for KODIID cookie)
            origin: async (origin: string | undefined, originCallback: (err: Error | null, allow?: boolean) => void) => {
                const allowedOrigins = getAllowedCorsOrigins()
                const isPredictionReq = isPredictionRequest(req.url)
                const allowedList = parseAllowedOrigins(allowedOrigins)
                const originLc = origin?.toLowerCase()

                // Always allow no-Origin requests (same-origin, server-to-server)
                if (!originLc) return originCallback(null, true)

                // Allow all origins for /docs route
                if (req.url.includes('/docs') || req.originalUrl?.includes('/docs')) {
                    return originCallback(null, true)
                }
                // Global allow: '*' or exact match
                const globallyAllowed = allowedOrigins === '*' || allowedList.includes(originLc)

                if (isPredictionReq) {
                    // Per-chatflow allowlist OR globally allowed
                    const chatflowId = extractChatflowId(req.url)
                    let chatflowAllowed = false
                    if (chatflowId) {
                        try {
                            // Try to extract orgId from request (set by session validation middleware) - single source
                            // Note: In CORS middleware, orgId may not be available yet, so this is a fallback
                            const orgId = (req as any).orgId
                            if (orgId) {
                                chatflowAllowed = await validateChatflowDomain(chatflowId, originLc, orgId)
                            } else {
                                // If orgId not available in CORS middleware, skip per-chatflow validation
                                // This is acceptable since CORS runs before authentication
                                chatflowAllowed = false
                            }
                        } catch (error) {
                            // Log error and deny on failure
                            console.error('Domain validation error:', error)
                            chatflowAllowed = false
                        }
                    }
                    return originCallback(null, globallyAllowed || chatflowAllowed)
                }

                // Non-prediction: rely on global policy only
                return originCallback(null, globallyAllowed)
            }
        }
        callback(null, corsOptions)
    }
}

export function getAllowedIframeOrigins(): string {
    // Expects FQDN separated by commas, otherwise nothing or * for all.
    // Also CSP allowed values: self or none
    const origins = process.env.IFRAME_ORIGINS ?? '*'

    // Security warning for wildcard iframe origins in production
    if (origins === '*' && process.env.NODE_ENV === 'production') {
        console.error('⚠️  SECURITY WARNING: IFRAME_ORIGINS is set to "*" (allow all origins) in production!')
        console.error('   This allows your application to be embedded in any website (clickjacking risk).')
        console.error('   Please configure specific allowed origins or use "self" for same-origin only.')
        console.error('   Example: IFRAME_ORIGINS=https://example.com,https://app.example.com')
    }

    return origins
}
