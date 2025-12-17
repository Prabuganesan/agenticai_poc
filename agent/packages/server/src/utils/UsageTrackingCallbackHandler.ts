import { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import { LLMResult } from '@langchain/core/outputs'
import { trackLLMUsage, extractUsageMetadata, extractProviderAndModel } from './llm-usage-tracker'

export class UsageTrackingCallbackHandler extends BaseCallbackHandler {
    name = 'UsageTrackingCallbackHandler'

    private context: any
    private nodeData: any
    private startTime: number = Date.now()

    constructor(context: any, nodeData: any) {
        super()
        this.context = context
        this.nodeData = nodeData
    }

    async handleLLMStart(llm: any, prompts: string[], runId: string) {
        this.startTime = Date.now()
    }

    async handleChatModelStart(llm: any, messages: any[], runId: string) {
        this.startTime = Date.now()
    }

    async handleLLMEnd(output: LLMResult, runId: string, parentRunId?: string, tags?: string[]) {
        try {
            const { generations, llmOutput } = output

            // Extract usage
            const usage = extractUsageMetadata(output)

            if (usage.totalTokens === 0) {
                console.warn('[UsageTrackingCallbackHandler] Zero tokens extracted, skipping tracking')
                return
            }

            const { provider, model } = extractProviderAndModel(this.nodeData, llmOutput)

            // Determine feature type based on chatflowType
            let feature = 'chatflow' // default
            if (this.context.chatflowType === 'AGENTFLOW') {
                feature = 'agentflow'
            } else if (this.context.chatflowType === 'ASSISTANT') {
                feature = 'assistant'
            }

            // Prepare metadata with legacy fields
            const metadata: any = {
                parentRunId,
                tags,
                generations: generations.length,
                // Add legacy fields that user expects
                category: this.nodeData.category,
                nodeType: this.nodeData.type || this.nodeData.name,
                nodeLabel: this.nodeData.label,
                chatflowType: this.context.chatflowType // Add this to help debug type issues
            }

            // Try to detect streaming and tool calls from output or nodeData
            if (llmOutput) {
                if (typeof llmOutput.streaming !== 'undefined') {
                    metadata.streaming = llmOutput.streaming
                }
            }

            // Check for tool calls in generations
            let hasToolCalls = false
            if (generations && generations.length > 0) {
                const firstGen = generations[0][0] as any
                if (firstGen?.message?.tool_calls?.length > 0 || firstGen?.message?.additional_kwargs?.tool_calls?.length > 0) {
                    hasToolCalls = true
                }
            }
            metadata.hasToolCalls = hasToolCalls

            await trackLLMUsage({
                requestId: runId, // Use runId as requestId for granular tracking
                executionId: this.context.executionId,
                orgId: this.context.orgId,
                userId: this.context.userId || '0',
                chatflowId: this.context.chatflowId,
                chatId: this.context.chatId,
                sessionId: this.context.sessionId,
                feature: feature,
                nodeId: this.nodeData.id,
                nodeType: this.nodeData.type || this.nodeData.category || 'LLM',
                nodeName: this.nodeData.name,
                location: 'node_execution',
                provider: provider,
                model: model,
                requestType: 'chat',
                promptTokens: usage.promptTokens,
                completionTokens: usage.completionTokens,
                totalTokens: usage.totalTokens,
                processingTimeMs: Date.now() - this.startTime,
                success: true,
                metadata: metadata
            })
        } catch (error) {
            console.error('[UsageTrackingCallbackHandler] Error tracking usage:', error)
        }
    }

    async handleLLMError(err: any, runId: string, parentRunId?: string) {
        try {
            const { provider, model } = extractProviderAndModel(this.nodeData)

            await trackLLMUsage({
                requestId: runId,
                executionId: this.context.executionId,
                orgId: this.context.orgId,
                userId: this.context.userId || '0',
                chatflowId: this.context.chatflowId,
                chatId: this.context.chatId,
                sessionId: this.context.sessionId,
                feature: 'chatflow',
                nodeId: this.nodeData.id,
                nodeType: this.nodeData.type || this.nodeData.category || 'LLM',
                nodeName: this.nodeData.name,
                location: 'node_execution',
                provider: provider,
                model: model,
                requestType: 'chat',
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                processingTimeMs: Date.now() - this.startTime,
                success: false,
                errorMessage: err.message,
                metadata: {
                    parentRunId,
                    error: err
                }
            })
        } catch (error) {
            console.error('[UsageTrackingCallbackHandler] Error tracking error usage:', error)
        }
    }
}
