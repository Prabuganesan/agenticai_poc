# Kodivian Nodes Analysis - Complete List

## Overview

This document provides a comprehensive analysis of **all node types** available in Kodivian, organized by category. This includes tools, agents, chains, chat models, embeddings, vector stores, memory, and all other node types.

**Context:**
- Kodivian supports **multi-org** based on `orgId` (managed by external admin app)
- Each client typically has their own instance (production)
- Development uses single instance with multi-org
- Configuration is restricted by `userId`
- Focus on enterprise/internal tools, not consumer/marketing tools

**Removed Nodes:**
- **ChainTool**, **RetrieverTool**, and **WebBrowser** have been completely removed from the codebase
- Additional nodes can be disabled via `DISABLED_NODES` environment variable

---

## Table of Contents

1. [Agentflow Nodes](#1-agentflow-nodes)
2. [Agent Nodes](#2-agent-nodes)
3. [Tool Nodes](#3-tool-nodes)
4. [Chain Nodes](#4-chain-nodes)
5. [Chat Model Nodes](#5-chat-model-nodes)
6. [LLM Nodes](#6-llm-nodes)
7. [Embedding Nodes](#7-embedding-nodes)
8. [Vector Store Nodes](#8-vector-store-nodes)
9. [Retriever Nodes](#9-retriever-nodes)
10. [Memory Nodes](#10-memory-nodes)
11. [Document Loader Nodes](#11-document-loader-nodes)
12. [Text Splitter Nodes](#12-text-splitter-nodes)
13. [Output Parser Nodes](#13-output-parser-nodes)
14. [Prompt Nodes](#14-prompt-nodes)
15. [Analytic Nodes](#15-analytic-nodes)
16. [Cache Nodes](#16-cache-nodes)
17. [Moderation Nodes](#17-moderation-nodes)
18. [Utility Nodes](#18-utility-nodes)
19. [Graph Nodes](#19-graph-nodes)
20. [Record Manager Nodes](#20-record-manager-nodes)
21. [Response Synthesizer Nodes](#21-response-synthesizer-nodes)
22. [Speech-to-Text Nodes](#22-speech-to-text-nodes)

---

## 1. Agentflow Nodes

Agentflow nodes are specific to the Agentflow V2 architecture for building multi-agent workflows.

| Node Name | Type | Status | Notes |
|-----------|------|--------|-------|
| **Start** | Entry Point | ✅ **KEEP** | Starting point of agentflow - defines input type (chat/form) |
| **Agent** | Core | ✅ **KEEP** | Core agent node - executes agent with tools and knowledge |
| **Tool** | Tool Integration | ✅ **KEEP** | Integrates tools into agentflow |
| **LLM** | LLM | ✅ **KEEP** | Direct LLM calls in agentflow |
| **Condition** | Control Flow | ✅ **KEEP** | Conditional branching logic |
| **ConditionAgent** | Control Flow | ✅ **KEEP** | Agent-based conditional logic |
| **ExecuteFlow** | Flow Control | ✅ **KEEP** | Executes nested chatflows/agentflows |
| **HTTP** | Integration | ✅ **KEEP** | HTTP request handling |
| **Iteration** | Control Flow | ✅ **KEEP** | Iterative processing |
| **Loop** | Control Flow | ✅ **KEEP** | Loop control structure |
| **Retriever** | Retrieval | ✅ **KEEP** | Vector store retrieval in agentflow |
| **CustomFunction** | Custom | ✅ **KEEP** | Custom JavaScript functions |
| **DirectReply** | Response | ✅ **KEEP** | Direct response without LLM |
| **HumanInput** | Input | ✅ **KEEP** | Human input collection |
| **StickyNote** | Utility | ✅ **KEEP** | Notes/documentation in flow |

**Total: 15 nodes** - All essential for Agentflow V2 architecture

---

## 2. Agent Nodes

Agent nodes provide different agent architectures and execution patterns.

| Node Name | Type | Status | Notes |
|-----------|------|--------|-------|
| **OpenAIAssistant** | OpenAI | ✅ **KEEP** | OpenAI Assistant API integration |
| **ConversationalAgent** | Conversational | ✅ **KEEP** | Conversational agent with memory |
| **ReActAgentLLM** | ReAct | ✅ **KEEP** | ReAct agent using LLM |
| **ReActAgentChat** | ReAct | ✅ **KEEP** | ReAct agent using chat model |
| **ToolAgent** | Tool-based | ✅ **KEEP** | Agent focused on tool usage |
| **ConversationalRetrievalToolAgent** | RAG | ✅ **KEEP** | Conversational agent with retrieval |
| **CSVAgent** | Data | ✅ **KEEP** | Agent for CSV data processing |
| **XMLAgent** | XML | ✅ **KEEP** | Agent for XML data processing |
| **AirtableAgent** | Integration | ⚠️ **REVIEW** | Airtable-specific agent - review if used |
**Total: 9 nodes**
- Keep: 8
- Review: 1 (AirtableAgent)

---

## 3. Tool Nodes

Tool nodes provide various tools that agents can use. See detailed analysis below.

### 3.1 Core Tool Nodes

| Tool Name | Category | Status | Notes |
|-----------|----------|--------|-------|
| **Calculator** | Utility | ✅ **KEEP** | Basic math operations - useful for agents |
| **CurrentDateTime** | Utility | ✅ **KEEP** | Get current date/time - essential |
| **CustomTool** | Custom | ✅ **KEEP** | Allows custom JavaScript functions - essential |
| **JSONPathExtractor** | Data Processing | ✅ **KEEP** | Extract data from JSON - useful |
| **ChatflowTool** | Integration | ✅ **KEEP** | Call other chatflows as tools - useful |
| **AgentAsTool** | Integration | ✅ **KEEP** | Use agents as tools - useful for complex workflows |
| **WebScraperTool** | Web | ⚠️ **REVIEW** | Web scraping - legal/compliance review needed |

### 3.2 Search & Web Tools

| Tool Name | Category | Status | Notes |
|-----------|----------|--------|-------|
| **GoogleSearchAPI** | Search | ✅ **KEEP** | Google search - useful for RAG |
| **BraveSearchAPI** | Search | ✅ **KEEP** | Brave search - alternative search |
| **SerpAPI** | Search | ✅ **KEEP** | SERP API - search results |
| **Serper** | Search | ✅ **KEEP** | Serper API - search results |
| **TavilyAPI** | Search | ✅ **KEEP** | Tavily search - AI-powered search |
| **ExaSearch** | Search | ✅ **KEEP** | Exa search - semantic search |
| **SearchApi** | Search | ✅ **KEEP** | Search API - generic search |
| **Searxng** | Search | ✅ **KEEP** | SearXNG - self-hosted search |
| **Arxiv** | Academic | ✅ **KEEP** | ArXiv paper search - useful for research |

### 3.3 Google Workspace Tools

| Tool Name | Category | Status | Notes |
|-----------|----------|--------|-------|
| **Gmail** | Communication | ✅ **KEEP** | Gmail integration - useful for enterprise |
| **GoogleCalendar** | Calendar | ✅ **KEEP** | Google Calendar - useful for scheduling |
| **GoogleDocs** | Documents | ✅ **KEEP** | Google Docs - document management |
| **GoogleDrive** | Storage | ✅ **KEEP** | Google Drive - file storage |
| **GoogleSheets** | Spreadsheets | ✅ **KEEP** | Google Sheets - data management |

### 3.4 Microsoft Tools

| Tool Name | Category | Status | Notes |
|-----------|----------|--------|-------|
| **MicrosoftOutlook** | Communication | ✅ **KEEP** | Outlook email - enterprise communication |
| **MicrosoftTeams** | Communication | ✅ **KEEP** | Teams integration - enterprise collaboration |

### 3.5 Development & Code Tools

| Tool Name | Category | Status | Notes |
|-----------|----------|--------|-------|
| **CodeInterpreterE2B** | Code Execution | ⚠️ **REVIEW** | Code execution in sandbox - security review needed |
| **OpenAPIToolkit** | API | ✅ **KEEP** | OpenAPI integration - useful for API calls |

### 3.6 HTTP Request Tools

| Tool Name | Category | Status | Notes |
|-----------|----------|--------|-------|
| **RequestsGet** | HTTP | ✅ **KEEP** | HTTP GET requests - essential |
| **RequestsPost** | HTTP | ✅ **KEEP** | HTTP POST requests - essential |
| **RequestsPut** | HTTP | ✅ **KEEP** | HTTP PUT requests - essential |
| **RequestsDelete** | HTTP | ✅ **KEEP** | HTTP DELETE requests - essential |

### 3.7 AWS Tools

| Tool Name | Category | Status | Notes |
|-----------|----------|--------|-------|
| **AWSDynamoDBKVStorage** | AWS | ✅ **KEEP** | DynamoDB key-value storage - if AWS is used |
| **AWSSNS** | AWS | ✅ **KEEP** | SNS notifications - if AWS is used |

### 3.8 Project Management Tools

| Tool Name | Category | Status | Notes |
|-----------|----------|--------|-------|
| **Jira** | Project Management | ✅ **KEEP** | Jira integration - useful for enterprise |

### 3.9 Third-Party Integration Tools

| Tool Name | Category | Status | Notes |
|-----------|----------|--------|-------|
| **Composio** | Integration Platform | ⚠️ **REVIEW** | Multi-app integration platform - review if needed |
| **WolframAlpha** | Computation | ✅ **KEEP** | Wolfram Alpha - advanced computation |

### 3.10 MCP (Model Context Protocol) Tools

| Tool Name | Category | Status | Notes |
|-----------|----------|--------|-------|
| **MCP/BraveSearch** | MCP/Search | ✅ **KEEP** | Brave search via MCP |
| **MCP/Github** | MCP/Development | ✅ **KEEP** | GitHub integration via MCP |
| **MCP/PostgreSQL** | MCP/Database | ✅ **KEEP** | PostgreSQL via MCP - useful |
| **MCP/Slack** | MCP/Communication | ✅ **KEEP** | Slack via MCP |
| **MCP/Teradata** | MCP/Database | ✅ **KEEP** | Teradata via MCP - if used |
| **MCP/CustomMCP** | MCP/Custom | ✅ **KEEP** | Custom MCP servers - flexible |
| **MCP/SequentialThinking** | MCP/AI | ✅ **KEEP** | Sequential thinking MCP |
| **MCP/Supergateway** | MCP/Integration | ✅ **KEEP** | Supergateway MCP |

### 3.11 Removed Tools

| Tool Name | Status | Reason |
|-----------|--------|--------|
| **ChainTool** | ✅ **REMOVED** | Redundant in V2 - chains can be used directly |
| **RetrieverTool** | ✅ **REMOVED** | Redundant in V2 - use Knowledge nodes instead |
| **WebBrowser** | ✅ **REMOVED** | Security risks and resource intensive |

**Total Tool Nodes: 44** (3 removed: ChainTool, RetrieverTool, WebBrowser)

---

## 4. Chain Nodes

Chain nodes provide pre-built chain architectures for common use cases.

| Node Name | Type | Status | Notes |
|-----------|------|--------|-------|
| **LLMChain** | Basic | ✅ **KEEP** | Basic LLM chain - essential |
| **ConversationChain** | Conversational | ✅ **KEEP** | Conversational chain with memory |
| **ConversationalRetrievalQAChain** | RAG | ✅ **KEEP** | Conversational QA with retrieval |
| **VectaraChain** | RAG | ✅ **KEEP** | Vectara-specific chain |
| **SqlDatabaseChain** | Database | ✅ **KEEP** | SQL database query chain |
| **GraphCypherQAChain** | Graph | ✅ **KEEP** | Neo4j graph database QA chain |

**Total: 5 nodes** - Essential chain nodes
**Removed:** RetrievalQAChain, VectorDBQAChain, MultiRetrievalQAChain, MultiPromptChain, ApiChain (POSTApiChain, GETApiChain, OpenAPIChain) - deprecated

---

## 5. Chat Model Nodes

Chat model nodes provide access to various LLM providers via chat interfaces.

| Node Name | Provider | Status | Notes |
|-----------|----------|--------|-------|
| **ChatOpenAI** | OpenAI | ✅ **KEEP** | OpenAI GPT models - essential |
| **ChatOpenAICustom** | OpenAI | ✅ **KEEP** | Custom OpenAI endpoint |
| **AzureChatOpenAI** | Azure | ✅ **KEEP** | Azure OpenAI - enterprise |
| **ChatAnthropic** | Anthropic | ✅ **KEEP** | Claude models - essential |
| **ChatGoogleGenerativeAI** | Google | ✅ **KEEP** | Gemini models - essential |
| **ChatGoogleVertexAI** | Google | ✅ **KEEP** | Vertex AI - enterprise |
| **ChatOllama** | Ollama | ✅ **KEEP** | Local Ollama models |
| **ChatLitellm** | LiteLLM | ✅ **KEEP** | Unified LLM interface |
| **ChatOpenRouter** | OpenRouter | ✅ **KEEP** | OpenRouter unified API |
| **ChatPerplexity** | Perplexity | ✅ **KEEP** | Perplexity AI |
| **AWSBedrock** | AWS | ✅ **KEEP** | AWS Bedrock - if AWS used |
| **ChatCohere** | Cohere | ✅ **KEEP** | Cohere models |
| **ChatFireworks** | Fireworks | ✅ **KEEP** | Fireworks AI |
| **ChatMistral** | Mistral | ✅ **KEEP** | Mistral AI models |
| **ChatTogetherAI** | Together AI | ✅ **KEEP** | Together AI |
| **ChatXAI** | xAI | ✅ **KEEP** | xAI Grok models |
| **Groq** | Groq | ✅ **KEEP** | Groq inference |
| **Deepseek** | DeepSeek | ✅ **KEEP** | DeepSeek models |
| **ChatSambanova** | SambaNova | ✅ **KEEP** | SambaNova models |
| **ChatNvdiaNIM** | NVIDIA | ✅ **KEEP** | NVIDIA NIM |
| **ChatIBMWatsonx** | IBM | ✅ **KEEP** | IBM Watsonx - enterprise |
| **ChatBaiduWenxin** | Baidu | ⚠️ **REVIEW** | Baidu Wenxin - China-specific |
| **ChatNemoGuardrails** | NVIDIA | ✅ **KEEP** | NVIDIA NeMo Guardrails |
| **ChatLocalAI** | Local | ✅ **KEEP** | Local AI models |
| **ChatCerebras** | Cerebras | ✅ **KEEP** | Cerebras models |
| **ChatCometAPI** | Comet | ✅ **KEEP** | Comet API |

**Total: 26 nodes**
- Keep: 25
- Review: 1 (ChatBaiduWenxin - region-specific)

---

## 6. LLM Nodes

LLM nodes provide access to LLM providers (non-chat interface).

| Node Name | Provider | Status | Notes |
|-----------|----------|--------|-------|
| **OpenAI** | OpenAI | ✅ **KEEP** | OpenAI GPT models |
| **Azure OpenAI** | Azure | ✅ **KEEP** | Azure OpenAI |
| **Cohere** | Cohere | ✅ **KEEP** | Cohere models |
| **GoogleVertexAI** | Google | ✅ **KEEP** | Vertex AI |
| **Ollama** | Ollama | ✅ **KEEP** | Local Ollama models |
| **Replicate** | Replicate | ✅ **KEEP** | Replicate models |
| **HuggingFaceInference** | HuggingFace | ✅ **KEEP** | HuggingFace inference |
| **TogetherAI** | Together AI | ✅ **KEEP** | Together AI |
| **Fireworks** | Fireworks | ✅ **KEEP** | Fireworks AI |
| **AWSBedrock** | AWS | ✅ **KEEP** | AWS Bedrock |
| **IBMWatsonx** | IBM | ✅ **KEEP** | IBM Watsonx |
| **SambaNova** | SambaNova | ✅ **KEEP** | SambaNova models |

**Total: 12 nodes** - All essential for various LLM providers

---

## 7. Embedding Nodes

Embedding nodes provide vector embeddings for RAG and similarity search.

| Node Name | Provider | Status | Notes |
|-----------|----------|--------|-------|
| **OpenAIEmbedding** | OpenAI | ✅ **KEEP** | OpenAI embeddings - essential |
| **OpenAIEmbeddingCustom** | OpenAI | ✅ **KEEP** | Custom OpenAI endpoint |
| **AzureOpenAIEmbedding** | Azure | ✅ **KEEP** | Azure OpenAI embeddings |
| **GoogleGenerativeAIEmbedding** | Google | ✅ **KEEP** | Google Gemini embeddings |
| **GoogleVertexAIEmbedding** | Google | ✅ **KEEP** | Vertex AI embeddings |
| **CohereEmbedding** | Cohere | ✅ **KEEP** | Cohere embeddings |
| **HuggingFaceInferenceEmbedding** | HuggingFace | ✅ **KEEP** | HuggingFace embeddings |
| **OllamaEmbedding** | Ollama | ✅ **KEEP** | Local Ollama embeddings |
| **LocalAIEmbedding** | Local | ✅ **KEEP** | Local AI embeddings |
| **TogetherAIEmbedding** | Together AI | ✅ **KEEP** | Together AI embeddings |
| **VoyageAIEmbedding** | Voyage AI | ✅ **KEEP** | Voyage AI embeddings |
| **JinaAIEmbedding** | Jina AI | ✅ **KEEP** | Jina AI embeddings |
| **MistralEmbedding** | Mistral | ✅ **KEEP** | Mistral embeddings |
| **AWSBedrockEmbedding** | AWS | ✅ **KEEP** | AWS Bedrock embeddings |
| **IBMWatsonxEmbedding** | IBM | ✅ **KEEP** | IBM Watsonx embeddings |

**Total: 15 nodes** - All essential for RAG workflows

---

## 8. Vector Store Nodes

Vector store nodes provide vector database storage for embeddings.

| Node Name | Provider | Status | Notes |
|-----------|----------|--------|-------|
| **Pinecone** | Pinecone | ✅ **KEEP** | Pinecone vector database |
| **Weaviate** | Weaviate | ✅ **KEEP** | Weaviate vector database |
| **Qdrant** | Qdrant | ✅ **KEEP** | Qdrant vector database |
| **Chroma** | Chroma | ✅ **KEEP** | Chroma vector database |
| **Milvus** | Milvus | ✅ **KEEP** | Milvus vector database |
| **HybridMilvus** | Milvus | ✅ **KEEP** | Hybrid Milvus |
| **Zep** | Zep | ✅ **KEEP** | Zep vector store |
| **ZepCloud** | Zep | ✅ **KEEP** | Zep Cloud |
| **Redis** | Redis | ✅ **KEEP** | Redis vector store |
| **Upstash** | Upstash | ✅ **KEEP** | Upstash vector store |
| **Postgres** | PostgreSQL | ✅ **KEEP** | PostgreSQL vector store (pgvector) |
| **Supabase** | Supabase | ✅ **KEEP** | Supabase vector store |
| **MongoDBAtlas** | MongoDB | ✅ **KEEP** | MongoDB Atlas vector search |
| **Astra** | DataStax | ✅ **KEEP** | DataStax Astra |
| **OpenSearch** | OpenSearch | ✅ **KEEP** | OpenSearch vector search |
| **Elasticsearch** | Elasticsearch | ✅ **KEEP** | Elasticsearch vector search |
| **Meilisearch** | Meilisearch | ✅ **KEEP** | Meilisearch vector search |
| **Singlestore** | SingleStore | ✅ **KEEP** | SingleStore vector store |
| **Couchbase** | Couchbase | ✅ **KEEP** | Couchbase vector store |
| **InMemory** | In-Memory | ✅ **KEEP** | In-memory vector store (testing) |
| **Vectara** | Vectara | ✅ **KEEP** | Vectara vector store |
| **Kendra** | AWS | ✅ **KEEP** | AWS Kendra - if AWS used |
| **DocumentStoreVS** | Custom | ✅ **KEEP** | Document store vector store |

**Total: 23 nodes** - All essential for vector storage

---

## 9. Retriever Nodes

Retriever nodes provide various retrieval strategies for RAG.

| Node Name | Type | Status | Notes |
|-----------|------|--------|-------|
| **VectorStoreRetriever** | Basic | ✅ **KEEP** | Basic vector store retrieval - essential |
| **MultiQueryRetriever** | Advanced | ✅ **KEEP** | Multi-query retrieval |
| **HydeRetriever** | Advanced | ✅ **KEEP** | Hypothetical Document Embeddings |
| **RRFRetriever** | Advanced | ✅ **KEEP** | Reciprocal Rank Fusion |
| **SimilarityThresholdRetriever** | Filtering | ✅ **KEEP** | Similarity threshold filtering |
| **EmbeddingsFilterRetriever** | Filtering | ✅ **KEEP** | Embedding-based filtering |
| **LLMFilterRetriever** | Filtering | ✅ **KEEP** | LLM-based filtering |
| **PromptRetriever** | Prompt-based | ✅ **KEEP** | Prompt-based retrieval |
| **ExtractMetadataRetriever** | Metadata | ✅ **KEEP** | Metadata extraction |
| **CohereRerankRetriever** | Reranking | ✅ **KEEP** | Cohere reranking |
| **JinaRerankRetriever** | Reranking | ✅ **KEEP** | Jina reranking |
| **VoyageAIRetriever** | Provider | ✅ **KEEP** | Voyage AI retrieval |
| **AWSBedrockKBRetriever** | AWS | ✅ **KEEP** | AWS Bedrock Knowledge Base |
| **CustomRetriever** | Custom | ✅ **KEEP** | Custom retriever implementation |

**Total: 14 nodes** - All essential for advanced RAG strategies

---

## 10. Memory Nodes

Memory nodes provide conversation memory management for agents and chatflows.

| Node Name | Type | Status | Notes |
|-----------|------|--------|-------|
| **BufferMemory** | Basic | ✅ **KEEP** | Basic conversation buffer - essential |
| **BufferWindowMemory** | Window | ✅ **KEEP** | Sliding window memory |
| **ConversationSummaryMemory** | Summary | ✅ **KEEP** | Summarized conversation memory |
| **ConversationSummaryBufferMemory** | Hybrid | ✅ **KEEP** | Hybrid summary + buffer |
| **RedisBackedChatMemory** | Redis | ✅ **KEEP** | Redis-backed memory |
| **UpstashRedisBackedChatMemory** | Upstash | ✅ **KEEP** | Upstash Redis memory |
| **MongoDBMemory** | MongoDB | ✅ **KEEP** | MongoDB memory |
| **DynamoDb** | DynamoDB | ✅ **KEEP** | DynamoDB memory - if AWS used |
| **ZepMemory** | Zep | ✅ **KEEP** | Zep memory |
| **ZepMemoryCloud** | Zep | ✅ **KEEP** | Zep Cloud memory |
| **Mem0** | Mem0 | ✅ **KEEP** | Mem0 memory |
| **PostgresAgentMemory** | PostgreSQL | ✅ **KEEP** | PostgreSQL agent memory |
| **SQLiteAgentMemory** | SQLite | ✅ **KEEP** | SQLite agent memory |
| **MySQLAgentMemory** | MySQL | ✅ **KEEP** | MySQL agent memory |

**Total: 14 nodes** - All essential for conversation memory
**Removed:** AgentMemory - deprecated (use PostgresAgentMemory, SQLiteAgentMemory, or MySQLAgentMemory instead)

---

## 11. Document Loader Nodes

Document loader nodes load documents from various sources.

| Node Name | Source | Status | Notes |
|-----------|--------|--------|-------|
| **File** | File System | ✅ **KEEP** | Load from file - essential |
| **Folder** | File System | ✅ **KEEP** | Load from folder - essential |
| **Pdf** | PDF | ✅ **KEEP** | PDF document loader - essential |
| **PlainText** | Text | ✅ **KEEP** | Plain text loader - essential |
| **MicrosoftWord** | Word | ✅ **KEEP** | Word document loader |
| **MicrosoftExcel** | Excel | ✅ **KEEP** | Excel document loader |
| **MicrosoftPowerpoint** | PowerPoint | ✅ **KEEP** | PowerPoint loader |
| **Csv** | CSV | ✅ **KEEP** | CSV loader |
| **Json** | JSON | ✅ **KEEP** | JSON loader |
| **Jsonlines** | JSONL | ✅ **KEEP** | JSON Lines loader |
| **Docx** | DOCX | ✅ **KEEP** | DOCX loader |
| **Epub** | EPUB | ✅ **KEEP** | EPUB ebook loader |
| **Notion** | Notion | ✅ **KEEP** | Notion integration |
| **Airtable** | Airtable | ⚠️ **REVIEW** | Airtable loader - review if used |
| **GoogleSheets** | Google | ✅ **KEEP** | Google Sheets loader |
| **GoogleDrive** | Google | ✅ **KEEP** | Google Drive loader |
| **Confluence** | Confluence | ✅ **KEEP** | Confluence integration |
| **Jira** | Jira | ✅ **KEEP** | Jira integration |
| **Github** | GitHub | ✅ **KEEP** | GitHub integration |
| **Gitbook** | GitBook | ✅ **KEEP** | GitBook integration |
| **Figma** | Figma | ✅ **KEEP** | Figma integration |
| **DocumentStore** | Database | ✅ **KEEP** | Document store loader |
| **VectorStoreToDocument** | Vector Store | ✅ **KEEP** | Load from vector store |
| **CustomDocumentLoader** | Custom | ✅ **KEEP** | Custom document loader |
| **Puppeteer** | Web | ⚠️ **REVIEW** | Web scraping with Puppeteer - review |
| **Playwright** | Web | ⚠️ **REVIEW** | Web scraping with Playwright - review |
| **Cheerio** | Web | ⚠️ **REVIEW** | Web scraping with Cheerio - review |
| **FireCrawl** | Web | ⚠️ **REVIEW** | FireCrawl web scraping - review |
| **BraveSearchAPI** | Search | ✅ **KEEP** | Brave Search API loader |
| **SearchApi** | Search | ✅ **KEEP** | Search API loader |
| **ApifyWebsiteContentCrawler** | Web | ⚠️ **REVIEW** | Apify crawler - review |
| **Oxylabs** | Web | ⚠️ **REVIEW** | Oxylabs web scraping - review |
| **API** | API | ✅ **KEEP** | API-based document loader |

**Total: 33 nodes**
- Keep: 28
- Review: 5 (web scraping loaders)

---

## 12. Text Splitter Nodes

Text splitter nodes split documents into chunks for processing.

| Node Name | Type | Status | Notes |
|-----------|------|--------|-------|
| **RecursiveCharacterTextSplitter** | Recursive | ✅ **KEEP** | Recursive character splitting - essential |
| **CharacterTextSplitter** | Character | ✅ **KEEP** | Character-based splitting |
| **TokenTextSplitter** | Token | ✅ **KEEP** | Token-based splitting |
| **MarkdownTextSplitter** | Markdown | ✅ **KEEP** | Markdown-aware splitting |
| **CodeTextSplitter** | Code | ✅ **KEEP** | Code-aware splitting |
| **HtmlToMarkdownTextSplitter** | HTML | ✅ **KEEP** | HTML to Markdown conversion |

**Total: 6 nodes** - All essential for document chunking

---

## 13. Output Parser Nodes

Output parser nodes parse and structure LLM outputs.

| Node Name | Type | Status | Notes |
|-----------|------|--------|-------|
| **StructuredOutputParser** | Structured | ✅ **KEEP** | Structured output parsing - essential |
| **StructuredOutputParserAdvanced** | Advanced | ✅ **KEEP** | Advanced structured parsing |
| **CSVListOutputParser** | CSV | ✅ **KEEP** | CSV list parsing |
| **CustomListOutputParser** | Custom | ✅ **KEEP** | Custom list parsing |

**Total: 4 nodes** - All essential for output parsing

---

## 14. Prompt Nodes

Prompt nodes provide prompt templates and management.

| Node Name | Type | Status | Notes |
|-----------|------|--------|-------|
| **PromptTemplate** | Basic | ✅ **KEEP** | Basic prompt template - essential |
| **ChatPromptTemplate** | Chat | ✅ **KEEP** | Chat prompt template - essential |
| **FewShotPromptTemplate** | Few-Shot | ✅ **KEEP** | Few-shot prompt template |
| **PromptLangfuse** | Langfuse | ✅ **KEEP** | Langfuse prompt management |

**Total: 4 nodes** - All essential for prompt management

---

## 15. Analytic Nodes

Analytic nodes provide observability and analytics for LLM applications.

| Node Name | Provider | Status | Notes |
|-----------|----------|--------|-------|
| **LangSmith** | LangSmith | ✅ **KEEP** | LangChain LangSmith - essential |
| **LangFuse** | LangFuse | ✅ **KEEP** | LangFuse observability |
| **LangWatch** | LangWatch | ✅ **KEEP** | LangWatch analytics |
| **Phoenix** | Phoenix | ✅ **KEEP** | Arize Phoenix |
| **Arize** | Arize | ✅ **KEEP** | Arize AI observability |
| **Lunary** | Lunary | ✅ **KEEP** | Lunary observability |
| **Opik** | Opik | ✅ **KEEP** | Opik analytics |

**Total: 7 nodes** - All essential for LLM observability

---

## 16. Cache Nodes

Cache nodes provide caching for LLM calls and embeddings.

| Node Name | Provider | Status | Notes |
|-----------|----------|--------|-------|
| **InMemoryCache** | In-Memory | ✅ **KEEP** | In-memory caching - essential |
| **RedisCache** | Redis | ✅ **KEEP** | Redis caching |
| **UpstashRedisCache** | Upstash | ✅ **KEEP** | Upstash Redis caching |
| **MomentoCache** | Momento | ✅ **KEEP** | Momento caching |
| **GoogleGenerativeAIContextCache** | Google | ✅ **KEEP** | Google Gemini context cache |

**Total: 5 nodes** - All essential for caching

---

## 17. Moderation Nodes

Moderation nodes provide content moderation for inputs/outputs.

| Node Name | Type | Status | Notes |
|-----------|------|--------|-------|
| **OpenAIModeration** | OpenAI | ✅ **KEEP** | OpenAI moderation API - essential |
| **SimplePromptModeration** | Custom | ✅ **KEEP** | Custom prompt-based moderation |

**Total: 2 nodes** - All essential for content moderation

---

## 18. Utility Nodes

Utility nodes provide general-purpose utilities.

| Node Name | Type | Status | Notes |
|-----------|------|--------|-------|
| **SetVariable** | Variable | ✅ **KEEP** | Set flow variables - essential |
| **GetVariable** | Variable | ✅ **KEEP** | Get flow variables - essential |
| **IfElseFunction** | Control | ✅ **KEEP** | Conditional logic - essential |
| **CustomFunction** | Custom | ✅ **KEEP** | Custom JavaScript functions - essential |
| **StickyNote** | Documentation | ✅ **KEEP** | Notes/documentation in flow |

**Total: 5 nodes** - All essential utilities

---

## 19. Graph Nodes

Graph nodes provide graph database integration.

| Node Name | Provider | Status | Notes |
|-----------|----------|--------|-------|
| **Neo4j** | Neo4j | ✅ **KEEP** | Neo4j graph database - essential |

**Total: 1 node** - Essential for graph-based workflows

---

## 20. Record Manager Nodes

Record manager nodes manage document indexing records.

| Node Name | Provider | Status | Notes |
|-----------|----------|--------|-------|
| **PostgresRecordManager** | PostgreSQL | ✅ **KEEP** | PostgreSQL record manager |
| **SQLiteRecordManager** | SQLite | ✅ **KEEP** | SQLite record manager |
| **MySQLRecordManager** | MySQL | ✅ **KEEP** | MySQL record manager |

**Total: 3 nodes** - All essential for record management

---

## 21. Response Synthesizer Nodes

Response synthesizer nodes synthesize responses from retrieved documents.

| Node Name | Type | Status | Notes |
|-----------|------|--------|-------|
| **SimpleResponseBuilder** | Simple | ✅ **KEEP** | Simple response builder - essential |
| **Refine** | Refine | ✅ **KEEP** | Refine-based synthesis |
| **CompactRefine** | Compact | ✅ **KEEP** | Compact refine synthesis |
| **TreeSummarize** | Tree | ✅ **KEEP** | Tree-based summarization |

**Total: 4 nodes** - All essential for response synthesis

---

## 22. Speech-to-Text Nodes

Speech-to-text nodes convert audio to text.

| Node Name | Provider | Status | Notes |
|-----------|----------|--------|-------|
| **assemblyai** | AssemblyAI | ✅ **KEEP** | AssemblyAI speech-to-text |

**Total: 1 node** - Essential for audio processing

---

## Summary Statistics

### Total Nodes by Category

| Category | Count | Keep | Review | Removed | Deprecating |
|----------|-------|------|--------|---------|-------------|
| Agentflow | 15 | 15 | 0 | 0 | 0 |
| Agents | 9 | 8 | 1 | 2 | 0 |
| Tools | 44 | 41 | 3 | 3 | 0 |
| Chains | 5 | 5 | 0 | 7 | 0 |
| Chat Models | 26 | 25 | 1 | 0 | 0 |
| LLMs | 12 | 12 | 0 | 0 | 0 |
| Embeddings | 15 | 15 | 0 | 0 | 0 |
| Vector Stores | 23 | 23 | 0 | 0 | 0 |
| Retrievers | 14 | 14 | 0 | 0 | 0 |
| Memory | 14 | 14 | 0 | 1 | 0 |
| Document Loaders | 33 | 28 | 5 | 0 | 0 |
| Text Splitters | 6 | 6 | 0 | 0 | 0 |
| Output Parsers | 4 | 4 | 0 | 0 | 0 |
| Prompts | 4 | 4 | 0 | 0 | 0 |
| Analytics | 7 | 7 | 0 | 0 | 0 |
| Cache | 5 | 5 | 0 | 0 | 0 |
| Moderation | 2 | 2 | 0 | 0 | 0 |
| Utilities | 5 | 5 | 0 | 0 | 0 |
| Graphs | 1 | 1 | 0 | 0 | 0 |
| Record Managers | 3 | 3 | 0 | 0 | 0 |
| Response Synthesizers | 4 | 4 | 0 | 0 | 0 |
| Speech-to-Text | 1 | 1 | 0 | 0 | 0 |
| **TOTAL** | **272** | **260** | **10** | **12** | **0** |

### Overall Statistics

- **Total Nodes: 272** (reduced from 281)
- **Keep: 260** (95.6%)
- **Review: 10** (3.7%)
- **Removed: 12** (4.4%) - AutoGPT, BabyAGI, ApiChain nodes (3), MultiPromptChain, VectorDBQAChain, MultiRetrievalQAChain, RetrievalQAChain, Vectara_Upload, AgentMemory
- **Deprecating: 0** (all deprecated nodes have been removed)

---

## Recommendations

### Immediate Actions

1. **Review Web Scraping Nodes:**
   - Review Puppeteer, Playwright, Cheerio, FireCrawl, ApifyWebsiteContentCrawler, Oxylabs document loaders
   - Review WebScraperTool
   - Legal/compliance review needed

2. **Review Code Execution:**
   - Review CodeInterpreterE2B
   - Security review needed

3. **Review Third-Party Specific:**
   - Review AirtableAgent and Airtable document loader - keep only if Airtable is used
   - Review ChatBaiduWenxin - region-specific

4. **Deprecating Nodes:**
5. **Removed Nodes:**
   - ChainTool, RetrieverTool, and WebBrowser have been completely removed

### Configuration Approach

**Per-Org Node Enablement:**
- Use `orgConfigService` to enable/disable nodes per organization
- Allow admins to configure which nodes are available per org
- Default: Enable all safe nodes, disable risky ones

**Environment-Based Disabling:**
- Use `DISABLED_NODES` environment variable to disable nodes
- Example: `DISABLED_NODES=webScraperTool,codeInterpreterE2B,composio`
- Currently used in `agentflowv2-generator/index.ts`

---

## Conclusion

The Kodivian platform provides **281 total nodes** across 22 categories, covering all aspects of LLM application development:

- **Agentflow & Agents**: Multi-agent workflows and agent architectures
- **Tools**: Extensive tool ecosystem for agent capabilities
- **Chains**: Pre-built chain architectures for common patterns
- **LLMs & Chat Models**: Support for 30+ LLM providers
- **RAG Infrastructure**: Embeddings, vector stores, retrievers, document loaders
- **Memory**: 15 memory options for conversation management
- **Observability**: 7 analytics providers for monitoring
- **Utilities**: Essential utilities for flow control and customization

**Most nodes (95.7%) are recommended to keep** as they provide essential functionality. Only **10 nodes (3.6%) require review** primarily for security/compliance concerns (web scraping, code execution) or third-party specificity.

The platform is well-architected with comprehensive coverage of LLM application needs, making it suitable for enterprise deployment with proper configuration and security reviews.

