import { StatusCodes } from 'http-status-codes'
import { v4 as uuidv4 } from 'uuid'
import { ChatSession } from '../../database/entities/ChatSession'
import { ChatMessage } from '../../database/entities/ChatMessage'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { getErrorMessage } from '../../errors/utils'
import { IChatSession } from '../../Interface'
import { getDataSource } from '../../DataSource'
import { generateGuid } from '../../utils/guidGenerator'
import { getQualifiedColumnNameForQueryBuilder } from '../../database/utils/oracle-query-helper'

// Create a new chat session
const createChatSession = async (chatflowId: string, orgId: string, userId: string, title?: string): Promise<ChatSession> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const repository = dataSource.getRepository(ChatSession)

        const chatId = uuidv4()
        const userIdNum = parseInt(userId)
        const newSession = repository.create({
            guid: generateGuid(),
            chatflowId,
            chatId,
            title: title || 'New Chat',
            created_by: userIdNum,
            created_on: Date.now(),
            messageCount: 0,
            preview: undefined
        })

        const savedSession = await repository.save(newSession)

        // Log session creation
        try {
            const { sessionLog } = await import('../../utils/logger/module-methods')
            await sessionLog('info', 'Chat session created', {
                userId: userIdNum.toString(),
                orgId,
                chatId: savedSession.chatId,
                chatflowId,
                sessionId: savedSession.guid,
                title: savedSession.title || 'New Chat'
            }).catch(() => {}) // Don't fail if logging fails
        } catch (logError) {
            // Silently fail - logging should not break session creation
        }

        return savedSession
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatSessionsService.createChatSession - ${getErrorMessage(error)}`
        )
    }
}

// Get all chat sessions for a chatflow (filtered by userId and orgId)
const getAllChatSessions = async (
    chatflowId: string,
    orgId: string,
    userId: string,
    page: number = 1,
    limit: number = 50
): Promise<{ sessions: ChatSession[]; total: number }> => {
    try {
        // Handle default pagination if -1 is passed
        if (page < 1) page = 1
        if (limit < 1) limit = 50

        const dataSource = getDataSource(parseInt(orgId))
        const repository = dataSource.getRepository(ChatSession)
        const chatMessageRepository = dataSource.getRepository(ChatMessage)

        // Get database type for Oracle compatibility
        const dbType = (dataSource.options.type as 'postgres' | 'oracle') || 'postgres'

        // Get properly formatted column names for Oracle (uppercase) or PostgreSQL (lowercase)
        const chatidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'chatid', dbType)
        const createdOnCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'created_on', dbType)
        const chatflowidCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'chatflowid', dbType)
        const createdByCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'created_by', dbType)
        const roleCol = getQualifiedColumnNameForQueryBuilder('chat_message', 'role', dbType)

        // First, find all unique chatIds from messages for this chatflow and orgId
        // This ensures we don't miss any chats that have messages but no session entry
        const messagesWithChatIds = await chatMessageRepository
            .createQueryBuilder('chat_message')
            .select(`DISTINCT ${chatidCol}`, 'chatId')
            .addSelect(`MAX(${createdOnCol})`, 'lastMessageDate')
            .where(`${chatflowidCol} = :chatflowId`, { chatflowId })
            .groupBy(chatidCol)
            .getRawMany()

        // Ensure sessions exist for all chatIds that have messages
        for (const msg of messagesWithChatIds) {
            if (msg.chatId) {
                try {
                    // Check if session exists with current userId
                    const userIdNum = parseInt(userId)
                    let session = await repository.findOne({
                        where: {
                            chatId: msg.chatId,
                            created_by: userIdNum
                        }
                    })

                    if (!session) {
                        // Check if session exists with any userId (might have been created with different user)
                        const existingSession = await repository.findOne({
                            where: {
                                chatId: msg.chatId,
                                chatflowId
                            }
                        })

                        // IMPORTANT: If a session exists for another user with this chatId, we cannot create
                        // a duplicate session with the same chatId (violates UNIQUE constraint).
                        // Each user must have their own separate chatId to ensure user isolation.
                        // Skip creating a session if chatId belongs to another user.
                        if (existingSession && existingSession.created_by !== userIdNum) {
                            // ChatId belongs to another user - skip creating session for this user
                            // This ensures user isolation: each user has their own separate chat history
                            continue
                        }

                        // Check if any messages with this chatId belong to the current user
                        // Only create session if current user has messages in this chat
                        const userMessageCount = await chatMessageRepository
                            .createQueryBuilder('chat_message')
                            .where(`${chatidCol} = :chatId`, { chatId: msg.chatId })
                            .andWhere(`${chatflowidCol} = :chatflowId`, { chatflowId })
                            .andWhere(`${createdByCol} = :userId`, { userId: userIdNum })
                            .getCount()

                        // Only create session if current user has messages in this chat
                        if (userMessageCount === 0) {
                            continue
                        }

                        // Get the first user message (from current user) to set as title
                        const firstUserMessage = await chatMessageRepository
                            .createQueryBuilder('chat_message')
                            .where(`${chatidCol} = :chatId`, { chatId: msg.chatId })
                            .andWhere(`${roleCol} = :role`, { role: 'userMessage' })
                            .andWhere(`${createdByCol} = :userId`, { userId: userIdNum })
                            .orderBy(createdOnCol, 'ASC')
                            .getOne()

                        const title = firstUserMessage?.content?.substring(0, 50) || existingSession?.title || 'New Chat'
                        const preview = firstUserMessage?.content?.substring(0, 100) || existingSession?.preview || undefined

                        // Count messages for this chatId that belong to current user
                        const messageCount = await chatMessageRepository
                            .createQueryBuilder('chat_message')
                            .where(`${chatidCol} = :chatId`, { chatId: msg.chatId })
                            .andWhere(`${chatflowidCol} = :chatflowId`, { chatflowId })
                            .andWhere(`${createdByCol} = :userId`, { userId: userIdNum })
                            .getCount()

                        // Get the latest message date (from current user) to set as created_on
                        const lastMessage = await chatMessageRepository
                            .createQueryBuilder('chat_message')
                            .where(`${chatidCol} = :chatId`, { chatId: msg.chatId })
                            .andWhere(`${chatflowidCol} = :chatflowId`, { chatflowId })
                            .andWhere(`${createdByCol} = :userId`, { userId: userIdNum })
                            .orderBy(createdOnCol, 'DESC')
                            .getOne()

                        // Create session with the chatId (only if it doesn't belong to another user)
                        try {
                            session = repository.create({
                                guid: generateGuid(),
                                chatflowId,
                                chatId: msg.chatId,
                                title,
                                created_by: userIdNum,
                                created_on: lastMessage?.created_on || Date.now(),
                                messageCount,
                                preview
                            })
                            session = await repository.save(session)
                        } catch (saveError: any) {
                            // Handle race condition: if another request created the session between our check and save
                            if (
                                saveError?.code === '23505' ||
                                saveError?.message?.includes('duplicate key') ||
                                saveError?.message?.includes('UNIQUE constraint')
                            ) {
                                // Session was created by another request/user - skip it
                                // This ensures user isolation
                                continue
                            }
                            // Re-throw if it's not a duplicate key error
                            throw saveError
                        }
                    }
                } catch (error) {
                    // Log but continue - don't fail the entire request if one session creation fails
                    // Use new logging system - throw error if logging fails
                    const { sessionLog } = await import('../../utils/logger/module-methods')
                    const userId = msg.userId || 'anonymous'
                    const orgId = msg.orgId
                    await sessionLog(
                        'error',
                        `Failed to ensure session exists for chatId ${msg.chatId}: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                        {
                            userId,
                            orgId,
                            chatId: msg.chatId,
                            error: error instanceof Error ? error.stack : String(error)
                        }
                    ).catch((logError) => {
                        // Throw error if new logging system fails - no fallback
                        throw new Error(
                            `Failed to log session error: ${
                                logError instanceof Error ? logError.message : String(logError)
                            }. Original error: ${error instanceof Error ? error.message : String(error)}`
                        )
                    })
                }
            }
        }

        // Clean up sessions that have no messages
        // Get all sessions for this chatflow/userId
        const userIdNum = parseInt(userId)
        const allSessions = await repository.find({
            where: {
                chatflowId,
                created_by: userIdNum
            }
        })

        // Check each session to see if it has any messages
        const sessionsToDelete: ChatSession[] = []
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

        for (const session of allSessions) {
            const messageCount = await chatMessageRepository
                .createQueryBuilder('chat_message')
                .where(`${chatidCol} = :chatId`, { chatId: session.chatId })
                .andWhere(`${chatflowidCol} = :chatflowId`, { chatflowId })
                .getCount()

            // If no messages exist for this session, mark it for deletion
            // BUT only if it's older than 1 hour (to avoid deleting newly created empty sessions)
            // created_on is numeric timestamp, convert safely
            if (messageCount === 0 && session.created_on) {
                try {
                    const sessionCreatedDate = new Date(session.created_on)
                    if (!isNaN(sessionCreatedDate.getTime()) && sessionCreatedDate < oneHourAgo) {
                        sessionsToDelete.push(session)
                    }
                } catch (error) {
                    // Skip if date conversion fails
                }
            }
        }

        // Delete sessions with no messages
        if (sessionsToDelete.length > 0) {
            await repository.remove(sessionsToDelete)
        }

        const skip = (page - 1) * limit

        const [sessions, total] = await repository.findAndCount({
            where: {
                chatflowId,
                created_by: userIdNum
            },
            order: {
                created_on: 'DESC'
            },
            skip,
            take: limit
        })

        return { sessions, total }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatSessionsService.getAllChatSessions - ${getErrorMessage(error)}`
        )
    }
}

// Get a chat session by chatId (with userId and orgId validation)
const getChatSessionById = async (chatId: string, orgId: string, userId: string): Promise<ChatSession | null> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const repository = dataSource.getRepository(ChatSession)

        const userIdNum = parseInt(userId)
        const session = await repository.findOne({
            where: {
                chatId,
                created_by: userIdNum
            }
        })

        return session
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatSessionsService.getChatSessionById - ${getErrorMessage(error)}`
        )
    }
}

// Update a chat session (title, preview, messageCount)
const updateChatSession = async (
    chatId: string,
    orgId: string,
    userId: string,
    updates: Partial<Pick<IChatSession, 'title' | 'preview' | 'messageCount'>>
): Promise<ChatSession> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const repository = dataSource.getRepository(ChatSession)

        const userIdNum = parseInt(userId)
        const session = await repository.findOne({
            where: {
                chatId,
                created_by: userIdNum
            }
        })

        if (!session) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                `Error: chatSessionsService.updateChatSession - Chat session not found`
            )
        }

        Object.assign(session, updates)
        const updatedSession = await repository.save(session)

        return updatedSession
    } catch (error) {
        if (error instanceof InternalAutonomousError) {
            throw error
        }
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatSessionsService.updateChatSession - ${getErrorMessage(error)}`
        )
    }
}

// Delete a chat session
const deleteChatSession = async (chatId: string, orgId: string, userId: string): Promise<void> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const repository = dataSource.getRepository(ChatSession)

        const userIdNum = parseInt(userId)
        const session = await repository.findOne({
            where: {
                chatId,
                created_by: userIdNum
            }
        })

        if (!session) {
            throw new InternalAutonomousError(
                StatusCodes.NOT_FOUND,
                `Error: chatSessionsService.deleteChatSession - Chat session not found`
            )
        }

        // First, delete all messages associated with this chat session
        // This also deletes feedback records and uploaded files
        const chatMessagesService = await import('../chat-messages')
        const { default: chatMessagesServiceDefault } = chatMessagesService
        const { UsageCacheManager } = await import('../../UsageCacheManager')
        const usageCacheManager = await UsageCacheManager.getInstance()

        await chatMessagesServiceDefault.removeAllChatMessages(
            chatId,
            session.chatflowId,
            { chatId }, // Delete all messages with this chatId
            orgId,
            usageCacheManager
        )

        // Then delete the session itself
        await repository.remove(session)
    } catch (error) {
        if (error instanceof InternalAutonomousError) {
            throw error
        }
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatSessionsService.deleteChatSession - ${getErrorMessage(error)}`
        )
    }
}

// Ensure a chat session exists (create if not exists, for backward compatibility)
// IMPORTANT: Each user must have their own separate session. If a chatId belongs to another user,
// we generate a new chatId to ensure user isolation and privacy.
const ensureChatSessionExists = async (chatId: string, chatflowId: string, orgId: string, userId: string): Promise<ChatSession> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const repository = dataSource.getRepository(ChatSession)

        const userIdNum = parseInt(userId)

        // First, check if a session exists with this chatId AND created_by (current user)
        // This ensures each user has their own separate session
        let session = await repository.findOne({
            where: {
                chatId,
                created_by: userIdNum
            }
        })

        if (session) {
            // Session exists for this user - return it
            return session
        }

        // Check if a session with this chatId exists but belongs to a different user
        const existingSessionForOtherUser = await repository.findOne({
            where: {
                chatId
            }
        })

        // If chatId belongs to another user, generate a new unique chatId for this user
        // This ensures user isolation - each user gets their own session
        let finalChatId = chatId
        if (existingSessionForOtherUser && existingSessionForOtherUser.created_by !== userIdNum) {
            // Generate a new chatId to ensure this user has their own separate session
            finalChatId = uuidv4()
        }

        // Create a new session with the final chatId (either original or newly generated)
        try {
            session = repository.create({
                guid: generateGuid(),
                chatflowId,
                chatId: finalChatId,
                title: 'New Chat',
                created_by: userIdNum,
                created_on: Date.now(),
                messageCount: 0,
                preview: undefined
            })
            session = await repository.save(session)
            return session
        } catch (saveError: any) {
            // Handle race condition: if another request created the session between our check and save
            if (
                saveError?.code === '23505' ||
                saveError?.message?.includes('duplicate key') ||
                saveError?.message?.includes('UNIQUE constraint')
            ) {
                // Session was created by another request - fetch it for this user
                session = await repository.findOne({
                    where: {
                        chatId: finalChatId,
                        created_by: userIdNum
                    }
                })
                if (session) {
                    return session
                }
                // If still not found, try with a new chatId (retry once)
                if (finalChatId === chatId) {
                    finalChatId = uuidv4()
                    session = repository.create({
                        guid: generateGuid(),
                        chatflowId,
                        chatId: finalChatId,
                        title: 'New Chat',
                        created_by: userIdNum,
                        created_on: Date.now(),
                        messageCount: 0,
                        preview: undefined
                    })
                    session = await repository.save(session)
                    return session
                }
            }
            // Re-throw if it's not a duplicate key error
            throw saveError
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatSessionsService.ensureChatSessionExists - ${getErrorMessage(error)}`
        )
    }
}

// Update chat session when a new message is added
const updateChatSessionOnMessage = async (
    chatflowId: string,
    chatId: string,
    orgId: string,
    userId: string,
    messageContent: string,
    messageType: 'user' | 'api'
): Promise<void> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const repository = dataSource.getRepository(ChatSession)

        // Find session with exact match (chatId AND created_by) to ensure user isolation
        // IMPORTANT: We only look for sessions belonging to the current user to prevent
        // users from accessing each other's chat history
        const userIdNum = parseInt(userId)
        let session = await repository.findOne({
            where: {
                chatId,
                created_by: userIdNum
            }
        })

        // If still not found, create a new session
        // IMPORTANT: Check if chatId belongs to another user first to ensure user isolation
        if (!session) {
            const userIdNum = parseInt(userId)

            // Check if a session with this chatId exists but belongs to a different user
            const existingSessionForOtherUser = await repository.findOne({
                where: {
                    chatId
                }
            })

            // If chatId belongs to another user, generate a new unique chatId for this user
            // This ensures user isolation - each user gets their own session
            let finalChatId = chatId
            if (existingSessionForOtherUser && existingSessionForOtherUser.created_by !== userIdNum) {
                // Generate a new chatId to ensure this user has their own separate session
                finalChatId = uuidv4()
            }

            try {
                session = repository.create({
                    guid: generateGuid(),
                    chatflowId,
                    chatId: finalChatId,
                    title: 'New Chat',
                    created_by: userIdNum,
                    created_on: Date.now(),
                    messageCount: 0,
                    preview: undefined
                })
                session = await repository.save(session)
            } catch (saveError: any) {
                // Handle race condition: if another request created the session between our check and save
                if (
                    saveError?.code === '23505' ||
                    saveError?.message?.includes('duplicate key') ||
                    saveError?.message?.includes('UNIQUE constraint')
                ) {
                    // Session was created by another request - fetch it for this user
                    session = await repository.findOne({
                        where: {
                            chatId: finalChatId,
                            created_by: userIdNum
                        }
                    })
                    if (!session) {
                        // If still not found, try with a new chatId (retry once)
                        if (finalChatId === chatId) {
                            finalChatId = uuidv4()
                            session = repository.create({
                                guid: generateGuid(),
                                chatflowId,
                                chatId: finalChatId,
                                title: 'New Chat',
                                created_by: userIdNum,
                                created_on: Date.now(),
                                messageCount: 0,
                                preview: undefined
                            })
                            session = await repository.save(session)
                        } else {
                            throw new InternalAutonomousError(
                                StatusCodes.INTERNAL_SERVER_ERROR,
                                `Error: chatSessionsService.updateChatSessionOnMessage - Session with chatId ${finalChatId} should exist but was not found after duplicate key error`
                            )
                        }
                    }
                } else {
                    // Re-throw if it's not a duplicate key error
                    throw saveError
                }
            }
        }

        // Update message count
        session.messageCount = (session.messageCount || 0) + 1

        // Update preview (first 100 chars of first user message)
        if (messageType === 'user' && !session.preview) {
            session.preview = messageContent.substring(0, 100)
        }

        // Auto-generate title from first user message if not set
        if (messageType === 'user' && (!session.title || session.title === 'New Chat')) {
            const titleText = messageContent.trim().substring(0, 50)
            if (titleText) {
                session.title = titleText
            }
        }

        await repository.save(session)

        // Log session update
        try {
            const { sessionLog } = await import('../../utils/logger/module-methods')
            await sessionLog('info', 'Chat session updated', {
                userId,
                orgId,
                chatId: session.chatId,
                chatflowId,
                sessionId: session.guid,
                messageType,
                messageCount: session.messageCount,
                messageLength: messageContent.length
            }).catch(() => {}) // Don't fail if logging fails
        } catch (logError) {
            // Silently fail - logging should not break session update
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatSessionsService.updateChatSessionOnMessage - ${getErrorMessage(error)}`
        )
    }
}

export default {
    createChatSession,
    getAllChatSessions,
    getChatSessionById,
    updateChatSession,
    deleteChatSession,
    ensureChatSessionExists,
    updateChatSessionOnMessage
}
