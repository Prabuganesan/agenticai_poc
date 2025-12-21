import { NextFunction, Response } from 'express'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'
import { StatusCodes } from 'http-status-codes'
import documentStoreService from '../../services/documentstore'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import { DocumentStoreDTO } from '../../Interface'
import { DocumentStore } from '../../database/entities/DocumentStore'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { Request } from 'express'
import { KODIVIAN_COUNTER_STATUS, KODIVIAN_METRIC_COUNTERS } from '../../Interface.Metrics'
import { getPageAndLimitParams } from '../../utils/pagination'
import { getDataSource } from '../../DataSource'
import { canModifyResource } from '../../utils/permissions'

const createDocumentStore = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.createDocumentStore - body not provided!`
            )
        }

        const orgId = (req as any).orgId || req.user?.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.createDocumentStore - organizationId not provided!`
            )
        }

        const body = req.body
        const userId = req.userId
        body.orgId = req.orgId
        if (!body.orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.createDocumentStore - orgId not provided!`
            )
        }
        const docStore = DocumentStoreDTO.toEntity(body)
        const apiResponse = await documentStoreService.createDocumentStore(docStore, orgId, userId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllDocumentStores = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { page, limit } = getPageAndLimitParams(req as any)

        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.getAllDocumentStores - orgId not provided!`
            )
        }
        const userId = req.userId ? parseInt(req.userId) : undefined
        const apiResponse: any = await documentStoreService.getAllDocumentStores(orgId, userId, page, limit)
        if (apiResponse?.total >= 0) {
            return res.json({
                total: apiResponse.total,
                data: DocumentStoreDTO.fromEntities(apiResponse.data)
            })
        } else {
            return res.json(DocumentStoreDTO.fromEntities(apiResponse))
        }
    } catch (error) {
        next(error)
    }
}

const deleteLoaderFromDocumentStore = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const storeId = req.params.id
        const loaderId = req.params.loaderId

        if (!storeId || !loaderId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.deleteLoaderFromDocumentStore - missing storeId or loaderId.`
            )
        }

        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.deleteLoaderFromDocumentStore - orgId not provided!`
            )
        }

        const apiResponse = await documentStoreService.deleteLoaderFromDocumentStore(
            storeId,
            loaderId,
            orgId,
            getRunningExpressApp().usageCacheManager
        )
        return res.json(DocumentStoreDTO.fromEntity(apiResponse))
    } catch (error) {
        next(error)
    }
}

const getDocumentStoreById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params.id === 'undefined' || req.params.id === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.getDocumentStoreById - id not provided!`
            )
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.getDocumentStoreById - orgId not provided!`
            )
        }
        const apiResponse = await documentStoreService.getDocumentStoreById(req.params.id, orgId)
        if (apiResponse && apiResponse.whereUsed) {
            apiResponse.whereUsed = JSON.stringify(await documentStoreService.getUsedChatflowNames(apiResponse, orgId))
        }
        return res.json(DocumentStoreDTO.fromEntity(apiResponse))
    } catch (error) {
        next(error)
    }
}

const getDocumentStoreFileChunks = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params.storeId === 'undefined' || req.params.storeId === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.getDocumentStoreFileChunks - storeId not provided!`
            )
        }
        if (typeof req.params.fileId === 'undefined' || req.params.fileId === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.getDocumentStoreFileChunks - fileId not provided!`
            )
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.getDocumentStoreFileChunks - orgId not provided!`
            )
        }
        const appDataSource = getDataSource(parseInt(orgId))
        const page = req.params.pageNo ? parseInt(req.params.pageNo) : 1
        const apiResponse = await documentStoreService.getDocumentStoreFileChunks(
            appDataSource,
            req.params.storeId,
            req.params.fileId,
            orgId,
            page
        )
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deleteDocumentStoreFileChunk = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params.storeId === 'undefined' || req.params.storeId === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.deleteDocumentStoreFileChunk - storeId not provided!`
            )
        }
        if (typeof req.params.loaderId === 'undefined' || req.params.loaderId === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.deleteDocumentStoreFileChunk - loaderId not provided!`
            )
        }
        if (typeof req.params.chunkId === 'undefined' || req.params.chunkId === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.deleteDocumentStoreFileChunk - chunkId not provided!`
            )
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.deleteDocumentStoreFileChunk - orgId not provided!`
            )
        }
        const apiResponse = await documentStoreService.deleteDocumentStoreFileChunk(
            req.params.storeId,
            req.params.loaderId,
            req.params.chunkId,
            orgId
        )
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const editDocumentStoreFileChunk = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params.storeId === 'undefined' || req.params.storeId === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.editDocumentStoreFileChunk - storeId not provided!`
            )
        }
        if (typeof req.params.loaderId === 'undefined' || req.params.loaderId === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.editDocumentStoreFileChunk - loaderId not provided!`
            )
        }
        if (typeof req.params.chunkId === 'undefined' || req.params.chunkId === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.editDocumentStoreFileChunk - chunkId not provided!`
            )
        }
        const body = req.body
        if (typeof body === 'undefined') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.editDocumentStoreFileChunk - body not provided!`
            )
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.editDocumentStoreFileChunk - orgId not provided!`
            )
        }
        const apiResponse = await documentStoreService.editDocumentStoreFileChunk(
            req.params.storeId,
            req.params.loaderId,
            req.params.chunkId,
            body.pageContent,
            body.metadata,
            orgId
        )
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const saveProcessingLoader = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        if (typeof req.body === 'undefined') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.saveProcessingLoader - body not provided!`
            )
        }
        const body = req.body
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.saveProcessingLoader - orgId not provided!`
            )
        }
        const { getDataSource } = await import('../../DataSource')
        const dataSource = getDataSource(parseInt(orgId))
        const apiResponse = await documentStoreService.saveProcessingLoader(dataSource, body, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const processLoader = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params.loaderId === 'undefined' || req.params.loaderId === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.processLoader - loaderId not provided!`
            )
        }
        if (typeof req.body === 'undefined') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.processLoader - body not provided!`
            )
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.deleteLoaderFromDocumentStore - orgId not provided!`
            )
        }
        const docLoaderId = req.params.loaderId
        const body = req.body
        const isInternalRequest = req.headers['x-request-from'] === 'internal'
        const apiResponse = await documentStoreService.processLoaderMiddleware(
            body,
            docLoaderId,
            orgId,
            getRunningExpressApp().usageCacheManager,
            isInternalRequest
        )
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const updateDocumentStore = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params.id === 'undefined' || req.params.id === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.updateDocumentStore - storeId not provided!`
            )
        }
        if (typeof req.body === 'undefined') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.updateDocumentStore - body not provided!`
            )
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.updateDocumentStore - orgId not provided!`
            )
        }

        // Check if user has permission to update (creator-only)
        const { canModify } = await canModifyResource('documentstore', req.params.id, req.userId!, req.orgId!)

        if (!canModify) {
            throw new InternalKodivianError(StatusCodes.FORBIDDEN, 'Only the creator can modify this document store')
        }

        const store = await documentStoreService.getDocumentStoreById(req.params.id, orgId)
        if (!store) {
            throw new InternalKodivianError(
                StatusCodes.NOT_FOUND,
                `Error: documentStoreController.updateDocumentStore - DocumentStore ${req.params.id} not found in the database`
            )
        }
        const body = req.body
        const userId = req.userId
        // Map frontend 'id' (which is actually guid) to 'guid', and remove 'id' to prevent it from being assigned to numeric id field
        const { id, ...bodyWithoutId } = body
        const bodyWithGuid = id ? { ...bodyWithoutId, guid: id } : bodyWithoutId
        const updateDocStore = new DocumentStore()
        Object.assign(updateDocStore, bodyWithGuid)
        const apiResponse = await documentStoreService.updateDocumentStore(store, updateDocStore, orgId, userId)
        return res.json(DocumentStoreDTO.fromEntity(apiResponse))
    } catch (error) {
        next(error)
    }
}

const deleteDocumentStore = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params.id === 'undefined' || req.params.id === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.deleteDocumentStore - storeId not provided!`
            )
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.deleteLoaderFromDocumentStore - orgId not provided!`
            )
        }

        // Check if user has permission to delete (creator-only)
        const { canModify } = await canModifyResource('documentstore', req.params.id, req.userId!, req.orgId!)

        if (!canModify) {
            throw new InternalKodivianError(StatusCodes.FORBIDDEN, 'Only the creator can delete this document store')
        }

        const apiResponse = await documentStoreService.deleteDocumentStore(req.params.id, orgId, getRunningExpressApp().usageCacheManager)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const previewFileChunks = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.previewFileChunks - body not provided!`
            )
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.deleteLoaderFromDocumentStore - orgId not provided!`
            )
        }
        const body = req.body
        body.preview = true
        const apiResponse = await documentStoreService.previewChunksMiddleware(body, orgId, getRunningExpressApp().usageCacheManager)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getDocumentLoaders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const apiResponse = await documentStoreService.getDocumentLoaders()
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const insertIntoVectorStore = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined') {
            throw new Error('Error: documentStoreController.insertIntoVectorStore - body not provided!')
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.deleteLoaderFromDocumentStore - orgId not provided!`
            )
        }
        const body = req.body
        const apiResponse = await documentStoreService.insertIntoVectorStoreMiddleware(
            body,
            false,
            orgId,
            getRunningExpressApp().usageCacheManager
        )
        getRunningExpressApp().metricsProvider?.incrementCounter(KODIVIAN_METRIC_COUNTERS.VECTORSTORE_UPSERT, {
            status: KODIVIAN_COUNTER_STATUS.SUCCESS
        })
        return res.json(DocumentStoreDTO.fromEntity(apiResponse))
    } catch (error) {
        getRunningExpressApp().metricsProvider?.incrementCounter(KODIVIAN_METRIC_COUNTERS.VECTORSTORE_UPSERT, {
            status: KODIVIAN_COUNTER_STATUS.FAILURE
        })
        next(error)
    }
}

const queryVectorStore = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined') {
            throw new Error('Error: documentStoreController.queryVectorStore - body not provided!')
        }
        const body = req.body
        const orgId = req.orgId || (req as any).orgId
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const apiResponse = await documentStoreService.queryVectorStore(body, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deleteVectorStoreFromStore = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params.storeId === 'undefined' || req.params.storeId === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.deleteVectorStoreFromStore - storeId not provided!`
            )
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.deleteVectorStoreFromStore - orgId not provided!`
            )
        }
        const apiResponse = await documentStoreService.deleteVectorStoreFromStore(req.params.storeId, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const saveVectorStoreConfig = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined') {
            throw new Error('Error: documentStoreController.saveVectorStoreConfig - body not provided!')
        }
        const body = req.body
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.saveVectorStoreConfig - orgId not provided!`
            )
        }
        const appDataSource = getDataSource(parseInt(orgId))
        const apiResponse = await documentStoreService.saveVectorStoreConfig(appDataSource, body, true, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const updateVectorStoreConfigOnly = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined') {
            throw new Error('Error: documentStoreController.updateVectorStoreConfigOnly - body not provided!')
        }
        const body = req.body
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.updateVectorStoreConfigOnly - orgId not provided!`
            )
        }
        const apiResponse = await documentStoreService.updateVectorStoreConfigOnly(body, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getEmbeddingProviders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiResponse = await documentStoreService.getEmbeddingProviders()
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getVectorStoreProviders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiResponse = await documentStoreService.getVectorStoreProviders()
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getRecordManagerProviders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiResponse = await documentStoreService.getRecordManagerProviders()
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const upsertDocStoreMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params.id === 'undefined' || req.params.id === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.upsertDocStoreMiddleware - storeId not provided!`
            )
        }
        if (typeof req.body === 'undefined') {
            throw new Error('Error: documentStoreController.upsertDocStoreMiddleware - body not provided!')
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.deleteLoaderFromDocumentStore - orgId not provided!`
            )
        }
        const body = req.body
        const files = (req.files as Express.Multer.File[]) || []
        const apiResponse = await documentStoreService.upsertDocStoreMiddleware(
            req.params.id,
            body,
            files,
            orgId,
            getRunningExpressApp().usageCacheManager
        )
        getRunningExpressApp().metricsProvider?.incrementCounter(KODIVIAN_METRIC_COUNTERS.VECTORSTORE_UPSERT, {
            status: KODIVIAN_COUNTER_STATUS.SUCCESS
        })
        return res.json(apiResponse)
    } catch (error) {
        getRunningExpressApp().metricsProvider?.incrementCounter(KODIVIAN_METRIC_COUNTERS.VECTORSTORE_UPSERT, {
            status: KODIVIAN_COUNTER_STATUS.FAILURE
        })
        next(error)
    }
}

const refreshDocStoreMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params.id === 'undefined' || req.params.id === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.refreshDocStoreMiddleware - storeId not provided!`
            )
        }
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.deleteLoaderFromDocumentStore - orgId not provided!`
            )
        }
        const body = req.body
        const apiResponse = await documentStoreService.refreshDocStoreMiddleware(
            req.params.id,
            body,
            orgId,
            getRunningExpressApp().usageCacheManager
        )
        getRunningExpressApp().metricsProvider?.incrementCounter(KODIVIAN_METRIC_COUNTERS.VECTORSTORE_UPSERT, {
            status: KODIVIAN_COUNTER_STATUS.SUCCESS
        })
        return res.json(apiResponse)
    } catch (error) {
        getRunningExpressApp().metricsProvider?.incrementCounter(KODIVIAN_METRIC_COUNTERS.VECTORSTORE_UPSERT, {
            status: KODIVIAN_COUNTER_STATUS.FAILURE
        })
        next(error)
    }
}

const generateDocStoreToolDesc = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params.id === 'undefined' || req.params.id === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.generateDocStoreToolDesc - storeId not provided!`
            )
        }
        if (typeof req.body === 'undefined') {
            throw new Error('Error: documentStoreController.generateDocStoreToolDesc - body not provided!')
        }
        const orgId = req.orgId || (req as any).orgId
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const apiResponse = await documentStoreService.generateDocStoreToolDesc(req.params.id, req.body.selectedChatModel, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getDocStoreConfigs = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params.id === 'undefined' || req.params.id === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.getDocStoreConfigs - storeId not provided!`
            )
        }
        if (typeof req.params.loaderId === 'undefined' || req.params.loaderId === '') {
            throw new InternalKodivianError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: documentStoreController.getDocStoreConfigs - doc loader Id not provided!`
            )
        }
        const orgId = req.orgId || (req as any).orgId
        if (!orgId) {
            throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const apiResponse = await documentStoreService.findDocStoreAvailableConfigs(req.params.id, req.params.loaderId, orgId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    deleteDocumentStore,
    createDocumentStore,
    getAllDocumentStores,
    deleteLoaderFromDocumentStore,
    getDocumentStoreById,
    getDocumentStoreFileChunks,
    updateDocumentStore,
    processLoader,
    previewFileChunks,
    getDocumentLoaders,
    deleteDocumentStoreFileChunk,
    editDocumentStoreFileChunk,
    insertIntoVectorStore,
    getEmbeddingProviders,
    getVectorStoreProviders,
    getRecordManagerProviders,
    saveVectorStoreConfig,
    queryVectorStore,
    deleteVectorStoreFromStore,
    updateVectorStoreConfigOnly,
    upsertDocStoreMiddleware,
    refreshDocStoreMiddleware,
    saveProcessingLoader,
    generateDocStoreToolDesc,
    getDocStoreConfigs
}
