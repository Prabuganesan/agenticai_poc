# Queue System Analysis - Autonomous Server

## Overview
The autonomous server implements a distributed queue system using **BullMQ** and **Redis** for processing chatflow predictions and vector store upsertions asynchronously. This enables horizontal scaling by separating the API server from worker processes.

## Architecture

### Components

#### 1. **QueueManager** (`src/queue/QueueManager.ts`)
- **Singleton pattern** - Single instance manages all queues
- **Responsibilities:**
  - Initializes Redis connection (supports URL or host/port)
  - Registers and manages queue instances
  - Sets up BullBoard dashboard for queue monitoring
  - Provides queue access methods

**Key Methods:**
- `getInstance()` - Singleton getter
- `setupAllQueues()` - Initializes prediction and upsert queues
- `getQueue(name)` - Retrieves queue by type ('prediction' | 'upsert')
- `getAllJobCounts()` - Returns job counts for all queues

**Redis Connection:**
- Supports `REDIS_URL` or individual `REDIS_HOST`/`REDIS_PORT`
- TLS support via `REDIS_TLS`, `REDIS_CERT`, `REDIS_KEY`, `REDIS_CA`
- Keep-alive configuration via `REDIS_KEEP_ALIVE`

#### 2. **BaseQueue** (`src/queue/BaseQueue.ts`)
- **Abstract base class** for all queue implementations
- **Built on BullMQ** - Uses `Queue`, `Worker`, `QueueEvents`
- **Key Features:**
  - Job management (add, get, count)
  - Worker creation with configurable concurrency
  - Job retention policies (age/count based)
  - Event streaming support

**Configuration:**
- `QUEUE_REDIS_EVENT_STREAM_MAX_LEN` (default: 10000)
- `WORKER_CONCURRENCY` (default: 100000)
- `REMOVE_ON_AGE` (default: -1, disabled)
- `REMOVE_ON_COUNT` (default: -1, disabled)

**Methods:**
- `addJob(jobData)` - Adds job to queue with UUID or custom ID
- `createWorker(concurrency)` - Creates BullMQ worker
- `processJob(data)` - Abstract method implemented by subclasses
- `getJobCounts()` - Returns counts by status (waiting, active, completed, failed, etc.)

#### 3. **PredictionQueue** (`src/queue/PredictionQueue.ts`)
- **Extends BaseQueue**
- **Purpose:** Processes chatflow/agentflow predictions
- **Job Types:**
  1. **Standard Flow Execution** - Chatflow/agentflow predictions
  2. **AgentFlow Generation** - `isAgentFlowGenerator` flag
  3. **Custom Function Execution** - `isExecuteCustomFunction` flag

**Dependencies:**
- `componentNodes` - Available node components
- `cachePool` - Caching layer
- `appDataSource` - Database connection
- `abortControllerPool` - Request cancellation
- `usageCacheManager` - Usage tracking
- `redisPublisher` - SSE event streaming

**Process Flow:**
1. Receives job data with flow configuration
2. Injects dependencies (dataSource, cache, etc.)
3. Creates abort controller for cancellation
4. Calls `executeFlow()` from `buildChatflow.ts`
5. Returns execution result

#### 4. **UpsertQueue** (`src/queue/UpsertQueue.ts`)
- **Extends BaseQueue**
- **Purpose:** Processes vector store upsertions and document operations
- **Job Types:**
  1. **Preview Chunks** - `isPreviewOnly` flag
  2. **Process Loader** - `isProcessWithoutUpsert` flag
  3. **Vector Store Insert** - `isVectorStoreInsert` flag
  4. **Document Store Upsert** - Has `storeId` property
  5. **Chatflow Vector Upsert** - Default fallback

**Dependencies:**
- `componentNodes` - Node components
- `cachePool` - Caching
- `appDataSource` - Database
- `usageCacheManager` - Usage tracking

#### 5. **RedisEventPublisher** (`src/queue/RedisEventPublisher.ts`)
- **Implements IServerSideEventStreamer**
- **Purpose:** Publishes SSE events to Redis channels
- **Event Types:**
  - `start`, `token`, `sourceDocuments`, `artifacts`
  - `usedTools`, `calledTools`, `fileAnnotations`
  - `tool`, `agentReasoning`, `nextAgent`
  - `agentFlowEvent`, `agentFlowExecutedData`, `nextAgentFlow`
  - `action`, `abort`, `error`
  - `metadata`, `usageMetadata`
  - `tts_start`, `tts_data`, `tts_end`, `tts_abort`

**Channel Pattern:**
- Uses `chatId` as Redis channel name
- Publishes JSON: `{ chatId, eventType, data }`

#### 6. **RedisEventSubscriber** (`src/queue/RedisEventSubscriber.ts`)
- **Purpose:** Subscribes to Redis channels and forwards to SSE
- **Integration:** Connected to `SSEStreamer` for client delivery
- **Event Handling:** Parses Redis messages and streams to connected clients

## Queue Types

### 1. Prediction Queue
- **Name:** `{QUEUE_NAME}-prediction` (default: `autonomous-queue-prediction`)
- **Purpose:** Chatflow/agentflow execution
- **Worker:** Created in separate worker process
- **Events:** Abort support via QueueEvents

### 2. Upsert Queue
- **Name:** `{QUEUE_NAME}-upsertion` (default: `autonomous-queue-upsertion`)
- **Purpose:** Vector store and document operations
- **Worker:** Created in separate worker process

## Mode Configuration

### Queue Mode Activation
Queue system is activated when `MODE=queue` environment variable is set.

**Server Mode (`MODE=queue`):**
- Initializes `QueueManager`
- Sets up queues (but doesn't create workers)
- Registers BullBoard dashboard at `/admin/queues`
- Uses `RedisEventPublisher` for SSE events
- Adds jobs to queue instead of processing directly

**Worker Mode:**
- Separate process (`commands/worker.ts`)
- Creates workers for both queues
- Processes jobs from Redis
- Listens for abort events

## Integration Points

### 1. Chatflow Execution (`buildChatflow.ts`)
```typescript
if (process.env.MODE === MODE.QUEUE) {
    const predictionQueue = appServer.queueManager.getQueue('prediction')
    const job = await predictionQueue.addJob(omit(executeData, OMIT_QUEUE_JOB_DATA))
    const queueEvents = predictionQueue.getQueueEvents()
    const result = await job.waitUntilFinished(queueEvents)
    return result
}
```

### 2. Document Store Operations (`services/documentstore/index.ts`)
- Preview chunks → UpsertQueue
- Process loader → UpsertQueue
- Vector store insert → UpsertQueue
- Document upsert → UpsertQueue

### 3. Chat Messages (`services/chat-messages/index.ts`)
- Uses queue mode for async processing when enabled

## Environment Variables

### Required for Queue Mode
- `MODE=queue` - Enables queue mode
- `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT` - Redis connection

### Optional Configuration
- `QUEUE_NAME` - Queue name prefix (default: `autonomous-queue`)
- `WORKER_CONCURRENCY` - Max concurrent jobs per worker (default: 100000)
- `QUEUE_REDIS_EVENT_STREAM_MAX_LEN` - Event stream size (default: 10000)
- `REMOVE_ON_AGE` - Job retention age in seconds (-1 = disabled)
- `REMOVE_ON_COUNT` - Max jobs to keep (-1 = disabled)
- `REDIS_TLS` - Enable TLS (`true`/`false`)
- `REDIS_CERT`, `REDIS_KEY`, `REDIS_CA` - TLS certificates (base64)
- `REDIS_KEEP_ALIVE` - Keep-alive interval
- `REDIS_USERNAME`, `REDIS_PASSWORD` - Authentication
- `ENABLE_BULLMQ_DASHBOARD` - Enable BullBoard UI (`true`/`false`)

## Deployment Architecture

### Docker Compose Setup (`docker/docker-compose-queue-source.yml`)
```
┌─────────────┐
│   Redis     │
│  (6379)     │
└──────┬──────┘
       │
       ├──────────────┬──────────────┐
       │              │              │
┌──────▼──────┐  ┌────▼──────┐  ┌───▼────────┐
│   Server    │  │  Worker   │  │  Worker    │
│  (API)      │  │  (Pred)   │  │  (Upsert)  │
│             │  │           │  │            │
│ - Adds jobs │  │ - Processes│  │ - Processes│
│ - SSE       │  │   jobs     │  │   jobs     │
│ - Dashboard │  │            │  │            │
└─────────────┘  └────────────┘  └────────────┘
```

### Worker Process (`commands/worker.ts`)
- Standalone CLI command
- Initializes database, nodes, cache
- Creates workers for both queues
- Listens for abort events
- Keeps process alive

## Event Flow

### Prediction Job Flow
```
1. Client Request → Server
2. Server → Adds job to PredictionQueue
3. Worker → Picks up job
4. Worker → Executes flow
5. Worker → Publishes events via RedisEventPublisher
6. RedisEventSubscriber → Receives events
7. SSEStreamer → Streams to client
8. Job completes → Returns result to server
9. Server → Returns response to client
```

### SSE Event Flow
```
Worker Process:
  executeFlow() 
    → RedisEventPublisher.publish(channel, event)
      → Redis Channel: chatId

Server Process:
  RedisEventSubscriber.subscribe(chatId)
    → Receives event
      → SSEStreamer.streamEvent()
        → Client receives SSE
```

## Monitoring & Management

### BullBoard Dashboard
- **URL:** `/admin/queues` (when `ENABLE_BULLMQ_DASHBOARD=true`)
- **Features:**
  - View all queues
  - Job status (waiting, active, completed, failed)
  - Job details and logs
  - Retry failed jobs
  - Clean queues

### Job Status Tracking
- `getAllJobCounts()` - Returns counts by status
- Queue events for real-time updates
- Job IDs for tracking

## Abort Mechanism

### How It Works
1. Client sends abort request
2. Server calls `abortControllerPool.abort(id)`
3. QueueEvents listener receives abort event
4. Worker's abort controller signals cancellation
5. Flow execution stops gracefully

### Implementation
```typescript
// In worker.ts
queueEvents.on('abort', async ({ id }) => {
    abortControllerPool.abort(id)
})

// In PredictionQueue
const abortControllerId = `${data.chatflow.id}_${data.chatId}`
const signal = new AbortController()
this.abortControllerPool.add(abortControllerId, signal)
data.signal = signal
```

## Data Flow

### Job Data Structure
```typescript
interface IExecuteFlowParams {
    chatflow: IChatFlow
    chatId: string
    orgId: string
    userId: string
    appDataSource: DataSource
    cachePool: CachePool
    componentNodes: IComponentNodes
    abortControllerPool: AbortControllerPool
    usageCacheManager: UsageCacheManager
    sseStreamer: IServerSideEventStreamer
    signal?: AbortSignal
    // ... other flow-specific data
}
```

### Omitted from Queue
- Large binary data
- Sensitive credentials
- Temporary objects
- (Defined in `OMIT_QUEUE_JOB_DATA` constant)

## Error Handling

### Worker Errors
- Logged with job ID and queue name
- Failed jobs stored in Redis
- Can be retried via BullBoard
- Error events published to Redis

### Connection Errors
- Automatic reconnection
- Error logging with connection status
- Graceful degradation

## Performance Considerations

### Concurrency
- Default: 100,000 concurrent jobs per worker
- Configurable via `WORKER_CONCURRENCY`
- Each worker can process multiple jobs simultaneously

### Job Retention
- Default: Keep all jobs
- Configurable via `REMOVE_ON_AGE` and `REMOVE_ON_COUNT`
- Helps manage Redis memory usage

### Event Streaming
- Max stream length: 10,000 events (configurable)
- Prevents Redis memory bloat
- Older events automatically removed

## Scaling

### Horizontal Scaling
- Multiple worker processes can connect to same Redis
- BullMQ distributes jobs across workers
- No coordination needed between workers

### Vertical Scaling
- Increase `WORKER_CONCURRENCY` for more parallel processing
- Add more Redis memory for job storage
- Increase `QUEUE_REDIS_EVENT_STREAM_MAX_LEN` for more events

## Security Considerations

### Redis Authentication
- Username/password via `REDIS_USERNAME`/`REDIS_PASSWORD`
- TLS encryption via `REDIS_TLS` and certificates

### Job Data
- Sensitive data omitted from queue (see `OMIT_QUEUE_JOB_DATA`)
- Job IDs are UUIDs (non-guessable)
- Redis should be in private network

## Best Practices

1. **Separate Environments:** Use different `QUEUE_NAME` per environment
2. **Monitor Queue Depth:** Watch for job buildup
3. **Set Retention Policies:** Clean old jobs to manage memory
4. **Error Monitoring:** Track failed jobs and retry appropriately
5. **Worker Health:** Monitor worker processes and restart if needed
6. **Redis Monitoring:** Track Redis memory and connection health

## Troubleshooting

### Jobs Not Processing
- Check worker is running
- Verify Redis connection
- Check worker logs for errors
- Verify queue name matches

### Events Not Reaching Client
- Check RedisEventSubscriber is connected
- Verify channel subscription
- Check SSE connection
- Review Redis pub/sub logs

### High Memory Usage
- Reduce `QUEUE_REDIS_EVENT_STREAM_MAX_LEN`
- Set `REMOVE_ON_AGE` or `REMOVE_ON_COUNT`
- Clear completed/failed jobs
- Monitor Redis memory

## Summary

The queue system provides:
- ✅ **Scalability** - Horizontal scaling via multiple workers
- ✅ **Reliability** - Job persistence in Redis
- ✅ **Monitoring** - BullBoard dashboard
- ✅ **Event Streaming** - Real-time SSE via Redis pub/sub
- ✅ **Abort Support** - Graceful cancellation
- ✅ **Flexibility** - Configurable concurrency and retention

This architecture enables the autonomous server to handle high loads by distributing work across multiple worker processes while maintaining real-time communication with clients.

