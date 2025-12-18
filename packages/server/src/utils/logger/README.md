# Logging System

Standardized logging system with flag-based control and module-specific log files.

## 📋 Overview

- **5 Groups**: system, workflows, services, storage, infrastructure
- **19 Modules**: Each module has its own log file
- **Flag-Based**: Global and group-level flags control logging
- **JSON Format**: All logs are in pure JSON format
- **Async Queue**: Non-blocking logging with batching

## 🎯 Standard Usage

### Import Logging Functions

```typescript
import { apiLog, chatflowLog, executionLog, documentStoreLog } from './utils/logger';
```

### Basic Logging

```typescript
// API logging (system group - always system-level)
await apiLog('info', 'API request received', {
  userId: 'user123',
  method: 'POST',
  endpoint: '/api/v1/predictions',
  statusCode: 200
});

// ChatFlow logging (workflows group - org-specific)
await chatflowLog('info', 'ChatFlow executed', {
  userId: 'user123',
  orgId: 'org456',
  chatflowId: 'flow789',
  executionTime: 1234
});

// Execution logging (workflows group)
await executionLog('error', 'Execution failed', {
  userId: 'user123',
  orgId: 'org456',
  executionId: 'exec123',
  error: error.stack
});

// DocumentStore logging (storage group)
await documentStoreLog('info', 'File uploaded', {
  userId: 'user123',
  orgId: 'org456',
  storeId: 'store789',
  fileName: 'document.pdf',
  fileSize: 1024000
});
```

## 📁 File Structure

### System Group (Always System-Level)
```
logs/system/
├── system.json
├── api.json
└── security.json
```

### Other Groups (Org-Specific or System-Level)
```
logs/
├── workflows/
│   ├── chatflow.json
│   ├── agentflow.json
│   └── execution.json
└── {orgId}/
    ├── workflows/
    │   ├── chatflow.json
    │   ├── agentflow.json
    │   └── execution.json
    ├── services/
    │   ├── assistant.json
    │   ├── usage.json
    │   └── tool.json
    └── storage/
        ├── documentstore.json
        ├── database.json
        └── file.json
```

## 🚩 Flag System

### Environment Variables

```bash
# Global master switch
LOG_ENABLED=true

# Group-level flags
LOG_SYSTEM_ENABLED=true
LOG_WORKFLOWS_ENABLED=true
LOG_SERVICES_ENABLED=true
LOG_STORAGE_ENABLED=true
LOG_INFRASTRUCTURE_ENABLED=true
```

### Flag Behavior

- If `LOG_ENABLED=false`: No logs written (regardless of group flags)
- If group flag is `false`: No logs written for that group
- All flags default to `true` if not set

## 📝 Available Module Methods

### System Group
- `systemSystemLog()` - System operations
- `apiLog()` - API requests/responses
- `securityLog()` - Security events

### Workflows Group
- `chatflowLog()` - ChatFlow operations
- `agentflowLog()` - AgentFlow operations
- `executionLog()` - Execution tracking

### Services Group
- `assistantLog()` - Assistant operations
- `usageLog()` - Usage tracking
- `toolLog()` - Tool executions

### Storage Group
- `documentStoreLog()` - DocumentStore operations
- `databaseLog()` - Database operations
- `fileLog()` - File operations

### Infrastructure Group
- `queueLog()` - Queue operations
- `cacheLog()` - Cache operations
- `sessionLog()` - Session management
- `streamingLog()` - Streaming operations

## ✅ Requirements

1. **userId Required**: Every log entry must include `userId` in context
2. **No Fallbacks**: If logging system fails, errors are thrown (no console.log fallback)
3. **JSON Format**: All logs are in pure JSON format
4. **Flag Respect**: Logging respects environment variable flags

## 🔧 Configuration

### Log Rotation
- **Pattern**: `YYYY-MM-DD-HH` (hourly)
- **Max Size**: 20MB per file
- **Format**: Pure JSON

### Queue Settings
- **Max Queue Size**: 500 entries
- **Batch Size**: 100 entries
- **Flush Interval**: 5 seconds

## 📚 API Endpoints

### Get Flag Status
```bash
POST /api/v1/log/flags
Body: { "orgId": "optional" }
Response: { "success": true, "flags": { ... } }
```

### Refresh Flags
```bash
POST /api/v1/log/flags/refresh
Body: { "orgId": "optional" }
Response: { "success": true, "message": "Flags refreshed successfully", "flags": { ... } }
```

