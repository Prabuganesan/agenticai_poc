import { StatusCodes } from 'http-status-codes'
import { utilGetChatMessageFeedback } from '../../utils/getChatMessageFeedback'
import { utilAddChatMessageFeedback } from '../../utils/addChatMessageFeedback'
import { utilUpdateChatMessageFeedback } from '../../utils/updateChatMessageFeedback'
import { IChatMessageFeedback } from '../../Interface'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { getErrorMessage } from '../../errors/utils'

// Get all chatmessage feedback from chatflowid
const getAllChatMessageFeedback = async (
    chatflowid: string,
    orgId: string,
    chatId: string | undefined,
    sortOrder: string | undefined,
    startDate: string | undefined,
    endDate: string | undefined
) => {
    try {
        const dbResponse = await utilGetChatMessageFeedback(chatflowid, orgId, chatId, sortOrder, startDate, endDate)
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: feedbackService.getAllChatMessageFeedback - ${getErrorMessage(error)}`
        )
    }
}

// Add chatmessage feedback
const createChatMessageFeedbackForChatflow = async (requestBody: Partial<IChatMessageFeedback>, orgId: string, userId?: string): Promise<any> => {
    try {
        const dbResponse = await utilAddChatMessageFeedback(requestBody, orgId, userId)
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: feedbackService.createChatMessageFeedbackForChatflow - ${getErrorMessage(error)}`
        )
    }
}

// Add chatmessage feedback
const updateChatMessageFeedbackForChatflow = async (
    feedbackId: string,
    orgId: string,
    requestBody: Partial<IChatMessageFeedback>
): Promise<any> => {
    try {
        const dbResponse = await utilUpdateChatMessageFeedback(feedbackId, orgId, requestBody)
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: feedbackService.updateChatMessageFeedbackForChatflow - ${getErrorMessage(error)}`
        )
    }
}

export default {
    getAllChatMessageFeedback,
    createChatMessageFeedbackForChatflow,
    updateChatMessageFeedbackForChatflow
}
