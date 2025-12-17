import { Request, Response, NextFunction } from 'express'
import * as fs from 'fs'
import openaiAssistantsService from '../../services/openai-assistants'
import contentDisposition from 'content-disposition'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { StatusCodes } from 'http-status-codes'
import { streamStorageFile } from 'autonomous-components'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'

// List available assistants
const getAllOpenaiAssistants = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.query === 'undefined' || !req.query.credential) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: openaiAssistantsController.getAllOpenaiAssistants - credential not provided!`
            )
        }
        const authReq = req as AuthenticatedRequest
        const orgId = authReq.orgId || (req as any).orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const apiResponse = await openaiAssistantsService.getAllOpenaiAssistants(req.query.credential as string, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

// Get assistant object
const getSingleOpenaiAssistant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: openaiAssistantsController.getSingleOpenaiAssistant - id not provided!`
            )
        }
        if (typeof req.query === 'undefined' || !req.query.credential) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: openaiAssistantsController.getSingleOpenaiAssistant - credential not provided!`
            )
        }
        const authReq = req as AuthenticatedRequest
        const orgId = authReq.orgId || (req as any).orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const apiResponse = await openaiAssistantsService.getSingleOpenaiAssistant(req.query.credential as string, req.params.id, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

// Download file from assistant
const getFileFromAssistant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body.chatflowId || !req.body.chatId || !req.body.fileName) {
            return res.status(500).send(`Invalid file path`)
        }
        const appServer = getRunningExpressApp()
        const chatflowId = req.body.chatflowId as string
        const chatId = req.body.chatId as string
        const fileName = req.body.fileName as string

        // Require orgId upfront - no cross-org search
        let orgId: string | undefined = (req as any).orgId || (req as any).user?.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const { getDataSource } = await import('../../DataSource')
        const dataSource = getDataSource(parseInt(orgId))
        const chatflow = await dataSource.getRepository(ChatFlow).findOneBy({
            guid: chatflowId
        })

        if (!chatflow) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found`)
        }

        res.setHeader('Content-Disposition', contentDisposition(fileName))
        const fileStream = await streamStorageFile(chatflowId, chatId, fileName, orgId || '')

        if (!fileStream) throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: getFileFromAssistant`)

        if (fileStream instanceof fs.ReadStream && fileStream?.pipe) {
            fileStream.pipe(res)
        } else {
            res.send(fileStream)
        }
    } catch (error) {
        next(error)
    }
}

const uploadAssistantFiles = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.query === 'undefined' || !req.query.credential) {
            throw new InternalAutonomousError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: openaiAssistantsVectorStoreController.uploadFilesToAssistantVectorStore - credential not provided!`
            )
        }
        const authReq = req as AuthenticatedRequest
        const orgId = authReq.orgId || (req as any).orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const files = req.files ?? []
        const uploadFiles: { filePath: string; fileName: string }[] = []

        if (Array.isArray(files)) {
            for (const file of files) {
                // Address file name with special characters: https://github.com/expressjs/multer/issues/1104
                file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
                uploadFiles.push({
                    filePath: file.path ?? file.key,
                    fileName: file.originalname
                })
            }
        }

        const apiResponse = await openaiAssistantsService.uploadFilesToAssistant(req.query.credential as string, orgId, uploadFiles)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    getAllOpenaiAssistants,
    getSingleOpenaiAssistant,
    getFileFromAssistant,
    uploadAssistantFiles
}
