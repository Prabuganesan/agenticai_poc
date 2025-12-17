import { Request, Response, NextFunction } from 'express'
import upsertHistoryService from '../../services/upsert-history'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'

const getAllUpsertHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sortOrder = req.query?.order as string | undefined
        const chatflowid = req.params?.id as string | undefined
        const startDate = req.query?.startDate as string | undefined
        const endDate = req.query?.endDate as string | undefined
        const authReq = req as AuthenticatedRequest
        const orgId = authReq.orgId || (req as any).orgId
        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID is required' })
        }
        const apiResponse = await upsertHistoryService.getAllUpsertHistory(sortOrder, chatflowid, startDate, endDate, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const patchDeleteUpsertHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const ids = req.body.ids ?? []
        const authReq = req as AuthenticatedRequest
        const orgId = authReq.orgId || (req as any).orgId
        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID is required' })
        }
        const apiResponse = await upsertHistoryService.patchDeleteUpsertHistory(ids, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    getAllUpsertHistory,
    patchDeleteUpsertHistory
}
