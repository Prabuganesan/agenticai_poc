import express from 'express'
import credentialsController from '../../controllers/credentials'
// Permission checks removed for kodivian server - handled externally
const router = express.Router()

// CREATE
router.post('/', credentialsController.createCredential as express.RequestHandler)

// READ
router.get('/', credentialsController.getAllCredentials as express.RequestHandler)
router.get(['/', '/:id'], credentialsController.getCredentialById as express.RequestHandler)

// UPDATE
router.put(['/', '/:id'], credentialsController.updateCredential as express.RequestHandler)

// DELETE
router.delete(['/', '/:id'], credentialsController.deleteCredentials as express.RequestHandler)

export default router
