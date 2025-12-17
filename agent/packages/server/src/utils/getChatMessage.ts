import { In } from 'typeorm'
import { ChatMessageRatingType, ChatType } from '../Interface'
import { ChatMessage } from '../database/entities/ChatMessage'
import { ChatMessageFeedback } from '../database/entities/ChatMessageFeedback'
import { ChatFlow } from '../database/entities/ChatFlow'
import { getDataSource } from '../DataSource'
import { getQualifiedColumnNameForQueryBuilder } from '../database/utils/oracle-query-helper'

/**
 * Method that get chat messages.
 * @param {string} chatflowid
 * @param {ChatType[]} chatTypes
 * @param {string} sortOrder
 * @param {string} chatId
 * @param {string} memoryType
 * @param {string} sessionId
 * @param {string} startDate
 * @param {string} endDate
 * @param {boolean} feedback
 * @param {ChatMessageRatingType[]} feedbackTypes
 */

interface GetChatMessageParams {
    chatflowid: string
    chatTypes?: ChatType[]
    sortOrder?: string
    chatId?: string
    memoryType?: string
    sessionId?: string
    startDate?: string
    endDate?: string
    messageId?: string
    feedback?: boolean
    feedbackTypes?: ChatMessageRatingType[]
    activeOrgId?: string
    page?: number
    pageSize?: number
}

export const utilGetChatMessage = async ({
    chatflowid,
    chatTypes,
    sortOrder = 'ASC',
    chatId,
    memoryType,
    sessionId,
    startDate,
    endDate,
    messageId,
    feedback,
    feedbackTypes,
    activeOrgId,
    page = -1,
    pageSize = -1
}: GetChatMessageParams): Promise<ChatMessage[]> => {
    if (!page) page = -1
    if (!pageSize) pageSize = -1

    if (!activeOrgId) {
        throw new Error('Organization ID is required')
    }

    const dataSource = getDataSource(parseInt(activeOrgId))

    // Verify chatflow exists in the org's database
    const chatflow = await dataSource.getRepository(ChatFlow).findOneBy({
        guid: chatflowid
    })
    if (!chatflow) {
        throw new Error('Chatflow not found')
    }

    if (feedback) {
        // Handle feedback queries with improved efficiency
        return await handleFeedbackQuery(
            {
                chatflowid,
                chatTypes,
                sortOrder,
                chatId,
                memoryType,
                sessionId,
                startDate,
                endDate,
                messageId,
                feedbackTypes,
                page,
                pageSize,
                activeOrgId
            },
            dataSource
        )
    }

    // Build where clause - remove undefined values to avoid TypeORM filtering issues
    const whereClause: any = {
        chatflowid
    }

    if (chatTypes && chatTypes.length > 0) {
        whereClause.chatType = In(chatTypes)
    }
    if (chatId) {
        whereClause.chatId = chatId
    }
    if (memoryType) {
        whereClause.memoryType = memoryType
    }
    if (sessionId) {
        whereClause.sessionId = sessionId
    }
    if (messageId) {
        whereClause.guid = messageId
    }

    // Handle date range queries with numeric timestamps
    if (startDate || endDate) {
        const dbType = (dataSource.options.type as 'postgres' | 'oracle') || 'postgres'
        const { getQualifiedColumnNameForQueryBuilder } = await import('../database/utils/oracle-query-helper')
        const queryBuilder = dataSource.getRepository(ChatMessage).createQueryBuilder('chat_message')
        const chatflowidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'chatflowid', dbType)
        queryBuilder.where(`${chatflowidCol} = :chatflowid`, { chatflowid })

        if (chatTypes && chatTypes.length > 0) {
            const chattypeCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'chattype', dbType)
            queryBuilder.andWhere(`${chattypeCol} IN (:...chatTypes)`, { chatTypes })
        }
        if (chatId) {
            const chatidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'chatid', dbType)
            queryBuilder.andWhere(`${chatidCol} = :chatId`, { chatId })
        }
        if (memoryType) {
            const memorytypeCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'memorytype', dbType)
            queryBuilder.andWhere(`${memorytypeCol} = :memoryType`, { memoryType })
        }
        if (sessionId) {
            const sessionidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'sessionid', dbType)
            queryBuilder.andWhere(`${sessionidCol} = :sessionId`, { sessionId })
        }
        if (messageId) {
            const guidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'guid', dbType)
            queryBuilder.andWhere(`${guidCol} = :messageId`, { messageId })
        }
        if (startDate && endDate) {
            const createdOnCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'created_on', dbType)
            queryBuilder.andWhere(`${createdOnCol} BETWEEN :startDate AND :endDate`, {
                startDate: new Date(startDate).getTime(),
                endDate: new Date(endDate).getTime()
            })
        } else if (startDate) {
            const createdOnCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'created_on', dbType)
            queryBuilder.andWhere(`${createdOnCol} >= :startDate`, {
                startDate: new Date(startDate).getTime()
            })
        } else if (endDate) {
            const createdOnCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'created_on', dbType)
            queryBuilder.andWhere(`${createdOnCol} <= :endDate`, {
                endDate: new Date(endDate).getTime()
            })
        }
        const createdOnCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'created_on', dbType)
        queryBuilder.orderBy(createdOnCol, sortOrder === 'DESC' ? 'DESC' : 'ASC')
        return await queryBuilder.getMany()
    }

    const messages = await dataSource.getRepository(ChatMessage).find({
        where: whereClause,
        order: {
            created_on: sortOrder === 'DESC' ? 'DESC' : 'ASC'
        }
    })

    return messages
}

async function handleFeedbackQuery(
    params: {
        chatflowid: string
        chatTypes?: ChatType[]
        sortOrder: string
        chatId?: string
        memoryType?: string
        sessionId?: string
        startDate?: string
        endDate?: string
        messageId?: string
        feedbackTypes?: ChatMessageRatingType[]
        page: number
        pageSize: number
        activeOrgId?: string
    },
    dataSource?: any
): Promise<ChatMessage[]> {
    const {
        chatflowid,
        chatTypes,
        sortOrder,
        chatId,
        memoryType,
        sessionId,
        startDate,
        endDate,
        messageId,
        feedbackTypes,
        page,
        pageSize,
        activeOrgId
    } = params

    if (!activeOrgId) {
        throw new Error('Organization ID is required')
    }

    const ds = dataSource || getDataSource(parseInt(activeOrgId))
    const dbType = (ds.options.type as 'postgres' | 'oracle') || 'postgres'

    // For specific session/message queries, no pagination needed
    if (sessionId || messageId) {
        return await getMessagesWithFeedback({ ...params, activeOrgId }, false, undefined, ds)
    }

    // For paginated queries, handle session-based pagination efficiently
    if (page > -1 && pageSize > -1) {
        const { getQualifiedColumnNameForQueryBuilder } = await import('../database/utils/oracle-query-helper')
        // First get session IDs with pagination
        const sessionQuery = ds.getRepository(ChatMessage).createQueryBuilder('chat_message')
        const sessionidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'sessionid', dbType)
        const chatflowidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'chatflowid', dbType)
        sessionQuery.select(sessionidCol, 'sessionId').where(`${chatflowidCol} = :chatflowid`, { chatflowid })

        // Filter by orgId if available
        if (params.activeOrgId) {
        }

        // Apply basic filters
        if (chatTypes && chatTypes.length > 0) {
            const chattypeCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'chattype', dbType)
            sessionQuery.andWhere(`${chattypeCol} IN (:...chatTypes)`, { chatTypes })
        }
        if (chatId) {
            const chatidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'chatid', dbType)
            sessionQuery.andWhere(`${chatidCol} = :chatId`, { chatId })
        }
        if (memoryType) {
            const memorytypeCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'memorytype', dbType)
            sessionQuery.andWhere(`${memorytypeCol} = :memoryType`, { memoryType })
        }
        if (startDate && typeof startDate === 'string') {
            const createdOnCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'created_on', dbType)
            sessionQuery.andWhere(`${createdOnCol} >= :startDateTime`, {
                startDateTime: new Date(startDate).getTime()
            })
        }
        if (endDate && typeof endDate === 'string') {
            const createdOnCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'created_on', dbType)
            sessionQuery.andWhere(`${createdOnCol} <= :endDateTime`, {
                endDateTime: new Date(endDate).getTime()
            })
        }

        // If feedback types are specified, only get sessions with those feedback types
        if (feedbackTypes && feedbackTypes.length > 0) {
            const feedbackMessageIdCol = getQualifiedColumnNameForQueryBuilder('feedback', 'messageid', dbType)
            const chatMessageGuidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'guid', dbType)
            const feedbackRatingCol = getQualifiedColumnNameForQueryBuilder('feedback', 'rating', dbType)
            sessionQuery
                .leftJoin(ChatMessageFeedback, 'feedback', `${feedbackMessageIdCol} = ${chatMessageGuidCol}`)
                .andWhere(`${feedbackRatingCol} IN (:...feedbackTypes)`, { feedbackTypes })
        }

        const startIndex = pageSize * (page - 1)
        const createdOnCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'created_on', dbType)
        const sessionidColForGroup = getQualifiedColumnNameForQueryBuilder('chat_message', 'sessionid', dbType)
        const sessionIds = await sessionQuery
            .orderBy(`MAX(${createdOnCol})`, sortOrder === 'DESC' ? 'DESC' : 'ASC')
            .groupBy(sessionidColForGroup)
            .offset(startIndex)
            .limit(pageSize)
            .getRawMany()

        if (sessionIds.length === 0) {
            return []
        }

        // Get all messages for these sessions
        const sessionIdList = sessionIds.map((s: any) => s.sessionId)
        return await getMessagesWithFeedback(
            {
                ...params,
                sessionId: undefined, // Clear specific sessionId since we're using list
                activeOrgId
            },
            true,
            sessionIdList,
            ds
        )
    }

    // No pagination - get all feedback messages
    return await getMessagesWithFeedback({ ...params, activeOrgId }, false, undefined, ds)
}

async function getMessagesWithFeedback(
    params: {
        chatflowid: string
        chatTypes?: ChatType[]
        sortOrder: string
        chatId?: string
        memoryType?: string
        sessionId?: string
        startDate?: string
        endDate?: string
        messageId?: string
        feedbackTypes?: ChatMessageRatingType[]
        activeOrgId?: string
    },
    useSessionList: boolean = false,
    sessionIdList?: string[],
    dataSource?: any
): Promise<ChatMessage[]> {
    const { chatflowid, chatTypes, sortOrder, chatId, memoryType, sessionId, startDate, endDate, messageId, feedbackTypes, activeOrgId } =
        params

    if (!activeOrgId) {
        throw new Error('Organization ID is required')
    }

    const ds = dataSource || getDataSource(parseInt(activeOrgId))
    const dbType = (ds.options.type as 'postgres' | 'oracle') || 'postgres'
    const query = ds.getRepository(ChatMessage).createQueryBuilder('chat_message')

    // Join feedback
    const feedbackMessageIdCol = getQualifiedColumnNameForQueryBuilder('feedback', 'messageid', dbType)
    const chatMessageGuidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'guid', dbType)
    const chatflowidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'chatflowid', dbType)
    query
        .leftJoinAndMapOne('chat_message.feedback', ChatMessageFeedback, 'feedback', `${feedbackMessageIdCol} = ${chatMessageGuidCol}`)
        .where(`${chatflowidCol} = :chatflowid`, { chatflowid })

    // Filter by orgId if available
    if (activeOrgId) {
    }

    // Apply filters
    if (useSessionList && sessionIdList && sessionIdList.length > 0) {
        const sessionidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'sessionid', dbType)
        query.andWhere(`${sessionidCol} IN (:...sessionIds)`, { sessionIds: sessionIdList })
    }

    if (chatTypes && chatTypes.length > 0) {
        const chattypeCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'chattype', dbType)
        query.andWhere(`${chattypeCol} IN (:...chatTypes)`, { chatTypes })
    }
    if (chatId) {
        const chatidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'chatid', dbType)
        query.andWhere(`${chatidCol} = :chatId`, { chatId })
    }
    if (memoryType) {
        const memorytypeCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'memorytype', dbType)
        query.andWhere(`${memorytypeCol} = :memoryType`, { memoryType })
    }
    if (sessionId) {
        const sessionidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'sessionid', dbType)
        query.andWhere(`${sessionidCol} = :sessionId`, { sessionId })
    }
    if (messageId) {
        const guidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'guid', dbType)
        query.andWhere(`${guidCol} = :messageId`, { messageId })
    }
    if (startDate && typeof startDate === 'string') {
        const createdOnCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'created_on', dbType)
        query.andWhere(`${createdOnCol} >= :startDateTime`, {
            startDateTime: new Date(startDate).getTime()
        })
    }
    if (endDate && typeof endDate === 'string') {
        const createdOnCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'created_on', dbType)
        query.andWhere(`${createdOnCol} <= :endDateTime`, {
            endDateTime: new Date(endDate).getTime()
        })
    }

    // Pre-filter by feedback types if specified (more efficient than post-processing)
    if (feedbackTypes && feedbackTypes.length > 0) {
        const feedbackRatingCol = getQualifiedColumnNameForQueryBuilder('feedback', 'rating', dbType)
        query.andWhere(`(${feedbackRatingCol} IN (:...feedbackTypes) OR ${feedbackRatingCol} IS NULL)`, { feedbackTypes })
    }

    const createdOnCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'created_on', dbType)
    query.orderBy(createdOnCol, sortOrder === 'DESC' ? 'DESC' : 'ASC')

    const messages = (await query.getMany()) as Array<ChatMessage & { feedback: ChatMessageFeedback }>

    // Apply feedback type filtering with previous message inclusion
    if (feedbackTypes && feedbackTypes.length > 0) {
        return filterMessagesWithFeedback(messages, feedbackTypes)
    }

    return messages
}

function filterMessagesWithFeedback(
    messages: Array<ChatMessage & { feedback: ChatMessageFeedback }>,
    feedbackTypes: ChatMessageRatingType[]
): ChatMessage[] {
    // Group messages by session for proper filtering
    const sessionGroups = new Map<string, Array<ChatMessage & { feedback: ChatMessageFeedback }>>()

    messages.forEach((message) => {
        const sessionId = message.sessionId
        if (!sessionId) return // Skip messages without sessionId

        if (!sessionGroups.has(sessionId)) {
            sessionGroups.set(sessionId, [])
        }
        sessionGroups.get(sessionId)!.push(message)
    })

    const result: ChatMessage[] = []

    // Process each session group
    sessionGroups.forEach((sessionMessages) => {
        // Sort by creation date to ensure proper order
        sessionMessages.sort((a, b) => (a.created_on || 0) - (b.created_on || 0))

        const toInclude = new Set<number>()

        sessionMessages.forEach((message, index) => {
            if (message.role === 'apiMessage' && message.feedback && feedbackTypes.includes(message.feedback.rating)) {
                // Include the feedback message
                toInclude.add(index)
                // Include the previous message (user message) if it exists
                if (index > 0) {
                    toInclude.add(index - 1)
                }
            }
        })

        // Add filtered messages to result
        sessionMessages.forEach((message, index) => {
            if (toInclude.has(index)) {
                result.push(message)
            }
        })
    })

    // Sort final result by creation date
    return result.sort((a, b) => (a.created_on || 0) - (b.created_on || 0))
}
