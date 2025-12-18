import client from './client'

/**
 * Get aggregated LLM usage statistics
 * @param {Object} filters - Filter parameters
 * @param {string} filters.orgId - Organization ID (required)
 * @param {string} [filters.userId] - User ID
 * @param {string} [filters.startDate] - Start date (ISO string or timestamp)
 * @param {string} [filters.endDate] - End date (ISO string or timestamp)
 * @param {string} [filters.feature] - Feature filter (chatflow, agentflow, assistant, embedding)
 * @param {string} [filters.provider] - Provider filter (openai, google, anthropic, etc.)
 * @param {string} [filters.model] - Model filter
 * @returns {Promise} Axios response with stats data
 */
const getStats = (filters = {}) => {
    const params = {}
    if (filters.orgId) params.orgId = filters.orgId
    if (filters.userId) params.userId = filters.userId
    if (filters.startDate) params.startDate = filters.startDate
    if (filters.endDate) params.endDate = filters.endDate
    if (filters.feature) params.feature = filters.feature
    if (filters.provider) params.provider = filters.provider
    if (filters.model) params.model = filters.model
    if (filters.chatflowId) params.chatflowId = filters.chatflowId
    if (filters.executionId) params.executionId = filters.executionId
    if (filters.requestId) params.requestId = filters.requestId
    if (filters.success !== undefined) params.success = filters.success

    return client.get('/llm-usage/stats', { params })
}

/**
 * Query LLM usage records with pagination
 * @param {Object} filters - Filter parameters
 * @param {string} filters.orgId - Organization ID (required)
 * @param {string} [filters.userId] - User ID
 * @param {string} [filters.startDate] - Start date (ISO string or timestamp)
 * @param {string} [filters.endDate] - End date (ISO string or timestamp)
 * @param {string} [filters.feature] - Feature filter
 * @param {string} [filters.provider] - Provider filter
 * @param {string} [filters.model] - Model filter
 * @param {number} [filters.page=1] - Page number
 * @param {number} [filters.limit=50] - Records per page
 * @returns {Promise} Axios response with { data: [], total: number }
 */
const queryUsage = (filters = {}) => {
    const params = {}
    if (filters.orgId) params.orgId = filters.orgId
    if (filters.userId) params.userId = filters.userId
    if (filters.startDate) params.startDate = filters.startDate
    if (filters.endDate) params.endDate = filters.endDate
    if (filters.feature) params.feature = filters.feature
    if (filters.provider) params.provider = filters.provider
    if (filters.model) params.model = filters.model
    if (filters.chatflowId) params.chatflowId = filters.chatflowId
    if (filters.executionId) params.executionId = filters.executionId
    if (filters.requestId) params.requestId = filters.requestId
    if (filters.success !== undefined) params.success = filters.success
    if (filters.page) params.page = filters.page
    if (filters.limit) params.limit = filters.limit

    return client.get('/llm-usage/query', { params })
}

/**
 * Get unique filter values (providers, models, features)
 * @param {Object} filters - Filter parameters (orgId required)
 * @returns {Promise} Axios response with { providers: [], models: [], features: [] }
 */
const getFilters = (filters = {}) => {
    const params = {}
    if (filters.orgId) params.orgId = filters.orgId
    return client.get('/llm-usage/filters', { params })
}

/**
 * Get time-series data grouped by date
 * @param {Object} filters - Filter parameters
 * @param {string} filters.orgId - Organization ID (required)
 * @param {string} [filters.startDate] - Start date (ISO string or timestamp)
 * @param {string} [filters.endDate] - End date (ISO string or timestamp)
 * @param {string} [filters.feature] - Feature filter
 * @param {string} [filters.provider] - Provider filter
 * @param {string} [filters.model] - Model filter
 * @returns {Promise} Axios response with time-series data array
 */
const getTimeSeries = (filters = {}) => {
    const params = {}
    if (filters.orgId) params.orgId = filters.orgId
    if (filters.startDate) params.startDate = filters.startDate
    if (filters.endDate) params.endDate = filters.endDate
    if (filters.feature) params.feature = filters.feature
    if (filters.provider) params.provider = filters.provider
    if (filters.model) params.model = filters.model
    return client.get('/llm-usage/time-series', { params })
}

export default {
    getStats,
    queryUsage,
    getFilters,
    getTimeSeries
}

