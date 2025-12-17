import client from './client'

// Legacy method (keep for backward compatibility)
const getLogs = (startDate, endDate) => client.get(`/logs?startDate=${startDate}&endDate=${endDate}`)

// New dashboard API methods (POST to match autonomous_old pattern)
const queryLogs = (filters) => client.post('/logs/query', filters)

const getLogStats = (orgId) => client.post('/logs/stats', { orgId })

const getAllFilters = (orgId) => client.post('/logs/filters', { orgId })

const getLogGroups = (orgId) => client.post('/logs/groups', { orgId })

const getLogLevels = (orgId) => client.post('/logs/levels', { orgId })

const getServices = (orgId) => client.post('/logs/services', { orgId })

const getModules = (orgId) => client.post('/logs/modules', { orgId })

export default {
    getLogs, // Legacy
    queryLogs,
    getLogStats,
    getAllFilters,
    getLogGroups,
    getLogLevels,
    getServices,
    getModules
}
