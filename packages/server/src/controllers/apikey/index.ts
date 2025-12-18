import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import apikeyService from '../../services/apikey'
import { getPageAndLimitParams } from '../../utils/pagination'
import { transformPaginatedResponse } from '../../utils/responseTransform'

// Get api keys
const getAllApiKeys = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const autoCreateNewKey = true
        const { page, limit } = getPageAndLimitParams(req)
        const orgId = (req as any).orgId || req.user?.orgId
        const userId = (req as any).userId || (req as any).user?.userId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.PRECONDITION_FAILED, `Organization ID is required`)
        }
        // Only auto-create if userId is available
        const shouldAutoCreate = autoCreateNewKey && userId !== undefined
        const apiResponse = await apikeyService.getAllApiKeys(orgId, userId, shouldAutoCreate, page, limit)
        return res.json(transformPaginatedResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

const createApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined' || !req.body.keyName) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: apikeyController.createApiKey - keyName not provided!`
            )
        }
        const orgId = (req as any).orgId || req.user?.orgId
        const userId = (req as any).userId || (req as any).user?.userId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.PRECONDITION_FAILED, `Organization ID is required`)
        }
        if (!userId) {
            throw new InternalAutonomousError(StatusCodes.UNAUTHORIZED, `User ID is required. Please ensure you are logged in.`)
        }
        const apiResponse = await apikeyService.createApiKey(req.body.keyName, orgId, userId)
        // createApiKey returns keys (array or paginated), transform them
        return res.json(transformPaginatedResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

// Update api key
const updateApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(StatusCodes.PRECONDITION_FAILED, `Error: apikeyController.updateApiKey - id not provided!`)
        }
        if (typeof req.body === 'undefined' || !req.body.keyName) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: apikeyController.updateApiKey - keyName not provided!`
            )
        }
        const orgId = (req as any).orgId || req.user?.orgId
        const userId = (req as any).userId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.PRECONDITION_FAILED, `Organization ID is required`)
        }
        const apiResponse = await apikeyService.updateApiKey(req.params.id, req.body.keyName, orgId, userId)
        // updateApiKey returns keys (array or paginated), transform them
        return res.json(transformPaginatedResponse(apiResponse))
    } catch (error) {
        next(error)
    }
}

// Import Keys from JSON file
const importKeys = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined' || !req.body.jsonFile) {
            throw new InternalAutonomousError(StatusCodes.PRECONDITION_FAILED, `Error: apikeyController.importKeys - body not provided!`)
        }
        const orgId = (req as any).orgId || req.user?.orgId
        const userId = (req as any).userId || (req as any).user?.userId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.PRECONDITION_FAILED, `Organization ID is required`)
        }
        if (!userId) {
            throw new InternalAutonomousError(StatusCodes.UNAUTHORIZED, `User ID is required. Please ensure you are logged in.`)
        }
        // Add userId to request body for service to use
        req.body.userId = userId
        const apiResponse = await apikeyService.importKeys(req.body, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

// Delete api key
const deleteApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(StatusCodes.PRECONDITION_FAILED, `Error: apikeyController.deleteApiKey - id not provided!`)
        }
        const orgId = (req as any).orgId || req.user?.orgId
        const userId = (req as any).userId ? parseInt((req as any).userId) : undefined
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.PRECONDITION_FAILED, `Organization ID is required`)
        }
        const apiResponse = await apikeyService.deleteApiKey(req.params.id, orgId, userId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

// Verify api key
const verifyApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.apikey) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: apikeyController.verifyApiKey - apikey not provided!`
            )
        }
        const apiResponse = await apikeyService.verifyApiKey(req.params.apikey)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    createApiKey,
    deleteApiKey,
    getAllApiKeys,
    updateApiKey,
    verifyApiKey,
    importKeys
}
