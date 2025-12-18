import { StatusCodes } from 'http-status-codes'
import { EntityManager, In, QueryRunner } from 'typeorm'
import { Assistant } from '../../database/entities/Assistant'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { ChatMessage } from '../../database/entities/ChatMessage'
import { ChatMessageFeedback } from '../../database/entities/ChatMessageFeedback'
import { CustomTemplate } from '../../database/entities/CustomTemplate'
import { DocumentStore } from '../../database/entities/DocumentStore'
import { DocumentStoreFileChunk } from '../../database/entities/DocumentStoreFileChunk'
import { Execution } from '../../database/entities/Execution'
import { Tool } from '../../database/entities/Tool'
import { Variable } from '../../database/entities/Variable'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { getErrorMessage } from '../../errors/utils'
import assistantsService from '../../services/assistants'
import chatflowsService from '../../services/chatflows'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { checkUsageLimit } from '../../utils/quotaUsage'
import assistantService from '../assistants'
import chatMessagesService from '../chat-messages'
import chatflowService from '../chatflows'
import documenStoreService from '../documentstore'
import executionService, { ExecutionFilters } from '../executions'
import marketplacesService from '../marketplaces'
import toolsService from '../tools'
import variableService from '../variables'
import { sanitizeNullBytes } from '../../utils/sanitize.util'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'

type ExportInput = {
    agentflowv2: boolean
    assistantCustom: boolean
    assistantOpenAI: boolean
    assistantAzure: boolean
    chatflow: boolean
    chat_message: boolean
    chat_feedback: boolean
    custom_template: boolean
    document_store: boolean
    execution: boolean
    tool: boolean
    variable: boolean
}

type ExportData = {
    AgentFlowV2: ChatFlow[]
    AssistantCustom: Assistant[]
    AssistantFlow: ChatFlow[]
    AssistantOpenAI: Assistant[]
    AssistantAzure: Assistant[]
    ChatFlow: ChatFlow[]
    ChatMessage: ChatMessage[]
    ChatMessageFeedback: ChatMessageFeedback[]
    CustomTemplate: CustomTemplate[]
    DocumentStore: DocumentStore[]
    DocumentStoreFileChunk: DocumentStoreFileChunk[]
    Execution: Execution[]
    Tool: Tool[]
    Variable: Variable[]
}

const convertExportInput = (body: any): ExportInput => {
    try {
        if (!body || typeof body !== 'object') throw new Error('Invalid ExportInput object in request body')
        if (body.agentflowv2 && typeof body.agentflowv2 !== 'boolean') throw new Error('Invalid agentflowv2 property in ExportInput object')
        if (body.assistant && typeof body.assistant !== 'boolean') throw new Error('Invalid assistant property in ExportInput object')
        if (body.chatflow && typeof body.chatflow !== 'boolean') throw new Error('Invalid chatflow property in ExportInput object')
        if (body.chat_message && typeof body.chat_message !== 'boolean')
            throw new Error('Invalid chat_message property in ExportInput object')
        if (body.chat_feedback && typeof body.chat_feedback !== 'boolean')
            throw new Error('Invalid chat_feedback property in ExportInput object')
        if (body.custom_template && typeof body.custom_template !== 'boolean')
            throw new Error('Invalid custom_template property in ExportInput object')
        if (body.document_store && typeof body.document_store !== 'boolean')
            throw new Error('Invalid document_store property in ExportInput object')
        if (body.execution && typeof body.execution !== 'boolean') throw new Error('Invalid execution property in ExportInput object')
        if (body.tool && typeof body.tool !== 'boolean') throw new Error('Invalid tool property in ExportInput object')
        if (body.variable && typeof body.variable !== 'boolean') throw new Error('Invalid variable property in ExportInput object')
        return body as ExportInput
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.convertExportInput - ${getErrorMessage(error)}`
        )
    }
}

const FileDefaultName = 'ExportData.json'
const exportData = async (exportInput: ExportInput, req: AuthenticatedRequest): Promise<{ FileDefaultName: string } & ExportData> => {
    try {
        const orgId = req.orgId || ''
        let AgentFlowV2: ChatFlow[] | { data: ChatFlow[]; total: number } =
            exportInput.agentflowv2 === true ? await chatflowService.getAllChatflows(req, 'AGENTFLOW') : []
        AgentFlowV2 = 'data' in AgentFlowV2 ? AgentFlowV2.data : AgentFlowV2

        let AssistantCustom: Assistant[] =
            exportInput.assistantCustom === true ? await assistantService.getAllAssistants(orgId, undefined, 'CUSTOM') : []

        let AssistantFlow: ChatFlow[] | { data: ChatFlow[]; total: number } =
            exportInput.assistantCustom === true ? await chatflowService.getAllChatflows(req, 'ASSISTANT') : []
        AssistantFlow = 'data' in AssistantFlow ? AssistantFlow.data : AssistantFlow

        let AssistantOpenAI: Assistant[] =
            exportInput.assistantOpenAI === true ? await assistantService.getAllAssistants(orgId, undefined, 'OPENAI') : []

        let AssistantAzure: Assistant[] =
            exportInput.assistantAzure === true ? await assistantService.getAllAssistants(orgId, undefined, 'AZURE') : []

        let ChatFlow: ChatFlow[] | { data: ChatFlow[]; total: number } =
            exportInput.chatflow === true ? await chatflowService.getAllChatflows(req, 'CHATFLOW') : []
        ChatFlow = 'data' in ChatFlow ? ChatFlow.data : ChatFlow

        let allChatflow: ChatFlow[] | { data: ChatFlow[]; total: number } =
            exportInput.chat_message === true || exportInput.chat_feedback === true ? await chatflowService.getAllChatflows(req) : []
        allChatflow = 'data' in allChatflow ? allChatflow.data : allChatflow
        const chatflowIds = allChatflow.map((chatflow) => chatflow.guid)

        let ChatMessage: ChatMessage[] =
            exportInput.chat_message === true ? await chatMessagesService.getMessagesByChatflowIds(chatflowIds, orgId) : []

        let ChatMessageFeedback: ChatMessageFeedback[] =
            exportInput.chat_feedback === true ? await chatMessagesService.getMessagesFeedbackByChatflowIds(chatflowIds, orgId) : []

        let CustomTemplate: CustomTemplate[] =
            exportInput.custom_template === true ? await marketplacesService.getAllCustomTemplates(orgId) : []

        const userId = req.userId ? parseInt(req.userId) : undefined
        let DocumentStore: DocumentStore[] | { data: DocumentStore[]; total: number } =
            exportInput.document_store === true ? await documenStoreService.getAllDocumentStores(orgId, userId) : []
        DocumentStore = 'data' in DocumentStore ? DocumentStore.data : DocumentStore

        const documentStoreIds = DocumentStore.map((documentStore) => documentStore.guid)

        let DocumentStoreFileChunk: DocumentStoreFileChunk[] =
            exportInput.document_store === true
                ? await documenStoreService.getAllDocumentFileChunksByDocumentStoreIds(documentStoreIds, orgId)
                : []

        const filters: ExecutionFilters = {
            orgId: orgId,
            userId: userId // Include userId for user-based isolation
        }
        const { data: totalExecutions } = exportInput.execution === true ? await executionService.getAllExecutions(filters) : { data: [] }
        let Execution: Execution[] = exportInput.execution === true ? totalExecutions : []

        let Tool: Tool[] | { data: Tool[]; total: number } = exportInput.tool === true ? await toolsService.getAllTools(orgId) : []
        Tool = 'data' in Tool ? Tool.data : Tool

        let Variable: Variable[] | { data: Variable[]; total: number } =
            exportInput.variable === true ? await variableService.getAllVariables(orgId) : []
        Variable = 'data' in Variable ? Variable.data : Variable

        return {
            FileDefaultName,
            AgentFlowV2,
            AssistantCustom,
            AssistantFlow,
            AssistantOpenAI,
            AssistantAzure,
            ChatFlow,
            ChatMessage,
            ChatMessageFeedback,
            CustomTemplate,
            DocumentStore,
            DocumentStoreFileChunk,
            Execution,
            Tool,
            Variable
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.exportData - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForChatFlow(queryRunner: QueryRunner, originalData: ExportData, chatflows: ChatFlow[]) {
    try {
        const guids = chatflows.map((chatflow) => chatflow.guid)
        const records = await queryRunner.manager.find(ChatFlow, {
            where: { guid: In(guids) }
        })
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldGuid = record.guid
            const { generateGuid } = await import('../../utils/guidGenerator')
            const newGuid = generateGuid()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldGuid, newGuid))
        }
        return originalData
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForChatflow - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForAssistant(queryRunner: QueryRunner, originalData: ExportData, assistants: Assistant[]) {
    try {
        const guids = assistants.map((assistant) => assistant.guid)
        const records = await queryRunner.manager.find(Assistant, {
            where: { guid: In(guids) }
        })
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldGuid = record.guid
            const { generateGuid } = await import('../../utils/guidGenerator')
            const newGuid = generateGuid()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldGuid, newGuid))
        }
        return originalData
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForAssistant - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForChatMessage(queryRunner: QueryRunner, originalData: ExportData, chatMessages: ChatMessage[]) {
    try {
        const chatmessageChatflowIds = chatMessages.map((chatMessage) => {
            return { id: chatMessage.chatflowid, qty: 0 }
        })
        const originalDataChatflowIds = [
            ...originalData.AssistantFlow.map((assistantFlow) => assistantFlow.guid),
            ...originalData.AgentFlowV2.map((agentFlowV2) => agentFlowV2.guid),
            ...originalData.ChatFlow.map((chatFlow) => chatFlow.guid)
        ]
        chatmessageChatflowIds.forEach((item) => {
            if (originalDataChatflowIds.includes(item.id)) {
                item.qty += 1
            }
        })
        const databaseChatflowIds = await (
            await queryRunner.manager.find(ChatFlow, {
                where: {
                    guid: In(chatmessageChatflowIds.map((chatmessageChatflowId) => chatmessageChatflowId.id))
                }
            })
        ).map((chatflow) => chatflow.guid)
        chatmessageChatflowIds.forEach((item) => {
            if (databaseChatflowIds.includes(item.id)) {
                item.qty += 1
            }
        })

        const missingChatflowIds = chatmessageChatflowIds.filter((item) => item.qty === 0).map((item) => item.id)
        if (missingChatflowIds.length > 0) {
            chatMessages = chatMessages.filter((chatMessage) => !missingChatflowIds.includes(chatMessage.chatflowid))
            originalData.ChatMessage = chatMessages
        }

        const guids = chatMessages.map((chatMessage) => chatMessage.guid)
        const records = await queryRunner.manager.find(ChatMessage, {
            where: { guid: In(guids) }
        })
        if (records.length < 0) return originalData

        // Replace duplicate ChatMessage guids found in db with new guids,
        // and update corresponding messageId references in ChatMessageFeedback
        const { generateGuid } = await import('../../utils/guidGenerator')
        const guidMap: { [key: string]: string } = {}
        const dbExistingGuids = new Set(records.map((record) => record.guid))
        originalData.ChatMessage = originalData.ChatMessage.map((item) => {
            if (dbExistingGuids.has(item.guid)) {
                const newGuid = generateGuid()
                guidMap[item.guid] = newGuid
                return { ...item, guid: newGuid }
            }
            return item
        })
        originalData.ChatMessageFeedback = originalData.ChatMessageFeedback.map((item) => {
            if (guidMap[item.messageId]) {
                return { ...item, messageId: guidMap[item.messageId] }
            }
            return item
        })
        return originalData
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForChatMessage - ${getErrorMessage(error)}`
        )
    }
}

async function replaceExecutionIdForChatMessage(queryRunner: QueryRunner, originalData: ExportData, chatMessages: ChatMessage[]) {
    try {
        // step 1 - get all execution ids from chatMessages
        const chatMessageExecutionIds = chatMessages
            .map((chatMessage) => {
                return { id: chatMessage.executionId, qty: 0 }
            })
            .filter((item): item is { id: string; qty: number } => item !== undefined)

        // step 2 - increase qty if execution guid is in importData.Execution
        const originalDataExecutionGuids = originalData.Execution.map((execution) => execution.guid)
        chatMessageExecutionIds.forEach((item) => {
            if (originalDataExecutionGuids.includes(item.id)) {
                item.qty += 1
            }
        })

        // step 3 - increase qty if execution guid is in database
        const databaseExecutionGuids = await (
            await queryRunner.manager.find(Execution, {
                where: {
                    guid: In(chatMessageExecutionIds.map((chatMessageExecutionId) => chatMessageExecutionId.id))
                }
            })
        ).map((execution) => execution.guid)
        chatMessageExecutionIds.forEach((item) => {
            if (databaseExecutionGuids.includes(item.id)) {
                item.qty += 1
            }
        })

        // step 4 - if executionIds not found replace with NULL
        const missingExecutionIds = chatMessageExecutionIds.filter((item) => item.qty === 0).map((item) => item.id)
        chatMessages.forEach((chatMessage) => {
            if (chatMessage.executionId && missingExecutionIds.includes(chatMessage.executionId)) {
                delete chatMessage.executionId
            }
        })

        originalData.ChatMessage = chatMessages

        return originalData
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceExecutionIdForChatMessage - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForChatMessageFeedback(
    queryRunner: QueryRunner,
    originalData: ExportData,
    chatMessageFeedbacks: ChatMessageFeedback[]
) {
    try {
        const feedbackChatflowIds = chatMessageFeedbacks.map((feedback) => {
            return { id: feedback.chatflowid, qty: 0 }
        })
        const originalDataChatflowIds = [
            ...originalData.AssistantFlow.map((assistantFlow) => assistantFlow.guid),
            ...originalData.AgentFlowV2.map((agentFlowV2) => agentFlowV2.guid),
            ...originalData.ChatFlow.map((chatFlow) => chatFlow.guid)
        ]
        feedbackChatflowIds.forEach((item) => {
            if (originalDataChatflowIds.includes(item.id)) {
                item.qty += 1
            }
        })
        const databaseChatflowIds = await (
            await queryRunner.manager.find(ChatFlow, {
                where: { guid: In(feedbackChatflowIds.map((feedbackChatflowId) => feedbackChatflowId.id)) }
            })
        ).map((chatflow) => chatflow.guid)
        feedbackChatflowIds.forEach((item) => {
            if (databaseChatflowIds.includes(item.id)) {
                item.qty += 1
            }
        })

        const feedbackMessageIds = chatMessageFeedbacks.map((feedback) => {
            return { id: feedback.messageId, qty: 0 }
        })
        const originalDataMessageIds = originalData.ChatMessage.map((chatMessage) => chatMessage.guid)
        feedbackMessageIds.forEach((item) => {
            if (originalDataMessageIds.includes(item.id)) {
                item.qty += 1
            }
        })
        const databaseMessageIds = await (
            await queryRunner.manager.find(ChatMessage, {
                where: {
                    guid: In(feedbackMessageIds.map((feedbackMessageId) => feedbackMessageId.id))
                }
            })
        ).map((chatMessage) => chatMessage.guid)
        feedbackMessageIds.forEach((item) => {
            if (databaseMessageIds.includes(item.id)) {
                item.qty += 1
            }
        })

        const missingChatflowIds = feedbackChatflowIds.filter((item) => item.qty === 0).map((item) => item.id)
        const missingMessageIds = feedbackMessageIds.filter((item) => item.qty === 0).map((item) => item.id)

        if (missingChatflowIds.length > 0 || missingMessageIds.length > 0) {
            chatMessageFeedbacks = chatMessageFeedbacks.filter(
                (feedback) => !missingChatflowIds.includes(feedback.chatflowid) && !missingMessageIds.includes(feedback.messageId)
            )
            originalData.ChatMessageFeedback = chatMessageFeedbacks
        }

        const guids = chatMessageFeedbacks.map((chatMessageFeedback) => chatMessageFeedback.guid)
        const records = await queryRunner.manager.find(ChatMessageFeedback, {
            where: { guid: In(guids) }
        })

        // remove duplicate messageId
        const seenMessageIds = new Set()
        originalData.ChatMessageFeedback = originalData.ChatMessageFeedback.filter((feedback) => {
            if (seenMessageIds.has(feedback.messageId)) {
                return false
            }
            seenMessageIds.add(feedback.messageId)
            return true
        })

        if (records.length < 0) return originalData

        // replace duplicate guids found in db to new guid
        const { generateGuid } = await import('../../utils/guidGenerator')
        const dbExistingGuids = new Set(records.map((record) => record.guid))
        originalData.ChatMessageFeedback = originalData.ChatMessageFeedback.map((item) => {
            if (dbExistingGuids.has(item.guid)) {
                const newGuid = generateGuid()
                return { ...item, guid: newGuid }
            }
            return item
        })
        return originalData
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForChatMessageFeedback - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForCustomTemplate(queryRunner: QueryRunner, originalData: ExportData, customTemplates: CustomTemplate[]) {
    try {
        const guids = customTemplates.map((customTemplate) => customTemplate.guid)
        const records = await queryRunner.manager.find(CustomTemplate, {
            where: { guid: In(guids) }
        })
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldGuid = record.guid
            const { generateGuid } = await import('../../utils/guidGenerator')
            const newGuid = generateGuid()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldGuid, newGuid))
        }
        return originalData
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForCustomTemplate - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForDocumentStore(queryRunner: QueryRunner, originalData: ExportData, documentStores: DocumentStore[]) {
    try {
        const guids = documentStores.map((documentStore) => documentStore.guid)
        const records = await queryRunner.manager.find(DocumentStore, {
            where: { guid: In(guids) }
        })
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldGuid = record.guid
            const { generateGuid } = await import('../../utils/guidGenerator')
            const newGuid = generateGuid()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldGuid, newGuid))
        }
        return originalData
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForDocumentStore - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForDocumentStoreFileChunk(
    queryRunner: QueryRunner,
    originalData: ExportData,
    documentStoreFileChunks: DocumentStoreFileChunk[]
) {
    try {
        const guids = documentStoreFileChunks.map((documentStoreFileChunk) => documentStoreFileChunk.guid)
        const records = await queryRunner.manager.find(DocumentStoreFileChunk, {
            where: { guid: In(guids) }
        })
        if (records.length < 0) return originalData

        // replace duplicate guids found in db to new guid
        const { generateGuid } = await import('../../utils/guidGenerator')
        const dbExistingGuids = new Set(records.map((record) => record.guid))
        originalData.DocumentStoreFileChunk = originalData.DocumentStoreFileChunk.map((item) => {
            if (dbExistingGuids.has(item.guid)) {
                return { ...item, guid: generateGuid() }
            }
            return item
        })
        return originalData
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForDocumentStoreFileChunk - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForTool(queryRunner: QueryRunner, originalData: ExportData, tools: Tool[]) {
    try {
        const guids = tools.map((tool) => tool.guid)
        const records = await queryRunner.manager.find(Tool, {
            where: { guid: In(guids) }
        })
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldGuid = record.guid
            const { generateGuid } = await import('../../utils/guidGenerator')
            const newGuid = generateGuid()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldGuid, newGuid))
        }
        return originalData
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForTool - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForVariable(queryRunner: QueryRunner, originalData: ExportData, variables: Variable[]) {
    try {
        const guids = variables.map((variable) => variable.guid)
        const records = await queryRunner.manager.find(Variable, {
            where: { guid: In(guids) }
        })
        // Runtime variables are allowed in autonomous server (no platform restrictions)
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldGuid = record.guid
            const { generateGuid } = await import('../../utils/guidGenerator')
            const newGuid = generateGuid()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldGuid, newGuid))
        }
        return originalData
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForVariable - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForExecution(queryRunner: QueryRunner, originalData: ExportData, executions: Execution[]) {
    try {
        const guids = executions.map((execution) => execution.guid)
        const records = await queryRunner.manager.find(Execution, {
            where: { guid: In(guids) }
        })
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldGuid = record.guid
            const { generateGuid } = await import('../../utils/guidGenerator')
            const newGuid = generateGuid()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldGuid, newGuid))
        }
        return originalData
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForExecution - ${getErrorMessage(error)}`
        )
    }
}

function reduceSpaceForChatflowFlowData(chatflows: ChatFlow[]) {
    return chatflows.map((chatflow) => {
        return { ...chatflow, flowData: JSON.stringify(JSON.parse(chatflow.flowData)) }
    })
}

async function saveBatch(manager: EntityManager, entity: any, items: any[], batchSize = 900) {
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        await manager.save(entity, batch)
    }
}

/**
 * Save Execution entities using raw SQL to bypass TypeORM's duplicate column detection
 * This is necessary because Execution entity has both @Column and @JoinColumn for agentflowid/sessionid
 * @param queryRunner - QueryRunner instance
 * @param executions - Array of Execution entities to save
 */
async function saveExecutionsWithRawSQL(queryRunner: QueryRunner, executions: any[]) {
    if (executions.length === 0) return

    const { generateGuid } = await import('../../utils/guidGenerator')
    const dataSource = queryRunner.manager.connection
    const dbType = (dataSource.options.type as 'postgres' | 'oracle') || 'postgres'

    // Helper function to safely convert to number for Oracle
    const safeToNumber = (value: any, defaultValue: number = 0): number => {
        if (value == null || value === '' || value === 'undefined' || value === 'null') {
            return defaultValue
        }
        if (typeof value === 'number') {
            return isNaN(value) || !isFinite(value) ? defaultValue : value
        }
        if (typeof value === 'string') {
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

    const agentflowidCol = dbType === 'oracle' ? 'AGENTFLOWID' : 'agentflowid'
    const sessionidCol = dbType === 'oracle' ? 'SESSIONID' : 'sessionid'
    const tableName = dbType === 'oracle' ? '"AUTO_EXECUTION"' : 'auto_execution'

    // Process each execution
    for (const execution of executions) {
        // Ensure guid exists
        const executionGuid = execution.guid || generateGuid()
        const executionData = typeof execution.executionData === 'string'
            ? execution.executionData
            : JSON.stringify(execution.executionData || [])
        const state = execution.state || 'INPROGRESS'
        const agentflowId = execution.agentflowid || execution.agentflowId || ''
        const sessionId = execution.sessionid || execution.sessionId || ''
        const action = execution.action || null
        const isPublic = execution.isPublic !== undefined ? execution.isPublic : null
        const createdBy = safeToNumber(execution.created_by, 1)
        const createdOn = safeToNumber(execution.created_on, Date.now())
        const lastModifiedBy = execution.last_modified_by ? safeToNumber(execution.last_modified_by) : null
        const lastModifiedOn = execution.last_modified_on ? safeToNumber(execution.last_modified_on) : null
        const stoppedDate = execution.stoppedDate ? safeToNumber(execution.stoppedDate) : null

        if (dbType === 'oracle') {
            await queryRunner.manager.query(
                `INSERT INTO ${tableName} (GUID, EXECUTIONDATA, STATE, ${agentflowidCol}, ${sessionidCol}, ACTION, ISPUBLIC, CREATED_BY, CREATED_ON, LAST_MODIFIED_BY, LAST_MODIFIED_ON, STOPPEDDATE) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12)`,
                [executionGuid, executionData, state, agentflowId, sessionId, action, isPublic, createdBy, createdOn, lastModifiedBy, lastModifiedOn, stoppedDate]
            )
        } else {
            await queryRunner.manager.query(
                `INSERT INTO ${tableName} (guid, executiondata, state, ${agentflowidCol}, ${sessionidCol}, action, ispublic, created_by, created_on, last_modified_by, last_modified_on, stoppeddate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [executionGuid, executionData, state, agentflowId, sessionId, action, isPublic, createdBy, createdOn, lastModifiedBy, lastModifiedOn, stoppedDate]
            )
        }
    }
}

const importData = async (importData: ExportData, orgId: string, userId?: string) => {
    // Initialize missing properties with empty arrays to avoid "undefined" errors
    // Handle backward compatibility: merge old AgentFlow into AgentFlowV2 if present
    importData.AgentFlowV2 = importData.AgentFlowV2 || []
    // Check for old AgentFlow property (backward compatibility with old export files)
    const oldAgentFlow = (importData as any).AgentFlow
    if (oldAgentFlow && Array.isArray(oldAgentFlow) && oldAgentFlow.length > 0) {
        // Merge old AgentFlow data into AgentFlowV2 for backward compatibility
        importData.AgentFlowV2 = [...importData.AgentFlowV2, ...oldAgentFlow]
    }
    importData.AssistantCustom = importData.AssistantCustom || []
    importData.AssistantFlow = importData.AssistantFlow || []
    importData.AssistantOpenAI = importData.AssistantOpenAI || []
    importData.AssistantAzure = importData.AssistantAzure || []
    importData.ChatFlow = importData.ChatFlow || []
    importData.ChatMessage = importData.ChatMessage || []
    importData.ChatMessageFeedback = importData.ChatMessageFeedback || []
    importData.CustomTemplate = importData.CustomTemplate || []
    importData.DocumentStore = importData.DocumentStore || []
    importData.DocumentStoreFileChunk = importData.DocumentStoreFileChunk || []
    importData.Execution = importData.Execution || []
    importData.Tool = importData.Tool || []
    importData.Variable = importData.Variable || []

    if (!orgId) {
        throw new Error('orgId is required for importData')
    }

    // Import generateGuid function
    const { generateGuid } = await import('../../utils/guidGenerator')
    const userIdNum = userId ? parseInt(userId) : 1 // Use 1 (default user) if userId not provided
    const currentTimestamp = Date.now()

    // Generic helper function to ensure entity has required fields (guid, created_by, created_on)
    const ensureEntityFields = <T extends { guid?: string; id?: number | string; created_by?: number; created_on?: number }>(
        entity: T
    ): T => {
        // Remove id field from imported data - id is now auto-generated numeric primary key from sequence
        // Old exported data may have id as GUID (string), which would cause errors
        const { id, ...entityWithoutId } = entity as any

        // Generate guid if missing (id is now numeric primary key, guid is separate unique identifier)
        if (!entityWithoutId.guid) {
            entityWithoutId.guid = generateGuid()
        }
        // Ensure created_by and created_on are set
        if (!entityWithoutId.created_by) {
            entityWithoutId.created_by = userIdNum
        }
        if (!entityWithoutId.created_on) {
            entityWithoutId.created_on = currentTimestamp
        }
        return entityWithoutId as T
    }

    // Helper function to ensure chatflow has required fields
    const ensureChatflowFields = (chatflow: any): ChatFlow => {
        return ensureEntityFields(chatflow) as ChatFlow
    }

    // Helper function to ensure assistant has required fields
    const ensureAssistantFields = (assistant: any): Assistant => {
        return ensureEntityFields(assistant) as Assistant
    }

    // Ensure all chatflows have required fields
    importData.AgentFlowV2 = importData.AgentFlowV2.map(ensureChatflowFields)
    importData.AssistantFlow = importData.AssistantFlow.map(ensureChatflowFields)
    importData.ChatFlow = importData.ChatFlow.map(ensureChatflowFields)

    // Ensure all assistants have required fields
    importData.AssistantCustom = importData.AssistantCustom.map(ensureAssistantFields)
    importData.AssistantOpenAI = importData.AssistantOpenAI.map(ensureAssistantFields)
    importData.AssistantAzure = importData.AssistantAzure.map(ensureAssistantFields)

    // Ensure all other entities with guid have required fields
    importData.CustomTemplate = importData.CustomTemplate.map(ensureEntityFields)
    importData.DocumentStore = importData.DocumentStore.map(ensureEntityFields)
    // Fix missing flowData for CustomTemplate Tool during import (from Autonomous)
    importData.Tool = importData.Tool.map((item: any) => {
        if (item.type === 'Tool' && item.toolType === 'CustomTemplate' && !item.flowData) {
            // TODO: This is a temporary fix where export data for CustomTemplate type Tool need to be changed in the future.
            // Also handles backward compatibility for previously exported data where CustomTemplate type Tool does not have flowData field.
            item.flowData = JSON.stringify({
                iconSrc: item.iconSrc,
                schema: item.schema,
                func: item.func
            })
        }
        return ensureEntityFields(item)
    })
    importData.Variable = importData.Variable.map(ensureEntityFields)
    importData.Execution = importData.Execution.map(ensureEntityFields)
    importData.ChatMessage = importData.ChatMessage.map(ensureEntityFields)
    importData.ChatMessageFeedback = importData.ChatMessageFeedback.map(ensureEntityFields)
    importData.DocumentStoreFileChunk = importData.DocumentStoreFileChunk.map(ensureEntityFields)

    const { getDataSource } = await import('../../DataSource')
    const dataSource = getDataSource(parseInt(orgId))
    let queryRunner
    try {
        queryRunner = dataSource.createQueryRunner()
        await queryRunner.connect()

        try {
            if (importData.AgentFlowV2.length > 0) {
                importData.AgentFlowV2 = reduceSpaceForChatflowFlowData(importData.AgentFlowV2)
                const existingChatflowCount = await chatflowsService.getAllChatflowsCountByOrganization('AGENTFLOW', orgId)
                const newChatflowCount = importData.AgentFlowV2.length
                await checkUsageLimit('flows', getRunningExpressApp().usageCacheManager, existingChatflowCount + newChatflowCount)
                importData = await replaceDuplicateIdsForChatFlow(queryRunner, importData, importData.AgentFlowV2)
            }
            if (importData.AssistantCustom.length > 0) {
                const existingAssistantCount = await assistantsService.getAssistantsCountByOrganization('CUSTOM', orgId)
                const newAssistantCount = importData.AssistantCustom.length
                await checkUsageLimit('flows', getRunningExpressApp().usageCacheManager, existingAssistantCount + newAssistantCount)
                importData = await replaceDuplicateIdsForAssistant(queryRunner, importData, importData.AssistantCustom)
            }
            if (importData.AssistantFlow.length > 0) {
                importData.AssistantFlow = reduceSpaceForChatflowFlowData(importData.AssistantFlow)
                const existingChatflowCount = await chatflowsService.getAllChatflowsCountByOrganization('ASSISTANT', orgId)
                const newChatflowCount = importData.AssistantFlow.length
                await checkUsageLimit('flows', getRunningExpressApp().usageCacheManager, existingChatflowCount + newChatflowCount)
                importData = await replaceDuplicateIdsForChatFlow(queryRunner, importData, importData.AssistantFlow)
            }
            if (importData.AssistantOpenAI.length > 0) {
                const existingAssistantCount = await assistantsService.getAssistantsCountByOrganization('OPENAI', orgId)
                const newAssistantCount = importData.AssistantOpenAI.length
                await checkUsageLimit('flows', getRunningExpressApp().usageCacheManager, existingAssistantCount + newAssistantCount)
                importData = await replaceDuplicateIdsForAssistant(queryRunner, importData, importData.AssistantOpenAI)
            }
            if (importData.AssistantAzure.length > 0) {
                const existingAssistantCount = await assistantsService.getAssistantsCountByOrganization('AZURE', orgId)
                const newAssistantCount = importData.AssistantAzure.length
                await checkUsageLimit('flows', getRunningExpressApp().usageCacheManager, existingAssistantCount + newAssistantCount)
                importData = await replaceDuplicateIdsForAssistant(queryRunner, importData, importData.AssistantAzure)
            }
            if (importData.ChatFlow.length > 0) {
                importData.ChatFlow = reduceSpaceForChatflowFlowData(importData.ChatFlow)
                const existingChatflowCount = await chatflowsService.getAllChatflowsCountByOrganization('CHATFLOW', orgId)
                const newChatflowCount = importData.ChatFlow.length
                await checkUsageLimit('flows', getRunningExpressApp().usageCacheManager, existingChatflowCount + newChatflowCount)
                importData = await replaceDuplicateIdsForChatFlow(queryRunner, importData, importData.ChatFlow)
            }
            if (importData.ChatMessage.length > 0) {
                importData = await replaceDuplicateIdsForChatMessage(queryRunner, importData, importData.ChatMessage)
                importData = await replaceExecutionIdForChatMessage(queryRunner, importData, importData.ChatMessage)
            }
            if (importData.ChatMessageFeedback.length > 0) {
                importData = await replaceDuplicateIdsForChatMessageFeedback(queryRunner, importData, importData.ChatMessageFeedback)
            }
            if (importData.CustomTemplate.length > 0) {
                importData = await replaceDuplicateIdsForCustomTemplate(queryRunner, importData, importData.CustomTemplate)
            }
            if (importData.DocumentStore.length > 0) {
                importData = await replaceDuplicateIdsForDocumentStore(queryRunner, importData, importData.DocumentStore)
            }
            if (importData.DocumentStoreFileChunk.length > 0) {
                importData = await replaceDuplicateIdsForDocumentStoreFileChunk(queryRunner, importData, importData.DocumentStoreFileChunk)
            }
            if (importData.Tool.length > 0) {
                importData = await replaceDuplicateIdsForTool(queryRunner, importData, importData.Tool)
            }
            if (importData.Execution.length > 0) {
                importData = await replaceDuplicateIdsForExecution(queryRunner, importData, importData.Execution)
            }
            if (importData.Variable.length > 0) {
                importData = await replaceDuplicateIdsForVariable(queryRunner, importData, importData.Variable)
            }

            importData = sanitizeNullBytes(importData)

            // Helper function to remove id field from entities before saving
            // Old exported data may have id as GUID (string), which would cause errors with numeric id primary key
            const removeIdField = <T extends { id?: number | string }>(entities: T[]): T[] => {
                return entities.map((entity) => {
                    const { id, ...entityWithoutId } = entity as any
                    return entityWithoutId as T
                })
            }

            await queryRunner.startTransaction()

            if (importData.AgentFlowV2.length > 0) await queryRunner.manager.save(ChatFlow, removeIdField(importData.AgentFlowV2))
            if (importData.AssistantFlow.length > 0) await queryRunner.manager.save(ChatFlow, removeIdField(importData.AssistantFlow))
            if (importData.AssistantCustom.length > 0) await queryRunner.manager.save(Assistant, removeIdField(importData.AssistantCustom))
            if (importData.AssistantOpenAI.length > 0) await queryRunner.manager.save(Assistant, removeIdField(importData.AssistantOpenAI))
            if (importData.AssistantAzure.length > 0) await queryRunner.manager.save(Assistant, removeIdField(importData.AssistantAzure))
            if (importData.ChatFlow.length > 0) await queryRunner.manager.save(ChatFlow, removeIdField(importData.ChatFlow))
            if (importData.ChatMessage.length > 0) await saveBatch(queryRunner.manager, ChatMessage, removeIdField(importData.ChatMessage))
            if (importData.ChatMessageFeedback.length > 0)
                await queryRunner.manager.save(ChatMessageFeedback, removeIdField(importData.ChatMessageFeedback))
            if (importData.CustomTemplate.length > 0)
                await queryRunner.manager.save(CustomTemplate, removeIdField(importData.CustomTemplate))
            if (importData.DocumentStore.length > 0) await queryRunner.manager.save(DocumentStore, removeIdField(importData.DocumentStore))
            if (importData.DocumentStoreFileChunk.length > 0)
                await saveBatch(queryRunner.manager, DocumentStoreFileChunk, removeIdField(importData.DocumentStoreFileChunk))
            if (importData.Tool.length > 0) await queryRunner.manager.save(Tool, removeIdField(importData.Tool))
            // Use raw SQL insert for Execution entities to bypass TypeORM's duplicate column detection
            // This matches the approach used in buildAgentflow.ts
            if (importData.Execution.length > 0) await saveExecutionsWithRawSQL(queryRunner, removeIdField(importData.Execution))
            if (importData.Variable.length > 0) await queryRunner.manager.save(Variable, removeIdField(importData.Variable))

            await queryRunner.commitTransaction()
        } catch (error) {
            if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
            throw error
        } finally {
            if (!queryRunner.isReleased) await queryRunner.release()
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.importAll - ${getErrorMessage(error)}`
        )
    }
}

export default {
    convertExportInput,
    exportData,
    importData
}
