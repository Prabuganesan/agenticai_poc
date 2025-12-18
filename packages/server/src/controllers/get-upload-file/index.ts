import { Request, Response, NextFunction } from 'express'
import fs from 'fs'
import contentDisposition from 'content-disposition'
import { streamStorageFile } from 'kodivian-components'
import { StatusCodes } from 'http-status-codes'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { getDataSource } from '../../DataSource'

const streamUploadedFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.query.chatflowId || !req.query.chatId || !req.query.fileName) {
            return res.status(500).send(`Invalid file path`)
        }
        const chatflowId = req.query.chatflowId as string
        const chatId = req.query.chatId as string
        const fileName = req.query.fileName as string
        const download = req.query.download === 'true' // Check if download parameter is set

        const appServer = getRunningExpressApp()

        // Require orgId upfront - no cross-org search
        let orgId: string | undefined = (req as any).orgId || (req as any).user?.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))
        const chatflow = await dataSource.getRepository(ChatFlow).findOneBy({
            guid: chatflowId
        })

        if (!chatflow) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found`)
        }

        // Set Content-Disposition header - force attachment for download
        if (download) {
            res.setHeader('Content-Disposition', contentDisposition(fileName, { type: 'attachment' }))
        } else {
            res.setHeader('Content-Disposition', contentDisposition(fileName))
        }
        const fileStream = await streamStorageFile(chatflowId, chatId, fileName, orgId)

        if (!fileStream) throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: streamStorageFile`)

        if (fileStream instanceof fs.ReadStream && fileStream?.pipe) {
            fileStream.pipe(res)
        } else {
            res.send(fileStream)
        }
    } catch (error) {
        next(error)
    }
}

export default {
    streamUploadedFile
}
