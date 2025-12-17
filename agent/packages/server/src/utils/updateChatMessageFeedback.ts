import { IChatMessageFeedback } from '../Interface'
import { ChatMessageFeedback } from '../database/entities/ChatMessageFeedback'
import { ChatFlow } from '../database/entities/ChatFlow'
import { getDataSource } from '../DataSource'
import lunary from 'lunary'

/**
 * Method that updates chat message feedback.
 * @param {string} id
 * @param {string} orgId - Organization ID (required)
 * @param {Partial<IChatMessageFeedback>} chatMessageFeedback
 */
export const utilUpdateChatMessageFeedback = async (guid: string, orgId: string, chatMessageFeedback: Partial<IChatMessageFeedback>) => {
    if (!orgId) {
        throw new Error('Organization ID is required')
    }

    const dataSource = getDataSource(parseInt(orgId))
    
    // Filter out properties that don't exist on the ChatMessageFeedback entity
    // Only allow updating: rating, content, messageId, chatId, chatflowid
    // Exclude orgId and any other non-entity properties
    const updateData: any = {}
    
    if (chatMessageFeedback.rating !== undefined) {
        updateData.rating = chatMessageFeedback.rating
    }
    if (chatMessageFeedback.content !== undefined) {
        updateData.content = chatMessageFeedback.content
    }
    if (chatMessageFeedback.messageId !== undefined) {
        updateData.messageId = chatMessageFeedback.messageId
    }
    if (chatMessageFeedback.chatId !== undefined) {
        updateData.chatId = chatMessageFeedback.chatId
    }
    if (chatMessageFeedback.chatflowid !== undefined) {
        updateData.chatflowid = chatMessageFeedback.chatflowid
    }

    await dataSource.getRepository(ChatMessageFeedback).update({ guid }, updateData)

    // Fetch the updated entity
    const updatedFeedback = await dataSource.getRepository(ChatMessageFeedback).findOne({ where: { guid } })

    const chatflow = await dataSource.getRepository(ChatFlow).findOne({ where: { guid: updatedFeedback?.chatflowid } })
    const analytic = JSON.parse(chatflow?.analytic ?? '{}')

    if (analytic?.lunary?.status === true && updatedFeedback?.rating) {
        lunary.trackFeedback(updatedFeedback.messageId, {
            comment: updatedFeedback?.content,
            thumb: updatedFeedback?.rating === 'THUMBS_UP' ? 'up' : 'down'
        })
    }

    return { status: 'OK' }
}
