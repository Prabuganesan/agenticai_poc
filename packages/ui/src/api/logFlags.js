/**
 * Log Flags API Service
 * Phase 7.1: API service for flag management (POST endpoints)
 */

import client from './client'

/**
 * Get current flag status
 * POST /api/v1/logs/flags
 * @param {string} orgId - Organization ID (optional)
 * @returns {Promise} Flag status response
 */
const getFlags = (orgId) => {
    const body = orgId ? { orgId } : {}
    return client.post('/logs/flags', body)
}

/**
 * Refresh flags from environment variables
 * POST /api/v1/logs/flags/refresh
 * @param {string} orgId - Organization ID (optional)
 * @returns {Promise} Flag status response
 */
const refreshFlags = (orgId) => {
    const body = orgId ? { orgId } : {}
    return client.post('/logs/flags/refresh', body)
}

export default {
    getFlags,
    refreshFlags
}
