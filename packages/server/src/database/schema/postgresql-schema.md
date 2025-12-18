# PostgreSQL Column Schema

This document contains all PostgreSQL CREATE TABLE statements with column definitions.
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
All tables use native database sequences for auto-increment primary keys. Sequences are created automatically at schema initialization.

**PostgreSQL Syntax:**
```sql
CREATE SEQUENCE IF NOT EXISTS auto_chat_flow_id_seq
    MINVALUE 1
    MAXVALUE 999999999
    START WITH 1
    INCREMENT BY 1
    NO CYCLE;
```
Each table has its own sequence named `{table_name}_id_seq`. The database type is detected from the `MAIN_DB_TYPE` environment variable.
## auto_chat_flow

```sql
CREATE TABLE IF NOT EXISTS auto_chat_flow (
    id NUMERIC NOT NULL DEFAULT NEXTVAL('auto_chat_flow_id_seq'),
    guid VARCHAR(15) NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(50),
    flowdata TEXT NOT NULL,
    deployed BOOL,
    ispublic BOOL,
    apikeyid VARCHAR(255),
    chatbotconfig TEXT,
    apiconfig TEXT,
    analytic TEXT,
    category TEXT,
    speechtotext TEXT,
    texttospeech TEXT,
    type VARCHAR(20),
    followupprompts TEXT,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_chat_flow_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT NEXTVAL('auto_chat_flow_id_seq')): Primary key (auto-increment)
- `guid` (VARCHAR(15), NOT NULL): Unique identifier (application-enforced)
- `name` (VARCHAR(255), NOT NULL): Chatflow name
- `display_name` (VARCHAR(50)): Display name for UI (auto-populated from name, max 50 chars)
- `flowdata` (TEXT, NOT NULL): JSON flow definition
- `deployed` (BOOL): Deployment status
- `ispublic` (BOOL): Public access flag
- `apikeyid` (VARCHAR(255)): Associated API key ID
- `chatbotconfig` (TEXT): Chatbot configuration JSON
- `apiconfig` (TEXT): API configuration JSON
- `analytic` (TEXT): Analytics configuration JSON
- `category` (TEXT): Category classification
- `speechtotext` (TEXT): Speech-to-text configuration JSON
- `texttospeech` (TEXT): Text-to-speech configuration JSON
- `type` (VARCHAR(20)): Flow type (CHATFLOW/AGENTFLOW)
- `followupprompts` (TEXT): Follow-up prompts JSON
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_chat_message

```sql
CREATE TABLE IF NOT EXISTS auto_chat_message (
    id NUMERIC NOT NULL DEFAULT NEXTVAL('auto_chat_message_id_seq'),
    guid VARCHAR(15) NOT NULL,
    role VARCHAR(4000) NOT NULL,
    chatflowid VARCHAR(15) NOT NULL,
    content TEXT NOT NULL,
    sourcedocuments TEXT,
    usedtools TEXT,
    fileannotations TEXT,
    fileuploads TEXT,
    agentreasoning TEXT,
    artifacts TEXT,
    action TEXT,
    chattype VARCHAR(4000) NOT NULL DEFAULT 'INTERNAL',
    chatid VARCHAR(4000) NOT NULL,
    memorytype VARCHAR(4000),
    sessionid VARCHAR(4000),
    executionid VARCHAR(15),
    followupprompts TEXT,
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
- `id` (NUMERIC, NOT NULL, DEFAULT NEXTVAL('auto_chat_message_id_seq')): Primary key (auto-increment)
- `guid` (VARCHAR(15), NOT NULL): Unique identifier (application-enforced)
- `role` (VARCHAR(4000), NOT NULL): Message role (user/assistant/system)
- `chatflowid` (VARCHAR(15), NOT NULL): Associated chatflow ID
- `content` (TEXT, NOT NULL): Message content
- `sourcedocuments` (TEXT): Source documents JSON
- `usedtools` (TEXT): Used tools JSON
- `fileannotations` (TEXT): File annotations JSON
- `fileuploads` (TEXT): File uploads JSON
- `agentreasoning` (TEXT): Agent reasoning JSON
- `artifacts` (TEXT): Artifacts JSON
- `action` (TEXT): Action type
- `chattype` (VARCHAR(4000), NOT NULL, DEFAULT 'INTERNAL'): Chat type (INTERNAL/EXTERNAL)
- `chatid` (VARCHAR(4000), NOT NULL): Chat session ID
- `memorytype` (VARCHAR(4000)): Memory type
- `sessionid` (VARCHAR(4000)): Session ID
- `executionid` (VARCHAR(15)): Execution ID for agentflows
- `followupprompts` (TEXT): Follow-up prompts JSON
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)

## auto_credential

```sql
CREATE TABLE IF NOT EXISTS auto_credential (
    id NUMERIC NOT NULL DEFAULT NEXTVAL('auto_credential_id_seq'),
    guid VARCHAR(15) NOT NULL,
    name VARCHAR(4000) NOT NULL,
    credentialname VARCHAR(4000) NOT NULL,
    encrypteddata TEXT NOT NULL,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_credential_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT NEXTVAL('auto_credential_id_seq')): Primary key (auto-increment)
- `guid` (VARCHAR(15), NOT NULL): Unique identifier (application-enforced)
- `name` (VARCHAR(4000), NOT NULL): Credential name
- `credentialname` (VARCHAR(4000), NOT NULL): Credential type name
- `encrypteddata` (TEXT, NOT NULL): Encrypted credential data
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_tool

```sql
CREATE TABLE IF NOT EXISTS auto_tool (
    id NUMERIC NOT NULL DEFAULT NEXTVAL('auto_tool_id_seq'),
    guid VARCHAR(15) NOT NULL,
    name VARCHAR(4000) NOT NULL,
    description TEXT NOT NULL,
    color VARCHAR(4000) NOT NULL,
    iconsrc VARCHAR(4000),
    schema TEXT,
    func TEXT,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_tool_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT NEXTVAL('auto_tool_id_seq')): Primary key (auto-increment)
- `guid` (VARCHAR(15), NOT NULL): Unique identifier (application-enforced)
- `name` (VARCHAR(4000), NOT NULL): Tool name
- `description` (TEXT, NOT NULL): Tool description
- `color` (VARCHAR(4000), NOT NULL): UI color
- `iconsrc` (VARCHAR(4000)): Icon source path
- `schema` (TEXT): Tool schema JSON
- `func` (TEXT): Tool function code
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_assistant

```sql
CREATE TABLE IF NOT EXISTS auto_assistant (
    id NUMERIC NOT NULL DEFAULT NEXTVAL('auto_assistant_id_seq'),
    guid VARCHAR(15) NOT NULL,
    display_name VARCHAR(50),
    details TEXT NOT NULL,
    credential VARCHAR(15),
    iconsrc VARCHAR(4000),
    type TEXT,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_assistant_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT NEXTVAL('auto_assistant_id_seq')): Primary key (auto-increment)
- `guid` (VARCHAR(15), NOT NULL): Unique identifier (application-enforced)
- `display_name` (VARCHAR(50)): Display name for UI (auto-populated from details.name JSON, max 50 chars)
- `details` (TEXT, NOT NULL): Assistant details JSON
- `credential` (VARCHAR(15)): Associated credential ID
- `iconsrc` (VARCHAR(4000)): Icon source path
- `type` (TEXT): Assistant type (OPENAI/CUSTOM)
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_variable

```sql
CREATE TABLE IF NOT EXISTS auto_variable (
    id NUMERIC NOT NULL DEFAULT NEXTVAL('auto_variable_id_seq'),
    guid VARCHAR(15) NOT NULL,
    name VARCHAR(4000) NOT NULL,
    value TEXT,
    type TEXT DEFAULT 'string',
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_variable_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT NEXTVAL('auto_variable_id_seq')): Primary key (auto-increment)
- `guid` (VARCHAR(15), NOT NULL): Unique identifier (application-enforced)
- `name` (VARCHAR(4000), NOT NULL): Variable name
- `value` (TEXT): Variable value
- `type` (TEXT, DEFAULT 'string'): Variable type
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_apikey

```sql
CREATE TABLE IF NOT EXISTS auto_apikey (
    id NUMERIC NOT NULL DEFAULT NEXTVAL('auto_apikey_id_seq'),
    guid VARCHAR(15) NOT NULL,
    apikey TEXT NOT NULL,
    apisecret TEXT NOT NULL,
    keyname TEXT NOT NULL,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_apikey_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX idx_auto_apikey_keyname ON auto_apikey(keyname);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT NEXTVAL('auto_apikey_id_seq')): Primary key (auto-increment)
- `guid` (VARCHAR(15), NOT NULL): Unique identifier (application-enforced)
- `apikey` (TEXT, NOT NULL): API key value
- `apisecret` (TEXT, NOT NULL): API secret value
- `keyname` (TEXT, NOT NULL): Key name/description
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_upsert_history

```sql
CREATE TABLE IF NOT EXISTS auto_upsert_history (
    id NUMERIC NOT NULL DEFAULT NEXTVAL('auto_upsert_history_id_seq'),
    guid VARCHAR(15) NOT NULL,
    chatflowid VARCHAR(15) NOT NULL,
    result TEXT NOT NULL,
    flowdata TEXT NOT NULL,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    CONSTRAINT auto_upsert_history_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_auto_upsert_history_created_on ON auto_upsert_history(created_on);
CREATE INDEX idx_auto_upsert_history_created_by ON auto_upsert_history(created_by);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT NEXTVAL('auto_upsert_history_id_seq')): Primary key (auto-increment)
- `guid` (VARCHAR(15), NOT NULL): Unique identifier (application-enforced)
- `chatflowid` (VARCHAR(15), NOT NULL): Associated chatflow ID
- `result` (TEXT, NOT NULL): Upsert result JSON
- `flowdata` (TEXT, NOT NULL): Flow data JSON
- `created_by` (NUMERIC, NOT NULL): Creator user ID (system user for automated upserts)
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)

## auto_chat_message_feedback

```sql
CREATE TABLE IF NOT EXISTS auto_chat_message_feedback (
    id NUMERIC NOT NULL DEFAULT NEXTVAL('auto_chat_message_feedback_id_seq'),
    guid VARCHAR(15) NOT NULL,
    chatflowid VARCHAR(15) NOT NULL,
    chatid VARCHAR(4000) NOT NULL,
    messageid VARCHAR(15) NOT NULL,
    rating VARCHAR(4000),
    content TEXT,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    CONSTRAINT auto_chat_message_feedback_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT NEXTVAL('auto_chat_message_feedback_id_seq')): Primary key (auto-increment)
- `guid` (VARCHAR(15), NOT NULL): Unique identifier (application-enforced)
- `chatflowid` (VARCHAR(15), NOT NULL): Associated chatflow ID
- `chatid` (VARCHAR(4000), NOT NULL): Chat session ID
- `messageid` (VARCHAR(15), NOT NULL): Message ID
- `rating` (VARCHAR(4000)): Rating value (e.g., "thumbsUp", "thumbsDown")
- `content` (TEXT): Feedback content
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)

## auto_document_store

```sql
CREATE TABLE IF NOT EXISTS auto_document_store (
    id NUMERIC NOT NULL DEFAULT NEXTVAL('auto_document_store_id_seq'),
    guid VARCHAR(15) NOT NULL,
    name TEXT NOT NULL,
    display_name VARCHAR(50),
    description TEXT,
    status VARCHAR(4000) NOT NULL,
    loaders TEXT,
    whereused TEXT,
    vectorstoreconfig TEXT,
    embeddingconfig TEXT,
    recordmanagerconfig TEXT,
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_document_store_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT NEXTVAL('auto_document_store_id_seq')): Primary key (auto-increment)
- `guid` (VARCHAR(15), NOT NULL): Unique identifier (application-enforced)
- `name` (TEXT, NOT NULL): Document store name
- `display_name` (VARCHAR(50)): Display name for UI (auto-populated from name, max 50 chars)
- `description` (TEXT): Description
- `status` (VARCHAR(4000), NOT NULL): Status (ACTIVE/STALE/PROCESSING)
- `loaders` (TEXT): Loaders configuration JSON
- `whereused` (TEXT): Where used information JSON
- `vectorstoreconfig` (TEXT): Vector store configuration JSON
- `embeddingconfig` (TEXT): Embedding configuration JSON
- `recordmanagerconfig` (TEXT): Record manager configuration JSON
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_document_store_file_chunk

```sql
CREATE TABLE IF NOT EXISTS auto_document_store_file_chunk (
    id NUMERIC NOT NULL DEFAULT NEXTVAL('auto_document_store_file_chunk_id_seq'),
    guid VARCHAR(15) NOT NULL,
    docid VARCHAR(15) NOT NULL,
    storeid VARCHAR(15) NOT NULL,
    chunkno INTEGER NOT NULL,
    pagecontent TEXT NOT NULL,
    metadata TEXT,
    CONSTRAINT auto_document_store_file_chunk_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_auto_document_store_file_chunk_docid ON auto_document_store_file_chunk(docid);
CREATE INDEX idx_auto_document_store_file_chunk_storeid ON auto_document_store_file_chunk(storeid);
CREATE INDEX idx_auto_document_store_file_chunk_store_doc ON auto_document_store_file_chunk(storeid, docid);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT NEXTVAL('auto_document_store_file_chunk_id_seq')): Primary key (auto-increment)
- `guid` (VARCHAR(15), NOT NULL): Unique identifier (application-enforced)
- `docid` (VARCHAR(15), NOT NULL): Document ID
- `storeid` (VARCHAR(15), NOT NULL): Document store ID
- `chunkno` (INTEGER, NOT NULL): Chunk number
- `pagecontent` (TEXT, NOT NULL): Chunk content
- `metadata` (TEXT): Chunk metadata JSON

## auto_custom_template

```sql
CREATE TABLE IF NOT EXISTS auto_custom_template (
    id NUMERIC NOT NULL DEFAULT NEXTVAL('auto_custom_template_id_seq'),
    guid VARCHAR(15) NOT NULL,
    name VARCHAR(4000) NOT NULL,
    flowdata TEXT NOT NULL,
    description VARCHAR(4000),
    badge VARCHAR(4000),
    framework VARCHAR(4000),
    usecases VARCHAR(4000),
    type VARCHAR(4000),
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    last_modified_by NUMERIC,
    last_modified_on NUMERIC(25,0),
    CONSTRAINT auto_custom_template_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT NEXTVAL('auto_custom_template_id_seq')): Primary key (auto-increment)
- `guid` (VARCHAR(15), NOT NULL): Unique identifier (application-enforced)
- `name` (VARCHAR(4000), NOT NULL): Template name
- `flowdata` (TEXT, NOT NULL): Flow data JSON
- `description` (VARCHAR(4000)): Template description
- `badge` (VARCHAR(4000)): Badge label
- `framework` (VARCHAR(4000)): Framework name
- `usecases` (VARCHAR(4000)): Use cases
- `type` (VARCHAR(4000)): Template type
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)

## auto_execution

```sql
CREATE TABLE IF NOT EXISTS auto_execution (
    id NUMERIC NOT NULL DEFAULT NEXTVAL('auto_execution_id_seq'),
    guid VARCHAR(15) NOT NULL,
    executiondata TEXT NOT NULL,
    action TEXT,
    state VARCHAR(4000) NOT NULL,
    agentflowid VARCHAR(15) NOT NULL,
    sessionid VARCHAR(4000) NOT NULL,
    ispublic BOOLEAN,
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
- `id` (NUMERIC, NOT NULL, DEFAULT NEXTVAL('auto_execution_id_seq')): Primary key (auto-increment)
- `guid` (VARCHAR(15), NOT NULL): Unique identifier (application-enforced)
- `executiondata` (TEXT, NOT NULL): Execution data JSON
- `action` (TEXT): Action type
- `state` (VARCHAR(4000), NOT NULL): Execution state
- `agentflowid` (VARCHAR(15), NOT NULL): Associated agentflow ID
- `sessionid` (VARCHAR(4000), NOT NULL): Session ID
- `ispublic` (BOOLEAN): Public access flag
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `last_modified_by` (NUMERIC): Last modifier user ID
- `last_modified_on` (NUMERIC(25,0)): Last modification timestamp (milliseconds)
- `stoppeddate` (NUMERIC(25,0)): Stopped timestamp (milliseconds) - only set when execution is stopped

## auto_sab_chat_session

```sql
CREATE TABLE IF NOT EXISTS auto_sab_chat_session (
    id NUMERIC NOT NULL DEFAULT NEXTVAL('auto_sab_chat_session_id_seq'),
    guid VARCHAR(15) NOT NULL,
    chatflowid VARCHAR(15) NOT NULL,
    chatid VARCHAR(4000) NOT NULL UNIQUE,
    title VARCHAR(255),
    created_by NUMERIC NOT NULL,
    created_on NUMERIC(25,0) NOT NULL,
    messagecount INTEGER NOT NULL DEFAULT 0,
    preview TEXT,
    CONSTRAINT auto_sab_chat_session_pkey PRIMARY KEY (id)
);
```

**Columns:**
- `id` (NUMERIC, NOT NULL, DEFAULT NEXTVAL('auto_sab_chat_session_id_seq')): Primary key (auto-increment)
- `guid` (VARCHAR(15), NOT NULL): Unique identifier (application-enforced)
- `chatflowid` (VARCHAR(15), NOT NULL): Associated chatflow ID
- `chatid` (VARCHAR(4000), NOT NULL, UNIQUE): Chat session ID (unique)
- `title` (VARCHAR(255)): Session title
- `created_by` (NUMERIC, NOT NULL): Creator user ID
- `created_on` (NUMERIC(25,0), NOT NULL): Creation timestamp (milliseconds)
- `messagecount` (INTEGER, NOT NULL, DEFAULT 0): Message count
- `preview` (TEXT): Session preview text

## auto_sab_llm_usage

```sql
CREATE TABLE IF NOT EXISTS auto_sab_llm_usage (
    id NUMERIC NOT NULL DEFAULT NEXTVAL('auto_sab_llm_usage_id_seq'),
    guid VARCHAR(15) NOT NULL,
    request_id VARCHAR(255) NOT NULL,
    execution_id VARCHAR(15),
    user_id VARCHAR(255) NOT NULL,
    chatflow_id VARCHAR(15),
    chat_id VARCHAR(255),
    session_id VARCHAR(255),
    feature VARCHAR(50) NOT NULL,
    node_id VARCHAR(255),
    node_type VARCHAR(100),
    node_name VARCHAR(255),
    location VARCHAR(255),
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    request_type VARCHAR(50),
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost DECIMAL(20,12) DEFAULT 0,
    processing_time_ms INTEGER,
    response_length INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    cache_hit BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
- `id` (NUMERIC, NOT NULL, DEFAULT NEXTVAL('auto_sab_llm_usage_id_seq')): Primary key (auto-increment)
- `guid` (VARCHAR(15), NOT NULL): Unique identifier (application-enforced)
- `request_id` (VARCHAR(255), NOT NULL): Request identifier
- `execution_id` (VARCHAR(15)): Execution ID for agentflows
- `user_id` (VARCHAR(255), NOT NULL): User ID who made the request
- `chatflow_id` (VARCHAR(15)): Associated chatflow ID
- `chat_id` (VARCHAR(255)): Chat session ID
- `session_id` (VARCHAR(255)): Session ID
- `feature` (VARCHAR(50), NOT NULL): Feature name (e.g., 'chatflow', 'agentflow')
- `node_id` (VARCHAR(255)): Node ID within the flow
- `node_type` (VARCHAR(100)): Node type (e.g., 'AgentExecutor', 'ChatOpenAI')
- `node_name` (VARCHAR(255)): Node name
- `location` (VARCHAR(255)): Location within flow (e.g., 'main_flow', 'sub_flow')
- `provider` (VARCHAR(50), NOT NULL): LLM provider (e.g., 'openai', 'google', 'anthropic')
- `model` (VARCHAR(100), NOT NULL): Model name (e.g., 'gpt-4', 'gemini-2.0-flash')
- `request_type` (VARCHAR(50)): Request type (e.g., 'chat', 'embedding')
- `prompt_tokens` (INTEGER, DEFAULT 0): Number of prompt/input tokens
- `completion_tokens` (INTEGER, DEFAULT 0): Number of completion/output tokens
- `total_tokens` (INTEGER, DEFAULT 0): Total tokens (prompt + completion)
- `cost` (DECIMAL(20,12), DEFAULT 0): Calculated cost in USD (uses DECIMAL(20,12) to store very small values without rounding to 0)
- `processing_time_ms` (INTEGER): Processing time in milliseconds
- `response_length` (INTEGER): Response length in characters
- `success` (BOOLEAN, DEFAULT true): Whether the request was successful
- `error_message` (TEXT): Error message if request failed
- `cache_hit` (BOOLEAN, DEFAULT false): Whether the response was served from cache
- `metadata` (JSONB): Additional metadata (streaming, tool calls, etc.)
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP): Creation timestamp
