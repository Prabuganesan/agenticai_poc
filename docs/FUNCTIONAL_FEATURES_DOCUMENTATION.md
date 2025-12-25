# Kodivian Functional Features Documentation

## Table of Contents

1. [Overview](#overview)
2. [Core Features](#core-features)
3. [Chatflows](#chatflows)
4. [Agentflows](#agentflows)
5. [Assistants](#assistants)
6. [Document Stores](#document-stores)
7. [Tools](#tools)
8. [Credentials](#credentials)
9. [Variables](#variables)
10. [API Keys](#api-keys)
11. [Chat Interface](#chat-interface)
12. [Execution Tracking](#execution-tracking)
13. [Analytics & Observability](#analytics--observability)
14. [Marketplace](#marketplace)
15. [User Interface](#user-interface)
16. [Use Cases](#use-cases)

---

## Overview

Kodivian is an enterprise AI agent platform that enables users to build, deploy, and manage AI-powered conversational agents and multi-agent workflows. The platform provides a visual flow builder, extensive node library, and comprehensive management tools.

### Key Capabilities

- **Visual Flow Builder**: Drag-and-drop interface for building AI workflows
- **Multiple Flow Types**: Chatflows (conversational), Agentflows (multi-agent), Assistants (AI assistants)
- **Extensive Node Library**: 300+ nodes for LLMs, tools, document processing, and more
- **Document Management**: Upload, process, and query documents with vector search
- **API Access**: RESTful API for external integrations
- **Execution Tracking**: Detailed execution logs and analytics
- **Multi-Tenancy**: Organization and user-based isolation

---

## Core Features

### 1. Visual Flow Builder

**Purpose**: Create AI workflows using a visual, drag-and-drop interface.

**Features**:
- **Node Library**: Browse and search 300+ pre-built nodes
- **Drag & Drop**: Add nodes to canvas by dragging from sidebar
- **Connection Builder**: Connect nodes by dragging from output to input handles
- **Node Configuration**: Configure node parameters via property panel
- **Flow Validation**: Real-time validation of flow structure
- **Save & Deploy**: Save flows and deploy for production use

**Access**: 
- Chatflows: `/canvas` or `/canvas/:id`
- Agentflows: `/v2/agentcanvas` or `/v2/agentcanvas/:id`

**UI Components**:
- Canvas: ReactFlow-based flow editor
- Node Palette: Searchable node list with categories
- Property Panel: Node configuration form
- Mini Map: Flow overview navigation

### 2. Flow Types

#### Chatflows
**Type**: `CHATFLOW`
**Purpose**: Conversational AI agents for chat interfaces
**Execution**: Sequential, depth-first traversal
**Use Cases**: Customer support, Q&A bots, conversational interfaces

**Features**:
- Memory integration (conversation history)
- Streaming responses (SSE)
- File uploads
- Follow-up prompts
- Source document citations

#### Agentflows
**Type**: `AGENTFLOW`
**Purpose**: Multi-agent workflows with parallel execution
**Execution**: Parallel execution with conditional logic
**Use Cases**: Complex workflows, multi-step processes, agent orchestration

**Features**:
- Parallel node execution
- Conditional branching
- Loop support
- Human input nodes
- Execution state tracking
- Iteration nodes

#### Assistants
**Type**: `ASSISTANT`
**Purpose**: AI assistants (OpenAI, Azure, Custom)
**Execution**: Assistant API integration
**Use Cases**: AI assistants, custom agent configurations

**Features**:
- OpenAI Assistant integration
- Azure OpenAI Assistant integration
- Custom assistant configuration
- Document store integration
- Tool integration

### 3. Node Categories

#### Agents (`nodes/agents/`)
AI agents that can reason, plan, and execute tasks.

**Available Agents**:
- **ReAct Agent**: Reasoning and acting agent
- **Plan-and-Execute Agent**: Plans steps then executes
- **OpenAI Functions Agent**: Function calling agent
- **Structured Chat Agent**: Structured output agent
- **Conversational Agent**: Conversational agent
- **OpenAI Assistant Agent**: OpenAI Assistant integration

**Use Cases**:
- Task automation
- Multi-step reasoning
- Function calling
- Conversational AI

#### LLMs (`nodes/llms/`)
Large language models from various providers.

**Providers**:
- OpenAI (GPT-4, GPT-3.5, GPT-4 Turbo)
- Anthropic (Claude 3, Claude 2)
- Google (Gemini, PaLM)
- Cohere
- HuggingFace
- Ollama (local models)
- Azure OpenAI
- AWS Bedrock
- And 20+ more providers

**Features**:
- Model selection
- Temperature, top-p, max tokens configuration
- Streaming support
- Function calling
- Structured output

#### Chat Models (`nodes/chatmodels/`)
Chat-optimized language models.

**Similar to LLMs but optimized for conversational interfaces.**

#### Embeddings (`nodes/embeddings/`)
Text embedding models for vector search.

**Providers**:
- OpenAI Embeddings
- Cohere Embeddings
- HuggingFace Embeddings
- Google Vertex AI Embeddings
- Local embeddings (Ollama)

**Use Cases**:
- Document search
- Semantic similarity
- Vector store population

#### Vector Stores (`nodes/vectorstores/`)
Vector databases for storing and querying embeddings.

**Supported Stores**:
- Pinecone
- Qdrant
- Weaviate
- ChromaDB
- Milvus
- FAISS (in-memory)
- PostgreSQL (pgvector)
- MongoDB Atlas
- And 10+ more

**Features**:
- Document storage
- Similarity search
- Metadata filtering
- Batch operations

#### Document Loaders (`nodes/documentloaders/`)
Load documents from various sources.

**90+ Loaders Available**:
- **Files**: PDF, DOCX, TXT, CSV, JSON, MD, HTML, etc.
- **Web**: URLs, Sitemaps, RSS feeds
- **Databases**: PostgreSQL, MySQL, MongoDB
- **Cloud Storage**: S3, Google Cloud Storage, Azure Blob
- **APIs**: Notion, Confluence, GitHub, Slack
- **Specialized**: YouTube transcripts, Wikipedia, Reddit

**Features**:
- Automatic format detection
- Metadata extraction
- Chunking strategies
- Batch processing

#### Text Splitters (`nodes/textsplitters/`)
Split documents into chunks for processing.

**Strategies**:
- Character-based splitting
- Recursive character splitting
- Token-based splitting
- Markdown splitting
- Code splitting

**Features**:
- Chunk size configuration
- Overlap configuration
- Separator customization

#### Retrievers (`nodes/retrievers/`)
Retrieve relevant documents from vector stores.

**Strategies**:
- Similarity search
- MMR (Maximal Marginal Relevance)
- Contextual compression
- Parent document retrieval
- Time-weighted retrieval

**Features**:
- Top-k retrieval
- Score thresholds
- Metadata filtering
- Re-ranking

#### Tools (`nodes/tools/`)
100+ tools for external integrations.

**Categories**:
- **AWS**: S3, Lambda, Bedrock, Kendra, SNS, Secrets Manager
- **Google**: Search, Gmail, Drive, Calendar, Sheets
- **Notion**: Pages, Databases, Blocks
- **Slack**: Messages, Channels, Users
- **GitHub**: Repositories, Issues, Pull Requests
- **APIs**: HTTP requests, OpenAPI, GraphQL
- **Data**: SQL, CSV, JSON processing
- **Media**: Image generation, Audio processing
- **And 50+ more tools**

**Features**:
- Custom tool creation
- Tool schema definition
- Function calling integration
- Error handling

#### Chains (`nodes/chains/`)
Pre-built LangChain chains.

**Available Chains**:
- Retrieval QA Chain
- Conversational Retrieval Chain
- Map-Reduce Chain
- Refine Chain
- Stuff Chain

#### Memory (`nodes/memory/`)
Conversation memory management.

**Types**:
- Buffer Memory
- Buffer Window Memory
- Summary Memory
- Conversation Summary Buffer Memory
- Vector Store Memory
- Database Memory (PostgreSQL, MySQL, SQLite)

**Features**:
- Session-based memory
- Long-term memory
- Memory summarization
- Vector-based memory

#### Analytics (`nodes/analytic/`)
Observability and monitoring.

**Providers**:
- LangSmith (tracing)
- LangFuse (observability)
- Lunary (analytics)
- LangWatch (monitoring)
- Arize (tracing)
- Phoenix (tracing)
- Opik (tracing)

**Features**:
- Execution tracing
- Performance metrics
- Cost tracking
- Error monitoring

#### Cache (`nodes/cache/`)
Caching strategies for performance.

**Types**:
- In-Memory Cache
- Redis Cache
- GPTCache
- Momento Cache

**Features**:
- Response caching
- TTL configuration
- Cache invalidation

#### Prompts (`nodes/prompts/`)
Prompt templates and management.

**Features**:
- Prompt templates
- Variable substitution
- Prompt versioning

#### Output Parsers (`nodes/outputparsers/`)
Parse and structure LLM outputs.

**Types**:
- Structured Output Parser
- JSON Parser
- CSV Parser
- List Parser

#### Utilities (`nodes/utilities/`)
Utility nodes for common operations.

**Types**:
- Code Execution
- HTTP Request
- Data Transform
- Conditional Logic
- Loops

---

## Chatflows

### Creating a Chatflow

1. **Navigate**: Go to `/chatflows` page
2. **Create New**: Click "Add New" button
3. **Canvas Opens**: Visual flow builder opens at `/canvas`
4. **Add Nodes**: Drag nodes from sidebar to canvas
5. **Connect Nodes**: Connect nodes by dragging from output to input
6. **Configure Nodes**: Click node to configure in property panel
7. **Save**: Click "Save" button (Ctrl+S)
8. **Deploy**: Toggle "Deploy" switch to make flow available

### Chatflow Features

#### 1. Memory Integration
- **Buffer Memory**: Stores recent conversation history
- **Summary Memory**: Summarizes long conversations
- **Vector Memory**: Semantic search over conversation history
- **Database Memory**: Persistent memory across sessions

**Configuration**:
- Add Memory node to flow
- Configure memory type and parameters
- Memory automatically used by LLM nodes

#### 2. Streaming Responses
- **Server-Sent Events (SSE)**: Real-time response streaming
- **Token-by-Token**: Responses streamed as generated
- **Client Integration**: Use EventSource API or Kodivian embed

**Configuration**:
- Enable streaming in chatbot config
- Set `streaming=true` in API request
- Responses streamed via SSE

#### 3. File Uploads
- **Supported Formats**: PDF, DOCX, TXT, CSV, JSON, images, etc.
- **Processing**: Automatic document processing and chunking
- **Vector Storage**: Documents stored in vector store
- **Retrieval**: Relevant chunks retrieved during conversation

**Configuration**:
- Enable file uploads in chatbot config
- Add Document Loader and Vector Store nodes
- Configure file size and type limits

#### 4. Follow-Up Prompts
- **Suggested Questions**: AI-generated follow-up questions
- **User Selection**: Users can click to ask follow-up
- **Context-Aware**: Questions based on conversation context

**Configuration**:
- Enable in chatbot config
- Configure number of suggestions
- Customize prompt template

#### 5. Source Document Citations
- **Citation Display**: Show source documents in responses
- **Clickable Links**: Links to original documents
- **Metadata**: Document metadata (title, page, etc.)

**Configuration**:
- Enable in chatbot config
- Configure citation format
- Customize display template

### Chatflow Configuration

**Chatbot Config** (`chatbotConfig` field):
```json
{
  "welcomeMessage": "Hello! How can I help you?",
  "errorMessage": "Sorry, I encountered an error.",
  "backgroundColor": "#ffffff",
  "fontSize": 16,
  "streaming": true,
  "fileUpload": true,
  "followUpPrompts": true,
  "sourceDocuments": true,
  "allowedOrigins": ["https://example.com"],
  "allowedOriginsError": "This site is not allowed"
}
```

**API Config** (`apiConfig` field):
```json
{
  "streaming": true,
  "timeout": 30000,
  "maxTokens": 2000
}
```

### Chatflow Execution

**Execution Flow**:
1. User sends message via chat interface or API
2. Server loads chatflow from database
3. Flow executed via `buildChatflow()`
4. Variables resolved (e.g., `{{question}}`, `{{chatHistory}}`)
5. Memory loaded (if memory node present)
6. Nodes executed in dependency order
7. Response generated and streamed/returned
8. Chat message saved to database
9. Memory updated (if memory node present)

**API Endpoint**: `POST /api/v1/prediction/:id`

**Request**:
```json
{
  "question": "What is AI?",
  "chatId": "unique-chat-id",
  "streaming": true,
  "overrideConfig": {
    "sessionId": "session-id"
  }
}
```

**Response** (Non-streaming):
```json
{
  "text": "AI is...",
  "sourceDocuments": [...],
  "usedTools": [...]
}
```

**Response** (Streaming):
- SSE stream with chunks:
  - `data: {"type": "token", "value": "AI"}`
  - `data: {"type": "token", "value": " is"}`
  - `data: {"type": "end"}`

---

## Agentflows

### Creating an Agentflow

1. **Navigate**: Go to `/agentflows` page
2. **Create New**: Click "Add New" button
3. **Canvas Opens**: Agentflow canvas opens at `/v2/agentcanvas`
4. **Add Nodes**: Drag nodes from sidebar to canvas
5. **Connect Nodes**: Connect nodes with edges
6. **Configure Nodes**: Click node to configure
7. **Set Starting Node**: Mark one node as starting node
8. **Save**: Click "Save" button
9. **Deploy**: Toggle "Deploy" switch

### Agentflow Features

#### 1. Parallel Execution
- **Multiple Nodes**: Execute multiple nodes simultaneously
- **Dependency Management**: Nodes wait for required inputs
- **Performance**: Faster execution for independent nodes

**How It Works**:
- Graph analyzed for dependencies
- Independent nodes executed in parallel
- Dependent nodes wait for inputs

#### 2. Conditional Branching
- **Condition Nodes**: Evaluate conditions
- **Branch Logic**: Route execution based on conditions
- **Multiple Paths**: Support for multiple branches

**Configuration**:
- Add Condition node
- Define condition logic
- Connect branches to different paths

#### 3. Loops
- **Iteration Nodes**: Loop over data
- **Loop Count**: Configurable loop limits
- **Break Conditions**: Early exit conditions

**Configuration**:
- Add Iteration node
- Configure loop logic
- Set break conditions

#### 4. Human Input
- **Human Input Nodes**: Pause for user input
- **Form Inputs**: Collect structured data
- **Resume Execution**: Continue after input received

**Configuration**:
- Add Human Input node
- Define input schema
- Configure timeout

#### 5. Execution State Tracking
- **State Management**: Track execution state per node
- **State Persistence**: Save state to database
- **Resume Execution**: Resume from saved state

**Storage**: `auto_execution` table

### Agentflow Execution

**Execution Flow**:
1. User triggers execution via API
2. Server loads agentflow from database
3. Graph constructed from nodes and edges
4. Starting node identified
5. Execution starts from starting node
6. Nodes executed in parallel (when possible)
7. State tracked per node
8. Execution data saved to database
9. Final result returned

**API Endpoint**: `POST /api/v1/prediction/:id`

**Request**:
```json
{
  "inputs": {
    "input1": "value1",
    "input2": "value2"
  },
  "sessionId": "session-id"
}
```

**Response**:
```json
{
  "executionId": "execution-guid",
  "state": "FINISHED",
  "results": {
    "node1": {...},
    "node2": {...}
  }
}
```

### Execution States

- **INPROGRESS**: Execution started
- **FINISHED**: Execution completed successfully
- **ERROR**: Execution failed
- **TERMINATED**: Execution terminated by user
- **TIMEOUT**: Execution timed out
- **STOPPED**: Execution stopped

**API Endpoint**: `POST /api/v1/executions/:id/stop` (to stop execution)

---

## Assistants

### Assistant Types

#### 1. OpenAI Assistant
- **Integration**: OpenAI Assistant API
- **Features**: Function calling, file attachments, code interpreter
- **Configuration**: Model, instructions, tools, files

**Creation**:
1. Go to `/assistants` page
2. Click "Add New" → "OpenAI Assistant"
3. Configure model, instructions, tools
4. Add files (optional)
5. Save

**API Integration**: Uses OpenAI Assistant API directly

#### 2. Azure OpenAI Assistant
- **Integration**: Azure OpenAI Assistant API
- **Features**: Same as OpenAI Assistant
- **Configuration**: Azure endpoint, API key, deployment name

**Creation**: Similar to OpenAI Assistant

#### 3. Custom Assistant
- **Integration**: Custom agentflow configuration
- **Features**: Full agentflow capabilities
- **Configuration**: Agentflow definition

**Creation**:
1. Go to `/assistants` page
2. Click "Add New" → "Custom Assistant"
3. Configure agentflow
4. Add tools and document stores
5. Save

### Assistant Features

#### 1. Document Store Integration
- **Knowledge Base**: Attach document stores
- **Vector Search**: Semantic search over documents
- **Automatic Retrieval**: Relevant documents retrieved automatically

**Configuration**:
- Add document stores in assistant config
- Configure retrieval parameters
- Documents available during conversations

#### 2. Tool Integration
- **Custom Tools**: Add custom tools
- **Function Calling**: Tools called automatically
- **Tool Results**: Results included in responses

**Configuration**:
- Add tools in assistant config
- Define tool schemas
- Configure tool selection logic

#### 3. Conversation Management
- **Thread Management**: Manage conversation threads
- **Message History**: Store conversation history
- **Context Retention**: Maintain context across messages

**API Endpoint**: `POST /api/v1/assistants/:id/chat`

**Request**:
```json
{
  "message": "Hello",
  "threadId": "thread-id"
}
```

**Response**:
```json
{
  "message": "Hello! How can I help?",
  "threadId": "thread-id"
}
```

---

## Document Stores

### Creating a Document Store

1. **Navigate**: Go to `/docstore` page
2. **Create New**: Click "Add New" button
3. **Configure**:
   - Name and description
   - Document loader (file, URL, database, etc.)
   - Text splitter (chunking strategy)
   - Embedding model
   - Vector store (Pinecone, Qdrant, etc.)
4. **Upload Documents**: Upload files or provide URLs
5. **Process**: Click "Process" to index documents
6. **Monitor**: Track processing status

### Document Store Features

#### 1. Document Loading
- **90+ Loaders**: Support for various sources
- **Batch Processing**: Process multiple documents
- **Metadata Extraction**: Extract document metadata
- **Format Detection**: Automatic format detection

**Supported Sources**:
- Files (PDF, DOCX, TXT, etc.)
- URLs (web pages, sitemaps)
- Databases (PostgreSQL, MySQL, MongoDB)
- Cloud Storage (S3, GCS, Azure)
- APIs (Notion, Confluence, GitHub)

#### 2. Text Chunking
- **Strategies**: Character-based, recursive, token-based
- **Chunk Size**: Configurable chunk sizes
- **Overlap**: Overlap between chunks
- **Metadata Preservation**: Metadata attached to chunks

**Configuration**:
- Select text splitter node
- Configure chunk size and overlap
- Customize separators

#### 3. Vector Storage
- **Embeddings**: Generate embeddings for chunks
- **Vector Stores**: Store in vector database
- **Metadata**: Store document metadata
- **Indexing**: Create searchable index

**Supported Stores**:
- Pinecone, Qdrant, Weaviate, ChromaDB, Milvus, FAISS, PostgreSQL (pgvector), MongoDB Atlas, and more

#### 4. Document Querying
- **Similarity Search**: Find similar documents
- **Metadata Filtering**: Filter by metadata
- **Top-K Retrieval**: Retrieve top K results
- **Re-ranking**: Re-rank results

**API Endpoint**: `POST /api/v1/document-store/:id/query`

**Request**:
```json
{
  "query": "What is AI?",
  "topK": 5,
  "metadata": {
    "category": "technology"
  }
}
```

**Response**:
```json
{
  "results": [
    {
      "content": "...",
      "metadata": {...},
      "score": 0.95
    }
  ]
}
```

#### 5. Upsert History
- **Tracking**: Track document upsert operations
- **Status**: Monitor processing status
- **History**: View upsert history
- **Retry**: Retry failed operations

**Status Types**:
- `INITIALIZING`: Store being initialized
- `PROCESSING`: Documents being processed
- `READY`: Store ready for queries
- `ERROR`: Error occurred

### Document Store Management

**Operations**:
- **View Chunks**: View document chunks
- **Delete Chunks**: Delete specific chunks
- **Re-process**: Re-process documents
- **Update Config**: Update store configuration
- **Delete Store**: Delete entire store

**API Endpoints**:
- `GET /api/v1/document-store`: List stores
- `GET /api/v1/document-store/:id`: Get store details
- `POST /api/v1/document-store`: Create store
- `PUT /api/v1/document-store/:id`: Update store
- `DELETE /api/v1/document-store/:id`: Delete store
- `POST /api/v1/document-store/:id/upsert`: Upsert documents
- `GET /api/v1/document-store/:id/chunks`: Get chunks
- `GET /api/v1/document-store/:id/upsert-history`: Get history

---

## Tools

### Creating a Tool

1. **Navigate**: Go to `/tools` page
2. **Create New**: Click "Add New" button
3. **Configure**:
   - Name and description
   - Tool schema (input parameters)
   - Function code (JavaScript)
   - Icon and color
4. **Test**: Test tool execution
5. **Save**: Save tool

### Tool Features

#### 1. Custom Functions
- **JavaScript Code**: Write custom functions
- **Node.js APIs**: Access Node.js APIs
- **External APIs**: Call external APIs
- **Data Processing**: Process and transform data

**Function Template**:
```javascript
async function toolFunction(inputs) {
  // Tool logic
  return result;
}
```

#### 2. Schema Definition
- **Input Parameters**: Define input parameters
- **Types**: String, number, boolean, object, array
- **Validation**: Automatic validation
- **JSON Schema**: JSON Schema format

**Schema Example**:
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Search query"
    }
  },
  "required": ["query"]
}
```

#### 3. Tool Integration
- **Agent Integration**: Tools available to agents
- **Function Calling**: Automatic function calling
- **Error Handling**: Graceful error handling
- **Result Formatting**: Structured result format

**Usage in Flows**:
- Add Tool node to flow
- Configure tool selection
- Tools called automatically by agents

### Pre-built Tools

**100+ Pre-built Tools Available**:
- AWS tools (S3, Lambda, Bedrock, etc.)
- Google tools (Search, Gmail, Drive, etc.)
- Notion, Slack, GitHub integrations
- HTTP requests, SQL queries
- Image generation, audio processing
- And 50+ more

**Access**: Tools available in node library under "Tools" category

---

## Credentials

### Creating a Credential

1. **Navigate**: Go to `/credentials` page
2. **Create New**: Click "Add New" button
3. **Select Type**: Choose credential type (OpenAI, AWS, etc.)
4. **Enter Values**: Enter credential values
5. **Save**: Credentials encrypted and saved

### Credential Features

#### 1. Encryption
- **AES-256 Encryption**: Credentials encrypted before storage
- **Key Management**: Encryption key stored in `encryption.key` file
- **Automatic Decryption**: Credentials decrypted during node execution
- **Security**: Credentials never exposed in logs or responses

**Storage**: `auto_credential` table with encrypted data

#### 2. Credential Types
- **API Keys**: OpenAI, Anthropic, Google, etc.
- **AWS Credentials**: Access keys, secret keys
- **Database Credentials**: Connection strings, passwords
- **OAuth2**: OAuth2 tokens and refresh tokens
- **Custom**: Custom credential types

**100+ Credential Types Supported**

#### 3. Credential Management
- **View**: View credential names (values hidden)
- **Update**: Update credential values
- **Delete**: Delete credentials
- **Usage Tracking**: Track where credentials are used

**Security**:
- Credentials scoped to user/organization
- Only creator can modify credentials
- Credentials never logged

### Credential Usage

**In Nodes**:
- Select credential in node configuration
- Credential automatically loaded and decrypted
- Used for API calls and authentication

**API Endpoints**:
- `GET /api/v1/credentials`: List credentials
- `GET /api/v1/credentials/:id`: Get credential details
- `POST /api/v1/credentials`: Create credential
- `PUT /api/v1/credentials/:id`: Update credential
- `DELETE /api/v1/credentials/:id`: Delete credential

---

## Variables

### Creating a Variable

1. **Navigate**: Go to `/variables` page
2. **Create New**: Click "Add New" button
3. **Configure**:
   - Key (variable name)
   - Value (variable value)
   - Type (string, number, boolean, object, array)
4. **Save**: Variable saved globally

### Variable Features

#### 1. Global Variables
- **Organization Scope**: Variables scoped to organization
- **User Scope**: Variables can be user-specific
- **Access**: Variables accessible in all flows

**Usage in Flows**:
- Reference variables in node inputs: `{{variableName}}`
- Variables resolved at runtime
- Support for nested objects: `{{variableName.key}}`

#### 2. Variable Types
- **String**: Text values
- **Number**: Numeric values
- **Boolean**: True/false values
- **Object**: JSON objects
- **Array**: JSON arrays

**Examples**:
- `{{apiKey}}`: API key value
- `{{config.apiUrl}}`: Nested object value
- `{{items[0]}}`: Array element

#### 3. Variable Resolution
- **Runtime Resolution**: Variables resolved during flow execution
- **Override Support**: Variables can be overridden per execution
- **Default Values**: Default values if variable not found

**API Endpoints**:
- `GET /api/v1/variables`: List variables
- `GET /api/v1/variables/:id`: Get variable details
- `POST /api/v1/variables`: Create variable
- `PUT /api/v1/variables/:id`: Update variable
- `DELETE /api/v1/variables/:id`: Delete variable

---

## API Keys

### Creating an API Key

1. **Navigate**: Go to `/apikey` page
2. **Create New**: Click "Add New" button
3. **Configure**:
   - Key name
   - Description (optional)
4. **Generate**: API key and secret generated
5. **Copy**: Copy API key and secret (shown only once)
6. **Save**: API key saved

### API Key Features

#### 1. Key Generation
- **Cryptographic Generation**: `randomBytes(32)` for API key
- **Secret Generation**: `scryptSync()` for API secret
- **Hashing**: Both hashed before storage
- **One-Time Display**: Keys shown only once

**Format**:
- API Key: 64-character hex string
- API Secret: 64-character hex string

#### 2. Key Management
- **View**: View key names (values hidden)
- **Update**: Update key name/description
- **Delete**: Delete API key
- **Regenerate**: Regenerate key/secret

**Security**:
- Keys scoped to user/organization
- Only creator can modify keys
- Keys never logged

#### 3. Key Usage
- **API Authentication**: Use `X-API-KEY` header
- **Organization Context**: Use `X-ORG-ID` header
- **Rate Limiting**: Per-key rate limiting
- **Access Control**: Keys can be flow-specific

**API Request**:
```bash
curl -X POST https://api.example.com/api/v1/prediction/:id \
  -H "X-API-KEY: your-api-key" \
  -H "X-ORG-ID: your-org-id" \
  -H "Content-Type: application/json" \
  -d '{"question": "Hello"}'
```

**API Endpoints**:
- `GET /api/v1/apikey`: List API keys
- `GET /api/v1/apikey/:id`: Get API key details
- `POST /api/v1/apikey`: Create API key
- `PUT /api/v1/apikey/:id`: Update API key
- `DELETE /api/v1/apikey/:id`: Delete API key
- `POST /api/v1/apikey/verify`: Verify API key

---

## Chat Interface

### Chatbot Embedding

**Purpose**: Embed Kodivian chatbots into external websites.

**Features**:
- **Iframe Embedding**: Embed via iframe
- **React Component**: Use React component
- **JavaScript SDK**: Use JavaScript SDK 
- **Customization**: Customize appearance and behavior

**Configuration**:
- Enable in chatbot config
- Set allowed origins
- Configure appearance (colors, fonts, etc.)

**Embed Code**:
```html
<iframe
  src="https://your-domain.com/chatbot/:id"
  width="100%"
  height="600px"
  frameborder="0"
></iframe>
```

### Chat Features

#### 1. Message Display
- **User Messages**: Display user messages
- **Assistant Messages**: Display assistant responses
- **Streaming**: Real-time streaming display
- **Markdown**: Markdown rendering
- **Code Blocks**: Syntax-highlighted code blocks

#### 2. File Uploads
- **Drag & Drop**: Drag files to upload
- **File Preview**: Preview uploaded files
- **Processing Status**: Show processing status
- **File Display**: Display file content in chat

#### 3. Source Documents
- **Citation Display**: Show source documents
- **Clickable Links**: Links to original documents
- **Metadata**: Document metadata display

#### 4. Follow-Up Prompts
- **Suggested Questions**: Display suggested questions
- **Click to Ask**: Click to ask follow-up
- **Context-Aware**: Questions based on context

#### 5. Chat History
- **Session Management**: Manage chat sessions
- **History View**: View conversation history
- **Export**: Export chat history
- **Delete**: Delete chat sessions

**API Endpoints**:
- `GET /api/v1/chatmessage`: Get messages
- `POST /api/v1/chatmessage`: Create message
- `GET /api/v1/chat-sessions`: Get sessions
- `POST /api/v1/chat-sessions`: Create session
- `DELETE /api/v1/chat-sessions/:id`: Delete session

---

## Execution Tracking

### Execution Details

**Purpose**: Track and monitor flow executions.

**Features**:
- **Execution List**: View all executions
- **Execution Details**: View detailed execution data
- **Node Execution**: View individual node executions
- **State Tracking**: Track execution state
- **Error Logs**: View error logs
- **Performance Metrics**: View performance metrics

**Access**: `/executions` page

### Execution Features

#### 1. Execution States
- **INPROGRESS**: Execution in progress
- **FINISHED**: Execution completed successfully
- **ERROR**: Execution failed
- **TERMINATED**: Execution terminated
- **TIMEOUT**: Execution timed out
- **STOPPED**: Execution stopped

#### 2. Execution Data
- **Node Outputs**: View node outputs
- **Inputs/Outputs**: View node inputs and outputs
- **Execution Time**: View execution time per node
- **Token Usage**: View token usage (if available)
- **Cost**: View cost (if available)

#### 3. Execution Filtering
- **By Flow**: Filter by chatflow/agentflow
- **By Session**: Filter by session ID
- **By State**: Filter by execution state
- **By Date**: Filter by date range
- **By User**: Filter by user (if applicable)

**API Endpoints**:
- `GET /api/v1/executions`: List executions
- `GET /api/v1/executions/:id`: Get execution details
- `POST /api/v1/executions/:id/stop`: Stop execution
- `DELETE /api/v1/executions/:id`: Delete execution

### Public Executions

**Purpose**: Share execution details publicly.

**Features**:
- **Public Link**: Generate public link
- **Share**: Share execution with others
- **View Only**: View-only access (no modifications)

**API Endpoint**: `GET /api/v1/public-executions/:id`

---

## Analytics & Observability

### LLM Usage Tracking

**Purpose**: Track LLM usage and costs.

**Features**:
- **Usage Statistics**: View usage by model, provider, date
- **Cost Tracking**: Track costs per model/provider
- **Token Usage**: Track token usage
- **Request Counts**: Track request counts
- **Charts**: Visual charts and graphs

**Access**: `/llmUsage` page

**Metrics**:
- Total tokens
- Total cost
- Requests per day/week/month
- Top models
- Top providers

**API Endpoints**:
- `GET /api/v1/llm-usage`: Get usage statistics
- `GET /api/v1/llm-usage/overview`: Get usage overview

### Analytics Providers

**Supported Providers**:
- **LangSmith**: Tracing and debugging
- **LangFuse**: Observability and analytics
- **Lunary**: Analytics and monitoring
- **LangWatch**: Monitoring and alerts
- **Arize**: Tracing and evaluation
- **Phoenix**: Tracing and debugging
- **Opik**: Tracing and monitoring

**Configuration**:
- Add Analytics node to flow
- Configure provider credentials
- Enable tracing/observability

**Features**:
- Execution tracing
- Performance metrics
- Error tracking
- Cost analysis
- Custom metrics

---

## Marketplace

### Marketplace Templates

**Purpose**: Pre-built flow templates for common use cases.

**Features**:
- **Browse Templates**: Browse available templates
- **Preview**: Preview template structure
- **Import**: Import template to create new flow
- **Categories**: Templates organized by category

**Access**: `/marketplaces` page

### Template Categories

- **Chatflows**: Conversational AI templates
- **Agentflows**: Multi-agent workflow templates
- **Tools**: Tool templates

**Available Templates**:
- Customer Support Bot
- Document Q&A
- Code Assistant
- Data Analysis Agent
- And 30+ more templates

### Template Usage

1. **Browse**: Browse marketplace templates
2. **Preview**: Preview template on canvas
3. **Import**: Click "Use Template" to import
4. **Customize**: Customize template for your needs
5. **Save**: Save as new flow

---

## User Interface

### Main Navigation

**Menu Items**:
- **Home**: Dashboard (`/home`)
- **Chatflows**: Chatflow management (`/chatflows`)
- **Agentflows**: Agentflow management (`/agentflows`)
- **Assistants**: Assistant management (`/assistants`)
- **Document Stores**: Document store management (`/docstore`)
- **Tools**: Tool management (`/tools`)
- **Credentials**: Credential management (`/credentials`)
- **Variables**: Variable management (`/variables`)
- **API Keys**: API key management (`/apikey`)
- **Executions**: Execution tracking (`/executions`)
- **LLM Usage**: Usage statistics (`/llmUsage`)
- **Marketplaces**: Template marketplace (`/marketplaces`)
- **Queues**: Queue management (`/queues`)
- **Logs**: Server logs (`/serverlogs`)
- **Settings**: System settings (`/settings`)

### Canvas Interface

**Components**:
- **Canvas**: Main flow editor (ReactFlow)
- **Node Palette**: Searchable node list
- **Property Panel**: Node configuration form
- **Mini Map**: Flow overview
- **Toolbar**: Save, deploy, settings buttons
- **Sticky Notes**: Add notes to canvas

**Features**:
- **Zoom**: Zoom in/out
- **Pan**: Pan canvas
- **Select**: Select nodes/edges
- **Delete**: Delete selected nodes/edges
- **Undo/Redo**: Undo/redo actions
- **Copy/Paste**: Copy/paste nodes

### Responsive Design

**Breakpoints**:
- **Desktop**: Full feature set
- **Tablet**: Optimized layout
- **Mobile**: Simplified interface

**Features**:
- Responsive layouts
- Touch-friendly controls
- Mobile-optimized canvas

---

## Use Cases

### 1. Customer Support Bot

**Scenario**: Build a customer support chatbot.

**Steps**:
1. Create chatflow
2. Add LLM node (GPT-4)
3. Add Memory node (conversation history)
4. Add Document Loader (knowledge base)
5. Add Vector Store (document storage)
6. Add Retriever (document retrieval)
7. Connect nodes
8. Configure chatbot appearance
9. Deploy and embed

**Features Used**:
- Memory for context
- Document retrieval for knowledge base
- Streaming responses
- Follow-up prompts

### 2. Document Q&A System

**Scenario**: Build a Q&A system over documents.

**Steps**:
1. Create document store
2. Upload documents (PDFs, DOCX, etc.)
3. Configure document loader
4. Configure text splitter
5. Configure embedding model
6. Configure vector store
7. Process documents
8. Create chatflow
9. Add Retriever node (connect to document store)
10. Add LLM node
11. Connect nodes
12. Deploy

**Features Used**:
- Document loading and processing
- Vector storage and search
- Retrieval-augmented generation (RAG)

### 3. Multi-Agent Workflow

**Scenario**: Build a multi-agent workflow for complex tasks.

**Steps**:
1. Create agentflow
2. Add starting node
3. Add agent nodes (specialized agents)
4. Add tool nodes
5. Add conditional nodes
6. Add ending node
7. Connect nodes
8. Configure parallel execution
9. Deploy

**Features Used**:
- Parallel execution
- Conditional branching
- Tool integration
- Execution tracking

### 4. Data Analysis Agent

**Scenario**: Build an agent that analyzes data.

**Steps**:
1. Create agentflow
2. Add data loader node (CSV, JSON, etc.)
3. Add code execution node (Python)
4. Add LLM node (for analysis)
5. Add output formatter node
6. Connect nodes
7. Deploy

**Features Used**:
- Data loading
- Code execution
- LLM analysis
- Output formatting

### 5. API Integration Bot

**Scenario**: Build a bot that integrates with external APIs.

**Steps**:
1. Create chatflow
2. Add HTTP Request tool
3. Add LLM node
4. Configure API credentials
5. Connect nodes
6. Deploy

**Features Used**:
- HTTP Request tool
- Credential management
- LLM for natural language processing

---

## Conclusion

This functional features documentation provides a comprehensive overview of Kodivian's user-facing features, workflows, and capabilities. For technical implementation details, refer to the Technical Documentation.

