import express from 'express'
import chatflowsController from '../../controllers/chatflows'
// Permission checks removed for kodivian server - handled externally
const router = express.Router()

// CREATE
router.post('/', chatflowsController.saveChatflow as express.RequestHandler)

// READ
router.get('/', chatflowsController.getAllChatflows as express.RequestHandler)
router.get(['/', '/:id'], chatflowsController.getChatflowById as express.RequestHandler)
router.get(['/apikey/', '/apikey/:apikey'], chatflowsController.getChatflowByApiKey)

// UPDATE
router.put(['/', '/:id'], chatflowsController.updateChatflow as express.RequestHandler)

// DELETE
router.delete(['/', '/:id'], chatflowsController.deleteChatflow as express.RequestHandler)

// CHECK FOR CHANGE
router.get('/has-changed/:id/:lastUpdatedDateTime', chatflowsController.checkIfChatflowHasChanged)
router.get('/has-changed/:id', chatflowsController.checkIfChatflowHasChanged)

export default router
