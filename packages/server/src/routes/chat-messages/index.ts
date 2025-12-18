import express from 'express'
import chatMessageController from '../../controllers/chat-messages'
const router = express.Router()

// CREATE
// NOTE: Unused route
// router.post(['/', '/:id'], chatMessageController.createChatMessage)

// READ
router.get(['/', '/:id'], chatMessageController.getAllChatMessages as express.RequestHandler)

// UPDATE
router.put(['/abort/', '/abort/:chatflowid/:chatid'], chatMessageController.abortChatMessage as express.RequestHandler)

// DELETE
router.delete(['/', '/:id'], chatMessageController.removeAllChatMessages as express.RequestHandler)

export default router
