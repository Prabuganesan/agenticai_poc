# Smart App Builder (SAB) Architecture & Kodivian Integration

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Core Components](#core-components)
4. [Kodivian Server Integration](#kodivian-server-integration)
5. [Data Flow](#data-flow)
6. [Technology Stack](#technology-stack)
7. [Deployment Model](#deployment-model)

---

## Overview

**Smart App Builder (SAB)** is a low-code, AI-assisted platform for building enterprise web and mobile applications. The platform follows a **"design → generate → deploy"** pipeline:

1. **Java Designer Server** - Visual drag-and-drop designer for creating application metadata
2. **SAB Builder Server** - Generates Angular applications from metadata JSON
3. **Deployment Server** - Hosts generated applications and handles CouchDB CRUD operations
4. **Kodivian Server** - AI orchestration engine for chatflows, agentflows, RAG, and tools

### Key Integration

**Kodivian Server** (Apache 2.0) is integrated as the **AI automation engine**, providing:
- Natural Language Query (NLQ)
- Object creation assistance
- Summaries and JSON comparison
- Multi-agent workflows
- RAG embeddings and search
- AI-assisted design (future roadmap)

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Smart App Builder Platform                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    Java Designer Server (Separate Repo)               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Visual Drag-and-Drop Designer                                 │  │
│  │ - Objects, Fields, Layouts, Validations, Actions            │  │
│  │ - Outputs: Meta JSON                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────────────┘
                       │ Meta JSON
                       ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    SAB Builder Server (Root Level)                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Sails.js Backend (api/, config/, core/ folders)               │  │
│  │ - App Generation (Runtime Angular Build Generator)             │  │
│  │ - Deployment Pipeline (PM2 Clustering)                        │  │
│  │ - Meta JSON Processing                                        │  │
│  │ - Authentication & Authorization                               │  │
│  │ - Multi-tenant (Multi-org) Handling                           │  │
│  │ - Redis/Queue Management                                       │  │
│  │ - CouchDB Live Change Processing                               │  │
│  │ - CI/CD for Generated Apps                                     │  │
│  │ - 40+ Controllers, 485+ Services                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────────────┘
                       │ Generated Angular Apps
                       ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    Deployment Server (inputs/browserapp/)             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Sails.js Server (Port: 2020)                                   │  │
│  │ - Stores Generated Angular Apps (NFS Shared Storage)          │  │
│  │ - Serves Apps to Users                                        │  │
│  │ - Handles CouchDB CRUD for All Apps                           │  │
│  │ - CouchDB Proxy Operations                                    │  │
│  │ - Session Management (SABID cookie)                           │  │
│  │ - All User Traffic Hits This Server                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    SAB Frontend (Angular 17)                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ - Standalone Components (No AppModule)                        │  │
│  │ - Material UI + SCSS                                          │  │
│  │ - Dynamic App Rendering Based on Meta JSON                    │  │
│  │ - Embeds Objects (Employee, Department, Leave, etc.)            │  │
│  │ - Drag-and-Drop UI Generated Apps                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│              Kodivian Server                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Backend: Node.js + LangGraph + TypeScript                     │  │
│  │ - Chatflow/Agentflow Management                               │  │
│  │ - LLM Orchestration (20+ providers)                            │  │
│  │ - Tool Execution (60+ tools)                                  │  │
│  │ - Queue Management (BullMQ + Redis, Org-wise)                  │  │
│  │ - Session Handler (Multi-org session bridge)                  │  │
│  │ - RAG Embeddings and Search                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Frontend: React (Kodivian UI)                                │  │
│  │ - Visual Flow Builder (React Flow)                            │  │
│  │ - 100+ Pre-built LangChain Nodes                              │  │
│  │ - Chat Interface                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ PostgreSQL   │  │ CouchDB      │  │ Redis        │            │
│  │ (Schema,     │  │ (Dynamic      │  │ (Sessions,   │            │
│  │  Metadata,   │  │  Transactional│  │  Queue)      │            │
│  │  Org Data,   │  │  Data)        │  │              │            │
│  │  LLM Usage)  │  │              │  │              │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│  ┌──────────────┐  ┌──────────────┐                               │
│  │ Milvus       │  │ Oracle/MySQL  │                               │
│  │ (Vectors)    │  │ (Optional)    │                               │
│  └──────────────┘  └──────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Java Designer Server

**Note:** This is a separate repository (not in `inputs/` folder)

#### Key Responsibilities:
- Visual drag-and-drop designer interface
- Create application objects, fields, layouts, validations, actions
- Generate meta JSON output
- Send metadata to SAB Builder Server

#### Design → Generate → Deploy Pipeline:
```
Java Designer → Meta JSON → SAB Builder → Angular Apps → Deployment Server
```

### 2. SAB Builder Server

**Location:** Root level (`app_v17_builder/`) with `api/`, `config/`, `core/` folders  
**Note:** This is the main server (separate from `inputs/` folder)  
**Framework:** Sails.js  
**Node.js:** 18+

#### Key Responsibilities:
- **App Generation** - Runtime Angular build generator
- **Deployment Pipeline** - PM2 clustering for app deployment
- **Meta JSON Processing** - Processes metadata from Java Designer
- **Authentication & Authorization** - User session management
- **Multi-tenant (Multi-org) Handling** - Organization-based isolation
- **Redis/Queue Management** - Session and job queue handling
- **CouchDB Live Change Processing** - Real-time data synchronization
- **CI/CD for Generated Apps** - Continuous integration and deployment

#### Key Controllers (40+ controllers in `api/controllers/`):
- **AppContainerController** - Application container management
- **AppDesignerController** - Visual application designer
- **AuthController** - User authentication and authorization
- **CouchApiController** - CouchDB API operations
- **DeployController** - Application deployment
- **PaymentGatewayAuthController** - Payment gateway integration
- **WorkFlowUserApprovalController** - Workflow approval processes
- **FileManageController** - File management
- **ReportGenerationController** - Report generation
- **And 30+ more controllers...**

#### Key Services (485+ services in `api/services/`):
- Dynamic API generation
- File management
- Meta sync
- Process flow
- Report generation
- Custom actions
- Validation
- Analytics

### 3. Deployment Server

**Location:** `inputs/browserapp/`  
**Package Name:** `deploy_server`  
**Framework:** Sails.js v1.5.3  
**Node.js:** 18.17.0  
**Port:** 2020

#### Key Responsibilities:
- **Stores Generated Angular Apps** - Uses NFS shared storage for build files
- **Serves Apps to Users** - All user traffic hits this server
- **Handles CouchDB CRUD** - All CouchDB operations for generated apps
- **CouchDB Proxy Operations** - Proxy forwarding for CouchDB requests
- **Session Management** - SABID cookie-based session handling
- **PM2 Clustering** - Managed via PM2 for production deployment

#### Key Controllers (11 controllers):
- **AppContainerController** - Application container management
- **AuthController** - User authentication and authorization
- **CouchDbProxyController** - CouchDB proxy forwarding
- **SessionController** - Session validation and management
- **AdditionalInfoController** - Additional user information
- **And 6+ more controllers...**

#### Key Services (19 services):
- `appStartupService.js` - Application startup and user info fetching
- `RestService.js` - REST API calls
- `RedisService.js` - Redis session management
- `nanoProvider.js` - CouchDB connection provider
- `customActionService.js` - Custom action execution
- `dataFetchServices.js` - Data fetching operations
- `paymentGateway.js` - Payment gateway integration
- `And 12+ more services...`

#### Session Management:
- Uses **SABID** cookie for session tracking
- Session stored in Redis with format: `{sab_id}$${kodivianSessionId}$${userId}$$Sails{orgId}`
- Session validation via `AuthCheck.js` policy
- Multi-organization session isolation

### 4. SAB Frontend (Angular 17)

**Location:** `inputs/browserapp/ng/`  
**Framework:** Angular 17 (Standalone Components)

#### Key Features:
- **Standalone Components** - No AppModule (Angular 17 feature)
- **Material UI + SCSS** - Material Design components with custom styling
- **Dynamic App Rendering** - Renders applications based on meta JSON
- **Embeds Objects** - Employee, Department, Leave, and other business objects
- **Drag-and-Drop UI** - Generated apps with drag-and-drop capabilities

### 5. Kodivian Server

**Location:** `inputs/kodivian/`

**Location:** `inputs/kodivian/`  
**Base:** Kodivian open-source (Apache 2.0)  
**Framework:** Express.js + TypeScript + LangGraph  
**Frontend:** React (Kodivian UI)  
**Monorepo Structure:** pnpm workspace

#### Key Responsibilities:
- **AI Automation** - Chatflows, agentflows, RAG, tools, LLM orchestration
- **Natural Language Query (NLQ)** - Query data using natural language
- **Object Creation Assistance** - AI-assisted object creation
- **Summaries & JSON Comparison** - Data analysis and comparison
- **Multi-Agent Workflows** - Complex multi-agent orchestration
- **RAG Embeddings and Search** - Retrieval Augmented Generation
- **AI-Assisted Design** - Future roadmap feature
- **Session Bridge** - Integration with SAB session management
- **LLM Usage Tracking** - Token and cost tracking per organization

#### Architecture:
```
packages/
├── server/          # Express.js backend (TypeScript)
│   ├── src/
│   │   ├── controllers/    # API controllers
│   │   ├── services/       # Business logic
│   │   ├── routes/         # API routes
│   │   ├── middlewares/    # Request middlewares
│   │   └── database/       # Database entities & schema
│   └── ...
├── ui/              # React frontend
│   ├── src/
│   │   ├── views/          # Main views (canvas, chatflows, etc.)
│   │   └── components/     # React components
│   └── ...
├── components/      # LangChain node components (100+)
│   └── nodes/
│       ├── agents/         # Agent nodes
│       ├── agentflow/      # Agentflow nodes
│       ├── chains/         # Chain nodes
│       ├── llms/           # LLM nodes
│       ├── memories/       # Memory nodes
│       ├── tools/          # Tool nodes
│       └── vectorstores/   # Vector store nodes
└── api-documentation/  # Swagger API docs
```

#### Key Features:

**1. Visual Flow Builder**
- Drag-and-drop interface using React Flow
- Chatflow and Agentflow support
- 100+ pre-built LangChain nodes

**2. LLM Orchestration**
- Support for 20+ LLM providers:
  - OpenAI (GPT-4, GPT-3.5)
  - Anthropic (Claude)
  - Google (Gemini, Vertex AI)
  - Azure OpenAI
  - Cohere
  - And more...

**3. Agent Types**
- ConversationalAgent
- ToolAgent
- ReActAgent
- XMLAgent
- CSVAgent
- OpenAIAssistant

**4. Tools & Integrations (60+ tools)**
- Web Search (Google, Brave, SerpAPI, Tavily)
- File Operations (Read, Write, Parse)
- Database Tools (PostgreSQL, MySQL, MongoDB, Oracle)
- Vector Stores (Pinecone, Milvus, Qdrant, Weaviate)
- Document Loaders (PDF, CSV, Excel, JSON)
- Custom Tools

**5. Queue System**
- BullMQ for job queuing
- Redis-based queue management
- Worker pool for concurrent execution
- Organization-based queue isolation

**6. Multi-Organization Support**
- Organization-based data isolation
- Per-organization PostgreSQL databases (uses SAB's PostgreSQL org metadata DB)
- Per-organization Redis pools (uses SAB Redis with AUTOID cookie)
- Per-organization CouchDB integration
- Organization configuration service
- Multi-org isolation aligned with SAB architecture
- Queue system upgraded to org-wise queues
- Authentication aligned with SAB session + API Key

### 6. Mobile App

**Location:** `inputs/mobileapp/`  
**Framework:** Ionic + Angular

#### Key Features:
- Cross-platform mobile app (iOS/Android)
- Generated from SAB metadata
- Real-time synchronization
- Offline support

### 7. Platforms

**Location:** `inputs/platforms/`  
**Generated Platforms:**
- Android
- iOS
- Browser

---

## Kodivian Server Integration

### Integration Architecture

Kodivian Server integrates with SAB through a **session bridge mechanism** and shared infrastructure:

```
┌─────────────────────────────────────────────────────────────┐
│                    SAB Builder Server (Sails.js)             │
│                                                              │
│  User Login → Session Created (SABID cookie)                │
│       ↓                                                      │
│  Session Info: {orgId, userId, kodivianSessionId}             │
│  Session Stored in: SAB Redis                                │
└──────────────────────┬──────────────────────────────────────┘
                        │
                        │ GET /api/v1/sessionhandler
                        │ ?params={base64({orgId, kodivianSessionId})}
                        ↓
┌─────────────────────────────────────────────────────────────┐
│              Kodivian Server (Express.js)                  │
│                                                              │
│  Session Handler Controller:                                 │
│  1. Decode base64 params                                     │
│  2. Validate organization configuration                      │
│  3. Create kodivian session token                          │
│  4. Store in Redis (per-org, uses SAB Redis)                 │
│  5. Set AUTOID cookie                                        │
│                                                              │
│  Token Format: {uuid}$${kodivianSessionId}$${userId}$$Auto{orgId}│
│                                                              │
│  Uses SAB's:                                                 │
│  - PostgreSQL org metadata DB                                │
│  - Redis (AUTOID cookie)                                     │
│  - Multi-org isolation architecture                          │
└─────────────────────────────────────────────────────────────┘
```

### Session Handler Flow

**1. Session Creation Request:**
```
GET /api/v1/sessionhandler?params={base64({orgId, kodivianSessionId})}
```

**2. Session Handler Process:**
- Decodes base64 parameters
- Validates organization configuration
- Checks for existing AUTOID cookie
- Creates new kodivian session token
- Stores session in Redis (per-organization)
- Sets AUTOID cookie with session token

**3. Session Token Format:**
```
{uuid}$${kodivianSessionId}$${userId}$$Auto{orgId}
```

**4. Session Storage:**
- Redis key: `KODIVIAN_SESSION_{token}`
- Redis database: Per-organization (REDIS_DB_SESSION)
- TTL: SESSION_COOKIE_MAX_AGE (default: 900 seconds)

### Key Integration Points

#### 1. Session Handler Route
**File:** `kodivian/packages/server/src/routes/session-handler.route.ts`

- Handles session creation from main server
- Validates organization configuration
- Creates kodivian session tokens
- Manages AUTOID cookies

#### 2. Session Handler Controller
**File:** `kodivian/packages/server/src/controllers/session-handler.controller.ts`

- `createSession()` - Creates kodivian session from SAB session
- `validateSession()` - Validates existing kodivian session
- Uses SimpleCrypto for encryption (same key as SAB)

#### 3. Kodivian Session Service
**File:** `kodivian/packages/server/src/services/kodivian-session.service.ts`

- `createKodivianSession()` - Creates session token
- `getKodivianSession()` - Retrieves session data
- `deleteKodivianSession()` - Deletes session
- Manages per-organization Redis pools

#### 4. Session Validation Middleware
**File:** `kodivian/packages/server/src/middlewares/session-validation.middleware.ts`

- Validates AUTOID cookie on each request
- Extracts orgId, userId from token
- Attaches session data to request object

### Organization Configuration

**File:** `kodivian/packages/server/src/services/org-config.service.ts`

- Loads organization configurations from main database
- Manages per-organization:
  - PostgreSQL database connections
  - Redis connections
  - CouchDB connections
  - Oracle database connections (optional)

**Configuration Sources:**
- Main PostgreSQL database (`MAIN_DB_*`)
- Organization-specific configs stored in `auto_org_config` table

### Multi-Organization Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Kodivian Server Instance                      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Organization Config Service                       │    │
│  │  - Loads all org configs at startup               │    │
│  │  - Manages per-org database connections           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Org 1      │  │   Org 2      │  │   Org N      │    │
│  │              │  │              │  │              │    │
│  │ PostgreSQL   │  │ PostgreSQL   │  │ PostgreSQL   │    │
│  │ Redis Pool   │  │ Redis Pool   │  │ Redis Pool   │    │
│  │ CouchDB      │  │ CouchDB      │  │ CouchDB      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Each organization has isolated:
  - PostgreSQL database
  - Redis connection pool
  - CouchDB connection
  - Session storage
  - Queue namespace

---

## Data Flow

### 1. Application Design & Generation Flow

```
User → Java Designer Server
  ↓
Design Objects, Fields, Layouts, Validations, Actions
  ↓
Meta JSON Generated
  ↓
Meta JSON → SAB Builder Server
  ↓
SAB Builder Processes Meta JSON
  ↓
Angular App Generated (Runtime Build)
  ↓
App Deployed to Deployment Server (PM2 Clustering)
  ↓
App Available to Users
```

### 2. User Login Flow

```
User → SAB Builder Server Login
  ↓
AuthController.login()
  ↓
appStartupService.authenticateAndFetchUserInfo()
  ↓
BridgeController.callDesigner() → Java Designer Service
  ↓
Session Created (SABID cookie in SAB Redis)
  ↓
User Redirected to Application (Deployment Server)
```

### 3. Kodivian Session Creation Flow

```
User Accesses Kodivian UI
  ↓
BrowserApp Redirects to Kodivian Server
  ↓
GET /api/v1/sessionhandler?params={base64({orgId, kodivianSessionId})}
  ↓
SessionHandlerController.createSession()
  ↓
1. Decode params
2. Validate org config
3. Create kodivian session token
4. Store in Redis (per-org)
5. Set AUTOID cookie
  ↓
User Authenticated in Kodivian Server
```

### 4. AI Agent Execution Flow

```
User Creates Chatflow/Agentflow in Kodivian UI
  ↓
Flow Saved to PostgreSQL (per-org)
  ↓
User Executes Flow
  ↓
Request → Session Validation Middleware
  ↓
Extract orgId, userId from AUTOID cookie
  ↓
Route to Appropriate Organization Database
  ↓
Execute Flow:
  ├─→ LLM Calls (tracked)
  ├─→ Tool Execution
  ├─→ Vector Store Operations
  └─→ Queue Jobs (if async)
  ↓
Response with Usage Metrics
  ↓
LLM Usage Saved to Database (per-org)
```

### 5. Queue Processing Flow

```
User Submits Async Job
  ↓
Job Added to BullMQ Queue (per-org)
  ↓
Worker Picks Up Job
  ↓
Execute Flow/Agent
  ↓
LLM Calls & Tool Execution
  ↓
Results Stored
  ↓
User Notified (WebSocket/HTTP)
```

---

## Technology Stack

### Java Designer Server
- **Language:** Java
- **Purpose:** Visual drag-and-drop designer
- **Output:** Meta JSON

### SAB Builder Server (Root Level)
- **Location:** Root level with `api/`, `config/`, `core/` folders
- **Framework:** Sails.js
- **Runtime:** Node.js 18+
- **Controllers:** 40+ controllers
- **Services:** 485+ services
- **Database:** PostgreSQL (metadata), CouchDB (business data)
- **Deployment:** PM2 Clustering
- **Storage:** NFS Shared Storage (for generated apps)

### Deployment Server (`inputs/browserapp/`)
- **Framework:** Sails.js v1.5.3
- **Runtime:** Node.js 18.17.0
- **Port:** 2020
- **Package Name:** `deploy_server`
- **Controllers:** 11 controllers
- **Services:** 19 services
- **Storage:** NFS Shared Storage
- **Traffic:** All user traffic for generated apps
- **CouchDB:** Handles all CRUD operations
- **Session:** SABID cookie-based session management

### Kodivian Server
- **Base:** Flowise open-source (Apache 2.0)
- **Framework:** Express.js + TypeScript
- **AI Framework:** LangChain + LangGraph
- **Runtime:** Node.js 18+
- **Frontend:** React (Kodivian UI) + React Flow
- **Queue System:** BullMQ (org-wise queues)
- **Session Store:** Redis (uses SAB Redis, AUTOID cookie)
- **Database:** PostgreSQL (uses SAB's org metadata DB), Oracle (optional)
- **Vector Store:** Milvus (optional)

### Mobile App
- **Framework:** Ionic + Angular
- **Platforms:** iOS, Android
- **Build:** Cordova

### Data Storage
- **PostgreSQL:** Metadata, configurations, LLM usage tracking
- **CouchDB:** Business data, user sessions
- **Redis:** Session storage, queue management, caching
- **Milvus:** Vector embeddings (optional)
- **Oracle/MySQL:** Optional database backends

---

## Deployment Model

### SAB Multi-Server Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Instance (SAB)                      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Java Designer Server (Separate Repo)             │    │
│  │  - Visual Drag-and-Drop Designer                   │    │
│  │  - Outputs Meta JSON                                │    │
│  └────────────────────────────────────────────────────┘    │
│                        ↓ Meta JSON                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │  SAB Builder Server (Root: api/, config/, core/)    │    │
│  │  - Handles: App Build, Meta JSON Processing        │    │
│  │  - Deployment Pipeline (PM2 Clustering)             │    │
│  │  - Redis/Queue Management                           │    │
│  │  - CouchDB Live Change Processing                  │    │
│  │  - CI/CD for Generated Apps                         │    │
│  │  - 40+ Controllers, 485+ Services                   │    │
│  └────────────────────────────────────────────────────┘    │
│                        ↓ Generated Apps                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Deployment Server (inputs/browserapp/)             │    │
│  │  - Port: 2020                                       │    │
│  │  - Stores Generated Angular Apps (NFS)              │    │
│  │  - Serves Apps to Users                             │    │
│  │  - Handles CouchDB CRUD for All Apps               │    │
│  │  - All User Traffic Hits This Server                │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Kodivian Server (inputs/kodivian/)              │    │
│  │  - Port: 3030 (SERVER_PORT)                         │    │
│  │  - Context Path: /kodivian                        │    │
│  │  - Handles: AI Agents, LLM Orchestration            │    │
│  │  - Uses SAB's PostgreSQL & Redis                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Shared Infrastructure                               │    │
│  │  - PostgreSQL (Schema, Metadata, Org Data)         │    │
│  │  - Redis (Sessions + Queues)                        │    │
│  │  - CouchDB (Dynamic Transactional Data)             │    │
│  │  - NFS Shared Storage (Generated Apps)              │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Key Deployment Characteristics

1. **Multi-Server Structure:**
   - **SAB Builder Server** (Root level: `api/`, `config/`, `core/`) - Handles app build, meta JSON processing, Redis/queue, CouchDB live changes, CI/CD
   - **Deployment Server** (`inputs/browserapp/`) - Stores generated apps, serves apps to users, handles CouchDB CRUD
   - **Kodivian Server** (`inputs/kodivian/`) - AI automation engine
   - All servers connect to the same PostgreSQL + CouchDB

2. **Design → Generate → Deploy Pipeline:**
   - Java Designer Server creates meta JSON via drag-and-drop
   - SAB Builder Server generates Angular apps from JSON
   - Deployment Server hosts generated apps + handles CouchDB CRUD

3. **Single Instance, Multi-Organization:**
   - One Kodivian server instance
   - Multiple organizations share the instance
   - Data isolation via per-org databases
   - Uses SAB's PostgreSQL org metadata DB
   - Uses SAB Redis (AUTOID cookie)

4. **Session Bridge:**
   - Builder server creates SAB session (SABID cookie)
   - Kodivian server creates kodivian session via session handler
   - Both sessions linked via kodivianSessionId
   - User session managed by SAB Redis

5. **Database Isolation:**
   - Each organization has its own PostgreSQL database
   - Each organization has its own Redis database
   - Each organization has its own CouchDB database

6. **Queue Isolation:**
   - Each organization has its own queue namespace
   - Queue system upgraded to org-wise queues
   - Queue name format: `{QUEUE_NAME}-{orgId}`

### Environment Configuration

**SAB Builder Server (Root level):**
- Main Sails.js configuration
- `api/` - Controllers and services
- `config/` - Server configuration
- `core/` - Core utilities
- Handles app generation and deployment pipeline

**Deployment Server (`inputs/browserapp/`):**
- Port: 2020
- Package name: `deploy_server`
- NFS shared storage for generated apps
- Serves all user traffic for generated apps
- Handles CouchDB CRUD operations
- Session management (SABID cookie)

**Kodivian Server:**
- `SERVER_PORT` - Server port (default: 3030)
- `CONTEXT_PATH` - Context path (default: /kodivian)
- `MAIN_DB_*` - Main database connection (uses SAB's PostgreSQL)
- `SESSION_COOKIE_DOMAIN` - Cookie domain
- `REDIS_DB_SESSION` - Redis DB for sessions (default: 1, uses SAB Redis)
- `REDIS_DB_QUEUE` - Redis DB for queues (default: 3)
- Authentication aligned with SAB session + API Key

---

## Summary

Smart App Builder is a comprehensive low-code platform with a **"design → generate → deploy"** pipeline that integrates Kodivian Server as its AI automation engine.

### Architecture Summary (One Line Each)

1. **Java Designer Server** → Creates meta JSON via drag-and-drop
2. **SAB Builder Server** (Root: `api/`, `config/`, `core/`) → Generates Angular apps from JSON
3. **Deployment Server** (`inputs/browserapp/`) → Hosts generated apps + handles CouchDB CRUD
4. **PostgreSQL** → Stores schema, metadata, organization data
5. **CouchDB** → Stores dynamic transactional data
6. **Redis** → Session + queue management
7. **Angular Frontend** → Renders dynamic app (Standalone Components, Material UI)
8. **Kodivian Server** (`inputs/kodivian/`) → AI automation engine (chatflows, agentflows, RAG, tools)

### Key Integration Points

1. **Session Bridge** - Seamless session sharing between SAB Builder Server and Kodivian Server
2. **Shared Infrastructure** - Kodivian uses SAB's PostgreSQL org metadata DB and Redis
3. **Multi-Organization Support** - Isolated data and configurations per organization
4. **Unified User Experience** - Single sign-on across both platforms
5. **AI-Powered Workflows** - Visual flow builder for creating AI agents and workflows
6. **Scalable Architecture** - Queue-based processing for async operations (org-wise queues)
7. **Authentication Alignment** - Kodivian authentication aligned with SAB session + API Key

### Kodivian Server Role

Kodivian becomes the **AI brain for SAB**, providing:
- Chat with data (NLQ)
- Write logic
- Analyze objects
- Write code
- Summaries
- Suggestions
- AI-assisted design (future roadmap)

The architecture enables organizations to build enterprise applications with AI capabilities while maintaining data isolation and security across multiple tenants.

