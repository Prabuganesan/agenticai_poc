# Kodivian Platform - Comprehensive Technical Documentation

## Table of Contents
1. [Platform Overview](#platform-overview)
2. [Architecture](#architecture)
3. [Core Features](#core-features)
4. [Technical Stack](#technical-stack)
5. [Components & Nodes](#components--nodes)
6. [API Reference](#api-reference)
7. [Security](#security)
8. [Deployment](#deployment)
9. [Configuration](#configuration)
10. [Performance & Scaling](#performance--scaling)

---

## Platform Overview

**Kodivian** is an enterprise-grade AI orchestration platform designed for SmartAppBuilder clients. It provides a visual interface for building, deploying, and managing AI agents, LLM workflows, and intelligent automation systems.

### Key Capabilities
- **Visual AI Agent Builder**: Drag-and-drop interface for creating complex AI workflows
- **Multi-LLM Support**: Integration with 65+ chat models and 23+ LLM providers
- **Document Processing**: 91+ document loaders for various file formats
- **Vector Store Integration**: 53+ vector database integrations
- **Tool Ecosystem**: 100+ pre-built tools for AI agents
- **Multi-Agent Systems**: Support for collaborative agent workflows
- **Real-time Streaming**: Server-Sent Events (SSE) for live responses
- **Enterprise Security**: End-to-end encryption, multi-tenancy, role-based access

### Version
- **Current Version**: 3.0.10 (Server) / 10 (Platform)
- **Node.js**: 22.21.1+ (recommended)
- **Package Manager**: pnpm 9+
- **TypeScript**: 5.4.5
- **Last Major Update**: December 2024 (Code Quality Improvements)

---

## Architecture

### Monorepo Structure
```
kodivian/
├── packages/
│   ├── server/          # Node.js backend (Express + TypeScript)
│   ├── ui/              # React frontend (Vite + MUI)
│   ├── components/      # AI nodes & integrations (700+ components)
│   └── api-documentation/ # Auto-generated Swagger docs
├── docker/              # Docker & docker-compose configurations
├── docs/                # Documentation
└── metrics/             # Prometheus & OpenTelemetry configurations
```

### Technology Stack

#### Backend (Server Package)
- **Framework**: Express.js
- **Language**: TypeScript 5.4.5
- **Runtime**: Node.js 22.21.1
- **ORM**: TypeORM (PostgreSQL, Oracle DB)
- **Queue System**: BullMQ + Redis
- **Real-time**: Server-Sent Events (SSE)
- **API Docs**: Swagger/OpenAPI via express-swagger-generator
- **Metrics**: Prometheus / OpenTelemetry

#### Frontend (UI Package)
- **Framework**: React 18.2
- **Build Tool**: Vite 5.1
- **UI Library**: Material-UI (MUI) 5.15
- **State Management**: Redux Toolkit 2.2
- **Flow Visualization**: ReactFlow 11.5
- **Code Editor**: CodeMirror 6
- **HTTP Client**: Axios 1.12
- **Rich Text**: TipTap 2.11

#### AI & ML Components
- **LangChain Core**: 0.3.61
- **OpenAI SDK**: 4.96.0
- **Google GenAI**: 0.24.0+
- **Vector DBs**: Qdrant, Pinecone, Chroma, Milvus, Weaviate, etc.
- **Document Processing**: PDF, DOCX, CSV, JSON, XML, etc.
- **Embeddings**: OpenAI, Cohere, HuggingFace, Google, Azure, etc.

---

## Core Features

### 1. **Visual Workflow Builder (Canvas)**
- **Drag-and-Drop Interface**: Create AI workflows visually
- **Node-Based System**: 700+ pre-built nodes
- **Real-time Validation**: Instant feedback on configuration
- **Version Control**: Save and manage multiple versions
- **Import/Export**: Share workflows as JSON

**Key Node Categories:**
- Chat Models (65+): OpenAI, Anthropic, Google, Azure, Cohere, etc.
- LLMs (23+): Completion-based models
- Agents (23+): ReAct, OpenAI Functions, XML, Tool Calling
- Chains (28+): Conversation, API, SQL, Retrieval, etc.
- Tools (100+): Web search, API calls, calculators, code execution
- Memory (32+): Buffer, conversation, vector store memory
- Document Loaders (91+): PDF, Web, Git, databases, etc.
- Vector Stores (53+): Pinecone, Qdrant, Chroma, Milvus, etc.
- Embeddings (28+): OpenAI, Cohere, HuggingFace, etc.
- Text Splitters (12+): Recursive, token-based, semantic
- Retrievers (31+): Vector, contextual compression, multi-query
- Output Parsers (9+): Structured output, JSON, CSV
- Moderation (7+): Content safety, PII detection

### 2. **Agentflow System**
Advanced multi-step agent execution engine with:
- **Sequential Execution**: Step-by-step agent workflows
- **Parallel Node Execution**: Optimize performance
- **Conditional Logic**: Branch based on conditions
- **Loop Support**: Iterate over data
- **State Management**: Maintain context across steps
- **Variable Resolution**: Dynamic variable injection
- **Error Handling**: Graceful error recovery
- **Execution Tracking**: Detailed execution logs

**Agentflow Node Types:**
- **Start Node**: Entry point
- **Agent Node**: AI-powered decision making
- **Condition Node**: Conditional branching
- **Loop Node**: Iteration control
- **Tool Node**: Execute external tools
- **Set Variable**: State management
- **End Node**: Termination

### 3. **Multi-Tenancy & Organizations**
- **Organization-Based Isolation**: Complete data separation
- **Per-Org Databases**: Dedicated PostgreSQL/Oracle schemas
- **Per-Org Redis**: Isolated cache and queue instances
- **Dynamic DataSource Management**: Load org configs at runtime
- **Session Management**: Cookie-based authentication (AUTOID)

### 4. **Queue & Job Processing (BullMQ)**
- **Distributed Queue System**: Redis-backed job processing
- **Worker Nodes**: Horizontal scaling support
- **Job Types**:
  - Chatflow predictions (AI inference)
  - Document processing
  - Vector embeddings
  - Scheduled tasks
- **Priority Queues**: Urgent vs. background jobs
- **Retry Logic**: Automatic retry with exponential backoff
- **Job Monitoring**: BullBoard dashboard
- **Event Streaming**: Job progress tracking

**Queue Modes:**
- `MODE=queue`: Main server + API only
- `MODE=worker`: Worker node for job processing
- `MODE=main`: Standalone (queue + worker in one)

### 5. **Document Store & RAG**
- **Document Management**: Upload, process, store documents
- **Chunking Strategies**: Multiple text splitting algorithms
- **Vector Embeddings**: Generate and store embeddings
- **Metadata Extraction**: Automated metadata tagging
- **Upsert History**: Track document updates
- **Record Manager**: SQLite-based versioning
- **Loaders**: Store documents from Notion, Confluence, GitHub, etc.

### 6. **Metrics & Monitoring**
- **Prometheus Metrics**:
  - Request count, latency, errors
  - Queue metrics (jobs, completed, failed)
  - Node execution metrics
  - LLM token usage
  - Database connection pool
- **OpenTelemetry Support**: Distributed tracing
- **Health Checks**: `/api/v1/ping`
- **Custom Metrics**: Node-level performance tracking

### 7. **LLM Usage Tracking**
**Current Implementation (v3.0.10):**

- **Automatic Token Counting**: Real-time capture of input/output tokens per LLM request
- **Multi-Format Support**: Handles multiple LLM response formats
  - Google Gemini: `message.usage_metadata`, `message.kwargs.usage_metadata`
  - OpenAI/Anthropic: `llmOutput.tokenUsage`
  - ConversationalAgent: root `usageMetadata`
  - Agent flows: `output.usageMetadata`
- **Cost Calculation**: Automatic cost tracking per model (supports 65+ models)
- **Usage Analytics**: Filter by chatflow, model, provider, time range, user, organization
- **Database Storage**: PostgreSQL `auto_sab_llm_usage` table with comprehensive metadata
- **Callback Handler**: `UsageTrackingCallbackHandler` extends LangChain's `BaseCallbackHandler`
- **Integration Points**:
  - LLM Chain nodes (`LLMChain.ts`)
  - Agent nodes
  - Agentflow execution (`buildAgentflow.ts` with LLM tracking proxy)
- **Tracking Fields**:
  - Request: `requestId`, `executionId`, `chatflowId`, `chatId`, `sessionId`
  - Organization: `orgId`, `userId`
  - Model: `provider`, `model`, `nodeType`, `nodeName`
  - Usage: `promptTokens`, `completionTokens`, `totalTokens`, `cost`
  - Performance: `processingTimeMs`, `responseLength`
  - Status: `success`, `cacheHit`, `errorMessage`
  - Custom: `metadata` (JSON)

**Key Functions**:
- `extractUsageMetadata()`: Multi-format token extraction from LLM responses
- `extractProviderAndModel()`: Automatic provider and model name detection
- `trackLLMUsage()`: Async non-blocking database save operation
- `calculateCost()`: Per-model cost calculation (pricing per 1M tokens)


### 8. **Chat Sessions & History**
- **Session Management**: Persistent conversation history
- **Message Storage**: All user/AI messages
- **Feedback System**: Thumbs up/down on responses
- **Session Metadata**: Tags, custom fields
- **Lead Capture**: Email, phone collection
- **Export**: Download chat history

### 9. **API Key Management**
- **API Key Authentication**: Secure chatflow access
- **Per-Chatflow Keys**: Granular access control
- **Rate Limiting**: Per-key request limits
- **Key Rotation**: Regenerate compromised keys
- **Usage Tracking**: Monitor API key usage

### 10. **Credentials Manager**
- **Secure Storage**: AES-256 encrypted credentials
- **Component Credentials**: API keys, tokens, secrets
- **Credential Templates**: Pre-defined credential schemas
- **Environment Variables**: Fallback to env vars
- **OAuth2 Support**: Token management

---

## Components & Nodes

### Chat Models (65+)
- **OpenAI**: GPT-4, GPT-3.5, 4o, o1, o3
- **Anthropic**: Claude 3.5 Sonnet, Opus, Haiku
- **Google**: Gemini 2.5 Pro, Flash, Lite, 1.5
- **Azure OpenAI**: All GPT models
- **Cohere**: Command R, Command R+
- **Groq**: Llama 3.1, Mixtral, Gemma
- **Mistral**: Large, Medium, Small
- **AWS Bedrock**: All supported models
- **Ollama**: Local LLM support
- **Together AI**, **Replicate**, **HuggingFace**, etc.

### Tools (100+)
**Web & Search:**
- Serper Google Search, SerpAPI, Brave Search
- Web scraping, screenshot capture
- RSS feeds, sitemap crawlers

**APIs & Integrations:**
- Custom API chains
- REST API tools
- GraphQL executor
- OpenAPI schema loader

**Data Processing:**
- Calculator, code interpreter
- JSON/CSV parser
- SQL database query
- Spreadsheet processor

**Productivity:**
- Gmail, Google Calendar
- Notion, Confluence
- GitHub, GitLab
- Slack, Discord

**AI Services:**
- DALL-E, Stable Diffusion
- Whisper (speech-to-text)
- Text-to-speech
- Vision models

### Vector Stores (53+)
- **Open Source**: Chroma, Qdrant, Weaviate, Milvus
- **Cloud**: Pinecone, Zilliz, Astra DB
- **Databases**: PostgreSQL (pgvector), MongoDB, Redis
- **Enterprise**: Azure AI Search, AWS OpenSearch
- **Special**: In-memory, Local file system

### Document Loaders (91+)
**File Formats:**
- PDF, DOCX, XLSX, PPTX
- Markdown, HTML, TXT, CSV, JSON, XML
- Audio/Video (transcription)

**Web Sources:**
- Web pages, sitemaps, RSS
- GitHub repos, Confluence, Notion
- YouTube transcripts, podcasts

**Databases:**
- PostgreSQL, MySQL, MongoDB
- ElasticSearch, Airtable
- Google Drive, OneDrive, Dropbox

**Enterprise:**
- SharePoint, S3
- Salesforce, HubSpot
- Jira, Linear

---

## API Reference

### Base URL
```
http://<host>:<port>/kodivian/api/v1
```

### Core Endpoints

#### **Chatflows**
```typescript
GET    /chatflows                 // List all chatflows
GET    /chatflows/:id             // Get chatflow by ID
POST   /chatflows                 // Create chatflow
PUT    /chatflows/:id             // Update chatflow
DELETE /chatflows/:id             // Delete chatflow
GET    /chatflows/:id/analysis    // Analyze chatflow
```

#### **Predictions (Execute AI)**
```typescript
POST   /prediction/:id            // Run chatflow prediction
POST   /internal-prediction/:id   // Internal prediction (no auth)
```

**Request Body:**
```json
{
  "question": "string",
  "overrideConfig": {},
  "history": [],
  "streaming": false,
  "attachments": []
}
```

**Response (Streaming):**
```
event: token
data: {"token": "Hello"}

event: metadata
data: {"sessionId": "...", "chatId": "..."}

event: end
data: {}
```

#### **Chat Sessions**
```typescript
POST   /chat-sessions/list        // List sessions
GET    /chat-sessions/:id         // Get session
DELETE /chat-sessions/:id         // Delete session
```

#### **Chat Messages**
```typescript
POST   /chatmessage/list          // List messages
GET    /chatmessage/:id           // Get message
POST   /chatmessage/:id/feedback  // Add feedback
DELETE /chatmessage/:id           // Delete message
```

#### **Vector Operations**
```typescript
POST   /vector/upsert/:id         // Upsert to vector store
POST   /vector/search/:id         // Search vector store
DELETE /vector/delete/:id         // Delete from vector store
```

#### **Document Store**
```typescript
POST   /document-store/upsert/:id  // Upload document
GET    /document-store/chunks/:id  // Get chunks
DELETE /document-store/delete/:id  // Delete document
GET    /document-store/loaders     // List loaders
```

#### **Nodes & Components**
```typescript
GET    /nodes                     // List all nodes
GET    /node-icon/:name           // Get node icon
POST   /node-load-method/:name    // Get node config options
```

#### **Credentials**
```typescript
GET    /credentials               // List credentials
POST   /credentials               // Create credential
PUT    /credentials/:id           // Update credential
DELETE /credentials/:id           // Delete credential
```

#### **API Keys**
```typescript
GET    /apikey                    // List API keys
POST   /apikey                    // Create API key
PUT    /apikey/:id                // Update API key
DELETE /apikey/:id                // Delete API key
```

#### **Metrics & Monitoring**
```typescript
GET    /ping                      // Health check
GET    /stats                     // System statistics
GET    /llm-usage                 // LLM usage analytics
```

#### **Crypto & Encryption**
```typescript
GET    /crypto/status             // Check if encryption enabled
GET    /crypto/public-key         // Get RSA public key
POST   /crypto/handshake          // Session key exchange
```

---

## Security

### 1. **End-to-End Encryption (E2E)**
**Feature Flag:** `ENABLE_E2E_ENCRYPTION=true`

**Implementation:**
- **Hybrid RSA + AES Encryption**:
  - RSA-2048 for session key exchange
  - AES-256 for data encryption (crypto-js)
- **Session-Based Keys**: Unique key per user session
- **Redis Storage**: Session keys stored in Redis (24h TTL)
- **Automatic Encryption**: Axios interceptors encrypt all JSON requests/responses
- **File Upload Exclusion**: Multipart/form-data bypasses encryption

**Data Protection:**
- ✅ Request bodies encrypted
- ✅ Response bodies encrypted
- ✅ Headers include `X-Encrypted: true`
- ❌ URL parameters (plain - for routing)
- ❌ File uploads (multipart/form-data)

### 2. **Authentication & Authorization**
- **Session-Based Auth**: Cookie-based (AUTOID)
- **JWT Support**: Optional JWT tokens
- **Session Store**: Redis-backed sessions
- **Session TTL**: Configurable (default: 900s = 15 min)
- **CSRF Protection**: SameSite cookies
- **Secure Cookies**: HTTPOnly, Secure flags

### 3. **Rate Limiting**
- **Per-Chatflow Limits**: Configurable request limits
- **Per-API-Key Limits**: Separate limits for API keys
- **Redis-Backed**: Distributed rate limiting
- **Dynamic Updates**: Real-time limit changes via BullMQ
- **Lazy Loading**: Load limits on-demand

### 4. **Credential Encryption**
- **AES-256 Encryption**: All credentials encrypted at rest
- **Auto-Generated Key**: Stored in `KODIVIAN_DATA_PATH/.kodivian/encryption.key`
- **Cluster Support**: Shared key for multi-instance deployments
- **PII Redaction**: Password-type fields masked in logs

### 5. **Security Headers**
```typescript
Content-Security-Policy: default-src 'self'; ...
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), ...
```

### 6. **Input Sanitization**
- **XSS Protection**: HTML/script sanitization
- **SQL Injection**: Parameterized queries (TypeORM)
- **Log Sanitization**: Remove sensitive fields from logs
- **File Upload Validation**: MIME type checking

### 7. **CORS Configuration**
```bash
CORS_ORIGINS=https://app.example.com,https://app2.example.com
IFRAME_ORIGINS=https://embed.example.com
CHATBOT_IFRAME_ORIGINS=https://chatbot.example.com
```

---

## Deployment

### Docker Deployment

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  kodivian:
    image: kodivian:latest
    ports:
      - "3030:3030"
    environment:
      - MODE=queue
      - ENABLE_E2E_ENCRYPTION=true
      - ENABLE_METRICS=true
    volumes:
      - kodivian-data:/root/.kodivian
    depends_on:
      - redis
      - postgres
  
  worker:
    image: kodivian:latest
    command: ["./bin/run", "worker"]
    environment:
      - MODE=worker
    depends_on:
      - redis
      - postgres
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
  
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=kodivian
      - POSTGRES_USER=admin
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - pg-data:/var/lib/postgresql/data
```

### PM2 (Cluster Mode)

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [
    {
      name: 'kodivian-server',
      script: './bin/run',
      args: 'start',
      instances: 4,
      exec_mode: 'cluster',
      env: {
        MODE: 'queue',
        ENABLE_E2E_ENCRYPTION: 'true'
      }
    },
    {
      name: 'kodivian-worker',
      script: './bin/run',
      args: 'worker',
      instances: 2,
      env: {
        MODE: 'worker'
      }
    }
  ]
}
```

### Kubernetes

**kodivian-deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kodivian-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kodivian
      role: server
  template:
    spec:
      containers:
      - name: kodivian
        image: kodivian:3.0.10
        ports:
        - containerPort: 3030
        env:
        - name: MODE
          value: "queue"
        - name: ENABLE_E2E_ENCRYPTION
          value: "true"
        volumeMounts:
        - name: kodivian-data
          mountPath: /root/.kodivian
---
apiVersion: v1
kind: Service
metadata:
  name: kodivian-svc
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3030
  selector:
    app: kodivian
    role: server
```

---

## Configuration

### Environment Variables

#### **Core Settings**
```bash
# Data storage path
KODIVIAN_DATA_PATH=/shared/kodivian-data

# Server configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=3030
CONTEXT_PATH=/kodivian

# Mode: queue (main+API) | worker (jobs) | main (standalone)
MODE=queue
```

#### **Database (Multi-Tenant)**
```bash
# Main PostgreSQL (for org configs)
MAIN_DB_HOST=postgres.example.com
MAIN_DB_PORT=5432
MAIN_DB_DATABASE=smartapp
MAIN_DB_USER=admin
MAIN_DB_PASSWORD=secure_password
MAIN_DB_TYPE=postgres
DB_POOL_SIZE=20
DB_SSL=true

# Enable auto table creation
ENABLE_TABLE_CREATION=true
```

#### **Redis (Queue & Cache)**
```bash
# Queue
REDIS_DB_QUEUE=3
QUEUE_NAME=kodivian-queue
WORKER_CONCURRENCY=20

# Session
REDIS_DB_SESSION=1
SESSION_COOKIE_MAX_AGE=900
```

#### **Security**
```bash
# E2E Encryption
ENABLE_E2E_ENCRYPTION=true

# Session
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAME_SITE=strict

# SMTP (for invitations)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=app_password
SENDER_EMAIL=noreply@example.com
```

#### **Metrics**
```bash
ENABLE_METRICS=true
METRICS_PROVIDER=prometheus  # or open_telemetry
METRICS_INCLUDE_NODE_METRICS=true
METRICS_SERVICE_NAME=Kodivian
```

#### **Logging**
```bash
LOG_ENABLED=true
LOG_SYSTEM_ENABLED=true
LOG_WORKFLOWS_ENABLED=true
LOG_SERVICES_ENABLED=true
```

#### **Storage**
```bash
STORAGE_TYPE=s3  # local | s3 | gcs

# S3
S3_STORAGE_BUCKET_NAME=kodivian-files
S3_STORAGE_ACCESS_KEY_ID=AKIA...
S3_STORAGE_SECRET_ACCESS_KEY=secret
S3_STORAGE_REGION=us-east-1
```

---

## Performance & Scaling

### Optimizations Implemented

#### 1. **Parallel Agentflow Execution**
- Sequential node execution with dependency tracking
- Batched database updates (reduced I/O)
- Optimized variable resolution

#### 2. **Rate Limiter Optimization**
- Lazy loading of chatflow configurations
- On-demand rate limiter initialization
- Redis-backed distributed limiting

#### 3. **Database Connection Pooling**
- Per-org connection pools
- Configurable pool size (`DB_POOL_SIZE`)
- Connection reuse across requests

#### 4. **Caching Strategy**
- **Redis Cache**:
  - LLM predictions cache
  - Embedding cache
  - Session keys
  - SSO tokens
- **In-Memory Cache**:
  - Node instances
  - Component metadata
  - Flow configurations

#### 5. **Queue Job Processing**
- **BullMQ Features**:
  - Job prioritization
  - Rate limiting per queue
  - Automatic retries
  - Dead letter queues
- **Worker Scaling**: Horizontal worker nodes
- **Job Concurrency**: `WORKER_CONCURRENCY=20`

### Performance Metrics

**Typical Response Times** (production):
- Chatflow execution: 500-2000ms (depending on LLM)
- API endpoints: 50-200ms
- Vector search: 100-500ms
- Document upsert: 1-5s (depending on size)

**Encryption Overhead:**
- Initial handshake: 50-100ms (one-time per session)
- Request encryption: 2-5ms
- Response decryption: 2-5ms
- **Total impact**: ~5-10ms per request

**Recommended Infrastructure:**
- **Small Deployment**: 2 vCPU, 4GB RAM, Redis, PostgreSQL
- **Medium Deployment**: 4 vCPU, 8GB RAM, Redis Cluster, PostgreSQL
- **Large Deployment**: 8+ vCPU, 16GB+ RAM, Redis Cluster, PostgreSQL HA

---

## Development

### Local Development Setup

```bash
# Clone repository
git clone <repo-url>
cd kodivian

# Install dependencies
npm i -g pnpm
pnpm install

# Set up environment
cp packages/server/.env.example packages/server/.env
# Edit .env with your configuration

# Build
pnpm build

# Development mode (hot reload)
pnpm dev
```

### Testing

```bash
# Unit tests
pnpm test

# E2E tests (Cypress)
pnpm e2e

# Load testing (Artillery)
artillery run artillery-load-test.yml
```

### Code Quality

```bash
# Linting
pnpm lint
pnpm lint-fix

# Formatting
pnpm format

# Type checking
pnpm build  # TypeScript compilation
```

---

## Code Quality

### Recent Improvements (December 2024)

**Console.Log Cleanup:**
- Removed 60 debug `console.log` statements across 14 files
- Server package: 9 files, 44 logs removed
- Component package: 5 files, 16 logs removed
- Benefits: Cleaner production logs, reduced I/O overhead, easier debugging

**Code Quality Verification:**
- ✅ 0 unused imports detected
- ✅ 0 unused variables detected
- ✅ 0 dead code paths
- ✅ ESLint validation passed
- ✅ TypeScript compilation successful

### Code Standards

**TypeScript:**
```typescript
// Strict mode enabled
"strict": true
"noUnusedLocals": true
"noUnusedParameters": true
"noImplicitAny": true
```

**Linting:**
- ESLint with TypeScript parser
- React hooks rules
- Prettier for formatting

**Testing:**
- Unit tests for critical functions
- E2E tests with Cypress
- Load testing with Artillery

---

## Troubleshooting

### Common Issues

**1. Encryption Not Working**
- Clear browser cache (Ctrl+Shift+Delete)
- Check `.env`: `ENABLE_E2E_ENCRYPTION=true`
- Verify console logs: `[Encryption] ✅ E2E encryption initialized successfully`

**2. Database Connection Failed**
- Check `MAIN_DB_*` environment variables
- Verify network connectivity to database
- Check database credentials and permissions

**3. Queue Jobs Not Processing**
- Ensure `MODE=queue` on main server
- Ensure `MODE=worker` on worker nodes
- Check Redis connectivity
- Verify `QUEUE_NAME` matches across instances

**4. High Memory Usage**
- Reduce `WORKER_CONCURRENCY`
- Increase `DB_POOL_SIZE` to reuse connections
- Enable Redis LRU eviction policy
- Monitor Node.js heap size

**5. Slow API Responses**
- Enable metrics: `ENABLE_METRICS=true`
- Check Prometheus dashboard
- Optimize chatflow (reduce node count)
- Increase worker instances

---

## Changelog

### Version 3.0.10 (Latest)
- ✅ End-to-end encryption (E2E) implementation
- ✅ Rate limiter lazy loading optimization
- ✅ Agentflow execution improvements
- ✅ LLM usage tracking enhancements
- ✅ Multi-tenant database schema support
- ✅ Redis-backed session management
- ✅ BullMQ queue system integration
- ✅ Metrics (Prometheus/OpenTelemetry)

---

## Support & Resources

**Documentation:**
- LangChain Docs: https://js.langchain.com/docs/

**Support:**
- Email: smartappbuilder_support@kodivian.com
- Issue Tracker: Internal GitLab

**License:**
- Apache License Version 2.0

---

**Last Updated**: 2025-11-29  
**Platform Version**: 3.0.10  
**Documentation Version**: 1.0
