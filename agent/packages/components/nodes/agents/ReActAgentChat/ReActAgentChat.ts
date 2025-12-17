import { flatten } from 'lodash'
import { AgentExecutor } from 'langchain/agents'
import { ChatPromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts'
import { Tool } from '@langchain/core/tools'
import type { PromptTemplate } from '@langchain/core/prompts'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { pull } from 'langchain/hub'
import { additionalCallbacks } from '../../../src/handler'
import { IVisionChatModal, AutonomousMemory, ICommonObject, IMessage, INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'
import { createReactAgent } from '../../../src/agents'
import { addImagesToMessages, llmSupportsVision } from '../../../src/multiModalUtils'
import { checkInputs, Moderation } from '../../moderation/Moderation'
import { formatResponse } from '../../outputparsers/OutputParserHelpers'
import path from 'path'

class ReActAgentChat_Agents implements INode {
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
        this.label = 'ReAct Agent for Chat Models'
        this.name = 'reactAgentChat'
        this.version = 4.0
        this.type = 'AgentExecutor'
        this.category = 'Agents'
        this.icon = 'agent.svg'
        this.description = 'Agent that uses the ReAct logic to decide what action to take, optimized to be used with Chat Models'
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

    async init(): Promise<any> {
        return null
    }

    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<string | object> {
        const memory = nodeData.inputs?.memory as AutonomousMemory
        const maxIterations = nodeData.inputs?.maxIterations as string
        const model = nodeData.inputs?.model as BaseChatModel
        let tools = nodeData.inputs?.tools as Tool[]
        const moderations = nodeData.inputs?.inputModeration as Moderation[]
        const prependMessages = options?.prependMessages

        if (moderations && moderations.length > 0) {
            try {
                // Use the output of the moderation chain as input for the ReAct Agent for Chat Models
                input = await checkInputs(moderations, input)
            } catch (e) {
                await new Promise((resolve) => setTimeout(resolve, 500))
                // if (options.shouldStreamResponse) {
                //     streamResponse(options.sseStreamer, options.chatId, e.message)
                // }
                return formatResponse(e.message)
            }
        }
        tools = flatten(tools)

        const prompt = await pull<PromptTemplate>('hwchase17/react-chat')
        let chatPromptTemplate = undefined

        if (llmSupportsVision(model)) {
            const visionChatModel = model as IVisionChatModal
            const messageContent = await addImagesToMessages(nodeData, options, model.multiModalOption)

            if (messageContent?.length) {
                // Change model to vision supported
                visionChatModel.setVisionModel()
                const oldTemplate = prompt.template as string

                const msg = HumanMessagePromptTemplate.fromTemplate([
                    ...messageContent,
                    {
                        text: oldTemplate
                    }
                ])
                msg.inputVariables = prompt.inputVariables
                chatPromptTemplate = ChatPromptTemplate.fromMessages([msg])
            } else {
                // revert to previous values if image upload is empty
                visionChatModel.revertToOriginalModel()
            }
        }

        const agent = await createReactAgent({
            llm: model,
            tools,
            prompt: chatPromptTemplate ?? prompt
        })

        const executor = new AgentExecutor({
            agent,
            tools,
            verbose: process.env.DEBUG === 'true',
            maxIterations: maxIterations ? parseFloat(maxIterations) : undefined
        })

        const callbacks = await additionalCallbacks(nodeData, options)

        const chatHistory = ((await memory.getChatMessages(this.sessionId, false, prependMessages)) as IMessage[]) ?? []
        const chatHistoryString = chatHistory.map((hist) => hist.message).join('\\n')

        // Track start time BEFORE LLM execution
        const startTime = Date.now()

        const result = await executor.invoke({ input, chat_history: chatHistoryString }, { callbacks })

        // Track end time AFTER LLM execution
        const endTime = Date.now()
        const timeDelta = endTime - startTime

        // Track LLM usage
        try {
            if (options.orgId && result) {
                // Dynamic import from server package
                const llmUsageTrackerPath = path.resolve(__dirname, '../../../../server/src/utils/llm-usage-tracker')
                const { trackLLMUsage, extractProviderAndModel, extractUsageMetadata } = await import(llmUsageTrackerPath)

                // Get model from nodeData
                const { provider, model: modelName } = extractProviderAndModel(nodeData, { model })

                // Extract usage metadata from result
                const { promptTokens, completionTokens, totalTokens } = extractUsageMetadata(result)

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
                    nodeName: 'ReActAgentChat',
                    location: 'main_flow',
                    provider,
                    model: modelName,
                    requestType: 'chat',
                    promptTokens: promptTokens || 0,
                    completionTokens: completionTokens || 0,
                    totalTokens: totalTokens || 0,
                    processingTimeMs: timeDelta,
                    responseLength: (result?.output as string)?.length || 0,
                    success: true,
                    cacheHit: false,
                    metadata: {}
                })
            }
        } catch (trackError) {
            // Silently fail - tracking should not break the main flow
        }

        await memory.addChatMessages(
            [
                {
                    text: input,
                    type: 'userMessage'
                },
                {
                    text: result?.output,
                    type: 'apiMessage'
                }
            ],
            this.sessionId
        )

        return result?.output
    }
}

module.exports = { nodeClass: ReActAgentChat_Agents }
