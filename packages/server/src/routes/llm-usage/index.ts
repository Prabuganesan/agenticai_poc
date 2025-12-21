import express from 'express'
import llmUsageController from '../../controllers/llm-usage'
// Permission checks removed for kodivian server - handled externally
const router = express.Router()

// Get aggregated statistics
router.get('/stats', llmUsageController.getStats as express.RequestHandler)

// Query usage records
router.get('/query', llmUsageController.queryUsage as express.RequestHandler)

// Get unique filter values
router.get('/filters', llmUsageController.getFilters as express.RequestHandler)

// Get time-series data
router.get('/time-series', llmUsageController.getTimeSeries as express.RequestHandler)

export default router
