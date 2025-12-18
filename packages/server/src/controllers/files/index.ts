import path from 'path'
import { NextFunction, Request, Response } from 'express'
import { getFilesListFromStorage, getStoragePath, removeSpecificFileFromStorage } from 'kodivian-components'
import { updateStorageUsage } from '../../utils/quotaUsage'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'

const getAllFiles = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orgId = (req as any).orgId || req.user?.orgId
        if (!orgId) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                `Error: filesController.getAllFiles - organization ${orgId} not found!`
            )
        }
        const apiResponse = await getFilesListFromStorage(orgId)
        const filesList = apiResponse.map((file: any) => ({
            ...file,
            // replace org id because we don't want to expose it
            path: file.path.replace(getStoragePath(), '').replace(`${path.sep}${orgId}${path.sep}`, '')
        }))
        return res.json(filesList)
    } catch (error) {
        next(error)
    }
}

const deleteFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orgId = (req as any).orgId || req.user?.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Error: filesController.deleteFile - organization ${orgId} not found!`)
        }
        const filePath = req.query.path as string
        const paths = filePath.split(path.sep).filter((path) => path !== '')
        const { totalSize } = await removeSpecificFileFromStorage(orgId, ...paths)
        await updateStorageUsage(orgId, totalSize, getRunningExpressApp().usageCacheManager)
        return res.json({ message: 'file_deleted' })
    } catch (error) {
        next(error)
    }
}

export default {
    getAllFiles,
    deleteFile
}
