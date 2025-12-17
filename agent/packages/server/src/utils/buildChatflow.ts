import { Request } from 'express'
import * as path from 'path'
import { DataSource } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import { omit, cloneDeep } from 'lodash'
import { generateGuid } from './guidGenerator'
import {
    IFileUpload,
    convertSpeechToText,
    convertTextToSpeechStream,
    ICommonObject,
    addSingleFileToStorage,
    generateFollowUpPrompts,
    addArrayFilesToStorage,
    mapMimeTypeToInputField,
    mapExtToInputField,
    getFileFromUpload,
    removeSpecificFileFromUpload,
    handleEscapeCharacters,
    IServerSideEventStreamer
} from 'autonomous-components'
import { StatusCodes } from 'http-status-codes'
import {
    IncomingInput,
    IMessage,
    INodeData,
    IReactFlowNode,
    IReactFlowObject,
    IDepthQueue,
    ChatType,
    IChatMessage,
    IExecuteFlowParams,
    IFlowConfig,
    IComponentNodes,
    IVariable,
    INodeOverrides,
    IVariableOverride,
    MODE
} from '../Interface'
import { InternalAutonomousError } from '../errors/internalAutonomousError'
import { databaseEntities } from '.'
import { ChatFlow } from '../database/entities/ChatFlow'
import { Variable } from '../database/entities/Variable'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import {
    isFlowValidForStream,
    buildFlow,
    resolveVariables,
    getSessionChatHistory,
    findMemoryNode,
    replaceInputsWithConfig,
    getStartingNodes,
    getMemorySessionId,
    getEndingNodes,
    constructGraphs,
    getAPIOverrideConfig
} from '../utils'
import { validateFlowAPIKey } from './validateKey'
import { logDebug, logError, logInfo } from './logger/system-helper'
import { chatflowLog } from './logger/module-methods'
import { utilAddChatMessage } from './addChatMesage'
import { checkPredictions, checkStorage, updatePredictionsUsage, updateStorageUsage } from './quotaUsage'
import { getErrorMessage, sanitizeErrorMessage } from '../errors/utils'
import { AUTONOMOUS_METRIC_COUNTERS, AUTONOMOUS_COUNTER_STATUS, IMetricsProvider } from '../Interface.Metrics'
import { OMIT_QUEUE_JOB_DATA } from './constants'
import { executeAgentFlow } from './buildAgentflow'
import chatSessionsService from '../services/chat-sessions'

const shouldAutoPlayTTS = (textToSpeechConfig: string | undefined | null): boolean => {
    if (!textToSpeechConfig) return false
    try {
        const config = typeof textToSpeechConfig === 'string' ? JSON.parse(textToSpeechConfig) : textToSpeechConfig
        for (const providerKey in config) {
            const provider = config[providerKey]
            if (provider && provider.status === true && provider.autoPlay === true) {
                return true
            }
        }
        return false
    } catch (error) {
        logError(`Error parsing textToSpeechConfig: ${getErrorMessage(error)}`).catch(() => {})
        return false
    }
}

const generateTTSForResponseStream = async (
    responseText: string,
    textToSpeechConfig: string | undefined,
    options: ICommonObject,
    chatId: string,
    chatMessageId: string,
    sseStreamer: IServerSideEventStreamer,
    abortController?: AbortController
): Promise<void> => {
    try {
        if (!textToSpeechConfig) return
        const config = typeof textToSpeechConfig === 'string' ? JSON.parse(textToSpeechConfig) : textToSpeechConfig

        let activeProviderConfig = null
        for (const providerKey in config) {
            const provider = config[providerKey]
            if (provider && provider.status === true) {
                activeProviderConfig = {
                    name: providerKey,
                    credentialId: provider.credentialId,
                    voice: provider.voice,
                    model: provider.model
                }
                break
            }
        }

        if (!activeProviderConfig) return

        await convertTextToSpeechStream(
            responseText,
            activeProviderConfig,
            options,
            abortController || new AbortController(),
            (format: string) => {
                sseStreamer.streamTTSStartEvent(chatId, chatMessageId, format)
            },
            (chunk: Buffer) => {
                const audioBase64 = chunk.toString('base64')
                sseStreamer.streamTTSDataEvent(chatId, chatMessageId, audioBase64)
            },
            () => {
                sseStreamer.streamTTSEndEvent(chatId, chatMessageId)
            }
        )
    } catch (error) {
        logError(`[server]: TTS streaming failed: ${getErrorMessage(error)}`).catch(() => {})
        sseStreamer.streamTTSEndEvent(chatId, chatMessageId)
    }
}

const initEndingNode = async ({
    endingNodeIds,
    componentNodes,
    reactFlowNodes,
    incomingInput,
    flowConfig,
    uploadedFilesContent,
    availableVariables,
    apiOverrideStatus,
    nodeOverrides,
    variableOverrides
}: {
    endingNodeIds: string[]
    componentNodes: IComponentNodes
    reactFlowNodes: IReactFlowNode[]
    incomingInput: IncomingInput
    flowConfig: IFlowConfig
    uploadedFilesContent: string
    availableVariables: IVariable[]
    apiOverrideStatus: boolean
    nodeOverrides: INodeOverrides
    variableOverrides: IVariableOverride[]
}): Promise<{ endingNodeData: INodeData; endingNodeInstance: any }> => {
    const question = incomingInput.question
    const chatHistory = flowConfig.chatHistory
    const sessionId = flowConfig.sessionId

    const nodeToExecute =
        endingNodeIds.length === 1
            ? reactFlowNodes.find((node: IReactFlowNode) => endingNodeIds[0] === node.id)
            : reactFlowNodes[reactFlowNodes.length - 1]

    if (!nodeToExecute) {
        throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Node not found`)
    }

    if (incomingInput.overrideConfig && apiOverrideStatus) {
        nodeToExecute.data = replaceInputsWithConfig(nodeToExecute.data, incomingInput.overrideConfig, nodeOverrides, variableOverrides)
    }

    const reactFlowNodeData: INodeData = await resolveVariables(
        nodeToExecute.data,
        reactFlowNodes,
        question,
        chatHistory,
        flowConfig,
        uploadedFilesContent,
        availableVariables,
        variableOverrides
    )

    logDebug(`[server]: Running ${reactFlowNodeData.label} (${reactFlowNodeData.id})`).catch(() => {})

    const nodeInstanceFilePath = componentNodes[reactFlowNodeData.name].filePath as string
    const nodeModule = await import(nodeInstanceFilePath)
    const nodeInstance = new nodeModule.nodeClass({ sessionId })

    return { endingNodeData: reactFlowNodeData, endingNodeInstance: nodeInstance }
}

/*
 * Get chat history from memory node
 * This is used to fill in the {{chat_history}} variable if it is used in the Format Prompt Value
 */
const getChatHistory = async ({
    endingNodes,
    nodes,
    chatflowid,
    appDataSource,
    componentNodes,
    incomingInput,
    chatId,
    isInternal,
    isAgentFlow
}: {
    endingNodes: IReactFlowNode[]
    nodes: IReactFlowNode[]
    chatflowid: string
    appDataSource: DataSource
    componentNodes: IComponentNodes
    incomingInput: IncomingInput
    chatId: string
    isInternal: boolean
    isAgentFlow: boolean
}): Promise<IMessage[]> => {
    const prependMessages = incomingInput.history ?? []
    let chatHistory: IMessage[] = []

    if (isAgentFlow) {
        const startNode = nodes.find((node) => node.data.name === 'seqStart')
        if (!startNode?.data?.inputs?.agentMemory) return prependMessages

        const memoryNodeId = startNode.data.inputs.agentMemory.split('.')[0].replace('{{', '')
        const memoryNode = nodes.find((node) => node.data.id === memoryNodeId)

        if (memoryNode) {
            chatHistory = await getSessionChatHistory(
                chatflowid,
                getMemorySessionId(memoryNode, incomingInput, chatId, isInternal),
                memoryNode,
                componentNodes,
                appDataSource,
                databaseEntities,
                undefined,
                prependMessages
            )
        }
        return chatHistory
    }

    /* In case there are multiple ending nodes, get the memory from the last available ending node
     * By right, in each flow, there should only be one memory node
     */
    for (const endingNode of endingNodes) {
        const endingNodeData = endingNode.data
        if (!endingNodeData.inputs?.memory) continue

        const memoryNodeId = endingNodeData.inputs?.memory.split('.')[0].replace('{{', '')
        const memoryNode = nodes.find((node) => node.data.id === memoryNodeId)

        if (!memoryNode) continue

        chatHistory = await getSessionChatHistory(
            chatflowid,
            getMemorySessionId(memoryNode, incomingInput, chatId, isInternal),
            memoryNode,
            componentNodes,
            appDataSource,
            databaseEntities,
            undefined,
            prependMessages
        )
    }

    return chatHistory
}

/**
 * Show output of setVariable nodes
 * @param reactFlowNodes
 * @returns {Record<string, unknown>}
 */
const getSetVariableNodesOutput = (reactFlowNodes: IReactFlowNode[]) => {
    const flowVariables = {} as Record<string, unknown>
    for (const node of reactFlowNodes) {
        if (node.data.name === 'setVariable' && (node.data.inputs?.showOutput === true || node.data.inputs?.showOutput === 'true')) {
            const outputResult = node.data.instance
            const variableKey = node.data.inputs?.variableName
            flowVariables[variableKey] = outputResult
        }
    }
    return flowVariables
}

/*
 * Function to traverse the flow graph and execute the nodes
 */
export const executeFlow = async ({
    componentNodes,
    incomingInput,
    chatflow,
    chatId,
    appDataSource,
    cachePool,
    usageCacheManager,
    sseStreamer,
    baseURL,
    isInternal,
    files,
    signal,
    isTool,
    orgId,
    productId,
    userId
}: IExecuteFlowParams & { userId?: string }) => {
    // Ensure incomingInput has all required properties with default values
    incomingInput = {
        history: [],
        streaming: false,
        ...incomingInput
    }

    // Add userId to incomingInput so it can be used in agentflow execution
    if (userId) {
        ;(incomingInput as any).userId = userId
    }

    let question = incomingInput.question || '' // Ensure question is never undefined
    let overrideConfig = incomingInput.overrideConfig ?? {}
    const uploads = incomingInput.uploads
    const prependMessages = incomingInput.history ?? []
    const streaming = incomingInput.streaming ?? false
    const userMessageDateTime = new Date()
    const chatflowid = chatflow.guid
    const userIdNum = userId ? parseInt(userId) : undefined

    /* Process file uploads from the chat
     * - Images
     * - Files
     * - Audio
     */
    let fileUploads: IFileUpload[] = []
    let uploadedFilesContent = ''
    if (uploads) {
        fileUploads = uploads
        for (let i = 0; i < fileUploads.length; i += 1) {
            if (!orgId) {
                throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'orgId is required for file uploads')
            }
            await checkStorage(orgId, usageCacheManager)

            const upload = fileUploads[i]

            // if upload in an image, a rag file, or audio
            if ((upload.type === 'file' || upload.type === 'file:rag' || upload.type === 'audio') && upload.data) {
                const filename = upload.name
                const splitDataURI = upload.data.split(',')
                const bf = Buffer.from(splitDataURI.pop() || '', 'base64')
                const mime = splitDataURI[0].split(':')[1].split(';')[0]
                const { totalSize } = await addSingleFileToStorage(mime, bf, filename, orgId, chatflowid, chatId)
                await updateStorageUsage(orgId, totalSize, usageCacheManager)
                upload.type = 'stored-file'
                // Omit upload.data since we don't store the content in database
                fileUploads[i] = omit(upload, ['data'])
            }

            if (upload.type === 'url' && upload.data) {
                const filename = upload.name
                const urlData = upload.data
                fileUploads[i] = { data: urlData, name: filename, type: 'url', mime: upload.mime ?? 'image/png' }
            }

            // Run Speech to Text conversion
            if (upload.mime === 'audio/webm' || upload.mime === 'audio/mp4' || upload.mime === 'audio/ogg') {
                logDebug(`[server]: [${orgId}]: Attempting a speech to text conversion...`).catch(() => {})
                let speechToTextConfig: ICommonObject = {}
                if (chatflow.speechToText) {
                    const speechToTextProviders = JSON.parse(chatflow.speechToText)
                    for (const provider in speechToTextProviders) {
                        const providerObj = speechToTextProviders[provider]
                        if (providerObj.status) {
                            speechToTextConfig = providerObj
                            speechToTextConfig['name'] = provider
                            break
                        }
                    }
                }
                if (speechToTextConfig) {
                    if (!orgId) {
                        throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'orgId is required for speech to text')
                    }
                    const options: ICommonObject = {
                        chatId,
                        chatflowid,
                        appDataSource,
                        databaseEntities: databaseEntities
                    }
                    const speechToTextResult = await convertSpeechToText(upload, speechToTextConfig, options)
                    logDebug(`[server]: [${orgId}]: Speech to text result: ${speechToTextResult}`).catch(() => {})
                    if (speechToTextResult) {
                        incomingInput.question = speechToTextResult
                        question = speechToTextResult
                    }
                }
            }

            if (upload.type === 'file:full' && upload.data) {
                upload.type = 'stored-file:full'
                // Omit upload.data since we don't store the content in database
                uploadedFilesContent += `<doc name='${upload.name}'>${upload.data}</doc>\n\n`
                fileUploads[i] = omit(upload, ['data'])
            }
        }
    }

    // Process form data body with files
    if (files?.length) {
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'orgId is required for file uploads')
        }
        overrideConfig = { ...incomingInput }
        for (const file of files) {
            await checkStorage(orgId, usageCacheManager)

            const fileNames: string[] = []
            const fileBuffer = await getFileFromUpload(file.path ?? file.key)
            // Address file name with special characters: https://github.com/expressjs/multer/issues/1104
            file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
            const { path: storagePath, totalSize } = await addArrayFilesToStorage(
                file.mimetype,
                fileBuffer,
                file.originalname,
                fileNames,
                orgId,
                chatflowid
            )
            await updateStorageUsage(orgId, totalSize, usageCacheManager)

            const fileInputFieldFromMimeType = mapMimeTypeToInputField(file.mimetype)

            const fileExtension = path.extname(file.originalname)

            const fileInputFieldFromExt = mapExtToInputField(fileExtension)

            let fileInputField = 'txtFile'

            if (fileInputFieldFromExt !== 'txtFile') {
                fileInputField = fileInputFieldFromExt
            } else if (fileInputFieldFromMimeType !== 'txtFile') {
                fileInputField = fileInputFieldFromExt
            }

            if (overrideConfig[fileInputField]) {
                const existingFileInputField = overrideConfig[fileInputField].replace('FILE-STORAGE::', '')
                const existingFileInputFieldArray = JSON.parse(existingFileInputField)

                const newFileInputField = storagePath.replace('FILE-STORAGE::', '')
                const newFileInputFieldArray = JSON.parse(newFileInputField)

                const updatedFieldArray = existingFileInputFieldArray.concat(newFileInputFieldArray)

                overrideConfig[fileInputField] = `FILE-STORAGE::${JSON.stringify(updatedFieldArray)}`
            } else {
                overrideConfig[fileInputField] = storagePath
            }

            await removeSpecificFileFromUpload(file.path ?? file.key)
        }
        if (overrideConfig.vars && typeof overrideConfig.vars === 'string') {
            overrideConfig.vars = JSON.parse(overrideConfig.vars)
        }
        incomingInput = {
            ...incomingInput,
            overrideConfig,
            chatId
        }
    }

    const isAgentFlowV2 = chatflow.type === 'AGENTFLOW'
    if (isAgentFlowV2) {
        return executeAgentFlow({
            componentNodes,
            incomingInput,
            chatflow,
            chatId,
            appDataSource,
            cachePool,
            usageCacheManager,
            sseStreamer,
            baseURL,
            isInternal,
            uploadedFilesContent,
            fileUploads,
            signal,
            isTool,
            orgId,
            productId
        })
    }

    /*** Get chatflows and prepare data  ***/
    const flowData = chatflow.flowData
    const parsedFlowData: IReactFlowObject = JSON.parse(flowData)
    const nodes = parsedFlowData.nodes
    const edges = parsedFlowData.edges

    // Apply parent credentials to child flow nodes if available (for multi-agent flows via ExecuteFlow)
    if (overrideConfig._parentCredentials && typeof overrideConfig._parentCredentials === 'object') {
        const parentCredentials = overrideConfig._parentCredentials as Record<string, string>
        logDebug(`[server]: [${orgId}]: Applying ${Object.keys(parentCredentials).length} parent credentials to child flow`).catch(() => {})

        // Iterate through nodes and apply credentials if node doesn't have one set
        for (const node of nodes) {
            if (node.data && (!node.data.credential || node.data.credential === '')) {
                // Use first available credential from parent (simple approach)
                // In future, could match by node type for more sophisticated mapping
                const credentialIds = Object.values(parentCredentials).filter((id) => id && typeof id === 'string')
                if (credentialIds.length > 0) {
                    node.data.credential = credentialIds[0]
                    logDebug(`[server]: [${orgId}]: Applied credential to node ${node.data.label} (${node.data.id})`).catch(() => {})
                }
            }
        }

        // Clean up _parentCredentials from overrideConfig to avoid passing it further
        delete overrideConfig._parentCredentials
    }

    const apiMessageId = generateGuid() // Use 15-character GUID instead of UUID

    /*** Get session ID ***/
    const memoryNode = findMemoryNode(nodes, edges)
    const memoryType = memoryNode?.data.label || ''
    let sessionId = getMemorySessionId(memoryNode, incomingInput, chatId, isInternal)

    /*** Get Ending Node with Directed Graph  ***/
    const { graph, nodeDependencies } = constructGraphs(nodes, edges)
    const directedGraph = graph
    const endingNodes = getEndingNodes(nodeDependencies, directedGraph, nodes)

    /*** Get Starting Nodes with Reversed Graph ***/
    const constructedObj = constructGraphs(nodes, edges, { isReversed: true })
    const nonDirectedGraph = constructedObj.graph
    let startingNodeIds: string[] = []
    let depthQueue: IDepthQueue = {}
    const endingNodeIds = endingNodes.map((n) => n.id)
    for (const endingNodeId of endingNodeIds) {
        const resx = getStartingNodes(nonDirectedGraph, endingNodeId)
        startingNodeIds.push(...resx.startingNodeIds)
        depthQueue = Object.assign(depthQueue, resx.depthQueue)
    }
    startingNodeIds = [...new Set(startingNodeIds)]

    const isAgentFlow =
        endingNodes.filter((node) => node.data.category === 'Multi Agents' || node.data.category === 'Sequential Agents').length > 0

    /*** Get Chat History ***/
    const chatHistory = await getChatHistory({
        endingNodes,
        nodes,
        chatflowid,
        appDataSource,
        componentNodes,
        incomingInput,
        chatId,
        isInternal,
        isAgentFlow
    })

    /*** Get API Config ***/
    const availableVariables = await appDataSource.getRepository(Variable).findBy({})
    const { nodeOverrides, variableOverrides, apiOverrideStatus } = getAPIOverrideConfig(chatflow)

    const flowConfig: IFlowConfig = {
        chatflowid,
        chatflowId: chatflow.guid,
        chatId,
        sessionId,
        chatHistory,
        apiMessageId,
        ...incomingInput.overrideConfig
    }

    logDebug(`[server]: [${orgId}]: Start building flow ${chatflowid}`).catch(() => {})

    /*** BFS to traverse from Starting Nodes to Ending Node ***/
    const reactFlowNodes = await buildFlow({
        startingNodeIds,
        reactFlowNodes: nodes,
        reactFlowEdges: edges,
        apiMessageId,
        graph,
        depthQueue,
        componentNodes,
        question,
        uploadedFilesContent,
        chatHistory,
        chatId,
        sessionId,
        chatflowid,
        appDataSource,
        overrideConfig,
        apiOverrideStatus,
        nodeOverrides,
        availableVariables,
        variableOverrides,
        cachePool,
        usageCacheManager,
        isUpsert: false,
        uploads,
        baseURL,
        orgId,
        updateStorageUsage,
        checkStorage,
        userId,
        chatflowType: chatflow.type || 'CHATFLOW'
    })

    const setVariableNodesOutput = getSetVariableNodesOutput(reactFlowNodes)

    {
        let chatflowConfig: ICommonObject = {}
        if (chatflow.chatbotConfig) {
            chatflowConfig = JSON.parse(chatflow.chatbotConfig)
        }

        let isStreamValid = false

        /* Check for post-processing settings, if available isStreamValid is always false */
        if (chatflowConfig?.postProcessing?.enabled === true) {
            isStreamValid = false
        } else {
            isStreamValid = await checkIfStreamValid(endingNodes, nodes, streaming)
        }

        /*** Find the last node to execute ***/
        const { endingNodeData, endingNodeInstance } = await initEndingNode({
            endingNodeIds,
            componentNodes,
            reactFlowNodes,
            incomingInput,
            flowConfig,
            uploadedFilesContent,
            availableVariables,
            apiOverrideStatus,
            nodeOverrides,
            variableOverrides
        })

        /*** If user uploaded files from chat, prepend the content of the files ***/
        const finalQuestion = uploadedFilesContent ? `${uploadedFilesContent}\n\n${incomingInput.question}` : incomingInput.question

        /*** Prepare run params ***/
        const runParams = {
            orgId,
            chatId,
            chatflowid,
            apiMessageId,
            logger: undefined,
            appDataSource,
            databaseEntities,
            usageCacheManager,
            analytic: chatflow.analytic,
            uploads,
            prependMessages,
            ...(isStreamValid && { sseStreamer, shouldStreamResponse: isStreamValid }),
            updateStorageUsage,
            checkStorage
        }

        /*** Run the ending node ***/
        const startTime = Date.now()

        // TOON Integration
        // NOTE: TOON format is designed for structured data (JSON), not plain text
        // It will skip plain text inputs to avoid increasing token count
        // TOON is most effective for structured LLM outputs (JSON responses)
        let result
        if (process.env.ENABLE_TOON_FORMAT === 'true') {
            const { logInfo } = await import('../utils/logger/system-helper')
            const { toonPreProcess, toonPostProcess } = await import('../services/toon/toon-wrapper')

            const inputIsPlainText =
                typeof finalQuestion === 'string' && !finalQuestion.trim().startsWith('{') && !finalQuestion.trim().startsWith('[')
            logInfo(
                `[TOON] 🚀 TOON format enabled - Processing input (${finalQuestion.length} chars, ${
                    inputIsPlainText ? 'plain text' : 'possibly structured'
                })`
            ).catch(() => {})

            if (inputIsPlainText) {
                logInfo(
                    `[TOON] ℹ️ Input appears to be plain text - TOON will skip encoding (TOON only helps with structured JSON data)`
                ).catch(() => {})
            }

            // Pre-process input
            const toonInput =await toonPreProcess(finalQuestion)
            const inputChanged = toonInput !== finalQuestion
            logInfo(
                `[TOON] Pre-process complete - Input changed: ${inputChanged}, New length: ${
                    typeof toonInput === 'string' ? toonInput.length : 'N/A'
                }`
            ).catch(() => {})

            if (!inputChanged) {
                logInfo(
                    `[TOON] ℹ️ TOON skipped input encoding (plain text or not beneficial) - This is expected for plain text inputs`
                ).catch(() => {})
            }

            // Run node
            const rawResult = await endingNodeInstance.run(endingNodeData, toonInput, runParams)

            logInfo(
                `[TOON] Node execution complete - Result type: ${typeof rawResult}, Length: ${
                    typeof rawResult === 'string' ? rawResult.length : 'N/A'
                }`
            ).catch(() => {})

            // Post-process output
            result =await toonPostProcess(rawResult)

            logInfo(
                `[TOON] ✅ Post-process complete - Final result type: ${typeof result}, Length: ${
                    typeof result === 'string' ? result.length : 'N/A'
                }`
            ).catch(() => {})

            // Summary
            if (!inputChanged) {
                logInfo(
                    `[TOON] 📝 SUMMARY: TOON format is working correctly. It skipped plain text input to avoid increasing tokens. TOON only helps with structured JSON data, not plain text.`
                ).catch(() => {})
            }
        } else {
            result = await endingNodeInstance.run(endingNodeData, finalQuestion, runParams)
        }
        const endTime = Date.now()
        const processingTimeMs = endTime - startTime

        // Preserve original result for usage tracking (before converting to string)
        const originalResult = result
        result = typeof result === 'string' ? { text: result } : result

        /*** Retrieve threadId from OpenAI Assistant if exists ***/
        if (typeof result === 'object' && result.assistant) {
            sessionId = result.assistant.threadId
        }

        // Track LLM usage for chatflow if ending node uses LLM (Chat Models, Agents, etc.)
        // Check if node uses LLM - either Chat Models category or Agents category (which internally use LLMs)
        const isLLMNode =
            endingNodeData.category === 'Chat Models' ||
            endingNodeData.category === 'Agents' ||
            endingNodeData.category === 'Agent Flows' ||
            endingNodeData.name?.toLowerCase().includes('agent') ||
            endingNodeData.name?.toLowerCase().includes('llm') ||
            endingNodeData.name?.toLowerCase().includes('chat')

        if (isLLMNode && orgId) {
            try {
                const { trackLLMUsage, extractProviderAndModel, extractUsageMetadata } = await import('./llm-usage-tracker')

                const { provider, model } = extractProviderAndModel(endingNodeData, result)

                // Try to extract usage metadata from result
                // For chatflow, result might be simplified, so we need to check multiple locations
                // Agent nodes return { output: { usageMetadata: {...} } }
                // Direct LLM nodes might have usage_metadata, llmOutput, etc.
                if (process.env.DEBUG === 'true') {
                    logInfo(`[buildChatflow] Result keys: ${Object.keys(result)}`)
                    if (result.usageMetadata) logInfo(`[buildChatflow] result.usageMetadata: ${JSON.stringify(result.usageMetadata)}`)
                    if (result.output) logInfo(`[buildChatflow] result.output keys: ${Object.keys(result.output)}`)
                    if (result.llmOutput) logInfo(`[buildChatflow] result.llmOutput: ${JSON.stringify(result.llmOutput)}`)
                }
                let { promptTokens, completionTokens, totalTokens } = extractUsageMetadata(result)

                // For Agent nodes, usage metadata can be in multiple places:
                // 1. result.usageMetadata (ConversationalAgent format)
                // 2. result.output.usageMetadata (Agent_Agentflow format)
                // 3. originalResult.usageMetadata or originalResult.output.usageMetadata
                // Helper function to safely convert to number
                const toNumber = (value: any, defaultValue: number = 0): number => {
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
                
                if (totalTokens === 0) {
                    // Try result.usageMetadata first (ConversationalAgent format)
                    if (result?.usageMetadata) {
                        const agentUsage = result.usageMetadata
                        promptTokens = toNumber(agentUsage.input_tokens || agentUsage.prompt_tokens, 0)
                        completionTokens = toNumber(agentUsage.output_tokens || agentUsage.completion_tokens, 0)
                        totalTokens = toNumber(agentUsage.total_tokens, promptTokens + completionTokens)
                    }
                    // Try result.output.usageMetadata (Agent_Agentflow format)
                    else if (result?.output?.usageMetadata) {
                        const agentUsage = result.output.usageMetadata
                        promptTokens = toNumber(agentUsage.input_tokens || agentUsage.prompt_tokens, 0)
                        completionTokens = toNumber(agentUsage.output_tokens || agentUsage.completion_tokens, 0)
                        totalTokens = toNumber(agentUsage.total_tokens, promptTokens + completionTokens)
                    }
                    // Try originalResult.usageMetadata (in case result was modified)
                    else if (originalResult && typeof originalResult === 'object' && originalResult.usageMetadata) {
                        const agentUsage = originalResult.usageMetadata
                        promptTokens = toNumber(agentUsage.input_tokens || agentUsage.prompt_tokens, 0)
                        completionTokens = toNumber(agentUsage.output_tokens || agentUsage.completion_tokens, 0)
                        totalTokens = toNumber(agentUsage.total_tokens, promptTokens + completionTokens)
                    }
                    // Try originalResult.output.usageMetadata (in case result was modified)
                    else if (originalResult && typeof originalResult === 'object' && originalResult.output?.usageMetadata) {
                        const agentUsage = originalResult.output.usageMetadata
                        promptTokens = toNumber(agentUsage.input_tokens || agentUsage.prompt_tokens, 0)
                        completionTokens = toNumber(agentUsage.output_tokens || agentUsage.completion_tokens, 0)
                        totalTokens = toNumber(agentUsage.total_tokens, promptTokens + completionTokens)
                    }
                    // Try extractUsageMetadata on originalResult (might have other formats)
                    else if (originalResult && typeof originalResult === 'object' && originalResult !== result) {
                        const originalResultUsage = extractUsageMetadata(originalResult)
                        if (originalResultUsage.totalTokens > 0) {
                            promptTokens = originalResultUsage.promptTokens
                            completionTokens = originalResultUsage.completionTokens
                            totalTokens = originalResultUsage.totalTokens
                        }
                    }
                }

                // If still 0, try to get from endingNodeData if it has the original response
                if (totalTokens === 0 && endingNodeData?.outputs?.response) {
                    const responseResult = extractUsageMetadata(endingNodeData.outputs.response)
                    if (responseResult.totalTokens > 0) {
                        promptTokens = responseResult.promptTokens
                    }
                }

                // Usage is now tracked via UsageTrackingCallbackHandler injected in buildFlow
            } catch (error: any) {
                // Silently fail - tracking should not break the main flow
            }
        }

        const userIdNum = userId ? parseInt(userId) : undefined
        const userMessage: Omit<IChatMessage, 'guid' | 'id'> = {
            role: 'userMessage',
            content: question,
            chatflowid,
            chatType: isInternal ? ChatType.INTERNAL : ChatType.EXTERNAL,
            chatId,
            memoryType,
            sessionId,
            created_on: userMessageDateTime.getTime(),
            created_by: userIdNum || 0,
            fileUploads: uploads ? JSON.stringify(fileUploads) : undefined
        }
        await utilAddChatMessage(userMessage, appDataSource, orgId!, userIdNum)

        // Log chatflow execution start
        if (orgId) {
            await chatflowLog('info', 'Chatflow execution started', {
                userId: userId || 'anonymous',
                orgId,
                chatflowId: chatflowid,
                chatId,
                sessionId,
                questionLength: question.length,
                hasFiles: files && files.length > 0,
                isInternal
            }).catch(() => {}) // Don't fail if logging fails

            // Also log to assistant service group if this is an assistant query
            if (chatflow.type === 'ASSISTANT') {
                try {
                    const { assistantLog } = await import('./logger/module-methods')
                    await assistantLog('info', 'Assistant query started', {
                        userId: userId || 'anonymous',
                        orgId,
                        assistantId: chatflowid, // For assistants, chatflowId is the assistantId
                        chatflowId: chatflowid,
                        chatId,
                        sessionId,
                        questionLength: question.length,
                        hasFiles: files && files.length > 0,
                        isInternal
                    }).catch(() => {}) // Don't fail if logging fails
                } catch (logError) {
                    // Silently fail - logging should not break execution
                }
            }
        }

        // Update chat session after user message (if userId available)
        if (userId && orgId && chatId) {
            try {
                await chatSessionsService.updateChatSessionOnMessage(chatflowid, chatId, orgId, userId, question || '', 'user')
            } catch (error) {
                // Log but don't fail if session update fails
                logDebug(`[server]: Failed to update chat session: ${getErrorMessage(error)}`).catch(() => {})
            }
        }

        let resultText = ''
        if (result.text) {
            resultText = result.text
            /* Check for post-processing settings */
            if (chatflowConfig?.postProcessing?.enabled === true) {
                try {
                    const postProcessingFunction = JSON.parse(chatflowConfig?.postProcessing?.customFunction)
                    const nodeInstanceFilePath = componentNodes['customFunction'].filePath as string
                    const nodeModule = await import(nodeInstanceFilePath)
                    //set the outputs.output to EndingNode to prevent json escaping of content...
                    const nodeData = {
                        inputs: { javascriptFunction: postProcessingFunction },
                        outputs: { output: 'output' }
                    }
                    const options: ICommonObject = {
                        chatflowid: chatflow.guid,
                        sessionId,
                        chatId,
                        input: question,
                        postProcessing: {
                            rawOutput: resultText,
                            chatHistory: cloneDeep(prependMessages),
                            sourceDocuments: result?.sourceDocuments ? cloneDeep(result.sourceDocuments) : undefined,
                            usedTools: result?.usedTools ? cloneDeep(result.usedTools) : undefined,
                            artifacts: result?.artifacts ? cloneDeep(result.artifacts) : undefined,
                            fileAnnotations: result?.fileAnnotations ? cloneDeep(result.fileAnnotations) : undefined
                        },
                        appDataSource,
                        databaseEntities,
                        orgId,
                        logger: undefined
                    }
                    const customFuncNodeInstance = new nodeModule.nodeClass()
                    let moderatedResponse = await customFuncNodeInstance.init(nodeData, question, options)
                    if (typeof moderatedResponse === 'string') {
                        result.text = handleEscapeCharacters(moderatedResponse, true)
                    } else if (typeof moderatedResponse === 'object') {
                        result.text = '```json\n' + JSON.stringify(moderatedResponse, null, 2) + '\n```'
                    } else {
                        result.text = moderatedResponse
                    }
                    resultText = result.text
                } catch (e) {
                    logError('[server]: Post Processing Error:', e).catch(() => {})
                }
            }
        } else if (result.json) resultText = '```json\n' + JSON.stringify(result.json, null, 2)
        else resultText = JSON.stringify(result, null, 2)

        const apiMessage: Partial<IChatMessage> = {
            guid: apiMessageId,
            role: 'apiMessage',
            content: resultText,
            chatflowid,
            chatType: isInternal ? ChatType.INTERNAL : ChatType.EXTERNAL,
            chatId,
            memoryType,
            sessionId,
            created_on: Date.now(),
            created_by: userIdNum || 0
        }
        if (result?.sourceDocuments) apiMessage.sourceDocuments = JSON.stringify(result.sourceDocuments)
        if (result?.usedTools) apiMessage.usedTools = JSON.stringify(result.usedTools)
        if (result?.fileAnnotations) apiMessage.fileAnnotations = JSON.stringify(result.fileAnnotations)
        if (result?.artifacts) apiMessage.artifacts = JSON.stringify(result.artifacts)
        if (chatflow.followUpPrompts) {
            const followUpPromptsConfig = JSON.parse(chatflow.followUpPrompts)
            const followUpPrompts = await generateFollowUpPrompts(followUpPromptsConfig, apiMessage.content || '', {
                chatId: chatId || '',
                chatflowid: chatflowid || '',
                appDataSource,
                databaseEntities
            })
            if (followUpPrompts?.questions) {
                apiMessage.followUpPrompts = JSON.stringify(followUpPrompts.questions)
            }
        }

        const chatMessage = await utilAddChatMessage(apiMessage, appDataSource, orgId!, userIdNum)

        // Log chatflow execution completion
        if (orgId) {
            await chatflowLog('info', 'Chatflow execution completed', {
                userId: userId || 'anonymous',
                orgId,
                chatflowId: chatflowid,
                chatId,
                sessionId,
                responseLength: resultText.length,
                hasSourceDocuments: !!result?.sourceDocuments,
                hasUsedTools: !!result?.usedTools,
                executionTime: Date.now() - userMessageDateTime.getTime()
            }).catch(() => {}) // Don't fail if logging fails

            // Also log to assistant service group if this is an assistant query
            if (chatflow.type === 'ASSISTANT') {
                try {
                    const { assistantLog } = await import('./logger/module-methods')
                    await assistantLog('info', 'Assistant query completed', {
                        userId: userId || 'anonymous',
                        orgId,
                        assistantId: chatflowid, // For assistants, chatflowId is the assistantId
                        chatflowId: chatflowid,
                        chatId,
                        sessionId,
                        responseLength: resultText.length,
                        hasSourceDocuments: !!result?.sourceDocuments,
                        hasUsedTools: !!result?.usedTools,
                        executionTime: Date.now() - userMessageDateTime.getTime()
                    }).catch(() => {}) // Don't fail if logging fails
                } catch (logError) {
                    // Silently fail - logging should not break execution
                }
            }
        }

        // Update chat session after api message (if userId available)
        if (userId && orgId && chatId) {
            try {
                await chatSessionsService.updateChatSessionOnMessage(chatflowid, chatId, orgId, userId, resultText || '', 'api')
            } catch (error) {
                // Log but don't fail if session update fails
                logDebug(`[server]: Failed to update chat session: ${getErrorMessage(error)}`).catch(() => {})
            }
        }

        logDebug(`[server]: [${orgId}]: Finished running ${endingNodeData.label} (${endingNodeData.id})`).catch(() => {})
        // Telemetry removed

        /*** Prepare response ***/
        result.question = incomingInput.question // return the question in the response, this is used when input text is empty but question is in audio format
        result.chatId = chatId
        result.chatMessageId = chatMessage?.guid
        result.followUpPrompts = JSON.stringify(apiMessage.followUpPrompts)
        result.isStreamValid = isStreamValid

        if (sessionId) result.sessionId = sessionId
        if (memoryType) result.memoryType = memoryType
        if (Object.keys(setVariableNodesOutput).length) result.flowVariables = setVariableNodesOutput

        if (shouldAutoPlayTTS(chatflow.textToSpeech) && result.text) {
            const options = {
                orgId,
                chatflowid,
                chatId,
                appDataSource,
                databaseEntities
            }
            await generateTTSForResponseStream(result.text, chatflow.textToSpeech, options, chatId, chatMessage?.guid, sseStreamer, signal)
        }

        return result
    }
}

/**
 * Function to check if the flow is valid for streaming
 * @param {IReactFlowNode[]} endingNodes
 * @param {IReactFlowNode[]} nodes
 * @param {boolean | string} streaming
 * @returns {boolean}
 */
const checkIfStreamValid = async (
    endingNodes: IReactFlowNode[],
    nodes: IReactFlowNode[],
    streaming: boolean | string | undefined
): Promise<boolean> => {
    // If streaming is undefined, set to false by default
    if (streaming === undefined) {
        streaming = false
    }

    // Once custom function ending node exists, flow is always unavailable to stream
    const isCustomFunctionEndingNode = endingNodes.some((node) => node.data?.outputs?.output === 'EndingNode')
    if (isCustomFunctionEndingNode) return false

    let isStreamValid = false
    for (const endingNode of endingNodes) {
        const endingNodeData = endingNode.data || {} // Ensure endingNodeData is never undefined

        const isEndingNode = endingNodeData?.outputs?.output === 'EndingNode'

        // Once custom function ending node exists, no need to do follow-up checks.
        if (isEndingNode) continue

        if (
            endingNodeData.outputs &&
            Object.keys(endingNodeData.outputs).length &&
            !Object.values(endingNodeData.outputs ?? {}).includes(endingNodeData.name)
        ) {
            throw new InternalAutonomousError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Output of ${endingNodeData.label} (${endingNodeData.id}) must be ${endingNodeData.label}, can't be an Output Prediction`
            )
        }

        isStreamValid = isFlowValidForStream(nodes, endingNodeData)
    }

    isStreamValid = (streaming === 'true' || streaming === true) && isStreamValid

    return isStreamValid
}

/**
 * Build/Data Preparation for execute function
 * @param {Request} req
 * @param {boolean} isInternal
 */
export const utilBuildChatflow = async (req: Request, isInternal: boolean = false): Promise<any> => {
    const appServer = getRunningExpressApp()
    const { getDataSource } = await import('../DataSource')

    const chatflowid = req.params.id

    // Require orgId upfront - no cross-org search
    // Get orgId from request object (set by session validation middleware) - single source
    const authReq = req as any
    const orgId: string | undefined = authReq.orgId
    if (!orgId) {
        throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
    }

    // Get org-specific DataSource from pool
    const orgDataSource = getDataSource(parseInt(orgId))

    // Get chatflow from org-specific database
    const chatflow = await orgDataSource.getRepository(ChatFlow).findOneBy({
        guid: chatflowid
    })

    if (!chatflow) {
        throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowid} not found`)
    }

    const organizationId: string = orgId

    const isAgentFlow = chatflow.type === 'AGENTFLOW'
    const httpProtocol = req.get('x-forwarded-proto') || req.protocol
    const baseURL = `${httpProtocol}://${req.get('host')}`
    const incomingInput: IncomingInput = req.body || {} // Ensure incomingInput is never undefined
    let chatId = incomingInput.chatId ?? incomingInput.overrideConfig?.sessionId
    const files = (req.files as Express.Multer.File[]) || []
    const abortControllerId = `${chatflow.guid}_${chatId || 'temp'}`
    const isTool = req.get('autonomous-tool') === 'true'

    try {
        // Validate API Key if its external API request
        if (!isInternal) {
            const isKeyValidated = await validateFlowAPIKey(req, chatflow, orgId)
            if (!isKeyValidated) {
                throw new InternalAutonomousError(StatusCodes.UNAUTHORIZED, `Unauthorized`)
            }
        }

        // Get userId from request if available (for authenticated requests)
        // For tool requests, check x-user-id header; otherwise use session userId
        const authReq = req as any
        const userId = authReq.userId || authReq.user?.userId || (req.headers['x-user-id'] as string | undefined)

        // Add userId to incomingInput so it can be used in agentflow execution
        if (userId) {
            ;(incomingInput as any).userId = userId
        }

        // Ensure chat session exists (create if not exists)
        if (chatId && userId) {
            // If chatId provided and user is authenticated, ensure session exists
            // Note: If chatId belongs to another user, a new chatId will be generated
            const session = await chatSessionsService.ensureChatSessionExists(chatId, chatflowid, orgId, userId)
            // Update chatId in case a new one was generated (for user isolation)
            if (session.chatId !== chatId) {
                chatId = session.chatId
                incomingInput.chatId = chatId
                req.body.chatId = chatId
            }
        } else if (userId) {
            // If no chatId but user is authenticated, create new session
            const newSession = await chatSessionsService.createChatSession(chatflowid, orgId, userId)
            chatId = newSession.chatId
            incomingInput.chatId = chatId
            req.body.chatId = chatId
        } else {
            // For unauthenticated/public API, generate chatId but don't create session
            if (!chatId) {
                chatId = uuidv4()
                incomingInput.chatId = chatId
                req.body.chatId = chatId
            }
        }
        // Product ID not needed for autonomous server
        const productId = ''

        await checkPredictions(orgId, appServer.usageCacheManager)

        const executeData: IExecuteFlowParams = {
            incomingInput, // Use the defensively created incomingInput variable
            chatflow,
            chatId,
            baseURL,
            isInternal,
            files,
            appDataSource: orgDataSource,
            sseStreamer: appServer.sseStreamer,
            cachePool: appServer.cachePool,
            componentNodes: appServer.nodesPool.componentNodes,
            isTool, // used to disable streaming if incoming request its from ChatflowTool
            usageCacheManager: appServer.usageCacheManager,
            orgId,
            productId,
            userId // Add userId to executeData for chat session updates
        } as any

        if (process.env.MODE === MODE.QUEUE) {
            if (!orgId) {
                throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, `orgId is required for queue mode`)
            }
            const orgIdNum = parseInt(orgId)
            if (isNaN(orgIdNum)) {
                throw new InternalAutonomousError(
                    StatusCodes.BAD_REQUEST,
                    `Invalid organization ID: ${orgId}. orgId must be a valid number.`
                )
            }
            const predictionQueue = appServer.queueManager.getQueue(orgIdNum, 'prediction')
            const job = await predictionQueue.addJob(omit(executeData, OMIT_QUEUE_JOB_DATA))
            logDebug(`[server]: [${orgId}/${chatflow.guid}/${chatId}]: Job added to queue: ${job.id}`).catch(() => {})

            const queueEvents = predictionQueue.getQueueEvents()
            const result = await job.waitUntilFinished(queueEvents)
            appServer.abortControllerPool.remove(abortControllerId)
            if (!result) {
                throw new Error('Job execution failed')
            }
            await updatePredictionsUsage(orgId, '', appServer.usageCacheManager)
            incrementSuccessMetricCounter(appServer.metricsProvider, isInternal, isAgentFlow)
            return result
        } else {
            // Add abort controller to the pool
            const signal = new AbortController()
            appServer.abortControllerPool.add(abortControllerId, signal)
            executeData.signal = signal

            const result = await executeFlow(executeData)

            appServer.abortControllerPool.remove(abortControllerId)
            await updatePredictionsUsage(orgId, '', appServer.usageCacheManager)
            incrementSuccessMetricCounter(appServer.metricsProvider, isInternal, isAgentFlow)
            return result
        }
    } catch (e) {
        logError(`[server]:${organizationId}/${chatflow.guid}/${chatId} Error:`, e).catch(() => {})
        appServer.abortControllerPool.remove(`${chatflow.guid}_${chatId}`)
        incrementFailedMetricCounter(appServer.metricsProvider, isInternal, isAgentFlow)
        if (e instanceof InternalAutonomousError && e.statusCode === StatusCodes.UNAUTHORIZED) {
            throw e
        } else {
            // Sanitize error message for frontend (full error already logged above)
            const sanitizedMessage = sanitizeErrorMessage(e, logError)
            throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, sanitizedMessage)
        }
    }
}

/**
 * Increment success metric counter
 * @param {IMetricsProvider} metricsProvider
 * @param {boolean} isInternal
 * @param {boolean} isAgentFlow
 */
const incrementSuccessMetricCounter = (metricsProvider: IMetricsProvider, isInternal: boolean, isAgentFlow: boolean) => {
    if (isAgentFlow) {
        metricsProvider?.incrementCounter(
            isInternal
                ? AUTONOMOUS_METRIC_COUNTERS.AGENTFLOW_PREDICTION_INTERNAL
                : AUTONOMOUS_METRIC_COUNTERS.AGENTFLOW_PREDICTION_EXTERNAL,
            { status: AUTONOMOUS_COUNTER_STATUS.SUCCESS }
        )
    } else {
        metricsProvider?.incrementCounter(
            isInternal ? AUTONOMOUS_METRIC_COUNTERS.CHATFLOW_PREDICTION_INTERNAL : AUTONOMOUS_METRIC_COUNTERS.CHATFLOW_PREDICTION_EXTERNAL,
            { status: AUTONOMOUS_COUNTER_STATUS.SUCCESS }
        )
    }
}

/**
 * Increment failed metric counter
 * @param {IMetricsProvider} metricsProvider
 * @param {boolean} isInternal
 * @param {boolean} isAgentFlow
 */
const incrementFailedMetricCounter = (metricsProvider: IMetricsProvider, isInternal: boolean, isAgentFlow: boolean) => {
    if (isAgentFlow) {
        metricsProvider?.incrementCounter(
            isInternal
                ? AUTONOMOUS_METRIC_COUNTERS.AGENTFLOW_PREDICTION_INTERNAL
                : AUTONOMOUS_METRIC_COUNTERS.AGENTFLOW_PREDICTION_EXTERNAL,
            { status: AUTONOMOUS_COUNTER_STATUS.FAILURE }
        )
    } else {
        metricsProvider?.incrementCounter(
            isInternal ? AUTONOMOUS_METRIC_COUNTERS.CHATFLOW_PREDICTION_INTERNAL : AUTONOMOUS_METRIC_COUNTERS.CHATFLOW_PREDICTION_EXTERNAL,
            { status: AUTONOMOUS_COUNTER_STATUS.FAILURE }
        )
    }
}

export { shouldAutoPlayTTS, generateTTSForResponseStream }
