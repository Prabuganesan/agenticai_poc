import { flatten } from 'lodash'
import { Tool } from '@langchain/core/tools'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages'
import { ChainValues } from '@langchain/core/utils/types'
import { AgentStep } from '@langchain/core/agents'
import { renderTemplate, MessagesPlaceholder, HumanMessagePromptTemplate, PromptTemplate } from '@langchain/core/prompts'
import { RunnableSequence } from '@langchain/core/runnables'
import { ChatConversationalAgent } from 'langchain/agents'
import { getBaseClasses, transformBracesWithColon } from '../../../src/utils'
import { ConsoleCallbackHandler, CustomChainHandler, additionalCallbacks } from '../../../src/handler'
import {
    IVisionChatModal,
    KodivianMemory,
    ICommonObject,
    INode,
    INodeData,
    INodeParams,
    IUsedTool,
    IServerSideEventStreamer
} from '../../../src/Interface'
import { AgentExecutor } from '../../../src/agents'
import { addImagesToMessages, llmSupportsVision } from '../../../src/multiModalUtils'
import { checkInputs, Moderation, streamResponse } from '../../moderation/Moderation'
import { formatResponse } from '../../outputparsers/OutputParserHelpers'
import path from 'path'

const DEFAULT_PREFIX = `Assistant is a large language model trained by OpenAI.

Assistant is designed to be able to assist with a wide range of tasks, from answering simple questions to providing in-depth explanations and discussions on a wide range of topics. As a language model, Assistant is able to generate human-like text based on the input it receives, allowing it to engage in natural-sounding conversations and provide responses that are coherent and relevant to the topic at hand.

Assistant is constantly learning and improving, and its capabilities are constantly evolving. It is able to process and understand large amounts of text, and can use this knowledge to provide accurate and informative responses to a wide range of questions. Additionally, Assistant is able to generate its own text based on the input it receives, allowing it to engage in discussions and provide explanations and descriptions on a wide range of topics.

Overall, Assistant is a powerful system that can help with a wide range of tasks and provide valuable insights and information on a wide range of topics. Whether you need help with a specific question or just want to have a conversation about a particular topic, Assistant is here to assist.`

const TEMPLATE_TOOL_RESPONSE = `TOOL RESPONSE:
---------------------
{observation}

USER'S INPUT
--------------------

Okay, so what is the response to my last comment? If using information obtained from the tools you must mention it explicitly without mentioning the tool names - I have forgotten all TOOL RESPONSES! Remember to respond with a markdown code snippet of a json blob with a single action, and NOTHING else.`

class ConversationalAgent_Agents implements INode {
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
        this.label = 'Conversational Agent'
        this.name = 'conversationalAgent'
        this.version = 3.0
        this.type = 'AgentExecutor'
        this.category = 'Agents'
        this.icon = 'agent.svg'
        this.description = 'Conversational agent for a chat model. It will utilize chat specific prompts'
        this.baseClasses = [this.type, ...getBaseClasses(AgentExecutor)]
        this.inputs = [
            {
                label: 'Allowed Tools',
                name: 'tools',
                type: 'Tool',
                list: true
            },
            {
                label: 'Chat Model',
                name: 'model',
                type: 'BaseChatModel'
            },
            {
                label: 'Memory',
                name: 'memory',
                type: 'BaseChatMemory'
            },
            {
                label: 'System Message',
                name: 'systemMessage',
                type: 'string',
                rows: 4,
                default: DEFAULT_PREFIX,
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
            }
        ]
        this.sessionId = fields?.sessionId
    }

    async init(nodeData: INodeData, input: string, options: ICommonObject): Promise<any> {
        return prepareAgent(nodeData, options, { sessionId: this.sessionId, chatId: options.chatId, input })
    }

    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<string | object> {
        const memory = nodeData.inputs?.memory as KodivianMemory
        const moderations = nodeData.inputs?.inputModeration as Moderation[]

        const shouldStreamResponse = options.shouldStreamResponse
        const sseStreamer: IServerSideEventStreamer = options.sseStreamer as IServerSideEventStreamer
        const chatId = options.chatId
        if (moderations && moderations.length > 0) {
            try {
                // Use the output of the moderation chain as input for the agent
                input = await checkInputs(moderations, input)
            } catch (e) {
                await new Promise((resolve) => setTimeout(resolve, 500))
                if (options.shouldStreamResponse) {
                    streamResponse(sseStreamer, chatId, e.message)
                }
                return formatResponse(e.message)
            }
        }
        const executor = await prepareAgent(nodeData, options, { sessionId: this.sessionId, chatId: options.chatId, input })

        const loggerHandler = new ConsoleCallbackHandler(options.logger, options?.orgId)
        const callbacks = await additionalCallbacks(nodeData, options)

        // Track token usage from LLM calls during agent execution
        let accumulatedUsageMetadata: any = {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0
        }

        // Create a callback to track token usage from LLM calls
        const usageTrackingCallback = {
            handleLLMEnd: (output: any) => {
                try {
                    // Priority 1: Check generations array for usage_metadata in message.additional_kwargs (Google/Gemini format)
                    if (output?.generations && Array.isArray(output.generations)) {
                        for (const genArray of output.generations) {
                            if (Array.isArray(genArray)) {
                                for (const gen of genArray) {
                                    // Check message.additional_kwargs.usage_metadata (Google/Gemini format)
                                    if (gen?.message?.additional_kwargs?.usage_metadata) {
                                        const usage = gen.message.additional_kwargs.usage_metadata
                                        accumulatedUsageMetadata.input_tokens += usage.input_tokens || usage.prompt_tokens || 0
                                        accumulatedUsageMetadata.output_tokens += usage.output_tokens || usage.completion_tokens || 0
                                        accumulatedUsageMetadata.total_tokens +=
                                            usage.total_tokens || (usage.input_tokens || 0) + (usage.output_tokens || 0)
                                    }
                                    // Check message.usage_metadata (direct format)
                                    else if (gen?.message?.usage_metadata) {
                                        const usage = gen.message.usage_metadata
                                        accumulatedUsageMetadata.input_tokens += usage.input_tokens || usage.prompt_tokens || 0
                                        accumulatedUsageMetadata.output_tokens += usage.output_tokens || usage.completion_tokens || 0
                                        accumulatedUsageMetadata.total_tokens +=
                                            usage.total_tokens || (usage.input_tokens || 0) + (usage.output_tokens || 0)
                                    }
                                }
                            } else if (genArray?.message?.additional_kwargs?.usage_metadata) {
                                const usage = genArray.message.additional_kwargs.usage_metadata
                                accumulatedUsageMetadata.input_tokens += usage.input_tokens || usage.prompt_tokens || 0
                                accumulatedUsageMetadata.output_tokens += usage.output_tokens || usage.completion_tokens || 0
                                accumulatedUsageMetadata.total_tokens +=
                                    usage.total_tokens || (usage.input_tokens || 0) + (usage.output_tokens || 0)
                            }
                        }
                    }

                    // Priority 2: Check llmOutput.tokenUsage (standard LangChain format)
                    if (output?.llmOutput?.tokenUsage) {
                        const tokenUsage = output.llmOutput.tokenUsage
                        accumulatedUsageMetadata.input_tokens += tokenUsage.promptTokens || 0
                        accumulatedUsageMetadata.output_tokens += tokenUsage.completionTokens || 0
                        accumulatedUsageMetadata.total_tokens +=
                            tokenUsage.totalTokens || (tokenUsage.promptTokens || 0) + (tokenUsage.completionTokens || 0)
                    }

                    // Priority 3: Check root level usage_metadata
                    if (output?.usage_metadata) {
                        const usage = output.usage_metadata
                        accumulatedUsageMetadata.input_tokens += usage.input_tokens || usage.prompt_tokens || 0
                        accumulatedUsageMetadata.output_tokens += usage.output_tokens || usage.completion_tokens || 0
                        accumulatedUsageMetadata.total_tokens +=
                            usage.total_tokens || (usage.input_tokens || 0) + (usage.output_tokens || 0)
                    }

                    accumulatedUsageMetadata.total_tokens =
                        accumulatedUsageMetadata.total_tokens ||
                        accumulatedUsageMetadata.input_tokens + accumulatedUsageMetadata.output_tokens
                } catch (e) {
                    // Ignore errors in usage tracking
                }
            }
        }

        let res: ChainValues = {}
        let sourceDocuments: ICommonObject[] = []
        let usedTools: IUsedTool[] = []

        // Track start time BEFORE LLM execution
        const startTime = Date.now()

        if (options.shouldStreamResponse) {
            const handler = new CustomChainHandler(shouldStreamResponse ? sseStreamer : undefined, chatId)
            res = await executor.invoke({ input }, { callbacks: [loggerHandler, handler, usageTrackingCallback, ...callbacks] })
            if (res.sourceDocuments) {
                if (options.sseStreamer) {
                    sseStreamer.streamSourceDocumentsEvent(options.chatId, flatten(res.sourceDocuments))
                }
                sourceDocuments = res.sourceDocuments
            }
            if (res.usedTools) {
                sseStreamer.streamUsedToolsEvent(options.chatId, res.usedTools)
                usedTools = res.usedTools
            }
            // If the tool is set to returnDirect, stream the output to the client
            if (res.usedTools && res.usedTools.length) {
                let inputTools = nodeData.inputs?.tools
                inputTools = flatten(inputTools)
                for (const tool of res.usedTools) {
                    const inputTool = inputTools.find((inputTool: Tool) => inputTool.name === tool.tool)
                    if (inputTool && inputTool.returnDirect && options.sseStreamer) {
                        sseStreamer.streamTokenEvent(options.chatId, tool.toolOutput)
                    }
                }
            }
            if (sseStreamer) {
                sseStreamer.streamEndEvent(options.chatId)
            }
        } else {
            res = await executor.invoke({ input }, { callbacks: [loggerHandler, usageTrackingCallback, ...callbacks] })
            if (res.sourceDocuments) {
                sourceDocuments = res.sourceDocuments
            }
            if (res.usedTools) {
                usedTools = res.usedTools
            }
        }

        // Track end time AFTER LLM execution
        const endTime = Date.now()
        const timeDelta = endTime - startTime

        await memory.addChatMessages(
            [
                {
                    text: input,
                    type: 'userMessage'
                },
                {
                    text: res?.output,
                    type: 'apiMessage'
                }
            ],
            this.sessionId
        )

        // Use accumulated usage metadata from callback tracking
        // If we have accumulated tokens, use them; otherwise try to extract from result
        let usageMetadata: any = undefined

        if (
            accumulatedUsageMetadata.total_tokens > 0 ||
            accumulatedUsageMetadata.input_tokens > 0 ||
            accumulatedUsageMetadata.output_tokens > 0
        ) {
            // Use accumulated usage from callback tracking
            usageMetadata = {
                input_tokens: accumulatedUsageMetadata.input_tokens,
                output_tokens: accumulatedUsageMetadata.output_tokens,
                total_tokens:
                    accumulatedUsageMetadata.total_tokens || accumulatedUsageMetadata.input_tokens + accumulatedUsageMetadata.output_tokens
            }
        } else if (res?.intermediateSteps && Array.isArray(res.intermediateSteps)) {
            // Fallback: Aggregate usage metadata from all LLM calls in intermediate steps
            let totalInputTokens = 0
            let totalOutputTokens = 0
            let totalTokens = 0

            for (const step of res.intermediateSteps) {
                // Check if step has usage metadata in observation or action
                if (step.observation?.usage_metadata) {
                    totalInputTokens += step.observation.usage_metadata.input_tokens || step.observation.usage_metadata.prompt_tokens || 0
                    totalOutputTokens +=
                        step.observation.usage_metadata.output_tokens || step.observation.usage_metadata.completion_tokens || 0
                    totalTokens += step.observation.usage_metadata.total_tokens || 0
                }
                if (step.action?.tool_input?.usage_metadata) {
                    totalInputTokens +=
                        step.action.tool_input.usage_metadata.input_tokens || step.action.tool_input.usage_metadata.prompt_tokens || 0
                    totalOutputTokens +=
                        step.action.tool_input.usage_metadata.output_tokens || step.action.tool_input.usage_metadata.completion_tokens || 0
                    totalTokens += step.action.tool_input.usage_metadata.total_tokens || 0
                }
            }

            // Also check if res itself has usage metadata
            if (res.usage_metadata) {
                totalInputTokens += res.usage_metadata.input_tokens || res.usage_metadata.prompt_tokens || 0
                totalOutputTokens += res.usage_metadata.output_tokens || res.usage_metadata.completion_tokens || 0
                totalTokens += res.usage_metadata.total_tokens || 0
            }

            if (totalTokens > 0 || totalInputTokens > 0 || totalOutputTokens > 0) {
                usageMetadata = {
                    input_tokens: totalInputTokens,
                    output_tokens: totalOutputTokens,
                    total_tokens: totalTokens || totalInputTokens + totalOutputTokens
                }
            }
        } else if (res?.usage_metadata) {
            // Direct usage metadata in result
            usageMetadata = res.usage_metadata
        }

        // Track LLM usage
        try {
            if (options.orgId && usageMetadata) {
                // Dynamic import from server package
                const llmUsageTrackerPath = path.resolve(__dirname, '../../../../server/src/utils/llm-usage-tracker')
                const { trackLLMUsage, extractProviderAndModel, extractUsageMetadata } = await import(llmUsageTrackerPath)

                // Get model from nodeData
                const model = nodeData.inputs?.model as BaseChatModel
                const { provider, model: modelName } = extractProviderAndModel(nodeData, { model })

                // Extract usage from accumulated metadata
                const { promptTokens, completionTokens, totalTokens } = extractUsageMetadata({
                    usageMetadata,
                    usage_metadata: usageMetadata
                })

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
                    nodeName: 'ConversationalAgent',
                    location: 'main_flow',
                    provider,
                    model: modelName,
                    requestType: 'chat',
                    promptTokens: promptTokens || 0,
                    completionTokens: completionTokens || 0,
                    totalTokens: totalTokens || 0,
                    processingTimeMs: timeDelta,
                    responseLength: (res?.output as string)?.length || 0,
                    success: true,
                    cacheHit: false,
                    metadata: {
                        usedTools: usedTools.length > 0 ? usedTools : undefined,
                        sourceDocuments: sourceDocuments.length > 0 ? sourceDocuments.length : undefined
                    }
                })
            }
        } catch (trackError) {
            // Silently fail - tracking should not break the main flow
        }

        // Always return as object if we have usageMetadata, even if no sourceDocuments or usedTools
        // This ensures usage metadata is preserved for tracking
        if (usageMetadata) {
            const finalRes: any = { text: res?.output }
            if (sourceDocuments.length) {
                finalRes.sourceDocuments = flatten(sourceDocuments)
            }
            if (usedTools.length) {
                finalRes.usedTools = usedTools
            }
            finalRes.usageMetadata = usageMetadata
            return finalRes
        }

        // If no usage metadata, return as before
        let finalRes: any = res?.output
        if (sourceDocuments.length || usedTools.length) {
            finalRes = { text: res?.output }
            if (sourceDocuments.length) {
                finalRes.sourceDocuments = flatten(sourceDocuments)
            }
            if (usedTools.length) {
                finalRes.usedTools = usedTools
            }
            return finalRes
        }

        return finalRes
    }
}

const prepareAgent = async (
    nodeData: INodeData,
    options: ICommonObject,
    flowObj: { sessionId?: string; chatId?: string; input?: string }
) => {
    const model = nodeData.inputs?.model as BaseChatModel
    const maxIterations = nodeData.inputs?.maxIterations as string
    let tools = nodeData.inputs?.tools as Tool[]
    tools = flatten(tools)
    const memory = nodeData.inputs?.memory as KodivianMemory
    let systemMessage = nodeData.inputs?.systemMessage as string
    const memoryKey = memory.memoryKey ? memory.memoryKey : 'chat_history'
    const inputKey = memory.inputKey ? memory.inputKey : 'input'
    const prependMessages = options?.prependMessages

    const outputParser = ChatConversationalAgent.getDefaultOutputParser({
        llm: model,
        toolNames: tools.map((tool) => tool.name)
    })

    systemMessage = transformBracesWithColon(systemMessage)

    const prompt = ChatConversationalAgent.createPrompt(tools, {
        systemMessage: systemMessage ? systemMessage : DEFAULT_PREFIX,
        outputParser
    })

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

    /** Bind a stop token to the model */
    const modelWithStop = model.bind({
        stop: ['\nObservation']
    })

    const runnableAgent = RunnableSequence.from([
        {
            [inputKey]: (i: { input: string; steps: AgentStep[] }) => i.input,
            agent_scratchpad: async (i: { input: string; steps: AgentStep[] }) => await constructScratchPad(i.steps),
            [memoryKey]: async (_: { input: string; steps: AgentStep[] }) => {
                const messages = (await memory.getChatMessages(flowObj?.sessionId, true, prependMessages)) as BaseMessage[]
                return messages ?? []
            }
        },
        prompt,
        modelWithStop,
        outputParser
    ])

    const executor = AgentExecutor.fromAgentAndTools({
        agent: runnableAgent,
        tools,
        sessionId: flowObj?.sessionId,
        chatId: flowObj?.chatId,
        input: flowObj?.input,
        verbose: process.env.DEBUG === 'true',
        maxIterations: maxIterations ? parseFloat(maxIterations) : undefined
    })

    return executor
}

const constructScratchPad = async (steps: AgentStep[]): Promise<BaseMessage[]> => {
    const thoughts: BaseMessage[] = []
    for (const step of steps) {
        thoughts.push(new AIMessage(step.action.log))
        thoughts.push(
            new HumanMessage(
                renderTemplate(TEMPLATE_TOOL_RESPONSE, 'f-string', {
                    observation: step.observation
                })
            )
        )
    }
    return thoughts
}

module.exports = { nodeClass: ConversationalAgent_Agents }
