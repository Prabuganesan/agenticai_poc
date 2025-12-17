import express from 'express'
// Permission checks removed for autonomous server - handled externally
import documentStoreController from '../../controllers/documentstore'
import { getMulterStorage } from '../../utils'

const router = express.Router()

router.post(
    ['/upsert/', '/upsert/:id'],
    getMulterStorage().array('files'),
    documentStoreController.upsertDocStoreMiddleware as express.RequestHandler
)

router.post(['/refresh/', '/refresh/:id'], documentStoreController.refreshDocStoreMiddleware as express.RequestHandler)

/** Document Store Routes */
// Create document store
router.post('/store', documentStoreController.createDocumentStore as express.RequestHandler)
// List all stores
router.get('/store', documentStoreController.getAllDocumentStores as express.RequestHandler)
// Get specific store
router.get('/store/:id', documentStoreController.getDocumentStoreById as express.RequestHandler)
// Update documentStore
router.put('/store/:id', documentStoreController.updateDocumentStore as express.RequestHandler)
// Delete documentStore
router.delete('/store/:id', documentStoreController.deleteDocumentStore as express.RequestHandler)
// Get document store configs
router.get('/store-configs/:id/:loaderId', documentStoreController.getDocStoreConfigs as express.RequestHandler)

/** Component Nodes = Document Store - Loaders */
// Get all loaders
router.get('/components/loaders', documentStoreController.getDocumentLoaders as express.RequestHandler)

// delete loader from document store
router.delete('/loader/:id/:loaderId', documentStoreController.deleteLoaderFromDocumentStore as express.RequestHandler)
// chunking preview
router.post('/loader/preview', documentStoreController.previewFileChunks as express.RequestHandler)
// saving process
router.post('/loader/save', documentStoreController.saveProcessingLoader as express.RequestHandler)
// chunking process
router.post('/loader/process/:loaderId', documentStoreController.processLoader as express.RequestHandler)

/** Document Store - Loaders - Chunks */
// delete specific file chunk from the store
router.delete('/chunks/:storeId/:loaderId/:chunkId', documentStoreController.deleteDocumentStoreFileChunk as express.RequestHandler)
// edit specific file chunk from the store
router.put('/chunks/:storeId/:loaderId/:chunkId', documentStoreController.editDocumentStoreFileChunk as express.RequestHandler)
// Get all file chunks from the store
router.get('/chunks/:storeId/:fileId/:pageNo', documentStoreController.getDocumentStoreFileChunks as express.RequestHandler)

// add chunks to the selected vector store
router.post('/vectorstore/insert', documentStoreController.insertIntoVectorStore as express.RequestHandler)
// save the selected vector store
router.post('/vectorstore/save', documentStoreController.saveVectorStoreConfig as express.RequestHandler)
// delete data from the selected vector store
router.delete('/vectorstore/:storeId', documentStoreController.deleteVectorStoreFromStore as express.RequestHandler)
// query the vector store
router.post('/vectorstore/query', documentStoreController.queryVectorStore as express.RequestHandler)
// Get all embedding providers
router.get('/components/embeddings', documentStoreController.getEmbeddingProviders as unknown as express.RequestHandler)
// Get all vector store providers
router.get('/components/vectorstore', documentStoreController.getVectorStoreProviders as unknown as express.RequestHandler)
// Get all Record Manager providers
router.get('/components/recordmanager', documentStoreController.getRecordManagerProviders as unknown as express.RequestHandler)

// update the selected vector store from the playground
router.post('/vectorstore/update', documentStoreController.updateVectorStoreConfigOnly as express.RequestHandler)

// generate docstore tool description
router.post('/generate-tool-desc/:id', documentStoreController.generateDocStoreToolDesc as express.RequestHandler)

export default router
