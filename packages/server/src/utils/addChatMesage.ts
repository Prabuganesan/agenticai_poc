import { DataSource } from 'typeorm'
import { ChatMessage } from '../database/entities/ChatMessage'
import { IChatMessage } from '../Interface'
import { getDataSource } from '../DataSource'
import { generateGuid } from './guidGenerator'

/**
 * Helper function to safely convert to number for Oracle
 * Oracle is strict about number types and will throw ORA-01722 if strings are passed
 */
const safeToNumber = (value: any, defaultValue: number = 0): number => {
    if (value == null || value === '' || value === 'undefined' || value === 'null') {
        return defaultValue
    }
    if (typeof value === 'number') {
        return isNaN(value) || !isFinite(value) ? defaultValue : value
    }
    if (typeof value === 'string') {
        // Remove any whitespace
        const trimmed = value.trim()
        if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') {
            return defaultValue
        }
        const num = Number(trimmed)
        return isNaN(num) || !isFinite(num) ? defaultValue : num
    }
    const num = Number(value)
    return isNaN(num) || !isFinite(num) ? defaultValue : num
}

/**
 * Method that add chat messages.
 * @param {Partial<IChatMessage>} chatMessage
 * @param {DataSource} appDataSource - Optional DataSource, if not provided will use orgId to get one
 * @param {string} orgId - Required organization ID
 * @param {number} userId - Optional user ID for created_by. If not provided, uses 0 (system user) for tool requests
 */
export const utilAddChatMessage = async (
    chatMessage: Partial<IChatMessage>,
    appDataSource: DataSource | undefined,
    orgId: string,
    userId?: number
): Promise<ChatMessage> => {
    if (!orgId) {
        throw new Error('orgId is required for utilAddChatMessage')
    }
    const dataSource = appDataSource ?? getDataSource(parseInt(orgId))
    const newChatMessage = new ChatMessage()
    Object.assign(newChatMessage, chatMessage)
    
    // Generate GUID if not provided
    if (!newChatMessage.guid) {
        newChatMessage.guid = generateGuid()
    }
    
    // Set created_by and created_on
    // For tool requests (kodivian-tool), userId may be undefined - use 0 (system user)
    // For authenticated requests, userId should be provided
    // Ensure numeric values are properly converted for Oracle compatibility
    // Oracle is strict about number types and will throw ORA-01722 if strings are passed
    if (userId !== undefined) {
        newChatMessage.created_by = safeToNumber(userId, 0)
    } else if (chatMessage.created_by !== undefined) {
        // If chatMessage has created_by, ensure it's a number (might be a string)
        newChatMessage.created_by = safeToNumber(chatMessage.created_by, 0)
    } else {
        // Use system user (0) for tool requests or unauthenticated requests
        newChatMessage.created_by = 0
    }
    
    if (chatMessage.created_on !== undefined) {
        // Ensure created_on is a number, not a string (might come as string from JSON)
        newChatMessage.created_on = safeToNumber(chatMessage.created_on, Date.now())
    } else if (!newChatMessage.created_on) {
        newChatMessage.created_on = Date.now()
    } else {
        // Ensure created_on is a number, not a string
        newChatMessage.created_on = safeToNumber(newChatMessage.created_on, Date.now())
    }
    const chatmessage = await dataSource.getRepository(ChatMessage).create(newChatMessage)
    const dbResponse = await dataSource.getRepository(ChatMessage).save(chatmessage)
    return dbResponse
}
