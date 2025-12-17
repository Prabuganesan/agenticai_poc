import { Request } from 'express'
import { ChatFlow } from '../database/entities/ChatFlow'
import { ApiKey } from '../database/entities/ApiKey'
import { compareKeys } from './apiKey'
import apikeyService from '../services/apikey'

/**
 * Validate flow API Key, this is needed because Prediction/Upsert API is public
 * @param {Request} req
 * @param {ChatFlow} chatflow
 * @param {string} orgId - Organization ID (required)
 */
export const validateFlowAPIKey = async (req: Request, chatflow: ChatFlow, orgId: string): Promise<boolean> => {
    const chatFlowApiKeyId = chatflow?.apikeyid
    if (!chatFlowApiKeyId) return true

    const authorizationHeader = (req.headers['Authorization'] as string) ?? (req.headers['authorization'] as string) ?? ''
    if (chatFlowApiKeyId && !authorizationHeader) return false

    const suppliedKey = authorizationHeader.split(`Bearer `).pop()
    if (!suppliedKey) return false

    try {
        // Require orgId upfront - no cross-org search
        if (!orgId) {
            return false
        }

        const { getDataSource } = await import('../DataSource')
        const dataSource = getDataSource(parseInt(orgId))
        const apiKey = await dataSource.getRepository(ApiKey).findOneBy({
            guid: chatFlowApiKeyId
        })

        if (!apiKey) return false

        const apiSecret = apiKey.apiSecret
        if (!apiSecret || !compareKeys(apiSecret, suppliedKey)) return false

        return true
    } catch (error) {
        return false
    }
}

/**
 * Validate and Get API Key Information
 * Requires orgId to ensure API key belongs to the specified organization
 * @param {Request} req
 * @param {string} orgId - Organization ID from request (required for external access)
 * @returns {Promise<{isValid: boolean, apiKey?: ApiKey, orgId?: string}>}
 */
export const validateAPIKey = async (req: Request, orgId: string): Promise<{ isValid: boolean; apiKey?: ApiKey; orgId?: string }> => {
    const authorizationHeader = (req.headers['Authorization'] as string) ?? (req.headers['authorization'] as string) ?? ''
    if (!authorizationHeader) return { isValid: false }

    const suppliedKey = authorizationHeader.split(`Bearer `).pop()
    if (!suppliedKey) return { isValid: false }

    if (!orgId) {
        return { isValid: false }
    }

    try {
        // Query API key to ensure it belongs to the specified organization
        const apiKey = await apikeyService.getApiKey(suppliedKey, orgId)
        if (!apiKey) return { isValid: false }

        const apiSecret = apiKey.apiSecret
        if (!apiSecret || !compareKeys(apiSecret, suppliedKey)) {
            return { isValid: false, apiKey, orgId }
        }

        return { isValid: true, apiKey, orgId }
    } catch (error) {
        return { isValid: false }
    }
}
