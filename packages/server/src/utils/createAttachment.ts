import { Request } from 'express'
import * as path from 'path'
import { logWarn } from './logger/system-helper'
import {
    addArrayFilesToStorage,
    getFileFromUpload,
    IDocument,
    mapExtToInputField,
    mapMimeTypeToInputField,
    removeSpecificFileFromUpload,
    isPathTraversal
} from 'kodivian-components'
import { getRunningExpressApp } from './getRunningExpressApp'
import { getErrorMessage } from '../errors/utils'
import { checkStorage, updateStorageUsage } from './quotaUsage'
import { ChatFlow } from '../database/entities/ChatFlow'
import { InternalKodivianError } from '../errors/internalKodivianError'
import { StatusCodes } from 'http-status-codes'
import { validateFileContent, validateFileSize } from './fileValidation'

/**
 * Create attachment
 * @param {Request} req
 */
export const createFileAttachment = async (req: Request) => {
    const appServer = getRunningExpressApp()

    const chatflowid = req.params.chatflowId
    const chatId = req.params.chatId

    // Validate GUID format (15 characters) instead of UUID
    if (!chatflowid || typeof chatflowid !== 'string' || chatflowid.length !== 15) {
        throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Invalid chatflowId format - must be a valid 15-character GUID')
    }
    if (isPathTraversal(chatflowid) || (chatId && isPathTraversal(chatId))) {
        throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Invalid path characters detected')
    }

    // Require orgId upfront - no cross-org search
    // Get orgId from request object (set by session validation middleware) - single source
    const { getDataSource } = await import('../DataSource')
    const authReq = req as any
    const orgId: string | undefined = authReq.orgId
    if (!orgId) {
        throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
    }

    // Get org-specific DataSource from pool for subsequent operations
    const orgDataSource = getDataSource(parseInt(orgId))

    // Get chatflow from org-specific database
    const chatflow = await orgDataSource.getRepository(ChatFlow).findOneBy({
        guid: chatflowid
    })

    if (!chatflow) {
        throw new InternalKodivianError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowid} not found`)
    }

    // Parse chatbot configuration to get file upload settings
    let pdfConfig = {
        usage: 'perPage',
        legacyBuild: false
    }
    let allowedFileTypes: string[] = []
    let fileUploadEnabled = false

    if (chatflow.chatbotConfig) {
        try {
            const chatbotConfig = JSON.parse(chatflow.chatbotConfig)
            if (chatbotConfig?.fullFileUpload) {
                fileUploadEnabled = chatbotConfig.fullFileUpload.status

                // Get allowed file types from configuration
                if (chatbotConfig.fullFileUpload.allowedUploadFileTypes) {
                    allowedFileTypes = chatbotConfig.fullFileUpload.allowedUploadFileTypes.split(',')
                }

                // PDF specific configuration
                if (chatbotConfig.fullFileUpload.pdfFile) {
                    if (chatbotConfig.fullFileUpload.pdfFile.usage) {
                        pdfConfig.usage = chatbotConfig.fullFileUpload.pdfFile.usage
                    }
                    if (chatbotConfig.fullFileUpload.pdfFile.legacyBuild !== undefined) {
                        pdfConfig.legacyBuild = chatbotConfig.fullFileUpload.pdfFile.legacyBuild
                    }
                }
            }
        } catch (e) {
            // Use default config if parsing fails
        }
    }

    // Check if file upload is enabled
    if (!fileUploadEnabled) {
        throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'File upload is not enabled for this chatflow')
    }

    // Find FileLoader node
    const fileLoaderComponent = appServer.nodesPool.componentNodes['fileLoader']
    const fileLoaderNodeInstanceFilePath = fileLoaderComponent.filePath as string
    const fileLoaderNodeModule = await import(fileLoaderNodeInstanceFilePath)
    const fileLoaderNodeInstance = new fileLoaderNodeModule.nodeClass()
    const options = {
        retrieveAttachmentChatId: true,
        orgId: orgId,
        chatflowid,
        chatId
    }
    const files = (req.files as Express.Multer.File[]) || []
    const fileAttachments = []
    if (files.length) {
        const isBase64 = req.body.base64
        for (const file of files) {
            if (!allowedFileTypes.length) {
                throw new InternalKodivianError(
                    StatusCodes.BAD_REQUEST,
                    `File type '${file.mimetype}' is not allowed. Allowed types: ${allowedFileTypes.join(', ')}`
                )
            }

            // Validate file type against allowed types
            if (allowedFileTypes.length > 0 && !allowedFileTypes.includes(file.mimetype)) {
                throw new InternalKodivianError(
                    StatusCodes.BAD_REQUEST,
                    `File type '${file.mimetype}' is not allowed. Allowed types: ${allowedFileTypes.join(', ')}`
                )
            }

            await checkStorage(orgId, appServer.usageCacheManager)

            const fileBuffer = await getFileFromUpload(file.path ?? file.key)

            const maxFileSizeBytes = parseFileSizeLimit(process.env.AUTONOMOUS_FILE_SIZE_LIMIT || '50mb')
            validateFileSize(fileBuffer.length, maxFileSizeBytes)

            try {
                await validateFileContent(fileBuffer, file.mimetype, allowedFileTypes)
            } catch (validationError) {
                logWarn(`File validation failed for ${file.originalname}: ${getErrorMessage(validationError)}`).catch(() => {})
                throw validationError
            }
            const fileNames: string[] = []
            // Address file name with special characters: https://github.com/expressjs/multer/issues/1104
            file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
            const { path: storagePath, totalSize } = await addArrayFilesToStorage(
                file.mimetype,
                fileBuffer,
                file.originalname,
                fileNames,
                orgId,
                chatflowid,
                chatId
            )
            await updateStorageUsage(orgId, totalSize, appServer.usageCacheManager)

            const fileInputFieldFromMimeType = mapMimeTypeToInputField(file.mimetype)

            const fileExtension = path.extname(file.originalname)

            const fileInputFieldFromExt = mapExtToInputField(fileExtension)

            let fileInputField = 'txtFile'

            if (fileInputFieldFromExt !== 'txtFile') {
                fileInputField = fileInputFieldFromExt
            } else if (fileInputFieldFromMimeType !== 'txtFile') {
                fileInputField = fileInputFieldFromExt
            }

            await removeSpecificFileFromUpload(file.path ?? file.key)

            try {
                const nodeData = {
                    inputs: {
                        [fileInputField]: storagePath
                    },
                    outputs: { output: 'document' }
                }

                // Apply PDF specific configuration if this is a PDF file
                if (fileInputField === 'pdfFile') {
                    nodeData.inputs.usage = pdfConfig.usage
                    nodeData.inputs.legacyBuild = pdfConfig.legacyBuild as unknown as string
                }

                let content = ''

                if (isBase64) {
                    content = fileBuffer.toString('base64')
                } else {
                    const documents: IDocument[] = await fileLoaderNodeInstance.init(nodeData, '', options)
                    content = documents.map((doc) => doc.pageContent).join('\n')
                }

                fileAttachments.push({
                    name: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    content
                })
            } catch (error) {
                throw new Error(`Failed createFileAttachment: ${file.originalname} (${file.mimetype} - ${getErrorMessage(error)}`)
            }
        }
    }

    return fileAttachments
}

function parseFileSizeLimit(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+)([kmg]?b)$/i)
    if (!match) {
        return 50 * 1024 * 1024 // Default 50MB
    }

    const size = parseInt(match[1], 10)
    const unit = match[2].toLowerCase()

    switch (unit) {
        case 'kb':
            return size * 1024
        case 'mb':
            return size * 1024 * 1024
        case 'gb':
            return size * 1024 * 1024 * 1024
        default:
            return size
    }
}
