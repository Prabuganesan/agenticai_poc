import express from 'express'
const router = express.Router()
import { getInstance } from '../../index'
import { SessionService } from '../../services/session.service'
import { UserDataService } from '../../services/user-data.service'
import  backController  from '../../controllers/back'
// Get services from app instance (initialized at startup)
router.use((req, res, next) => {
    const app = getInstance()
    if (!app || !app.orgConfigService || !app.autonomousSessionService) {

        return res.status(503).json({ error: 'Services not initialized' })
    }

    // Use services from app instance (already initialized at startup with Redis pools)
    const orgConfigService = app.orgConfigService
    const autonomousSessionService = app.autonomousSessionService

    // Create session service instances (lightweight, no heavy initialization)
    const userDataService = new UserDataService(orgConfigService)
    const sessionService = new SessionService(userDataService, orgConfigService)

        // Attach services to request for use in handlers
        ; (req as any).orgConfigService = orgConfigService
        ; (req as any).autonomousSessionService = autonomousSessionService
        ; (req as any).sessionService = sessionService

    next()
})

router.get('/previous', backController.previous)

export default router