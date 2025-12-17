import express from 'express'
import nodeIconController from '../../controllers/node-icons'
const router = express.Router()

// CREATE

// READ
router.get(['/', '/:name'], nodeIconController.getSingleNodeIcon)

// UPDATE

// DELETE

export default router
