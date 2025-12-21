# Autonomous Chains Reference Guide

A comprehensive guide to all available chains in the Autonomous platform. Use this document to choose the right chain for your use case.

---

## What is a Chain?

A **Chain** is a sequence of operations that processes input and produces output. Think of it as a **pipeline** or **workflow** that combines multiple steps to accomplish a specific task.

### Analogy
Imagine a factory assembly line:
```
Raw Materials → Step 1 → Step 2 → Step 3 → Finished Product
```

In LLM context:
```
User Question → Format Prompt → Call LLM → Parse Output → Final Answer
```

### Why Use Chains?

Without chains, you'd write code like this:
```python
# Manual approach (tedious)
prompt = format_template(user_input)
llm_response = call_openai(prompt)
parsed_result = parse_json(llm_response)
```

With chains, it becomes:
```python
# Chain approach (declarative)
chain = LLMChain(llm=openai, prompt=template, output_parser=json_parser)
result = chain.run(user_input)  # All steps happen automatically
```

### Visual Representation

```
┌─────────────────────────────────────────────────────────────┐
│                      LLM CHAIN                               │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│  │  Prompt  │ →  │   LLM    │ →  │  Output  │               │
│  │ Template │    │ (Gemini) │    │  Parser  │               │
│  └──────────┘    └──────────┘    └──────────┘               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  SQL DATABASE CHAIN                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐│
│  │ Question │ →  │ Generate │ →  │ Execute  │ →  │ Format ││
│  │          │    │   SQL    │    │  Query   │    │ Answer ││
│  └──────────┘    └──────────┘    └──────────┘    └────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Key Benefits
- **Modularity**: Each step is isolated and reusable
- **Composability**: Chain multiple chains together
- **Abstraction**: Hide complexity behind simple interfaces
- **Consistency**: Same pattern for different use cases

---

## Quick Decision Matrix

| Chain | Best For | Requires Memory | Requires Vector Store | Requires Database |
|-------|----------|-----------------|----------------------|-------------------|
| **Conversation Chain** | General chat with memory | ✅ Yes | ❌ No | ❌ No |
| **LLM Chain** | Single-turn prompts, pipelines | ❌ No | ❌ No | ❌ No |
| **Conversational Retrieval QA** | Q&A over documents with history | ✅ Yes | ✅ Yes (Retriever) | ❌ No |
| **SQL Database Chain** | Querying SQL databases | ❌ No | ❌ No | ✅ Yes (SQL) |
| **Graph Cypher QA Chain** | Querying Neo4j graph databases | ❌ No | ❌ No | ✅ Yes (Neo4j) |
| **Vectara Chain** | Q&A with Vectara RAG platform | ❌ No | ✅ Yes (Vectara) | ❌ No |

---

## 1. Conversation Chain

### Overview
A chat-focused chain that maintains conversation history. Perfect for building chatbots with persistent memory.

### When to Use
- ✅ Building a general-purpose chatbot
- ✅ Need conversation memory across turns
- ✅ Want to customize the AI's personality via system prompt
- ✅ Require image uploads in conversation
- ❌ DON'T use when you need to query external data sources

### Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Chat Model | BaseChatModel | ✅ | The LLM to use |
| Memory | BaseMemory | ✅ | Memory component for chat history |
| Chat Prompt Template | ChatPromptTemplate | ❌ | Custom prompt template |
| System Message | string | ❌ | Customize AI personality |
| Input Moderation | Moderation | ❌ | Content filtering |

### Default System Prompt
```text
The following is a friendly conversation between a human and an AI. 
The AI is talkative and provides lots of specific details from its context. 
If the AI does not know the answer to a question, it truthfully says it does not know.
```

### How It Works
```mermaid
flowchart LR
    A[User Input] --> B[Input Moderation]
    B --> C[Load Chat History from Memory]
    C --> D[Build Prompt with History]
    D --> E[Send to LLM]
    E --> F[Save to Memory]
    F --> G[Return Response]
```

### Example Configuration
```json
{
  "model": "ChatGoogleGenerativeAI (gemini-2.5-pro)",
  "memory": "Buffer Memory",
  "systemMessagePrompt": "You are a helpful customer service agent for TechCorp..."
}
```

---

## 2. LLM Chain

### Overview
The most basic chain for running single prompts against an LLM. Can be chained together for complex pipelines.

### When to Use
- ✅ Single-turn text generation
- ✅ Running templates with variable substitution
- ✅ Building multi-step pipelines
- ✅ Need structured output parsing
- ❌ DON'T use when you need conversation memory

### Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Language Model | BaseLanguageModel | ✅ | The LLM to use |
| Prompt | BasePromptTemplate | ✅ | Prompt template with variables |
| Output Parser | BaseLLMOutputParser | ❌ | Parse structured output |
| Chain Name | string | ❌ | Name for debugging |
| Input Moderation | Moderation | ❌ | Content filtering |

### Outputs
| Output | Description |
|--------|-------------|
| LLM Chain | The chain itself (for chaining) |
| Output Prediction | Direct text/JSON response |

### How It Works
```mermaid
flowchart LR
    A[Input + Prompt Variables] --> B[Fill Template]
    B --> C[Send to LLM]
    C --> D[Output Parser]
    D --> E[Return Result]
```

### Example Use Cases
1. **Text Summarization**: Prompt = "Summarize the following: {text}"
2. **Translation**: Prompt = "Translate to {language}: {text}"
3. **Classification**: Prompt = "Classify this: {text}" + JSON output parser

---

## 3. Conversational Retrieval QA Chain

### Overview
Combines document retrieval with conversation memory. Ask questions about your documents while maintaining context.

### When to Use
- ✅ Q&A over documents (PDFs, websites, etc.)
- ✅ Need conversation context for follow-up questions
- ✅ Building a knowledge base chatbot
- ❌ DON'T use for simple chat without documents

### Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Chat Model | BaseChatModel | ✅ | The LLM to use |
| Vector Store Retriever | BaseRetriever | ✅ | Document retriever |
| Memory | BaseMemory | ❌ | Chat history memory |
| Rephrase Prompt | string | ❌ | Customize question rephrasing |
| Response Prompt | string | ❌ | Customize answer generation |
| Return Source Documents | boolean | ❌ | Include source docs in response |

### Default Prompts

#### Rephrase Prompt (Question Condenser)
```text
Given the following conversation and a follow up question, rephrase the 
follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone Question:
```

#### Response Prompt
```text
I want you to act as a document that I am having a conversation with. 
Your name is "AI Assistant". Using the provided context, answer the user's 
question to the best of your ability using the resources provided.

If there is nothing in the context relevant to the question at hand, 
just say "Hmm, I'm not sure" and stop after that. Refuse to answer any 
question not about the info. Never break character.
------------
{context}
------------
REMEMBER: If there is no relevant information within the context, 
just say "Hmm, I'm not sure". Don't try to make up an answer.
```

### How It Works
```mermaid
flowchart TD
    A[User Question] --> B[Load Chat History]
    B --> C[Rephrase to Standalone Question]
    C --> D[Retrieve Relevant Documents]
    D --> E[Build Context from Documents]
    E --> F[Generate Answer]
    F --> G[Save to Memory]
    G --> H[Return Answer + Sources]
```

---

## 4. SQL Database Chain

### Overview
Converts natural language questions into SQL queries, executes them, and returns human-readable answers.

### When to Use
- ✅ Querying relational databases (PostgreSQL, MySQL, SQLite, MSSQL)
- ✅ Building natural language database interfaces
- ✅ Data analysis and reporting
- ❌ DON'T use for non-SQL data sources

### Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Language Model | BaseLanguageModel | ✅ | The LLM to generate SQL |
| Database | options | ✅ | postgres, mysql, sqlite, mssql |
| Connection URL | string | ✅ | Database connection string |
| Include Tables | string | ❌ | Comma-separated table names |
| Ignore Tables | string | ❌ | Tables to exclude |
| Sample Rows | number | ❌ | Sample rows for schema info |
| Top K | number | ❌ | Max results (default 10) |
| Custom Prompt | string | ❌ | Override default prompt |
| Input Moderation | Moderation | ❌ | Content filtering |

### Default PostgreSQL Prompt
```text
You are a PostgreSQL expert. Given an input question, first create a 
syntactically correct PostgreSQL query to run, then look at the results 
of the query and return the answer to the input question.

Unless the user specifies in the question a specific number of examples 
to obtain, query for at most {top_k} results using the LIMIT clause as 
per PostgreSQL. You can order the results to return the most informative 
data in the database.

Never query for all columns from a table. You must query only the columns 
that are needed to answer the question. Wrap each column name in double 
quotes (") to denote them as delimited identifiers.

Pay attention to use only the column names you can see in the tables below. 
Be careful to not query for columns that do not exist. Also, pay attention 
to which column is in which table.

Use the following format:

Question: "Question here"
SQLQuery: "SQL Query to run"
SQLResult: "Result of the SQLQuery"
Answer: "Final answer here"

Only use the following tables:
{table_info}

Question: {input}
```

### How It Works
```mermaid
flowchart TD
    A[User Question] --> B[Connect to Database]
    B --> C[Get Table Schema]
    C --> D[Build Prompt with Schema]
    D --> E[LLM Generates SQL]
    E --> F[Execute SQL Query]
    F --> G[Format Results]
    G --> H[LLM Generates Answer]
    H --> I[Return Answer]
```

### Connection String Examples
| Database | Connection String Format |
|----------|-------------------------|
| PostgreSQL | `postgresql://user:password@host:5432/database` |
| MySQL | `mysql://user:password@host:3306/database` |
| MSSQL | `mssql://user:password@host:1433/database` |
| SQLite | `/path/to/database.db` |

---

## 5. Graph Cypher QA Chain

### Overview
Converts natural language questions into Cypher queries for Neo4j graph databases.

### When to Use
- ✅ Querying Neo4j graph databases
- ✅ Exploring relationships in graph data
- ✅ Knowledge graph Q&A
- ❌ DON'T use for SQL databases

### Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Language Model | BaseLanguageModel | ✅ | Main LLM |
| Neo4j Graph | Neo4j | ✅ | Neo4j connection |
| Cypher Prompt | BasePromptTemplate | ❌ | Custom Cypher generation prompt |
| Cypher Model | BaseLanguageModel | ❌ | Separate model for Cypher |
| QA Prompt | BasePromptTemplate | ❌ | Custom answer generation prompt |
| QA Model | BaseLanguageModel | ❌ | Separate model for answers |
| Return Direct | boolean | ❌ | Return raw query results |
| Input Moderation | Moderation | ❌ | Content filtering |

### Prompt Variables
| Prompt Type | Required Variables | Description |
|-------------|-------------------|-------------|
| Cypher Prompt | `{schema}`, `{question}` | Generates Cypher queries |
| QA Prompt | `{context}`, `{question}` | Generates final answer |

### Outputs
| Output | Description |
|--------|-------------|
| Graph Cypher QA Chain | The chain itself |
| Output Prediction | Direct response |

### How It Works
```mermaid
flowchart TD
    A[User Question] --> B[Get Graph Schema]
    B --> C[Build Cypher Prompt]
    C --> D[LLM Generates Cypher]
    D --> E[Execute on Neo4j]
    E --> F{Return Direct?}
    F -->|Yes| G[Return Raw Results]
    F -->|No| H[Build QA Prompt]
    H --> I[LLM Generates Answer]
    I --> J[Return Answer]
```

---

## 6. Vectara Chain

### Overview
Q&A chain specifically designed for Vectara's RAG platform with built-in summarization.

### When to Use
- ✅ Using Vectara for document storage/retrieval
- ✅ Need Vectara's hybrid search capabilities
- ✅ Multi-language document Q&A
- ❌ DON'T use without Vectara subscription

### Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Vectara Store | VectaraStore | ✅ | Vectara vector store |
| Summary Language | options | ❌ | Response language (30+ languages) |
| Response Lang | string | ❌ | Custom language code |
| Max Summarized Results | number | ❌ | Max docs to summarize |
| Input Moderation | Moderation | ❌ | Content filtering |

### Supported Languages
English (eng), Chinese (zho), Japanese (jpn), German (deu), French (fra), Spanish (spa), Portuguese (por), Italian (ita), Polish (pol), Dutch (nld), Russian (rus), Arabic (ara), Persian (fas), Hebrew (heb), Hindi (hin), Korean (kor), Thai (tha), Vietnamese (vie), Indonesian (ind), Czech (ces), Ukrainian (ukr)

### How It Works
```mermaid
flowchart LR
    A[User Query] --> B[Vectara Search]
    B --> C[Retrieve Documents]
    C --> D[Vectara Summarizer]
    D --> E[Reorder Citations]
    E --> F[Return Answer]
```

---

## Chain Comparison Examples

### Use Case: Customer Support Chatbot
**Best Choice: Conversation Chain**
```
Why: Needs memory for context, no external data needed
Setup: Memory + System prompt for personality
```

### Use Case: Documentation Q&A
**Best Choice: Conversational Retrieval QA Chain**
```
Why: Needs to search documents + maintain conversation
Setup: Vector store with docs + Memory
```

### Use Case: Business Intelligence Dashboard
**Best Choice: SQL Database Chain**
```
Why: Query structured data naturally
Setup: Database connection + Include relevant tables
```

### Use Case: Knowledge Graph Explorer
**Best Choice: Graph Cypher QA Chain**
```
Why: Graph relationships, not tabular data
Setup: Neo4j connection
```

### Use Case: Single Prompt Processing
**Best Choice: LLM Chain**
```
Why: No memory needed, just process input
Setup: Prompt template with variables
```

---

## Feature Comparison

| Feature | Conversation | LLM | Conv. Retrieval QA | SQL DB | Graph Cypher | Vectara |
|---------|-------------|-----|-------------------|--------|--------------|---------|
| Streaming | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Input Moderation | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Image Upload | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Custom Prompts | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Output Parser | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Source Attribution | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Multi-model Support | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

---

## Common Configuration Tips

### 1. Choosing a Model
- **Complex reasoning**: Use `gemini-2.5-pro`, `gpt-4o`, `claude-3-opus`
- **Speed-focused**: Use `gemini-2.0-flash`, `gpt-4o-mini`
- **SQL/Cypher generation**: Prefer models trained on code

### 2. Memory Configuration
- **Short sessions**: Buffer Memory (stores N messages)
- **Long sessions**: Buffer Window Memory (sliding window)
- **Persistent**: Database-backed memory

### 3. Prompt Engineering
- Always test with edge cases
- Include few-shot examples for complex tasks
- Use output parsers for structured responses
