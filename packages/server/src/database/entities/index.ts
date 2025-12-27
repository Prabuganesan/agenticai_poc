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
import { Schedule } from './Schedule'
import { ScheduleRun } from './ScheduleRun'
// Enterprise entities removed for kodivian server

export const entities = [
    Assistant,
    ChatFlow,
    ChatMessage,
    ChatMessageFeedback,
    Credential,
    Tool,
    Variable,
    CustomTemplate,
    ApiKey,
    Execution,
    DocumentStore,
    DocumentStoreFileChunk,
    UpsertHistory,
    ChatSession,
    LlmUsage,
    Schedule,
    ScheduleRun
]
