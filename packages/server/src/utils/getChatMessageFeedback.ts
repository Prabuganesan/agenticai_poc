import { ChatMessageFeedback } from '../database/entities/ChatMessageFeedback'
import { getDataSource } from '../DataSource'

/**
 * Method that get chat messages.
 * @param {string} chatflowid
 * @param {string} orgId - Organization ID (required)
 * @param {string} sortOrder
 * @param {string} chatId
 * @param {string} startDate
 * @param {string} endDate
 */
export const utilGetChatMessageFeedback = async (
    chatflowid: string,
    orgId: string,
    chatId?: string,
    sortOrder: string = 'ASC',
    startDate?: string,
    endDate?: string
): Promise<ChatMessageFeedback[]> => {
    if (!orgId) {
        throw new Error('Organization ID is required')
    }

    const dataSource = getDataSource(parseInt(orgId))
    let fromDate
    if (startDate) fromDate = new Date(startDate)

    let toDate
    if (endDate) toDate = new Date(endDate)
    // Build where clause with numeric timestamp support
    const whereClause: any = {
        chatflowid,
        chatId
    }

    // Handle date range queries with numeric timestamps
    if (toDate && fromDate) {
        const queryBuilder = dataSource
            .getRepository(ChatMessageFeedback)
            .createQueryBuilder('feedback')
            .where('feedback.chatflowid = :chatflowid', { chatflowid })
            .andWhere('feedback.chatid = :chatId', { chatId })
            .andWhere('feedback.created_on BETWEEN :fromDate AND :toDate', {
                fromDate: fromDate.getTime(),
                toDate: toDate.getTime()
            })
            .orderBy('feedback.created_on', sortOrder === 'DESC' ? 'DESC' : 'ASC')
        return await queryBuilder.getMany()
    }

    return await dataSource.getRepository(ChatMessageFeedback).find({
        where: whereClause,
        order: {
            created_on: sortOrder === 'DESC' ? 'DESC' : 'ASC'
        }
    })
}
