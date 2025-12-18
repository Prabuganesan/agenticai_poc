import express from 'express'
import logController from '../../controllers/log'
// Permission checks removed for autonomous server - handled externally
const router = express.Router()

// READ (legacy)
router.get('/', logController.getLogs)

// Flag management (POST to match autonomous_old pattern)
router.post('/flags', logController.getFlags)
router.post('/flags/refresh', logController.refreshFlagStatus)

// New dashboard endpoints (POST to match autonomous_old pattern)
router.post('/query', logController.queryLogs)
router.post('/stats', logController.getLogStats)
router.post('/filters', logController.getAllFilters)
router.post('/groups', logController.getLogGroups)
router.post('/levels', logController.getLogLevels)
router.post('/services', logController.getServices)
router.post('/modules', logController.getModules)

export default router
