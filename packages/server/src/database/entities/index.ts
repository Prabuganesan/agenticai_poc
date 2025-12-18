import { ChatFlow } from './ChatFlow'
import { ChatMessage } from './ChatMessage'
import { ChatMessageFeedback } from './ChatMessageFeedback'
import { ChatSession } from './ChatSession'
import { Credential } from './Credential'
import { Tool } from './Tool'
import { Assistant } from './Assistant'
import { Variable } from './Variable'
import { DocumentStore } from './DocumentStore'
import { DocumentStoreFileChunk } from './DocumentStoreFileChunk'
import { UpsertHistory } from './UpsertHistory'
import { ApiKey } from './ApiKey'
import { CustomTemplate } from './CustomTemplate'
import { Execution } from './Execution'
import { LlmUsage } from './LlmUsage'
// Enterprise entities removed for autonomous server

export const entities = {
    ChatFlow,
    ChatMessage,
    ChatMessageFeedback,
    ChatSession,
    Credential,
    Tool,
    Assistant,
    Variable,
    UpsertHistory,
    DocumentStore,
    DocumentStoreFileChunk,
    ApiKey,
    CustomTemplate,
    Execution,
    LlmUsage
}
