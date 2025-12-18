import { Request, Response, NextFunction } from 'express'

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (process.env.NODE_ENV === 'production') {
        const maxAge = process.env.HSTS_MAX_AGE || '31536000'
        res.setHeader('Strict-Transport-Security', `max-age=${maxAge}; includeSubDomains; preload`)
    }

    // Check if this is a chatbot route that should allow iframe embedding
    // Check both req.path and req.originalUrl to handle context paths
    const pathToCheck = req.path || req.originalUrl || ''
    const isChatbotRoute = pathToCheck.includes('/chatbot/')

    const cspDirectives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://r.wdfl.co",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https:",
        "font-src 'self' data: https://fonts.gstatic.com",
        "connect-src 'self' https:",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'"
    ]

    const iframeOrigins = process.env.IFRAME_ORIGINS
    const chatbotIframeOrigins = process.env.CHATBOT_IFRAME_ORIGINS || iframeOrigins
    const frameAncestorsIndex = cspDirectives.findIndex((d) => d.startsWith('frame-ancestors'))

    // For chatbot routes, use CHATBOT_IFRAME_ORIGINS or fallback to IFRAME_ORIGINS
    // Default to 'self' for security if not configured
    if (isChatbotRoute) {
        if (frameAncestorsIndex !== -1) {
            if (chatbotIframeOrigins === '*') {
                // Security warning for production
                if (process.env.NODE_ENV === 'production') {
                    console.warn('⚠️  SECURITY WARNING: Chatbot routes allow embedding from ANY origin (frame-ancestors *)')
                    console.warn('   This is a clickjacking risk. Consider using specific origins.')
                    console.warn('   Set CHATBOT_IFRAME_ORIGINS=https://trusted-domain.com,https://another-domain.com')
                }
                cspDirectives[frameAncestorsIndex] = 'frame-ancestors *'
            } else if (chatbotIframeOrigins) {
                // Use configured origins (can be 'self', 'none', or specific domains)
                const origins = chatbotIframeOrigins
                    .split(',')
                    .map((o) => o.trim())
                    .join(' ')
                cspDirectives[frameAncestorsIndex] = `frame-ancestors ${origins}`
            } else {
                // Default to 'self' for security (same-origin only)
                cspDirectives[frameAncestorsIndex] = "frame-ancestors 'self'"
            }
        }
    } else if (iframeOrigins && iframeOrigins !== '*') {
        // For other routes, use configured origins
        if (frameAncestorsIndex !== -1) {
            cspDirectives[frameAncestorsIndex] = `frame-ancestors 'self' ${iframeOrigins
                .split(',')
                .map((o) => o.trim())
                .join(' ')}`
        }
    } else if (iframeOrigins === '*') {
        // Allow all origins if IFRAME_ORIGINS is set to '*'
        if (frameAncestorsIndex !== -1) {
            cspDirectives[frameAncestorsIndex] = 'frame-ancestors *'
        }
    }

    res.setHeader('Content-Security-Policy', cspDirectives.join('; '))

    // X-Frame-Options: Legacy header for older browsers
    // If CSP frame-ancestors allows all origins, don't set X-Frame-Options (or browsers will block)
    // If CSP frame-ancestors is 'self' or specific origins, set X-Frame-Options to SAMEORIGIN
    const chatbotAllowsAll = isChatbotRoute && chatbotIframeOrigins === '*'
    const otherRoutesAllowAll = !isChatbotRoute && iframeOrigins === '*'

    if (chatbotAllowsAll || otherRoutesAllowAll) {
        // Don't set X-Frame-Options when allowing all origins (CSP handles it)
        // Setting X-Frame-Options: DENY would conflict with CSP frame-ancestors *
    } else {
        // Set SAMEORIGIN for legacy browser support when not allowing all origins
        res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    }

    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-XSS-Protection', '1; mode=block')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()')

    // Cross-Origin-Opener-Policy: Allow OAuth popup windows to communicate with parent
    // 'same-origin-allow-popups' allows same-origin popups to maintain window reference
    // This is necessary for OAuth authorization flows that use popup windows
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')

    next()
}
