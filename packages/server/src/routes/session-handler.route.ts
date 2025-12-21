import { Router } from 'express'
import { SessionHandlerController } from '../controllers/session-handler.controller'
import { getInstance } from '../index'
import { SessionService } from '../services/session.service'
import { UserDataService } from '../services/user-data.service'
import { logInfo, logError, logDebug } from '../utils/logger/system-helper'

const router = Router()

// Get services from app instance (initialized at startup)
router.use((req, res, next) => {
    logInfo(`Session handler middleware called (path: ${req.path}, url: ${req.url}, method: ${req.method})`).catch(() => {})

    const app = getInstance()
    if (!app || !app.orgConfigService || !app.kodivianSessionService) {
        logError('Services not initialized for session handler').catch(() => {})
        return res.status(503).json({ error: 'Services not initialized' })
    }

    // Use services from app instance (already initialized at startup)
    const orgConfigService = app.orgConfigService
    const kodivianSessionService = app.kodivianSessionService

    // Create session service instances (lightweight, no heavy initialization)
    const userDataService = new UserDataService(orgConfigService)
    const sessionService = new SessionService(userDataService, orgConfigService)

    const sessionHandlerController = new SessionHandlerController(orgConfigService, sessionService, kodivianSessionService)

    // Attach controller to request for use in route handlers
    ;(req as any).sessionHandlerController = sessionHandlerController
    logDebug('Session handler controller attached to request').catch(() => {})
    next()
})

router.get('/', (req, res) => {
    logInfo(`Session handler route GET / called (path: ${req.path}, url: ${req.url})`).catch(() => {})
    const controller = (req as any).sessionHandlerController as SessionHandlerController
    if (!controller) {
        logError('Session handler controller not found in request').catch(() => {})
        return res.status(500).json({ error: 'Session handler controller not initialized' })
    }
    controller.createSession(req, res)
})

router.get('/check-session', (req, res) => {
    const controller = (req as any).sessionHandlerController as SessionHandlerController
    controller.checkSession(req, res)
})

export default router
