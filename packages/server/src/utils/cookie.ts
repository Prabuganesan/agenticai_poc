/**
 * Cookie configuration utility
 * Centralizes cookie option creation from environment variables
 */

export function getCookieOptions(maxAge?: number): any {
    const ttl = maxAge || parseInt(process.env.SESSION_COOKIE_MAX_AGE || '900')
    const cookieDomain = process.env.SESSION_COOKIE_DOMAIN || undefined
    let cleanCookieDomain = cookieDomain?.startsWith('.') ? cookieDomain.substring(1) : cookieDomain

    // For localhost, don't set domain (cookies work better without domain on localhost)
    if (!cleanCookieDomain || cleanCookieDomain === 'localhost' || cleanCookieDomain.includes('localhost')) {
        cleanCookieDomain = undefined
    }

    const cookieOptions: any = {
        path: process.env.SESSION_COOKIE_PATH || '/',
        httpOnly: process.env.SESSION_COOKIE_HTTP_ONLY === 'false' ? false : true,
        signed: false,
        maxAge: ttl * 1000, // Convert seconds to milliseconds
        sameSite: (process.env.SESSION_COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'lax',
        secure: process.env.SESSION_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production'
    }

    // Only set domain if it's not localhost
    if (cleanCookieDomain) {
        cookieOptions.domain = cleanCookieDomain
    }

    return cookieOptions
}

export function getCleanCookieDomain(): string | undefined {
    const cookieDomain = process.env.SESSION_COOKIE_DOMAIN || undefined
    let cleanCookieDomain = cookieDomain?.startsWith('.') ? cookieDomain.substring(1) : cookieDomain

    // For localhost, don't set domain
    if (!cleanCookieDomain || cleanCookieDomain === 'localhost' || cleanCookieDomain.includes('localhost')) {
        return undefined
    }

    return cleanCookieDomain
}
