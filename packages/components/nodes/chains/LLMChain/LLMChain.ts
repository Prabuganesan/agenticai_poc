import { BaseLanguageModel, BaseLanguageModelCallOptions } from '@langchain/core/language_models/base'
import { BaseLLMOutputParser, BaseOutputParser } from '@langchain/core/output_parsers'
import { HumanMessage } from '@langchain/core/messages'
import { ChatPromptTemplate, FewShotPromptTemplate, HumanMessagePromptTemplate, PromptTemplate } from '@langchain/core/prompts'
import { OutputFixingParser } from 'langchain/output_parsers'
import { LLMChain } from 'langchain/chains'
import {
    IVisionChatModal,
    ICommonObject,
    INode,
    INodeData,
    INodeOutputsValue,
    INodeParams,
    IServerSideEventStreamer
} from '../../../src/Interface'
import { additionalCallbacks, ConsoleCallbackHandler, CustomChainHandler } from '../../../src/handler'
import { getBaseClasses, handleEscapeCharacters } from '../../../src/utils'
import { checkInputs, Moderation, streamResponse } from '../../moderation/Moderation'
import { formatResponse, injectOutputParser } from '../../outputparsers/OutputParserHelpers'
import { addImagesToMessages, llmSupportsVision } from '../../../src/multiModalUtils'
import path from 'path'

class LLMChain_Chains implements INode {
    label: string
    name: string
    version: number
    type: string
    icon: string
    category: string
    baseClasses: string[]
    description: string
    inputs: INodeParams[]
    outputs: INodeOutputsValue[]
    outputParser: BaseOutputParser

    constructor() {
        this.label = 'LLM Chain'
        this.name = 'llmChain'
        this.version = 3.0
        this.type = 'LLMChain'
        this.icon = 'LLM_Chain.svg'
        this.category = 'Chains'
        this.description = 'Chain to run queries against LLMs'
        this.baseClasses = [this.type, ...getBaseClasses(LLMChain)]
        this.inputs = [
            {
                label: 'Language Model',
                name: 'model',
                type: 'BaseLanguageModel'
            },
            {
                label: 'Prompt',
                name: 'prompt',
                type: 'BasePromptTemplate'
            },
            {
                label: 'Output Parser',
                name: 'outputParser',
                type: 'BaseLLMOutputParser',
                optional: true
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
                label: 'Chain Name',
                name: 'chainName',
                type: 'string',
                placeholder: 'Name Your Chain',
                optional: true
            }
        ]
        this.outputs = [
            {
                label: 'LLM Chain',
                name: 'llmChain',
                baseClasses: [this.type, ...getBaseClasses(LLMChain)]
            },
            {
                label: 'Output Prediction',
                name: 'outputPrediction',
                baseClasses: ['string', 'json']
            }
        ]
    }

    async init(nodeData: INodeData, input: string, options: ICommonObject): Promise<any> {
        const model = nodeData.inputs?.model as BaseLanguageModel
        const prompt = nodeData.inputs?.prompt
        const output = nodeData.outputs?.output as string
        let promptValues: ICommonObject | undefined = nodeData.inputs?.prompt.promptValues as ICommonObject
        const llmOutputParser = nodeData.inputs?.outputParser as BaseOutputParser
        this.outputParser = llmOutputParser
        if (llmOutputParser) {
            let autoFix = (llmOutputParser as any).autoFix
            if (autoFix === true) {
                this.outputParser = OutputFixingParser.fromLLM(model, llmOutputParser)
            }
        }
        if (output === this.name) {
            const chain = new LLMChain({
                llm: model,
                outputParser: this.outputParser as BaseLLMOutputParser<string | object>,
                prompt,
                verbose: process.env.DEBUG === 'true'
            })
            return chain
        } else if (output === 'outputPrediction') {
            const chain = new LLMChain({
                llm: model,
                outputParser: this.outputParser as BaseLLMOutputParser<string | object>,
                prompt,
                verbose: process.env.DEBUG === 'true'
            })
            const inputVariables = chain.prompt.inputVariables as string[] // ["product"]
            promptValues = injectOutputParser(this.outputParser, chain, promptValues)
            const disableStreaming = true
            const res = await runPrediction(inputVariables, chain, input, promptValues, options, nodeData, disableStreaming)

            let finalRes = res
            if (this.outputParser && typeof res === 'object' && Object.prototype.hasOwnProperty.call(res, 'json')) {
                finalRes = (res as ICommonObject).json
            }

            /**
             * Apply string transformation to convert special chars:
             * FROM: hello i am ben\n\n\thow are you?
             * TO: hello i am benAUTONOMOUS_NEWLINEAUTONOMOUS_NEWLINEAUTONOMOUS_TABhow are you?
             */
            return handleEscapeCharacters(finalRes, false)
        }
    }

    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<string | object> {
        const inputVariables = nodeData.instance.prompt.inputVariables as string[] // ["product"]
        const chain = nodeData.instance as LLMChain
        let promptValues: ICommonObject | undefined = nodeData.inputs?.prompt.promptValues as ICommonObject
        const outputParser = nodeData.inputs?.outputParser as BaseOutputParser
        if (!this.outputParser && outputParser) {
            this.outputParser = outputParser
        }
        promptValues = injectOutputParser(this.outputParser, chain, promptValues)
        const res = await runPrediction(inputVariables, chain, input, promptValues, options, nodeData)
        return res
    }
}

/**
 * Helper function to track LLM usage for chain nodes
 */
async function trackLLMUsageForChain(nodeData: INodeData, options: ICommonObject, result: any, timeDelta: number, llm: any): Promise<void> {
    try {
        if (options.orgId && result) {
            // Dynamic import from server package
            const llmUsageTrackerPath = path.resolve(__dirname, '../../../../server/src/utils/llm-usage-tracker')
            const { trackLLMUsage, extractProviderAndModel, extractUsageMetadata } = await import(llmUsageTrackerPath)

            // Get model from chain
            const { provider, model: modelName } = extractProviderAndModel(nodeData, { model: llm })

            // Extract usage metadata from result
            const { promptTokens, completionTokens, totalTokens } = extractUsageMetadata({
                usageMetadata: result?.usageMetadata,
                usage_metadata: result?.usage_metadata,
                llmOutput: result?.llmOutput,
                tokenUsage: result?.tokenUsage
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
                nodeType: 'LLMChain',
                nodeName: 'LLMChain',
                location: 'main_flow',
                provider,
                model: modelName,
                requestType: 'chat',
                promptTokens: promptTokens || 0,
                completionTokens: completionTokens || 0,
                totalTokens: totalTokens || 0,
                processingTimeMs: timeDelta,
                responseLength: (result?.text as string)?.length || (typeof result === 'string' ? result.length : 0),
                success: true,
                cacheHit: false,
                metadata: {}
            })
        }
    } catch (trackError) {
        // Silently fail - tracking should not break the main flow
    }
}

const runPrediction = async (
    inputVariables: string[],
    chain: LLMChain<string | object | BaseLanguageModel<any, BaseLanguageModelCallOptions>>,
    input: string,
    promptValuesRaw: ICommonObject | undefined,
    options: ICommonObject,
    nodeData: INodeData,
    disableStreaming?: boolean
) => {
    const loggerHandler = new ConsoleCallbackHandler(options.logger, options?.orgId)
    const callbacks = await additionalCallbacks(nodeData, options)

    const moderations = nodeData.inputs?.inputModeration as Moderation[]

    // this is true if the prediction is external and the client has requested streaming='true'
    const shouldStreamResponse = !disableStreaming && options.shouldStreamResponse
    const sseStreamer: IServerSideEventStreamer = options.sseStreamer as IServerSideEventStreamer
    const chatId = options.chatId

    if (moderations && moderations.length > 0) {
        try {
            // Use the output of the moderation chain as input for the LLM chain
            input = await checkInputs(moderations, input)
        } catch (e) {
            await new Promise((resolve) => setTimeout(resolve, 500))
            if (shouldStreamResponse) {
                streamResponse(sseStreamer, chatId, e.message)
            }
            return formatResponse(e.message)
        }
    }

    /**
     * Apply string transformation to reverse converted special chars:
     * FROM: { "value": "hello i am benAUTONOMOUS_NEWLINEAUTONOMOUS_NEWLINEAUTONOMOUS_TABhow are you?" }
     * TO: { "value": "hello i am ben\n\n\thow are you?" }
     */
    const promptValues = handleEscapeCharacters(promptValuesRaw, true)

    if (llmSupportsVision(chain.llm)) {
        const visionChatModel = chain.llm as IVisionChatModal
        const messageContent = await addImagesToMessages(nodeData, options, visionChatModel.multiModalOption)
        if (messageContent?.length) {
            // Change model to gpt-4-vision && max token to higher when using gpt-4-vision
            visionChatModel.setVisionModel()
            // Add image to the message
            if (chain.prompt instanceof PromptTemplate) {
                const existingPromptTemplate = chain.prompt.template as string
                const msg = HumanMessagePromptTemplate.fromTemplate([
                    ...messageContent,
                    {
                        text: existingPromptTemplate
                    }
                ])
                msg.inputVariables = chain.prompt.inputVariables
                chain.prompt = ChatPromptTemplate.fromMessages([msg])
            } else if (chain.prompt instanceof ChatPromptTemplate) {
                if (chain.prompt.promptMessages.at(-1) instanceof HumanMessagePromptTemplate) {
                    const lastMessage = chain.prompt.promptMessages.pop() as HumanMessagePromptTemplate
                    const template = (lastMessage.prompt as PromptTemplate).template as string
                    const msg = HumanMessagePromptTemplate.fromTemplate([
                        ...messageContent,
                        {
                            text: template
                        }
                    ])
                    msg.inputVariables = lastMessage.inputVariables
                    chain.prompt.promptMessages.push(msg)
                } else {
                    chain.prompt.promptMessages.push(new HumanMessage({ content: messageContent }))
                }
            } else if (chain.prompt instanceof FewShotPromptTemplate) {
                let existingFewShotPromptTemplate = chain.prompt.examplePrompt.template as string
                let newFewShotPromptTemplate = ChatPromptTemplate.fromMessages([
                    HumanMessagePromptTemplate.fromTemplate(existingFewShotPromptTemplate)
                ])
                newFewShotPromptTemplate.promptMessages.push(new HumanMessage({ content: messageContent }))
                // @ts-ignore
                chain.prompt.examplePrompt = newFewShotPromptTemplate
            }
        } else {
            // revert to previous values if image upload is empty
            visionChatModel.revertToOriginalModel()
        }
    }

    if (promptValues && inputVariables.length > 0) {
        let seen: string[] = []

        for (const variable of inputVariables) {
            seen.push(variable)
            if (promptValues[variable] != null) {
                seen.pop()
            }
        }

        if (seen.length === 0) {
            // All inputVariables have fixed values specified
            const chainOptions = { ...promptValues }

            // Track start time BEFORE LLM execution
            const startTime = Date.now()

            let res
            if (shouldStreamResponse) {
                const handler = new CustomChainHandler(sseStreamer, chatId)
                res = await chain.call(chainOptions, [loggerHandler, handler, ...callbacks])
            } else {
                res = await chain.call(chainOptions, [loggerHandler, ...callbacks])
            }

            // Track end time AFTER LLM execution
            const endTime = Date.now()
            const timeDelta = endTime - startTime

            // Track LLM usage (use original options parameter, not local chainOptions)
            await trackLLMUsageForChain(nodeData, options, res, timeDelta, chain.llm)

            return formatResponse(res?.text)
        } else if (seen.length === 1) {
            // If one inputVariable is not specify, use input (user's question) as value
            const lastValue = seen.pop()
            if (!lastValue) throw new Error('Please provide Prompt Values')
            const chainOptions = {
                ...promptValues,
                [lastValue]: input
            }

            // Track start time BEFORE LLM execution
            const startTime = Date.now()

            let res
            if (shouldStreamResponse) {
                const handler = new CustomChainHandler(sseStreamer, chatId)
                res = await chain.call(chainOptions, [loggerHandler, handler, ...callbacks])
            } else {
                res = await chain.call(chainOptions, [loggerHandler, ...callbacks])
            }

            // Track end time AFTER LLM execution
            const endTime = Date.now()
            const timeDelta = endTime - startTime

            // Track LLM usage (use original options parameter, not local chainOptions)
            await trackLLMUsageForChain(nodeData, options, res, timeDelta, chain.llm)

            return formatResponse(res?.text)
        } else {
            throw new Error(`Please provide Prompt Values for: ${seen.join(', ')}`)
        }
    } else {
        // Track start time BEFORE LLM execution
        const startTime = Date.now()

        let res
        if (shouldStreamResponse) {
            const handler = new CustomChainHandler(sseStreamer, chatId)
            res = await chain.run(input, [loggerHandler, handler, ...callbacks])
        } else {
            res = await chain.run(input, [loggerHandler, ...callbacks])
        }

        // Track end time AFTER LLM execution
        const endTime = Date.now()
        const timeDelta = endTime - startTime

        // Track LLM usage
        await trackLLMUsageForChain(nodeData, options, res, timeDelta, chain.llm)

        return formatResponse(res)
    }
}

module.exports = { nodeClass: LLMChain_Chains }
