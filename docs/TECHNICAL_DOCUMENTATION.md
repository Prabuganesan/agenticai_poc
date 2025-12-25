# Kodivian Technical Documentation

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Database Architecture](#database-architecture)
4. [API Architecture](#api-architecture)
5. [Authentication & Security](#authentication--security)
6. [Node System](#node-system)
7. [Execution Engine](#execution-engine)
8. [Caching & Performance](#caching--performance)
9. [Queue System](#queue-system)
10. [Storage System](#storage-system)
11. [Logging & Monitoring](#logging--monitoring)
12. [Configuration & Environment](#configuration--environment)
13. [Deployment](#deployment)
14. [Code Structure](#code-structure)

---

## System Architecture

### Overview

Kodivian is a multi-tenant, enterprise-grade AI agent platform built with a microservices-oriented architecture. The system consists of three main packages:

1. **Server Package** (`packages/server`): Express.js backend with TypeScript
2. **UI Package** (`packages/ui`): React frontend with Material-UI
3. **Components Package** (`packages/components`): Shared node components and utilities

### Architecture Patterns

- **Monorepo Structure**: Uses workspace packages for code sharing
- **RESTful API**: Express.js REST API with TypeORM for database access
- **Component-Based Nodes**: Modular node system for extensibility
- **Queue-Based Processing**: BullMQ for async job processing
- **Multi-Database Support**: PostgreSQL and Oracle database support
- **Session Management**: Redis-based session storage with cookie authentication

### Core Components

#### 1. Application Server (`App` class)
- **Location**: `packages/server/src/index.ts`
- **Responsibilities**:
  - Express application initialization
  - Middleware configuration (CORS, security headers, rate limiting)
  - Database connection management
  - Session management (Redis/PostgreSQL)
  - Queue manager initialization
  - SSE (Server-Sent Events) streaming
  - Metrics provider setup (Prometheus/OpenTelemetry)

#### 2. Nodes Pool (`NodesPool` class)
- **Location**: `packages/server/src/NodesPool.ts`
- **Responsibilities**:
  - Dynamic node loading from `kodivian-components` package
  - Node registration and discovery
  - Credential management
  - Icon path resolution
  - Node filtering (disabled nodes, community nodes)

#### 3. Data Source Manager (`DataSourceManager`)
- **Location**: `packages/server/src/DataSourceManager.ts`
- **Responsibilities**:
  - Multi-database connection management
  - Database type detection (PostgreSQL/Oracle)
  - Connection pooling
  - Schema initialization

#### 4. Cache Pool (`CachePool`)
- **Location**: `packages/server/src/CachePool.ts`
- **Responsibilities**:
  - In-memory caching for nodes and credentials
  - Cache invalidation strategies
  - Performance optimization

#### 5. Abort Controller Pool (`AbortControllerPool`)
- **Location**: `packages/server/src/AbortControllerPool.ts`
- **Responsibilities**:
  - Request cancellation management
  - Timeout handling
  - Resource cleanup

---

## Technology Stack

### Backend

- **Runtime**: Node.js 22.21.1
- **Framework**: Express.js 4.18.3
- **Language**: TypeScript 5.5.2
- **ORM**: TypeORM 0.3.20
- **Databases**: PostgreSQL 8.11.3, Oracle (oracledb 6.3.0)
- **Queue**: BullMQ 5.45.2
- **Session Store**: Redis (ioredis 5.3.2), PostgreSQL (connect-pg-simple)
- **Authentication**: Passport.js (JWT, Local, Cookie)
- **Encryption**: CryptoJS 4.2.0 (AES), jsencrypt (RSA for E2E)
- **Logging**: Winston 3.12.0 with daily rotate file
- **Rate Limiting**: express-rate-limit 6.11.2, rate-limit-redis 4.2.0

### Frontend

- **Framework**: React 18.2.0
- **UI Library**: Material-UI (MUI) 5.15.0
- **State Management**: Redux Toolkit 2.2.7
- **Routing**: React Router 6.3.0
- **Build Tool**: Vite 5.1.6
- **Flow Editor**: ReactFlow 11.10.4
- **HTTP Client**: Axios 1.12.0
- **Code Editor**: CodeMirror (@uiw/react-codemirror 4.21.24)

### AI/ML Libraries

- **LangChain**: 0.3.6 (core framework)
- **OpenAI SDK**: 4.96.0
- **LangSmith**: 0.1.6 (tracing)
- **LangFuse**: 3.3.4 (observability)
- **Lunary**: 0.7.12 (analytics)
- **LangWatch**: 0.1.1 (monitoring)
- **OpenTelemetry**: 1.9.0 (distributed tracing)

### Additional Libraries

- **File Processing**: pdf-parse, mammoth, xlsx, officeparser
- **Vector Stores**: Pinecone, Qdrant, Weaviate, ChromaDB, Milvus
- **Embeddings**: OpenAI, Cohere, HuggingFace, Google Vertex AI
- **Document Loaders**: 90+ loaders for various formats
- **Tools**: 100+ tools for integrations (AWS, Google, Notion, etc.)

---

## Database Architecture

### Database Support

Kodivian supports two database types:
- **PostgreSQL**: Primary database (recommended)
- **Oracle**: Enterprise database support

### Schema Management

- **Location**: `packages/server/src/database/schema/startup-schema.ts`
- **Approach**: Schema-first with TypeORM entities
- **Sequences**: Auto-generated sequences for ID columns
- **Migrations**: Manual ALTER TABLE statements (no migration files)

### Core Tables

#### 1. `auto_chat_flow`
Stores chatflows, agentflows, and assistants.

**Columns**:
- `id` (NUMERIC): Primary key (sequence)
- `guid` (VARCHAR(15)): Unique identifier
- `name` (TEXT): Flow name
- `display_name` (VARCHAR(50)): Display name (auto-populated)
- `flowdata` (TEXT/CLOB): JSON flow definition
- `type` (VARCHAR(20)): `CHATFLOW`, `AGENTFLOW`, or `ASSISTANT`
- `deployed` (BOOL/NUMBER(1)): Deployment status
- `ispublic` (BOOL/NUMBER(1)): Public access flag
- `apikeyid` (VARCHAR): Associated API key
- `chatbotconfig` (TEXT/CLOB): Chatbot configuration JSON
- `apiconfig` (TEXT/CLOB): API configuration JSON
- `analytic` (TEXT/CLOB): Analytics configuration JSON
- `speechtotext` (TEXT/CLOB): Speech-to-text config JSON
- `texttospeech` (TEXT/CLOB): Text-to-speech config JSON
- `followupprompts` (TEXT/CLOB): Follow-up prompts JSON
- `category` (TEXT/CLOB): Flow category
- `created_by` (NUMERIC): User ID
- `created_on` (NUMERIC): Timestamp
- `last_modified_by` (NUMERIC): User ID
- `last_modified_on` (NUMERIC): Timestamp

**Indexes**:
- `created_by` (for user-based queries)
- Unique constraint on `name`

#### 2. `auto_chat_message`
Stores chat messages and conversation history.

**Columns**:
- `id` (NUMERIC): Primary key
- `guid` (VARCHAR(15)): Unique identifier
- `role` (VARCHAR): `apiMessage` or `userMessage`
- `content` (TEXT/CLOB): Message content
- `chatflowid` (VARCHAR(15)): Foreign key to `auto_chat_flow.guid`
- `executionid` (VARCHAR): Execution ID for agentflows
- `sourcedocuments` (TEXT/CLOB): Source documents JSON
- `usedtools` (TEXT/CLOB): Used tools JSON
- `fileannotations` (TEXT/CLOB): File annotations JSON
- `agentreasoning` (TEXT/CLOB): Agent reasoning JSON
- `fileuploads` (TEXT/CLOB): File uploads JSON
- `artifacts` (TEXT/CLOB): Artifacts JSON
- `chattype` (VARCHAR): `INTERNAL` or `EXTERNAL`
- `chatid` (VARCHAR): Chat session ID
- `memorytype` (VARCHAR): Memory type
- `sessionid` (VARCHAR): Session ID
- `created_by` (NUMERIC): User ID
- `created_on` (NUMERIC): Timestamp
- `action` (VARCHAR): Action type
- `followupprompts` (TEXT/CLOB): Follow-up prompts JSON

**Indexes**:
- `chatflowid`, `chatid`, `created_by`, `sessionid`

#### 3. `auto_execution`
Stores agentflow execution traces.

**Columns**:
- `id` (NUMERIC): Primary key
- `guid` (VARCHAR(15)): Unique identifier
- `executiondata` (TEXT/CLOB): Execution data JSON
- `state` (VARCHAR(50)): `INPROGRESS`, `FINISHED`, `ERROR`, `TERMINATED`, `TIMEOUT`, `STOPPED`
- `agentflowid` (VARCHAR(15)): Foreign key to `auto_chat_flow.guid`
- `sessionid` (VARCHAR): Foreign key to `auto_sab_chat_session.guid`
- `action` (TEXT/CLOB): Action data
- `ispublic` (BOOL/NUMBER(1)): Public access flag
- `created_by` (NUMERIC): User ID
- `created_on` (NUMERIC): Timestamp
- `stoppeddate` (NUMERIC): Stop timestamp

**Indexes**:
- `agentflowid`, `sessionid`, `created_by`

#### 4. `auto_assistant`
Stores AI assistants (OpenAI, Azure, Custom).

**Columns**:
- `id` (NUMERIC): Primary key
- `guid` (VARCHAR(15)): Unique identifier
- `display_name` (VARCHAR(50)): Display name (auto-populated)
- `details` (TEXT/CLOB): Assistant details JSON
- `credential` (VARCHAR(15)): Credential reference
- `iconsrc` (TEXT/CLOB): Icon source
- `type` (TEXT/CLOB): `CUSTOM`, `OPENAI`, or `AZURE`
- `created_by` (NUMERIC): User ID
- `created_on` (NUMERIC): Timestamp
- `last_modified_by` (NUMERIC): User ID
- `last_modified_on` (NUMERIC): Timestamp

**Indexes**:
- `created_by`

#### 5. `auto_document_store`
Stores document store configurations.

**Columns**:
- `id` (NUMERIC): Primary key
- `guid` (VARCHAR(15)): Unique identifier
- `name` (TEXT/CLOB): Store name
- `display_name` (VARCHAR(50)): Display name (auto-populated)
- `description` (TEXT/CLOB): Description
- `loaders` (TEXT/CLOB): Loader configuration JSON
- `whereused` (TEXT/CLOB): Usage tracking JSON
- `status` (TEXT/CLOB): `INITIALIZING`, `PROCESSING`, `READY`, `ERROR`
- `vectorstoreconfig` (TEXT/CLOB): Vector store config JSON
- `embeddingconfig` (TEXT/CLOB): Embedding config JSON
- `recordmanagerconfig` (TEXT/CLOB): Record manager config JSON
- `created_by` (NUMERIC): User ID
- `created_on` (NUMERIC): Timestamp
- `last_modified_by` (NUMERIC): User ID
- `last_modified_on` (NUMERIC): Timestamp

**Indexes**:
- `created_by`

#### 6. `auto_apikey`
Stores API keys for external access.

**Columns**:
- `id` (NUMERIC): Primary key
- `guid` (VARCHAR(15)): Unique identifier
- `apikey` (TEXT/CLOB): Hashed API key
- `apisecret` (TEXT/CLOB): Hashed API secret
- `keyname` (VARCHAR(500)): Key name (unique)
- `created_by` (NUMERIC): User ID
- `created_on` (NUMERIC): Timestamp
- `last_modified_by` (NUMERIC): User ID
- `last_modified_on` (NUMERIC): Timestamp

**Indexes**:
- `created_by`
- Unique constraint on `keyname`

#### 7. `auto_credential`
Stores encrypted credentials for node configurations.

**Columns**:
- `id` (NUMERIC): Primary key
- `guid` (VARCHAR(15)): Unique identifier
- `name` (TEXT/CLOB): Credential name
- `credentialname` (TEXT/CLOB): Credential type name
- `encrypteddata` (TEXT/CLOB): Encrypted credential data (AES)
- `created_by` (NUMERIC): User ID
- `created_on` (NUMERIC): Timestamp
- `last_modified_by` (NUMERIC): User ID
- `last_modified_on` (NUMERIC): Timestamp

**Indexes**:
- `created_by`

#### 8. `auto_tool`
Stores custom tools.

**Columns**:
- `id` (NUMERIC): Primary key
- `guid` (VARCHAR(15)): Unique identifier
- `name` (TEXT/CLOB): Tool name
- `description` (TEXT/CLOB): Tool description
- `color` (VARCHAR): Tool color
- `iconsrc` (TEXT/CLOB): Icon source
- `schema` (TEXT/CLOB): Tool schema JSON
- `func` (TEXT/CLOB): Tool function code
- `created_by` (NUMERIC): User ID
- `created_on` (NUMERIC): Timestamp
- `last_modified_by` (NUMERIC): User ID
- `last_modified_on` (NUMERIC): Timestamp

**Indexes**:
- `created_by`

#### 9. `auto_variable`
Stores global variables.

**Columns**:
- `id` (NUMERIC): Primary key
- `guid` (VARCHAR(15)): Unique identifier
- `key` (TEXT/CLOB): Variable key
- `value` (TEXT/CLOB): Variable value
- `type` (VARCHAR): Variable type
- `created_by` (NUMERIC): User ID
- `created_on` (NUMERIC): Timestamp
- `last_modified_by` (NUMERIC): User ID
- `last_modified_on` (NUMERIC): Timestamp

**Indexes**:
- `created_by`

#### 10. `auto_sab_chat_session`
Stores chat sessions.

**Columns**:
- `id` (NUMERIC): Primary key
- `guid` (VARCHAR(15)): Unique identifier
- `chatflowid` (VARCHAR(15)): Foreign key to `auto_chat_flow.guid`
- `chatid` (VARCHAR): Chat ID
- `title` (TEXT/CLOB): Session title
- `created_by` (NUMERIC): User ID
- `created_on` (NUMERIC): Timestamp
- `messagecount` (NUMERIC): Message count
- `preview` (TEXT/CLOB): Preview text

**Indexes**:
- `chatflowid`, `chatid`, `created_by`

#### 11. `auto_chat_message_feedback`
Stores message feedback (thumbs up/down).

**Columns**:
- `id` (NUMERIC): Primary key
- `guid` (VARCHAR(15)): Unique identifier
- `content` (TEXT/CLOB): Feedback content
- `chatflowid` (VARCHAR(15)): Foreign key to `auto_chat_flow.guid`
- `chatid` (VARCHAR): Chat ID
- `messageid` (VARCHAR): Message ID
- `rating` (VARCHAR): `THUMBS_UP` or `THUMBS_DOWN`
- `created_by` (NUMERIC): User ID
- `created_on` (NUMERIC): Timestamp

**Indexes**:
- `chatflowid`, `chatid`, `created_by`

#### 12. `auto_upsert_history`
Stores document upsert history.

**Columns**:
- `id` (NUMERIC): Primary key
- `guid` (VARCHAR(15)): Unique identifier
- `documentstoreid` (VARCHAR(15)): Foreign key to `auto_document_store.guid`
- `status` (VARCHAR): Status
- `loaders` (TEXT/CLOB): Loader config JSON
- `created_by` (NUMERIC): User ID
- `created_on` (NUMERIC): Timestamp

**Indexes**:
- `documentstoreid`, `created_by`

#### 13. `auto_sab_llm_usage`
Stores LLM usage statistics.

**Columns**:
- `id` (NUMERIC): Primary key
- `guid` (VARCHAR(15)): Unique identifier
- `chatflowid` (VARCHAR(15)): Foreign key to `auto_chat_flow.guid`
- `model` (VARCHAR): Model name
- `provider` (VARCHAR): Provider name
- `tokens` (NUMERIC): Token count
- `cost` (NUMERIC): Cost
- `created_by` (NUMERIC): User ID
- `created_on` (NUMERIC): Timestamp

**Indexes**:
- `chatflowid`, `created_by`, `created_on`

### Database Column Types

**Cross-Database Compatibility**:
- **TEXT**: PostgreSQL `TEXT`, Oracle `CLOB`
- **BOOL**: PostgreSQL `BOOL`, Oracle `NUMBER(1)`
- **VARCHAR**: Both support `VARCHAR` (with length)
- **NUMERIC**: Both support `NUMERIC` (with precision/scale)
- **Timestamps**: Stored as `NUMERIC` (Unix timestamp in milliseconds)

### Sequences

All tables use database sequences for ID generation:
- **PostgreSQL**: `CREATE SEQUENCE IF NOT EXISTS sequence_name`
- **Oracle**: `CREATE SEQUENCE sequence_name NOCACHE NOCYCLE`

---

## API Architecture

### API Structure

**Base Path**: `/api/v1`

All API routes are prefixed with `/api/v1` and organized by resource type.

### Authentication

Two authentication methods:

1. **Session-Based** (Browser):
   - Cookie: `AUTOID` (contains session token)
   - Redis/PostgreSQL session store
   - Middleware: `session-validation.middleware.ts`

2. **API Key-Based** (External):
   - Header: `X-API-KEY` (API key)
   - Header: `X-ORG-ID` (Organization ID)
   - Validation: `validateAPIKey()`, `validateFlowAPIKey()`

### Public Endpoints (No Authentication)

Defined in `WHITELIST_URLS`:
- `/api/v1/verify/apikey/`
- `/api/v1/public-chatflows`
- `/api/v1/public-chatbotConfig`
- `/api/v1/public-executions`
- `/api/v1/prediction/` (with API key)
- `/api/v1/vector/upsert/` (with API key)
- `/api/v1/ping`
- `/api/v1/version`
- `/api/v1/auth/login`
- `/api/v1/auth/resolve`
- `/api/v1/sessionhandler`

### Core API Endpoints

#### Chatflows (`/api/v1/chatflows`)

- `GET /`: Get all chatflows (paginated)
- `GET /:id`: Get chatflow by ID
- `POST /`: Create chatflow
- `PUT /:id`: Update chatflow
- `DELETE /:id`: Delete chatflow
- `GET /:id/is-valid-for-streaming`: Check if streaming is supported
- `GET /:id/is-valid-for-uploads`: Check if file uploads are supported
- `GET /apikey/:id`: Get chatflow with API key validation

**Controller**: `packages/server/src/controllers/chatflows/index.ts`
**Service**: `packages/server/src/services/chatflows/index.ts`

#### Agentflows (`/api/v1/chatflows` with `type=AGENTFLOW`)

Same endpoints as chatflows, filtered by `type=AGENTFLOW`.

#### Predictions (`/api/v1/prediction/:id`)

- `POST /:id`: Execute chatflow/agentflow prediction
  - **Streaming**: `streaming=true` in body → SSE response
  - **Non-streaming**: Standard JSON response
  - **Queue Mode**: Uses BullMQ for async processing

**Controller**: `packages/server/src/controllers/predictions/index.ts`
**Service**: `packages/server/src/services/predictions/index.ts`

#### Chat Messages (`/api/v1/chatmessage`)

- `GET /`: Get messages (with filters: chatflowid, chatid, sessionid)
- `POST /`: Create message
- `PUT /:id`: Update message
- `DELETE /:id`: Delete message
- `GET /:id`: Get message by ID

**Controller**: `packages/server/src/controllers/chat-messages/index.ts`
**Service**: `packages/server/src/services/chat-messages/index.ts`

#### Chat Sessions (`/api/v1/chat-sessions`)

- `GET /`: Get all sessions (paginated)
- `GET /:id`: Get session by ID
- `POST /`: Create session
- `PUT /:id`: Update session
- `DELETE /:id`: Delete session

**Controller**: `packages/server/src/controllers/chat-sessions/index.ts`
**Service**: `packages/server/src/services/chat-sessions/index.ts`

#### Executions (`/api/v1/executions`)

- `GET /`: Get executions (paginated, filtered by agentflowid, sessionid)
- `GET /:id`: Get execution by ID
- `POST /`: Create execution
- `PUT /:id`: Update execution
- `DELETE /:id`: Delete execution
- `POST /:id/stop`: Stop execution

**Controller**: `packages/server/src/controllers/executions/index.ts`
**Service**: `packages/server/src/services/executions/index.ts`

#### Assistants (`/api/v1/assistants`)

- `GET /`: Get all assistants (filtered by type: CUSTOM, OPENAI, AZURE)
- `GET /:id`: Get assistant by ID
- `POST /`: Create assistant
- `PUT /:id`: Update assistant
- `DELETE /:id`: Delete assistant
- `GET /:id/document-stores`: Get document stores for assistant

**Controller**: `packages/server/src/controllers/assistants/index.ts`
**Service**: `packages/server/src/services/assistants/index.ts`

#### Document Stores (`/api/v1/document-store`)

- `GET /`: Get all document stores
- `GET /:id`: Get document store by ID
- `POST /`: Create document store
- `PUT /:id`: Update document store
- `DELETE /:id`: Delete document store
- `POST /:id/upsert`: Upsert documents
- `GET /:id/chunks`: Get document chunks
- `GET /:id/upsert-history`: Get upsert history

**Controller**: `packages/server/src/controllers/documentstore/index.ts`
**Service**: `packages/server/src/services/documentstore/index.ts`

#### API Keys (`/api/v1/apikey`)

- `GET /`: Get all API keys
- `GET /:id`: Get API key by ID
- `POST /`: Create API key
- `PUT /:id`: Update API key
- `DELETE /:id`: Delete API key
- `POST /verify`: Verify API key

**Controller**: `packages/server/src/controllers/apikey/index.ts`
**Service**: `packages/server/src/services/apikey/index.ts`

#### Credentials (`/api/v1/credentials`)

- `GET /`: Get all credentials
- `GET /:id`: Get credential by ID
- `POST /`: Create credential
- `PUT /:id`: Update credential
- `DELETE /:id`: Delete credential

**Controller**: `packages/server/src/controllers/credentials/index.ts`
**Service**: `packages/server/src/services/credentials/index.ts`

#### Tools (`/api/v1/tools`)

- `GET /`: Get all tools
- `GET /:id`: Get tool by ID
- `POST /`: Create tool
- `PUT /:id`: Update tool
- `DELETE /:id`: Delete tool

**Controller**: `packages/server/src/controllers/tools/index.ts`
**Service**: `packages/server/src/services/tools/index.ts`

#### Variables (`/api/v1/variables`)

- `GET /`: Get all variables
- `GET /:id`: Get variable by ID
- `POST /`: Create variable
- `PUT /:id`: Update variable
- `DELETE /:id`: Delete variable

**Controller**: `packages/server/src/controllers/variables/index.ts`
**Service**: `packages/server/src/services/variables/index.ts`

#### Nodes (`/api/v1/nodes`)

- `GET /`: Get all available nodes
- `GET /category/:category`: Get nodes by category
- `GET /:name`: Get node by name

**Controller**: `packages/server/src/controllers/nodes/index.ts`
**Service**: `packages/server/src/services/nodes/index.ts`

#### Streaming (`/api/v1/chatflows-streaming`)

- `GET /:id`: Check if chatflow supports streaming
- `POST /:id`: Stream chatflow execution (SSE)

**Controller**: `packages/server/src/controllers/chatflows-streaming/index.ts`

#### File Uploads (`/api/v1/chatflows-uploads`)

- `GET /:id`: Check if chatflow supports file uploads
- `POST /:id`: Upload files for chatflow

**Controller**: `packages/server/src/controllers/chatflows-uploads/index.ts`

#### LLM Usage (`/api/v1/llm-usage`)

- `GET /`: Get LLM usage statistics (with filters: date range, model, provider)
- `GET /overview`: Get usage overview

**Controller**: `packages/server/src/controllers/llm-usage/index.ts`
**Service**: `packages/server/src/services/llm-usage/index.ts`

### Request/Response Format

**Standard Response**:
```json
{
  "status": "success" | "error",
  "data": { ... },
  "message": "Optional message"
}
```

**Paginated Response**:
```json
{
  "status": "success",
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**Error Response**:
```json
{
  "status": "error",
  "message": "Error message",
  "code": "ERROR_CODE"
}
```

### Rate Limiting

- **API Key Rate Limiting**: `apiKeyRateLimitMiddleware`
  - Default: 100 requests per 15 minutes per API key
  - Configurable via environment variables

- **General Rate Limiting**: `RateLimiterManager`
  - Per-route rate limits
  - Redis-backed for distributed systems

---

## Authentication & Security

### Authentication Methods

#### 1. Session-Based Authentication

**Flow**:
1. User logs in via `/api/v1/auth/login`
2. Server creates session in Redis/PostgreSQL
3. Session token stored in cookie: `AUTOID`
4. Middleware validates session on each request
5. Session extended on activity (TTL refresh)

**Session Format**:
```
AUTOID=<session_token>; Path=/; HttpOnly; Secure; SameSite=Strict
```

**Session Storage**:
- **Redis**: `ioredis` with `connect-redis`
- **PostgreSQL**: `connect-pg-simple` (fallback)
- **Key Format**: `sess:<session_token>`
- **TTL**: 24 hours (extended on activity)

**Middleware**: `packages/server/src/middlewares/session-validation.middleware.ts`

#### 2. API Key Authentication

**Flow**:
1. User creates API key via `/api/v1/apikey` (POST)
2. Server generates:
   - API Key: `randomBytes(32).toString('hex')`
   - API Secret: `scryptSync(apiKey, salt, 64).toString('hex')`
3. Both hashed and stored in `auto_apikey` table
4. External client sends:
   - Header: `X-API-KEY: <api_key>`
   - Header: `X-ORG-ID: <org_id>`
5. Server validates via `validateAPIKey()` or `validateFlowAPIKey()`

**API Key Generation**:
```typescript
// Location: packages/server/src/services/apikey/index.ts
const apiKey = randomBytes(32).toString('hex')
const apiSecret = scryptSync(apiKey, salt, 64).toString('hex')
```

**Validation**:
- `validateAPIKey()`: Validates API key for general API access
- `validateFlowAPIKey()`: Validates API key for specific chatflow/agentflow

**Rate Limiting**: Per API key (100 requests/15min default)

### Encryption

#### 1. Credential Encryption

**Algorithm**: AES-256 (CryptoJS)
**Key Source**: `encryption.key` file (`.kodivian/encryption.key`)

**Flow**:
1. Credential data encrypted before database storage
2. Encryption key loaded from `encryption.key` file
3. Decryption happens during node execution
4. Key file created automatically on first run

**Key File**:
- **Location**: `.kodivian/encryption.key` (relative to `KODIVIAN_DATA_PATH`)
- **Format**: 32-byte random key (hex encoded)
- **Creation**: Cluster-safe creation with `wx` flag
- **Permissions**: 600 (owner read/write only)

**Functions**:
- `encryptCredentialData()`: Encrypt credential data
- `decryptCredentialData()`: Decrypt credential data
- `getEncryptionKey()`: Load encryption key from file

**Location**: `packages/server/src/utils/crypto.ts`

#### 2. End-to-End Encryption (E2E)

**Algorithm**: RSA + AES-256-GCM
**Purpose**: Encrypt API request/response payloads

**Flow**:
1. Client generates RSA key pair
2. Client sends public key to server
3. Server generates AES-256-GCM session key
4. Server encrypts session key with client's public key
5. Server encrypts response with AES session key
6. Client decrypts session key with private key
7. Client decrypts response with AES session key

**Middleware**:
- `decryptRequestMiddleware`: Decrypts incoming requests
- `encryptResponseMiddleware`: Encrypts outgoing responses

**Location**: `packages/server/src/middleware/encryption.ts`

### Security Features

#### 1. Security Headers

**Middleware**: `securityHeadersMiddleware`
**Headers Set**:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`
- `Content-Security-Policy: ...`

**Location**: `packages/server/src/utils/securityHeaders.ts`

#### 2. XSS Protection

**Middleware**: `sanitizeMiddleware`
**Libraries**: `sanitize-html`, `dompurify`
**Sanitization**: HTML content sanitized before storage/display

**Location**: `packages/server/src/utils/XSS.ts`

#### 3. CORS Configuration

**Middleware**: `cors(getCorsOptions())`
**Options**:
- Allowed origins: Configurable via environment
- Credentials: `true` (for cookies)
- Methods: `GET, POST, PUT, DELETE, OPTIONS`
- Headers: `Content-Type, Authorization, X-API-KEY, X-ORG-ID`

**Location**: `packages/server/src/utils/XSS.ts`

#### 4. Iframe Origins

**Configuration**: `getAllowedIframeOrigins()`
**Purpose**: Control which origins can embed chatbots
**Storage**: Per-chatflow configuration in `chatbotConfig.allowedOrigins`

#### 5. Security Logging

**Function**: `securityLog()`
**Events Logged**:
- Failed authentication attempts
- API key validation failures
- Rate limit violations
- Suspicious activity

**Location**: `packages/server/src/utils/logger/security-helper.ts`

### Multi-Tenancy

**Organization Isolation**:
- All resources filtered by `orgId`
- API keys scoped to organization
- Session tokens include `orgId`
- Database queries include `orgId` filter

**User Isolation** (Optional):
- Resources can be filtered by `created_by` (userId)
- API keys can be user-specific
- Chat messages scoped to user

**Implementation**:
- Middleware sets `req.orgId` and `req.userId`
- Services filter queries by `orgId` and optionally `userId`
- Controllers validate `orgId` presence

---

## Node System

### Node Architecture

**Location**: `packages/components/nodes/`

Nodes are modular components that perform specific tasks in a flow. Each node:
1. Extends a base node class
2. Defines input/output parameters
3. Implements execution logic
4. Supports credential management

### Node Categories

1. **Agents** (`nodes/agents/`): AI agents (ReAct, Plan-and-Execute, etc.)
2. **LLMs** (`nodes/llms/`): Language models (OpenAI, Anthropic, etc.)
3. **Chat Models** (`nodes/chatmodels/`): Chat-specific models
4. **Embeddings** (`nodes/embeddings/`): Embedding models
5. **Vector Stores** (`nodes/vectorstores/`): Vector databases
6. **Document Loaders** (`nodes/documentloaders/`): Document loading (90+ loaders)
7. **Text Splitters** (`nodes/textsplitters/`): Text chunking strategies
8. **Retrievers** (`nodes/retrievers/`): Retrieval strategies
9. **Tools** (`nodes/tools/`): 100+ tools (AWS, Google, Notion, etc.)
10. **Chains** (`nodes/chains/`): LangChain chains
11. **Memory** (`nodes/memory/`): Conversation memory
12. **Analytics** (`nodes/analytic/`): Observability (LangSmith, LangFuse, etc.)
13. **Cache** (`nodes/cache/`): Caching strategies
14. **Prompts** (`nodes/prompts/`): Prompt templates
15. **Output Parsers** (`nodes/outputparsers/`): Response parsing
16. **Utilities** (`nodes/utilities/`): Utility nodes

### Node Structure

**Base Node Class**:
```typescript
class BaseNode {
  label: string
  name: string
  type: string
  icon: string
  category: string
  description: string
  baseClasses: string[]
  inputs: INodeParams[]
  outputs: INodeOutput[]
  credential?: ICredentialDataDecrypted
}
```

**Node Registration**:
- Nodes loaded dynamically from `kodivian-components` package
- Registered in `NodesPool.componentNodes`
- Filtered by:
  - Disabled nodes (`DISABLED_NODES` env var)
  - Community nodes (`showCommunityNodes` config)
  - Category exclusions

**Location**: `packages/server/src/NodesPool.ts`

### Node Execution

**Flow Execution**:
1. Flow definition parsed from `flowData` JSON
2. Nodes loaded from `NodesPool`
3. Graph constructed from nodes and edges
4. Execution starts from starting nodes
5. Each node executed with inputs from previous nodes
6. Outputs passed to connected nodes
7. Execution completes at ending nodes

**Execution Engines**:
- **Chatflow**: `buildChatflow()` - Sequential execution
- **Agentflow**: `executeAgentFlow()` - Parallel execution with conditional logic

**Location**:
- Chatflow: `packages/server/src/utils/buildChatflow.ts`
- Agentflow: `packages/server/src/utils/buildAgentflow.ts`

---

## Execution Engine

### Chatflow Execution

**Engine**: `buildChatflow()`
**Type**: Sequential, depth-first traversal
**Flow**:
1. Parse flow definition (`flowData` JSON)
2. Resolve variables
3. Load chat history (if memory node present)
4. Find starting nodes (no incoming edges)
5. Execute nodes in dependency order
6. Stream responses (if streaming enabled)
7. Save chat messages
8. Return final response

**Features**:
- Variable resolution (`{{variable}}`)
- Memory integration
- Streaming support (SSE)
- File uploads
- Follow-up prompts
- Source documents
- Tool usage tracking

**Location**: `packages/server/src/utils/buildChatflow.ts`

### Agentflow Execution

**Engine**: `executeAgentFlow()`
**Type**: Parallel execution with conditional logic
**Flow**:
1. Parse agentflow definition
2. Construct directed graph
3. Find starting node (single entry point)
4. Execute nodes in parallel (when possible)
5. Handle conditional branches
6. Wait for all inputs before executing node
7. Track execution state per node
8. Save execution data
9. Handle loops and iterations

**Features**:
- Parallel node execution
- Conditional branching
- Loop support
- Human input nodes
- State management
- Execution tracking
- Error handling

**Location**: `packages/server/src/utils/buildAgentflow.ts`

### Execution States

**States**:
- `INPROGRESS`: Execution started
- `FINISHED`: Execution completed successfully
- `ERROR`: Execution failed
- `TERMINATED`: Execution terminated by user
- `TIMEOUT`: Execution timed out
- `STOPPED`: Execution stopped

**Storage**: `auto_execution` table

### Streaming

**Protocol**: Server-Sent Events (SSE)
**Implementation**: `SSEStreamer` class

**Flow**:
1. Client requests streaming (`streaming=true`)
2. Server sets SSE headers
3. Server streams chunks via `sseStreamer.send()`
4. Client receives chunks via EventSource API
5. Server closes stream on completion

**Location**: `packages/server/src/utils/SSEStreamer.ts`

---

## Caching & Performance

### Cache Pool

**Class**: `CachePool`
**Purpose**: In-memory caching for nodes and credentials
**Implementation**: `cache-manager` with memory store

**Cached Data**:
- Node definitions
- Credential data (decrypted)
- Flow configurations

**Location**: `packages/server/src/CachePool.ts`

### Usage Cache Manager

**Class**: `UsageCacheManager`
**Purpose**: Cache usage statistics (predictions, storage, flows)
**Implementation**: Redis-backed cache

**Cached Metrics**:
- Prediction counts
- Storage usage
- Flow counts
- LLM usage

**Location**: `packages/server/src/UsageCacheManager.ts`

### Performance Optimizations

1. **Database Connection Pooling**: TypeORM connection pool
2. **Redis Caching**: Frequently accessed data
3. **Lazy Loading**: Nodes loaded on demand
4. **Streaming**: Large responses streamed instead of buffered
5. **Parallel Execution**: Agentflow nodes executed in parallel
6. **Query Optimization**: Indexed database queries

---

## Queue System

### Queue Manager

**Class**: `QueueManager`
**Implementation**: BullMQ
**Purpose**: Async job processing for long-running tasks

**Queues**:
1. **Prediction Queue**: Chatflow/agentflow execution
2. **Document Store Queue**: Document processing
3. **Vector Store Queue**: Vector operations

**Queue Modes**:
- **MAIN Mode**: Direct execution (no queue)
- **QUEUE Mode**: Async execution via BullMQ

**Configuration**: `MODE` environment variable

**Location**: `packages/server/src/queue/QueueManager.ts`

### Redis Event Subscriber

**Class**: `RedisEventSubscriber`
**Purpose**: Subscribe to queue events for SSE streaming
**Implementation**: Redis pub/sub

**Flow**:
1. Client requests streaming
2. Server subscribes to Redis channel (`chatId`)
3. Worker processes job and publishes events
4. Server receives events and streams to client
5. Server unsubscribes on completion

**Location**: `packages/server/src/queue/RedisEventSubscriber.ts`

---

## Storage System

### Storage Types

1. **Local Storage**: File system storage
2. **AWS S3**: S3 bucket storage
3. **Google Cloud Storage**: GCS bucket storage

**Configuration**: `STORAGE_TYPE` environment variable

### Storage Locations

- **Base Path**: `KODIVIAN_DATA_PATH` (default: `.kodivian`)
- **Document Stores**: `{basePath}/docustore/{storeId}/`
- **Uploads**: `{basePath}/uploads/`
- **Logs**: `{basePath}/logs/`
- **Encryption Key**: `{basePath}/.kodivian/encryption.key`

### File Handling

**Uploads**:
- Multer middleware for file uploads
- File validation (size, type)
- Storage abstraction (local/S3/GCS)
- File metadata stored in database

**Location**: `packages/server/src/utils/storageUtils.ts`

---

## Logging & Monitoring

### Logging System

**Library**: Winston 3.12.0
**Features**:
- Daily rotate file logs
- Log levels: error, warn, info, debug
- Structured logging (JSON)
- Module-specific loggers

**Log Locations**:
- **System Logs**: `{basePath}/logs/system/`
- **Chatflow Logs**: `{basePath}/logs/chatflows/`
- **Execution Logs**: `{basePath}/logs/executions/`
- **Security Logs**: `{basePath}/logs/security/`

**Loggers**:
- `logError()`: Error logging
- `logWarn()`: Warning logging
- `logInfo()`: Info logging
- `logDebug()`: Debug logging
- `chatflowLog()`: Chatflow-specific logging
- `executionLog()`: Execution-specific logging
- `securityLog()`: Security event logging

**Location**: `packages/server/src/utils/logger/`

### Metrics & Observability

#### 1. Prometheus Metrics

**Provider**: `Prometheus` class
**Metrics**:
- HTTP request counts
- Request duration
- Error rates
- Custom business metrics

**Endpoint**: `/api/v1/metrics`

**Location**: `packages/server/src/metrics/Prometheus.ts`

#### 2. OpenTelemetry

**Provider**: `OpenTelemetry` class
**Features**:
- Distributed tracing
- Span creation
- Trace export (OTLP)

**Location**: `packages/server/src/metrics/OpenTelemetry.ts`

#### 3. Analytics Providers

**Supported Providers**:
- LangSmith (tracing)
- LangFuse (observability)
- Lunary (analytics)
- LangWatch (monitoring)
- Arize (tracing)
- Phoenix (tracing)
- Opik (tracing)

**Integration**: Via LangChain callbacks
**Configuration**: Per-chatflow in `analytic` field

**Location**: `packages/components/src/handler.ts`

---

## Configuration & Environment

### Environment Variables

#### Server Configuration

- `SERVER_PORT`: Server port (default: 3030)
- `HOST`: Server host (default: localhost)
- `HTTP_PROTOCOL`: http or https (default: http)
- `CONTEXT_PATH`: API context path (default: /kodivian)
- `MODE`: `MAIN` or `QUEUE` (default: MAIN)
- `NODE_ENV`: `development` or `production`

#### Database Configuration

- `MAIN_DB_TYPE`: `POSTGRES` or `ORACLE` (default: POSTGRES)
- `DB_HOST`: Database host
- `DB_PORT`: Database port
- `DB_USERNAME`: Database username
- `DB_PASSWORD`: Database password
- `DB_DATABASE`: Database name
- `DB_SSL`: SSL enabled (true/false)

#### Redis Configuration

- `REDIS_HOST`: Redis host
- `REDIS_PORT`: Redis port
- `REDIS_PASSWORD`: Redis password
- `REDIS_DB`: Redis database number

#### Storage Configuration

- `STORAGE_TYPE`: `local`, `s3`, or `gcs`
- `KODIVIAN_DATA_PATH`: Base data directory
- `SECRETKEY_PATH`: Encryption key path override

**AWS S3**:
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: AWS region
- `AWS_S3_BUCKET`: S3 bucket name

**Google Cloud Storage**:
- `GOOGLE_CLOUD_STORAGE_PROJ_ID`: GCS project ID
- `GOOGLE_CLOUD_STORAGE_BUCKET_NAME`: GCS bucket name
- `GOOGLE_CLOUD_STORAGE_CREDENTIAL`: GCS credential file path

#### Security Configuration

- `DISABLED_NODES`: Comma-separated list of disabled nodes
- `CORS_ORIGINS`: Allowed CORS origins
- `SESSION_SECRET`: Session encryption secret
- `JWT_SECRET`: JWT signing secret

#### Feature Flags

- `SHOW_COMMUNITY_NODES`: Show community nodes (true/false)

### App Configuration

**File**: `packages/server/src/AppConfig.ts`
**Purpose**: Centralized configuration management

**Config Options**:
- `showCommunityNodes`: Show community nodes
- `platform`: Platform type (open source, cloud, enterprise)

---

## Deployment

### Build Process

**Backend**:
```bash
cd packages/server
npm run build  # TypeScript compilation + Gulp
```

**Frontend**:
```bash
cd packages/ui
npm run build  # Vite build
```

**Components**:
```bash
cd packages/components
npm run build  # TypeScript compilation + Gulp
```

### Production Deployment

**Requirements**:
- Node.js 22.21.1
- PostgreSQL 12+ or Oracle 12c+
- Redis 6+ (optional, for queue mode)
- 4GB+ RAM
- 10GB+ disk space

**Steps**:
1. Install dependencies: `npm install`
2. Set environment variables
3. Initialize database schema
4. Create encryption key (auto-created on first run)
5. Build packages: `npm run build`
6. Start server: `npm start`

### Docker Deployment

**Dockerfile**: Not provided (custom deployment)
**Recommendations**:
- Multi-stage build for production
- Separate containers for server and worker (queue mode)
- Volume mounts for data persistence
- Environment variable injection

### Queue Mode Deployment

**Architecture**:
- **Main Server**: Handles API requests
- **Worker Process**: Processes queue jobs

**Start Commands**:
- Main: `npm start` (or `./bin/run start`)
- Worker: `npm run start-worker` (or `./bin/run worker`)

**Requirements**:
- Redis for queue backend
- Shared database connection
- Shared file storage

---

## Code Structure

### Package Structure

```
packages/
├── server/              # Backend server
│   ├── src/
│   │   ├── controllers/ # API controllers
│   │   ├── services/    # Business logic
│   │   ├── routes/      # API routes
│   │   ├── database/    # Database entities & schema
│   │   ├── utils/       # Utilities
│   │   ├── middleware/  # Express middleware
│   │   ├── queue/       # Queue management
│   │   └── index.ts     # App entry point
│   └── package.json
├── ui/                  # Frontend React app
│   ├── src/
│   │   ├── views/       # Page components
│   │   ├── api/         # API client
│   │   ├── routes/      # React Router routes
│   │   ├── store/       # Redux store
│   │   └── index.jsx    # App entry point
│   └── package.json
└── components/          # Shared components
    ├── nodes/           # Node implementations
    ├── credentials/     # Credential handlers
    ├── src/             # Shared utilities
    └── package.json
```

### Key Files

**Backend**:
- `packages/server/src/index.ts`: App initialization
- `packages/server/src/Interface.ts`: TypeScript interfaces
- `packages/server/src/utils/buildChatflow.ts`: Chatflow execution
- `packages/server/src/utils/buildAgentflow.ts`: Agentflow execution
- `packages/server/src/NodesPool.ts`: Node management

**Frontend**:
- `packages/ui/src/App.jsx`: React app root
- `packages/ui/src/routes/MainRoutes.jsx`: Route definitions
- `packages/ui/src/views/canvas/index.jsx`: Canvas editor
- `packages/ui/src/views/agentflowsv2/Canvas.jsx`: Agentflow canvas

**Components**:
- `packages/components/src/handler.ts`: Node execution handler
- `packages/components/src/index.ts`: Component exports

---

## Conclusion

This technical documentation provides a comprehensive overview of the Kodivian platform's architecture, APIs, database structure, security, and deployment. For specific implementation details, refer to the source code and inline documentation.

