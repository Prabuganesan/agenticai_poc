import { flatten } from 'lodash'
import { Tool } from '@langchain/core/tools'
import { BaseMessage } from '@langchain/core/messages'
import { ChainValues } from '@langchain/core/utils/types'
import { RunnableSequence } from '@langchain/core/runnables'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { BaseRetriever } from '@langchain/core/retrievers'
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager'
import { ChatPromptTemplate, MessagesPlaceholder, HumanMessagePromptTemplate, PromptTemplate } from '@langchain/core/prompts'
import { formatToOpenAIToolMessages } from 'langchain/agents/format_scratchpad/openai_tools'
import { type ToolsAgentStep } from 'langchain/agents/openai/output_parser'
import { DataSource } from 'typeorm'
import {
    extractOutputFromArray,
    getBaseClasses,
    handleEscapeCharacters,
    removeInvalidImageMarkdown,
    transformBracesWithColon
} from '../../../src/utils'
import { getErrorMessage } from '../../../src/error'
import {
    KodivianMemory,
    ICommonObject,
    INode,
    INodeData,
    INodeParams,
    IServerSideEventStreamer,
    IUsedTool,
    IVisionChatModal,
    IDatabaseEntity
} from '../../../src/Interface'
import { ConsoleCallbackHandler, CustomChainHandler, CustomStreamingHandler, additionalCallbacks } from '../../../src/handler'
import { AgentExecutor, ToolCallingAgentOutputParser } from '../../../src/agents'
import { Moderation, checkInputs, streamResponse } from '../../moderation/Moderation'
import { formatResponse } from '../../outputparsers/OutputParserHelpers'
import { addImagesToMessages, llmSupportsVision } from '../../../src/multiModalUtils'
import path from 'path'

const SOURCE_DOCUMENTS_PREFIX = '\n\n----KODIVIAN_SOURCE_DOCUMENTS----\n\n'

/**
 * Retriever Tool Implementation (replaces removed RetrieverTool node)
 * This allows document stores to be used as tools by the agent
 */
class RetrieverToolImpl extends Tool {
    name: string
    description: string
    retriever: BaseRetriever
    returnSourceDocuments: boolean

    constructor(name: string, description: string, retriever: BaseRetriever, returnSourceDocuments: boolean = false) {
        super()
        this.name = name
        this.description = description
        this.retriever = retriever
        this.returnSourceDocuments = returnSourceDocuments
    }

    async _call(input: string, runManager?: CallbackManagerForToolRun, options?: ICommonObject): Promise<string> {
        const parsed = typeof input === 'string' ? (input.startsWith('{') ? JSON.parse(input || '{}') : { input }) : input
        const query = parsed.input || input

        console.log('[RetrieverTool] Document store query started:', {
            toolName: this.name,
            query: typeof query === 'string' ? query.substring(0, 200) : JSON.stringify(query).substring(0, 200),
            returnSourceDocuments: this.returnSourceDocuments,
            orgId: options?.orgId || 'unknown',
            chatflowId: options?.chatflowid || 'unknown'
        })

        const startTime = Date.now()
        let docs: any[] = []
        try {
            docs = await this.retriever.invoke(query)
            const executionTime = Date.now() - startTime

            console.log('[RetrieverTool] Document store query completed:', {
                toolName: this.name,
                query: typeof query === 'string' ? query.substring(0, 200) : JSON.stringify(query).substring(0, 200),
                documentCount: docs.length,
                executionTimeMs: executionTime,
                orgId: options?.orgId || 'unknown',
                chatflowId: options?.chatflowid || 'unknown',
                documentPreviews: docs.slice(0, 3).map((doc: any) => ({
                    contentLength: doc.pageContent?.length || 0,
                    contentPreview: doc.pageContent?.substring(0, 100) || 'N/A',
                    metadata: doc.metadata || {}
                }))
            })

            const content = docs.map((doc) => doc.pageContent).join('\n\n')
            const sourceDocuments = JSON.stringify(docs)
            const result = this.returnSourceDocuments ? content + SOURCE_DOCUMENTS_PREFIX + sourceDocuments : content

            console.log('[RetrieverTool] Document store result prepared:', {
                toolName: this.name,
                resultLength: result.length,
                hasSourceDocuments: this.returnSourceDocuments,
                resultPreview: result.substring(0, 300),
                orgId: options?.orgId || 'unknown',
                chatflowId: options?.chatflowid || 'unknown'
            })

            return result
        } catch (error) {
            const executionTime = Date.now() - startTime
            console.error('[RetrieverTool] Document store query failed:', {
                toolName: this.name,
                query: typeof query === 'string' ? query.substring(0, 200) : JSON.stringify(query).substring(0, 200),
                error: getErrorMessage(error),
                errorStack: error instanceof Error ? error.stack : undefined,
                executionTimeMs: executionTime,
                orgId: options?.orgId || 'unknown',
                chatflowId: options?.chatflowid || 'unknown'
            })
            throw error
        }
    }
}

/**
 * Creates a retriever tool from a BaseRetriever (replaces removed RetrieverTool node)
 */
function createRetrieverTool(name: string, description: string, retriever: BaseRetriever, returnSourceDocuments: boolean = false): Tool {
    return new RetrieverToolImpl(name, description, retriever, returnSourceDocuments)
}

class ToolAgent_Agents implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    inputs: INodeParams[]
    sessionId?: string

    constructor(fields?: { sessionId?: string }) {
        this.label = 'Tool Agent'
        this.name = 'toolAgent'
        this.version = 2.0
        this.type = 'AgentExecutor'
        this.category = 'Agents'
        this.icon = 'toolAgent.png'
        this.description = `Agent that uses Function Calling to pick the tools and args to call`
        this.baseClasses = [this.type, ...getBaseClasses(AgentExecutor)]
        this.inputs = [
            {
                label: 'Tools',
                name: 'tools',
                type: 'Tool',
                list: true
            },
            {
                label: 'Memory',
                name: 'memory',
                type: 'BaseChatMemory'
            },
            {
                label: 'Tool Calling Chat Model',
                name: 'model',
                type: 'BaseChatModel',
                description:
                    'Only compatible with models that are capable of function calling: ChatOpenAI, ChatMistral, ChatAnthropic, ChatGoogleGenerativeAI, ChatVertexAI, GroqChat'
            },
            {
                label: 'Chat Prompt Template',
                name: 'chatPromptTemplate',
                type: 'ChatPromptTemplate',
                description: 'Override existing prompt with Chat Prompt Template. Human Message must includes {input} variable',
                optional: true
            },
            {
                label: 'System Message',
                name: 'systemMessage',
                type: 'string',
                default: `You are a helpful AI assistant.`,
                description: 'If Chat Prompt Template is provided, this will be ignored',
                rows: 4,
                optional: true,
                additionalParams: true
            },
            {
                label: 'Input Moderation',
                description: 'Detect text that could generate harmful output and prevent it from being sent to the language model',
                name: 'inputModeration',
                type: 'Moderation',
                optional: true,
                list: true
            },
            {
                label: 'Max Iterations',
                name: 'maxIterations',
                type: 'number',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Enable Detailed Streaming',
                name: 'enableDetailedStreaming',
                type: 'boolean',
                default: false,
                description: 'Stream detailed intermediate steps during agent execution',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Knowledge (Document Stores)',
                name: 'documentStores',
                type: 'array',
                description: 'Connect document stores to provide knowledge to the agent',
                optional: true,
                array: [
                    {
                        label: 'Document Store',
                        name: 'documentStore',
                        type: 'asyncOptions',
                        loadMethod: 'listStores'
                    },
                    {
                        label: 'Description',
                        name: 'docStoreDescription',
                        type: 'string',
                        description: 'Description of what the document store contains (helps the agent decide when to use it)',
                        rows: 3,
                        placeholder: 'Contains company leave policies and procedures'
                    },
                    {
                        label: 'Return Source Documents',
                        name: 'returnSourceDocuments',
                        type: 'boolean',
                        description: 'Return source documents in the response',
                        optional: true
                    }
                ]
            }
        ]
        this.sessionId = fields?.sessionId
    }

    //@ts-ignore
    loadMethods = {
        async listStores(_: INodeData, options: ICommonObject): Promise<any[]> {
            const returnData: any[] = []

            const appDataSource = options.appDataSource as DataSource
            const databaseEntities = options.databaseEntities as IDatabaseEntity

            if (appDataSource === undefined || !appDataSource) {
                return returnData
            }

            const searchOptions = options.searchOptions || {}
            const stores = await appDataSource.getRepository(databaseEntities['DocumentStore']).findBy(searchOptions)
            for (const store of stores) {
                if (store.status === 'UPSERTED') {
                    const obj = {
                        name: `${store.id}:${store.name}`,
                        label: store.name,
                        description: store.description
                    }
                    returnData.push(obj)
                }
            }
            return returnData
        }
    }

    private executor: any = null

    async init(nodeData: INodeData, input: string, options: ICommonObject): Promise<any> {
        // Create executor once in init and cache it
        if (!this.executor) {
            this.executor = await prepareAgent(nodeData, options, { sessionId: this.sessionId, chatId: options.chatId, input })
        }
        return this.executor
    }

    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<string | ICommonObject> {
        const memory = nodeData.inputs?.memory as KodivianMemory
        const moderations = nodeData.inputs?.inputModeration as Moderation[]
        const enableDetailedStreaming = nodeData.inputs?.enableDetailedStreaming as boolean

        const shouldStreamResponse = options.shouldStreamResponse
        const sseStreamer: IServerSideEventStreamer = options.sseStreamer as IServerSideEventStreamer
        const chatId = options.chatId

        if (moderations && moderations.length > 0) {
            try {
                // Use the output of the moderation chain as input for the OpenAI Function Agent
                input = await checkInputs(moderations, input)
            } catch (e) {
                await new Promise((resolve) => setTimeout(resolve, 500))
                if (shouldStreamResponse) {
                    streamResponse(sseStreamer, chatId, e.message)
                }
                return formatResponse(e.message)
            }
        }

        // Use cached executor from init, or create new one if not available
        let executor = this.executor
        if (!executor) {
            executor = await prepareAgent(nodeData, options, { sessionId: this.sessionId, chatId: options.chatId, input })
            this.executor = executor
        }

        const loggerHandler = new ConsoleCallbackHandler(options.logger, options?.orgId)
        const callbacks = await additionalCallbacks(nodeData, options)

        // Add custom streaming handler if detailed streaming is enabled
        let customStreamingHandler = null

        if (enableDetailedStreaming && shouldStreamResponse) {
            customStreamingHandler = new CustomStreamingHandler(sseStreamer, chatId)
        }

        let res: ChainValues = {}
        let sourceDocuments: ICommonObject[] = []
        let usedTools: IUsedTool[] = []
        let artifacts = []

        // Track start time BEFORE LLM execution
        const startTime = Date.now()

        if (shouldStreamResponse) {
            const handler = new CustomChainHandler(sseStreamer, chatId)
            const allCallbacks = [loggerHandler, handler, ...callbacks]

            // Add detailed streaming handler if enabled
            if (enableDetailedStreaming && customStreamingHandler) {
                allCallbacks.push(customStreamingHandler)
            }

            res = await executor.invoke({ input }, { callbacks: allCallbacks })
            if (res.sourceDocuments) {
                if (sseStreamer) {
                    sseStreamer.streamSourceDocumentsEvent(chatId, flatten(res.sourceDocuments))
                }
                sourceDocuments = res.sourceDocuments
            }
            if (res.usedTools) {
                if (sseStreamer) {
                    sseStreamer.streamUsedToolsEvent(chatId, flatten(res.usedTools))
                }
                usedTools = res.usedTools
            }
            if (res.artifacts) {
                if (sseStreamer) {
                    sseStreamer.streamArtifactsEvent(chatId, flatten(res.artifacts))
                }
                artifacts = res.artifacts
            }
            // If the tool is set to returnDirect, stream the output to the client
            if (res.usedTools && res.usedTools.length) {
                let inputTools = nodeData.inputs?.tools
                inputTools = flatten(inputTools)
                for (const tool of res.usedTools) {
                    const inputTool = inputTools.find((inputTool: Tool) => inputTool.name === tool.tool)
                    if (inputTool && inputTool.returnDirect && shouldStreamResponse) {
                        sseStreamer.streamTokenEvent(chatId, tool.toolOutput)
                    }
                }
            }
        } else {
            const allCallbacks = [loggerHandler, ...callbacks]

            // Add detailed streaming handler if enabled
            if (enableDetailedStreaming && customStreamingHandler) {
                allCallbacks.push(customStreamingHandler)
            }

            res = await executor.invoke({ input }, { callbacks: allCallbacks })
            if (res.sourceDocuments) {
                sourceDocuments = res.sourceDocuments
            }
            if (res.usedTools) {
                usedTools = res.usedTools
            }
            if (res.artifacts) {
                artifacts = res.artifacts
            }
        }

        // Track end time AFTER LLM execution
        const endTime = Date.now()
        const timeDelta = endTime - startTime

        let output = res?.output
        output = extractOutputFromArray(res?.output)
        output = removeInvalidImageMarkdown(output)

        // Claude 3 Opus tends to spit out <thinking>..</thinking> as well, discard that in final output
        // https://docs.anthropic.com/en/docs/build-with-claude/tool-use#chain-of-thought
        const regexPattern: RegExp = /<thinking>[\s\S]*?<\/thinking>/
        const matches: RegExpMatchArray | null = output.match(regexPattern)
        if (matches) {
            for (const match of matches) {
                output = output.replace(match, '')
            }
        }

        await memory.addChatMessages(
            [
                {
                    text: input,
                    type: 'userMessage'
                },
                {
                    text: output,
                    type: 'apiMessage'
                }
            ],
            this.sessionId
        )

        // Track LLM usage
        try {
            if (options.orgId && res) {
                // Dynamic import from server package
                const llmUsageTrackerPath = path.resolve(__dirname, '../../../../server/src/utils/llm-usage-tracker')
                const { trackLLMUsage, extractProviderAndModel, extractUsageMetadata } = await import(llmUsageTrackerPath)

                // Get model from nodeData
                const model = nodeData.inputs?.model as BaseChatModel
                const { provider, model: modelName } = extractProviderAndModel(nodeData, { model })

                // Extract usage metadata from result
                const { promptTokens, completionTokens, totalTokens } = extractUsageMetadata(res)

                await trackLLMUsage({
                    requestId: (options.apiMessageId as string) || (options.chatId as string),
                    executionId: options.parentExecutionId as string,
                    orgId: (options.orgId as string) || '',
                    userId: (options.incomingInput?.userId as string) || (options.userId as string) || '0',
                    chatflowId: options.chatflowid as string,
                    chatId: options.chatId as string,
                    sessionId: options.sessionId as string,
                    feature: 'chatflow',
                    nodeId: nodeData.id,
                    nodeType: 'AgentExecutor',
                    nodeName: 'ToolAgent',
                    location: 'main_flow',
                    provider,
                    model: modelName,
                    requestType: 'chat',
                    promptTokens: promptTokens || 0,
                    completionTokens: completionTokens || 0,
                    totalTokens: totalTokens || 0,
                    processingTimeMs: timeDelta,
                    responseLength: output?.length || 0,
                    success: true,
                    cacheHit: false,
                    metadata: {
                        usedTools: usedTools.length > 0 ? usedTools : undefined,
                        sourceDocuments: sourceDocuments.length > 0 ? sourceDocuments.length : undefined,
                        artifacts: artifacts.length > 0 ? artifacts.length : undefined
                    }
                })
            }
        } catch (trackError) {
            // Silently fail - tracking should not break the main flow
        }

        let finalRes = output

        if (sourceDocuments.length || usedTools.length || artifacts.length) {
            const finalRes: ICommonObject = { text: output }
            if (sourceDocuments.length) {
                finalRes.sourceDocuments = flatten(sourceDocuments)
            }
            if (usedTools.length) {
                finalRes.usedTools = usedTools
            }
            if (artifacts.length) {
                finalRes.artifacts = artifacts
            }
            return finalRes
        }

        return finalRes
    }
}

async function prepareAgent(nodeData: INodeData, options: ICommonObject, flowObj: { sessionId?: string; chatId?: string; input?: string }) {
    const model = nodeData.inputs?.model as BaseChatModel
    const maxIterations = nodeData.inputs?.maxIterations as string
    const memory = nodeData.inputs?.memory as KodivianMemory
    let systemMessage = nodeData.inputs?.systemMessage as string
    let tools = nodeData.inputs?.tools
    tools = flatten(tools)

    // Process document stores and convert them to retriever tools
    const documentStores = nodeData.inputs?.agentKnowledgeDocumentStores as any[]

    if (documentStores && documentStores.length > 0 && options.componentNodes) {
        for (const docStore of documentStores) {
            try {
                const [storeId, storeName] = docStore.documentStore.split(':')

                // Initialize the document store vector instance
                const docStoreVectorInstanceFilePath = options.componentNodes['documentStoreVS'].filePath as string
                const docStoreVectorModule = await import(docStoreVectorInstanceFilePath)
                const newDocStoreVectorInstance = new docStoreVectorModule.nodeClass()

                const docStoreVectorInstance = (await newDocStoreVectorInstance.init(
                    {
                        ...nodeData,
                        inputs: {
                            ...nodeData.inputs,
                            selectedStore: storeId
                        },
                        outputs: {
                            output: 'retriever'
                        }
                    },
                    '',
                    options
                )) as BaseRetriever

                // Create a retriever tool from the document store
                const toolName = storeName
                    .toLowerCase()
                    .replace(/ /g, '_')
                    .replace(/[^a-z0-9_-]/g, '')

                // Enhance description to make it clearer when to use this tool
                const enhancedDescription = docStore.docStoreDescription
                    ? `${docStore.docStoreDescription}. Use this tool to search the ${storeName} knowledge base for information before searching the web.`
                    : `Search the ${storeName} knowledge base for relevant information. Use this tool to find information from internal documents before searching the web.`

                const retrieverTool = createRetrieverTool(
                    toolName,
                    enhancedDescription,
                    docStoreVectorInstance,
                    docStore.returnSourceDocuments || false
                )

                tools.push(retrieverTool)
            } catch (error) {
                // Continue with other document stores even if one fails
            }
        }
    }

    const memoryKey = memory.memoryKey ? memory.memoryKey : 'chat_history'
    const inputKey = memory.inputKey ? memory.inputKey : 'input'
    const prependMessages = options?.prependMessages

    systemMessage = transformBracesWithColon(systemMessage)

    let prompt = ChatPromptTemplate.fromMessages([
        ['system', systemMessage],
        new MessagesPlaceholder(memoryKey),
        ['human', `{${inputKey}}`],
        new MessagesPlaceholder('agent_scratchpad')
    ])

    let promptVariables = {}
    const chatPromptTemplate = nodeData.inputs?.chatPromptTemplate as ChatPromptTemplate
    if (chatPromptTemplate && chatPromptTemplate.promptMessages.length) {
        const humanPrompt = chatPromptTemplate.promptMessages[chatPromptTemplate.promptMessages.length - 1]
        const messages = [
            ...chatPromptTemplate.promptMessages.slice(0, -1),
            new MessagesPlaceholder(memoryKey),
            humanPrompt,
            new MessagesPlaceholder('agent_scratchpad')
        ]
        prompt = ChatPromptTemplate.fromMessages(messages)
        if ((chatPromptTemplate as any).promptValues) {
            const promptValuesRaw = (chatPromptTemplate as any).promptValues
            const promptValues = handleEscapeCharacters(promptValuesRaw, true)
            for (const val in promptValues) {
                promptVariables = {
                    ...promptVariables,
                    [val]: () => {
                        return promptValues[val]
                    }
                }
            }
        }
    }

    if (llmSupportsVision(model)) {
        const visionChatModel = model as IVisionChatModal
        const messageContent = await addImagesToMessages(nodeData, options, model.multiModalOption)

        if (messageContent?.length) {
            visionChatModel.setVisionModel()

            // Pop the `agent_scratchpad` MessagePlaceHolder
            let messagePlaceholder = prompt.promptMessages.pop() as MessagesPlaceholder
            if (prompt.promptMessages.at(-1) instanceof HumanMessagePromptTemplate) {
                const lastMessage = prompt.promptMessages.pop() as HumanMessagePromptTemplate
                const template = (lastMessage.prompt as PromptTemplate).template as string
                const msg = HumanMessagePromptTemplate.fromTemplate([
                    ...messageContent,
                    {
                        text: template
                    }
                ])
                msg.inputVariables = lastMessage.inputVariables
                prompt.promptMessages.push(msg)
            }

            // Add the `agent_scratchpad` MessagePlaceHolder back
            prompt.promptMessages.push(messagePlaceholder)
        } else {
            visionChatModel.revertToOriginalModel()
        }
    }

    if (model.bindTools === undefined) {
        throw new Error(`This agent requires that the "bindTools()" method be implemented on the input model.`)
    }

    const modelWithTools = model.bindTools(tools)

    const runnableAgent = RunnableSequence.from([
        {
            [inputKey]: (i: { input: string; steps: ToolsAgentStep[] }) => i.input,
            agent_scratchpad: (i: { input: string; steps: ToolsAgentStep[] }) => formatToOpenAIToolMessages(i.steps),
            [memoryKey]: async (_: { input: string; steps: ToolsAgentStep[] }) => {
                const messages = (await memory.getChatMessages(flowObj?.sessionId, true, prependMessages)) as BaseMessage[]
                return messages ?? []
            },
            ...promptVariables
        },
        prompt,
        modelWithTools,
        new ToolCallingAgentOutputParser()
    ])

    const executor = AgentExecutor.fromAgentAndTools({
        agent: runnableAgent,
        tools,
        sessionId: flowObj?.sessionId,
        chatId: flowObj?.chatId,
        input: flowObj?.input,
        verbose: process.env.DEBUG === 'true' ? true : false,
        maxIterations: maxIterations ? parseFloat(maxIterations) : undefined
    })

    return executor
}

module.exports = { nodeClass: ToolAgent_Agents }
