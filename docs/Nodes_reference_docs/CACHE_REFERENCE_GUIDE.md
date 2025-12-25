# Kodivian Cache & Memory Reference Guide

A comprehensive guide to caching and memory options in the Kodivian platform. Both are about **storing data**, but they serve different purposes.

---

## What is a Cache?

A **Cache** stores LLM responses so you don't have to call the LLM again for the same input.

### Analogy
Think of it like a notebook where you write down answers:
- **First time**: You calculate 25 × 4 = 100, write it in notebook
- **Next time**: Someone asks 25 × 4, you look in notebook → instant answer!

### Visual Representation

```
User: "What is the capital of France?"

┌─────────────────────────────────────────────────────────────┐
│                        FIRST REQUEST                         │
│  Question ─→ Cache MISS ─→ Call LLM ─→ "Paris"              │
│                              ↓                               │
│                        Save to Cache                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 SECOND REQUEST (Same question)               │
│  Question ─→ Cache HIT ─→ Return "Paris" immediately        │
│                           (No LLM call!)                     │
└─────────────────────────────────────────────────────────────┘
```

### Key Benefits
- **Cost Reduction**: Avoid paying for repeated identical requests
- **Speed**: Instant responses for cached queries
- **Rate Limit Relief**: Reduce API calls to stay within limits

---

## What is Memory?

**Memory** stores conversation history so the AI can remember previous messages in the chat.

### Analogy
Think of it like a conversation with a friend:
- Without memory: Every message is like talking to a stranger
- With memory: "As I mentioned earlier..." - context is preserved

### Visual Representation

```
┌─────────────────────────────────────────────────────────────┐
│                    WITHOUT MEMORY                            │
│                                                              │
│  User: "My name is John"     AI: "Nice to meet you, John!"  │
│  User: "What's my name?"     AI: "I don't know your name."  │
│                              ❌ Context lost!                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      WITH MEMORY                             │
│                                                              │
│  User: "My name is John"     AI: "Nice to meet you, John!"  │
│         ↓ Saved to memory                                    │
│  User: "What's my name?"     AI: "Your name is John!"       │
│                              ✅ Context preserved!           │
└─────────────────────────────────────────────────────────────┘
```

### Key Benefits
- **Context Awareness**: AI remembers the conversation
- **Follow-up Questions**: Users can ask "what about the second one?"
- **Personalization**: Remember user preferences across turns

---

## Cache vs Memory - Key Differences

| Aspect | Cache | Memory |
|--------|-------|--------|
| **What it stores** | LLM responses | Conversation history |
| **Purpose** | Avoid duplicate API calls | Maintain chat context |
| **Keyed by** | Hash of prompt | Session ID |
| **When used** | Same exact prompt repeated | Multi-turn conversations |
| **Required for** | Cost optimization | Chatbots |
| **Example** | FAQ responses | "As I said before..." |

### When to Use Which?

| Scenario | Use Cache? | Use Memory? |
|----------|------------|-------------|
| FAQ chatbot (repeated questions) | ✅ Yes | ✅ Yes |
| Single-turn API (no follow-ups) | ✅ Yes | ❌ No |
| Stateless processing pipeline | ✅ Yes | ❌ No |
| Interactive conversation | ❌ Optional | ✅ Yes |
| Personal assistant | ❌ No (answers vary) | ✅ Yes |

---

# Part 1: Cache Types

## Quick Decision Matrix

| Cache Type | Persistence | Best For | Infrastructure | Cost |
|------------|-------------|----------|----------------|------|
| **InMemory Cache** | ❌ Volatile | Development, single instance | None | Free |
| **Redis Cache** | ✅ Persistent | Production, multi-instance | Self-hosted Redis | Server costs |
| **Upstash Redis** | ✅ Persistent | Serverless apps | Managed (Upstash) | Pay-per-use |
| **Momento Cache** | ✅ Persistent | Serverless, global distribution | Managed (Momento) | Pay-per-use |
| **Google GenAI Context** | ✅ Persistent | Gemini large context caching | Google Cloud | Token savings |

---

## What is LLM Caching?

LLM caching stores the response from an LLM for a given prompt. When the exact same prompt is sent again, the cached response is returned instead of calling the LLM again.

### Benefits
- **Cost Reduction**: Avoid paying for repeated identical requests
- **Speed**: Instant responses for cached queries
- **Rate Limit Relief**: Reduce API calls to stay within limits

### How It Works
```mermaid
flowchart LR
    A[User Prompt] --> B{Cache Lookup}
    B -->|Hit| C[Return Cached Response]
    B -->|Miss| D[Call LLM]
    D --> E[Store in Cache]
    E --> F[Return Response]
```

---

## 1. InMemory Cache

### Overview
Stores LLM responses in application memory. Fastest cache but volatile - cleared when the app restarts.

### When to Use
- ✅ Development and testing
- ✅ Single server deployment
- ✅ Session-level caching
- ❌ DON'T use for multi-instance deployments
- ❌ DON'T use when persistence is required

### Configuration

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| *(None)* | - | - | No configuration needed |

### Technical Details
- **Storage**: JavaScript `Map` object
- **Cache Key**: Hash of prompt + LLM configuration
- **Scope**: Per-chatflow (isolated caches per chatflow)
- **Eviction**: Cleared on app restart

### Example Use Case
```
Scenario: Development testing of a chatbot
- Quick iteration without waiting for LLM calls
- No cost for repeated test prompts
- Acceptable if cache is lost on restart
```

---

## 2. Redis Cache

### Overview
Persistent, distributed cache using self-hosted Redis. Ideal for production deployments with multiple instances.

### When to Use
- ✅ Production deployments
- ✅ Multi-server/instance setups
- ✅ Need persistent cache across restarts
- ✅ Already running Redis infrastructure
- ❌ DON'T use if no Redis experience/infrastructure

### Configuration

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Credential | redisCacheApi / redisCacheUrlApi | ✅ | Redis connection |
| Time to Live (ms) | number | ❌ | Cache expiration time |

### Credential Options

**Option 1: Individual Fields (`redisCacheApi`)**
| Field | Description |
|-------|-------------|
| Host | Redis server hostname |
| Port | Redis port (default: 6379) |
| Username | Redis username (if enabled) |
| Password | Redis password |
| SSL Enabled | Enable TLS connection |

**Option 2: Connection URL (`redisCacheUrlApi`)**
```
redis://username:password@hostname:6379
rediss://username:password@hostname:6379  # With TLS
```

### Technical Details
- **Library**: `ioredis`
- **Cache Key**: Hash of prompt + LLM key + index
- **Connection Handling**: Auto-reconnect on failure
- **Serialization**: JSON for chat messages

### Environment Variables
| Variable | Description |
|----------|-------------|
| `REDIS_KEEP_ALIVE` | Keep-alive interval in ms |

### Example Configuration
```json
{
  "credential": "redis-prod-creds",
  "ttl": 86400000  // 24 hours in milliseconds
}
```

---

## 3. Upstash Redis Cache

### Overview
Serverless Redis by Upstash. No infrastructure management - pay only for what you use.

### When to Use
- ✅ Serverless deployments (Vercel, Netlify, AWS Lambda)
- ✅ Don't want to manage Redis servers
- ✅ Variable/unpredictable traffic
- ❌ DON'T use if you need fine-grained Redis control

### Configuration

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Credential | upstashRedisApi | ✅ | Upstash connection details |

### Credential Fields
| Field | Description |
|-------|-------------|
| Connection URL | Upstash REST URL (from dashboard) |
| Token | Upstash REST token (from dashboard) |

### Pricing Model
- Pay per request (100K requests/month free tier)
- See [Upstash Pricing](https://upstash.com/pricing)

### Example Setup
1. Create account at [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy REST URL and Token from dashboard
4. Add as credential in Kodivian

---

## 4. Momento Cache

### Overview
Distributed, serverless cache designed for global applications. Zero-configuration infrastructure.

### When to Use
- ✅ Global applications needing low latency worldwide
- ✅ Serverless deployments
- ✅ Need simplicity without Redis complexity
- ❌ DON'T use if on a tight budget (can be expensive at scale)

### Configuration

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Credential | momentoCacheApi | ✅ | Momento API credentials |

### Credential Fields
| Field | Description |
|-------|-------------|
| API Key | Momento API key |
| Cache Name | Name of the cache to use |

### Technical Details
- **SDK**: `@gomomento/sdk`
- **Default TTL**: 24 hours (86400 seconds)
- **Configuration**: Laptop profile (optimized for development)

### Example Setup
1. Create account at [momentohq.com](https://www.gomomento.com)
2. Generate API key
3. Create a cache
4. Add credentials to Kodivian

---

## 5. Google GenAI Context Cache

### Overview
**Special cache type** for Google Gemini models. Caches large context (documents, system prompts) to reduce token costs on subsequent requests.

### ⚠️ Important Differences
This is NOT a standard LLM response cache. It caches the **input context** to Gemini, not the output. This is beneficial when:
- You have large system prompts
- You're processing the same documents repeatedly
- You want to reduce input token costs

### When to Use
- ✅ Using Gemini models with large contexts
- ✅ Same documents/context used across multiple queries
- ✅ Want to reduce Gemini token costs
- ❌ DON'T use with non-Google models
- ❌ DON'T use for output caching

### Configuration

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| TTL | number | ✅ | Time to live in seconds |
| Credential | googleGenerativeAI | ✅ | Google AI API key |

### Default TTL
```
30 days = 60 * 60 * 24 * 30 = 2,592,000 seconds
```

### How It Works
```mermaid
flowchart TD
    A[Request with Context] --> B{Context Cached?}
    B -->|Yes| C[Use Cached Context ID]
    B -->|No| D[Upload Context to Google]
    D --> E[Get Cache ID]
    E --> F[Store Cache ID locally]
    C --> G[Send Query with Cache ID]
    F --> G
    G --> H[Gemini Response]
```

### Technical Details
- **Cache Key**: Hash of model + tools + contents
- **Storage**: Google Cloud (server-side)
- **Local Cache**: Map of hash → CachedContent
- **API**: `@google/generative-ai/server` GoogleAICacheManager

---

## Comparison Table

| Feature | InMemory | Redis | Upstash | Momento | Google GenAI |
|---------|----------|-------|---------|---------|--------------|
| **Persistence** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Multi-Instance** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **TTL Support** | ❌ | ✅ | ❌ | ✅ | ✅ |
| **Managed Service** | N/A | ❌ | ✅ | ✅ | ✅ |
| **Serverless** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Free Tier** | ✅ | Self-host | ✅ | ✅ | Usage-based |
| **Cache Type** | Response | Response | Response | Response | Context |

---

## Integration with Chat Models

All cache types (except Google GenAI Context) connect to the **Cache** input on chat model nodes:

```mermaid
flowchart LR
    A[Cache Node] --> B[Chat Model Node]
    B --> C[Chain/Agent]
```

### Supported Models
Any LangChain-compatible chat model that supports caching:
- ChatOpenAI
- ChatGoogleGenerativeAI
- ChatAnthropic
- ChatCohere
- And more...

---

## Best Practices

### 1. Development vs Production
| Environment | Recommended Cache |
|-------------|-------------------|
| Local Development | InMemory |
| Staging | Redis or Upstash |
| Production (single server) | Redis |
| Production (multi-server) | Redis, Upstash, or Momento |
| Serverless | Upstash or Momento |

### 2. TTL Guidelines
| Use Case | Recommended TTL |
|----------|-----------------|
| Dynamic data (prices, stock) | 1-5 minutes |
| Semi-static content | 1-24 hours |
| Static knowledge base | 7-30 days |
| Immutable reference data | No expiration |

### 3. Cache Invalidation
None of these caches support manual invalidation via the UI. To clear cache:
- **InMemory**: Restart the application
- **Redis**: Use Redis CLI or clear keys with pattern matching
- **Upstash/Momento**: Use their respective dashboards

---

## Troubleshooting

### Cache Not Working?
1. **Verify connection**: Check credentials are correct
2. **Check prompt consistency**: Caches are keyed by exact prompt - small changes = cache miss
3. **TTL expired**: Response may have expired
4. **Model mismatch**: Different model = different cache key

### Redis Connection Issues
```bash
# Test Redis connection
redis-cli -h <host> -p <port> -a <password> ping
# Should return: PONG
```

### High Cache Miss Rate
- Prompts may have dynamic elements (timestamps, user IDs)
- Consider normalizing prompts before sending
- Use consistent model configuration

---

# Part 2: Memory Types

## Memory Quick Decision Matrix

| Memory Type | Storage | Best For | Requires LLM | Persistence |
|-------------|---------|----------|--------------|-------------|
| **Buffer Memory** | Database | Development, short chats | ❌ | ✅ App DB |
| **Buffer Window** | Database | Long conversations | ❌ | ✅ App DB |
| **Conversation Summary** | Database | Token optimization | ✅ | ✅ App DB |
| **Summary Buffer** | Database | Best of both | ✅ | ✅ App DB |
| **Redis Chat Memory** | Redis | Multi-instance production | ❌ | ✅ Redis |
| **Upstash Redis Memory** | Upstash | Serverless apps | ❌ | ✅ Cloud |
| **MongoDB Memory** | MongoDB | Document-oriented storage | ❌ | ✅ Cloud |
| **DynamoDB Memory** | AWS | AWS infrastructure | ❌ | ✅ Cloud |
| **Zep Memory** | Zep Server | Advanced memory features | ✅ (server-side) | ✅ Zep |
| **Zep Cloud Memory** | Zep Cloud | Managed Zep | ✅ (server-side) | ✅ Cloud |
| **Mem0 Memory** | Mem0 | AI-powered memory | ✅ | ✅ Cloud |

---

## 1. Buffer Memory

### Overview
The basic memory type. Stores all chat messages in the application database.

### When to Use
- ✅ Simple chatbots
- ✅ Short conversations
- ✅ Development/testing
- ❌ DON'T use for very long conversations (token overflow)

### Configuration
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Session Id | string | ❌ | Custom session identifier |
| Memory Key | string | ❌ | Key for memory variable (default: `chat_history`) |

### How It Works
```
Message 1 → Saved
Message 2 → Saved
Message 3 → Saved
...
ALL messages → Sent to LLM (can overflow context!)
```

---

## 2. Buffer Window Memory

### Overview
Like Buffer Memory, but only keeps the last **k** messages. Prevents token overflow.

### When to Use
- ✅ Long conversations
- ✅ When you don't need full history
- ✅ Token-limited models
- ❌ DON'T use when full context is required

### Configuration
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Size (k) | number | ❌ | Number of message pairs to keep (default: 4) |
| Session Id | string | ❌ | Custom session identifier |
| Memory Key | string | ❌ | Key for memory variable |

### How It Works
```
Window size k = 2:

Message 1 → Saved
Message 2 → Saved
Message 3 → Saved
Message 4 → Saved
Message 5 → Saved (Message 1 dropped)
Message 6 → Saved (Message 2 dropped)

Only last 4 messages (2 pairs) sent to LLM
```

---

## 3. Conversation Summary Memory

### Overview
Uses an LLM to summarize the conversation instead of sending raw messages. Dramatic token savings!

### When to Use
- ✅ Very long conversations
- ✅ When exact wording isn't critical
- ✅ Token optimization
- ❌ DON'T use when exact quotes matter

### Configuration
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Chat Model | BaseChatModel | ✅ | LLM for summarization |
| Session Id | string | ❌ | Custom session identifier |
| Memory Key | string | ❌ | Key for memory variable |

### How It Works
```
100 messages of conversation
         ↓
LLM summarizes to: "User discussed travel plans to Paris,
asked about hotels, and booked a 3-night stay at Hotel X."
         ↓
Summary (few tokens) → Sent to main LLM
```

---

## 4. Conversation Summary Buffer Memory

### Overview
**Best of both worlds!** Keeps recent messages verbatim + summary of older messages.

### When to Use
- ✅ Need recent context verbatim
- ✅ Want older context summarized
- ✅ Production chatbots
- ❌ DON'T use for simple use cases (overkill)

### Configuration
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Chat Model | BaseChatModel | ✅ | LLM for summarization |
| Max Token Limit | number | ❌ | Token threshold for summarization (default: 2000) |
| Session Id | string | ❌ | Custom session identifier |
| Memory Key | string | ❌ | Key for memory variable |

### How It Works
```
Token limit: 2000 tokens

[Summary of old messages: 200 tokens]
[Recent Message 1: 100 tokens]
[Recent Message 2: 150 tokens]
...
[Recent Message N: 180 tokens]

When total > 2000: Oldest messages → Summarized
```

---

## 5. Redis-Backed Chat Memory

### Overview
Stores conversation history in self-hosted Redis. Great for production with multiple instances.

### When to Use
- ✅ Multi-instance deployments
- ✅ Already have Redis infrastructure
- ✅ Need session TTL (auto-expiry)
- ❌ DON'T use if no Redis experience

### Configuration
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Credential | redisCacheApi / redisCacheUrlApi | ✅ | Redis connection |
| Window Size | number | ❌ | Limit messages returned |
| Session Time To Live (s) | number | ❌ | Auto-delete sessions after N seconds |
| Session Id | string | ❌ | Custom session identifier |
| Memory Key | string | ❌ | Key for memory variable |

---

## 6. Upstash Redis-Backed Memory

### Overview
Serverless Redis memory using Upstash. No infrastructure to manage.

### When to Use
- ✅ Serverless deployments
- ✅ Don't want to manage Redis
- ✅ Variable traffic
- ❌ DON'T use if you need fine-grained control

### Configuration
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Credential | upstashRedisApi | ✅ | Upstash connection |
| Session Id | string | ❌ | Custom session identifier |
| Memory Key | string | ❌ | Key for memory variable |

---

## 7. MongoDB Atlas Chat Memory

### Overview
Stores chat history in MongoDB Atlas. Document-oriented persistence.

### When to Use
- ✅ Already using MongoDB
- ✅ Need flexible document storage
- ✅ Cloud-native applications
- ❌ DON'T use if MongoDB is overkill

### Configuration
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Credential | mongoDBUrlApi | ✅ | MongoDB connection URL |
| Database | string | ✅ | Database name |
| Collection Name | string | ✅ | Collection name |
| Session Id | string | ❌ | Custom session identifier |
| Memory Key | string | ❌ | Key for memory variable |

---

## 8. DynamoDB Chat Memory

### Overview
AWS DynamoDB storage for chat history. Ideal for AWS-based infrastructure.

### When to Use
- ✅ AWS infrastructure
- ✅ Need serverless scalability
- ✅ Pay-per-use model
- ❌ DON'T use if not on AWS

### Configuration
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Credential | awsApi | ✅ | AWS credentials |
| Table Name | string | ✅ | DynamoDB table name |
| Partition Key | string | ❌ | Partition key name (default: `id`) |
| Region | string | ❌ | AWS region |
| Session Id | string | ❌ | Custom session identifier |
| Memory Key | string | ❌ | Key for memory variable |

---

## 9. Zep Memory (Open Source)

### Overview
Self-hosted Zep server provides **intelligent memory** with automatic summarization, entity extraction, and search.

### When to Use
- ✅ Need advanced memory features
- ✅ Want automatic summarization (server-side)
- ✅ Entity tracking
- ❌ DON'T use if simple memory is enough

### Configuration
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Base URL | string | ✅ | Zep server URL (default: `http://127.0.0.1:8000`) |
| Credential | zepMemoryApi | ❌ | JWT API key (optional) |
| Size (k) | number | ❌ | Window size |
| Session Id | string | ❌ | Custom session identifier |
| AI/Human Prefix | string | ❌ | Message prefixes |
| Memory Key | string | ❌ | Key for memory variable |

---

## 10. Zep Cloud Memory

### Overview
Managed Zep service. All the features of Zep without self-hosting.

### When to Use
- ✅ Want Zep features without infrastructure
- ✅ Managed service preference
- ❌ DON'T use if cost is a concern

### Configuration
Same as Zep Memory but connects to Zep Cloud instead of self-hosted.

---

## 11. Mem0 Memory

### Overview
AI-powered memory that **learns** from conversations. Extracts and stores facts about users.

### When to Use
- ✅ Personal assistants
- ✅ Need long-term user profiles
- ✅ AI that "remembers" users across sessions
- ❌ DON'T use for simple chatbots

### Configuration
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| Credential | mem0Api | ✅ | Mem0 API key |
| User Id | string | ❌ | User identifier |
| Search Only | boolean | ❌ | Only search, don't add new memories |
| Memory Options | JSON | ❌ | Advanced configuration |

### Key Difference
Mem0 doesn't just store messages - it **extracts facts**:
```
Messages: "I live in New York" → "My dog Max is a golden retriever"
Mem0 stores: { user_lives_in: "New York", has_pet: { name: "Max", type: "dog", breed: "golden retriever" }}
Later: "How's Max?" → AI knows Max is the user's dog!
```

---

## Memory Feature Comparison

| Feature | Buffer | Window | Summary | Summary Buffer | Redis | Zep | Mem0 |
|---------|--------|--------|---------|----------------|-------|-----|------|
| **All Messages** | ✅ | ❌ | ❌ | Partial | ✅ | ✅ | ❌ |
| **Token Efficient** | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Requires LLM** | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **External Storage** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Multi-Instance** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Auto Summarize** | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Fact Extraction** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## Memory Best Practices

### 1. Choosing Memory Type

| Scenario | Recommended Memory |
|----------|-------------------|
| Quick prototyping | Buffer Memory |
| Production chatbot | Summary Buffer Memory |
| Multi-server deployment | Redis-Backed Memory |
| Personal assistant | Mem0 or Zep |
| Token-limited model | Buffer Window or Summary |
| AWS infrastructure | DynamoDB Memory |

### 2. Session Management

- **Use consistent Session IDs**: Same ID = same conversation
- **Clear sessions**: Implement "New Chat" functionality
- **TTL for cleanup**: Use Redis TTL to auto-expire old sessions

### 3. Token Optimization

| Memory Type | Typical Token Usage |
|-------------|---------------------|
| Buffer (10 messages) | 500-2000 tokens |
| Window (k=2) | 200-400 tokens |
| Summary | 100-300 tokens |
| Summary Buffer | 300-800 tokens |

---

## Integration with Chains

Memory connects to chains that support conversation:

```mermaid
flowchart LR
    A[Memory Node] --> B[Conversation Chain]
    A --> C[Conversational Retrieval QA]
    A --> D[Agent]
```

### Supported Chains/Agents
- Conversation Chain
- Conversational Retrieval QA Chain
- All Agent types (OpenAI, ReAct, etc.)
