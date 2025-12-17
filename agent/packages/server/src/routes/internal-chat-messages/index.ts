import express from 'express'
import chatMessagesController from '../../controllers/chat-messages'
const router = express.Router()

// CREATE

// READ
router.get(['/', '/:id'], chatMessagesController.getAllInternalChatMessages as express.RequestHandler)

// UPDATE

// DELETE

export default router
