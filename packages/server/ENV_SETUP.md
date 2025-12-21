# Environment Setup Guide

This document provides instructions for setting up the `.env` file for the Autonomous Server.

## Quick Start

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Update the values in `.env` according to your environment (see sections below)

3. Start the server:
   ```bash
   pnpm start
   ```

## Environment Variables

### Base Configuration

#### `AUTONOMOUS_DATA_PATH`
- **Description**: Base path for all autonomous server data (database, uploads, logs, encryption keys, API keys, etc.)
- **Default**: If not set, defaults to `packages/server/.autonomous`
- **Example**: `AUTONOMOUS_DATA_PATH=/path/to/your/data`
- **Note**: All data will be stored in `AUTONOMOUS_DATA_PATH/.autonomous/`

---

### Logging Configuration

#### `LOG_ENABLED`
- **Description**: Global master switch for module-based logging system
- **Default**: `true` (logging enabled)
- **Options**: `true` or `false`
- **Example**: `LOG_ENABLED=true`
- **Note**: When set to `false`, no module logs are written regardless of group flags. This affects only the module-based logging system, not the general server logs (which use `LOG_LEVEL`).

#### `LOG_SYSTEM_ENABLED`
- **Description**: Enable/disable logging for the **system** group (system operations, API, security)
- **Default**: `true` (enabled)
- **Options**: `true` or `false`
- **Example**: `LOG_SYSTEM_ENABLED=true`
- **Note**: System logs are always written to `logs/system/` (no orgId required). Includes: system.json, api.json, security.json

#### `LOG_WORKFLOWS_ENABLED`
- **Description**: Enable/disable logging for the **workflows** group (ChatFlow, AgentFlow, executions)
- **Default**: `true` (enabled)
- **Options**: `true` or `false`
- **Example**: `LOG_WORKFLOWS_ENABLED=true`
- **Note**: Workflow logs are written to `logs/{orgId}/workflows/` (orgId required). Includes: chatflow.json, agentflow.json, execution.json

#### `LOG_SERVICES_ENABLED`
- **Description**: Enable/disable logging for the **services** group (assistants, usage tracking, tools)
- **Default**: `true` (enabled)
- **Options**: `true` or `false`
- **Example**: `LOG_SERVICES_ENABLED=true`
- **Note**: Service logs are written to `logs/{orgId}/services/` (orgId required). Includes: assistant.json, usage.json, tool.json

#### `LOG_STORAGE_ENABLED`
- **Description**: Enable/disable logging for the **storage** group (DocumentStore, database, file operations)
- **Default**: `true` (enabled)
- **Options**: `true` or `false`
- **Example**: `LOG_STORAGE_ENABLED=true`
- **Note**: Storage logs are written to `logs/{orgId}/storage/` (orgId required). Includes: documentstore.json, database.json, file.json

#### `LOG_INFRASTRUCTURE_ENABLED`
- **Description**: Enable/disable logging for the **infrastructure** group (queues, cache, sessions, streaming)
- **Default**: `true` (enabled)
- **Options**: `true` or `false`
- **Example**: `LOG_INFRASTRUCTURE_ENABLED=true`
- **Note**: Infrastructure logs are written to `logs/{orgId}/infrastructure/` (orgId required). Includes: queue.json, cache.json, session.json, streaming.json

#### `LOG_SANITIZE_BODY_FIELDS`
- **Description**: Comma-separated list of body fields to sanitize in logs
- **Default**: `password,pwd,pass,secret,token,apikey,api_key,accesstoken,access_token,refreshtoken,refresh_token,clientsecret,client_secret,privatekey,private_key,secretkey,secret_key,auth,authorization,credential,credentials`

#### `LOG_SANITIZE_HEADER_FIELDS`
- **Description**: Comma-separated list of header fields to sanitize in logs
- **Default**: `authorization,x-api-key,x-auth-token,cookie`

**Log Directory Structure**:
- Logs are stored in `{AUTONOMOUS_DATA_PATH}/.autonomous/logs/` (defaults to `packages/server/.autonomous/logs/` if `AUTONOMOUS_DATA_PATH` is not set)
- **System Group**: `logs/system/` (system.json, api.json, security.json)
- **Other Groups**: `logs/{orgId}/{group}/` (workflows/, services/, storage/, infrastructure/)

---

### Storage Configuration

#### `STORAGE_TYPE`
- **Description**: Storage type for file uploads
- **Default**: `local`
- **Options**: `local`, `s3`, `gcs`
- **Example**: `STORAGE_TYPE=local`

#### S3 Storage (if STORAGE_TYPE=s3)

##### `S3_STORAGE_BUCKET_NAME`
- **Description**: S3 bucket name
- **Default**: (empty)
- **Example**: `S3_STORAGE_BUCKET_NAME=my-bucket`

##### `S3_STORAGE_ACCESS_KEY_ID`
- **Description**: S3 access key ID
- **Default**: (empty)
- **Example**: `S3_STORAGE_ACCESS_KEY_ID=your-access-key`

##### `S3_STORAGE_SECRET_ACCESS_KEY`
- **Description**: S3 secret access key
- **Default**: (empty)
- **Example**: `S3_STORAGE_SECRET_ACCESS_KEY=your-secret-key`

##### `S3_STORAGE_REGION`
- **Description**: S3 region
- **Default**: (empty)
- **Example**: `S3_STORAGE_REGION=us-west-2`

##### `S3_ENDPOINT_URL`
- **Description**: S3 endpoint URL (for custom S3-compatible services)
- **Default**: (empty)
- **Example**: `S3_ENDPOINT_URL=https://s3.example.com`

##### `S3_FORCE_PATH_STYLE`
- **Description**: Force path style for S3 URLs
- **Default**: `false`
- **Options**: `true` or `false`

#### Google Cloud Storage (if STORAGE_TYPE=gcs)

##### `GOOGLE_CLOUD_STORAGE_CREDENTIAL`
- **Description**: Google Cloud Storage credential JSON file path
- **Default**: (empty)
- **Example**: `GOOGLE_CLOUD_STORAGE_CREDENTIAL=/path/to/credentials.json`

##### `GOOGLE_CLOUD_STORAGE_PROJ_ID`
- **Description**: Google Cloud Storage project ID
- **Default**: (empty)
- **Example**: `GOOGLE_CLOUD_STORAGE_PROJ_ID=my-project-id`

##### `GOOGLE_CLOUD_STORAGE_BUCKET_NAME`
- **Description**: Google Cloud Storage bucket name
- **Default**: (empty)
- **Example**: `GOOGLE_CLOUD_STORAGE_BUCKET_NAME=my-bucket`

##### `GOOGLE_CLOUD_UNIFORM_BUCKET_ACCESS`
- **Description**: Enable uniform bucket access for Google Cloud Storage
- **Default**: `false`
- **Options**: `true` or `false`

---

### Settings Configuration

#### `NUMBER_OF_PROXIES`
- **Description**: Number of proxies to use
- **Default**: `0`
- **Example**: `NUMBER_OF_PROXIES=1`

#### `CORS_ORIGINS`
- **Description**: Comma-separated list of allowed CORS origins
- **Default**: (empty - allows all origins)
- **Example**: `CORS_ORIGINS=http://localhost:3030,https://example.com`

#### `IFRAME_ORIGINS`
- **Description**: Comma-separated list of allowed iframe origins
- **Default**: (empty - allows all origins)
- **Example**: `IFRAME_ORIGINS=http://localhost:3030,https://example.com`

#### `KODIVIAN_DATA_PATH`
- **Description**: Path to store data (database, uploads, etc).
- **Default**: `` (uses default relative paths)
- **Example**: `KODIVIAN_DATA_PATH=/path/to/your/data`
- **Note**: All data will be stored in `KODIVIAN_DATA_PATH/.kodivian/`

#### `KODIVIAN_FILE_SIZE_LIMIT`
- **Description**: File size limit for uploads.
- **Default**: `50mb`
- **Example**: `KODIVIAN_FILE_SIZE_LIMIT=50mb`

#### `DISABLE_KODIVIAN_TELEMETRY`
- **Description**: Disable telemetry.
- **Default**: `false`

#### `KODIVIAN_LICENSE_KEY`
- **Description**: License key for enterprise features.

#### `CHATBOT_IFRAME_ORIGINS`
- **Description**: Comma-separated list of allowed chatbot iframe origins
- **Default**: (empty)
- **Example**: `CHATBOT_IFRAME_ORIGINS=http://localhost:3030,https://example.com`

#### `SHOW_COMMUNITY_NODES`
- **Description**: Show community nodes in the UI
- **Default**: `true`
- **Options**: `true` or `false`


#### `DISABLED_NODES`
- **Description**: Comma-separated list of node names to disable
- **Default**: (empty)
- **Example**: `DISABLED_NODES=bufferMemory,chatOpenAI`

#### `MODEL_LIST_CONFIG_JSON`
- **Description**: Path to custom model list configuration JSON file
- **Default**: (empty)
- **Example**: `MODEL_LIST_CONFIG_JSON=../components/models.json`

---

### Metrics Collection Configuration

#### `ENABLE_METRICS`
- **Description**: Enable metrics collection
- **Default**: `true`
- **Options**: `true` or `false`

#### `METRICS_PROVIDER`
- **Description**: Metrics provider to use
- **Default**: `prometheus`
- **Options**: `prometheus`, `open_telemetry`
- **Example**: `METRICS_PROVIDER=prometheus`

#### `METRICS_INCLUDE_NODE_METRICS`
- **Description**: Include node-level metrics
- **Default**: `true`
- **Options**: `true` or `false`

#### `METRICS_SERVICE_NAME`
- **Description**: Service name for metrics
- **Default**: `Autonomous`
- **Example**: `METRICS_SERVICE_NAME=Autonomous`

#### OpenTelemetry Configuration (if METRICS_PROVIDER=open_telemetry)

##### `METRICS_OPEN_TELEMETRY_METRIC_ENDPOINT`
- **Description**: OpenTelemetry metrics endpoint URL
- **Default**: `http://localhost:4318/v1/metrics`
- **Example**: `METRICS_OPEN_TELEMETRY_METRIC_ENDPOINT=http://localhost:4318/v1/metrics`

##### `METRICS_OPEN_TELEMETRY_PROTOCOL`
- **Description**: OpenTelemetry protocol
- **Default**: `http`
- **Options**: `http`, `grpc`, `proto`

##### `METRICS_OPEN_TELEMETRY_DEBUG`
- **Description**: Enable OpenTelemetry debug mode
- **Default**: `false`
- **Options**: `true` or `false`

---

### Proxy Configuration

#### `GLOBAL_AGENT_HTTP_PROXY`
- **Description**: Global HTTP proxy URL
- **Default**: (empty)
- **Example**: `GLOBAL_AGENT_HTTP_PROXY=http://proxy.example.com:8080`
- **Note**: See https://www.npmjs.com/package/global-agent for more details

#### `GLOBAL_AGENT_HTTPS_PROXY`
- **Description**: Global HTTPS proxy URL
- **Default**: (empty)
- **Example**: `GLOBAL_AGENT_HTTPS_PROXY=https://proxy.example.com:8080`

#### `GLOBAL_AGENT_NO_PROXY`
- **Description**: Comma-separated list of hosts to bypass proxy
- **Default**: (empty)
- **Example**: `GLOBAL_AGENT_NO_PROXY=localhost,127.0.0.1`

---

### Queue Configuration

#### `MODE`
- **Description**: Server mode
- **Default**: `queue`
- **Options**: `queue`, `main`
- **Example**: `MODE=queue`

#### `QUEUE_NAME`
- **Description**: Queue name for job processing
- **Default**: `autonomous-queue`
- **Example**: `QUEUE_NAME=autonomous-queue`

#### `REDIS_DB_QUEUE`
- **Description**: Redis database number for queue
- **Default**: `3`
- **Example**: `REDIS_DB_QUEUE=3`

#### `WORKER_CONCURRENCY`
- **Description**: Number of concurrent workers
- **Default**: `20`
- **Example**: `WORKER_CONCURRENCY=20`

#### `REMOVE_ON_AGE`
- **Description**: Remove jobs older than this age (in seconds)
- **Default**: `86400` (24 hours)
- **Example**: `REMOVE_ON_AGE=86400`

#### `REMOVE_ON_COUNT`
- **Description**: Remove jobs when count exceeds this number
- **Default**: `1000`
- **Example**: `REMOVE_ON_COUNT=1000`

#### `ENABLE_BULLMQ_DASHBOARD`
- **Description**: Enable BullMQ dashboard
- **Default**: `true`
- **Options**: `true` or `false`

#### `REDIS_KEEP_ALIVE`
- **Description**: Redis keep-alive interval in milliseconds
- **Default**: `10000`
- **Example**: `REDIS_KEEP_ALIVE=10000`

#### `QUEUE_REDIS_EVENT_STREAM_MAX_LEN`
- **Description**: Maximum length of Redis event stream
- **Default**: (empty)
- **Example**: `QUEUE_REDIS_EVENT_STREAM_MAX_LEN=100000`

---

### Security Configuration

#### `ENABLE_E2E_ENCRYPTION`
- **Description**: Enable end-to-end encryption for API requests and responses
- **Default**: `false` (disabled)
- **Options**: `true` or `false`
- **Example**: `ENABLE_E2E_ENCRYPTION=true`
- **Note**: When enabled, uses hybrid RSA-2048 + AES-256 encryption. RSA is used for session key exchange, and AES-256 is used for data encryption. Session keys are stored in Redis with 24-hour TTL. All JSON request/response bodies are automatically encrypted/decrypted. File uploads (multipart/form-data) are excluded from encryption.

#### `HTTP_DENY_LIST`
- **Description**: Comma-separated list of HTTP endpoints to deny
- **Default**: (empty)
- **Example**: `HTTP_DENY_LIST=/api/v1/admin,/api/v1/internal`

#### `CUSTOM_MCP_SECURITY_CHECK`
- **Description**: Enable custom MCP security checks
- **Default**: (empty)
- **Options**: `true` or `false`

#### `CUSTOM_MCP_PROTOCOL`
- **Description**: MCP protocol to use
- **Default**: (empty)
- **Options**: `stdio`, `sse`
- **Example**: `CUSTOM_MCP_PROTOCOL=sse`

#### `TRUST_PROXY`
- **Description**: Trust proxy settings
- **Default**: (empty)
- **Options**: `true`, `false`, `1`, `loopback`, `linklocal`, `uniquelocal`, IP addresses, or comma-separated list
- **Example**: `TRUST_PROXY=true`

---

### Document Loaders Configuration

#### `PUPPETEER_EXECUTABLE_FILE_PATH`
- **Description**: Path to Puppeteer executable file
- **Default**: (empty)
- **Example**: `PUPPETEER_EXECUTABLE_FILE_PATH='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'`

#### `PLAYWRIGHT_EXECUTABLE_FILE_PATH`
- **Description**: Path to Playwright executable file
- **Default**: (empty)
- **Example**: `PLAYWRIGHT_EXECUTABLE_FILE_PATH='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'`

---

### Database Configuration

#### Main Database Configuration

**Note**: These variables are database-agnostic and support both PostgreSQL and Oracle.

##### `MAIN_DB_HOST`
- **Description**: Main database host (for platform database)
- **Default**: (empty)
- **Example**: `MAIN_DB_HOST=localhost`
- **Required**: Yes

##### `MAIN_DB_PORT`
- **Description**: Main database port
- **Default**: (empty)
- **Example**: `MAIN_DB_PORT=5432` (PostgreSQL) or `MAIN_DB_PORT=1521` (Oracle)

##### `MAIN_DB_DATABASE`
- **Description**: Main database name
- **Default**: (empty)
- **Example**: `MAIN_DB_DATABASE=autonomous` (PostgreSQL) or `MAIN_DB_DATABASE=ORCL` (Oracle)
- **Required**: Yes

##### `MAIN_DB_USER`
- **Description**: Main database user
- **Default**: (empty)
- **Example**: `MAIN_DB_USER=postgres` (PostgreSQL) or `MAIN_DB_USER=system` (Oracle)
- **Required**: Yes

##### `MAIN_DB_PASSWORD`
- **Description**: Main database password (can be encrypted)
- **Default**: (empty)
- **Example**: `MAIN_DB_PASSWORD=your_password`
- **Required**: Yes

##### `MAIN_DB_TYPE`
- **Description**: Main database type
- **Default**: (empty)
- **Options**: `POSTGRES`, `ORACLE`
- **Example**: `MAIN_DB_TYPE=POSTGRES`

##### `DB_POOL_SIZE`
- **Description**: Database connection pool size
- **Default**: (empty)
- **Example**: `DB_POOL_SIZE=10`

##### `DB_SSL`
- **Description**: Enable SSL for database connection
- **Default**: (empty)
- **Options**: `true` or `false`
- **Example**: `DB_SSL=true`

#### Database Table Creation

##### `ENABLE_TABLE_CREATION`
- **Description**: Enable automatic table creation at application startup
- **Default**: Not set (table creation is skipped)
- **Options**: `true` or `false` (or not set)
- **Example**: `ENABLE_TABLE_CREATION=true`
- **Note**: 
  - When set to `true`, the application will automatically create all required database tables at startup
  - When not set or set to `false`, the application assumes tables already exist and skips table creation (faster startup, suitable for production)
  - Suitable for development environments or first-time setup when tables don't exist yet

---

### Autonomous Server Migration Configuration

#### Application Short Codes

##### `APPBUILDER_SHORT_CODE`
- **Description**: App builder short code (from main server)
- **Default**: (empty)
- **Example**: `APPBUILDER_SHORT_CODE=BLDR`

##### `APPDESIGNER_SHORT_CODE`
- **Description**: App designer short code (from main server)
- **Default**: (empty)
- **Example**: `APPDESIGNER_SHORT_CODE=DSNGR`

##### `APPPUBLISHER_SHORT_CODE`
- **Description**: App publisher short code (from main server)
- **Default**: (empty)
- **Example**: `APPPUBLISHER_SHORT_CODE=APIGW`

#### Redis Configuration

##### `REDIS_DB_SESSION`
- **Description**: Redis database number for session storage
- **Default**: `1`
- **Example**: `REDIS_DB_SESSION=1`
- **Note**: Only the database number is used. Connection details (host, port, password) come from org config.

**Important Note**: All Redis connection details (host, port, password) are fetched from organization-specific configurations stored in the main PostgreSQL database (`PFM_ORG_CACHE_INFO` table). These are loaded at server startup via `OrganizationConfigService` and stored in memory.

#### Server Configuration

##### `SERVER_HOST`
- **Description**: Server hostname
- **Default**: (empty)
- **Example**: `SERVER_HOST=localhost`

##### `SERVER_PORT`
- **Description**: Port number for the server to listen on
- **Default**: (empty)
- **Example**: `SERVER_PORT=3030`

##### `CONTEXT_PATH`
- **Description**: Base context path for all API routes and static files
- **Default**: (empty)
- **Example**: `CONTEXT_PATH=/autonomous`
- **Note**: This is used for:
  - API routes: `${CONTEXT_PATH}/api/v1/...`
  - Static file serving: `${CONTEXT_PATH}/assets/...`
  - Marketplace icons: `${CONTEXT_PATH}/api/v1/marketplace-icons/...`
  - UI routes: `${CONTEXT_PATH}/*`

##### `PROXY_URL`
- **Description**: Proxy URL for the server
- **Default**: (empty)
- **Example**: `PROXY_URL=http://localhost:3030`

#### Session Configuration

##### `SESSION_COOKIE_MAX_AGE`
- **Description**: Session cookie max age in seconds
- **Default**: `900` (15 minutes)
- **Example**: `SESSION_COOKIE_MAX_AGE=900`

##### `SESSION_COOKIE_DOMAIN`
- **Description**: Session cookie domain
- **Default**: (empty)
- **Example**: `SESSION_COOKIE_DOMAIN=localhost`
- **Note**: For localhost, don't set domain (cookies work better without domain on localhost)

##### `SESSION_COOKIE_PATH`
- **Description**: Session cookie path
- **Default**: `/`
- **Example**: `SESSION_COOKIE_PATH=/`

##### `SESSION_COOKIE_HTTP_ONLY`
- **Description**: Enable HTTP-only flag for session cookies
- **Default**: `true`
- **Options**: `true` or `false`

##### `SESSION_COOKIE_SECURE`
- **Description**: Enable secure flag for session cookies (HTTPS only)
- **Default**: `false`
- **Options**: `true` or `false`

##### `SESSION_COOKIE_SAME_SITE`
- **Description**: SameSite policy for session cookies
- **Default**: `lax`
- **Options**: `strict`, `lax`, `none`
- **Example**: `SESSION_COOKIE_SAME_SITE=lax`

##### `SKIP_DESIGNER_SERVICE`
- **Description**: Skip designer service and use local `userinput.json` file for testing
- **Default**: `false`
- **Options**: `true` or `false`
- **Example**: `SKIP_DESIGNER_SERVICE=true`
- **Note**: Useful for local development without running the full Chainsys infrastructure. When set to `true`, the server will look for `userinput.json` in the server root directory instead of calling the designer service API. The file should contain user session data in the same format returned by the designer service.

#### License and Encryption Configuration

##### `LICENSE_CODE`
- **Description**: License code for password decryption
- **Default**: (empty)
- **Example**: `LICENSE_CODE=your_license_code`
- **Required**: Yes

##### `SIMPLE_CRYPTO_KEY`
- **Description**: Simple crypto key for localStorage encryption
- **Default**: (empty)
- **Example**: `SIMPLE_CRYPTO_KEY=your_crypto_key`
- **Required**: Yes

#### Server Deployment Configuration

##### `SERVER_MODE`
- **Description**: Deployment mode
- **Default**: (empty)
- **Example**: `SERVER_MODE=pm2`

##### `SERVER_CLUSTER_MODE`
- **Description**: Enable cluster mode
- **Default**: (empty)
- **Options**: `true` or `false`

##### `SERVER_INSTANCES`
- **Description**: Number of server instances
- **Default**: (empty)
- **Example**: `SERVER_INSTANCES=1`

##### `SERVER_TARGET_SERVER`
- **Description**: Target server hostname
- **Default**: (empty)
- **Example**: `SERVER_TARGET_SERVER=localhost`

##### `SERVER_DEPLOY_PATH`
- **Description**: Deployment path
- **Default**: (empty)
- **Example**: `SERVER_DEPLOY_PATH=./deployment`

#### CouchDB Configuration

##### `COUCHDB_DATABASE_CONFIG`
- **Description**: CouchDB config database name
- **Default**: `config`
- **Example**: `COUCHDB_DATABASE_CONFIG=config`

##### `COUCHDB_DATABASE_MAIN_DATA`
- **Description**: CouchDB main data database name
- **Default**: `mobile_platform`
- **Example**: `COUCHDB_DATABASE_MAIN_DATA=mobile_platform`

---

## Setup Instructions

### For Local Development

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Set minimum required values:**
   - `SERVER_PORT=3030` (or your preferred port)
   - `AUTONOMOUS_DATA_PATH=` (leave empty to use default)
   - `MAIN_DB_HOST`, `MAIN_DB_PORT`, `MAIN_DB_DATABASE`, `MAIN_DB_USER`, `MAIN_DB_PASSWORD` (for main database)
   - `LICENSE_CODE` (for password decryption)
   - `SIMPLE_CRYPTO_KEY` (for localStorage encryption)

3. **Start the server:**
   ```bash
   pnpm start
   ```

### For Production

1. **Security Requirements:**
   - Set strong `LICENSE_CODE` and `SIMPLE_CRYPTO_KEY`
   - Set `MAIN_DB_PASSWORD` for main database
   - Set `CORS_ORIGINS` to specific domains (not empty)
   - Set `IFRAME_ORIGINS` to specific domains (not empty)
   - Set `SESSION_COOKIE_SECURE=true` for HTTPS
   - Set `SESSION_COOKIE_DOMAIN` to your production domain

2. **Storage Configuration:**
   - For production, consider using S3 or GCS instead of local storage
   - Configure appropriate storage credentials

3. **Data Path:**
   - Set `AUTONOMOUS_DATA_PATH` to a persistent location
   - Ensure the path has proper permissions

4. **Metrics:**
   - Configure `METRICS_PROVIDER` and related settings
   - Set up Prometheus or OpenTelemetry endpoint

---

## Current .env Values Summary

Based on the current `.env.example` file, here are the key configuration sections:

```env
# Base Configuration
AUTONOMOUS_DATA_PATH=

# Logging
LOG_ENABLED=true
LOG_SYSTEM_ENABLED=true
LOG_WORKFLOWS_ENABLED=true
LOG_SERVICES_ENABLED=true
LOG_STORAGE_ENABLED=true
LOG_INFRASTRUCTURE_ENABLED=true

# Storage
STORAGE_TYPE=local

# Settings
CORS_ORIGINS=
IFRAME_ORIGINS=
CHATBOT_IFRAME_ORIGINS=
SHOW_COMMUNITY_NODES=true
DISABLE_AUTONOMOUS_TELEMETRY=true
NUMBER_OF_PROXIES=0

# Metrics Collection
ENABLE_METRICS=true
METRICS_PROVIDER=prometheus
METRICS_INCLUDE_NODE_METRICS=true
METRICS_SERVICE_NAME=Autonomous

# Queue Configuration
MODE=queue
QUEUE_NAME=autonomous-queue
REDIS_DB_QUEUE=3
WORKER_CONCURRENCY=20
REMOVE_ON_AGE=86400
REMOVE_ON_COUNT=1000
ENABLE_BULLMQ_DASHBOARD=true
REDIS_KEEP_ALIVE=10000

# Main Database Configuration (PostgreSQL/Oracle)
MAIN_DB_HOST=
MAIN_DB_PORT=
MAIN_DB_DATABASE=
MAIN_DB_USER=
MAIN_DB_PASSWORD=
MAIN_DB_TYPE=
DB_POOL_SIZE=
DB_SSL=

# Database Table Creation
# ENABLE_TABLE_CREATION=true

# Autonomous Server Migration
APPBUILDER_SHORT_CODE=
APPDESIGNER_SHORT_CODE=
APPPUBLISHER_SHORT_CODE=

REDIS_DB_SESSION=1

SERVER_HOST=
SERVER_PORT=
CONTEXT_PATH=
PROXY_URL=

SESSION_COOKIE_MAX_AGE=900
SESSION_COOKIE_DOMAIN=
SESSION_COOKIE_PATH=/
SESSION_COOKIE_HTTP_ONLY=true
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SAME_SITE=lax

LICENSE_CODE=
SIMPLE_CRYPTO_KEY=

# Security Configuration
ENABLE_E2E_ENCRYPTION=false

SERVER_MODE=
SERVER_CLUSTER_MODE=
SERVER_INSTANCES=
SERVER_TARGET_SERVER=
SERVER_DEPLOY_PATH=

COUCHDB_DATABASE_CONFIG=config
COUCHDB_DATABASE_MAIN_DATA=mobile_platform

# Log Sanitization
LOG_SANITIZE_BODY_FIELDS=password,pwd,pass,secret,token,apikey,api_key,accesstoken,access_token,refreshtoken,refresh_token,clientsecret,client_secret,privatekey,private_key,secretkey,secret_key,auth,authorization,credential,credentials
LOG_SANITIZE_HEADER_FIELDS=authorization,x-api-key,x-auth-token,cookie
```

**Note**: Sensitive values (passwords, API keys, tokens) are empty in `.env.example` and must be set in your actual `.env` file.

---

## Troubleshooting

### Database Connection Issues

- **PostgreSQL/Oracle**: Verify credentials and network connectivity
- Check database logs for detailed error messages
- Ensure `MAIN_DB_HOST`, `MAIN_DB_PORT`, `MAIN_DB_DATABASE`, `MAIN_DB_USER`, and `MAIN_DB_PASSWORD` are set correctly

### Storage Issues

- **Local Storage**: Ensure the storage directory has write permissions
- **S3**: Verify AWS credentials and bucket permissions
- **GCS**: Verify Google Cloud credentials and bucket permissions

### Port Already in Use

- Change `SERVER_PORT` to a different value (e.g., `3001`, `8080`)
- Or stop the process using the port

### Redis Connection Issues

- Redis connection details are fetched from organization configurations in the main database
- Ensure `REDIS_DB_SESSION` and `REDIS_DB_QUEUE` are set correctly
- Verify organization Redis configurations in the main database

---

## Additional Resources

- For more details, see the main README.md
- Check server logs in `.autonomous/logs/` for detailed error messages
- Review the `.env.example` file for all available options

---

**Last Updated**: Based on current `.env.example` structure
