import express from 'express'
import internalPredictionsController from '../../controllers/internal-predictions'
const router = express.Router()

// CREATE
router.post(['/', '/:id'], internalPredictionsController.createInternalPrediction as express.RequestHandler)

export default router
