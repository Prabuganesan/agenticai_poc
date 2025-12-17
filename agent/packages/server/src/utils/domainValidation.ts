import { ChatFlow } from '../database/entities/ChatFlow'
import { logWarn, logError } from './logger/system-helper'
import { getDataSource } from '../DataSource'

/**
 * Validates if the origin is allowed for a specific chatflow
 * @param chatflowId - The chatflow ID to validate against
 * @param origin - The origin URL to validate
 * @param orgId - Organization ID (required)
 * @returns Promise<boolean> - True if domain is allowed, false otherwise
 */
async function validateChatflowDomain(chatflowId: string, origin: string, orgId: string): Promise<boolean> {
    try {
        // Validate GUID format (15 characters) instead of UUID
        if (!chatflowId || typeof chatflowId !== 'string' || chatflowId.length !== 15) {
            throw new Error('Invalid chatflowId format - must be a valid 15-character GUID')
        }

        if (!orgId) {
            logWarn(`Domain validation failed: orgId is required for chatflow ${chatflowId}`).catch(() => {})
            return false
        }

        // Get chatflow from org-specific database
        const dataSource = getDataSource(parseInt(orgId))
        const chatflow = await dataSource.getRepository(ChatFlow).findOneBy({
            guid: chatflowId
        })

        if (!chatflow?.chatbotConfig) {
            return true
        }

        const config = JSON.parse(chatflow.chatbotConfig)

        // If no allowed origins configured or first entry is empty, allow all
        if (!config.allowedOrigins?.length || config.allowedOrigins[0] === '') {
            return true
        }

        const originHost = new URL(origin).host
        const isAllowed = config.allowedOrigins.some((domain: string) => {
            try {
                const allowedOrigin = new URL(domain).host
                return originHost === allowedOrigin
            } catch (error) {
                logWarn(`Invalid domain format in allowedOrigins: ${domain}`).catch(() => {})
                return false
            }
        })

        return isAllowed
    } catch (error) {
        logError(
            `Error validating domain for chatflow ${chatflowId}: ${error instanceof Error ? error.message : String(error)}`,
            error
        ).catch(() => {})
        return false
    }
}

// NOTE: This function extracts the chatflow ID from a prediction URL.
// It assumes the URL format is /prediction/{chatflowId}.
/**
 * Extracts chatflow ID from prediction URL
 * @param url - The request URL
 * @returns string | null - The chatflow ID or null if not found
 */
function extractChatflowId(url: string): string | null {
    try {
        const urlParts = url.split('/')
        const predictionIndex = urlParts.indexOf('prediction')

        if (predictionIndex !== -1 && urlParts.length > predictionIndex + 1) {
            const chatflowId = urlParts[predictionIndex + 1]
            // Remove query parameters if present
            return chatflowId.split('?')[0]
        }

        return null
    } catch (error) {
        logError(`Error extracting chatflow ID from URL: ${error instanceof Error ? error.message : String(error)}`, error).catch(() => {})
        return null
    }
}

/**
 * Validates if a request is a prediction request
 * @param url - The request URL
 * @returns boolean - True if it's a prediction request
 */
function isPredictionRequest(url: string): boolean {
    return url.includes('/prediction/')
}

/**
 * Get the custom error message for unauthorized origin
 * @param chatflowId - The chatflow ID
 * @param orgId - Organization ID (required)
 * @returns Promise<string> - Custom error message or default
 */
async function getUnauthorizedOriginError(chatflowId: string, orgId: string): Promise<string> {
    try {
        if (!orgId) {
            return 'This site is not allowed to access this chatbot'
        }

        // Get chatflow from org-specific database
        const { getDataSource } = await import('../DataSource')
        const dataSource = getDataSource(parseInt(orgId))
        const chatflow = await dataSource.getRepository(ChatFlow).findOneBy({
            guid: chatflowId
        })

        if (chatflow?.chatbotConfig) {
            const config = JSON.parse(chatflow.chatbotConfig)
            return config.allowedOriginsError || 'This site is not allowed to access this chatbot'
        }

        return 'This site is not allowed to access this chatbot'
    } catch (error) {
        logError(
            `Error getting unauthorized origin error for chatflow ${chatflowId}: ${error instanceof Error ? error.message : String(error)}`,
            error
        ).catch(() => {})
        return 'This site is not allowed to access this chatbot'
    }
}

export { isPredictionRequest, extractChatflowId, validateChatflowDomain, getUnauthorizedOriginError }
