import * as fs from 'fs'
import * as path from 'path'

interface ModelPricing {
    input_cost?: number
    output_cost?: number
}

interface ProviderPricing {
    [modelName: string]: ModelPricing
}

interface PricingData {
    [providerName: string]: ProviderPricing
}

let pricingCache: PricingData | null = null

/**
 * Load pricing data from models.json
 */
function loadPricingData(): PricingData {
    if (pricingCache) {
        return pricingCache
    }

    try {
        const modelsJsonPath = path.join(__dirname, '../../../components/models.json')
        const modelsData = JSON.parse(fs.readFileSync(modelsJsonPath, 'utf-8'))

        const pricing: PricingData = {}

        // Process chat models
        if (modelsData.chat && Array.isArray(modelsData.chat)) {
            for (const provider of modelsData.chat) {
                const providerName = normalizeProviderName(provider.name)
                if (!pricing[providerName]) {
                    pricing[providerName] = {}
                }

                if (provider.models && Array.isArray(provider.models)) {
                    for (const model of provider.models) {
                        if (model.name && (model.input_cost !== undefined || model.output_cost !== undefined)) {
                            pricing[providerName][model.name] = {
                                input_cost: model.input_cost || 0,
                                output_cost: model.output_cost || 0
                            }
                        }
                    }
                }
            }
        }

        // Process embedding models (they typically only have input_cost)
        if (modelsData.embedding && Array.isArray(modelsData.embedding)) {
            for (const provider of modelsData.embedding) {
                const providerName = normalizeProviderName(provider.name)
                if (!pricing[providerName]) {
                    pricing[providerName] = {}
                }

                if (provider.models && Array.isArray(provider.models)) {
                    for (const model of provider.models) {
                        if (model.name) {
                            // Embeddings typically only have input_cost, output_cost is 0
                            pricing[providerName][model.name] = {
                                input_cost: model.input_cost || 0,
                                output_cost: model.output_cost || 0
                            }
                        }
                    }
                }
            }
        }

        pricingCache = pricing
        return pricing
    } catch (error) {
        console.error('Error loading pricing data from models.json:', error)
        return {}
    }
}

/**
 * Normalize provider name to standard format
 */
function normalizeProviderName(providerName: string): string {
    if (!providerName) return 'unknown'

    const normalized = providerName.toLowerCase()

    // Map common provider name variations
    const providerMap: { [key: string]: string } = {
        chatopenai: 'openai',
        openai: 'openai',
        azurechatopenai: 'openai',
        openaiembedding: 'openai',
        openaiembeddings: 'openai',
        chatanthropic: 'anthropic',
        anthropic: 'anthropic',
        chatgooglegenerativeai: 'google',
        googlegenerativeai: 'google',
        googlevertexai: 'google',
        googlevertexaiembedding: 'google',
        googlegenerativeaiembedding: 'google',
        googlegenerativeaiembeddings: 'google',
        awsbedrock: 'aws',
        awschatbedrock: 'aws',
        awsbedrockembedding: 'aws',
        cohere: 'cohere',
        cohereembedding: 'cohere',
        mistralai: 'mistral',
        mistralaiembedding: 'mistral',
        mistralaiembeddings: 'mistral',
        voyageai: 'voyage',
        voyageaiembedding: 'voyage',
        voyageaiembeddings: 'voyage'
    }

    return providerMap[normalized] || normalized
}

/**
 * Normalize model name (remove version suffixes, etc.)
 */
function normalizeModelName(modelName: string): string {
    if (!modelName) return 'unknown'
    return modelName.toLowerCase().trim()
}

/**
 * Calculate cost for LLM usage
 * @param provider Provider name (e.g., 'openai', 'anthropic')
 * @param model Model name (e.g., 'gpt-4', 'claude-3-sonnet')
 * @param promptTokens Number of prompt tokens
 * @param completionTokens Number of completion tokens
 * @param requestType Type of request ('chat', 'embedding', etc.)
 * @returns Calculated cost in USD
 */
export function calculateCost(
    provider: string,
    model: string,
    promptTokens: number,
    completionTokens: number,
    requestType: string = 'chat'
): number {
    try {
        const pricing = loadPricingData()
        const normalizedProvider = normalizeProviderName(provider)
        const normalizedModel = normalizeModelName(model)

        // Try to find exact match first
        let modelPricing = pricing[normalizedProvider]?.[normalizedModel]

        // If not found, try to find by partial match (for models with version suffixes)
        if (!modelPricing && pricing[normalizedProvider]) {
            const modelKeys = Object.keys(pricing[normalizedProvider])
            const matchingKey = modelKeys.find((key) => normalizedModel.includes(key) || key.includes(normalizedModel))
            if (matchingKey) {
                modelPricing = pricing[normalizedProvider][matchingKey]
            }
        }

        // If still not found, try original model name
        if (!modelPricing && pricing[normalizedProvider]) {
            modelPricing = pricing[normalizedProvider][model]
        }

        if (!modelPricing) {
            // No pricing found - return 0 or log warning
            console.warn(`No pricing found for provider: ${normalizedProvider}, model: ${normalizedModel} (original: ${model})`)
            return 0
        }

        const inputCost = modelPricing.input_cost || 0
        const outputCost = modelPricing.output_cost || 0

        // Note: input_cost and output_cost in models.json are already per token
        // (e.g., 0.00003 means $0.00003 per token = $30 per million tokens)
        // So we multiply tokens by the cost per token

        // For embeddings, typically only input tokens are charged
        if (requestType === 'embedding') {
            return promptTokens * inputCost
        }

        // For chat/completion, both input and output tokens are charged
        const promptCost = promptTokens * inputCost
        const completionCost = completionTokens * outputCost

        return promptCost + completionCost
    } catch (error) {
        console.error('Error calculating cost:', error)
        return 0
    }
}

/**
 * Get pricing for a specific provider and model
 */
export function getPricing(provider: string, model: string): ModelPricing | null {
    try {
        const pricing = loadPricingData()
        const normalizedProvider = normalizeProviderName(provider)
        const normalizedModel = normalizeModelName(model)

        return pricing[normalizedProvider]?.[normalizedModel] || null
    } catch (error) {
        console.error('Error getting pricing:', error)
        return null
    }
}

/**
 * Clear pricing cache (useful for testing or reloading)
 */
export function clearPricingCache(): void {
    pricingCache = null
}
