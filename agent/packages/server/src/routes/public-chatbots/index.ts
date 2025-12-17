import express from 'express'
import chatflowsController from '../../controllers/chatflows'
const router = express.Router()

// CREATE

// READ
router.get(['/', '/:id'], chatflowsController.getSinglePublicChatbotConfig)
router.get('/:id/theme', chatflowsController.getEmbedTheme)

// UPDATE

// DELETE

export default router
