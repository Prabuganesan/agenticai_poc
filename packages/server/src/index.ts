import express, { Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import cors from 'cors'
import http from 'http'
import cookieParser from 'cookie-parser'
import { MODE } from './Interface'
import { getNodeModulesPackagePath, getEncryptionKey } from './utils'
import { initializeEncryption } from './utils/crypto'
import { decryptRequestMiddleware, encryptResponseMiddleware } from './middleware/encryption'
import { expressRequestLogger } from './utils/logger'
import { initializeLogDirectories } from './utils/logger/init'
import { logInfo, logError, logWarn } from './utils/logger/system-helper'
import { getErrorMessage } from './errors/utils'
import { NodesPool } from './NodesPool'
import { ChatFlow } from './database/entities/ChatFlow'
import { CachePool } from './CachePool'
import { AbortControllerPool } from './AbortControllerPool'
import { RateLimiterManager } from './utils/rateLimit'
import { getAllowedIframeOrigins, getCorsOptions, sanitizeMiddleware } from './utils/XSS'
import { securityHeadersMiddleware } from './utils/securityHeaders'
import { apiKeyRateLimitMiddleware, initializeApiKeyRateLimiter } from './utils/apiKeyRateLimit'
import autonomousApiV1Router from './routes'
import { docsStaticRouter, docsApiRouter } from './routes/docs'
import errorHandlerMiddleware from './middlewares/errors'
import { WHITELIST_URLS, getServerPort } from './utils/constants'
// IdentityManager removed - not needed for kodivian server
import { SSEStreamer } from './utils/SSEStreamer'
import { validateAPIKey } from './utils/validateKey'
interface LoggedInUser {
    permissions: string[]
    features: any
    orgId: string
    isOrganizationAdmin: boolean
}
import { IMetricsProvider } from './Interface.Metrics'
import { Prometheus } from './metrics/Prometheus'
import { OpenTelemetry } from './metrics/OpenTelemetry'
import { QueueManager } from './queue/QueueManager'
import { RedisEventSubscriber } from './queue/RedisEventSubscriber'
import 'global-agent/bootstrap'
import { UsageCacheManager } from './UsageCacheManager'
import { ExpressAdapter } from '@bull-board/express'
import { OrganizationConfigService } from './services/org-config.service'
import { KodivianSessionService } from './services/kodivian-session.service'
import { SessionService } from './services/session.service'
import { getDataSourceManager, DataSourceManager } from './DataSourceManager'
// UserDataService removed - created per-request in session-handler.route.ts
import { createSessionValidationMiddleware } from './middlewares/session-validation.middleware'
import os from 'os'

declare global {
    namespace Express {
        interface User extends LoggedInUser { }
        interface Request {
            user?: LoggedInUser
        }
        namespace Multer {
            interface File {
                bucket: string
                key: string
                acl: string
                contentType: string
                contentDisposition: null
                storageClass: string
                serverSideEncryption: null
                metadata: any
                location: string
                etag: string
            }
        }
    }
}

export class App {
    app: express.Application
    nodesPool: NodesPool
    abortControllerPool: AbortControllerPool
    cachePool: CachePool
    rateLimiterManager: RateLimiterManager
    sseStreamer: SSEStreamer
    // identityManager removed - not needed for kodivian server
    metricsProvider: IMetricsProvider
    queueManager: QueueManager
    redisSubscriber: RedisEventSubscriber
    usageCacheManager: UsageCacheManager
    sessionStore: any
    orgConfigService: OrganizationConfigService
    sessionService: SessionService
    kodivianSessionService: KodivianSessionService
    dataSourceManager: DataSourceManager

    constructor() {
        this.app = express()
    }

    async config() {
        // Limit is needed to allow sending/receiving base64 encoded string
        const kodivian_file_size_limit = process.env.KODIVIAN_FILE_SIZE_LIMIT || '50mb'
        this.app.use(express.json({ limit: kodivian_file_size_limit }))
        this.app.use(express.urlencoded({ limit: kodivian_file_size_limit, extended: true }))

        // Enhanced trust proxy settings for load balancer
        let trustProxy: string | boolean | number | undefined = process.env.TRUST_PROXY
        if (typeof trustProxy === 'undefined' || trustProxy.trim() === '' || trustProxy === 'true') {
            // Default to trust all proxies
            trustProxy = true
        } else if (trustProxy === 'false') {
            // Disable trust proxy
            trustProxy = false
        } else if (!isNaN(Number(trustProxy))) {
            // Number: Trust specific number of proxies
            trustProxy = Number(trustProxy)
        }

        this.app.set('trust proxy', trustProxy)

        // Allow access from specified domains
        this.app.use(cors(getCorsOptions()))

        // Parse cookies
        this.app.use(cookieParser())

        // Allow embedding from specified domains.
        this.app.use((req, res, next) => {
            const allowedOrigins = getAllowedIframeOrigins()
            if (allowedOrigins == '*') {
                next()
            } else {
                const csp = `frame-ancestors ${allowedOrigins}`
                res.setHeader('Content-Security-Policy', csp)
                next()
            }
        })

        // Switch off the default 'X-Powered-By: Express' header
        this.app.disable('x-powered-by')

        // Add security headers (HSTS, CSP, X-Frame-Options, etc.)
        this.app.use(securityHeadersMiddleware)

        // Add the expressRequestLogger middleware to log all requests
        this.app.use(expressRequestLogger)

        // Add the sanitizeMiddleware to guard against XSS
        this.app.use(sanitizeMiddleware)

        // Initialize API key rate limiter
        initializeApiKeyRateLimiter(this.orgConfigService)

        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Credentials', 'true') // Allow credentials (cookies, etc.)
            if (next) next()
        })

        const denylistURLs = process.env.DENYLIST_URLS ? process.env.DENYLIST_URLS.split(',') : []
        const whitelistURLs = WHITELIST_URLS.filter((url) => !denylistURLs.includes(url))
        const URL_CASE_INSENSITIVE_REGEX: RegExp = /\/api\/v1\//i
        const URL_CASE_SENSITIVE_REGEX: RegExp = /\/api\/v1\//

        // Create session validation middleware for kodivian server
        const sessionValidationMiddleware = createSessionValidationMiddleware(this.kodivianSessionService, this.orgConfigService)

        this.app.use(async (req, res, next) => {
            // Skip authentication for static files and UI routes (not API routes)
            // Check if it's a static file or UI route first
            const isStaticFile = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webp|map)$/i.test(req.path)
            const isUIRoute = !req.path.includes('/api/v1') && !req.path.includes('/api/')
            const contextPath = process.env.CONTEXT_PATH || '/kodivian'
            const isContextPathRoot = req.path === contextPath || req.path === `${contextPath}/`

            // Allow static files and UI routes to pass through without authentication
            if (isStaticFile || (isUIRoute && !req.path.includes('/api/'))) {
                return next()
            }

            // Step 1: Check if the req path contains /api/v1 regardless of case
            if (URL_CASE_INSENSITIVE_REGEX.test(req.path)) {
                // Step 2: Check if the req path is casesensitive
                if (URL_CASE_SENSITIVE_REGEX.test(req.path)) {
                    // Normalize path by removing context path prefix for whitelist checking
                    // Express might include context path in req.path, so we need to handle both
                    const contextPath = process.env.CONTEXT_PATH || '/kodivian'
                    let normalizedPath = req.path
                    if (normalizedPath.startsWith(contextPath)) {
                        normalizedPath = normalizedPath.substring(contextPath.length) || '/'
                    }

                    // Step 3: Check if the req path is in the whitelist (check both original and normalized)
                    const isWhitelisted = whitelistURLs.some((url) => req.path.startsWith(url) || normalizedPath.startsWith(url))
                    if (isWhitelisted) {
                        // For whitelisted URLs, still validate session if cookie exists
                        // This allows controllers to check orgId for non-public resources
                        // while still allowing public access without authentication
                        if (req.cookies?.KODIID) {
                            return sessionValidationMiddleware(req as any, res, next)
                        }
                        // No session cookie - allow public access
                        next()
                        return
                    }
                    // Step 4: Skip session validation for session handler endpoints
                    // Check for sessionhandler in path (handles both /api/v1/sessionhandler and /autonomous/api/v1/sessionhandler)
                    else if (req.path.includes('/sessionhandler') || req.originalUrl.includes('/sessionhandler')) {
                        logInfo('Session handler endpoint - skipping validation', {
                            path: req.path,
                            originalUrl: req.originalUrl,
                            url: req.url,
                            baseUrl: req.baseUrl
                        }).catch(() => { }) // Non-blocking
                        // Call next() to continue to route handler
                        return next()
                    }
                    // Step 4.5: Skip session validation for docs endpoint
                    else if (req.path.includes('/docs') || req.originalUrl.includes('/docs')) {
                        return next()
                    }
                    // Step 5: Apply autonomous session validation middleware
                    else if (req.cookies?.KODIID) {
                        return sessionValidationMiddleware(req as any, res, next)
                    }
                    // Step 6: API key authentication for external server access
                    // External servers must provide orgId + API key
                    else {
                        // Check if API key is provided in Authorization header
                        const hasApiKey = !!(req.headers['authorization'] || req.headers['Authorization'])

                        // If no API key and no KODIID cookie, this is likely a frontend request with expired/missing session
                        if (!hasApiKey) {
                            // Log security event - unauthorized access attempt
                            try {
                                const { securityLog } = await import('./utils/logger/module-methods')
                                await securityLog('warn', 'Unauthorized access attempt - no session or API key', {
                                    userId: 'anonymous',
                                    orgId: 'unknown',
                                    ip: req.ip || req.socket.remoteAddress || 'unknown',
                                    userAgent: req.headers['user-agent'] || 'unknown',
                                    endpoint: req.path,
                                    method: req.method,
                                    reason: 'No session cookie or API key provided'
                                }).catch(() => { })
                            } catch (logError) {
                                // Silently fail - logging should not break authentication
                            }
                            return res.status(401).json({
                                error: 'Session Expired. Please log in again.'
                            })
                        }

                        // Extract orgId from request based on HTTP method
                        let orgId: string | undefined
                        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                            orgId = req.body?.orgId
                        } else if (req.method === 'GET') {
                            // Prefer query parameter, fallback to header
                            orgId = (req.query?.orgId as string) || (req.headers['x-org-id'] as string)
                        }

                        // orgId is required for API key authentication (external server access)
                        if (!orgId) {
                            return res.status(400).json({
                                error: 'Organization ID (orgId) is required for API key authentication. Provide orgId in request body (POST/PUT/PATCH/DELETE) or query parameter/header (GET requests).'
                            })
                        }

                        // Apply API key rate limiting before validation
                        await new Promise<void>((resolve, reject) => {
                            apiKeyRateLimitMiddleware(req, res, (err?: any) => {
                                if (err) {
                                    reject(err)
                                } else {
                                    resolve()
                                }
                            })
                        })

                        // Validate API key belongs to the specified orgId
                        const { isValid, orgId: apiKeyOrgId } = await validateAPIKey(req, orgId)
                        if (!isValid || !apiKeyOrgId) {
                            // Log security event - failed API key validation
                            try {
                                const { securityLog } = await import('./utils/logger/module-methods')
                                await securityLog('warn', 'API key validation failed', {
                                    userId: 'anonymous',
                                    orgId: orgId || 'unknown',
                                    ip: req.ip || req.socket.remoteAddress || 'unknown',
                                    userAgent: req.headers['user-agent'] || 'unknown',
                                    endpoint: req.path,
                                    method: req.method,
                                    reason: 'API key not found or invalid'
                                }).catch(() => { })
                            } catch (logError) {
                                // Silently fail - logging should not break authentication
                            }
                            return res.status(401).json({
                                error: 'Unauthorized Access. API key not found or does not belong to the specified organization.'
                            })
                        }

                        // Verify orgId from API key matches provided orgId (additional security check)
                        if (apiKeyOrgId !== orgId) {
                            // Log security event - orgId mismatch
                            try {
                                const { securityLog } = await import('./utils/logger/module-methods')
                                await securityLog('warn', 'API key orgId mismatch', {
                                    userId: 'anonymous',
                                    orgId: orgId || 'unknown',
                                    apiKeyOrgId: apiKeyOrgId || 'unknown',
                                    ip: req.ip || req.socket.remoteAddress || 'unknown',
                                    userAgent: req.headers['user-agent'] || 'unknown',
                                    endpoint: req.path,
                                    method: req.method
                                }).catch(() => { })
                            } catch (logError) {
                                // Silently fail - logging should not break authentication
                            }
                            return res.status(401).json({
                                error: 'Unauthorized Access. API key does not belong to the specified organization.'
                            })
                        }

                        // Log security event - successful API key authentication
                        try {
                            const { securityLog } = await import('./utils/logger/module-methods')
                            await securityLog('info', 'API key authentication successful', {
                                userId: 'api-key-user',
                                orgId: orgId,
                                ip: req.ip || req.socket.remoteAddress || 'unknown',
                                userAgent: req.headers['user-agent'] || 'unknown',
                                endpoint: req.path,
                                method: req.method
                            }).catch(() => { })
                        } catch (logError) {
                            // Silently fail - logging should not break authentication
                        }

                        // Get organization config from orgConfigService
                        const orgConfig = this.orgConfigService.getOrgConfig(parseInt(orgId))
                        if (!orgConfig) {
                            return res.status(401).json({ error: 'Unauthorized Access. Organization not found.' })
                        }

                        // Features should come from org config in the future, for now return empty object
                        const features = {}

                        // @ts-ignore
                        req.user = {
                            permissions: [], // API keys don't have specific permissions in kodivian server
                            features,
                            orgId: orgId,
                            isOrganizationAdmin: true
                        }
                        // @ts-ignore
                        req.orgId = orgId
                        next()
                    }
                } else {
                    return res.status(401).json({ error: 'Unauthorized Access' })
                }
            } else {
                // If the req path does not contain /api/v1, then allow the request to pass through, example: /assets, /canvas
                next()
            }
        })

        // SSO removed -        // Initialize metrics provider if enabled
        if (process.env.ENABLE_METRICS === 'true') {
            const metricsProvider = process.env.METRICS_PROVIDER?.toLowerCase()
            switch (metricsProvider) {
                case 'prometheus':
                case undefined:
                    this.metricsProvider = new Prometheus(this.app)
                    break
                case 'open_telemetry':
                    this.metricsProvider = new OpenTelemetry(this.app)
                    break
                // add more cases for other metrics providers here
            }
            if (this.metricsProvider) {
                await this.metricsProvider.initializeCounters()
                // Setup metrics endpoint (only for server, not worker)
                if (this.metricsProvider instanceof Prometheus) {
                    await this.metricsProvider.setupMetricsEndpoint()
                }
                logInfo(`📊 [server]: Metrics Provider [${this.metricsProvider.getName()}] has been initialized!`).catch(() => { })
            } else {
                logError(
                    "❌ [server]: Metrics collection is enabled, but failed to initialize provider (valid values are 'prometheus' or 'open_telemetry'."
                ).catch(() => { })
            }
        }

        // Add encryption middleware (must be before routes)
        this.app.use(encryptResponseMiddleware)
        this.app.use(decryptRequestMiddleware)

        // Mount API routes at both /api/v1 and /autonomous/api/v1 to handle context path
        const apiContextPath = process.env.CONTEXT_PATH || '/kodivian'
        this.app.use('/api/v1', autonomousApiV1Router)
        if (apiContextPath && apiContextPath !== '/') {
            // Also mount at context path for requests coming from /autonomous/api/v1
            this.app.use(`${apiContextPath}/api/v1`, autonomousApiV1Router)
            logInfo(`📡 [server]: API routes also mounted at: ${apiContextPath}/api/v1`).catch(() => { })
        }

        // Mount Docs routes
        this.app.use('/docs', docsApiRouter)
        this.app.use('/docs', docsStaticRouter)
        if (apiContextPath && apiContextPath !== '/') {
            this.app.use(`${apiContextPath}/docs`, docsApiRouter)
            this.app.use(`${apiContextPath}/docs`, docsStaticRouter)
        }
        // ----------------------------------------
        // Configure number of proxies in Host Environment
        // ----------------------------------------
        this.app.get('/api/v1/ip', (request, response) => {
            response.send({
                ip: request.ip,
                msg: 'Check returned IP address in the response. If it matches your current IP address ( which you can get by going to http://ip.nfriedly.com/ or https://api.ipify.org/ ), then the number of proxies is correct and the rate limiter should now work correctly. If not, increase the number of proxies by 1 and restart Cloud-Hosted Autonomous until the IP address matches your own. Visit the local documentation at /autonomous/docs for more information.'
            })
        })

        // BullMQ dashboard available for kodivian server (no platform restrictions)
        // Enable dashboard by default when MODE=queue, unless explicitly disabled
        const shouldEnableDashboard = process.env.MODE === MODE.QUEUE && process.env.ENABLE_BULLMQ_DASHBOARD !== 'false'
        if (shouldEnableDashboard && this.queueManager) {
            try {
                const dashboardPath = apiContextPath && apiContextPath !== '/' ? `${apiContextPath}/admin/queues` : '/admin/queues'
                const bullBoardRouter = this.queueManager.getBullBoardRouter()
                if (bullBoardRouter) {
                    // Mount the BullBoard router
                    this.app.use(dashboardPath, bullBoardRouter)

                    // Also manually serve BullBoard static files at the correct path
                    // This ensures static assets (JS/CSS) are accessible
                    try {
                        const bullBoardUiPath = require.resolve('@bull-board/ui/package.json')
                        const bullBoardStaticPath = path.join(path.dirname(bullBoardUiPath), 'dist', 'static')
                        if (fs.existsSync(bullBoardStaticPath)) {
                            this.app.use(`${dashboardPath}/static`, express.static(bullBoardStaticPath))
                            logInfo(`✅ [Queue]: BullBoard static files served at: ${dashboardPath}/static`).catch(() => { })
                        } else {
                            logWarn(`⚠️ [Queue]: BullBoard static directory not found at: ${bullBoardStaticPath}`).catch(() => { })
                        }
                    } catch (staticError) {
                        logWarn(`⚠️ [Queue]: Could not serve BullBoard static files: ${getErrorMessage(staticError)}`).catch(() => { })
                    }

                    logInfo(`✅ [Queue]: BullMQ Dashboard mounted at: ${dashboardPath}`).catch(() => { })
                } else {
                    logWarn(`⚠️ [Queue]: BullBoard router not available, dashboard will not be accessible`).catch(() => { })
                }
            } catch (error) {
                logError(`❌ [Queue]: Failed to mount BullMQ Dashboard: ${getErrorMessage(error)}`).catch(() => { })
            }
        } else if (process.env.MODE === MODE.QUEUE) {
            if (!this.queueManager) {
                logWarn(`⚠️ [Queue]: QueueManager not initialized, dashboard cannot be mounted`).catch(() => { })
            } else {
                logInfo(`ℹ️ [Queue]: BullMQ Dashboard is disabled (ENABLE_BULLMQ_DASHBOARD=false)`).catch(() => { })
            }
        }

        // ----------------------------------------
        // Serve UI static
        // ----------------------------------------

        // Allow UI path to be specified via environment variable
        let uiBuildPath: string
        let uiHtmlPath: string

        if (process.env.UI_BUILD_PATH) {
            // Use explicit UI build path from environment variable
            uiBuildPath = process.env.UI_BUILD_PATH
            uiHtmlPath = path.join(uiBuildPath, 'index.html')
            logInfo(`📁 [server]: Using UI build path from UI_BUILD_PATH env: ${uiBuildPath}`).catch(() => { })
        } else {
            // Try to find UI package
            const packagePath = getNodeModulesPackagePath('kodivian-ui')
            if (!packagePath) {
                const checkedPaths = [
                    path.join(__dirname, '..', 'node_modules', 'kodivian-ui'),
                    path.join(__dirname, '..', '..', 'node_modules', 'kodivian-ui'),
                    path.join(__dirname, '..', '..', '..', 'node_modules', 'kodivian-ui'),
                    path.join(__dirname, '..', '..', '..', 'packages', 'ui'),
                    path.join(process.cwd(), 'packages', 'ui'),
                    path.join(process.cwd(), 'node_modules', 'kodivian-ui')
                ]
                logError(`❌ [server]: kodivian-ui package not found. Checked paths:`).catch(() => { })
                checkedPaths.forEach((p) => {
                    logError(`   - ${p} ${fs.existsSync(p) ? '✓' : '✗'}`).catch(() => { })
                })
                logError('❌ [server]: Please build the UI first or set UI_BUILD_PATH environment variable.').catch(() => { })
                throw new Error('kodivian-ui package not found')
            }

            uiBuildPath = path.join(packagePath, 'build')
            uiHtmlPath = path.join(packagePath, 'build', 'index.html')
            logInfo(`📁 [server]: Found UI package at: ${packagePath}`).catch(() => { })
        }

        // Verify build directory exists
        if (!fs.existsSync(uiBuildPath)) {
            logError(`❌ [server]: UI build directory not found at: ${uiBuildPath}`).catch(() => { })
            logError(`❌ [server]: Please build the UI package first: cd packages/ui && pnpm build`).catch(() => { })
            logError(`❌ [server]: Or set UI_BUILD_PATH environment variable to point to the build directory.`).catch(() => { })
            throw new Error(`UI build directory not found at: ${uiBuildPath}`)
        }

        // Get context path from environment or org config
        const contextPath = process.env.CONTEXT_PATH || '/kodivian'

        logInfo(`📁 [server]: Serving UI from: ${uiBuildPath}`).catch(() => { })
        logInfo(`🌐 [server]: Context path: ${contextPath}`).catch(() => { })

        // Serve marketplace tool icons
        const marketplaceIconsPath = path.join(__dirname, '..', 'marketplaces', 'tools', 'icons')
        if (fs.existsSync(marketplaceIconsPath)) {
            this.app.use(
                `${contextPath}/api/v1/marketplace-icons`,
                express.static(marketplaceIconsPath, {
                    setHeaders: (res: Response, filePath: string) => {
                        const ext = path.extname(filePath).toLowerCase()
                        if (ext === '.svg') {
                            res.setHeader('Content-Type', 'image/svg+xml')
                        } else if (ext === '.png') {
                            res.setHeader('Content-Type', 'image/png')
                        } else if (ext === '.jpg' || ext === '.jpeg') {
                            res.setHeader('Content-Type', 'image/jpeg')
                        }
                    }
                })
            )
            logInfo(`📁 [server]: Serving marketplace icons from: ${marketplaceIconsPath}`).catch(() => { })
        }

        // Serve static files from context path (e.g., /autonomous/assets/...)
        // express.static automatically strips the mount path, so /autonomous/assets/file.js
        // will look for /assets/file.js in the uiBuildPath directory
        if (contextPath && contextPath !== '/') {
            // Serve static assets (JS, CSS, images, fonts, etc.) from context path
            // Use a more specific path pattern to ensure static files are served correctly
            this.app.use(
                `${contextPath}/assets`,
                express.static(path.join(uiBuildPath, 'assets'), {
                    // Set proper MIME types
                    setHeaders: (res: Response, filePath: string) => {
                        const ext = path.extname(filePath).toLowerCase()
                        if (ext === '.js') {
                            res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
                        } else if (ext === '.css') {
                            res.setHeader('Content-Type', 'text/css; charset=utf-8')
                        }
                    }
                })
            )

            // Serve other static files (favicon, manifest, etc.) from context path root
            // Skip /docs and /using-autonomous paths - they are handled by docs routes
            this.app.use(contextPath, (req: Request, res: Response, next: NextFunction) => {
                // Skip static file serving for /docs routes
                if (req.path.startsWith('/docs') || req.originalUrl.includes('/docs') || req.url.includes('/docs')) {
                    return next()
                }
                // Skip static file serving for /using-autonomous routes (will be redirected to docs)
                if (
                    req.path.startsWith('/using-autonomous') ||
                    req.originalUrl.includes('/using-autonomous') ||
                    req.url.includes('/using-autonomous')
                ) {
                    return next()
                }
                return express.static(uiBuildPath, {
                    // Set proper MIME types
                    setHeaders: (res: Response, filePath: string) => {
                        const ext = path.extname(filePath).toLowerCase()
                        if (ext === '.js') {
                            res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
                        } else if (ext === '.css') {
                            res.setHeader('Content-Type', 'text/css; charset=utf-8')
                        } else if (ext === '.html') {
                            res.setHeader('Content-Type', 'text/html; charset=utf-8')
                        } else if (ext === '.ico') {
                            res.setHeader('Content-Type', 'image/x-icon')
                        } else if (ext === '.png') {
                            res.setHeader('Content-Type', 'image/png')
                        } else if (ext === '.json') {
                            res.setHeader('Content-Type', 'application/json')
                        }
                    },
                    // Don't serve index.html from static middleware - handle it separately
                    index: false
                })(req, res, next)
            })

            // Serve index.html for context path root
            this.app.get(contextPath, (req: Request, res: Response) => {
                res.sendFile(uiHtmlPath)
            })

            // Serve index.html for all context path routes (SPA routing)
            // This must be last to catch all non-API, non-static routes
            this.app.get(`${contextPath}/*`, (req: Request, res: Response) => {
                // Don't serve index.html for API routes (already handled above)
                // Check both req.path and req.originalUrl to handle context path
                if (
                    req.path.startsWith('/api/') ||
                    req.path.includes('/api/v1/') ||
                    req.originalUrl.includes('/api/v1/') ||
                    req.url.includes('/api/v1/')
                ) {
                    // Skip API routes - they are handled by API router
                    return res.status(404).send('Not found')
                }
                // Don't serve index.html for docs routes (already handled above)
                if (req.path.startsWith('/docs') || req.originalUrl.includes('/docs') || req.url.includes('/docs')) {
                    // Skip docs routes - they are handled by docs router
                    return res.status(404).send('Not found')
                }
                // Don't serve index.html for using-autonomous routes (redirected to docs)
                if (
                    req.path.startsWith('/using-autonomous') ||
                    req.originalUrl.includes('/using-autonomous') ||
                    req.url.includes('/using-autonomous')
                ) {
                    // Skip using-autonomous routes - they are redirected to docs
                    return res.status(404).send('Not found')
                }
                // Don't serve index.html for static file requests (already handled above)
                // Check if it's a static file request by extension
                const staticExtensions = [
                    '.js',
                    '.css',
                    '.png',
                    '.jpg',
                    '.jpeg',
                    '.gif',
                    '.ico',
                    '.svg',
                    '.woff',
                    '.woff2',
                    '.ttf',
                    '.eot',
                    '.json',
                    '.webp'
                ]
                const hasStaticExtension = staticExtensions.some((ext) => req.path.toLowerCase().endsWith(ext))
                if (hasStaticExtension) {
                    return res.status(404).send('Not found')
                }
                // If we reach here, it's a SPA route, serve index.html
                res.sendFile(uiHtmlPath)
            })
        } else {
            // Fallback: serve from root if no context path
            this.app.use(
                '/assets',
                express.static(path.join(uiBuildPath, 'assets'), {
                    setHeaders: (res: Response, filePath: string) => {
                        const ext = path.extname(filePath).toLowerCase()
                        if (ext === '.js') {
                            res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
                        } else if (ext === '.css') {
                            res.setHeader('Content-Type', 'text/css; charset=utf-8')
                        }
                    }
                })
            )

            this.app.use(
                '/',
                express.static(uiBuildPath, {
                    setHeaders: (res: Response, filePath: string) => {
                        const ext = path.extname(filePath).toLowerCase()
                        if (ext === '.js') {
                            res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
                        } else if (ext === '.css') {
                            res.setHeader('Content-Type', 'text/css; charset=utf-8')
                        } else if (ext === '.html') {
                            res.setHeader('Content-Type', 'text/html; charset=utf-8')
                        }
                    },
                    index: false
                })
            )

            // All other requests not handled will return React app
            this.app.use((req: Request, res: Response) => {
                // Don't serve index.html for API routes (already handled above)
                if (req.path.startsWith('/api/')) {
                    return res.status(404).send('Not found')
                }
                // Don't serve index.html for static file requests
                const staticExtensions = [
                    '.js',
                    '.css',
                    '.png',
                    '.jpg',
                    '.jpeg',
                    '.gif',
                    '.ico',
                    '.svg',
                    '.woff',
                    '.woff2',
                    '.ttf',
                    '.eot',
                    '.json',
                    '.webp'
                ]
                const hasStaticExtension = staticExtensions.some((ext) => req.path.toLowerCase().endsWith(ext))
                if (hasStaticExtension) {
                    return res.status(404).send('Not found')
                }
                // If we reach here, it's a SPA route, serve index.html
                res.sendFile(uiHtmlPath)
            })
        }

        // Error handling
        this.app.use(errorHandlerMiddleware)
    }

    async stopApp() {
        try {
            const removePromises: any[] = []
            if (this.queueManager) {
                removePromises.push(this.redisSubscriber.disconnect())
            }
            // Close all per-org DataSource connections
            if (this.dataSourceManager) {
                removePromises.push(this.dataSourceManager.closeAll())
            }
            await Promise.all(removePromises)
        } catch (e) {
            logError(`❌[server]: Kodivian Server shut down error: ${e}`).catch(() => { })
        }
    }
}

let serverApp: App | undefined
let workerInstance: any = undefined // Worker instance for queue mode

export async function start(): Promise<void> {
    // Fix SSL certificate verification issue for CouchDB and other HTTPS connections
    // This is required in environments where the SSL certificate chain cannot be verified
    // Only affects outgoing HTTPS requests, not incoming server connections
    // EXACT PATTERN from kodivian server main.ts
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

    // PostgreSQL only - Oracle support removed for simplicity

    // Initialize logging directory structure (creates system directory)
    initializeLogDirectories()

    serverApp = new App()

    const host = process.env.HOST
    const port = getServerPort()
    const server = http.createServer(serverApp.app)

    // Step 1: Initialize organization config service (connects to main PostgreSQL)
    // This MUST happen before database initialization
    try {
        logInfo('🚀 [server]: Initializing organization config service...').catch(() => { })
        serverApp.orgConfigService = new OrganizationConfigService()
        await serverApp.orgConfigService.initialize()

        // Step 2: Load all organization configurations at startup
        // This executes the exact startup process from kodivian server:
        // 1. Fetch Node Info (BUILDER nodes)
        // 2. Fetch CouchDB Details (for each org)
        // 3. Fetch PostgreSQL Details (for each org)
        // 4. Fetch Redis Details (for each org)
        // 5. Load Context Path Mappings (non-blocking)
        await serverApp.orgConfigService.loadAllOrganizations()

        // Log summary (deduplicate for accurate count)
        const orgIds = serverApp.orgConfigService.getAllOrgIds()
        const uniqueOrgIds = Array.from(new Set(orgIds))
        if (orgIds.length !== uniqueOrgIds.length) {
            logError(
                `❌ [server]: CRITICAL - getAllOrgIds() returned ${orgIds.length} orgIds with ${uniqueOrgIds.length} unique: [${orgIds.join(
                    ', '
                )}]`
            ).catch(() => { })
            logError(`❌ [server]: This should never happen - Map keys are unique!`).catch(() => { })
        }
        logInfo(`✅ [server]: Loaded ${uniqueOrgIds.length} organization configuration(s): [${uniqueOrgIds.join(', ')}]`).catch(() => { })

        // Initialize org-specific log directories for all organizations
        // Creates logs/{orgId}/{group}/ directories for all enabled groups
        const { initializeOrgLogDirectories } = await import('./utils/logger/init')
        initializeOrgLogDirectories(uniqueOrgIds)
        logInfo(`📁 [server]: Initialized log directories for ${uniqueOrgIds.length} organization(s)`).catch(() => { })

        // Step 3: Initialize DataSourceManager and per-org PostgreSQL databases
        // This must happen AFTER loadAllOrganizations() so platformDB configs are available
        logInfo('🔌 [server]: Initializing per-org PostgreSQL DataSources...').catch(() => { })
        serverApp.dataSourceManager = getDataSourceManager()
        await serverApp.dataSourceManager.initializeAllOrgDataSources(serverApp.orgConfigService)
        logInfo('✅ [server]: Per-org PostgreSQL DataSources initialized successfully').catch(() => { })

        // Step 4: Initialize autonomous session service
        // Note: UserDataService and SessionService are created per-request in session-handler.route.ts
        serverApp.kodivianSessionService = new KodivianSessionService(serverApp.orgConfigService)
        logInfo('✅ [server]: Kodivian session service created').catch(() => { })

        // Step 5: Initialize Redis pools for all organizations (matching kodivian server pattern)
        // This must happen AFTER loadAllOrganizations() so Redis configs are available
        // EXACT PATTERN from kodivian server: createOrgRedisPools() called after fetchRedisDetails()
        logInfo('🔴 [server]: Initializing session pools for all organizations...').catch(() => { })
        await serverApp.kodivianSessionService.initializeRedisPools()
        logInfo('✅ [server]: Session pools initialized successfully').catch(() => { })
    } catch (error) {
        logError('❌ [server]: Failed to initialize organization config service:', error).catch(() => { })
        throw error
    }

    try {
        // Per-org databases are initialized in DataSourceManager.initializeAllOrgDataSources()
        // Legacy single database mode is no longer supported

        // Initialize nodes pool
        serverApp.nodesPool = new NodesPool()
        await serverApp.nodesPool.initialize()
        logInfo('🔧 [server]: Nodes pool initialized successfully').catch(() => { })

        // Initialize abort controllers pool
        serverApp.abortControllerPool = new AbortControllerPool()
        logInfo('⏹️ [server]: Abort controllers pool initialized successfully').catch(() => { })

        // Initialize encryption key
        await getEncryptionKey()
        logInfo('🔑 [server]: Encryption key initialized successfully').catch(() => { })

        // Initialize E2E encryption (RSA key pair for session key exchange)
        await initializeEncryption()

        // Initialize Rate Limit (pass orgConfigService to use per-org Redis)
        // Defer rate limiter initialization to after server starts (non-blocking)
        serverApp.rateLimiterManager = RateLimiterManager.getInstance(serverApp.orgConfigService)
        // Initialize rate limiters asynchronously after server starts
        // Load chatflows from all orgs for rate limiter initialization
        if (serverApp.dataSourceManager && serverApp.orgConfigService) {
            const allOrgIds = serverApp.dataSourceManager.getAllOrgIds()
            const chatflowPromises = allOrgIds.map(async (orgId) => {
                try {
                    const dataSource = serverApp!.dataSourceManager.getDataSource(orgId)
                    return await dataSource.getRepository(ChatFlow).find()
                } catch (err) {
                    logError(`❌ [server]: Failed to load chatflows for orgId ${orgId}:`, err).catch(() => { })
                    return []
                }
            })
            Promise.all(chatflowPromises)
                .then((chatflowArrays) => {
                    const allChatflows = chatflowArrays.flat()
                    if (serverApp) {
                        serverApp.rateLimiterManager
                            .initializeRateLimiters(allChatflows)
                            .then(() => {
                                logInfo('🚦 [server]: Rate limiters initialized successfully').catch(() => { })
                            })
                            .catch((err) => {
                                logError('❌ [server]: Failed to initialize rate limiters:', err).catch(() => { })
                            })
                    }
                })
                .catch((err) => {
                    logError('❌ [server]: Failed to load chatflows for rate limiters:', err).catch(() => { })
                })
        }
        logInfo('🚦 [server]: Rate limiter initialization deferred (non-blocking)').catch(() => { })

        // Initialize cache pool (pass orgConfigService to use per-org Redis)
        serverApp.cachePool = new CachePool(serverApp.orgConfigService)
        logInfo('💾 [server]: Cache pool initialized successfully').catch(() => { })

        // Initialize usage cache manager (pass orgConfigService to use per-org Redis)
        serverApp.usageCacheManager = await UsageCacheManager.getInstance(serverApp.orgConfigService)
        logInfo('📊 [server]: Usage cache manager initialized successfully').catch(() => { })

        // Initialize SSE Streamer
        serverApp.sseStreamer = new SSEStreamer()
        logInfo('🌊 [server]: SSE Streamer initialized successfully').catch(() => { })

        // Init Queues
        if (process.env.MODE === MODE.QUEUE) {
            serverApp.queueManager = QueueManager.getInstance()
            // Initialize per-org queues (must be called after orgConfigService.loadAllOrganizations())
            await serverApp.queueManager.initializeOrgQueues(serverApp.orgConfigService)
            logInfo('✅ [Queue]: Per-org queues initialized').catch(() => { })

            const serverAdapter = new ExpressAdapter()
            const contextPath = process.env.CONTEXT_PATH || '/kodivian'
            const dashboardPath = contextPath && contextPath !== '/' ? `${contextPath}/admin/queues` : '/admin/queues'
            // Note: setBasePath is called after createBullBoard to avoid Express 5.x compatibility issues
            // The base path will be set when mounting the router in config()
            serverApp.queueManager.setupAllQueues({
                componentNodes: serverApp.nodesPool.componentNodes,
                cachePool: serverApp.cachePool,
                abortControllerPool: serverApp.abortControllerPool,
                usageCacheManager: serverApp.usageCacheManager,
                serverAdapter,
                orgConfigService: serverApp.orgConfigService,
                dashboardPath
            })
            logInfo('✅ [Queue]: All queues setup successfully').catch(() => { })

            serverApp.redisSubscriber = new RedisEventSubscriber(serverApp.sseStreamer, serverApp.orgConfigService)
            await serverApp.redisSubscriber.initializeOrgSubscribers(serverApp.orgConfigService)
            logInfo('🔗 [server]: Redis event subscribers connected successfully for all organizations').catch(() => { })
        }

        await serverApp.config()

        // Log context path configuration
        const contextPath = process.env.CONTEXT_PATH || '/kodivian'
        if (contextPath && contextPath !== '/') {
            logInfo(`🌐 [server]: Server running with context path: ${contextPath}`).catch(() => { })
        }

        server.listen(port, host, () => {
            logInfo(`⚡️ [server]: Kodivian Server is listening at ${host ? 'http://' + host : ''}:${port}`).catch(() => { })
        })
    } catch (error) {
        logError('❌ [server]: Failed to start server:', error).catch(() => { })
        throw error
    }
}

export function getInstance(): App | any {
    // In queue mode, return worker instance if available, otherwise server instance
    // Check if we're in a worker process (worker instance is set) or server process
    if (workerInstance) {
        return workerInstance
    }
    return serverApp
}

export function setWorkerInstance(instance: any): void {
    workerInstance = instance
}
