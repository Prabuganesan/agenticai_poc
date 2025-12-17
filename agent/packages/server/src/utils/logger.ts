/**
 * Express Request Logger Middleware
 * Uses the new logging system for API request logging
 */

import { NextFunction, Request, Response } from 'express'
import { apiLog } from './logger/module-methods'
import { sanitizeLogContext, getSensitiveHeaderFieldsList } from './logger/sanitize'

// Legacy sanitizeObject function for backward compatibility
// Note: This is now a wrapper around sanitizeLogContext for expressRequestLogger
function sanitizeObject(obj: any): any {
    return sanitizeLogContext(obj)
}

export async function expressRequestLogger(req: Request, res: Response, next: NextFunction): Promise<void> {
    const unwantedLogURLs = ['/api/v1/node-icon/', '/api/v1/components-credentials-icon/', '/api/v1/ping']

    if (/\/api\/v1\//i.test(req.url) && !unwantedLogURLs.some((url) => new RegExp(url, 'i').test(req.url))) {
        const isDebugLevel = process.env.DEBUG === 'true'

        const requestMetadata: any = {
            request: {
                method: req.method,
                url: req.url,
                params: req.params
            }
        }

        // Only include headers, body, and query if log level is debug
        if (isDebugLevel) {
            const sanitizedBody = sanitizeObject(req.body)
            const sanitizedQuery = sanitizeObject(req.query)
            const sanitizedHeaders = { ...req.headers }

            const sensitiveHeaders = getSensitiveHeaderFieldsList()
            sensitiveHeaders.forEach((header) => {
                if (sanitizedHeaders[header]) {
                    sanitizedHeaders[header] = '********'
                }
            })

            requestMetadata.request.body = sanitizedBody
            requestMetadata.request.query = sanitizedQuery
            requestMetadata.request.headers = sanitizedHeaders
        }

        const getRequestEmoji = (method: string) => {
            const requetsEmojis: Record<string, string> = {
                GET: '⬇️',
                POST: '⬆️',
                PUT: '🖊',
                DELETE: '❌',
                OPTION: '🔗'
            }

            return requetsEmojis[method] || '?'
        }

        // Use new logging system for API requests
        // Get orgId from request object (set by session validation middleware) - single source
        const authReq = req as any
        const userId = authReq.userId || (req.user as any)?.id || (req.user as any)?.userId || 'anonymous'
        const orgId = authReq.orgId

        const logMessage = `${getRequestEmoji(req.method)} ${req.method} ${req.url}`
        const logContext = {
            userId,
            orgId,
            requestId: (req.headers['x-request-id'] as string) || undefined,
            method: req.method,
            url: req.url,
            ...requestMetadata
        }

        // Log all requests at info level using new system
        await apiLog('info', logMessage, logContext).catch((error) => {
            // Throw error if new logging system fails - no fallback
            throw new Error(`Failed to log API request: ${error instanceof Error ? error.message : String(error)}`)
        })
    }

    next()
}
