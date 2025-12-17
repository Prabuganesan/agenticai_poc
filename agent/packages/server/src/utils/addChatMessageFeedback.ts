import { ChatMessageFeedback } from '../database/entities/ChatMessageFeedback'
import { IChatMessageFeedback } from '../Interface'
import { getDataSource } from '../DataSource'
import { generateGuid } from './guidGenerator'

/**
 * Helper function to safely convert values to numbers for Oracle compatibility
 */
const safeToNumber = (value: any, defaultValue: number): number => {
    if (value === null || value === undefined) return defaultValue
    const num = typeof value === 'string' ? parseFloat(value) : Number(value)
    return isNaN(num) || !isFinite(num) ? defaultValue : num
}

/**
 * Method that add chat message feedback.
 * @param {Partial<IChatMessageFeedback>} chatMessageFeedback
 * @param {string} orgId - Organization ID (required)
 */

export const utilAddChatMessageFeedback = async (
    chatMessageFeedback: Partial<IChatMessageFeedback>,
    orgId: string,
    userId?: string | number
): Promise<ChatMessageFeedback> => {
    if (!orgId) {
        throw new Error('Organization ID is required')
    }

    const dataSource = getDataSource(parseInt(orgId))
    const newChatMessageFeedback = new ChatMessageFeedback()
    Object.assign(newChatMessageFeedback, chatMessageFeedback)
    
    // Generate GUID if not provided
    if (!newChatMessageFeedback.guid) {
        newChatMessageFeedback.guid = generateGuid()
    }
    
    // Set created_by - use userId from request if available, otherwise use provided value or default to 0
    if (userId !== undefined) {
        // Use userId from authenticated request (preferred)
        newChatMessageFeedback.created_by = safeToNumber(userId, 0)
    } else if (chatMessageFeedback.created_by !== undefined) {
        // Use provided created_by value
        newChatMessageFeedback.created_by = safeToNumber(chatMessageFeedback.created_by, 0)
    } else if (!newChatMessageFeedback.created_by) {
        // Default to 0 (system user) if nothing provided
        newChatMessageFeedback.created_by = 0
    } else {
        // Ensure created_by is a number
        newChatMessageFeedback.created_by = safeToNumber(newChatMessageFeedback.created_by, 0)
    }
    
    // Set created_on if not provided
    if (chatMessageFeedback.created_on !== undefined) {
        // Ensure created_on is a number, not a string (might come as string from JSON)
        newChatMessageFeedback.created_on = safeToNumber(chatMessageFeedback.created_on, Date.now())
    } else if (!newChatMessageFeedback.created_on) {
        newChatMessageFeedback.created_on = Date.now()
    } else {
        // Ensure created_on is a number
        newChatMessageFeedback.created_on = safeToNumber(newChatMessageFeedback.created_on, Date.now())
    }
    
    const feedback = await dataSource.getRepository(ChatMessageFeedback).create(newChatMessageFeedback)
    return await dataSource.getRepository(ChatMessageFeedback).save(feedback)
}
