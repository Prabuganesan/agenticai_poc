import { StatusCodes } from 'http-status-codes'
import { IChatMessageFeedback } from '../../Interface'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import { ChatMessage } from '../../database/entities/ChatMessage'
import { ChatMessageFeedback } from '../../database/entities/ChatMessageFeedback'
import { getDataSource } from '../../DataSource'

/**
 * Validates that the message ID exists
 * @param {string} messageId
 * @param {string} orgId - Organization ID (required)
 */
export const validateMessageExists = async (messageId: string, orgId: string): Promise<ChatMessage> => {
    if (!orgId) {
        throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
    }
    const dataSource = getDataSource(parseInt(orgId))
    const message = await dataSource.getRepository(ChatMessage).findOne({
        where: { guid: messageId }
    })

    if (!message) {
        throw new InternalKodivianError(StatusCodes.NOT_FOUND, `Message with ID ${messageId} not found`)
    }

    return message
}

/**
 * Validates that the feedback ID exists
 * @param {string} feedbackId
 * @param {string} orgId - Organization ID (required)
 */
export const validateFeedbackExists = async (feedbackId: string, orgId: string): Promise<ChatMessageFeedback> => {
    if (!orgId) {
        throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
    }
    const dataSource = getDataSource(parseInt(orgId))
    const feedbackExists = await dataSource.getRepository(ChatMessageFeedback).findOne({
        where: { guid: feedbackId }
    })

    if (!feedbackExists) {
        throw new InternalKodivianError(StatusCodes.NOT_FOUND, `Feedback with ID ${feedbackId} not found`)
    }

    return feedbackExists
}

/**
 * Validates a feedback object for creation
 * @param {Partial<IChatMessageFeedback>} feedback
 * @param {string} orgId - Organization ID (required)
 */
export const validateFeedbackForCreation = async (
    feedback: Partial<IChatMessageFeedback>,
    orgId: string
): Promise<Partial<IChatMessageFeedback>> => {
    if (!orgId) {
        throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
    }
    // If messageId is provided, validate it exists and get the message
    let message: ChatMessage | null = null
    if (feedback.messageId) {
        message = await validateMessageExists(feedback.messageId, orgId)
    } else {
        throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Message ID is required')
    }

    // If chatId is provided, validate it matches the message's chatId
    if (feedback.chatId) {
        if (message.chatId !== feedback.chatId) {
            throw new InternalKodivianError(
                StatusCodes.BAD_REQUEST,
                `Inconsistent chat ID: message with ID ${message.guid} does not belong to chat with ID ${feedback.chatId}`
            )
        }
    } else {
        // If not provided, use the message's chatId
        feedback.chatId = message.chatId
    }

    // If chatflowid is provided, validate it matches the message's chatflowid
    if (feedback.chatflowid) {
        if (message.chatflowid !== feedback.chatflowid) {
            throw new InternalKodivianError(
                StatusCodes.BAD_REQUEST,
                `Inconsistent chatflow ID: message with ID ${message.guid} does not belong to chatflow with ID ${feedback.chatflowid}`
            )
        }
    } else {
        // If not provided, use the message's chatflowid
        feedback.chatflowid = message.chatflowid
    }

    return feedback
}

/**
 * Validates a feedback object for update
 * @param {string} feedbackId
 * @param {string} orgId - Organization ID (required)
 * @param {Partial<IChatMessageFeedback>} feedback
 */
export const validateFeedbackForUpdate = async (
    feedbackId: string,
    orgId: string,
    feedback: Partial<IChatMessageFeedback>
): Promise<Partial<IChatMessageFeedback>> => {
    if (!orgId) {
        throw new InternalKodivianError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
    }
    // First validate the feedback exists
    const existingFeedback = await validateFeedbackExists(feedbackId, orgId)

    feedback.messageId = feedback.messageId ?? existingFeedback.messageId
    feedback.chatId = feedback.chatId ?? existingFeedback.chatId
    feedback.chatflowid = feedback.chatflowid ?? existingFeedback.chatflowid

    // If messageId is provided, validate it exists and get the message
    let message: ChatMessage | null = null
    if (feedback.messageId) {
        message = await validateMessageExists(feedback.messageId, orgId)
    }

    // If chatId is provided and we have a message, validate it matches the message's chatId
    if (feedback.chatId) {
        if (message?.chatId !== feedback.chatId) {
            throw new InternalKodivianError(
                StatusCodes.BAD_REQUEST,
                `Inconsistent chat ID: message with ID ${message?.guid} does not belong to chat with ID ${feedback.chatId}`
            )
        }
    }

    // If chatflowid is provided and we have a message, validate it matches the message's chatflowid
    if (feedback.chatflowid && message) {
        if (message?.chatflowid !== feedback.chatflowid) {
            throw new InternalKodivianError(
                StatusCodes.BAD_REQUEST,
                `Inconsistent chatflow ID: message with ID ${message?.guid} does not belong to chatflow with ID ${feedback.chatflowid}`
            )
        }
    }

    return feedback
}
