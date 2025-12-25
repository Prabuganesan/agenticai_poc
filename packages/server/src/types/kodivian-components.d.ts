/**
 * Type declarations for kodivian-components package
 *
 * These declarations are needed because the components package must be built
 * (npm run build) to generate proper type definitions in dist/src/index.d.ts.
 *
 * Until the package is built, TypeScript cannot resolve the types, but the
 * imports work correctly at runtime.
 *
 * To fix properly: cd ../components && npm run build
 */

declare module 'kodivian-components' {
    // Storage utilities
    export function addArrayFilesToStorage(
        mime: string,
        bf: Buffer,
        fileName: string,
        fileNames: string[],
        ...paths: string[]
    ): Promise<{ path: string; totalSize: number }>

    export function addSingleFileToStorage(
        mime: string,
        bf: Buffer,
        filename: string,
        ...paths: string[]
    ): Promise<{ path: string; totalSize: number }>

    export function getFileFromStorage(file: string, ...paths: string[]): Promise<Buffer>

    export function getFileFromUpload(filePath: string): Promise<Buffer>

    export function mapExtToInputField(ext: string): string

    export function mapMimeTypeToInputField(mimeType: string): string

    export function removeFilesFromStorage(...paths: string[]): Promise<{ totalSize: number }>

    export function removeSpecificFileFromStorage(...paths: string[]): Promise<{ totalSize: number }>

    export function removeSpecificFileFromUpload(filePath: string): Promise<void>

    export function removeFolderFromStorage(...paths: string[]): Promise<{ totalSize: number }>

    export function getFilesListFromStorage(...paths: string[]): Promise<Array<{ name: string; path: string; size: number }>>

    export function getStoragePath(): string

    export function streamStorageFile(chatflowid: string, chatId: string, fileName: string, orgId: string): Promise<any>

    export function getS3Config(): { s3Client: any; Bucket: string }

    export function addBase64FilesToStorage(
        fileBase64: string,
        chatflowid: string,
        fileNames: string[],
        orgId: string
    ): Promise<{ path: string; totalSize: number }>

    // Speech and text utilities
    export function convertSpeechToText(upload: IFileUpload, speechToTextConfig: ICommonObject, options: ICommonObject): Promise<any>

    export function convertTextToSpeechStream(
        text: string,
        textToSpeechConfig: ICommonObject,
        options: ICommonObject,
        abortController: AbortController,
        onStart: (format: string) => void,
        onChunk: (chunk: Buffer) => void,
        onEnd: () => void
    ): Promise<void>

    // Text processing utilities
    export function handleEscapeCharacters(input: any, reverse: boolean): any

    export function convertChatHistoryToText(chatHistory: IMessage[] | { content: string; role: string }[]): string

    // Follow-up prompts
    export function generateFollowUpPrompts(followUpPromptsConfig: any, apiMessageContent: string, options: ICommonObject): Promise<any>

    // Text-to-speech utilities
    export function getVoices(provider: string, credentialId: string, options: ICommonObject): Promise<any>

    // Agentflow generator
    export function generateAgentflowv2(config: Record<string, any>, question: string, options: ICommonObject): Promise<any>

    // Utility functions
    export function getInputVariables(paramValue: string): string[]

    export function getEncryptionKeyPath(): string

    export function getVersion(): Promise<{ version: string }>

    export function isValidUUID(uuid: string): boolean

    export function isPathTraversal(path: string): boolean

    // Web scraping utilities
    export function webCrawl(stringURL: string, limit: number): Promise<string[]>

    export function xmlScrape(currentURL: string, limit: number): Promise<string[]>

    export function checkDenyList(url: string): Promise<void>

    // Handler class
    export class AnalyticHandler {
        constructor(nodeData: any, options: ICommonObject)
        static getInstance(nodeData: any, options: ICommonObject): AnalyticHandler
        [key: string]: any
    }

    // Types (these should be imported from the actual package when built)
    export interface ICommonObject {
        [key: string]: any
    }

    export interface IDocument {
        pageContent: string
        metadata?: Record<string, any>
    }

    export type MessageType = 'apiMessage' | 'userMessage'

    export interface IMessage {
        message: string
        type: MessageType
        role?: MessageType
        content?: string
        [key: string]: any
    }

    export interface ICondition {
        [key: string]: any
    }

    export interface INodeOptionsValue {
        label: string
        name: string
        description?: string
        imageSrc?: string
    }

    export interface IUsedTool {
        tool: string
        toolInput: object
        toolOutput: string | object
        sourceDocuments?: ICommonObject[]
        error?: string
    }

    export interface IMultiAgentNode {
        node: any
        name: string
        label: string
        type: 'supervisor' | 'worker'
        [key: string]: any
    }

    export interface IAgentReasoning {
        [key: string]: any
    }

    export interface ITeamState {
        [key: string]: any
    }

    export interface ISeqAgentNode {
        [key: string]: any
    }

    export interface ISeqAgentsState {
        [key: string]: any
    }

    export class ConsoleCallbackHandler {
        constructor(logger: any, orgId?: string)
        [key: string]: any
    }

    export function additionalCallbacks(nodeData: any, options: ICommonObject): Promise<any>

    export interface IDatabaseEntity {
        [key: string]: any
    }

    export interface KodivianMemory {
        [key: string]: any
    }

    // Re-export other types that are used
    export type IAction = any
    export type IFileUpload = any
    export type IHumanInput = any
    export type INode = any
    export type INodeData = any
    export type INodeExecutionData = any
    export type INodeParams = any
    export type IServerSideEventStreamer = any
}
