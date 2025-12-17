import { BaseLanguageModel } from '@langchain/core/language_models/base'
import { AgentExecutor } from 'langchain/agents'
import { LLMChain } from 'langchain/chains'
import { ConsoleCallbackHandler, CustomChainHandler, additionalCallbacks } from '../../../src/handler'
import { ICommonObject, INode, INodeData, INodeParams, IServerSideEventStreamer, PromptTemplate } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'
import { LoadPyodide, finalSystemPrompt, systemPrompt } from './core'
import { checkInputs, Moderation } from '../../moderation/Moderation'
import { formatResponse } from '../../outputparsers/OutputParserHelpers'
import { getFileFromStorage } from '../../../src'
import path from 'path'

class CSV_Agents implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    inputs: INodeParams[]

    constructor() {
        this.label = 'CSV Agent'
        this.name = 'csvAgent'
        this.version = 3.0
        this.type = 'AgentExecutor'
        this.category = 'Agents'
        this.icon = 'CSVagent.svg'
        this.description = 'Agent used to answer queries on CSV data'
        this.baseClasses = [this.type, ...getBaseClasses(AgentExecutor)]
        this.inputs = [
            {
                label: 'Csv File',
                name: 'csvFile',
                type: 'file',
                fileType: '.csv'
            },
            {
                label: 'Language Model',
                name: 'model',
                type: 'BaseLanguageModel'
            },
            {
                label: 'System Message',
                name: 'systemMessagePrompt',
                type: 'string',
                rows: 4,
                additionalParams: true,
                optional: true,
                placeholder:
                    'I want you to act as a document that I am having a conversation with. Your name is "AI Assistant". You will provide me with answers from the given info. If the answer is not included, say exactly "Hmm, I am not sure." and stop after that. Refuse to answer any question not about the info. Never break character.'
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
                label: 'Custom Pandas Read_CSV Code',
                description:
                    'Custom Pandas <a target="_blank" href="https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.read_csv.html">read_csv</a> function. Takes in an input: "csv_data"',
                name: 'customReadCSV',
                default: 'read_csv(csv_data)',
                type: 'code',
                optional: true,
                additionalParams: true
            }
        ]
    }

    async init(): Promise<any> {
        // Not used
        return undefined
    }

    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<string | object> {
        const csvFileBase64 = nodeData.inputs?.csvFile as string
        const model = nodeData.inputs?.model as BaseLanguageModel
        const systemMessagePrompt = nodeData.inputs?.systemMessagePrompt as string
        const moderations = nodeData.inputs?.inputModeration as Moderation[]
        const _customReadCSV = nodeData.inputs?.customReadCSV as string

        if (moderations && moderations.length > 0) {
            try {
                // Use the output of the moderation chain as input for the CSV agent
                input = await checkInputs(moderations, input)
            } catch (e) {
                await new Promise((resolve) => setTimeout(resolve, 500))
                // if (options.shouldStreamResponse) {
                //     streamResponse(options.sseStreamer, options.chatId, e.message)
                // }
                return formatResponse(e.message)
            }
        }

        const loggerHandler = new ConsoleCallbackHandler(options.logger, options?.orgId)
        const shouldStreamResponse = options.shouldStreamResponse
        const sseStreamer: IServerSideEventStreamer = options.sseStreamer as IServerSideEventStreamer
        const chatId = options.chatId

        const callbacks = await additionalCallbacks(nodeData, options)

        let files: string[] = []
        let base64String = ''

        if (csvFileBase64.startsWith('FILE-STORAGE::')) {
            const fileName = csvFileBase64.replace('FILE-STORAGE::', '')
            if (fileName.startsWith('[') && fileName.endsWith(']')) {
                files = JSON.parse(fileName)
            } else {
                files = [fileName]
            }
            const orgId = options.orgId
            const chatflowid = options.chatflowid

            for (const file of files) {
                if (!file) continue
                const fileData = await getFileFromStorage(file, orgId, chatflowid)
                base64String += fileData.toString('base64')
            }
        } else {
            if (csvFileBase64.startsWith('[') && csvFileBase64.endsWith(']')) {
                files = JSON.parse(csvFileBase64)
            } else {
                files = [csvFileBase64]
            }

            for (const file of files) {
                if (!file) continue
                const splitDataURI = file.split(',')
                splitDataURI.pop()
                base64String += splitDataURI.pop() ?? ''
            }
        }

        const pyodide = await LoadPyodide()

        // First load the csv file and get the dataframe dictionary of column types
        // For example using titanic.csv: {'PassengerId': 'int64', 'Survived': 'int64', 'Pclass': 'int64', 'Name': 'object', 'Sex': 'object', 'Age': 'float64', 'SibSp': 'int64', 'Parch': 'int64', 'Ticket': 'object', 'Fare': 'float64', 'Cabin': 'object', 'Embarked': 'object'}
        let dataframeColDict = ''
        let customReadCSVFunc = _customReadCSV ? _customReadCSV : 'read_csv(csv_data)'
        try {
            const code = `import pandas as pd
import base64
from io import StringIO
import json

base64_string = "${base64String}"

decoded_data = base64.b64decode(base64_string)

csv_data = StringIO(decoded_data.decode('utf-8'))

df = pd.${customReadCSVFunc}
my_dict = df.dtypes.astype(str).to_dict()
print(my_dict)
json.dumps(my_dict)`
            dataframeColDict = await pyodide.runPythonAsync(code)
        } catch (error) {
            throw new Error(error)
        }

        // Then tell GPT to come out with ONLY python code
        // For example: len(df), df[df['SibSp'] > 3]['PassengerId'].count()
        let pythonCode = ''
        if (dataframeColDict) {
            const chain = new LLMChain({
                llm: model,
                prompt: PromptTemplate.fromTemplate(systemPrompt),
                verbose: process.env.DEBUG === 'true' ? true : false
            })
            const inputs = {
                dict: dataframeColDict,
                question: input
            }

            // Track start time BEFORE LLM execution
            const startTime1 = Date.now()

            const res = await chain.call(inputs, [loggerHandler, ...callbacks])

            // Track end time AFTER LLM execution
            const endTime1 = Date.now()
            const timeDelta1 = endTime1 - startTime1

            // Track LLM usage for first chain call
            try {
                if (options.orgId && res) {
                    const llmUsageTrackerPath = path.resolve(__dirname, '../../../../server/src/utils/llm-usage-tracker')
                    const { trackLLMUsage, extractProviderAndModel, extractUsageMetadata } = await import(llmUsageTrackerPath)
                    const { provider, model: modelName } = extractProviderAndModel(nodeData, { model })
                    const { promptTokens, completionTokens, totalTokens } = extractUsageMetadata({
                        usageMetadata: res?.usageMetadata,
                        usage_metadata: res?.usage_metadata,
                        llmOutput: res?.llmOutput,
                        tokenUsage: res?.tokenUsage
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
                        nodeName: 'CSVAgent_CodeGen',
                        location: 'main_flow',
                        provider,
                        model: modelName,
                        requestType: 'chat',
                        promptTokens: promptTokens || 0,
                        completionTokens: completionTokens || 0,
                        totalTokens: totalTokens || 0,
                        processingTimeMs: timeDelta1,
                        responseLength: (res?.text as string)?.length || 0,
                        success: true,
                        cacheHit: false,
                        metadata: {}
                    })
                }
            } catch (trackError) {
                // Silently fail
            }

            pythonCode = res?.text
            // Regex to get rid of markdown code blocks syntax
            pythonCode = pythonCode.replace(/^```[a-z]+\n|\n```$/gm, '')
        }

        // Then run the code using Pyodide
        let finalResult = ''
        if (pythonCode) {
            try {
                const code = `import pandas as pd\n${pythonCode}`
                // TODO: get print console output
                finalResult = await pyodide.runPythonAsync(code)
            } catch (error) {
                throw new Error(`Sorry, I'm unable to find answer for question: "${input}" using following code: "${pythonCode}"`)
            }
        }

        // Finally, return a complete answer
        if (finalResult) {
            const chain = new LLMChain({
                llm: model,
                prompt: PromptTemplate.fromTemplate(
                    systemMessagePrompt ? `${systemMessagePrompt}\n${finalSystemPrompt}` : finalSystemPrompt
                ),
                verbose: process.env.DEBUG === 'true' ? true : false
            })
            const inputs = {
                question: input,
                answer: finalResult
            }

            // Track start time BEFORE LLM execution
            const startTime2 = Date.now()

            let result
            if (options.shouldStreamResponse) {
                const handler = new CustomChainHandler(shouldStreamResponse ? sseStreamer : undefined, chatId)
                result = await chain.call(inputs, [loggerHandler, handler, ...callbacks])
            } else {
                result = await chain.call(inputs, [loggerHandler, ...callbacks])
            }

            // Track end time AFTER LLM execution
            const endTime2 = Date.now()
            const timeDelta2 = endTime2 - startTime2

            // Track LLM usage for second chain call
            try {
                if (options.orgId && result) {
                    const llmUsageTrackerPath = path.resolve(__dirname, '../../../../server/src/utils/llm-usage-tracker')
                    const { trackLLMUsage, extractProviderAndModel, extractUsageMetadata } = await import(llmUsageTrackerPath)
                    const { provider, model: modelName } = extractProviderAndModel(nodeData, { model })
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
                        nodeName: 'CSVAgent_FinalAnswer',
                        location: 'main_flow',
                        provider,
                        model: modelName,
                        requestType: 'chat',
                        promptTokens: promptTokens || 0,
                        completionTokens: completionTokens || 0,
                        totalTokens: totalTokens || 0,
                        processingTimeMs: timeDelta2,
                        responseLength: (result?.text as string)?.length || 0,
                        success: true,
                        cacheHit: false,
                        metadata: {}
                    })
                }
            } catch (trackError) {
                // Silently fail
            }

            return result?.text
        }

        return pythonCode
    }
}

module.exports = { nodeClass: CSV_Agents }
