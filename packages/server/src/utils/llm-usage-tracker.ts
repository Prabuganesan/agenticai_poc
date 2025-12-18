import { LlmUsage } from '../database/entities/LlmUsage'
import { calculateCost } from './llm-cost-calculator'
import { getDataSource } from '../DataSource'

export interface TrackLLMUsageOptions {
    requestId: string
    executionId?: string
    orgId: string
    userId: string
    chatflowId?: string
    chatId?: string
    sessionId?: string
    feature: string
    nodeId?: string
    nodeType?: string
    nodeName?: string
    location?: string
    provider: string
    model: string
    requestType: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    processingTimeMs?: number
    responseLength?: number
    success: boolean
    errorMessage?: string
    cacheHit?: boolean
    metadata?: any
}

/**
 * Extract model name from LangChain model object
 */
function extractModelNameFromObject(modelObj: any): string {
    if (!modelObj || typeof modelObj === 'string') {
        return typeof modelObj === 'string' ? modelObj : 'unknown'
    }

    // Try different properties where model name might be stored
    if (modelObj.model && typeof modelObj.model === 'string') {
        return modelObj.model
    }
    if (modelObj.configuredModel && typeof modelObj.configuredModel === 'string') {
        return modelObj.configuredModel
    }
    if (modelObj.lc_kwargs?.model && typeof modelObj.lc_kwargs.model === 'string') {
        return modelObj.lc_kwargs.model
    }
    if (modelObj.metadata?.fw_model_name && typeof modelObj.metadata.fw_model_name === 'string') {
        return modelObj.metadata.fw_model_name
    }

    return 'unknown'
}

/**
 * Extract provider from LangChain model object
 */
function extractProviderFromModelObject(modelObj: any): string {
    if (!modelObj || typeof modelObj === 'string') {
        return 'unknown'
    }

    // Check lc_namespace (e.g., ['langchain', 'chat_models', 'google_genai'])
    if (Array.isArray(modelObj.lc_namespace)) {
        const namespace = modelObj.lc_namespace.join(' ').toLowerCase()
        if (namespace.includes('google') || namespace.includes('genai')) {
            return 'google'
        }
        if (namespace.includes('openai')) {
            return 'openai'
        }
        if (namespace.includes('anthropic')) {
            return 'anthropic'
        }
        if (namespace.includes('aws') || namespace.includes('bedrock')) {
            return 'aws'
        }
        if (namespace.includes('cohere')) {
            return 'cohere'
        }
        if (namespace.includes('mistral')) {
            return 'mistral'
        }
        if (namespace.includes('voyage')) {
            return 'voyage'
        }
    }

    // Check class name or constructor name
    const className = modelObj.constructor?.name || ''
    const classNameLower = className.toLowerCase()
    if (classNameLower.includes('google') || classNameLower.includes('generative')) {
        return 'google'
    }
    if (classNameLower.includes('openai')) {
        return 'openai'
    }
    if (classNameLower.includes('anthropic') || classNameLower.includes('claude')) {
        return 'anthropic'
    }
    if (classNameLower.includes('aws') || classNameLower.includes('bedrock')) {
        return 'aws'
    }
    if (classNameLower.includes('cohere')) {
        return 'cohere'
    }
    if (classNameLower.includes('mistral')) {
        return 'mistral'
    }
    if (classNameLower.includes('voyage')) {
        return 'voyage'
    }

    return 'unknown'
}

/**
 * Track LLM usage asynchronously (non-blocking)
 * This function should be called after each LLM invocation
 */
export async function trackLLMUsage(options: TrackLLMUsageOptions): Promise<void> {
    try {
        const orgIdNum = parseInt(options.orgId)

        if (isNaN(orgIdNum)) {
            return
        }

        const dataSource = getDataSource(orgIdNum)

        // Ensure model is a string for cost calculation
        let modelNameForCost = options.model
        if (modelNameForCost && typeof modelNameForCost !== 'string') {
            modelNameForCost = extractModelNameFromObject(modelNameForCost) || 'unknown'
        }

        const cost = calculateCost(options.provider, modelNameForCost, options.promptTokens, options.completionTokens, options.requestType)

        // Generate GUID
        const { generateGuid } = await import('./guidGenerator')
        const guid = generateGuid()

        // Create usage record
        const usageRecord = new LlmUsage()
        usageRecord.guid = guid
        usageRecord.requestId = options.requestId
        usageRecord.executionId = options.executionId
        usageRecord.userId = options.userId
        usageRecord.chatflowId = options.chatflowId
        usageRecord.chatId = options.chatId
        usageRecord.sessionId = options.sessionId
        usageRecord.feature = options.feature
        usageRecord.nodeId = options.nodeId
        usageRecord.nodeType = options.nodeType
        usageRecord.nodeName = options.nodeName
        usageRecord.location = options.location
        usageRecord.provider = options.provider
        // Ensure model is always a string (not an object)
        let modelNameForDb = options.model
        if (modelNameForDb && typeof modelNameForDb !== 'string') {
            modelNameForDb = extractModelNameFromObject(modelNameForDb) || 'unknown'
        }
        usageRecord.model = modelNameForDb
        usageRecord.requestType = options.requestType
        usageRecord.promptTokens = options.promptTokens
        usageRecord.completionTokens = options.completionTokens
        usageRecord.totalTokens = options.totalTokens
        usageRecord.cost = cost
        usageRecord.processingTimeMs = options.processingTimeMs
        usageRecord.responseLength = options.responseLength
        usageRecord.success = options.success
        usageRecord.errorMessage = options.errorMessage
        usageRecord.cacheHit = options.cacheHit || false
        usageRecord.metadata = options.metadata
        usageRecord.createdAt = new Date()

        // Save to database (async, non-blocking)
        // Use raw query for Oracle to avoid RETURNING clause bind variable issues
        const saveStartTime = Date.now()
        try {
            const dbType = dataSource.options.type
            if (dbType === 'oracle') {
                // For Oracle, use raw driver connection to avoid RETURNING clause bind variable issues
                // TypeORM's insert() and query builder still generate RETURNING which causes NJS-044 errors
                // manager.query() doesn't recognize :1, :2 syntax, so we use the raw Oracle driver connection
                const metadata = usageRecord.metadata ? JSON.stringify(usageRecord.metadata) : null

                // Ensure all numeric values are properly converted to numbers for Oracle
                // Oracle is strict about number types and will throw ORA-01722 if strings are passed
                // Use a helper function to safely convert to number
                const safeToNumber = (value: any, defaultValue: number = 0): number => {
                    if (value == null || value === '' || value === 'undefined' || value === 'null') {
                        return defaultValue
                    }
                    if (typeof value === 'number') {
                        return isNaN(value) || !isFinite(value) ? defaultValue : value
                    }
                    if (typeof value === 'string') {
                        // Remove any whitespace
                        const trimmed = value.trim()
                        if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') {
                            return defaultValue
                        }
                        const num = Number(trimmed)
                        return isNaN(num) || !isFinite(num) ? defaultValue : num
                    }
                    const num = Number(value)
                    return isNaN(num) || !isFinite(num) ? defaultValue : num
                }

                // Helper function for nullable numeric fields
                const safeToNumberOrNull = (value: any): number | null => {
                    if (value == null || value === '' || value === 'undefined' || value === 'null') {
                        return null
                    }
                    if (typeof value === 'number') {
                        return (isNaN(value) || !isFinite(value)) ? null : value
                    }
                    if (typeof value === 'string') {
                        const trimmed = value.trim()
                        if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') {
                            return null
                        }
                        const num = Number(trimmed)
                        return (isNaN(num) || !isFinite(num)) ? null : num
                    }
                    const num = Number(value)
                    return (isNaN(num) || !isFinite(num)) ? null : num
                }

                const promptTokens = safeToNumber(usageRecord.promptTokens, 0)
                const completionTokens = safeToNumber(usageRecord.completionTokens, 0)
                const totalTokens = safeToNumber(usageRecord.totalTokens, 0)
                const costValue = safeToNumber(usageRecord.cost, 0)

                const processingTimeMs = safeToNumberOrNull(usageRecord.processingTimeMs)
                const responseLength = safeToNumberOrNull(usageRecord.responseLength)

                const queryRunner = dataSource.createQueryRunner()
                try {
                    await queryRunner.connect()
                    // Get the raw Oracle connection - queryRunner.connection might be the raw connection
                    const connection = queryRunner.connection as any

                    // Check if connection has execute method (raw Oracle connection)
                    // Use raw Oracle driver connection with :1, :2 syntax
                    await connection.execute(
                        `INSERT INTO "AUTO_SAB_LLM_USAGE" (
                                "GUID", "REQUEST_ID", "EXECUTION_ID", "USER_ID", "CHATFLOW_ID", 
                                "CHAT_ID", "SESSION_ID", "FEATURE", "NODE_ID", "NODE_TYPE", 
                                "NODE_NAME", "LOCATION", "PROVIDER", "MODEL", "REQUEST_TYPE", 
                                "PROMPT_TOKENS", "COMPLETION_TOKENS", "TOTAL_TOKENS", "COST", 
                                "PROCESSING_TIME_MS", "RESPONSE_LENGTH", "SUCCESS", "ERROR_MESSAGE", 
                                "CACHE_HIT", "METADATA", "CREATED_AT"
                            ) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14, :15, :16, :17, :18, :19, :20, :21, :22, :23, :24, :25, :26)`,
                        [
                            usageRecord.guid,
                            usageRecord.requestId,
                            usageRecord.executionId || null,
                            usageRecord.userId,
                            usageRecord.chatflowId || null,
                            usageRecord.chatId || null,
                            usageRecord.sessionId || null,
                            usageRecord.feature,
                            usageRecord.nodeId || null,
                            usageRecord.nodeType || null,
                            usageRecord.nodeName || null,
                            usageRecord.location || null,
                            usageRecord.provider,
                            usageRecord.model,
                            usageRecord.requestType || null,
                            promptTokens,
                            completionTokens,
                            totalTokens,
                            costValue,
                            processingTimeMs,
                            responseLength,
                            usageRecord.success ? 1 : 0,
                            usageRecord.errorMessage || null,
                            usageRecord.cacheHit ? 1 : 0,
                            metadata,
                            usageRecord.createdAt
                        ],
                        { autoCommit: true }
                    )
                } finally {
                    await queryRunner.release()
                }
            } else {
                // For PostgreSQL, use save() which supports RETURNING clause
                await dataSource.getRepository(LlmUsage).save(usageRecord)
            }
            const saveDuration = Date.now() - saveStartTime

            // Log database operation
            try {
                const { databaseLog } = await import('./logger/module-methods')
                await databaseLog('info', 'Database save operation (LLM usage)', {
                    userId: options.userId || 'anonymous',
                    orgId: options.orgId,
                    operation: 'save',
                    table: 'auto_sab_llm_usage',
                    durationMs: saveDuration,
                    success: true
                }).catch(() => { })
            } catch (logError) {
                // Silently fail - logging should not break database operations
            }
        } catch (dbError) {
            const saveDuration = Date.now() - saveStartTime

            // Log database operation failure
            try {
                const { databaseLog } = await import('./logger/module-methods')
                await databaseLog('error', 'Database save operation failed (LLM usage)', {
                    userId: options.userId || 'anonymous',
                    orgId: options.orgId,
                    operation: 'save',
                    table: 'auto_sab_llm_usage',
                    durationMs: saveDuration,
                    success: false,
                    error: dbError instanceof Error ? dbError.message : String(dbError)
                }).catch(() => { })
            } catch (logError) {
                // Silently fail
            }
            throw dbError
        }

        // Log usage tracking
        try {
            const { usageLog } = await import('./logger/module-methods')
            await usageLog('info', 'LLM usage tracked', {
                userId: options.userId || 'anonymous',
                orgId: options.orgId,
                requestId: options.requestId,
                executionId: options.executionId,
                chatflowId: options.chatflowId,
                chatId: options.chatId,
                sessionId: options.sessionId,
                feature: options.feature,
                provider: options.provider,
                model: modelNameForDb,
                promptTokens: options.promptTokens,
                completionTokens: options.completionTokens,
                totalTokens: options.totalTokens,
                cost: cost,
                processingTimeMs: options.processingTimeMs,
                success: options.success,
                cacheHit: options.cacheHit || false
            }).catch(() => { }) // Don't fail if logging fails
        } catch (logError) {
            // Silently fail - logging should not break usage tracking
        }

        // Track with Prometheus if enabled
        if (process.env.ENABLE_METRICS === 'true' && process.env.METRICS_PROVIDER === 'prometheus') {
            try {
                const { getInstance } = await import('../index')
                const app = getInstance()

                if (app?.metricsProvider && typeof app.metricsProvider.trackLLMUsage === 'function') {
                    app.metricsProvider.trackLLMUsage({
                        provider: options.provider,
                        model: modelNameForDb,
                        feature: options.feature,
                        orgId: options.orgId,
                        nodeType: options.nodeType || 'LLM',
                        promptTokens: options.promptTokens,
                        completionTokens: options.completionTokens,
                        totalTokens: options.totalTokens,
                        cost: cost,
                        processingTimeMs: options.processingTimeMs || 0,
                        success: options.success
                    })
                }
            } catch (promError) {
                // Silently fail - Prometheus tracking should not break the flow
            }
        }
    } catch (error: any) {
        // Silently fail - tracking should not break the main flow
    }
}

/**
 * Extract usage metadata from LangChain response
 * Handles various response formats including Google/Gemini, OpenAI, Anthropic, etc.
 */
import { logInfo } from './logger/system-helper'

export function extractUsageMetadata(response: any): {
    promptTokens: number
    completionTokens: number
    totalTokens: number
} {
    // Helper function to safely convert to number
    const toNumber = (value: any, defaultValue: number = 0): number => {
        if (value == null || value === '' || value === 'undefined' || value === 'null') {
            return defaultValue
        }
        if (typeof value === 'number') {
            return isNaN(value) || !isFinite(value) ? defaultValue : value
        }
        if (typeof value === 'string') {
            const trimmed = value.trim()
            if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') {
                return defaultValue
            }
            const num = Number(trimmed)
            return isNaN(num) || !isFinite(num) ? defaultValue : num
        }
        const num = Number(value)
        return isNaN(num) || !isFinite(num) ? defaultValue : num
    }

    let promptTokens = 0
    let completionTokens = 0
    let totalTokens = 0

    if (process.env.DEBUG === 'true') {
        logInfo(`[extractUsageMetadata] Response keys: ${response ? Object.keys(response) : 'null'}`)
        if (response?.usage_metadata) logInfo(`[extractUsageMetadata] usage_metadata: ${JSON.stringify(response.usage_metadata)}`)
        if (response?.usageMetadata) logInfo(`[extractUsageMetadata] usageMetadata: ${JSON.stringify(response.usageMetadata)}`)
        if (response?.llmOutput) logInfo(`[extractUsageMetadata] llmOutput keys: ${Object.keys(response.llmOutput || {})}`)
    }

    // Priority 1: Check if response is a ChatResult with generations array (LangChain format)
    // This is where Google Gemini typically stores usage data
    if (response?.generations && Array.isArray(response.generations) && response.generations.length > 0) {
        // generations[0] is an array of Generation objects
        const firstGenArray = response.generations[0]
        if (Array.isArray(firstGenArray) && firstGenArray.length > 0) {
            const firstGen: any = firstGenArray[0]

            // Check the message.usage_metadata directly (Google Gemini format)
            // Note: kwargs is not accessible as a property, only visible in JSON serialization
            if (firstGen?.message?.usage_metadata) {
                const usage = firstGen.message.usage_metadata
                promptTokens = toNumber(usage.input_tokens || usage.prompt_tokens, 0)
                completionTokens = toNumber(usage.output_tokens || usage.completion_tokens, 0)
                totalTokens = toNumber(usage.total_tokens, promptTokens + completionTokens)
            }
            // Check the message.kwargs for usage_metadata (Google Gemini format)
            else if (firstGen?.message?.kwargs?.usage_metadata) {
                const usage = firstGen.message.kwargs.usage_metadata
                promptTokens = toNumber(usage.input_tokens || usage.prompt_tokens, 0)
                completionTokens = toNumber(usage.output_tokens || usage.completion_tokens, 0)
                totalTokens = toNumber(usage.total_tokens, promptTokens + completionTokens)
            }
            // Check the message object for usage_metadata in additional_kwargs
            else if (firstGen?.message?.additional_kwargs?.usage_metadata) {
                const usage = firstGen.message.additional_kwargs.usage_metadata
                promptTokens = toNumber(usage.input_tokens || usage.prompt_tokens, 0)
                completionTokens = toNumber(usage.output_tokens || usage.completion_tokens, 0)
                totalTokens = toNumber(usage.total_tokens, promptTokens + completionTokens)
            }
            // Also check response_metadata for usage
            else if (firstGen?.message?.response_metadata?.usage_metadata) {
                const usage = firstGen.message.response_metadata.usage_metadata
                promptTokens = toNumber(usage.input_tokens || usage.prompt_tokens, 0)
                completionTokens = toNumber(usage.output_tokens || usage.completion_tokens, 0)
                totalTokens = toNumber(usage.total_tokens, promptTokens + completionTokens)
            }
        }

        // Fallback: Check llmOutput at response level
        if (totalTokens === 0 && response.llmOutput?.tokenUsage) {
            const tokenUsage = response.llmOutput.tokenUsage
            promptTokens = toNumber(tokenUsage.promptTokens, 0)
            completionTokens = toNumber(tokenUsage.completionTokens, 0)
            totalTokens = toNumber(tokenUsage.totalTokens, promptTokens + completionTokens)
        }
        // Check estimatedTokenUsage as well
        if (totalTokens === 0 && response.llmOutput?.estimatedTokenUsage) {
            const tokenUsage = response.llmOutput.estimatedTokenUsage
            promptTokens = toNumber(tokenUsage.promptTokens, 0)
            completionTokens = toNumber(tokenUsage.completionTokens, 0)
            totalTokens = toNumber(tokenUsage.totalTokens, promptTokens + completionTokens)
        }
    }
    // Priority 2: Check if response has usageMetadata at root (ConversationalAgent format)
    else if (response?.usageMetadata) {
        const usage = response.usageMetadata
        promptTokens = toNumber(usage.input_tokens || usage.prompt_tokens, 0)
        completionTokens = toNumber(usage.output_tokens || usage.completion_tokens, 0)
        totalTokens = toNumber(usage.total_tokens, promptTokens + completionTokens)
    }
    // Check if response has output.usageMetadata (Agent_Agentflow format)
    else if (response?.output?.usageMetadata) {
        const usage = response.output.usageMetadata
        promptTokens = toNumber(usage.input_tokens || usage.prompt_tokens, 0)
        completionTokens = toNumber(usage.output_tokens || usage.completion_tokens, 0)
        totalTokens = toNumber(usage.total_tokens, promptTokens + completionTokens)
    }
    // Check if response is a LangChain AIMessage (has additional_kwargs)
    else if (response?.additional_kwargs?.usage_metadata) {
        const usage = response.additional_kwargs.usage_metadata
        promptTokens = toNumber(usage.input_tokens || usage.prompt_tokens, 0)
        completionTokens = toNumber(usage.output_tokens || usage.completion_tokens, 0)
        totalTokens = toNumber(usage.total_tokens, promptTokens + completionTokens)
    }
    // Check if response is a LangChain ChatResult (has llmOutput)
    else if (response?.llmOutput?.tokenUsage) {
        const tokenUsage = response.llmOutput.tokenUsage
        promptTokens = toNumber(tokenUsage.promptTokens, 0)
        completionTokens = toNumber(tokenUsage.completionTokens, 0)
        totalTokens = toNumber(tokenUsage.totalTokens, promptTokens + completionTokens)
    }
    // Check if response has llmOutput.estimatedTokenUsage (Google streaming format)
    else if (response?.llmOutput?.estimatedTokenUsage) {
        const tokenUsage = response.llmOutput.estimatedTokenUsage
        promptTokens = toNumber(tokenUsage.promptTokens, 0)
        completionTokens = toNumber(tokenUsage.completionTokens, 0)
        totalTokens = toNumber(tokenUsage.totalTokens, promptTokens + completionTokens)
    }
    // Check if response has usage_metadata at root (Google format)
    else if (response?.usage_metadata) {
        const usage = response.usage_metadata
        promptTokens = toNumber(usage.input_tokens || usage.prompt_tokens || usage.promptTokenCount, 0)
        completionTokens = toNumber(usage.output_tokens || usage.completion_tokens || usage.candidatesTokenCount, 0)
        totalTokens = toNumber(usage.total_tokens || usage.totalTokenCount, promptTokens + completionTokens)
    }
    // Check if response has tokenUsage at root
    else if (response?.tokenUsage) {
        const tokenUsage = response.tokenUsage
        promptTokens = toNumber(tokenUsage.promptTokens, 0)
        completionTokens = toNumber(tokenUsage.completionTokens, 0)
        totalTokens = toNumber(tokenUsage.totalTokens, promptTokens + completionTokens)
    }
    // Check if response has usage object
    else if (response?.usage) {
        const usage = response.usage
        promptTokens = toNumber(usage.promptTokens || usage.inputTokens || usage.promptTokenCount, 0)
        completionTokens = toNumber(usage.completionTokens || usage.outputTokens || usage.candidatesTokenCount, 0)
        totalTokens = toNumber(usage.totalTokens || usage.totalTokenCount, promptTokens + completionTokens)
    }
    // Check for Google-specific format with promptTokenCount, candidatesTokenCount, totalTokenCount
    else if (response?.promptTokenCount !== undefined || response?.candidatesTokenCount !== undefined) {
        promptTokens = toNumber(response.promptTokenCount, 0)
        completionTokens = toNumber(response.candidatesTokenCount, 0)
        totalTokens = toNumber(response.totalTokenCount, promptTokens + completionTokens)
    }

    totalTokens = toNumber(totalTokens, promptTokens + completionTokens)

    // Debug: Log if we have tokens but missing prompt tokens
    if (totalTokens > 0 && promptTokens === 0) {
        console.warn('[extractUsageMetadata] WARNING: totalTokens > 0 but promptTokens = 0')
        console.warn('[extractUsageMetadata] Response structure:', JSON.stringify(response, null, 2).substring(0, 1000))
    }

    if (process.env.DEBUG === 'true') {
        logInfo(`[extractUsageMetadata] Extracted - prompt: ${promptTokens}, completion: ${completionTokens}, total: ${totalTokens}`)
    }

    return {
        promptTokens,
        completionTokens,
        totalTokens
    }
}

/**
 * Extract provider and model from node data or response
 */
export function extractProviderAndModel(
    nodeData: any,
    response?: any
): {
    provider: string
    model: string
} {
    let provider = 'unknown'
    let model = 'unknown'

    // PRIORITY 1: Try to extract from nodeData.inputs (most reliable for agentflows)
    if (nodeData?.inputs) {
        // Check for different agent model field names
        const modelFieldNames = [
            'agentModel', // Standard Agent
            'conditionAgentModel', // Condition Agent
            'llmModel', // LLM node
            'model', // Generic
            'modelName' // Alternative
        ]

        const configFieldNames = ['agentModelConfig', 'conditionAgentModelConfig', 'llmModelConfig', 'modelConfig']

        // Try to find model field
        let modelFieldValue: string | undefined
        let configFieldValue: any

        for (const fieldName of modelFieldNames) {
            if (nodeData.inputs[fieldName] && typeof nodeData.inputs[fieldName] === 'string') {
                modelFieldValue = nodeData.inputs[fieldName]
                break
            }
        }

        // Try to find config field
        for (const fieldName of configFieldNames) {
            if (nodeData.inputs[fieldName]) {
                configFieldValue = nodeData.inputs[fieldName]
                break
            }
        }

        // Extract provider from model field name
        if (modelFieldValue) {
            const modelName = modelFieldValue.toLowerCase()
            if (modelName.includes('openai') || modelName.includes('azure')) {
                provider = 'openai'
            } else if (modelName.includes('anthropic')) {
                provider = 'anthropic'
            } else if (modelName.includes('google') || modelName.includes('gemini') || modelName.includes('generative')) {
                provider = 'google'
            } else if (modelName.includes('aws') || modelName.includes('bedrock')) {
                provider = 'aws'
            } else if (modelName.includes('cohere')) {
                provider = 'cohere'
            } else if (modelName.includes('mistral')) {
                provider = 'mistral'
            }
        }

        // Extract actual model name from config
        if (configFieldValue) {
            let config = configFieldValue

            // Parse if it's a string
            if (typeof config === 'string') {
                try {
                    config = JSON.parse(config)
                } catch (e) {
                    // Not JSON, ignore
                }
            }

            // Extract modelName from config object
            if (config && typeof config === 'object' && config.modelName) {
                model = config.modelName
            }
        }

        // Fallback: try standard model fields
        if (model === 'unknown' && nodeData.inputs.modelName && typeof nodeData.inputs.modelName === 'string') {
            model = nodeData.inputs.modelName
        } else if (model === 'unknown' && nodeData.inputs.model) {
            const modelInput = nodeData.inputs.model

            if (typeof modelInput === 'string') {
                model = modelInput
            } else if (modelInput && typeof modelInput === 'object') {
                model = extractModelNameFromObject(modelInput)
                if (provider === 'unknown') {
                    provider = extractProviderFromModelObject(modelInput)
                }
            }
        }
    }

    // PRIORITY 2: Try to extract from response/llmOutput
    if (response) {
        // Check if response has model information directly
        if (model === 'unknown' && response.model) {
            if (typeof response.model === 'string') {
                model = response.model
            } else if (response.model && typeof response.model === 'object') {
                model = extractModelNameFromObject(response.model)
                if (provider === 'unknown') {
                    provider = extractProviderFromModelObject(response.model)
                }
            }
        } else if (model === 'unknown' && response.model_name && typeof response.model_name === 'string') {
            model = response.model_name
        }

        // Check lc_kwargs for model information
        if (model === 'unknown' && response.lc_kwargs?.model) {
            if (typeof response.lc_kwargs.model === 'string') {
                model = response.lc_kwargs.model
            }
        }

        // Extract provider from lc_namespace if available
        if (provider === 'unknown' && Array.isArray(response.lc_namespace)) {
            const namespace = response.lc_namespace.join(' ').toLowerCase()
            if (namespace.includes('google') || namespace.includes('genai')) {
                provider = 'google'
            } else if (namespace.includes('openai')) {
                provider = 'openai'
            } else if (namespace.includes('anthropic')) {
                provider = 'anthropic'
            } else if (namespace.includes('aws') || namespace.includes('bedrock')) {
                provider = 'aws'
            } else if (namespace.includes('cohere')) {
                provider = 'cohere'
            } else if (namespace.includes('mistral')) {
                provider = 'mistral'
            }
        }
    }

    // PRIORITY 3: Try to get from node data name (fallback)
    if (provider === 'unknown' && nodeData?.name) {
        const nodeName = nodeData.name.toLowerCase()

        // Map node names to providers
        if (nodeName.includes('openai') || nodeName.includes('azure')) {
            provider = 'openai'
        } else if (nodeName.includes('anthropic')) {
            provider = 'anthropic'
        } else if (nodeName.includes('google')) {
            provider = 'google'
        } else if (nodeName.includes('aws') || nodeName.includes('bedrock')) {
            provider = 'aws'
        } else if (nodeName.includes('cohere')) {
            provider = 'cohere'
        } else if (nodeName.includes('mistral')) {
            provider = 'mistral'
        } else if (nodeName.includes('voyage')) {
            provider = 'voyage'
        }
    }

    // Try to get model from node inputs
    if (nodeData?.inputs) {
        // Check agentModel first (used in agent flows)
        if (nodeData.inputs.agentModel && typeof nodeData.inputs.agentModel === 'string') {
            const agentModelName = nodeData.inputs.agentModel.toLowerCase()
            // Extract provider from agentModel name if not already set
            if (provider === 'unknown') {
                if (agentModelName.includes('openai') || agentModelName.includes('azure')) {
                    provider = 'openai'
                } else if (agentModelName.includes('anthropic')) {
                    provider = 'anthropic'
                } else if (
                    agentModelName.includes('google') ||
                    agentModelName.includes('gemini') ||
                    agentModelName.includes('generative')
                ) {
                    provider = 'google'
                } else if (agentModelName.includes('aws') || agentModelName.includes('bedrock')) {
                    provider = 'aws'
                } else if (agentModelName.includes('cohere')) {
                    provider = 'cohere'
                } else if (agentModelName.includes('mistral')) {
                    provider = 'mistral'
                }
            }

            // Try to get actual model name from agentModelConfig
            if (nodeData.inputs.agentModelConfig) {
                let config = nodeData.inputs.agentModelConfig

                // Parse if it's a string
                if (typeof config === 'string') {
                    try {
                        config = JSON.parse(config)
                    } catch (e) { }
                }

                // Extract modelName from config object
                if (config && typeof config === 'object' && config.modelName) {
                    model = config.modelName
                }
            }
        }

        // Standard model fields
        if (model === 'unknown' && nodeData.inputs.modelName && typeof nodeData.inputs.modelName === 'string') {
            model = nodeData.inputs.modelName
        } else if (model === 'unknown' && nodeData.inputs.model) {
            const modelInput = nodeData.inputs.model

            if (typeof modelInput === 'string') {
                model = modelInput
            } else if (modelInput && typeof modelInput === 'object') {
                // Extract from model object
                model = extractModelNameFromObject(modelInput)

                // If provider is still unknown, try to extract from model object
                if (provider === 'unknown') {
                    provider = extractProviderFromModelObject(modelInput)
                }
            }
        }
    }

    // Try to get from response (only if we haven't found a model yet)
    if (model === 'unknown' && response?.model) {
        if (typeof response.model === 'string') {
            model = response.model
        } else if (response.model && typeof response.model === 'object') {
            model = extractModelNameFromObject(response.model)

            if (provider === 'unknown') {
                provider = extractProviderFromModelObject(response.model)
            }
        }
    } else if (model === 'unknown' && response?.model_name && typeof response.model_name === 'string') {
        model = response.model_name
    }

    // Ensure model is always a string (not an object)
    if (model && typeof model !== 'string') {
        model = extractModelNameFromObject(model) || 'unknown'
    }

    return { provider, model }
}
