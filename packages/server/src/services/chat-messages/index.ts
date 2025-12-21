import { removeFilesFromStorage } from 'kodivian-components'
import { StatusCodes } from 'http-status-codes'
import { DeleteResult, FindOptionsWhere, In } from 'typeorm'
import { ChatMessage } from '../../database/entities/ChatMessage'
import { ChatMessageFeedback } from '../../database/entities/ChatMessageFeedback'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { ChatSession } from '../../database/entities/ChatSession'
import { Execution } from '../../database/entities/Execution'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import { getErrorMessage } from '../../errors/utils'
import { ChatMessageRatingType, ChatType, IChatMessage, MODE } from '../../Interface'
import { UsageCacheManager } from '../../UsageCacheManager'
import { utilAddChatMessage } from '../../utils/addChatMesage'
import { utilGetChatMessage } from '../../utils/getChatMessage'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { updateStorageUsage } from '../../utils/quotaUsage'
import { getDataSource } from '../../DataSource'

// Add chatmessages for chatflowid
const createChatMessage = async (chatMessage: Partial<IChatMessage>, orgId: string) => {
    try {
        if (!orgId) {
            throw new Error('orgId is required for createChatMessage')
        }
        const dbResponse = await utilAddChatMessage(chatMessage, undefined, orgId)
        return dbResponse
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatMessagesService.createChatMessage - ${getErrorMessage(error)}`
        )
    }
}

// Get all chatmessages from chatflowid
const getAllChatMessages = async (
    chatflowId: string,
    chatTypes: ChatType[] | undefined,
    sortOrder: string = 'ASC',
    chatId?: string,
    memoryType?: string,
    sessionId?: string,
    startDate?: string,
    endDate?: string,
    messageId?: string,
    feedback?: boolean,
    feedbackTypes?: ChatMessageRatingType[],
    activeOrgId?: string,
    page?: number,
    pageSize?: number
): Promise<ChatMessage[]> => {
    try {
        const dbResponse = await utilGetChatMessage({
            chatflowid: chatflowId,
            chatTypes,
            sortOrder,
            chatId,
            memoryType,
            sessionId,
            startDate,
            endDate,
            messageId,
            feedback,
            feedbackTypes,
            activeOrgId,
            page,
            pageSize
        })
        return dbResponse
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatMessagesService.getAllChatMessages - ${getErrorMessage(error)}`
        )
    }
}

// Get internal chatmessages from chatflowid
const getAllInternalChatMessages = async (
    chatflowId: string,
    chatTypes: ChatType[] | undefined,
    sortOrder: string = 'ASC',
    chatId?: string,
    memoryType?: string,
    sessionId?: string,
    startDate?: string,
    endDate?: string,
    messageId?: string,
    feedback?: boolean,
    feedbackTypes?: ChatMessageRatingType[],
    activeOrgId?: string
): Promise<ChatMessage[]> => {
    try {
        const dbResponse = await utilGetChatMessage({
            chatflowid: chatflowId,
            chatTypes,
            sortOrder,
            chatId,
            memoryType,
            sessionId,
            startDate,
            endDate,
            messageId,
            feedback,
            feedbackTypes,
            activeOrgId
        })
        return dbResponse
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatMessagesService.getAllInternalChatMessages - ${getErrorMessage(error)}`
        )
    }
}

const removeAllChatMessages = async (
    chatId: string,
    chatflowid: string,
    deleteOptions: FindOptionsWhere<ChatMessage>,
    orgId: string,
    usageCacheManager: UsageCacheManager
): Promise<DeleteResult> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))

        // Remove all related feedback records
        const feedbackDeleteOptions: FindOptionsWhere<ChatMessageFeedback> = { chatId }
        await dataSource.getRepository(ChatMessageFeedback).delete(feedbackDeleteOptions)

        // Delete all uploads corresponding to this chatflow/chatId
        if (chatId) {
            try {
                const { totalSize } = await removeFilesFromStorage(orgId, chatflowid, chatId)
                await updateStorageUsage(orgId, totalSize, usageCacheManager)
            } catch (e) {
                // Don't throw error if file deletion fails because file might not exist
            }
        }
        const dbResponse = await dataSource.getRepository(ChatMessage).delete(deleteOptions)

        // After deleting messages, check if any sessions should be deleted
        // If chatId is specified in deleteOptions, check if all messages are deleted for that chatId
        const deleteChatId = deleteOptions.chatId as string | undefined
        if (deleteChatId) {
            try {
                // Check if there are any remaining messages for this chatId
                const remainingMessages = await dataSource
                    .getRepository(ChatMessage)
                    .createQueryBuilder('chat_message')
                    .where('chat_message.chatid = :chatId', { chatId: deleteChatId })
                    .andWhere('chat_message.chatflowid = :chatflowid', { chatflowid })
                    .getCount()

                // If no messages remain, delete all sessions for this chatId
                if (remainingMessages === 0) {
                    const chatSessionRepository = dataSource.getRepository(ChatSession)

                    // Find all sessions for this chatId (regardless of userId, since messages are org-level)
                    const sessionsToDelete = await chatSessionRepository.find({
                        where: {
                            chatId: deleteChatId,
                            chatflowId: chatflowid
                        }
                    })

                    if (sessionsToDelete.length > 0) {
                        await chatSessionRepository.remove(sessionsToDelete)
                    }
                }
            } catch (error) {
                // Log but don't fail the message deletion if session cleanup fails
                // Use new logging system - throw error if logging fails
                const { sessionLog } = await import('../../utils/logger/module-methods')
                const userId = 'system' // System operation
                await sessionLog('error', `Failed to cleanup chat sessions after message deletion: ${getErrorMessage(error)}`, {
                    userId,
                    orgId: orgId,
                    error: getErrorMessage(error)
                }).catch((logError) => {
                    // Throw error if new logging system fails - no fallback
                    throw new Error(
                        `Failed to log session cleanup error: ${
                            logError instanceof Error ? logError.message : String(logError)
                        }. Original error: ${getErrorMessage(error)}`
                    )
                })
            }
        }

        return dbResponse
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatMessagesService.removeAllChatMessages - ${getErrorMessage(error)}`
        )
    }
}

const removeChatMessagesByMessageIds = async (
    chatflowid: string,
    chatIdMap: Map<string, ChatMessage[]>,
    messageIds: string[],
    orgId: string,
    usageCacheManager: UsageCacheManager
): Promise<DeleteResult> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))

        // Get messages before deletion to check for executionId
        const messages = await dataSource.getRepository(ChatMessage).findBy({ guid: In(messageIds) })
        const executionIds = messages.map((msg) => msg.executionId).filter((id): id is string => Boolean(id))

        for (const [composite_key] of chatIdMap) {
            const [chatId] = composite_key.split('_')

            // Remove all related feedback records
            const feedbackDeleteOptions: FindOptionsWhere<ChatMessageFeedback> = { chatId }
            await dataSource.getRepository(ChatMessageFeedback).delete(feedbackDeleteOptions)

            // Delete all uploads corresponding to this chatflow/chatId
            try {
                const { totalSize } = await removeFilesFromStorage(orgId, chatflowid, chatId)
                await updateStorageUsage(orgId, totalSize, usageCacheManager)
            } catch (e) {
                // Don't throw error if file deletion fails because file might not exist
            }
        }

        // Delete executions if they exist
        if (executionIds.length > 0) {
            await dataSource.getRepository(Execution).delete({ guid: In(executionIds) })
        }

        const dbResponse = await dataSource.getRepository(ChatMessage).delete({ guid: In(messageIds) })

        // After deleting messages, check if any sessions should be deleted
        // Get unique chatIds from the deleted messages
        const deletedChatIds = new Set<string>()
        for (const [composite_key] of chatIdMap) {
            const [chatId] = composite_key.split('_')
            if (chatId) {
                deletedChatIds.add(chatId)
            }
        }

        // For each chatId, check if there are any remaining messages, and delete sessions if none
        const chatSessionRepository = dataSource.getRepository(ChatSession)
        for (const chatId of deletedChatIds) {
            try {
                const remainingMessages = await dataSource
                    .getRepository(ChatMessage)
                    .createQueryBuilder('chat_message')
                    .where('chat_message.chatid = :chatId', { chatId })
                    .andWhere('chat_message.chatflowid = :chatflowid', { chatflowid })
                    .getCount()

                // If no messages remain, delete all sessions for this chatId
                if (remainingMessages === 0) {
                    const sessionsToDelete = await chatSessionRepository.find({
                        where: {
                            chatId,
                            chatflowId: chatflowid
                        }
                    })

                    if (sessionsToDelete.length > 0) {
                        await chatSessionRepository.remove(sessionsToDelete)
                    }
                }
            } catch (error) {
                // Log but don't fail the message deletion if session cleanup fails
                console.error(`Failed to cleanup chat sessions for chatId ${chatId}: ${getErrorMessage(error)}`)
            }
        }

        return dbResponse
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatMessagesService.removeChatMessagesByMessageIds - ${getErrorMessage(error)}`
        )
    }
}

const abortChatMessage = async (chatId: string, chatflowid: string, orgId: string) => {
    try {
        const appServer = getRunningExpressApp()
        const dataSource = getDataSource(parseInt(orgId))
        const id = `${chatflowid}_${chatId}`

        if (process.env.MODE === MODE.QUEUE) {
            // Get orgId from chatflow
            const chatflow = await dataSource.getRepository(ChatFlow).findOneBy({
                guid: chatflowid
            })
            if (!chatflow) {
                throw new InternalKodivianError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowid} not found`)
            }
            const orgIdNum = parseInt(orgId)
            if (!orgIdNum) {
                throw new InternalKodivianError(StatusCodes.BAD_REQUEST, `Invalid organization ID for chatflow ${chatflowid}`)
            }
            await appServer.queueManager.getPredictionQueueEventsProducer(orgIdNum).publishEvent({
                eventName: 'abort',
                id
            })
        } else {
            appServer.abortControllerPool.abort(id)
        }
    } catch (error) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatMessagesService.abortChatMessage - ${getErrorMessage(error)}`
        )
    }
}

async function getMessagesByChatflowIds(chatflowIds: string[], orgId: string): Promise<ChatMessage[]> {
    const dataSource = getDataSource(parseInt(orgId))
    return await dataSource.getRepository(ChatMessage).find({ where: { chatflowid: In(chatflowIds) } })
}

async function getMessagesFeedbackByChatflowIds(chatflowIds: string[], orgId: string): Promise<ChatMessageFeedback[]> {
    const dataSource = getDataSource(parseInt(orgId))
    return await dataSource.getRepository(ChatMessageFeedback).find({ where: { chatflowid: In(chatflowIds) } })
}

export default {
    createChatMessage,
    getAllChatMessages,
    getAllInternalChatMessages,
    removeAllChatMessages,
    removeChatMessagesByMessageIds,
    abortChatMessage,
    getMessagesByChatflowIds,
    getMessagesFeedbackByChatflowIds
}
