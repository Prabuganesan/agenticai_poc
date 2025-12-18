import express from 'express'
import toolsController from '../../controllers/tools'
// Permission checks removed for autonomous server - handled externally

const router = express.Router()

// CREATE
router.post('/', toolsController.createTool as express.RequestHandler)

// READ
router.get('/', toolsController.getAllTools as express.RequestHandler)
router.get(['/', '/:id'], toolsController.getToolById as express.RequestHandler)

// UPDATE
router.put(['/', '/:id'], toolsController.updateTool as express.RequestHandler)

// DELETE
router.delete(['/', '/:id'], toolsController.deleteTool as express.RequestHandler)

export default router
