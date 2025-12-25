import { Request, Response, NextFunction } from 'express'
import logService from '../../services/log'
import { getFlagStatus } from '../../utils/logger/env-flag-loader'
import { refreshFlags } from '../../utils/logger/flag-checker'
import { StatusCodes } from 'http-status-codes'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import { getErrorMessage } from '../../errors/utils'

// Get logs
const getLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiResponse = await logService.getLogs(req.query?.startDate as string, req.query?.endDate as string)
        res.send(apiResponse)
    } catch (error) {
        next(error)
    }
}

// Get flag status (POST to match kodivian_old pattern)
const getFlags = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const status = getFlagStatus()
        return res.json({
            success: true,
            flags: status
        })
    } catch (error) {
        return next(new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting flag status: ${getErrorMessage(error)}`))
    }
}

// Refresh flags from environment variables
const refreshFlagStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        refreshFlags()
        const status = getFlagStatus()
        return res.json({
            success: true,
            message: 'Flags refreshed successfully',
            flags: status
        })
    } catch (error) {
        return next(new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error refreshing flags: ${getErrorMessage(error)}`))
    }
}

// Query logs with filters (POST /api/v1/logs/query)
const queryLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filters = req.body || {}
        const result = await logService.queryLogs(filters)
        return res.json(result)
    } catch (error) {
        return next(new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error querying logs: ${getErrorMessage(error)}`))
    }
}

// Get log statistics (POST /api/v1/logs/stats)
const getLogStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { orgId } = req.body || {}
        const stats = await logService.getLogStats(orgId)
        return res.json({
            success: true,
            stats
        })
    } catch (error) {
        return next(new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting log stats: ${getErrorMessage(error)}`))
    }
}

// Get all filter options (POST /api/v1/logs/filters)
const getAllFilters = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { orgId } = req.body || {}
        const result = await logService.getAllFilters(orgId)
        return res.json(result)
    } catch (error) {
        return next(new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting filters: ${getErrorMessage(error)}`))
    }
}

// Get log groups structure (POST /api/v1/logs/groups)
const getLogGroups = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { orgId } = req.body || {}
        const result = await logService.getLogGroups(orgId)
        return res.json(result)
    } catch (error) {
        return next(new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting log groups: ${getErrorMessage(error)}`))
    }
}

// Get log levels (POST /api/v1/logs/levels)
const getLogLevels = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { orgId } = req.body || {}
        const result = await logService.getLogLevels(orgId)
        return res.json(result)
    } catch (error) {
        return next(new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting log levels: ${getErrorMessage(error)}`))
    }
}

// Get services (POST /api/v1/logs/services)
const getServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { orgId } = req.body || {}
        const result = await logService.getServices(orgId)
        return res.json(result)
    } catch (error) {
        return next(new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting services: ${getErrorMessage(error)}`))
    }
}

// Get modules (POST /api/v1/logs/modules)
const getModules = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { orgId } = req.body || {}
        const result = await logService.getModules(orgId)
        return res.json(result)
    } catch (error) {
        return next(new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting modules: ${getErrorMessage(error)}`))
    }
}

export default {
    getLogs,
    getFlags,
    refreshFlagStatus,
    queryLogs,
    getLogStats,
    getAllFilters,
    getLogGroups,
    getLogLevels,
    getServices,
    getModules
}
