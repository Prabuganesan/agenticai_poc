import { NextFunction, Response } from 'express'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'
import { StatusCodes } from 'http-status-codes'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import exportImportService from '../../services/export-import'

const exportData = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.NOT_FOUND,
                `Error: exportImportController.exportData - organization ${orgId} not found!`
            )
        }
        const apiResponse = await exportImportService.exportData(exportImportService.convertExportInput(req.body), req)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const importData = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.NOT_FOUND,
                `Error: exportImportController.importData - organization ${orgId} not found!`
            )
        }
        const importData = req.body
        if (!importData) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Error: exportImportController.importData - importData is required!')
        }

        const userId = req.userId || (req as any).user?.userId
        await exportImportService.importData(importData, orgId, userId)
        return res.status(StatusCodes.OK).json({ message: 'success' })
    } catch (error) {
        next(error)
    }
}

export default {
    exportData,
    importData
}
