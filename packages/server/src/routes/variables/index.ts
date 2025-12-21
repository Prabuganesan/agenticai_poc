import express from 'express'
import variablesController from '../../controllers/variables'
// Permission checks removed for kodivian server - handled externally

const router = express.Router()

// CREATE
router.post('/', variablesController.createVariable as express.RequestHandler)

// READ
router.get('/', variablesController.getAllVariables as express.RequestHandler)

// UPDATE
router.put(['/', '/:id'], variablesController.updateVariable as express.RequestHandler)

// DELETE
router.delete(['/', '/:id'], variablesController.deleteVariable as express.RequestHandler)

export default router
