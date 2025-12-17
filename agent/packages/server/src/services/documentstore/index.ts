import { Document } from '@langchain/core/documents'
// Import ICommonObject from Interface (re-exported from autonomous-components)
import type { ICommonObject } from '../../Interface'
// Import storage utilities from autonomous-components
// Type declarations are provided in types/autonomous-components.d.ts
// NOTE: These imports work at runtime. The type declarations are a workaround
// until the components package is built (cd ../components && npm run build).
//
// Solutions (in order of preference):
// 1. BEST: Build components package first: cd ../components && npm run build
//    This generates dist/src/index.d.ts with proper type definitions
// 2. CURRENT: Type declaration file (types/autonomous-components.d.ts)
//    Provides type safety without requiring the package to be built
// 3. ALTERNATIVE: @ts-ignore (not recommended, loses type safety)
import {
    addArrayFilesToStorage,
    addSingleFileToStorage,
    getFileFromStorage,
    getFileFromUpload,
    mapExtToInputField,
    mapMimeTypeToInputField,
    removeFilesFromStorage,
    removeSpecificFileFromStorage,
    removeSpecificFileFromUpload,
    type IDocument
} from 'autonomous-components'
import { StatusCodes } from 'http-status-codes'
import { cloneDeep, omit } from 'lodash'
import * as path from 'path'
import { DataSource, In } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import {
    addLoaderSource,
    DocumentStoreDTO,
    DocumentStoreStatus,
    IComponentNodes,
    IDocumentStoreFileChunkPagedResponse,
    IDocumentStoreLoader,
    IDocumentStoreLoaderFile,
    IDocumentStoreLoaderForPreview,
    IDocumentStoreRefreshData,
    IDocumentStoreUpsertData,
    IDocumentStoreWhereUsed,
    IExecuteDocStoreUpsert,
    IExecutePreviewLoader,
    IExecuteProcessLoader,
    IExecuteVectorStoreInsert,
    INodeData,
    IOverrideConfig,
    MODE
} from '../../Interface'
import { UsageCacheManager } from '../../UsageCacheManager'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { DocumentStore } from '../../database/entities/DocumentStore'
import { DocumentStoreFileChunk } from '../../database/entities/DocumentStoreFileChunk'
import { UpsertHistory } from '../../database/entities/UpsertHistory'
// Removed getWorkspaceSearchOptions import - using orgId directly
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { getErrorMessage } from '../../errors/utils'
import { databaseEntities, saveUpsertFlowData } from '../../utils'
import { DOCUMENT_STORE_BASE_FOLDER, INPUT_PARAMS_TYPE, OMIT_QUEUE_JOB_DATA } from '../../utils/constants'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
// Old logger removed - using new logging system (documentStoreLog already imported where needed)
import { DOCUMENTSTORE_TOOL_DESCRIPTION_PROMPT_GENERATOR } from '../../utils/prompt'
import { checkStorage, updateStorageUsage } from '../../utils/quotaUsage'
import nodesService from '../nodes'
import { getDataSource } from '../../DataSource'
import { trackLLMUsage, extractProviderAndModel } from '../../utils/llm-usage-tracker'

const createDocumentStore = async (newDocumentStore: DocumentStore, orgId: string, userId?: string) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        // Generate GUID if not provided
        if (!newDocumentStore.guid) {
            const { generateGuid } = await import('../../utils/guidGenerator')
            newDocumentStore.guid = generateGuid()
        }
        // Set created_by and created_on
        const userIdNum = userId ? (typeof userId === 'number' ? userId : parseInt(userId)) : undefined
        if (userIdNum === undefined) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'User ID is required')
        }
        newDocumentStore.created_by = userIdNum
        newDocumentStore.created_on = Date.now()
        // Auto-populate display_name from name (max 50 chars)
        if (newDocumentStore.name) {
            newDocumentStore.display_name = newDocumentStore.name.substring(0, 50)
        }
        const documentStore = dataSource.getRepository(DocumentStore).create(newDocumentStore)
        const dbResponse = await dataSource.getRepository(DocumentStore).save(documentStore)

        // Log documentstore creation
        try {
            const { documentStoreLog } = await import('../../utils/logger/module-methods')
            await documentStoreLog('info', 'DocumentStore created', {
                userId: userIdNum.toString(),
                orgId,
                storeId: dbResponse.guid,
                storeName: dbResponse.name || 'Unnamed'
            }).catch(() => { }) // Don't fail if logging fails
        } catch (logError) {
            // Silently fail - logging should not break documentstore creation
        }

        // Telemetry removed
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.createDocumentStore - ${getErrorMessage(error)}`
        )
    }
}

const getAllDocumentStores = async (orgId: string, userId?: number, page: number = -1, limit: number = -1) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const queryBuilder = dataSource
            .getRepository(DocumentStore)
            .createQueryBuilder('doc_store')
            .orderBy('doc_store.last_modified_on', 'DESC')

        // Org-level sharing: Show ALL document stores in the organization
        // NO userId filtering - userId is only used for isCreator flag

        if (page > 0 && limit > 0) {
            queryBuilder.skip((page - 1) * limit)
            queryBuilder.take(limit)
        }
        const [data, total] = await queryBuilder.getManyAndCount()

        // Add isCreator flag to each document store
        const dataWithCreatorFlag = data.map((store) => ({
            ...store,
            isCreator: userId && store.created_by === userId,
            creatorId: store.created_by
        }))

        if (page > 0 && limit > 0) {
            return { data: dataWithCreatorFlag, total }
        } else {
            return dataWithCreatorFlag
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.getAllDocumentStores - ${getErrorMessage(error)}`
        )
    }
}

const getAllDocumentFileChunksByDocumentStoreIds = async (documentStoreIds: string[], orgId: string) => {
    const appDataSource = getDataSource(parseInt(orgId))
    return await appDataSource.getRepository(DocumentStoreFileChunk).find({ where: { storeId: In(documentStoreIds) } })
}

const deleteLoaderFromDocumentStore = async (storeId: string, docId: string, orgId: string, usageCacheManager: UsageCacheManager) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const entity = await dataSource.getRepository(DocumentStore).findOneBy({
            guid: storeId
        })
        if (!entity) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                `Error: documentStoreServices.deleteLoaderFromDocumentStore - Document store ${storeId} not found`
            )
        }

        const existingLoaders = JSON.parse(entity.loaders)
        const found = existingLoaders.find((loader: IDocumentStoreLoader) => loader.id === docId)
        if (found) {
            if (found.files?.length) {
                for (const file of found.files) {
                    if (file.name) {
                        try {
                            const { totalSize } = await removeSpecificFileFromStorage(orgId, DOCUMENT_STORE_BASE_FOLDER, storeId, file.name)
                            await updateStorageUsage(orgId, totalSize, usageCacheManager)
                        } catch (error) {
                            // Use new logging system - throw error if logging fails
                            const { documentStoreLog } = await import('../../utils/logger/module-methods')
                            const userId = 'system' // System operation
                            await documentStoreLog(
                                'error',
                                `Failed to remove file from storage: ${error instanceof Error ? error.message : String(error)}`,
                                {
                                    userId,
                                    orgId,
                                    storeId,
                                    fileName: file.name,
                                    error: error instanceof Error ? error.stack : String(error)
                                }
                            ).catch((logError) => {
                                // Throw error if new logging system fails - no fallback
                                throw new Error(
                                    `Failed to log documentstore error: ${logError instanceof Error ? logError.message : String(logError)
                                    }. Original error: ${error instanceof Error ? error.message : String(error)}`
                                )
                            })
                        }
                    }
                }
            }
            const index = existingLoaders.indexOf(found)
            if (index > -1) {
                existingLoaders.splice(index, 1)
            }
            // remove the chunks
            await dataSource.getRepository(DocumentStoreFileChunk).delete({ docId: found.id })

            entity.loaders = JSON.stringify(existingLoaders)
            const results = await dataSource.getRepository(DocumentStore).save(entity)
            return results
        } else {
            throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Unable to locate loader in Document Store ${entity.name}`)
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.deleteLoaderFromDocumentStore - ${getErrorMessage(error)}`
        )
    }
}

const getDocumentStoreById = async (storeId: string, orgId: string) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const entity = await dataSource.getRepository(DocumentStore).findOneBy({
            guid: storeId
        })
        if (!entity) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                `Error: documentStoreServices.getDocumentStoreById - Document store ${storeId} not found`
            )
        }
        return entity
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.getDocumentStoreById - ${getErrorMessage(error)}`
        )
    }
}

const getUsedChatflowNames = async (entity: DocumentStore, orgId: string) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        if (entity.whereUsed) {
            const whereUsed = JSON.parse(entity.whereUsed)
            const updatedWhereUsed: IDocumentStoreWhereUsed[] = []
            for (let i = 0; i < whereUsed.length; i++) {
                const associatedChatflow = await dataSource.getRepository(ChatFlow).findOne({
                    where: { guid: whereUsed[i] },
                    select: ['guid', 'name']
                })
                if (associatedChatflow) {
                    updatedWhereUsed.push({
                        id: whereUsed[i],
                        name: associatedChatflow.name
                    })
                }
            }
            return updatedWhereUsed
        }
        return []
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.getUsedChatflowNames - ${getErrorMessage(error)}`
        )
    }
}

// Get chunks for a specific loader or store
const getDocumentStoreFileChunks = async (appDataSource: DataSource, storeId: string, docId: string, orgId: string, pageNo: number = 1) => {
    try {
        const entity = await appDataSource.getRepository(DocumentStore).findOneBy({
            guid: storeId
        })
        if (!entity) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                `Error: documentStoreServices.getDocumentStoreById - Document store ${storeId} not found`
            )
        }
        const loaders = JSON.parse(entity.loaders)

        let found: IDocumentStoreLoader | undefined
        if (docId !== 'all') {
            found = loaders.find((loader: IDocumentStoreLoader) => loader.id === docId)
            if (!found) {
                throw new InternalAutonomousError(
                    StatusCodes.NOT_FOUND,
                    `Error: documentStoreServices.getDocumentStoreById - Document loader ${docId} not found`
                )
            }
        }
        if (found) {
            found.id = docId
            found.status = entity.status
        }

        let characters = 0
        if (docId === 'all') {
            loaders.forEach((loader: IDocumentStoreLoader) => {
                characters += loader.totalChars || 0
            })
        } else {
            characters = found?.totalChars || 0
        }

        const PAGE_SIZE = 50
        const skip = (pageNo - 1) * PAGE_SIZE
        const take = PAGE_SIZE
        let whereCondition: any = { docId: docId }
        if (docId === 'all') {
            whereCondition = { storeId: storeId }
        }
        const count = await appDataSource.getRepository(DocumentStoreFileChunk).count({
            where: whereCondition
        })
        const chunksWithCount = await appDataSource.getRepository(DocumentStoreFileChunk).find({
            skip,
            take,
            where: whereCondition,
            order: {
                chunkNo: 'ASC'
            }
        })

        if (!chunksWithCount) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Chunks with docId: ${docId} not found`)
        }

        const response: IDocumentStoreFileChunkPagedResponse = {
            chunks: chunksWithCount,
            count: count,
            file: found,
            currentPage: pageNo,
            storeName: entity.name,
            description: entity.description,
            docId: docId,
            characters
        }
        return response
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.getDocumentStoreFileChunks - ${getErrorMessage(error)}`
        )
    }
}

const deleteDocumentStore = async (storeId: string, orgId: string, usageCacheManager: UsageCacheManager) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const entity = await dataSource.getRepository(DocumentStore).findOneBy({
            guid: storeId
        })
        if (!entity) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document store ${storeId} not found`)
        }

        // delete all the chunks associated with the store
        await dataSource.getRepository(DocumentStoreFileChunk).delete({
            storeId: storeId
        })

        // now delete the files associated with the store
        try {
            const { totalSize } = await removeFilesFromStorage(orgId, DOCUMENT_STORE_BASE_FOLDER, entity.guid)
            await updateStorageUsage(orgId, totalSize, usageCacheManager)
        } catch (error: any) {
            // Log error with details for debugging
            const errorMessage = getErrorMessage(error)
            // If folder doesn't exist, it's not a critical error - just log as info
            if (errorMessage?.includes('ENOENT') || errorMessage?.includes('not found') || errorMessage?.includes('does not exist')) {
                const { logInfo } = await import('../../utils/logger/system-helper')
                logInfo(`[server]: File storage folder not found for documentStore ${storeId} (no files to delete)`).catch(() => { })
            } else {
                const { documentStoreLog } = await import('../../utils/logger/module-methods')
                documentStoreLog('error', `[server]: Error deleting file storage for documentStore ${storeId}: ${errorMessage}`, {
                    userId: 'system',
                    orgId,
                    storeId,
                    error: errorMessage
                }).catch(() => { })
            }
        }

        // delete upsert history
        await dataSource.getRepository(UpsertHistory).delete({
            chatflowid: storeId
        })

        // now delete the store
        const tbd = await dataSource.getRepository(DocumentStore).delete({
            guid: storeId
        })

        // Log documentstore deletion
        try {
            const { documentStoreLog } = await import('../../utils/logger/module-methods')
            await documentStoreLog('info', 'DocumentStore deleted', {
                userId: 'system',
                orgId,
                storeId: entity.guid,
                storeName: entity.name || 'Unnamed',
                chunksDeleted: true,
                filesDeleted: true
            }).catch(() => { }) // Don't fail if logging fails
        } catch (logError) {
            // Silently fail - logging should not break documentstore deletion
        }

        return { deleted: tbd.affected }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.deleteDocumentStore - ${getErrorMessage(error)}`
        )
    }
}

const deleteDocumentStoreFileChunk = async (storeId: string, docId: string, chunkId: string, orgId: string) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const entity = await dataSource.getRepository(DocumentStore).findOneBy({
            guid: storeId
        })
        if (!entity) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document store ${storeId} not found`)
        }
        const loaders = JSON.parse(entity.loaders)
        const found = loaders.find((ldr: IDocumentStoreLoader) => ldr.id === docId)
        if (!found) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document store loader ${docId} not found`)
        }

        const tbdChunk = await dataSource.getRepository(DocumentStoreFileChunk).findOneBy({
            guid: chunkId
        })
        if (!tbdChunk) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document Chunk ${chunkId} not found`)
        }
        await dataSource.getRepository(DocumentStoreFileChunk).delete({ guid: chunkId })
        found.totalChunks--
        found.totalChars -= tbdChunk.pageContent.length
        entity.loaders = JSON.stringify(loaders)
        await dataSource.getRepository(DocumentStore).save(entity)
        return getDocumentStoreFileChunks(dataSource, storeId, docId, orgId)
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.deleteDocumentStoreFileChunk - ${getErrorMessage(error)}`
        )
    }
}

const deleteVectorStoreFromStore = async (storeId: string, orgId: string) => {
    try {
        const appServer = getRunningExpressApp()
        const componentNodes = appServer.nodesPool.componentNodes
        const dataSource = getDataSource(parseInt(orgId))

        const entity = await dataSource.getRepository(DocumentStore).findOneBy({
            guid: storeId
        })
        if (!entity) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document store ${storeId} not found`)
        }

        if (!entity.embeddingConfig) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Embedding for Document store ${storeId} not found`)
        }

        if (!entity.vectorStoreConfig) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Vector Store for Document store ${storeId} not found`)
        }

        if (!entity.recordManagerConfig) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                `Record Manager for Document Store ${storeId} is needed to delete data from Vector Store`
            )
        }

        const options: ICommonObject = {
            chatflowid: storeId,
            appDataSource: dataSource,
            databaseEntities,
            logger: undefined
        }

        // Get Record Manager Instance
        const recordManagerConfig = JSON.parse(entity.recordManagerConfig)
        const recordManagerObj = await _createRecordManagerObject(
            componentNodes,
            { recordManagerName: recordManagerConfig.name, recordManagerConfig: recordManagerConfig.config },
            options
        )

        // Get Embeddings Instance
        const embeddingConfig = JSON.parse(entity.embeddingConfig)
        const embeddingObj = await _createEmbeddingsObject(
            componentNodes,
            { embeddingName: embeddingConfig.name, embeddingConfig: embeddingConfig.config },
            options
        )

        // Get Vector Store Node Data
        const vectorStoreConfig = JSON.parse(entity.vectorStoreConfig)
        const vStoreNodeData = _createVectorStoreNodeData(
            componentNodes,
            { vectorStoreName: vectorStoreConfig.name, vectorStoreConfig: vectorStoreConfig.config },
            embeddingObj,
            recordManagerObj
        )

        // Get Vector Store Instance
        const vectorStoreObj = await _createVectorStoreObject(
            componentNodes,
            { vectorStoreName: vectorStoreConfig.name, vectorStoreConfig: vectorStoreConfig.config },
            vStoreNodeData
        )
        const idsToDelete: string[] = [] // empty ids because we get it dynamically from the record manager

        // Call the delete method of the vector store
        if (vectorStoreObj.vectorStoreMethods.delete) {
            await vectorStoreObj.vectorStoreMethods.delete(vStoreNodeData, idsToDelete, options)
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.deleteVectorStoreFromStore - ${getErrorMessage(error)}`
        )
    }
}

const editDocumentStoreFileChunk = async (
    storeId: string,
    docId: string,
    chunkId: string,
    content: string,
    metadata: ICommonObject,
    orgId: string
) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const entity = await dataSource.getRepository(DocumentStore).findOneBy({
            guid: storeId
        })
        if (!entity) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document store ${storeId} not found`)
        }
        const loaders = JSON.parse(entity.loaders)
        const found = loaders.find((ldr: IDocumentStoreLoader) => ldr.id === docId)
        if (!found) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document store loader ${docId} not found`)
        }

        const editChunk = await dataSource.getRepository(DocumentStoreFileChunk).findOneBy({
            guid: chunkId
        })
        if (!editChunk) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document Chunk ${chunkId} not found`)
        }
        found.totalChars -= editChunk.pageContent.length
        editChunk.pageContent = content
        editChunk.metadata = JSON.stringify(metadata)
        found.totalChars += content.length
        await dataSource.getRepository(DocumentStoreFileChunk).save(editChunk)
        entity.loaders = JSON.stringify(loaders)
        await dataSource.getRepository(DocumentStore).save(entity)
        return getDocumentStoreFileChunks(dataSource, storeId, docId, orgId)
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.editDocumentStoreFileChunk - ${getErrorMessage(error)}`
        )
    }
}

const updateDocumentStore = async (documentStore: DocumentStore, updatedDocumentStore: DocumentStore, orgId: string, userId?: string) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        // Set last_modified_by and last_modified_on
        const userIdNum = userId ? (typeof userId === 'number' ? userId : parseInt(userId)) : undefined
        if (userIdNum !== undefined) {
            updatedDocumentStore.last_modified_by = userIdNum
            updatedDocumentStore.last_modified_on = Date.now()
        }
        // Auto-populate display_name from name if name is being updated (max 50 chars)
        if (updatedDocumentStore.name) {
            updatedDocumentStore.display_name = updatedDocumentStore.name.substring(0, 50)
        }
        const tmpUpdatedDocumentStore = dataSource.getRepository(DocumentStore).merge(documentStore, updatedDocumentStore)
        const dbResponse = await dataSource.getRepository(DocumentStore).save(tmpUpdatedDocumentStore)

        // Log documentstore update
        try {
            const { documentStoreLog } = await import('../../utils/logger/module-methods')
            await documentStoreLog('info', 'DocumentStore updated', {
                userId: userIdNum?.toString() || 'unknown',
                orgId,
                storeId: dbResponse.guid,
                storeName: dbResponse.name || 'Unnamed'
            }).catch(() => { }) // Don't fail if logging fails
        } catch (logError) {
            // Silently fail - logging should not break documentstore update
        }

        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.updateDocumentStore - ${getErrorMessage(error)}`
        )
    }
}

const _saveFileToStorage = async (fileBase64: string, entity: DocumentStore, orgId: string, usageCacheManager: UsageCacheManager) => {
    await checkStorage(orgId, usageCacheManager)

    const splitDataURI = fileBase64.split(',')
    const filename = splitDataURI.pop()?.split(':')[1] ?? ''
    const bf = Buffer.from(splitDataURI.pop() || '', 'base64')
    const mimePrefix = splitDataURI.pop()
    let mime = ''
    if (mimePrefix) {
        mime = mimePrefix.split(';')[0].split(':')[1]
    }
    const { totalSize } = await addSingleFileToStorage(mime, bf, filename, orgId, DOCUMENT_STORE_BASE_FOLDER, entity.guid)
    await updateStorageUsage(orgId, totalSize, usageCacheManager)

    return {
        id: uuidv4(),
        name: filename,
        mimePrefix: mime,
        size: bf.length,
        status: DocumentStoreStatus.NEW,
        uploaded: new Date()
    }
}

const _splitIntoChunks = async (appDataSource: DataSource, componentNodes: IComponentNodes, data: IDocumentStoreLoaderForPreview) => {
    try {
        let splitterInstance = null
        if (data.splitterId && data.splitterConfig && Object.keys(data.splitterConfig).length > 0) {
            const nodeInstanceFilePath = componentNodes[data.splitterId].filePath as string
            const nodeModule = await import(nodeInstanceFilePath)
            const newNodeInstance = new nodeModule.nodeClass()
            let nodeData = {
                inputs: { ...data.splitterConfig },
                id: 'splitter_0'
            }
            splitterInstance = await newNodeInstance.init(nodeData)
        }
        if (!data.loaderId) return []
        const nodeInstanceFilePath = componentNodes[data.loaderId].filePath as string
        const nodeModule = await import(nodeInstanceFilePath)
        // doc loader configs
        const nodeData = {
            credential: data.credential || data.loaderConfig['AUTONOMOUS_CREDENTIAL_ID'] || undefined,
            inputs: { ...data.loaderConfig, textSplitter: splitterInstance },
            outputs: { output: 'document' }
        }
        const options: ICommonObject = {
            chatflowid: uuidv4(),
            appDataSource,
            databaseEntities,
            logger: undefined,
            processRaw: true
        }
        const docNodeInstance = new nodeModule.nodeClass()
        let docs: IDocument[] = await docNodeInstance.init(nodeData, '', options)
        return docs
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.splitIntoChunks - ${getErrorMessage(error)}`
        )
    }
}

const _normalizeFilePaths = async (
    appDataSource: DataSource,
    data: IDocumentStoreLoaderForPreview,
    entity: DocumentStore | null,
    orgId: string
) => {
    const keys = Object.getOwnPropertyNames(data.loaderConfig)
    let rehydrated = false
    for (let i = 0; i < keys.length; i++) {
        const input = data.loaderConfig[keys[i]]
        if (!input) {
            continue
        }
        if (typeof input !== 'string') {
            continue
        }
        let documentStoreEntity: DocumentStore | null = entity
        if (input.startsWith('FILE-STORAGE::')) {
            if (!documentStoreEntity) {
                documentStoreEntity = await appDataSource.getRepository(DocumentStore).findOneBy({
                    guid: data.storeId
                })
                if (!documentStoreEntity) {
                    throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document store ${data.storeId} not found`)
                }
            }
            const fileName = input.replace('FILE-STORAGE::', '')
            let files: string[] = []
            if (fileName.startsWith('[') && fileName.endsWith(']')) {
                files = JSON.parse(fileName)
            } else {
                files = [fileName]
            }
            const loaders = JSON.parse(documentStoreEntity.loaders)
            const currentLoader = loaders.find((ldr: IDocumentStoreLoader) => ldr.id === data.id)
            if (currentLoader) {
                const base64Files: string[] = []
                for (const file of files) {
                    const bf = await getFileFromStorage(file, orgId, DOCUMENT_STORE_BASE_FOLDER, documentStoreEntity.guid)
                    // find the file entry that has the same name as the file
                    const uploadedFile = currentLoader.files.find((uFile: IDocumentStoreLoaderFile) => uFile.name === file)
                    const mimePrefix = 'data:' + uploadedFile.mimePrefix + ';base64'
                    const base64String = mimePrefix + ',' + bf.toString('base64') + `,filename:${file}`
                    base64Files.push(base64String)
                }
                data.loaderConfig[keys[i]] = JSON.stringify(base64Files)
                rehydrated = true
            }
        }
    }
    data.rehydrated = rehydrated
}

const previewChunksMiddleware = async (data: IDocumentStoreLoaderForPreview, orgId: string, usageCacheManager: UsageCacheManager) => {
    try {
        const appServer = getRunningExpressApp()

        // Ensure DataSource is initialized for this orgId
        const { getDataSourceManager } = await import('../../DataSourceManager')
        const dataSourceManager = getDataSourceManager()
        await dataSourceManager.ensureDataSourceInitialized(parseInt(orgId))

        const appDataSource = getDataSource(parseInt(orgId))
        const componentNodes = appServer.nodesPool.componentNodes

        const executeData: IExecutePreviewLoader = {
            appDataSource,
            componentNodes,
            usageCacheManager,
            data,
            isPreviewOnly: true,
            orgId
        }

        if (process.env.MODE === MODE.QUEUE) {
            const orgIdNum = parseInt(orgId || '0')
            if (!orgIdNum) {
                throw new InternalAutonomousError(
                    StatusCodes.BAD_REQUEST,
                    `Invalid organization ID: ${orgId}. orgId is required for queue mode.`
                )
            }
            const upsertQueue = appServer.queueManager.getQueue(orgIdNum, 'upsert')
            const job = await upsertQueue.addJob(omit(executeData, OMIT_QUEUE_JOB_DATA))
            const { logDebug } = await import('../../utils/logger/system-helper')
            logDebug(`[server]: [${orgId}]: Job added to queue: ${job.id}`).catch(() => { })

            const queueEvents = upsertQueue.getQueueEvents()
            const result = await job.waitUntilFinished(queueEvents)

            if (!result) {
                throw new Error('Job execution failed')
            }
            return result
        }

        return await previewChunks(executeData)
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.previewChunksMiddleware - ${getErrorMessage(error)}`
        )
    }
}

export const previewChunks = async ({ appDataSource, componentNodes, data, orgId }: IExecutePreviewLoader) => {
    try {
        if (data.preview) {
            if (
                data.loaderId === 'cheerioWebScraper' ||
                data.loaderId === 'puppeteerWebScraper' ||
                data.loaderId === 'playwrightWebScraper'
            ) {
                data.loaderConfig['limit'] = 3
            }
        }
        if (!data.rehydrated) {
            await _normalizeFilePaths(appDataSource, data, null, orgId || '')
        }
        let docs = await _splitIntoChunks(appDataSource, componentNodes, data)
        const totalChunks = docs.length
        // if -1, return all chunks
        if (data.previewChunkCount === -1) data.previewChunkCount = totalChunks
        // return all docs if the user ask for more than we have
        if (totalChunks <= (data.previewChunkCount || 0)) data.previewChunkCount = totalChunks
        // return only the first n chunks
        if (totalChunks > (data.previewChunkCount || 0)) docs = docs.slice(0, data.previewChunkCount)

        return { chunks: docs, totalChunks: totalChunks, previewChunkCount: data.previewChunkCount }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.previewChunks - ${getErrorMessage(error)}`
        )
    }
}

const saveProcessingLoader = async (
    appDataSource: DataSource,
    data: IDocumentStoreLoaderForPreview,
    orgId: string
): Promise<IDocumentStoreLoader> => {
    try {
        const entity = await appDataSource.getRepository(DocumentStore).findOneBy({
            guid: data.storeId
        })
        if (!entity) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                `Error: documentStoreServices.saveProcessingLoader - Document store ${data.storeId} not found`
            )
        }
        const existingLoaders = JSON.parse(entity.loaders)
        // Generate 15-character GUID for new loaders, or use existing ID if it's already a 15-char GUID
        let newDocLoaderId: string
        if (data.id && data.id.length === 15) {
            // Use provided ID only if it's already a 15-character GUID
            newDocLoaderId = data.id
        } else {
            // Always generate new 15-character GUID (ignore UUIDs or invalid IDs)
            const { generateGuid } = await import('../../utils/guidGenerator')
            newDocLoaderId = generateGuid()
        }
        const found = existingLoaders.find((ldr: IDocumentStoreLoader) => ldr.id === newDocLoaderId)
        if (found) {
            const foundIndex = existingLoaders.findIndex((ldr: IDocumentStoreLoader) => ldr.id === newDocLoaderId)

            if (!data.loaderId) data.loaderId = found.loaderId
            if (!data.loaderName) data.loaderName = found.loaderName
            if (!data.loaderConfig) data.loaderConfig = found.loaderConfig
            if (!data.splitterId) data.splitterId = found.splitterId
            if (!data.splitterName) data.splitterName = found.splitterName
            if (!data.splitterConfig) data.splitterConfig = found.splitterConfig
            if (found.credential) {
                data.credential = found.credential
            }

            let loader: IDocumentStoreLoader = {
                ...found,
                loaderId: data.loaderId,
                loaderName: data.loaderName,
                loaderConfig: data.loaderConfig,
                splitterId: data.splitterId,
                splitterName: data.splitterName,
                splitterConfig: data.splitterConfig,
                totalChunks: 0,
                totalChars: 0,
                status: DocumentStoreStatus.SYNCING
            }
            if (data.credential) {
                loader.credential = data.credential
            }

            existingLoaders[foundIndex] = loader
            entity.loaders = JSON.stringify(existingLoaders)
        } else {
            let loader: IDocumentStoreLoader = {
                id: newDocLoaderId,
                loaderId: data.loaderId,
                loaderName: data.loaderName,
                loaderConfig: data.loaderConfig,
                splitterId: data.splitterId,
                splitterName: data.splitterName,
                splitterConfig: data.splitterConfig,
                totalChunks: 0,
                totalChars: 0,
                status: DocumentStoreStatus.SYNCING
            }
            if (data.credential) {
                loader.credential = data.credential
            }
            existingLoaders.push(loader)
            entity.loaders = JSON.stringify(existingLoaders)
        }
        await appDataSource.getRepository(DocumentStore).save(entity)
        const newLoaders = JSON.parse(entity.loaders)
        const newLoader = newLoaders.find((ldr: IDocumentStoreLoader) => ldr.id === newDocLoaderId)
        if (!newLoader) {
            throw new Error(`Loader ${newDocLoaderId} not found`)
        }
        newLoader.source = addLoaderSource(newLoader, true)
        return newLoader
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.saveProcessingLoader - ${getErrorMessage(error)}`
        )
    }
}

export const processLoader = async ({
    appDataSource,
    componentNodes,
    data,
    docLoaderId,
    orgId,
    usageCacheManager
}: IExecuteProcessLoader) => {
    const entity = await appDataSource.getRepository(DocumentStore).findOneBy({
        guid: data.storeId
    })
    if (!entity) {
        throw new InternalAutonomousError(
            StatusCodes.NOT_FOUND,
            `Error: documentStoreServices.processLoader - Document store ${data.storeId} not found`
        )
    }
    await _saveChunksToStorage(appDataSource, componentNodes, data, entity, docLoaderId, orgId || '', usageCacheManager)
    return getDocumentStoreFileChunks(appDataSource, data.storeId as string, docLoaderId, orgId || '')
}

const processLoaderMiddleware = async (
    data: IDocumentStoreLoaderForPreview,
    docLoaderId: string,
    orgId: string,
    usageCacheManager: UsageCacheManager,
    isInternalRequest = false
) => {
    try {
        const appServer = getRunningExpressApp()
        const appDataSource = getDataSource(parseInt(orgId))
        const componentNodes = appServer.nodesPool.componentNodes

        const executeData: IExecuteProcessLoader = {
            appDataSource,
            componentNodes,
            data,
            docLoaderId,
            isProcessWithoutUpsert: true,
            orgId,
            usageCacheManager
        }

        if (process.env.MODE === MODE.QUEUE) {
            const orgIdNum = parseInt(orgId || '0')
            if (!orgIdNum) {
                throw new InternalAutonomousError(
                    StatusCodes.BAD_REQUEST,
                    `Invalid organization ID: ${orgId}. orgId is required for queue mode.`
                )
            }
            const upsertQueue = appServer.queueManager.getQueue(orgIdNum, 'upsert')
            const job = await upsertQueue.addJob(omit(executeData, OMIT_QUEUE_JOB_DATA))
            const { logDebug } = await import('../../utils/logger/system-helper')
            logDebug(`[server]: [${orgId}]: Job added to queue: ${job.id}`).catch(() => { })

            if (isInternalRequest) {
                return {
                    jobId: job.id
                }
            }

            const queueEvents = upsertQueue.getQueueEvents()
            const result = await job.waitUntilFinished(queueEvents)

            if (!result) {
                throw new Error('Job execution failed')
            }
            return result
        }

        return await processLoader(executeData)
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.processLoader - ${getErrorMessage(error)}`
        )
    }
}

const _saveChunksToStorage = async (
    appDataSource: DataSource,
    componentNodes: IComponentNodes,
    data: IDocumentStoreLoaderForPreview,
    entity: DocumentStore,
    newLoaderId: string,
    orgId: string,
    usageCacheManager: UsageCacheManager
) => {
    const re = new RegExp('^data.*;base64', 'i')

    try {
        //step 1: restore the full paths, if any
        await _normalizeFilePaths(appDataSource, data, entity, orgId)

        //step 2: split the file into chunks
        const response = await previewChunks({
            appDataSource,
            componentNodes,
            data,
            isPreviewOnly: false,
            orgId,
            usageCacheManager
        })

        //step 3: remove all files associated with the loader
        const existingLoaders = JSON.parse(entity.loaders)
        const loader = existingLoaders.find((ldr: IDocumentStoreLoader) => ldr.id === newLoaderId)
        if (data.id) {
            const index = existingLoaders.indexOf(loader)
            if (index > -1) {
                existingLoaders.splice(index, 1)
                if (!data.rehydrated) {
                    if (loader.files) {
                        loader.files.map(async (file: IDocumentStoreLoaderFile) => {
                            try {
                                const { totalSize } = await removeSpecificFileFromStorage(
                                    orgId,
                                    DOCUMENT_STORE_BASE_FOLDER,
                                    entity.guid,
                                    file.name
                                )
                                await updateStorageUsage(orgId, totalSize, usageCacheManager)
                            } catch (error) {
                                // Use new logging system - throw error if logging fails
                                const { documentStoreLog } = await import('../../utils/logger/module-methods')
                                const userId = 'system' // System operation
                                await documentStoreLog(
                                    'error',
                                    `Failed to remove file from storage: ${error instanceof Error ? error.message : String(error)}`,
                                    {
                                        userId,
                                        orgId,
                                        storeId: entity.guid,
                                        fileName: file.name,
                                        error: error instanceof Error ? error.stack : String(error)
                                    }
                                ).catch((logError) => {
                                    // Throw error if new logging system fails - no fallback
                                    throw new Error(
                                        `Failed to log documentstore error: ${logError instanceof Error ? logError.message : String(logError)
                                        }. Original error: ${error instanceof Error ? error.message : String(error)}`
                                    )
                                })
                            }
                        })
                    }
                }
            }
        }

        //step 4: save new file to storage
        let filesWithMetadata = []
        const keys = Object.getOwnPropertyNames(data.loaderConfig)
        for (let i = 0; i < keys.length; i++) {
            const input = data.loaderConfig[keys[i]]

            if (!input) {
                continue
            }
            if (typeof input !== 'string') {
                continue
            }
            if (input.startsWith('[') && input.endsWith(']')) {
                const files = JSON.parse(input)
                const fileNames: string[] = []
                for (let j = 0; j < files.length; j++) {
                    const file = files[j]
                    if (re.test(file)) {
                        const fileMetadata = await _saveFileToStorage(file, entity, orgId, usageCacheManager)
                        fileNames.push(fileMetadata.name)
                        filesWithMetadata.push(fileMetadata)
                    }
                }
                data.loaderConfig[keys[i]] = 'FILE-STORAGE::' + JSON.stringify(fileNames)
            } else if (re.test(input)) {
                const fileNames: string[] = []
                const fileMetadata = await _saveFileToStorage(input, entity, orgId, usageCacheManager)
                fileNames.push(fileMetadata.name)
                filesWithMetadata.push(fileMetadata)
                data.loaderConfig[keys[i]] = 'FILE-STORAGE::' + JSON.stringify(fileNames)
                break
            }
        }

        //step 5: update with the new files and loaderConfig
        if (filesWithMetadata.length > 0) {
            loader.loaderConfig = data.loaderConfig
            loader.files = filesWithMetadata
        }

        //step 6: update the loaders with the new loaderConfig
        if (data.id) {
            existingLoaders.push(loader)
        }

        //step 7: remove all previous chunks
        await appDataSource.getRepository(DocumentStoreFileChunk).delete({ docId: newLoaderId })
        if (response.chunks) {
            //step 8: now save the new chunks
            const totalChars = response.chunks.reduce((acc, chunk) => {
                if (chunk.pageContent) {
                    return acc + chunk.pageContent.length
                }
                return acc
            }, 0)
            await Promise.all(
                response.chunks.map(async (chunk: IDocument, index: number) => {
                    try {
                        const { generateGuid } = await import('../../utils/guidGenerator')
                        const docChunk: Partial<DocumentStoreFileChunk> = {
                            docId: newLoaderId,
                            storeId: data.storeId || '',
                            guid: generateGuid(),
                            chunkNo: index + 1,
                            pageContent: sanitizeChunkContent(chunk.pageContent),
                            metadata: JSON.stringify(chunk.metadata)
                        }
                        const dChunk = appDataSource.getRepository(DocumentStoreFileChunk).create(docChunk)
                        await appDataSource.getRepository(DocumentStoreFileChunk).save(dChunk)
                    } catch (chunkError) {
                        throw new InternalAutonomousError(
                            StatusCodes.INTERNAL_SERVER_ERROR,
                            `Error: documentStoreServices._saveChunksToStorage - ${getErrorMessage(chunkError)}`
                        )
                    }
                })
            )
            // update the loader with the new metrics
            loader.totalChunks = response.totalChunks
            loader.totalChars = totalChars
        }
        loader.status = 'SYNC'
        // have a flag and iterate over the loaders and update the entity status to SYNC
        const allSynced = existingLoaders.every((ldr: IDocumentStoreLoader) => ldr.status === 'SYNC')
        entity.status = allSynced ? DocumentStoreStatus.SYNC : DocumentStoreStatus.STALE
        entity.loaders = JSON.stringify(existingLoaders)

        //step 9: update the entity in the database
        await appDataSource.getRepository(DocumentStore).save(entity)

        return
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices._saveChunksToStorage - ${getErrorMessage(error)}`
        )
    }
}

// remove null bytes from chunk content
const sanitizeChunkContent = (content: string) => {
    // eslint-disable-next-line no-control-regex
    return content.replaceAll(/\u0000/g, '')
}

// Get all component nodes
const getDocumentLoaders = async () => {
    const removeDocumentLoadersWithName = ['documentStore', 'vectorStoreToDocument', 'unstructuredFolderLoader', 'folderFiles']

    try {
        const dbResponse = await nodesService.getAllNodesForCategory('Document Loaders')
        return dbResponse.filter((node) => !removeDocumentLoadersWithName.includes(node.name))
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.getDocumentLoaders - ${getErrorMessage(error)}`
        )
    }
}

const updateDocumentStoreUsage = async (chatId: string, storeId: string | undefined, orgId?: string) => {
    try {
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required for updateDocumentStoreUsage')
        }
        // find the document store
        const dataSource = getDataSource(parseInt(orgId))
        // find all entities that have the chatId in their whereUsed
        const entities = await dataSource.getRepository(DocumentStore).findBy({})
        entities.map(async (entity: DocumentStore) => {
            const whereUsed = JSON.parse(entity.whereUsed)
            const found = whereUsed.find((w: string) => w === chatId)
            if (found) {
                if (!storeId) {
                    // remove the chatId from the whereUsed, as the store is being deleted
                    const index = whereUsed.indexOf(chatId)
                    if (index > -1) {
                        whereUsed.splice(index, 1)
                        entity.whereUsed = JSON.stringify(whereUsed)
                        await dataSource.getRepository(DocumentStore).save(entity)
                    }
                } else if (entity.guid === storeId) {
                    // do nothing, already found and updated
                } else if (entity.guid !== storeId) {
                    // remove the chatId from the whereUsed, as a new store is being used
                    const index = whereUsed.indexOf(chatId)
                    if (index > -1) {
                        whereUsed.splice(index, 1)
                        entity.whereUsed = JSON.stringify(whereUsed)
                        await dataSource.getRepository(DocumentStore).save(entity)
                    }
                }
            } else {
                if (entity.guid === storeId) {
                    // add the chatId to the whereUsed
                    whereUsed.push(chatId)
                    entity.whereUsed = JSON.stringify(whereUsed)
                    await dataSource.getRepository(DocumentStore).save(entity)
                }
            }
        })
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.updateDocumentStoreUsage - ${getErrorMessage(error)}`
        )
    }
}

const updateVectorStoreConfigOnly = async (data: ICommonObject, orgId: string) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const entity = await dataSource.getRepository(DocumentStore).findOneBy({
            guid: data.storeId
        })
        if (!entity) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document store ${data.storeId} not found`)
        }

        if (data.vectorStoreName) {
            entity.vectorStoreConfig = JSON.stringify({
                config: data.vectorStoreConfig,
                name: data.vectorStoreName
            })

            const updatedEntity = await dataSource.getRepository(DocumentStore).save(entity)
            return updatedEntity
        }
        return {}
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.updateVectorStoreConfig - ${getErrorMessage(error)}`
        )
    }
}
const saveVectorStoreConfig = async (appDataSource: DataSource, data: ICommonObject, isStrictSave = true, orgId: string) => {
    try {
        const entity = await appDataSource.getRepository(DocumentStore).findOneBy({
            guid: data.storeId
        })
        if (!entity) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document store ${data.storeId} not found`)
        }

        if (data.embeddingName) {
            entity.embeddingConfig = JSON.stringify({
                config: data.embeddingConfig,
                name: data.embeddingName
            })
        } else if (entity.embeddingConfig && !data.embeddingName && !data.embeddingConfig) {
            data.embeddingConfig = JSON.parse(entity.embeddingConfig)?.config
            data.embeddingName = JSON.parse(entity.embeddingConfig)?.name
            if (isStrictSave) entity.embeddingConfig = null
        } else if (!data.embeddingName && !data.embeddingConfig) {
            entity.embeddingConfig = null
        }

        if (data.vectorStoreName) {
            entity.vectorStoreConfig = JSON.stringify({
                config: data.vectorStoreConfig,
                name: data.vectorStoreName
            })
        } else if (entity.vectorStoreConfig && !data.vectorStoreName && !data.vectorStoreConfig) {
            data.vectorStoreConfig = JSON.parse(entity.vectorStoreConfig)?.config
            data.vectorStoreName = JSON.parse(entity.vectorStoreConfig)?.name
            if (isStrictSave) entity.vectorStoreConfig = null
        } else if (!data.vectorStoreName && !data.vectorStoreConfig) {
            entity.vectorStoreConfig = null
        }

        if (data.recordManagerName) {
            entity.recordManagerConfig = JSON.stringify({
                config: data.recordManagerConfig,
                name: data.recordManagerName
            })
        } else if (entity.recordManagerConfig && !data.recordManagerName && !data.recordManagerConfig) {
            data.recordManagerConfig = JSON.parse(entity.recordManagerConfig)?.config
            data.recordManagerName = JSON.parse(entity.recordManagerConfig)?.name
            if (isStrictSave) entity.recordManagerConfig = null
        } else if (!data.recordManagerName && !data.recordManagerConfig) {
            entity.recordManagerConfig = null
        }

        if (entity.status !== DocumentStoreStatus.UPSERTED && (data.vectorStoreName || data.recordManagerName || data.embeddingName)) {
            // if the store is not already in sync, mark it as sync
            // this also means that the store is not yet sync'ed to vector store
            entity.status = DocumentStoreStatus.SYNC
        }
        await appDataSource.getRepository(DocumentStore).save(entity)
        return entity
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.saveVectorStoreConfig - ${getErrorMessage(error)}`
        )
    }
}

export const insertIntoVectorStore = async ({ appDataSource, componentNodes, data, isStrictSave, orgId }: IExecuteVectorStoreInsert) => {
    try {
        const entity = await saveVectorStoreConfig(appDataSource, data, isStrictSave, orgId || '')
        entity.status = DocumentStoreStatus.UPSERTING
        await appDataSource.getRepository(DocumentStore).save(entity)

        const indexResult = await _insertIntoVectorStoreWorkerThread(appDataSource, componentNodes, data, isStrictSave, orgId || '')
        return indexResult
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.insertIntoVectorStore - ${getErrorMessage(error)}`
        )
    }
}

const insertIntoVectorStoreMiddleware = async (
    data: ICommonObject,
    isStrictSave = true,
    orgId: string,
    usageCacheManager: UsageCacheManager
) => {
    try {
        const appServer = getRunningExpressApp()
        const appDataSource = getDataSource(parseInt(orgId))
        const componentNodes = appServer.nodesPool.componentNodes

        const executeData: IExecuteVectorStoreInsert = {
            appDataSource,
            componentNodes,
            data,
            isStrictSave,
            isVectorStoreInsert: true,
            orgId,
            usageCacheManager
        }

        if (process.env.MODE === MODE.QUEUE) {
            const orgIdNum = parseInt(orgId || '0')
            if (!orgIdNum) {
                throw new InternalAutonomousError(
                    StatusCodes.BAD_REQUEST,
                    `Invalid organization ID: ${orgId}. orgId is required for queue mode.`
                )
            }
            const upsertQueue = appServer.queueManager.getQueue(orgIdNum, 'upsert')
            const job = await upsertQueue.addJob(omit(executeData, OMIT_QUEUE_JOB_DATA))
            const { logDebug } = await import('../../utils/logger/system-helper')
            logDebug(`[server]: [${orgId}]: Job added to queue: ${job.id}`).catch(() => { })

            const queueEvents = upsertQueue.getQueueEvents()
            const result = await job.waitUntilFinished(queueEvents)

            if (!result) {
                throw new Error('Job execution failed')
            }
            return result
        } else {
            return await insertIntoVectorStore(executeData)
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.insertIntoVectorStoreMiddleware - ${getErrorMessage(error)}`
        )
    }
}

const _insertIntoVectorStoreWorkerThread = async (
    appDataSource: DataSource,
    componentNodes: IComponentNodes,
    data: ICommonObject,
    isStrictSave = true,
    orgId: string
) => {
    try {
        const entity = await saveVectorStoreConfig(appDataSource, data, isStrictSave, orgId)
        let upsertHistory: Record<string, any> = {}
        const chatflowid = data.storeId // fake chatflowid because this is not tied to any chatflow

        const options: ICommonObject = {
            chatflowid,
            appDataSource,
            databaseEntities,
            logger: undefined,
            orgId // Pass orgId for tracking
        }

        let recordManagerObj = undefined

        // Get Record Manager Instance
        if (data.recordManagerName && data.recordManagerConfig) {
            recordManagerObj = await _createRecordManagerObject(componentNodes, data, options, upsertHistory)
        }

        // Get Embeddings Instance
        const embeddingObj = await _createEmbeddingsObject(componentNodes, data, options, upsertHistory)

        // Get Vector Store Node Data
        const vStoreNodeData = _createVectorStoreNodeData(componentNodes, data, embeddingObj, recordManagerObj)

        // Prepare docs for upserting
        const filterOptions: ICommonObject = {
            storeId: data.storeId
        }
        if (data.docId) {
            filterOptions['docId'] = data.docId
        }
        const chunks = await appDataSource.getRepository(DocumentStoreFileChunk).find({
            where: filterOptions
        })
        const docs: Document[] = chunks.map((chunk: DocumentStoreFileChunk) => {
            return new Document({
                pageContent: chunk.pageContent,
                metadata: JSON.parse(chunk.metadata)
            })
        })
        vStoreNodeData.inputs.document = docs

        // Get Vector Store Instance
        const vectorStoreObj = await _createVectorStoreObject(componentNodes, data, vStoreNodeData, upsertHistory)
        const indexResult = await vectorStoreObj.vectorStoreMethods.upsert(vStoreNodeData, options)

        // Save to DB
        if (indexResult) {
            const { generateGuid } = await import('../../utils/guidGenerator')
            const result = cloneDeep(upsertHistory)
            result['flowData'] = JSON.stringify(result['flowData'])
            result['result'] = JSON.stringify(omit(indexResult, ['totalKeys', 'addedDocs']))
            result.chatflowid = chatflowid
            // Generate required fields for UpsertHistory
            result.guid = generateGuid()
            result.created_by = 0 // System user for automated upserts
            result.created_on = Date.now()
            const newUpsertHistory = new UpsertHistory()
            Object.assign(newUpsertHistory, result)
            const upsertHistoryItem = appDataSource.getRepository(UpsertHistory).create(newUpsertHistory)
            await appDataSource.getRepository(UpsertHistory).save(upsertHistoryItem)
        }

        // Telemetry removed

        entity.status = DocumentStoreStatus.UPSERTED
        await appDataSource.getRepository(DocumentStore).save(entity)

        return indexResult ?? { result: 'Successfully Upserted' }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices._insertIntoVectorStoreWorkerThread - ${getErrorMessage(error)}`
        )
    }
}

// Get all component nodes - Embeddings
const getEmbeddingProviders = async () => {
    try {
        const dbResponse = await nodesService.getAllNodesForCategory('Embeddings')
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.getEmbeddingProviders - ${getErrorMessage(error)}`
        )
    }
}

// Get all component nodes - Vector Stores
const getVectorStoreProviders = async () => {
    try {
        const dbResponse = await nodesService.getAllNodesForCategory('Vector Stores')
        return dbResponse.filter((node) => node.name !== 'documentStoreVS' && node.name !== 'memoryVectorStore')
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.getVectorStoreProviders - ${getErrorMessage(error)}`
        )
    }
}
// Get all component nodes - Vector Stores
const getRecordManagerProviders = async () => {
    try {
        const dbResponse = await nodesService.getAllNodesForCategory('Record Manager')
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.getRecordManagerProviders - ${getErrorMessage(error)}`
        )
    }
}

const queryVectorStore = async (data: ICommonObject, orgId: string) => {
    try {
        const appServer = getRunningExpressApp()
        const componentNodes = appServer.nodesPool.componentNodes
        const appDataSource = getDataSource(parseInt(orgId))

        const entity = await appDataSource.getRepository(DocumentStore).findOneBy({
            guid: data.storeId
        })
        if (!entity) {
            throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Document store ${data.storeId} not found`)
        }
        const options: ICommonObject = {
            chatflowid: uuidv4(),
            appDataSource: appDataSource,
            databaseEntities,
            logger: undefined,
            orgId // Pass orgId for tracking
        }

        if (!entity.embeddingConfig) {
            throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Embedding for ${data.storeId} is not configured`)
        }

        if (!entity.vectorStoreConfig) {
            throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Vector Store for ${data.storeId} is not configured`)
        }

        const embeddingConfig = JSON.parse(entity.embeddingConfig)
        data.embeddingName = embeddingConfig.name
        data.embeddingConfig = embeddingConfig.config
        let embeddingObj = await _createEmbeddingsObject(componentNodes, data, options)

        const vsConfig = JSON.parse(entity.vectorStoreConfig)
        data.vectorStoreName = vsConfig.name
        data.vectorStoreConfig = vsConfig.config
        if (data.inputs) {
            data.vectorStoreConfig = { ...vsConfig.config, ...data.inputs }
        }

        const vStoreNodeData = _createVectorStoreNodeData(componentNodes, data, embeddingObj, undefined)

        // Get Vector Store Instance
        const vectorStoreObj = await _createVectorStoreObject(componentNodes, data, vStoreNodeData)
        const retriever = await vectorStoreObj.init(vStoreNodeData, '', options)
        if (!retriever) {
            throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Failed to create retriever`)
        }
        const startMillis = Date.now()
        const results = await retriever.invoke(data.query, undefined)
        if (!results) {
            throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Failed to retrieve results`)
        }
        const endMillis = Date.now()
        const timeTaken = endMillis - startMillis
        const docs: any = results.map((result: IDocument) => {
            return {
                pageContent: result.pageContent,
                metadata: result.metadata,
                id: uuidv4()
            }
        })
        // query our document store chunk with the storeId and pageContent
        for (const doc of docs) {
            const documentStoreChunk = await appDataSource.getRepository(DocumentStoreFileChunk).findOneBy({
                storeId: data.storeId,
                pageContent: doc.pageContent
            })
            if (documentStoreChunk) {
                doc.guid = documentStoreChunk.guid
                doc.chunkNo = documentStoreChunk.chunkNo
            } else {
                // this should not happen, only possible if the vector store has more content
                // than our document store
                const { generateGuid } = await import('../../utils/guidGenerator')
                doc.guid = generateGuid()
                doc.chunkNo = -1
            }
        }

        return {
            timeTaken: timeTaken,
            docs: docs
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.queryVectorStore - ${getErrorMessage(error)}`
        )
    }
}

const _createEmbeddingsObject = async (
    componentNodes: IComponentNodes,
    data: ICommonObject,
    options: ICommonObject,
    upsertHistory?: Record<string, any>
): Promise<any> => {
    // prepare embedding node data
    const embeddingComponent = componentNodes[data.embeddingName]
    const embeddingNodeData: any = {
        inputs: { ...data.embeddingConfig },
        outputs: { output: 'document' },
        id: `${embeddingComponent.name}_0`,
        label: embeddingComponent.label,
        name: embeddingComponent.name,
        category: embeddingComponent.category,
        inputParams: embeddingComponent.inputs || []
    }
    if (data.embeddingConfig.credential) {
        embeddingNodeData.credential = data.embeddingConfig.credential
    }

    // save to upsert history
    if (upsertHistory) upsertHistory['flowData'] = saveUpsertFlowData(embeddingNodeData, upsertHistory)

    // init embedding object
    const embeddingNodeInstanceFilePath = embeddingComponent.filePath as string
    const embeddingNodeModule = await import(embeddingNodeInstanceFilePath)
    const embeddingNodeInstance = new embeddingNodeModule.nodeClass()
    const embeddingObj = await embeddingNodeInstance.init(embeddingNodeData, '', options)
    if (!embeddingObj) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Failed to create EmbeddingObj`)
    }

    // Proxy for usage tracking
    if (embeddingNodeData.category === 'Embeddings') {
        try {
            const originalEmbedDocuments = embeddingObj.embedDocuments?.bind(embeddingObj)
            const originalEmbedQuery = embeddingObj.embedQuery?.bind(embeddingObj)

            if (originalEmbedDocuments) {
                embeddingObj.embedDocuments = async (documents: string[]) => {
                    const start = Date.now()
                    const result = await originalEmbedDocuments(documents)
                    const end = Date.now()
                    try {
                        let tokenCount = 0
                        for (const doc of documents) tokenCount += Math.ceil(doc.length / 4)

                        const { provider, model } = extractProviderAndModel(embeddingNodeData, embeddingObj)
                        await trackLLMUsage({
                            requestId: options.chatflowid || 'doc-store-upsert',
                            // Use chatflowid as executionId alias for upsert session
                            executionId: options.chatflowid,
                            orgId: options.orgId || '',
                            userId: '0', // System/Unknown for doc store
                            chatflowId: options.chatflowid,
                            chatId: options.chatId || '',
                            feature: 'document-store-upsert',
                            nodeId: embeddingNodeData.id,
                            nodeType: embeddingNodeData.type,
                            nodeName: embeddingNodeData.name,
                            provider,
                            model,
                            requestType: 'embedding',
                            promptTokens: tokenCount,
                            completionTokens: 0,
                            totalTokens: tokenCount,
                            processingTimeMs: end - start,
                            success: true
                        })
                    } catch (e) {
                        console.error('[DocumentStore] Error tracking embedding usage', e)
                    }
                    return result
                }
            }

            if (originalEmbedQuery) {
                embeddingObj.embedQuery = async (query: string) => {
                    const start = Date.now()
                    const result = await originalEmbedQuery(query)
                    const end = Date.now()
                    try {
                        const tokenCount = Math.ceil(query.length / 4)
                        const { provider, model } = extractProviderAndModel(embeddingNodeData, embeddingObj)

                        await trackLLMUsage({
                            requestId: options.chatflowid || 'doc-store-query',
                            executionId: options.chatflowid,
                            orgId: options.orgId || '',
                            userId: '0',
                            chatflowId: options.chatflowid,
                            chatId: options.chatId || '',
                            feature: 'document-store-query',
                            nodeId: embeddingNodeData.id,
                            nodeType: embeddingNodeData.type,
                            nodeName: embeddingNodeData.name,
                            provider,
                            model,
                            requestType: 'embedding',
                            promptTokens: tokenCount,
                            completionTokens: 0,
                            totalTokens: tokenCount,
                            processingTimeMs: end - start,
                            success: true
                        })
                    } catch (e) {
                        console.error('[DocumentStore] Error tracking embedding usage (query)', e)
                    }
                    return result
                }
            }

        } catch (e) {
            console.error('[DocumentStore] Error proxying embedding object', e)
        }
    }

    return embeddingObj
}

const _createRecordManagerObject = async (
    componentNodes: IComponentNodes,
    data: ICommonObject,
    options: ICommonObject,
    upsertHistory?: Record<string, any>
) => {
    // prepare record manager node data
    const recordManagerComponent = componentNodes[data.recordManagerName]
    const rmNodeData: any = {
        inputs: { ...data.recordManagerConfig },
        id: `${recordManagerComponent.name}_0`,
        inputParams: recordManagerComponent.inputs,
        label: recordManagerComponent.label,
        name: recordManagerComponent.name,
        category: recordManagerComponent.category
    }
    if (data.recordManagerConfig.credential) {
        rmNodeData.credential = data.recordManagerConfig.credential
    }

    // save to upsert history
    if (upsertHistory) upsertHistory['flowData'] = saveUpsertFlowData(rmNodeData, upsertHistory)

    // init record manager object
    const rmNodeInstanceFilePath = recordManagerComponent.filePath as string
    const rmNodeModule = await import(rmNodeInstanceFilePath)
    const rmNodeInstance = new rmNodeModule.nodeClass()
    const recordManagerObj = await rmNodeInstance.init(rmNodeData, '', options)
    if (!recordManagerObj) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Failed to create RecordManager obj`)
    }
    return recordManagerObj
}

const _createVectorStoreNodeData = (componentNodes: IComponentNodes, data: ICommonObject, embeddingObj: any, recordManagerObj?: any) => {
    const vectorStoreComponent = componentNodes[data.vectorStoreName]
    const vStoreNodeData: any = {
        id: `${vectorStoreComponent.name}_0`,
        inputs: { ...data.vectorStoreConfig },
        outputs: { output: 'retriever' },
        label: vectorStoreComponent.label,
        name: vectorStoreComponent.name,
        category: vectorStoreComponent.category
    }
    if (data.vectorStoreConfig.credential) {
        vStoreNodeData.credential = data.vectorStoreConfig.credential
    }

    if (embeddingObj) {
        vStoreNodeData.inputs.embeddings = embeddingObj
    }

    if (recordManagerObj) {
        vStoreNodeData.inputs.recordManager = recordManagerObj
    }

    // Get all input params except the ones that are anchor points to avoid JSON stringify circular error
    const filterInputParams = ['document', 'embeddings', 'recordManager']
    const inputParams = vectorStoreComponent.inputs?.filter((input: any) => !filterInputParams.includes(input.name))
    vStoreNodeData.inputParams = inputParams
    return vStoreNodeData
}

const _createVectorStoreObject = async (
    componentNodes: IComponentNodes,
    data: ICommonObject,
    vStoreNodeData: INodeData,
    upsertHistory?: Record<string, any>
) => {
    const vStoreNodeInstanceFilePath = componentNodes[data.vectorStoreName].filePath as string
    const vStoreNodeModule = await import(vStoreNodeInstanceFilePath)
    const vStoreNodeInstance = new vStoreNodeModule.nodeClass()
    if (upsertHistory) upsertHistory['flowData'] = saveUpsertFlowData(vStoreNodeData, upsertHistory)
    return vStoreNodeInstance
}

const upsertDocStore = async (
    appDataSource: DataSource,
    componentNodes: IComponentNodes,
    storeId: string,
    data: IDocumentStoreUpsertData,
    files: Express.Multer.File[] = [],
    isRefreshExisting = false,
    orgId: string,
    usageCacheManager: UsageCacheManager
) => {
    const docId = data.docId
    let metadata = {}
    if (data.metadata) {
        try {
            metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata
        } catch (error) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, `Error: Invalid metadata`)
        }
    }
    const replaceExisting =
        typeof data.replaceExisting === 'string' ? (data.replaceExisting as string).toLowerCase() === 'true' : data.replaceExisting ?? false
    const createNewDocStore =
        typeof data.createNewDocStore === 'string'
            ? (data.createNewDocStore as string).toLowerCase() === 'true'
            : data.createNewDocStore ?? false
    const newLoader = typeof data.loader === 'string' ? JSON.parse(data.loader) : data.loader
    const newSplitter = typeof data.splitter === 'string' ? JSON.parse(data.splitter) : data.splitter
    const newVectorStore = typeof data.vectorStore === 'string' ? JSON.parse(data.vectorStore) : data.vectorStore
    const newEmbedding = typeof data.embedding === 'string' ? JSON.parse(data.embedding) : data.embedding
    const newRecordManager = typeof data.recordManager === 'string' ? JSON.parse(data.recordManager) : data.recordManager

    const getComponentLabelFromName = (nodeName: string) => {
        const component = Object.values(componentNodes).find((node) => node.name === nodeName)
        return component?.label || ''
    }

    let loaderName = ''
    let loaderId = ''
    let loaderConfig: ICommonObject = {}

    let splitterName = ''
    let splitterId = ''
    let splitterConfig: ICommonObject = {}

    let vectorStoreName = ''
    let vectorStoreConfig: ICommonObject = {}

    let embeddingName = ''
    let embeddingConfig: ICommonObject = {}

    let recordManagerName = ''
    let recordManagerConfig: ICommonObject = {}

    // Step 1: Get existing loader
    if (docId) {
        const entity = await appDataSource.getRepository(DocumentStore).findOneBy({ guid: storeId })
        if (!entity) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document store ${storeId} not found`)
        }

        const loaders = JSON.parse(entity.loaders)
        const loader = loaders.find((ldr: IDocumentStoreLoader) => ldr.id === docId)
        if (!loader) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document loader ${docId} not found`)
        }

        // Loader
        loaderName = loader.loaderName
        loaderId = loader.loaderId
        loaderConfig = {
            ...loaderConfig,
            ...loader?.loaderConfig
        }

        // Splitter
        splitterName = loader.splitterName
        splitterId = loader.splitterId
        splitterConfig = {
            ...splitterConfig,
            ...loader?.splitterConfig
        }

        // Vector Store
        vectorStoreName = JSON.parse(entity.vectorStoreConfig || '{}')?.name
        vectorStoreConfig = JSON.parse(entity.vectorStoreConfig || '{}')?.config

        // Embedding
        embeddingName = JSON.parse(entity.embeddingConfig || '{}')?.name
        embeddingConfig = JSON.parse(entity.embeddingConfig || '{}')?.config

        // Record Manager
        recordManagerName = JSON.parse(entity.recordManagerConfig || '{}')?.name
        recordManagerConfig = JSON.parse(entity.recordManagerConfig || '{}')?.config
    }

    if (createNewDocStore) {
        const docStoreBody = typeof data.docStore === 'string' ? JSON.parse(data.docStore) : data.docStore
        const newDocumentStore = docStoreBody ?? { name: `Document Store ${Date.now().toString()}` }
        const docStore = DocumentStoreDTO.toEntity(newDocumentStore)
        const documentStore = appDataSource.getRepository(DocumentStore).create(docStore)
        const dbResponse = await appDataSource.getRepository(DocumentStore).save(documentStore)
        storeId = dbResponse.guid
    }

    // Step 2: Replace with new values
    loaderName = newLoader?.name ? getComponentLabelFromName(newLoader?.name) : loaderName
    loaderId = newLoader?.name || loaderId
    loaderConfig = {
        ...loaderConfig,
        ...newLoader?.config
    }

    // Override loaderName if it's provided directly in data
    if (data.loaderName) {
        loaderName = data.loaderName
    }

    splitterName = newSplitter?.name ? getComponentLabelFromName(newSplitter?.name) : splitterName
    splitterId = newSplitter?.name || splitterId
    splitterConfig = {
        ...splitterConfig,
        ...newSplitter?.config
    }

    vectorStoreName = newVectorStore?.name || vectorStoreName
    vectorStoreConfig = {
        ...vectorStoreConfig,
        ...newVectorStore?.config
    }

    embeddingName = newEmbedding?.name || embeddingName
    embeddingConfig = {
        ...embeddingConfig,
        ...newEmbedding?.config
    }

    recordManagerName = newRecordManager?.name || recordManagerName
    recordManagerConfig = {
        ...recordManagerConfig,
        ...newRecordManager?.config
    }

    // Step 3: Replace with files
    if (files.length) {
        const filesLoaderConfig: ICommonObject = {}
        for (const file of files) {
            const fileNames: string[] = []
            const fileBuffer = await getFileFromUpload(file.path ?? file.key)
            // Address file name with special characters: https://github.com/expressjs/multer/issues/1104
            file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')

            try {
                await checkStorage(orgId, usageCacheManager)
                const { totalSize } = await addArrayFilesToStorage(
                    file.mimetype,
                    fileBuffer,
                    file.originalname,
                    fileNames,
                    orgId,
                    DOCUMENT_STORE_BASE_FOLDER,
                    storeId
                )
                await updateStorageUsage(orgId, totalSize, usageCacheManager)

                // Log file upload to document store
                try {
                    const { fileLog } = await import('../../utils/logger/module-methods')
                    await fileLog('info', 'File uploaded to document store', {
                        userId: 'system',
                        orgId: orgId,
                        fileName: file.originalname,
                        fileSize: fileBuffer.length,
                        mimeType: file.mimetype,
                        storeId: storeId,
                        totalSizeMB: totalSize
                    }).catch(() => { })
                } catch (logError) {
                    // Silently fail
                }
            } catch (error) {
                // Log file upload failure
                try {
                    const { fileLog } = await import('../../utils/logger/module-methods')
                    await fileLog('error', 'File upload to document store failed', {
                        userId: 'system',
                        orgId: orgId,
                        fileName: file.originalname,
                        storeId: storeId,
                        error: error instanceof Error ? error.message : String(error)
                    }).catch(() => { })
                } catch (logError) {
                    // Silently fail
                }
                continue
            }

            const mimePrefix = 'data:' + file.mimetype + ';base64'
            const storagePath = mimePrefix + ',' + fileBuffer.toString('base64') + `,filename:${file.originalname}`

            const fileInputFieldFromMimeType = mapMimeTypeToInputField(file.mimetype)

            const fileExtension = path.extname(file.originalname)

            const fileInputFieldFromExt = mapExtToInputField(fileExtension)

            let fileInputField = 'txtFile'

            if (fileInputFieldFromExt !== 'txtFile') {
                fileInputField = fileInputFieldFromExt
            } else if (fileInputFieldFromMimeType !== 'txtFile') {
                fileInputField = fileInputFieldFromExt
            }

            if (loaderId === 'unstructuredFileLoader') {
                fileInputField = 'fileObject'
            }

            if (filesLoaderConfig[fileInputField]) {
                const existingFileInputFieldArray = JSON.parse(filesLoaderConfig[fileInputField])
                const newFileInputFieldArray = [storagePath]
                const updatedFieldArray = existingFileInputFieldArray.concat(newFileInputFieldArray)
                filesLoaderConfig[fileInputField] = JSON.stringify(updatedFieldArray)
            } else {
                filesLoaderConfig[fileInputField] = JSON.stringify([storagePath])
            }

            await removeSpecificFileFromUpload(file.path ?? file.key)
        }

        loaderConfig = {
            ...loaderConfig,
            ...filesLoaderConfig
        }
    }

    if (Object.keys(metadata).length > 0) {
        loaderConfig = {
            ...loaderConfig,
            metadata
        }
    }

    // Step 4: Verification for must have components
    if (!loaderName || !loaderId || !loaderConfig) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Loader not configured`)
    }

    if (!vectorStoreName || !vectorStoreConfig) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Vector store not configured`)
    }

    if (!embeddingName || !embeddingConfig) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Embedding not configured`)
    }

    // Step 5: Process & Upsert
    const processData: IDocumentStoreLoaderForPreview = {
        storeId,
        loaderId,
        loaderName,
        loaderConfig,
        splitterId,
        splitterName,
        splitterConfig
    }

    if (isRefreshExisting || replaceExisting) {
        processData.id = docId
    }

    try {
        const newLoader = await saveProcessingLoader(appDataSource, processData, orgId)
        const result = await processLoader({
            appDataSource,
            componentNodes,
            data: processData,
            docLoaderId: newLoader.id || '',
            isProcessWithoutUpsert: false,
            orgId,
            usageCacheManager
        })
        const newDocId = result.docId

        const insertData = {
            storeId,
            docId: newDocId,
            vectorStoreName,
            vectorStoreConfig,
            embeddingName,
            embeddingConfig,
            recordManagerName,
            recordManagerConfig
        }

        // Note: insertIntoVectorStore uses orgId and usageCacheManager for this use case
        const res = await insertIntoVectorStore({
            appDataSource,
            componentNodes,
            data: insertData,
            isStrictSave: false,
            isVectorStoreInsert: true,
            orgId,
            usageCacheManager
        })
        res.docId = newDocId

        return res
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.upsertDocStore - ${getErrorMessage(error)}`
        )
    }
}

export const executeDocStoreUpsert = async ({
    appDataSource,
    componentNodes,
    storeId,
    totalItems,
    files,
    isRefreshAPI,
    orgId,
    usageCacheManager
}: IExecuteDocStoreUpsert) => {
    const results = []
    for (const item of totalItems) {
        const res = await upsertDocStore(appDataSource, componentNodes, storeId, item, files, isRefreshAPI, orgId || '', usageCacheManager)
        results.push(res)
    }
    return isRefreshAPI ? results : results[0]
}

const upsertDocStoreMiddleware = async (
    storeId: string,
    data: IDocumentStoreUpsertData,
    files: Express.Multer.File[] = [],
    orgId: string,
    usageCacheManager: UsageCacheManager
) => {
    const appServer = getRunningExpressApp()
    const componentNodes = appServer.nodesPool.componentNodes
    const appDataSource = getDataSource(parseInt(orgId))

    try {
        const executeData: IExecuteDocStoreUpsert = {
            appDataSource,
            componentNodes,
            storeId,
            totalItems: [data],
            files,
            isRefreshAPI: false,
            orgId,
            usageCacheManager
        }

        if (process.env.MODE === MODE.QUEUE) {
            const orgIdNum = parseInt(orgId || '0')
            if (!orgIdNum) {
                throw new InternalAutonomousError(
                    StatusCodes.BAD_REQUEST,
                    `Invalid organization ID: ${orgId}. orgId is required for queue mode.`
                )
            }
            const upsertQueue = appServer.queueManager.getQueue(orgIdNum, 'upsert')
            const job = await upsertQueue.addJob(omit(executeData, OMIT_QUEUE_JOB_DATA))
            const { logDebug } = await import('../../utils/logger/system-helper')
            logDebug(`[server]: [${orgId}]: Job added to queue: ${job.id}`).catch(() => { })

            const queueEvents = upsertQueue.getQueueEvents()
            const result = await job.waitUntilFinished(queueEvents)

            if (!result) {
                throw new Error('Job execution failed')
            }
            return result
        } else {
            return await executeDocStoreUpsert(executeData)
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.upsertDocStoreMiddleware - ${getErrorMessage(error)}`
        )
    }
}

const refreshDocStoreMiddleware = async (
    storeId: string,
    data: IDocumentStoreRefreshData,
    orgId: string,
    usageCacheManager: UsageCacheManager
) => {
    const appServer = getRunningExpressApp()
    const componentNodes = appServer.nodesPool.componentNodes
    const appDataSource = getDataSource(parseInt(orgId))

    try {
        let totalItems: IDocumentStoreUpsertData[] = []

        if (!data || !data.items || data.items.length === 0) {
            const entity = await appDataSource.getRepository(DocumentStore).findOneBy({ guid: storeId })
            if (!entity) {
                throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document store ${storeId} not found`)
            }

            const loaders = JSON.parse(entity.loaders)
            totalItems = loaders.map((ldr: IDocumentStoreLoader) => {
                return {
                    docId: ldr.id
                }
            })
        } else {
            totalItems = data.items
        }

        const executeData: IExecuteDocStoreUpsert = {
            appDataSource,
            componentNodes,
            storeId,
            totalItems,
            files: [],
            isRefreshAPI: true,
            orgId,
            usageCacheManager
        }

        if (process.env.MODE === MODE.QUEUE) {
            const orgIdNum = parseInt(orgId || '0')
            if (!orgIdNum) {
                throw new InternalAutonomousError(
                    StatusCodes.BAD_REQUEST,
                    `Invalid organization ID: ${orgId}. orgId is required for queue mode.`
                )
            }
            const upsertQueue = appServer.queueManager.getQueue(orgIdNum, 'upsert')
            const job = await upsertQueue.addJob(omit(executeData, OMIT_QUEUE_JOB_DATA))
            const { logDebug } = await import('../../utils/logger/system-helper')
            logDebug(`[server]: [${orgId}]: Job added to queue: ${job.id}`).catch(() => { })

            const queueEvents = upsertQueue.getQueueEvents()
            const result = await job.waitUntilFinished(queueEvents)

            if (!result) {
                throw new Error('Job execution failed')
            }
            return result
        } else {
            return await executeDocStoreUpsert(executeData)
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.refreshDocStoreMiddleware - ${getErrorMessage(error)}`
        )
    }
}

const generateDocStoreToolDesc = async (docStoreId: string, selectedChatModel: ICommonObject, orgId: string): Promise<string> => {
    try {
        const appServer = getRunningExpressApp()
        const appDataSource = getDataSource(parseInt(orgId))

        // get matching DocumentStoreFileChunk storeId with docStoreId, and only the first 4 chunks sorted by chunkNo
        const chunks = await appDataSource.getRepository(DocumentStoreFileChunk).findBy({
            storeId: docStoreId
        })

        if (!chunks?.length) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `DocumentStore ${docStoreId} chunks not found`)
        }

        // sort the chunks by chunkNo
        chunks.sort((a, b) => a.chunkNo - b.chunkNo)

        // get the first 4 chunks
        const chunksPageContent = chunks
            .slice(0, 4)
            .map((chunk) => {
                return chunk.pageContent
            })
            .join('\n')

        if (selectedChatModel && Object.keys(selectedChatModel).length > 0) {
            const nodeInstanceFilePath = appServer.nodesPool.componentNodes[selectedChatModel.name].filePath as string
            const nodeModule = await import(nodeInstanceFilePath)
            const newNodeInstance = new nodeModule.nodeClass()
            const nodeData = {
                credential: selectedChatModel.credential || selectedChatModel.inputs['AUTONOMOUS_CREDENTIAL_ID'] || undefined,
                inputs: selectedChatModel.inputs,
                id: `${selectedChatModel.name}_0`
            }
            const options: ICommonObject = {
                appDataSource: appDataSource,
                databaseEntities,
                logger: undefined
            }
            const llmNodeInstance = await newNodeInstance.init(nodeData, '', options)
            const response = await llmNodeInstance.invoke(
                DOCUMENTSTORE_TOOL_DESCRIPTION_PROMPT_GENERATOR.replace('{context}', chunksPageContent)
            )
            return response
        }

        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.generateDocStoreToolDesc - Error generating tool description`
        )
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: documentStoreServices.generateDocStoreToolDesc - ${getErrorMessage(error)}`
        )
    }
}

export const findDocStoreAvailableConfigs = async (storeId: string, docId: string, orgId: string) => {
    // find the document store
    const appServer = getRunningExpressApp()
    const appDataSource = getDataSource(parseInt(orgId))
    const entity = await appDataSource.getRepository(DocumentStore).findOneBy({ guid: storeId })

    if (!entity) {
        throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document store ${storeId} not found`)
    }

    const loaders = JSON.parse(entity.loaders)
    const loader = loaders.find((ldr: IDocumentStoreLoader) => ldr.id === docId)
    if (!loader) {
        throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Document loader ${docId} not found`)
    }

    const nodes = []
    const componentCredentials = appServer.nodesPool.componentCredentials

    const loaderName = loader.loaderId
    const loaderLabel = appServer.nodesPool.componentNodes[loaderName].label

    const loaderInputs =
        appServer.nodesPool.componentNodes[loaderName].inputs?.filter((input: any) => INPUT_PARAMS_TYPE.includes(input.type)) ?? []
    nodes.push({
        label: loaderLabel,
        nodeId: `${loaderName}_0`,
        inputParams: loaderInputs
    })

    const splitterName = loader.splitterId
    if (splitterName) {
        const splitterLabel = appServer.nodesPool.componentNodes[splitterName].label
        const splitterInputs =
            appServer.nodesPool.componentNodes[splitterName].inputs?.filter((input: any) => INPUT_PARAMS_TYPE.includes(input.type)) ?? []
        nodes.push({
            label: splitterLabel,
            nodeId: `${splitterName}_0`,
            inputParams: splitterInputs
        })
    }

    if (entity.vectorStoreConfig) {
        const vectorStoreName = JSON.parse(entity.vectorStoreConfig || '{}').name
        const vectorStoreLabel = appServer.nodesPool.componentNodes[vectorStoreName].label
        const vectorStoreInputs =
            appServer.nodesPool.componentNodes[vectorStoreName].inputs?.filter((input: any) => INPUT_PARAMS_TYPE.includes(input.type)) ?? []
        nodes.push({
            label: vectorStoreLabel,
            nodeId: `${vectorStoreName}_0`,
            inputParams: vectorStoreInputs
        })
    }

    if (entity.embeddingConfig) {
        const embeddingName = JSON.parse(entity.embeddingConfig || '{}').name
        const embeddingLabel = appServer.nodesPool.componentNodes[embeddingName].label
        const embeddingInputs =
            appServer.nodesPool.componentNodes[embeddingName].inputs?.filter((input: any) => INPUT_PARAMS_TYPE.includes(input.type)) ?? []
        nodes.push({
            label: embeddingLabel,
            nodeId: `${embeddingName}_0`,
            inputParams: embeddingInputs
        })
    }

    if (entity.recordManagerConfig) {
        const recordManagerName = JSON.parse(entity.recordManagerConfig || '{}').name
        const recordManagerLabel = appServer.nodesPool.componentNodes[recordManagerName].label
        const recordManagerInputs =
            appServer.nodesPool.componentNodes[recordManagerName].inputs?.filter((input: any) => INPUT_PARAMS_TYPE.includes(input.type)) ??
            []
        nodes.push({
            label: recordManagerLabel,
            nodeId: `${recordManagerName}_0`,
            inputParams: recordManagerInputs
        })
    }

    const configs: IOverrideConfig[] = []
    for (const node of nodes) {
        const inputParams = node.inputParams
        for (const inputParam of inputParams) {
            let obj: IOverrideConfig
            if (inputParam.type === 'file') {
                obj = {
                    node: node.label,
                    nodeId: node.nodeId,
                    label: inputParam.label,
                    name: 'files',
                    type: inputParam.fileType ?? inputParam.type
                }
            } else if (inputParam.type === 'options') {
                obj = {
                    node: node.label,
                    nodeId: node.nodeId,
                    label: inputParam.label,
                    name: inputParam.name,
                    type: inputParam.options
                        ? inputParam.options
                            ?.map((option: any) => {
                                return option.name
                            })
                            .join(', ')
                        : 'string'
                }
            } else if (inputParam.type === 'credential') {
                // get component credential inputs
                for (const name of inputParam.credentialNames ?? []) {
                    if (Object.prototype.hasOwnProperty.call(componentCredentials, name)) {
                        const inputs = componentCredentials[name]?.inputs ?? []
                        for (const input of inputs) {
                            obj = {
                                node: node.label,
                                nodeId: node.nodeId,
                                label: input.label,
                                name: input.name,
                                type: input.type === 'password' ? 'string' : input.type
                            }
                            configs.push(obj)
                        }
                    }
                }
                continue
            } else {
                obj = {
                    node: node.label,
                    nodeId: node.nodeId,
                    label: inputParam.label,
                    name: inputParam.name,
                    type: inputParam.type === 'password' ? 'string' : inputParam.type
                }
            }
            if (!configs.some((config) => JSON.stringify(config) === JSON.stringify(obj))) {
                configs.push(obj)
            }
        }
    }

    return configs
}

export default {
    updateDocumentStoreUsage,
    deleteDocumentStore,
    createDocumentStore,
    deleteLoaderFromDocumentStore,
    getAllDocumentStores,
    getAllDocumentFileChunksByDocumentStoreIds,
    getDocumentStoreById,
    getUsedChatflowNames,
    getDocumentStoreFileChunks,
    updateDocumentStore,
    previewChunksMiddleware,
    saveProcessingLoader,
    processLoaderMiddleware,
    deleteDocumentStoreFileChunk,
    editDocumentStoreFileChunk,
    getDocumentLoaders,
    insertIntoVectorStoreMiddleware,
    getEmbeddingProviders,
    getVectorStoreProviders,
    getRecordManagerProviders,
    saveVectorStoreConfig,
    queryVectorStore,
    deleteVectorStoreFromStore,
    updateVectorStoreConfigOnly,
    upsertDocStoreMiddleware,
    refreshDocStoreMiddleware,
    generateDocStoreToolDesc,
    findDocStoreAvailableConfigs
}
