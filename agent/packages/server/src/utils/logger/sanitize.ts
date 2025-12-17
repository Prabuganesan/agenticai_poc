/**
 * Log Sanitization Utility
 * Sanitizes sensitive data in log context objects before writing to logs
 * Uses LOG_SANITIZE_BODY_FIELDS and LOG_SANITIZE_HEADER_FIELDS environment variables
 */

/**
 * Get list of sensitive body fields from environment variable
 */
function getSensitiveBodyFields(): string[] {
    if (!process.env.LOG_SANITIZE_BODY_FIELDS) {
        // Default sensitive fields if not configured
        return [
            'password',
            'pwd',
            'pass',
            'secret',
            'token',
            'apikey',
            'api_key',
            'accesstoken',
            'access_token',
            'refreshtoken',
            'refresh_token',
            'clientsecret',
            'client_secret',
            'privatekey',
            'private_key',
            'secretkey',
            'secret_key',
            'auth',
            'authorization',
            'credential',
            'credentials'
        ]
    }
    return (process.env.LOG_SANITIZE_BODY_FIELDS as string)
        .toLowerCase()
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f.length > 0)
}

/**
 * Get list of sensitive header fields from environment variable
 */
function getSensitiveHeaderFields(): string[] {
    if (!process.env.LOG_SANITIZE_HEADER_FIELDS) {
        // Default sensitive headers if not configured
        return ['authorization', 'x-api-key', 'x-auth-token', 'cookie']
    }
    return (process.env.LOG_SANITIZE_HEADER_FIELDS as string)
        .toLowerCase()
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f.length > 0)
}

/**
 * Sanitize email addresses in strings
 */
function sanitizeEmail(str: string): string {
    if (typeof str !== 'string') return str
    if (str.includes('@') && str.includes('.')) {
        return str.replace(/([^@\s]+)@([^@\s]+)/g, '**********')
    }
    return str
}

/**
 * Recursively sanitize an object, replacing sensitive fields with '********'
 * Handles nested objects and arrays
 */
function sanitizeObject(obj: any, depth: number = 0): any {
    // Prevent infinite recursion
    if (depth > 10) return obj

    // Handle null/undefined
    if (obj === null || obj === undefined) return obj

    // Handle primitives
    if (typeof obj !== 'object') {
        // Sanitize email addresses in strings
        if (typeof obj === 'string') {
            return sanitizeEmail(obj)
        }
        return obj
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeObject(item, depth + 1))
    }

    // Handle Date objects
    if (obj instanceof Date) {
        return obj
    }

    // Handle Buffer objects
    if (Buffer.isBuffer(obj)) {
        return '[Buffer]'
    }

    // Handle regular objects
    const sensitiveFields = getSensitiveBodyFields()
    const sensitiveHeaders = getSensitiveHeaderFields()
    const sanitized: any = {}

    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) {
            continue
        }

        const lowerKey = key.toLowerCase()
        const value = obj[key]

        // Check if key matches sensitive body field
        if (sensitiveFields.includes(lowerKey)) {
            sanitized[key] = '********'
        }
        // Check if key matches sensitive header field
        else if (sensitiveHeaders.includes(lowerKey)) {
            sanitized[key] = '********'
        }
        // Recursively sanitize nested objects/arrays
        else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value, depth + 1)
        }
        // Sanitize string values for emails
        else if (typeof value === 'string') {
            sanitized[key] = sanitizeEmail(value)
        }
        // Keep other primitives as-is
        else {
            sanitized[key] = value
        }
    }

    return sanitized
}

/**
 * Sanitize log context object
 * This is the main function to use for sanitizing log contexts
 */
export function sanitizeLogContext(context: any): any {
    if (!context || typeof context !== 'object') {
        return context
    }

    return sanitizeObject(context, 0)
}

/**
 * Export for use in expressRequestLogger (backward compatibility)
 */
export function getSensitiveBodyFieldsList(): string[] {
    return getSensitiveBodyFields()
}

export function getSensitiveHeaderFieldsList(): string[] {
    return getSensitiveHeaderFields()
}
