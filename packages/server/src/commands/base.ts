import { Command, Flags } from '@oclif/core'
import dotenv from 'dotenv'
import path from 'path'
// Old logger removed - use new logging system from '../utils/logger/system-helper'

dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), override: true })

enum EXIT_CODE {
    SUCCESS = 0,
    FAILED = 1
}

export abstract class BaseCommand extends Command {
    static flags = {
        // Data Path
        KODIVIAN_DATA_PATH: Flags.string({
            description: 'Base path for all kodivian server data (database, uploads, logs, etc.). Defaults to server folder/.kodivian'
        }),

        // Encryption
        ENABLE_E2E_ENCRYPTION: Flags.string({
            description: 'Enable end-to-end encryption for requests/responses/SSE'
        }),

        // TOON Format
        ENABLE_TOON_FORMAT: Flags.string({
            description: 'Enable TOON format processing for LLM inputs and outputs'
        }),

        // Logging Flags
        LOG_ENABLED: Flags.string({
            description: 'Global master switch for all logging'
        }),
        LOG_SYSTEM_ENABLED: Flags.string(),
        LOG_WORKFLOWS_ENABLED: Flags.string(),
        LOG_SERVICES_ENABLED: Flags.string(),
        LOG_STORAGE_ENABLED: Flags.string(),
        LOG_INFRASTRUCTURE_ENABLED: Flags.string(),
        LOG_LEVEL: Flags.string(),
        LOG_SANITIZE_BODY_FIELDS: Flags.string(),
        LOG_SANITIZE_HEADER_FIELDS: Flags.string(),

        // Storage
        STORAGE_TYPE: Flags.string(),
        S3_STORAGE_BUCKET_NAME: Flags.string(),
        S3_STORAGE_ACCESS_KEY_ID: Flags.string(),
        S3_STORAGE_SECRET_ACCESS_KEY: Flags.string(),
        S3_STORAGE_REGION: Flags.string(),
        S3_ENDPOINT_URL: Flags.string(),
        S3_FORCE_PATH_STYLE: Flags.string(),
        GOOGLE_CLOUD_STORAGE_CREDENTIAL: Flags.string(),
        GOOGLE_CLOUD_STORAGE_PROJ_ID: Flags.string(),
        GOOGLE_CLOUD_STORAGE_BUCKET_NAME: Flags.string(),
        GOOGLE_CLOUD_UNIFORM_BUCKET_ACCESS: Flags.string(),

        // Server Settings
        SERVER_HOST: Flags.string(),
        SERVER_PORT: Flags.string(),
        CONTEXT_PATH: Flags.string(),
        CORS_ORIGINS: Flags.string(),
        IFRAME_ORIGINS: Flags.string(),
        CHATBOT_IFRAME_ORIGINS: Flags.string(),
        KODIVIAN_FILE_SIZE_LIMIT: Flags.string(),
        NUMBER_OF_PROXIES: Flags.string(),
        TRUST_PROXY: Flags.string(),

        // Session Configuration
        SESSION_COOKIE_MAX_AGE: Flags.string(),
        SESSION_COOKIE_DOMAIN: Flags.string(),
        SESSION_COOKIE_PATH: Flags.string(),
        SESSION_COOKIE_HTTP_ONLY: Flags.string(),
        SESSION_COOKIE_SECURE: Flags.string(),
        SESSION_COOKIE_SAME_SITE: Flags.string(),

        // Main Database (for org configs)
        MAIN_DB_HOST: Flags.string(),
        MAIN_DB_PORT: Flags.string(),
        MAIN_DB_DATABASE: Flags.string(),
        MAIN_DB_USER: Flags.string(),
        MAIN_DB_PASSWORD: Flags.string(),
        MAIN_DB_TYPE: Flags.string(),
        DB_POOL_SIZE: Flags.string(),
        DB_SSL: Flags.string(),
        ENABLE_TABLE_CREATION: Flags.string(),

        // Legacy Database Flags (deprecated, kept for backward compatibility)
        DATABASE_TYPE: Flags.string(),
        DATABASE_PORT: Flags.string(),
        DATABASE_HOST: Flags.string(),
        DATABASE_NAME: Flags.string(),
        DATABASE_USER: Flags.string(),
        DATABASE_PASSWORD: Flags.string(),
        DATABASE_SSL: Flags.string(),
        DATABASE_SSL_KEY_BASE64: Flags.string(),

        // Redis Configuration
        REDIS_DB_SESSION: Flags.string({
            description: 'Redis DB number for sessions'
        }),
        REDIS_DB_QUEUE: Flags.string({
            description: 'Redis DB number for BullMQ queues'
        }),
        REDIS_KEEP_ALIVE: Flags.string(),

        // Queue Configuration
        MODE: Flags.string({
            description: 'Server mode: queue or main'
        }),
        QUEUE_NAME: Flags.string(),
        WORKER_CONCURRENCY: Flags.string(),
        QUEUE_REDIS_EVENT_STREAM_MAX_LEN: Flags.string(),
        REMOVE_ON_AGE: Flags.string(),
        REMOVE_ON_COUNT: Flags.string(),
        ENABLE_BULLMQ_DASHBOARD: Flags.string(),

        // Kodivian-specific
        APPBUILDER_SHORT_CODE: Flags.string(),
        APPDESIGNER_SHORT_CODE: Flags.string(),
        APPPUBLISHER_SHORT_CODE: Flags.string(),
        LICENSE_CODE: Flags.string(),
        SIMPLE_CRYPTO_KEY: Flags.string(),

        // Metrics
        ENABLE_METRICS: Flags.string(),
        METRICS_PROVIDER: Flags.string(),
        METRICS_INCLUDE_NODE_METRICS: Flags.string(),
        METRICS_SERVICE_NAME: Flags.string(),

        // Node Configuration
        SHOW_COMMUNITY_NODES: Flags.string(),
        DISABLED_NODES: Flags.string(),
        MODEL_LIST_CONFIG_JSON: Flags.string(),
        DEBUG: Flags.string(),

        // Tool/Function Dependencies
        TOOL_FUNCTION_BUILTIN_DEP: Flags.string(),
        TOOL_FUNCTION_EXTERNAL_DEP: Flags.string(),
        ALLOW_BUILTIN_DEP: Flags.string(),

        // LangChain Tracing
        LANGCHAIN_TRACING_V2: Flags.string(),
        LANGCHAIN_ENDPOINT: Flags.string(),
        LANGCHAIN_API_KEY: Flags.string(),
        LANGCHAIN_PROJECT: Flags.string(),

        // Security
        CUSTOM_MCP_SECURITY_CHECK: Flags.string(),
        CUSTOM_MCP_PROTOCOL: Flags.string(),
        HTTP_DENY_LIST: Flags.string()
    }

    protected async stopProcess() {
        // Overridden method by child class
    }

    protected onTerminate() {
        return async () => {
            try {
                // Shut down the app after timeout if it ever stuck removing pools
                setTimeout(async () => {
                    const { logInfo } = await import('../utils/logger/system-helper')
                    logInfo('Kodivian was forced to shut down after 30 secs').catch(() => { })
                    await this.failExit()
                }, 30000)

                await this.stopProcess()
            } catch (error) {
                const { logError } = await import('../utils/logger/system-helper')
                logError('There was an error shutting down Kodivian...', error).catch(() => { })
            }
        }
    }

    protected async gracefullyExit() {
        process.exit(EXIT_CODE.SUCCESS)
    }

    protected async failExit() {
        process.exit(EXIT_CODE.FAILED)
    }

    async init(): Promise<void> {
        await super.init()

        process.on('SIGTERM', this.onTerminate())
        process.on('SIGINT', this.onTerminate())

        // Prevent throw new Error from crashing the app
        // TODO: Get rid of this and send proper error message to ui
        process.on('uncaughtException', async (err) => {
            const { logError } = await import('../utils/logger/system-helper')
            logError('uncaughtException: ', err).catch(() => { })
        })

        process.on('unhandledRejection', async (err) => {
            const { logError } = await import('../utils/logger/system-helper')
            logError('unhandledRejection: ', err).catch(() => { })
        })

        const { flags } = await this.parse(this.constructor as any)

        // Set environment variables from flags using loop (simplified approach from Kodivian)
        Object.keys(flags).forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(flags, key) && flags[key]) {
                process.env[key] = flags[key]
            }
        })
    }
}
