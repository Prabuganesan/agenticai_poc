import express from 'express'
import chatSessionsController from '../../controllers/chat-sessions'
const router = express.Router()

// All endpoints use POST method as per requirements
router.post('/create', chatSessionsController.createChatSession as express.RequestHandler)
router.post('/list', chatSessionsController.getAllChatSessions as express.RequestHandler)
router.post('/get', chatSessionsController.getChatSessionById as express.RequestHandler)
router.post('/update', chatSessionsController.updateChatSession as express.RequestHandler)
router.post('/delete', chatSessionsController.deleteChatSession as express.RequestHandler)

export default router
