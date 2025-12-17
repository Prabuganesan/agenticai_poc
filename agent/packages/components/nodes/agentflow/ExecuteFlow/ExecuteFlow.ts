import {
    ICommonObject,
    IDatabaseEntity,
    INode,
    INodeData,
    INodeOptionsValue,
    INodeParams,
    IServerSideEventStreamer
} from '../../../src/Interface'
import axios, { AxiosRequestConfig } from 'axios'
import { getCredentialData, getCredentialParam, processTemplateVariables, parseJsonBody } from '../../../src/utils'
import { getServerURL } from '../../../src/constants'
import { DataSource } from 'typeorm'
import { BaseMessageLike } from '@langchain/core/messages'
import { updateFlowState } from '../utils'
import { sanitizeErrorMessage } from '../../../src/error'

class ExecuteFlow_Agentflow implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    color: string
    baseClasses: string[]
    documentation?: string
    credential: INodeParams
    inputs: INodeParams[]

    constructor() {
        this.label = 'Execute Agent'
        this.name = 'executeFlowAgentflow'
        this.version = 1.1
        this.type = 'ExecuteFlow'
        this.category = 'Agent Flows'
        this.description = 'Execute another agent'
        this.baseClasses = [this.type]
        this.color = '#a3b18a'
        this.credential = {
            label: 'Connect Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['chatflowApi'],
            optional: true
        }
        this.inputs = [
            {
                label: 'Select Agent',
                name: 'executeFlowSelectedFlow',
                type: 'asyncOptions',
                loadMethod: 'listFlows'
            },
            {
                label: 'Input',
                name: 'executeFlowInput',
                type: 'string',
                rows: 4,
                acceptVariable: true
            },
            {
                label: 'Override Config',
                name: 'executeFlowOverrideConfig',
                description: 'Override the config passed to the agent',
                type: 'json',
                optional: true,
                acceptVariable: true
            },
            {
                label: 'Base URL',
                name: 'executeFlowBaseURL',
                type: 'string',
                description:
                    'Base URL to Autonomous. By default, it is the URL of the incoming request. Useful when you need to execute agent through an alternative route.',
                placeholder: getServerURL(),
                optional: true
            },
            {
                label: 'Return Response As',
                name: 'executeFlowReturnResponseAs',
                type: 'options',
                options: [
                    {
                        label: 'User Message',
                        name: 'userMessage'
                    },
                    {
                        label: 'Assistant Message',
                        name: 'assistantMessage'
                    }
                ],
                default: 'userMessage'
            },
            {
                label: 'Update Flow State',
                name: 'executeFlowUpdateState',
                description: 'Update runtime state during the execution of the workflow',
                type: 'array',
                optional: true,
                acceptVariable: true,
                array: [
                    {
                        label: 'Key',
                        name: 'key',
                        type: 'asyncOptions',
                        loadMethod: 'listRuntimeStateKeys'
                    },
                    {
                        label: 'Value',
                        name: 'value',
                        type: 'string',
                        acceptVariable: true,
                        acceptNodeOutputAsVariable: true
                    }
                ]
            }
        ]
    }

    //@ts-ignore
    loadMethods = {
        async listFlows(_: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            const appDataSource = options.appDataSource as DataSource
            const databaseEntities = options.databaseEntities as IDatabaseEntity
            if (appDataSource === undefined || !appDataSource) {
                return returnData
            }

            const searchOptions = options.searchOptions || {}

            // Extract userId from options - it might be in options.userId, options.incomingInput.userId, or from the parent agentflow context
            // userId extraction removed as it was unused

            // Build query options
            const queryOptions: any = {
                ...searchOptions,
                type: 'CHATFLOW'
            }

            // Only fetch agents (exclude AGENTFLOW)
            const chatflows = await appDataSource.getRepository(databaseEntities['ChatFlow']).findBy(queryOptions)

            for (let i = 0; i < chatflows.length; i += 1) {
                const data = {
                    label: chatflows[i].name,
                    name: chatflows[i].guid, // Use guid instead of id
                    description: 'Agent'
                } as INodeOptionsValue
                returnData.push(data)
            }

            // order by label
            return returnData.sort((a, b) => a.label.localeCompare(b.label))
        },
        async listRuntimeStateKeys(_: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const previousNodes = options.previousNodes as ICommonObject[]
            const startAgentflowNode = previousNodes.find((node) => node.name === 'startAgentflow')
            const state = startAgentflowNode?.inputs?.startState as ICommonObject[]
            return state.map((item) => ({ label: item.key, name: item.key }))
        }
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const baseURL = (nodeData.inputs?.executeFlowBaseURL as string) || (options.baseURL as string)
        const selectedFlowId = nodeData.inputs?.executeFlowSelectedFlow as string
        const flowInput = nodeData.inputs?.executeFlowInput as string
        const returnResponseAs = nodeData.inputs?.executeFlowReturnResponseAs as string
        const _executeFlowUpdateState = nodeData.inputs?.executeFlowUpdateState

        let overrideConfig = nodeData.inputs?.executeFlowOverrideConfig
        if (typeof overrideConfig === 'string' && overrideConfig.startsWith('{') && overrideConfig.endsWith('}')) {
            try {
                overrideConfig = parseJsonBody(overrideConfig)
            } catch (parseError) {
                throw new Error(`Invalid JSON in executeFlowOverrideConfig: ${parseError.message}`)
            }
        }

        const state = options.agentflowRuntime?.state as ICommonObject
        const runtimeChatHistory = (options.agentflowRuntime?.chatHistory as BaseMessageLike[]) ?? []
        const isLastNode = options.isLastNode as boolean
        const sseStreamer: IServerSideEventStreamer | undefined = options.sseStreamer

        try {
            const credentialData = await getCredentialData(nodeData.credential ?? '', options)
            const chatflowApiKey = getCredentialParam('chatflowApiKey', credentialData, nodeData)

            if (!selectedFlowId) {
                throw new Error('No agent selected. Please select an agent to execute.')
            }

            if (!baseURL) {
                throw new Error(
                    'Base URL is required. Please provide executeFlowBaseURL in node inputs or ensure baseURL is available in options.'
                )
            }

            if (selectedFlowId === options.chatflowid) throw new Error('Cannot call the same Multi-Agent!')

            let headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'autonomous-tool': 'true'
            }
            if (chatflowApiKey) headers = { ...headers, Authorization: `Bearer ${chatflowApiKey}` }

            // Add orgId to headers if available (required for per-organization database isolation)
            if (options.orgId) {
                headers['x-org-id'] = String(options.orgId)
            }

            // Add userId to headers if available (for user-based isolation in tool requests)
            // Extract userId from options - it might be in options.userId, options.incomingInput.userId, or from the parent agentflow context
            const userId = (options as any).userId || (options as any).user?.userId || (options as any).incomingInput?.userId
            if (userId) {
                headers['x-user-id'] = String(userId)
            }

            // Extract credentials from parent flow to pass to child agent
            // This allows child agents to access credentials when called via ExecuteFlow
            const parentCredentials: Record<string, string> = {}

            console.log('[CREDENTIAL DEBUG] ExecuteFlow - Checking for credentials in parent flow')
            console.log('[CREDENTIAL DEBUG] ExecuteFlow - options.reactFlowNodes exists:', !!options.reactFlowNodes)

            // Check if there are any credentials in the parent flow's reactFlowNodes
            if (options.reactFlowNodes && Array.isArray(options.reactFlowNodes)) {
                console.log('[CREDENTIAL DEBUG] ExecuteFlow - Number of nodes in parent flow:', options.reactFlowNodes.length)
                for (const node of options.reactFlowNodes) {
                    const nodeName = node.data?.name || 'unknown'
                    const nodeLabel = node.data?.label || 'unknown'
                    const nodeId = node.data?.id || node.id || 'unknown'
                    const hasCredential = !!(node.data && node.data.credential)
                    const credentialValue = node.data?.credential || 'none'

                    console.log(
                        `[CREDENTIAL DEBUG] ExecuteFlow - Node ${nodeId}: name="${nodeName}", label="${nodeLabel}", hasCredential=${hasCredential}, credential="${credentialValue}"`
                    )

                    // Extract credential from node data if it exists
                    if (node.data && node.data.credential) {
                        const credentialId = node.data.credential
                        if (credentialId && typeof credentialId === 'string') {
                            parentCredentials[nodeId] = credentialId
                            console.log(
                                `[CREDENTIAL DEBUG] ExecuteFlow - ✅ Extracted credential from node ${nodeName} (${nodeId}): ${credentialId}`
                            )
                        }
                    }
                }
            }

            console.log('[CREDENTIAL DEBUG] ExecuteFlow - Total credentials extracted:', Object.keys(parentCredentials).length)

            // Merge parent credentials into overrideConfig
            // Child flow will read these credentials and make them available to its nodes
            const enhancedOverrideConfig = {
                ...overrideConfig,
                // Store parent credentials under a special key
                _parentCredentials: Object.keys(parentCredentials).length > 0 ? parentCredentials : undefined
            }

            console.log(
                '[CREDENTIAL DEBUG] ExecuteFlow - Enhanced overrideConfig has _parentCredentials:',
                !!enhancedOverrideConfig._parentCredentials
            )

            const finalUrl = `${baseURL}/api/v1/prediction/${selectedFlowId}`
            const requestConfig: AxiosRequestConfig = {
                method: 'POST',
                url: finalUrl,
                headers,
                data: {
                    question: flowInput,
                    chatId: options.chatId,
                    overrideConfig: enhancedOverrideConfig
                }
            }

            const response = await axios(requestConfig)

            let resultText = ''
            if (response.data.text) resultText = response.data.text
            else if (response.data.json) resultText = '```json\n' + JSON.stringify(response.data.json, null, 2)
            else resultText = JSON.stringify(response.data, null, 2)

            if (isLastNode && sseStreamer) {
                sseStreamer.streamTokenEvent(options.chatId, resultText)
            }

            // Update flow state if needed
            let newState = { ...state }
            if (_executeFlowUpdateState && Array.isArray(_executeFlowUpdateState) && _executeFlowUpdateState.length > 0) {
                newState = updateFlowState(state, _executeFlowUpdateState)
            }

            // Process template variables in state
            newState = processTemplateVariables(newState, resultText)

            // Only add to runtime chat history if this is the first node
            const inputMessages = []
            if (!runtimeChatHistory.length) {
                inputMessages.push({ role: 'user', content: flowInput })
            }

            let returnRole = 'user'
            if (returnResponseAs === 'assistantMessage') {
                returnRole = 'assistant'
            }

            const returnOutput = {
                id: nodeData.id,
                name: this.name,
                input: {
                    messages: [
                        {
                            role: 'user',
                            content: flowInput
                        }
                    ]
                },
                output: {
                    content: resultText
                },
                state: newState,
                chatHistory: [
                    ...inputMessages,
                    {
                        role: returnRole,
                        content: resultText,
                        name: nodeData?.label ? nodeData?.label.toLowerCase().replace(/\s/g, '_').trim() : nodeData?.id
                    }
                ]
            }

            return returnOutput
        } catch (error) {
            // Log full error details server-side before sanitizing
            console.error('ExecuteFlow Error:', error)

            // Sanitize error message for frontend (full error already logged above)
            const sanitizedMessage = sanitizeErrorMessage(error)

            // Format error response
            const errorResponse: any = {
                id: nodeData.id,
                name: this.name,
                input: {
                    messages: [
                        {
                            role: 'user',
                            content: flowInput
                        }
                    ]
                },
                error: {
                    name: error.name || 'Error',
                    message: sanitizedMessage
                },
                state
            }

            // Add more error details if available (but sanitize sensitive data)
            if (error.response) {
                errorResponse.error.status = error.response.status
                errorResponse.error.statusText = error.response.statusText
                // Don't include response data/headers as they may contain sensitive info
            }

            throw new Error(sanitizedMessage)
        }
    }
}

module.exports = { nodeClass: ExecuteFlow_Agentflow }
