export interface LLMUsageMetrics {
    provider: string
    model: string
    feature: string
    orgId: string
    nodeType: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cost: number
    processingTimeMs: number
    success: boolean
}

export interface IMetricsProvider {
    getName(): string
    initializeCounters(): void
    setupMetricsEndpoint(): void
    incrementCounter(counter: AUTONOMOUS_METRIC_COUNTERS, payload: any): void
    trackLLMUsage?(usage: LLMUsageMetrics): void
}

export enum AUTONOMOUS_COUNTER_STATUS {
    SUCCESS = 'success',
    FAILURE = 'failure'
}

export enum AUTONOMOUS_METRIC_COUNTERS {
    CHATFLOW_CREATED = 'chatflow_created',
    AGENTFLOW_CREATED = 'agentflow_created',
    ASSISTANT_CREATED = 'assistant_created',
    TOOL_CREATED = 'tool_created',
    VECTORSTORE_UPSERT = 'vector_upserted',

    CHATFLOW_PREDICTION_INTERNAL = 'chatflow_prediction_internal',
    CHATFLOW_PREDICTION_EXTERNAL = 'chatflow_prediction_external',

    AGENTFLOW_PREDICTION_INTERNAL = 'agentflow_prediction_internal',
    AGENTFLOW_PREDICTION_EXTERNAL = 'agentflow_prediction_external'
}
