import { UsageTrackingCallbackHandler } from './UsageTrackingCallbackHandler'

/**
 * Tracking context for LLM usage metrics
 */
export interface LLMTrackingContext {
    chatflowId: string
    chatId: string
    sessionId?: string
    chatflowType: string
    userId?: string
    orgId: string
    executionId?: string
}

/**
 * Determine if a component node is an LLM
 * @param node - Component node to check
 * @returns true if node is an LLM/Chat Model
 */
function isLLMNode(node: any): boolean {
    if (!node) return false

    // Check category
    if (node.category === 'Chat Models' || node.category === 'LLMs') {
        return true
    }

    // Check baseClasses for BaseChatModel
    if (node.baseClasses && Array.isArray(node.baseClasses)) {
        return node.baseClasses.includes('BaseChatModel') || node.baseClasses.includes('BaseLanguageModel')
    }

    return false
}

/**
 * Attach tracking callback to an LLM instance
 * @param llm - LLM instance to attach callback to
 * @param context - Tracking context
 * @param nodeData - Node data for the LLM
 */
function attachTrackingCallback(llm: any, context: LLMTrackingContext, nodeData: any): void {
    if (!llm) return

    // Create callback handler
    const handler = new UsageTrackingCallbackHandler(context, nodeData)

    // Attach to LLM callbacks array
    if (llm.callbacks && Array.isArray(llm.callbacks)) {
        // Check if handler already exists (avoid duplicates)
        const hasHandler = llm.callbacks.some((cb: any) => cb.name === 'UsageTrackingCallbackHandler')
        if (!hasHandler) {
            llm.callbacks.push(handler)
        }
    } else {
        llm.callbacks = [handler]
    }
}

/**
 * Create a proxy that automatically tracks all LLM initializations
 *
 * This proxy wraps the componentNodes object and intercepts all LLM node
 * initializations to automatically attach usage tracking callbacks.
 *
 * @param componentNodes - Original component nodes object
 * @param trackingContext - Context for tracking (chatflowId, orgId, etc.)
 * @returns Proxied component nodes with automatic LLM tracking
 *
 * @example
 * ```typescript
 * const trackedNodes = createLLMTrackingProxy(componentNodes, {
 *     chatflowId: chatflow.id,
 *     chatId: chatId,
 *     chatflowType: 'chatflow',
 *     orgId: orgId,
 *     executionId: executionId
 * })
 *
 * // Now all LLM initializations are automatically tracked
 * const llm = await trackedNodes['chatGoogleGenerativeAI'].init(nodeData, '', options)
 * ```
 */
export function createLLMTrackingProxy(componentNodes: any, trackingContext: LLMTrackingContext): any {
    return new Proxy(componentNodes, {
        get(target, nodeName: string | symbol) {
            // Only intercept string property access
            if (typeof nodeName !== 'string') {
                return target[nodeName]
            }

            const originalNode = target[nodeName]

            // Pass through non-LLM nodes unchanged
            if (!isLLMNode(originalNode)) {
                return originalNode
            }

            // Wrap LLM node's init method
            return {
                ...originalNode,
                init: async (nodeData: any, input: string, options: any) => {
                    // Call original init method
                    const llm = await originalNode.init(nodeData, input, options)

                    // Attach tracking callback
                    attachTrackingCallback(llm, trackingContext, nodeData)

                    return llm
                }
            }
        }
    })
}

/**
 * Reattach callbacks to an LLM instance after operations that create new instances
 * (e.g., bindTools() creates a new LLM instance)
 *
 * @param llm - LLM instance to reattach callbacks to
 * @param context - Tracking context
 * @param nodeData - Node data for the LLM
 */
export function reattachTrackingCallback(llm: any, context: LLMTrackingContext, nodeData: any): void {
    attachTrackingCallback(llm, context, nodeData)
}
