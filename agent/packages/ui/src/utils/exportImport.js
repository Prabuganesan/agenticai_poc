import { getErrorMessage } from './errorHandler'
import { generateExportFlowData } from './genericHelper'

const sanitizeTool = (Tool) => {
    try {
        return Tool.map((tool) => {
            return {
                // Include both id (for backward compatibility) and guid (new schema)
                id: tool.id || tool.guid,
                guid: tool.guid || tool.id,
                name: tool.name,
                description: tool.description,
                color: tool.color,
                iconSrc: tool.iconSrc,
                schema: tool.schema,
                func: tool.func,
                // Include new schema fields
                created_by: tool.created_by,
                created_on: tool.created_on,
                last_modified_by: tool.last_modified_by,
                last_modified_on: tool.last_modified_on
            }
        })
    } catch (error) {
        throw new Error(`exportImport.sanitizeTool ${getErrorMessage(error)}`)
    }
}

const sanitizeChatflow = (ChatFlow) => {
    try {
        return ChatFlow.map((chatFlow) => {
            const sanitizeFlowData = generateExportFlowData(JSON.parse(chatFlow.flowData))
            return {
                // Include both id (for backward compatibility) and guid (new schema)
                id: chatFlow.id || chatFlow.guid,
                guid: chatFlow.guid || chatFlow.id,
                name: chatFlow.name,
                flowData: stringify(sanitizeFlowData),
                type: chatFlow.type,
                // Include new schema fields
                created_by: chatFlow.created_by,
                created_on: chatFlow.created_on,
                last_modified_by: chatFlow.last_modified_by,
                last_modified_on: chatFlow.last_modified_on,
                // Include other optional fields
                deployed: chatFlow.deployed,
                isPublic: chatFlow.isPublic,
                apikeyid: chatFlow.apikeyid,
                chatbotConfig: chatFlow.chatbotConfig,
                apiConfig: chatFlow.apiConfig,
                analytic: chatFlow.analytic,
                speechToText: chatFlow.speechToText,
                textToSpeech: chatFlow.textToSpeech,
                followUpPrompts: chatFlow.followUpPrompts,
                category: chatFlow.category
            }
        })
    } catch (error) {
        throw new Error(`exportImport.sanitizeChatflow ${getErrorMessage(error)}`)
    }
}

const sanitizeVariable = (Variable) => {
    try {
        return Variable.map((variable) => {
            return {
                // Include both id (for backward compatibility) and guid (new schema)
                id: variable.id || variable.guid,
                guid: variable.guid || variable.id,
                name: variable.name,
                value: variable.value,
                type: variable.type,
                // Include new schema fields
                created_by: variable.created_by,
                created_on: variable.created_on,
                last_modified_by: variable.last_modified_by,
                last_modified_on: variable.last_modified_on
            }
        })
    } catch (error) {
        throw new Error(`exportImport.sanitizeVariable ${getErrorMessage(error)}`)
    }
}

const sanitizeAssistant = (Assistant) => {
    try {
        return Assistant.map((assistant) => {
            return {
                // Include both id (for backward compatibility) and guid (new schema)
                id: assistant.id || assistant.guid,
                guid: assistant.guid || assistant.id,
                details: assistant.details,
                credential: assistant.credential,
                iconSrc: assistant.iconSrc,
                type: assistant.type,
                // Include new schema fields
                created_by: assistant.created_by,
                created_on: assistant.created_on,
                last_modified_by: assistant.last_modified_by,
                last_modified_on: assistant.last_modified_on
            }
        })
    } catch (error) {
        throw new Error(`exportImport.sanitizeAssistant ${getErrorMessage(error)}`)
    }
}

const sanitizeCustomTemplate = (CustomTemplate) => {
    try {
        return CustomTemplate.map((customTemplate) => {
            return { ...customTemplate, usecases: JSON.stringify(customTemplate.usecases), workspaceId: undefined }
        })
    } catch (error) {
        throw new Error(`exportImport.sanitizeCustomTemplate ${getErrorMessage(error)}`)
    }
}

const sanitizeDocumentStore = (DocumentStore) => {
    try {
        return DocumentStore.map((documentStore) => {
            return { ...documentStore, workspaceId: undefined }
        })
    } catch (error) {
        throw new Error(`exportImport.sanitizeDocumentStore ${getErrorMessage(error)}`)
    }
}

const sanitizeExecution = (Execution) => {
    try {
        return Execution.map((execution) => {
            if (execution.agentflow) execution.agentflow.workspaceId = undefined
            return { ...execution, workspaceId: undefined }
        })
    } catch (error) {
        throw new Error(`exportImport.sanitizeExecution ${getErrorMessage(error)}`)
    }
}

export const stringify = (object) => {
    try {
        return JSON.stringify(object, null, 2)
    } catch (error) {
        throw new Error(`exportImport.stringify ${getErrorMessage(error)}`)
    }
}

export const exportData = (exportAllData) => {
    try {
        return {
            AgentFlowV2: sanitizeChatflow(exportAllData.AgentFlowV2 || []),
            AssistantFlow: sanitizeChatflow(exportAllData.AssistantFlow || []),
            AssistantCustom: sanitizeAssistant(exportAllData.AssistantCustom || []),
            AssistantOpenAI: sanitizeAssistant(exportAllData.AssistantOpenAI || []),
            AssistantAzure: sanitizeAssistant(exportAllData.AssistantAzure || []),
            ChatFlow: sanitizeChatflow(exportAllData.ChatFlow || []),
            ChatMessage: exportAllData.ChatMessage || [],
            ChatMessageFeedback: exportAllData.ChatMessageFeedback || [],
            CustomTemplate: sanitizeCustomTemplate(exportAllData.CustomTemplate || []),
            DocumentStore: sanitizeDocumentStore(exportAllData.DocumentStore || []),
            DocumentStoreFileChunk: exportAllData.DocumentStoreFileChunk || [],
            Execution: sanitizeExecution(exportAllData.Execution || []),
            Tool: sanitizeTool(exportAllData.Tool || []),
            Variable: sanitizeVariable(exportAllData.Variable || [])
        }
    } catch (error) {
        throw new Error(`exportImport.exportData ${getErrorMessage(error)}`)
    }
}
