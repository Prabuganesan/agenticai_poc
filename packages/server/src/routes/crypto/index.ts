import express from 'express'
import cryptoController from '../../controllers/crypto'

const router = express.Router()

// Get public key for RSA encryption
router.get('/public-key', cryptoController.getPublicKey)

// Get encryption status
router.get('/status', cryptoController.getEncryptionStatus)

// Session key handshake
router.post('/handshake', cryptoController.handshake)

export default router
