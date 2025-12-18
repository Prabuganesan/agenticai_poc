# Oracle Column Schema

This document contains all Oracle CREATE TABLE statements with column definitions.

## Table of Contents

1. [Tables](#tables)
   - [Native Sequences](#native-sequences)
   - [auto_chat_flow](#auto_chat_flow)
   - [auto_chat_message](#auto_chat_message)
   - [auto_credential](#auto_credential)
   - [auto_tool](#auto_tool)
   - [auto_assistant](#auto_assistant)
   - [auto_variable](#auto_variable)
   - [auto_apikey](#auto_apikey)
   - [auto_upsert_history](#auto_upsert_history)
   - [auto_chat_message_feedback](#auto_chat_message_feedback)
   - [auto_document_store](#auto_document_store)
   - [auto_document_store_file_chunk](#auto_document_store_file_chunk)
   - [auto_custom_template](#auto_custom_template)
   - [auto_execution](#auto_execution)
   - [auto_sab_chat_session](#auto_sab_chat_session)
   - [auto_sab_llm_usage](#auto_sab_llm_usage)
2. [Indexes](#indexes)

---

## Tables

### Native Sequences

**Oracle Syntax:**
```sql
CREATE SEQUENCE auto_chat_flow_id_seq
    MINVALUE 1
    MAXVALUE 999999999
    START WITH 1
    INCREMENT BY 1
    NOCACHE
    NOCYCLE;
```

**Usage in DEFAULT clause:**
- **PostgreSQL**: `DEFAULT NEXTVAL('auto_chat_flow_id_seq')`
- **Oracle**: `DEFAULT auto_chat_flow_id_seq.NEXTVAL`

Each table has its own sequence named `{table_name}_id_seq`. The database type is detected from the `MAIN_DB_TYPE` environment variable.

## auto_chat_flow

```sql
CREATE TABLE auto_chat_flow (
    id NUMERIC DEFAULT auto_chat_flow_id_seq.NEXTVAL NOT NULL,
    guid VARCHAR2(15) NOT NULL,
    name VARCHAR2(255) NOT NULL,
    display_name VARCHAR2(50),
    flowdata CLOB NOT NULL,
    deployed NUMBER(1),
    ispublic NUMBER(1),
    apikeyid VARCHAR2(255),
    chatbotconfig CLOB,
    apiconfig CLOB,
    analytic CLOB,
    category CLOB,
    speechtotext CLOB,
    texttospeech CLOB,
    type VARCHAR2(20),
    followupprompts CLOB,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_chat_flow_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT auto_chat_flow_id_seq.NEXTVAL): Primary key (auto-increment)
- `guid` (VARCHAR2(15), NOT NULL): Unique identifier (application-enforced)
- `name` (VARCHAR2(255), NOT NULL): Chatflow name
- `display_name` (VARCHAR2(50)): Display name for UI (auto-populated from name, max 50 chars)
- `flowdata` (CLOB, NOT NULL): JSON flow definition
- `deployed` (NUMBER(1)): Deployment status
- `ispublic` (NUMBER(1)): Public access flag
- `apikeyid` (VARCHAR2(255)): Associated API key ID
- `chatbotconfig` (CLOB): Chatbot configuration JSON
- `apiconfig` (CLOB): API configuration JSON
- `analytic` (CLOB): Analytics configuration JSON
- `category` (CLOB): Category classification
- `speechtotext` (CLOB): Speech-to-text configuration JSON
- `texttospeech` (CLOB): Text-to-speech configuration JSON
- `type` (VARCHAR2(20)): Flow type (CHATFLOW/AGENTFLOW)
- `followupprompts` (CLOB): Follow-up prompts JSON
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_chat_message

```sql
CREATE TABLE auto_chat_message (
    id NUMERIC DEFAULT auto_chat_message_id_seq.NEXTVAL NOT NULL,
    guid VARCHAR2(15) NOT NULL,
    role VARCHAR2(4000) NOT NULL,
    chatflowid VARCHAR2(15) NOT NULL,
    content CLOB NOT NULL,
    sourcedocuments CLOB,
    usedtools CLOB,
    fileannotations CLOB,
    fileuploads CLOB,
    agentreasoning CLOB,
    artifacts CLOB,
    action CLOB,
    chattype VARCHAR2(4000) NOT NULL DEFAULT 'INTERNAL',
    chatid VARCHAR2(4000) NOT NULL,
    memorytype VARCHAR2(4000),
    sessionid VARCHAR2(4000),
    executionid VARCHAR2(15),
    followupprompts CLOB,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    CONSTRAINT auto_chat_message_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_auto_chat_message_chatflowid ON auto_chat_message(chatflowid);
CREATE INDEX idx_auto_chat_message_executionid ON auto_chat_message(executionid);
CREATE INDEX idx_auto_chat_message_chatid ON auto_chat_message(chatid);
CREATE INDEX idx_auto_chat_message_sessionid ON auto_chat_message(sessionid);
CREATE INDEX idx_auto_chat_message_created_on ON auto_chat_message(created_on);
CREATE INDEX idx_auto_chat_message_chattype ON auto_chat_message(chattype);
CREATE INDEX idx_auto_chat_message_flow_date ON auto_chat_message(chatflowid, created_on);
CREATE INDEX idx_auto_chat_message_created_by ON auto_chat_message(created_by);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT auto_chat_message_id_seq.NEXTVAL): Primary key (auto-increment)
- `guid` (VARCHAR2(15), NOT NULL): Unique identifier (application-enforced)
- `role` (VARCHAR2(4000), NOT NULL): Message role (user/assistant/system)
- `chatflowid` (VARCHAR2(15), NOT NULL): Associated chatflow ID
- `content` (CLOB, NOT NULL): Message content
- `sourcedocuments` (CLOB): Source documents JSON
- `usedtools` (CLOB): Used tools JSON
- `fileannotations` (CLOB): File annotations JSON
- `fileuploads` (CLOB): File uploads JSON
- `agentreasoning` (CLOB): Agent reasoning JSON
- `artifacts` (CLOB): Artifacts JSON
- `action` (CLOB): Action type
- `chattype` (VARCHAR2(4000), NOT NULL, DEFAULT 'INTERNAL'): Chat type (INTERNAL/EXTERNAL)
- `chatid` (VARCHAR2(4000), NOT NULL): Chat session ID
- `memorytype` (VARCHAR2(4000)): Memory type
- `sessionid` (VARCHAR2(4000)): Session ID
- `executionid` (VARCHAR2(15)): Execution ID for agentflows
- `followupprompts` (CLOB): Follow-up prompts JSON
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)

## auto_credential

```sql
CREATE TABLE auto_credential (
    id NUMERIC DEFAULT auto_credential_id_seq.NEXTVAL NOT NULL,
    guid VARCHAR2(15) NOT NULL,
    name VARCHAR2(4000) NOT NULL,
    credentialname VARCHAR2(4000) NOT NULL,
    encrypteddata CLOB NOT NULL,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_credential_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT auto_credential_id_seq.NEXTVAL): Primary key (auto-increment)
- `guid` (VARCHAR2(15), NOT NULL): Unique identifier (application-enforced)
- `name` (VARCHAR2(4000), NOT NULL): Credential name
- `credentialname` (VARCHAR2(4000), NOT NULL): Credential type name
- `encrypteddata` (CLOB, NOT NULL): Encrypted credential data
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_tool

```sql
CREATE TABLE auto_tool (
    id NUMERIC DEFAULT auto_tool_id_seq.NEXTVAL NOT NULL,
    guid VARCHAR2(15) NOT NULL,
    name VARCHAR2(4000) NOT NULL,
    description CLOB NOT NULL,
    color VARCHAR2(4000) NOT NULL,
    iconsrc VARCHAR2(4000),
    schema CLOB,
    func CLOB,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_tool_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT auto_tool_id_seq.NEXTVAL): Primary key (auto-increment)
- `guid` (VARCHAR2(15), NOT NULL): Unique identifier (application-enforced)
- `name` (VARCHAR2(4000), NOT NULL): Tool name
- `description` (CLOB, NOT NULL): Tool description
- `color` (VARCHAR2(4000), NOT NULL): UI color
- `iconsrc` (VARCHAR2(4000)): Icon source path
- `schema` (CLOB): Tool schema JSON
- `func` (CLOB): Tool function code
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_assistant

```sql
CREATE TABLE auto_assistant (
    id NUMERIC DEFAULT auto_assistant_id_seq.NEXTVAL NOT NULL,
    guid VARCHAR2(15) NOT NULL,
    display_name VARCHAR2(50),
    details CLOB NOT NULL,
    credential VARCHAR2(15),
    iconsrc VARCHAR2(4000),
    type CLOB,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_assistant_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT auto_assistant_id_seq.NEXTVAL): Primary key (auto-increment)
- `guid` (VARCHAR2(15), NOT NULL): Unique identifier (application-enforced)
- `display_name` (VARCHAR2(50)): Display name for UI (auto-populated from details.name JSON, max 50 chars)
- `details` (CLOB, NOT NULL): Assistant details JSON
- `credential` (VARCHAR2(15)): Associated credential ID
- `iconsrc` (VARCHAR2(4000)): Icon source path
- `type` (CLOB): Assistant type (OPENAI/CUSTOM)
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_variable

```sql
CREATE TABLE auto_variable (
    id NUMERIC DEFAULT auto_variable_id_seq.NEXTVAL NOT NULL,
    guid VARCHAR2(15) NOT NULL,
    name VARCHAR2(4000) NOT NULL,
    value CLOB,
    type CLOB DEFAULT 'string',
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_variable_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT auto_variable_id_seq.NEXTVAL): Primary key (auto-increment)
- `guid` (VARCHAR2(15), NOT NULL): Unique identifier (application-enforced)
- `name` (VARCHAR2(4000), NOT NULL): Variable name
- `value` (CLOB): Variable value
- `type` (CLOB, DEFAULT 'string'): Variable type
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_apikey

```sql
CREATE TABLE auto_apikey (
    id NUMERIC DEFAULT auto_apikey_id_seq.NEXTVAL NOT NULL,
    guid VARCHAR2(15) NOT NULL,
    apikey CLOB NOT NULL,
    apisecret CLOB NOT NULL,
    keyname CLOB NOT NULL,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_apikey_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX idx_auto_apikey_keyname ON auto_apikey(keyname);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT auto_apikey_id_seq.NEXTVAL): Primary key (auto-increment)
- `guid` (VARCHAR2(15), NOT NULL): Unique identifier (application-enforced)
- `apikey` (CLOB, NOT NULL): API key value
- `apisecret` (CLOB, NOT NULL): API secret value
- `keyname` (CLOB, NOT NULL): Key name/description
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_upsert_history

```sql
CREATE TABLE auto_upsert_history (
    id NUMERIC DEFAULT auto_upsert_history_id_seq.NEXTVAL NOT NULL,
    guid VARCHAR2(15) NOT NULL,
    chatflowid VARCHAR2(15) NOT NULL,
    result CLOB NOT NULL,
    flowdata CLOB NOT NULL,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    CONSTRAINT auto_upsert_history_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_auto_upsert_history_created_on ON auto_upsert_history(created_on);
CREATE INDEX idx_auto_upsert_history_created_by ON auto_upsert_history(created_by);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT auto_upsert_history_id_seq.NEXTVAL): Primary key (auto-increment)
- `guid` (VARCHAR2(15), NOT NULL): Unique identifier (application-enforced)
- `chatflowid` (VARCHAR2(15), NOT NULL): Associated chatflow ID
- `result` (CLOB, NOT NULL): Upsert result JSON
- `flowdata` (CLOB, NOT NULL): Flow data JSON
- `created_by` (NUMERIC, NOT NULL): Creator user ID (system user for automated upserts)
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)

## auto_chat_message_feedback

```sql
CREATE TABLE auto_chat_message_feedback (
    id NUMERIC DEFAULT auto_chat_message_feedback_id_seq.NEXTVAL NOT NULL,
    guid VARCHAR2(15) NOT NULL,
    chatflowid VARCHAR2(15) NOT NULL,
    chatid VARCHAR2(4000) NOT NULL,
    messageid VARCHAR2(15) NOT NULL,
    rating VARCHAR2(4000),
    content CLOB,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    CONSTRAINT auto_chat_message_feedback_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT auto_chat_message_feedback_id_seq.NEXTVAL): Primary key (auto-increment)
- `guid` (VARCHAR2(15), NOT NULL): Unique identifier (application-enforced)
- `chatflowid` (VARCHAR2(15), NOT NULL): Associated chatflow ID
- `chatid` (VARCHAR2(4000), NOT NULL): Chat session ID
- `messageid` (VARCHAR2(15), NOT NULL): Message ID
- `rating` (VARCHAR2(4000)): Rating value (e.g., "thumbsUp", "thumbsDown")
- `content` (CLOB): Feedback content
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)

## auto_document_store

```sql
CREATE TABLE auto_document_store (
    id NUMERIC DEFAULT auto_document_store_id_seq.NEXTVAL NOT NULL,
    guid VARCHAR2(15) NOT NULL,
    name CLOB NOT NULL,
    display_name VARCHAR2(50),
    description CLOB,
    status VARCHAR2(4000) NOT NULL,
    loaders CLOB,
    whereused CLOB,
    vectorstoreconfig CLOB,
    embeddingconfig CLOB,
    recordmanagerconfig CLOB,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_document_store_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT auto_document_store_id_seq.NEXTVAL): Primary key (auto-increment)
- `guid` (VARCHAR2(15), NOT NULL): Unique identifier (application-enforced)
- `name` (CLOB, NOT NULL): Document store name
- `display_name` (VARCHAR2(50)): Display name for UI (auto-populated from name, max 50 chars)
- `description` (CLOB): Description
- `status` (VARCHAR2(4000), NOT NULL): Status (ACTIVE/STALE/PROCESSING)
- `loaders` (CLOB): Loaders configuration JSON
- `whereused` (CLOB): Where used information JSON
- `vectorstoreconfig` (CLOB): Vector store configuration JSON
- `embeddingconfig` (CLOB): Embedding configuration JSON
- `recordmanagerconfig` (CLOB): Record manager configuration JSON
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_document_store_file_chunk

```sql
CREATE TABLE auto_document_store_file_chunk (
    id NUMERIC DEFAULT auto_document_store_file_chunk_id_seq.NEXTVAL NOT NULL,
    guid VARCHAR2(15) NOT NULL,
    docid VARCHAR2(15) NOT NULL,
    storeid VARCHAR2(15) NOT NULL,
    chunkno NUMBER NOT NULL,
    pagecontent CLOB NOT NULL,
    metadata CLOB,
    CONSTRAINT auto_document_store_file_chunk_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_auto_document_store_file_chunk_docid ON auto_document_store_file_chunk(docid);
CREATE INDEX idx_auto_document_store_file_chunk_storeid ON auto_document_store_file_chunk(storeid);
CREATE INDEX idx_auto_document_store_file_chunk_store_doc ON auto_document_store_file_chunk(storeid, docid);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT auto_document_store_file_chunk_id_seq.NEXTVAL): Primary key (auto-increment)
- `guid` (VARCHAR2(15), NOT NULL): Unique identifier (application-enforced)
- `docid` (VARCHAR2(15), NOT NULL): Document ID
- `storeid` (VARCHAR2(15), NOT NULL): Document store ID
- `chunkno` (NUMBER, NOT NULL): Chunk number
- `pagecontent` (CLOB, NOT NULL): Chunk content
- `metadata` (CLOB): Chunk metadata JSON

## auto_custom_template

```sql
CREATE TABLE auto_custom_template (
    id NUMERIC DEFAULT auto_custom_template_id_seq.NEXTVAL NOT NULL,
    guid VARCHAR2(15) NOT NULL,
    name VARCHAR2(4000) NOT NULL,
    flowdata CLOB NOT NULL,
    description VARCHAR2(4000),
    badge VARCHAR2(4000),
    framework VARCHAR2(4000),
    usecases VARCHAR2(4000),
    type VARCHAR2(4000),
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_custom_template_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT auto_custom_template_id_seq.NEXTVAL): Primary key (auto-increment)
- `guid` (VARCHAR2(15), NOT NULL): Unique identifier (application-enforced)
- `name` (VARCHAR2(4000), NOT NULL): Template name
- `flowdata` (CLOB, NOT NULL): Flow data JSON
- `description` (VARCHAR2(4000)): Template description
- `badge` (VARCHAR2(4000)): Badge label
- `framework` (VARCHAR2(4000)): Framework name
- `usecases` (VARCHAR2(4000)): Use cases
- `type` (VARCHAR2(4000)): Template type
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_execution

```sql
CREATE TABLE auto_execution (
    id NUMERIC DEFAULT auto_execution_id_seq.NEXTVAL NOT NULL,
    guid VARCHAR2(15) NOT NULL,
    executiondata CLOB NOT NULL,
    action CLOB,
    state VARCHAR2(4000) NOT NULL,
    agentflowid VARCHAR2(15) NOT NULL,
    sessionid VARCHAR2(4000) NOT NULL,
    ispublic NUMBER(1),
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    stoppeddate NUMERIC(25,0),
    CONSTRAINT auto_execution_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_auto_execution_agentflowid ON auto_execution(agentflowid);
CREATE INDEX idx_auto_execution_sessionid ON auto_execution(sessionid);
CREATE INDEX idx_auto_execution_state ON auto_execution(state);
CREATE INDEX idx_auto_execution_created_on ON auto_execution(created_on);
CREATE INDEX idx_auto_execution_stoppeddate ON auto_execution(stoppeddate);
CREATE INDEX idx_auto_execution_created_by ON auto_execution(created_by);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT auto_execution_id_seq.NEXTVAL): Primary key (auto-increment)
- `guid` (VARCHAR2(15), NOT NULL): Unique identifier (application-enforced)
- `executiondata` (CLOB, NOT NULL): Execution data JSON
- `action` (CLOB): Action type
- `state` (VARCHAR2(4000), NOT NULL): Execution state
- `agentflowid` (VARCHAR2(15), NOT NULL): Associated agentflow ID
- `sessionid` (VARCHAR2(4000), NOT NULL): Session ID
- `ispublic` (NUMBER(1)): Public access flag
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)
- `stoppeddate` (NUMERIC(25,0)): Stopped timestamp (milliseconds) - only set when execution is stopped

## auto_sab_chat_session

```sql
CREATE TABLE auto_sab_chat_session (
    id NUMERIC DEFAULT auto_sab_chat_session_id_seq.NEXTVAL NOT NULL,
    guid VARCHAR2(15) NOT NULL,
    chatflowid VARCHAR2(15) NOT NULL,
    chatid VARCHAR2(4000) NOT NULL,
    title VARCHAR2(255),
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    messagecount NUMBER DEFAULT 0 NOT NULL,
    preview CLOB,
    CONSTRAINT auto_sab_chat_session_pkey PRIMARY KEY (id),
    CONSTRAINT auto_sab_chat_session_chatid_unique UNIQUE (chatid)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT auto_sab_chat_session_id_seq.NEXTVAL): Primary key (auto-increment)
- `guid` (VARCHAR2(15), NOT NULL): Unique identifier (application-enforced)
- `chatflowid` (VARCHAR2(15), NOT NULL): Associated chatflow ID
- `chatid` (VARCHAR2(4000), NOT NULL, UNIQUE): Chat session ID (unique)
- `title` (VARCHAR2(255)): Session title
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `messagecount` (NUMBER, NOT NULL, DEFAULT 0): Message count
- `preview` (CLOB): Session preview text

## auto_sab_llm_usage

```sql
CREATE TABLE auto_sab_llm_usage (
    id NUMERIC DEFAULT auto_sab_llm_usage_id_seq.NEXTVAL NOT NULL,
    guid VARCHAR2(15) NOT NULL,
    request_id VARCHAR2(255) NOT NULL,
    execution_id VARCHAR2(15),
    user_id VARCHAR2(255) NOT NULL,
    chatflow_id VARCHAR2(15),
    chat_id VARCHAR2(255),
    session_id VARCHAR2(255),
    feature VARCHAR2(50) NOT NULL,
    node_id VARCHAR2(255),
    node_type VARCHAR2(100),
    node_name VARCHAR2(255),
    location VARCHAR2(255),
    provider VARCHAR2(50) NOT NULL,
    model VARCHAR2(100) NOT NULL,
    request_type VARCHAR2(50),
    prompt_tokens NUMBER DEFAULT 0,
    completion_tokens NUMBER DEFAULT 0,
    total_tokens NUMBER DEFAULT 0,
    cost NUMBER(20,12) DEFAULT 0,
    processing_time_ms NUMBER,
    response_length NUMBER,
    success NUMBER(1) DEFAULT 1,
    error_message CLOB,
    cache_hit NUMBER(1) DEFAULT 0,
    metadata CLOB,
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT auto_sab_llm_usage_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_auto_sab_llm_usage_request_id ON auto_sab_llm_usage(request_id);
CREATE INDEX idx_auto_sab_llm_usage_execution_id ON auto_sab_llm_usage(execution_id);
CREATE INDEX idx_auto_sab_llm_usage_user_id ON auto_sab_llm_usage(user_id);
CREATE INDEX idx_auto_sab_llm_usage_chatflow_id ON auto_sab_llm_usage(chatflow_id);
CREATE INDEX idx_auto_sab_llm_usage_feature ON auto_sab_llm_usage(feature);
CREATE INDEX idx_auto_sab_llm_usage_created_at ON auto_sab_llm_usage(created_at);
CREATE INDEX idx_auto_sab_llm_usage_provider_model ON auto_sab_llm_usage(provider, model);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT auto_sab_llm_usage_id_seq.NEXTVAL): Primary key (auto-increment)
- `guid` (VARCHAR2(15), NOT NULL): Unique identifier (application-enforced)
- `request_id` (VARCHAR2(255), NOT NULL): Request identifier
- `execution_id` (VARCHAR2(15)): Execution ID for agentflows
- `user_id` (VARCHAR2(255), NOT NULL): User ID who made the request
- `chatflow_id` (VARCHAR2(15)): Associated chatflow ID
- `chat_id` (VARCHAR2(255)): Chat session ID
- `session_id` (VARCHAR2(255)): Session ID
- `feature` (VARCHAR2(50), NOT NULL): Feature name (e.g., 'chatflow', 'agentflow')
- `node_id` (VARCHAR2(255)): Node ID within the flow
- `node_type` (VARCHAR2(100)): Node type (e.g., 'AgentExecutor', 'ChatOpenAI')
- `node_name` (VARCHAR2(255)): Node name
- `location` (VARCHAR2(255)): Location within flow (e.g., 'main_flow', 'sub_flow')
- `provider` (VARCHAR2(50), NOT NULL): LLM provider (e.g., 'openai', 'google', 'anthropic')
- `model` (VARCHAR2(100), NOT NULL): Model name (e.g., 'gpt-4', 'gemini-2.0-flash')
- `request_type` (VARCHAR2(50)): Request type (e.g., 'chat', 'embedding')
- `prompt_tokens` (NUMBER, DEFAULT 0): Number of prompt/input tokens
- `completion_tokens` (NUMBER, DEFAULT 0): Number of completion/output tokens
- `total_tokens` (NUMBER, DEFAULT 0): Total tokens (prompt + completion)
- `cost` (NUMBER(20,12), DEFAULT 0): Calculated cost in USD (uses NUMBER(20,12) to store very small values without rounding to 0)
- `processing_time_ms` (NUMBER): Processing time in milliseconds
- `response_length` (NUMBER): Response length in characters
- `success` (NUMBER(1), DEFAULT 1): Whether the request was successful
- `error_message` (CLOB): Error message if request failed
- `cache_hit` (NUMBER(1), DEFAULT 0): Whether the response was served from cache
- `metadata` (CLOB): Additional metadata (streaming, tool calls, etc.)
- `created_at` (TIMESTAMP, DEFAULT SYSTIMESTAMP): Creation timestamp
