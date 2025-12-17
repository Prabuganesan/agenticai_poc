import express from 'express'
import marketplacesController from '../../controllers/marketplaces'
// Permission checks removed for autonomous server - handled externally
const router = express.Router()

// READ
router.get('/templates', marketplacesController.getAllTemplates)

router.post('/custom', marketplacesController.saveCustomTemplate)

// READ
router.get('/custom', marketplacesController.getAllCustomTemplates)

// DELETE
router.delete(['/', '/custom/:id'], marketplacesController.deleteCustomTemplate)

export default router
