import { Response, NextFunction } from 'express'
import credentialsService from '../../services/credentials'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import { StatusCodes } from 'http-status-codes'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'
import { transformEntityForResponse, transformEntitiesForResponse } from '../../utils/responseTransform'

const createCredential = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.createCredential - body not provided!`
            )
        }
        const apiResponse = await credentialsService.createCredential(req, req.body)
        return res.json(transformEntityForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const deleteCredentials = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.deleteCredentials - id not provided!`
            )
        }
        const apiResponse = await credentialsService.deleteCredentials(req, req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllCredentials = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const apiResponse = await credentialsService.getAllCredentials(req, req.query.credentialName)
        return res.json(transformEntitiesForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const getCredentialById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.getCredentialById - id not provided!`
            )
        }
        const apiResponse = await credentialsService.getCredentialById(req, req.params.id)
        return res.json(transformEntityForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const updateCredential = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.updateCredential - id not provided!`
            )
        }
        if (!req.body) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.updateCredential - body not provided!`
            )
        }
        const apiResponse = await credentialsService.updateCredential(req, req.params.id, req.body)
        return res.json(transformEntityForResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

export default {
    createCredential,
    deleteCredentials,
    getAllCredentials,
    getCredentialById,
    updateCredential
}
