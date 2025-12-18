import express from 'express'
import statsController from '../../controllers/stats'

const router = express.Router()

// READ
router.get(['/', '/:id'], statsController.getChatflowStats as express.RequestHandler)

export default router
