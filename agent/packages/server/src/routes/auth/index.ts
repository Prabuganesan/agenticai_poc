import { Router } from 'express'
import authController from '../../controllers/auth'
import { createSessionValidationMiddleware } from '../../middlewares/session-validation.middleware'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'

const router = Router()

// Get permissions - requires authentication
// Create middleware lazily to avoid circular dependency (getRunningExpressApp called at module load)
router.get('/permissions', (req, res, next) => {
    // Get autonomous session service and org config service from running app
    const appServer = getRunningExpressApp()
    const sessionValidationMiddleware = createSessionValidationMiddleware(appServer.autonomousSessionService, appServer.orgConfigService)
    // Call the middleware, then the controller
    return (sessionValidationMiddleware as any)(req, res, (err?: any) => {
        if (err) return next(err)
        return authController.getPermissions(req, res, next)
    })
})

export default router
