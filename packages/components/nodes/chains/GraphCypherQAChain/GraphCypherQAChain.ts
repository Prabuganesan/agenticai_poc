import { ICommonObject, INode, INodeData, INodeParams, INodeOutputsValue, IServerSideEventStreamer } from '../../../src/Interface'
import { FromLLMInput, GraphCypherQAChain } from '@langchain/community/chains/graph_qa/cypher'
import { getBaseClasses } from '../../../src/utils'
import { BasePromptTemplate, PromptTemplate, FewShotPromptTemplate } from '@langchain/core/prompts'
import { BaseLanguageModel } from '@langchain/core/language_models/base'
import { ConsoleCallbackHandler, CustomChainHandler, additionalCallbacks } from '../../../src/handler'
import { ConsoleCallbackHandler as LCConsoleCallbackHandler } from '@langchain/core/tracers/console'
import { checkInputs, Moderation, streamResponse } from '../../moderation/Moderation'
import { formatResponse } from '../../outputparsers/OutputParserHelpers'
import path from 'path'

class GraphCypherQA_Chain implements INode {
    label: string
    name: string
    version: number
    type: string
    icon: string
    category: string
    description: string
    baseClasses: string[]
    inputs: INodeParams[]
    sessionId?: string
    outputs: INodeOutputsValue[]

    constructor(fields?: { sessionId?: string }) {
        this.label = 'Graph Cypher QA Chain'
        this.name = 'graphCypherQAChain'
        this.version = 1.1
        this.type = 'GraphCypherQAChain'
        this.icon = 'graphqa.svg'
        this.category = 'Chains'
        this.description = 'Advanced chain for question-answering against a Neo4j graph by generating Cypher statements'
        this.baseClasses = [this.type, ...getBaseClasses(GraphCypherQAChain)]
        this.sessionId = fields?.sessionId
        this.inputs = [
            {
                label: 'Language Model',
                name: 'model',
                type: 'BaseLanguageModel',
                description: 'Model for generating Cypher queries and answers.'
            },
            {
                label: 'Neo4j Graph',
                name: 'graph',
                type: 'Neo4j'
            },
            {
                label: 'Cypher Generation Prompt',
                name: 'cypherPrompt',
                optional: true,
                type: 'BasePromptTemplate',
                description:
                    'Prompt template for generating Cypher queries. Must include {schema} and {question} variables. If not provided, default prompt will be used.'
            },
            {
                label: 'Cypher Generation Model',
                name: 'cypherModel',
                optional: true,
                type: 'BaseLanguageModel',
                description: 'Model for generating Cypher queries. If not provided, the main model will be used.'
            },
            {
                label: 'QA Prompt',
                name: 'qaPrompt',
                optional: true,
                type: 'BasePromptTemplate',
                description:
                    'Prompt template for generating answers. Must include {context} and {question} variables. If not provided, default prompt will be used.'
            },
            {
                label: 'QA Model',
                name: 'qaModel',
                optional: true,
                type: 'BaseLanguageModel',
                description: 'Model for generating answers. If not provided, the main model will be used.'
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
                label: 'Return Direct',
                name: 'returnDirect',
                type: 'boolean',
                default: false,
                optional: true,
                description: 'If true, return the raw query results instead of using the QA chain'
            }
        ]
        this.outputs = [
            {
                label: 'Graph Cypher QA Chain',
                name: 'graphCypherQAChain',
                baseClasses: [this.type, ...getBaseClasses(GraphCypherQAChain)]
            },
            {
                label: 'Output Prediction',
                name: 'outputPrediction',
                baseClasses: ['string', 'json']
            }
        ]
    }

    async init(nodeData: INodeData, input: string, options: ICommonObject): Promise<any> {
        const model = nodeData.inputs?.model
        const cypherModel = nodeData.inputs?.cypherModel
        const qaModel = nodeData.inputs?.qaModel
        const graph = nodeData.inputs?.graph
        const cypherPrompt = nodeData.inputs?.cypherPrompt as BasePromptTemplate | FewShotPromptTemplate | undefined
        const qaPrompt = nodeData.inputs?.qaPrompt as BasePromptTemplate | undefined
        const returnDirect = nodeData.inputs?.returnDirect as boolean
        const output = nodeData.outputs?.output as string

        if (!model) {
            throw new Error('Language Model is required')
        }

        // Handle prompt values if they exist
        let cypherPromptTemplate: PromptTemplate | FewShotPromptTemplate | undefined
        let qaPromptTemplate: PromptTemplate | undefined

        if (cypherPrompt) {
            if (cypherPrompt instanceof PromptTemplate) {
                cypherPromptTemplate = new PromptTemplate({
                    template: cypherPrompt.template as string,
                    inputVariables: cypherPrompt.inputVariables
                })
                if (!qaPrompt) {
                    throw new Error('QA Prompt is required when Cypher Prompt is a Prompt Template')
                }
            } else if (cypherPrompt instanceof FewShotPromptTemplate) {
                const examplePrompt = cypherPrompt.examplePrompt as PromptTemplate
                cypherPromptTemplate = new FewShotPromptTemplate({
                    examples: cypherPrompt.examples,
                    examplePrompt: examplePrompt,
                    inputVariables: cypherPrompt.inputVariables,
                    prefix: cypherPrompt.prefix,
                    suffix: cypherPrompt.suffix,
                    exampleSeparator: cypherPrompt.exampleSeparator,
                    templateFormat: cypherPrompt.templateFormat
                })
            } else {
                cypherPromptTemplate = cypherPrompt as PromptTemplate
            }
        }

        if (qaPrompt instanceof PromptTemplate) {
            qaPromptTemplate = new PromptTemplate({
                template: qaPrompt.template as string,
                inputVariables: qaPrompt.inputVariables
            })
        }

        // Validate required variables in prompts
        if (
            cypherPromptTemplate &&
            (!cypherPromptTemplate?.inputVariables.includes('schema') || !cypherPromptTemplate?.inputVariables.includes('question'))
        ) {
            throw new Error('Cypher Generation Prompt must include {schema} and {question} variables')
        }

        const fromLLMInput: FromLLMInput = {
            llm: model,
            graph,
            returnDirect
        }

        if (cypherPromptTemplate) {
            fromLLMInput['cypherLLM'] = cypherModel ?? model
            fromLLMInput['cypherPrompt'] = cypherPromptTemplate
        }

        if (qaPromptTemplate) {
            fromLLMInput['qaLLM'] = qaModel ?? model
            fromLLMInput['qaPrompt'] = qaPromptTemplate
        }

        const chain = GraphCypherQAChain.fromLLM(fromLLMInput)

        if (output === this.name) {
            return chain
        } else if (output === 'outputPrediction') {
            nodeData.instance = chain
            return await this.run(nodeData, input, options)
        }

        return chain
    }

    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<string | object> {
        const chain = nodeData.instance as GraphCypherQAChain
        const moderations = nodeData.inputs?.inputModeration as Moderation[]
        const returnDirect = nodeData.inputs?.returnDirect as boolean

        const shouldStreamResponse = options.shouldStreamResponse
        const sseStreamer: IServerSideEventStreamer = options.sseStreamer as IServerSideEventStreamer
        const chatId = options.chatId

        // Handle input moderation if configured
        if (moderations && moderations.length > 0) {
            try {
                input = await checkInputs(moderations, input)
            } catch (e) {
                await new Promise((resolve) => setTimeout(resolve, 500))
                if (shouldStreamResponse) {
                    streamResponse(sseStreamer, chatId, e.message)
                }
                return formatResponse(e.message)
            }
        }

        const obj = {
            query: input
        }

        const loggerHandler = new ConsoleCallbackHandler(options.logger, options?.orgId)
        const callbackHandlers = await additionalCallbacks(nodeData, options)
        let callbacks = [loggerHandler, ...callbackHandlers]

        if (process.env.DEBUG === 'true') {
            callbacks.push(new LCConsoleCallbackHandler())
        }

        try {
            // Track start time BEFORE LLM execution
            const startTime = Date.now()

            let response
            if (shouldStreamResponse) {
                if (returnDirect) {
                    response = await chain.invoke(obj, { callbacks })
                    let result = response?.result
                    if (typeof result === 'object') {
                        result = '```json\n' + JSON.stringify(result, null, 2)
                    }
                    if (result && typeof result === 'string') {
                        streamResponse(sseStreamer, chatId, result)
                    }
                } else {
                    const handler = new CustomChainHandler(sseStreamer, chatId, 2)
                    callbacks.push(handler)
                    response = await chain.invoke(obj, { callbacks })
                }
            } else {
                response = await chain.invoke(obj, { callbacks })
            }

            // Track end time AFTER LLM execution
            const endTime = Date.now()
            const timeDelta = endTime - startTime

            // Track LLM usage
            try {
                if (options.orgId && response) {
                    // Dynamic import from server package
                    const llmUsageTrackerPath = path.resolve(__dirname, '../../../../server/src/utils/llm-usage-tracker')
                    const { trackLLMUsage, extractProviderAndModel, extractUsageMetadata } = await import(llmUsageTrackerPath)

                    // Get model from nodeData
                    const model = nodeData.inputs?.model as BaseLanguageModel
                    const { provider, model: modelName } = extractProviderAndModel(nodeData, { model })

                    // Extract usage metadata from result
                    const { promptTokens, completionTokens, totalTokens } = extractUsageMetadata({
                        usageMetadata: response?.usageMetadata,
                        usage_metadata: response?.usage_metadata,
                        llmOutput: response?.llmOutput,
                        tokenUsage: response?.tokenUsage
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
                        nodeType: 'GraphCypherQAChain',
                        nodeName: 'GraphCypherQAChain',
                        location: 'main_flow',
                        provider,
                        model: modelName,
                        requestType: 'chat',
                        promptTokens: promptTokens || 0,
                        completionTokens: completionTokens || 0,
                        totalTokens: totalTokens || 0,
                        processingTimeMs: timeDelta,
                        responseLength:
                            typeof response?.result === 'string'
                                ? response.result.length
                                : typeof response?.result === 'object'
                                ? JSON.stringify(response.result).length
                                : 0,
                        success: true,
                        cacheHit: false,
                        metadata: {}
                    })
                }
            } catch (trackError) {
                // Silently fail - tracking should not break the main flow
            }

            return formatResponse(response?.result)
        } catch (error) {
            console.error('Error in GraphCypherQAChain:', error)
            if (shouldStreamResponse) {
                streamResponse(sseStreamer, chatId, error.message)
            }
            return formatResponse(`Error: ${error.message}`)
        }
    }
}

module.exports = { nodeClass: GraphCypherQA_Chain }
