import express from 'express'
import exportImportController from '../../controllers/export-import'
// Permission checks removed for autonomous server - handled externally
const router = express.Router()

router.post('/export', exportImportController.exportData as express.RequestHandler)

router.post('/import', exportImportController.importData as express.RequestHandler)

export default router
