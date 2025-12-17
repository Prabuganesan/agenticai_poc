import {
    IAction,
    ICommonObject,
    IFileUpload,
    IHumanInput,
    INode,
    INodeData as INodeDataFromComponent,
    INodeExecutionData,
    INodeParams,
    IServerSideEventStreamer
} from 'autonomous-components'
import { DataSource } from 'typeorm'
import { CachePool } from './CachePool'
import { UsageCacheManager } from './UsageCacheManager'

export type MessageType = 'apiMessage' | 'userMessage'

export type ChatflowType = 'CHATFLOW' | 'ASSISTANT' | 'AGENTFLOW'

export type AssistantType = 'CUSTOM' | 'OPENAI' | 'AZURE'

export type ExecutionState = 'INPROGRESS' | 'FINISHED' | 'ERROR' | 'TERMINATED' | 'TIMEOUT' | 'STOPPED'

export enum MODE {
    QUEUE = 'queue',
    MAIN = 'main'
}

export enum ChatType {
    INTERNAL = 'INTERNAL',
    EXTERNAL = 'EXTERNAL'
}

export enum ChatMessageRatingType {
    THUMBS_UP = 'THUMBS_UP',
    THUMBS_DOWN = 'THUMBS_DOWN'
}

export enum Platform {
    OPEN_SOURCE = 'open source',
    CLOUD = 'cloud',
    ENTERPRISE = 'enterprise'
}

export enum UserPlan {
    STARTER = 'STARTER',
    PRO = 'PRO',
    FREE = 'FREE'
}

/**
 * Databases
 */
export interface IChatFlow {
    id: number
    guid: string
    name: string
    display_name?: string
    flowData: string
    created_by: number
    created_on: number
    last_modified_by?: number
    last_modified_on?: number
    deployed?: boolean
    isPublic?: boolean
    apikeyid?: string
    analytic?: string
    speechToText?: string
    textToSpeech?: string
    chatbotConfig?: string
    followUpPrompts?: string
    apiConfig?: string
    category?: string
    type?: ChatflowType
}

export interface IChatMessage {
    id: number
    guid: string
    role: MessageType
    content: string
    chatflowid: string
    executionId?: string
    sourceDocuments?: string
    usedTools?: string
    fileAnnotations?: string
    agentReasoning?: string
    fileUploads?: string
    artifacts?: string
    chatType: string
    chatId: string
    memoryType?: string
    sessionId?: string
    created_by: number
    created_on: number
    action?: string | null
    followUpPrompts?: string
}

export interface IChatMessageFeedback {
    id: number
    guid: string
    content?: string
    chatflowid: string
    chatId: string
    messageId: string
    rating: ChatMessageRatingType
    created_by: number
    created_on: number
}

export interface IChatSession {
    id: number
    guid: string
    chatflowId: string
    chatId: string
    title?: string
    created_by: number
    created_on: number
    messageCount: number
    preview?: string
}

export interface ITool {
    id: number
    guid: string
    name: string
    description: string
    color: string
    iconSrc?: string
    schema?: string
    func?: string
    created_by: number
    created_on: number
    last_modified_by?: number
    last_modified_on?: number
}

export interface IAssistant {
    id: number
    guid: string
    display_name?: string
    details: string
    credential?: string
    iconSrc?: string
    created_by: number
    created_on: number
    last_modified_by?: number
    last_modified_on?: number
}

export interface ICredential {
    id: number
    guid: string
    name: string
    credentialName: string
    encryptedData: string
    created_by: number
    created_on: number
    last_modified_by?: number
    last_modified_on?: number
}

export interface IVariable {
    id: number
    guid: string
    name: string
    value: string
    type: string
    created_by: number
    created_on: number
    last_modified_by?: number
    last_modified_on?: number
}

export interface IUpsertHistory {
    id: number
    guid: string
    chatflowid: string
    result: string
    flowData: string
    created_by: number
    created_on: number
}

export interface IExecution {
    id: number
    guid: string
    executionData: string
    state: ExecutionState
    agentflowId: string
    sessionId: string
    isPublic?: boolean
    action?: string
    created_by: number
    created_on: number
    last_modified_by?: number
    last_modified_on?: number
    stoppedDate?: number
}

export interface IComponentNodes {
    [key: string]: INode
}

export interface IComponentCredentials {
    [key: string]: INode
}

export interface IVariableDict {
    [key: string]: string
}

export interface INodeDependencies {
    [key: string]: number
}

export interface INodeDirectedGraph {
    [key: string]: string[]
}

export interface INodeData extends INodeDataFromComponent {
    inputAnchors: INodeParams[]
    inputParams: INodeParams[]
    outputAnchors: INodeParams[]
}

export interface IReactFlowNode {
    id: string
    position: {
        x: number
        y: number
    }
    type: string
    data: INodeData
    positionAbsolute: {
        x: number
        y: number
    }
    z: number
    handleBounds: {
        source: any
        target: any
    }
    width: number
    height: number
    selected: boolean
    dragging: boolean
    parentNode?: string
    extent?: string
}

export interface IReactFlowEdge {
    source: string
    sourceHandle: string
    target: string
    targetHandle: string
    type: string
    id: string
    data: {
        label: string
    }
}

export interface IReactFlowObject {
    nodes: IReactFlowNode[]
    edges: IReactFlowEdge[]
    viewport: {
        x: number
        y: number
        zoom: number
    }
}

export interface IExploredNode {
    [key: string]: {
        remainingLoop: number
        lastSeenDepth: number
    }
}

export interface INodeQueue {
    nodeId: string
    depth: number
}

export interface IDepthQueue {
    [key: string]: number
}

export interface IAgentflowExecutedData {
    nodeLabel: string
    nodeId: string
    data: INodeExecutionData
    previousNodeIds: string[]
    status?: ExecutionState
}

export interface IMessage {
    message: string
    type: MessageType
    role?: MessageType
    content?: string
}

export interface IncomingInput {
    question: string
    overrideConfig?: ICommonObject
    chatId?: string
    sessionId?: string
    stopNodeId?: string
    uploads?: IFileUpload[]
    history?: IMessage[]
    action?: IAction
    streaming?: boolean
}

export interface IncomingAgentflowInput extends Omit<IncomingInput, 'question'> {
    question?: string
    form?: Record<string, any>
    humanInput?: IHumanInput
}

export interface IActiveChatflows {
    [key: string]: {
        startingNodes: IReactFlowNode[]
        endingNodeData?: INodeData
        inSync: boolean
        overrideConfig?: ICommonObject
        chatId?: string
    }
}

export interface IActiveCache {
    [key: string]: Map<any, any>
}

export interface IOverrideConfig {
    node: string
    nodeId: string
    label: string
    name: string
    type: string
    schema?: ICommonObject[] | Record<string, string>
}

export type ICredentialDataDecrypted = ICommonObject
// Re-export ICommonObject for use in other files
export type { ICommonObject } from 'autonomous-components'

// Plain credential object sent to server
export interface ICredentialReqBody {
    name: string
    credentialName: string
    plainDataObj: ICredentialDataDecrypted
    orgId?: string
}

// Decrypted credential object sent back to client
export interface ICredentialReturnResponse extends ICredential {
    plainDataObj: ICredentialDataDecrypted
}

export interface IUploadFileSizeAndTypes {
    fileTypes: string[]
    maxUploadSize: number
}

export interface IApiKey {
    id: number
    guid: string
    keyName: string
    apiKey: string
    apiSecret: string
    created_by: number
    created_on: number
    last_modified_by?: number
    last_modified_on?: number
    orgId?: string
}

export interface ICustomTemplate {
    id: number
    guid: string
    name: string
    flowData: string
    created_by: number
    created_on: number
    last_modified_by?: number
    last_modified_on?: number
    description?: string
    type?: string
    badge?: string
    framework?: string
    usecases?: string
    orgId?: string
}

export interface IFlowConfig {
    chatflowid: string
    chatflowId: string
    chatId: string
    sessionId: string
    chatHistory: IMessage[]
    apiMessageId: string
    overrideConfig?: ICommonObject
    state?: ICommonObject
    runtimeChatHistoryLength?: number
}

export interface IPredictionQueueAppServer {
    appDataSource: DataSource
    componentNodes: IComponentNodes
    sseStreamer: IServerSideEventStreamer
    cachePool: CachePool
    usageCacheManager: UsageCacheManager
}

export interface IExecuteFlowParams extends IPredictionQueueAppServer {
    incomingInput: IncomingInput
    chatflow: IChatFlow
    chatId: string
    orgId?: string
    productId: string
    baseURL: string
    isInternal: boolean
    signal?: AbortController
    files?: Express.Multer.File[]
    fileUploads?: IFileUpload[]
    uploadedFilesContent?: string
    isUpsert?: boolean
    isRecursive?: boolean
    parentExecutionId?: string
    iterationContext?: ICommonObject
    isTool?: boolean
}

export interface INodeOverrides {
    [key: string]: {
        label: string
        name: string
        type: string
        enabled: boolean
    }[]
}

export interface IVariableOverride {
    id: string
    name: string
    type: 'static' | 'runtime'
    enabled: boolean
}

// DocumentStore related
export * from './Interface.DocumentStore'
