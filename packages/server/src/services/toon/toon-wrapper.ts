import { logError, logInfo, logDebug } from '../../utils/logger/system-helper'

// Dynamic import for ES Module support
let toonModule: { encode: (data: any) => string; decode: (data: string) => any } | null = null

/**
 * Lazy load the TOON module using dynamic import (required for ES modules)
 */
async function getToonModule() {
    if (!toonModule) {
        toonModule = await import('@toon-format/toon')
    }
    return toonModule
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
}

/**
 * TOON Format Limitations and Best Practices:
 * 
 * ⚠️ IMPORTANT: TOON format is ONLY effective for structured data (JSON objects/arrays)
 * 
 * ✅ TOON CAN HELP with:
 * - Structured JSON responses from LLMs
 * - Tool outputs that return JSON objects/arrays
 * - API responses in JSON format
 * - Data with repetitive structure (arrays of similar objects)
 * 
 * ❌ TOON CANNOT HELP with:
 * - Plain text questions/inputs
 * - PDF content (extracted as plain text)
 * - Unstructured text content
 * - Simple strings
 * 
 * Why? TOON compresses JSON syntax (quotes, brackets, commas), not text content.
 * Wrapping plain text in JSON and encoding actually INCREASES token count.
 * 
 * Expected behavior:
 * - Plain text inputs → Skipped (no token reduction, but no increase)
 * - Structured data → Encoded only if it reduces tokens
 */

/**
 * Pre-process input to TOON format
 * TOON format is ONLY effective for structured data (JSON objects/arrays)
 * For plain text strings, TOON will INCREASE token count, so we skip it
 * 
 * @param input - The input (can be string, object, or any value)
 * @returns TOON formatted string (only for structured data), or original input for plain text
 */
export const toonPreProcess = async (input: any) => {
    try {
        const inputType = typeof input
        const isArray = Array.isArray(input)
        const inputPreview = typeof input === 'string' 
            ? (input.length > 100 ? input.substring(0, 100) + '...' : input)
            : (isArray ? `Array[${input.length}]` : 'Object')
        
        logInfo(`[TOON] Pre-processing input - Type: ${inputType}${isArray ? ' (Array)' : ''}, Preview: ${inputPreview.substring(0, 200)}`).catch(() => { })
        
        // TOON format is designed for structured data, not plain text
        // For plain text strings, TOON encoding actually INCREASES token count
        // because it wraps the text in { text: "..." } and adds overhead
        
        if (typeof input === 'string') {
            const originalLength = input.length
            const originalTokens = estimateTokens(input)
            
            // Check if it's a JSON string that should be encoded
            try {
                const parsed = JSON.parse(input)
                // If it's valid JSON (object or array), encode it
                if (typeof parsed === 'object' && parsed !== null) {
                    const originalJson = JSON.stringify(parsed)
                    const originalJsonLength = originalJson.length
                    const originalJsonTokens = estimateTokens(originalJson)
                    
                    const { encode } = await getToonModule()
                    const toonEncoded = encode(parsed)
                    const toonLength = toonEncoded.length
                    const toonTokens = estimateTokens(toonEncoded)
                    
                    const charReduction = originalJsonLength - toonLength
                    const tokenReduction = originalJsonTokens - toonTokens
                    const reductionPercent = ((charReduction / originalJsonLength) * 100).toFixed(2)
                    
                    logInfo(`[TOON] ✅ JSON string detected - Original: ${originalJsonLength} chars (${originalJsonTokens} tokens) → TOON: ${toonLength} chars (${toonTokens} tokens) - Saved: ${charReduction} chars (${tokenReduction} tokens, ${reductionPercent}%)`).catch(() => { })
                    
                    if (tokenReduction > 0) {
                        return toonEncoded
                    } else {
                        logInfo(`[TOON] ⚠️ TOON would increase tokens (${originalJsonTokens} → ${toonTokens}), using original JSON`).catch(() => { })
                        return input
                    }
                }
            } catch (parseError) {
                // Not valid JSON, it's plain text - don't use TOON
                logInfo(`[TOON] ❌ Plain text detected (${originalLength} chars, ~${originalTokens} tokens) - TOON not effective for plain text, skipping encoding`).catch(() => { })
                return input // Return original plain text
            }
        } else if (typeof input === 'object' && input !== null) {
            // For structured data (objects/arrays), TOON can help
            const originalJson = JSON.stringify(input)
            const originalJsonLength = originalJson.length
            const originalJsonTokens = estimateTokens(originalJson)
            
            const { encode } = await getToonModule()
            const toonEncoded = encode(input)
            const toonLength = toonEncoded.length
            const toonTokens = estimateTokens(toonEncoded)
            
            const charReduction = originalJsonLength - toonLength
            const tokenReduction = originalJsonTokens - toonTokens
            const reductionPercent = ((charReduction / originalJsonLength) * 100).toFixed(2)
            
            logInfo(`[TOON] 📊 Structured data - Original: ${originalJsonLength} chars (${originalJsonTokens} tokens) → TOON: ${toonLength} chars (${toonTokens} tokens) - Difference: ${charReduction > 0 ? '+' : ''}${charReduction} chars (${tokenReduction > 0 ? '+' : ''}${tokenReduction} tokens, ${reductionPercent}%)`).catch(() => { })
            
            if (tokenReduction > 0) {
                logInfo(`[TOON] ✅ Using TOON encoding - Estimated token savings: ${tokenReduction} tokens (${reductionPercent}%)`).catch(() => { })
                return toonEncoded
            } else {
                logInfo(`[TOON] ⚠️ TOON would increase tokens (${originalJsonTokens} → ${toonTokens}), using original`).catch(() => { })
                return input // TOON doesn't help, use original
            }
        } else {
            // For primitives, TOON doesn't help
            logInfo(`[TOON] ❌ Primitive type (${inputType}) - TOON not effective, skipping`).catch(() => { })
            return input
        }
    } catch (error) {
        logError('[TOON] Pre-process failed:', error).catch(() => { })
        return input // Fallback to original input
    }
}

/**
 * Post-process TOON output back to JSON
 * The LLM might return data in TOON format, or it might return regular text/JSON
 * 
 * @param llmJsonOutput - The output from LLM (potentially in TOON format)
 * @returns Parsed JSON object or original output if conversion fails
 */
export const toonPostProcess = async (llmJsonOutput: any) => {
    try {
        const outputType = typeof llmJsonOutput
        const outputPreview = typeof llmJsonOutput === 'string' 
            ? (llmJsonOutput.length > 100 ? llmJsonOutput.substring(0, 100) + '...' : llmJsonOutput)
            : 'Object/Array'
        
        logInfo(`[TOON] Post-processing output - Type: ${outputType}, Length: ${typeof llmJsonOutput === 'string' ? llmJsonOutput.length : 'N/A'}, Preview: ${outputPreview.substring(0, 200)}`).catch(() => { })
        
        // If it's already an object, return it
        if (typeof llmJsonOutput === 'object' && llmJsonOutput !== null) {
            logInfo('[TOON] ✅ Output is already an object, returning as-is').catch(() => { })
            return llmJsonOutput
        }

        // If it's a string, check if it contains TOON format
        if (typeof llmJsonOutput === 'string') {
            const outputLength = llmJsonOutput.length
            
            // Check if the output contains TOON format markers
            const toonMarker = /\[TOON FORMAT\]|TOON Data:|\[END TOON FORMAT\]/i
            if (toonMarker.test(llmJsonOutput)) {
                logInfo(`[TOON] 🔍 Found TOON format markers in output (${outputLength} chars)`).catch(() => { })
                
                // Extract TOON data from the response
                const toonDataMatch = llmJsonOutput.match(/TOON Data:\s*([^\n]+)/i)
                if (toonDataMatch && toonDataMatch[1]) {
                    try {
                        const toonData = toonDataMatch[1].trim()
                        logInfo(`[TOON] Extracting TOON data: ${toonData.substring(0, 100)}...`).catch(() => { })
                        
                        const { decode } = await getToonModule()
                        const decoded = decode(toonData)
                        logInfo(`[TOON] ✅ Successfully decoded TOON format output from LLM`).catch(() => { })
                        
                        // If the decoded object has a 'text' property (from string input), extract it
                        if (decoded && typeof decoded === 'object' && 'text' in decoded && Object.keys(decoded).length === 1) {
                            logInfo(`[TOON] Extracted 'text' property from decoded object`).catch(() => { })
                            return decoded.text
                        }
                        
                        // If the decoded object has a 'value' property (from primitive input), extract it
                        if (decoded && typeof decoded === 'object' && 'value' in decoded && Object.keys(decoded).length === 1) {
                            logInfo(`[TOON] Extracted 'value' property from decoded object`).catch(() => { })
                            return decoded.value
                        }
                        
                        // Otherwise return the full decoded object
                        logInfo(`[TOON] Returning full decoded object`).catch(() => { })
                        return decoded
                    } catch (decodeError) {
                        logError('[TOON] ❌ Failed to decode TOON data from LLM output:', decodeError).catch(() => { })
                    }
                }
            }
            
            // Try to decode the entire string as TOON (in case LLM returned pure TOON)
            try {
                logInfo(`[TOON] 🔍 Attempting to decode entire output as TOON (${outputLength} chars)`).catch(() => { })
                const { decode } = await getToonModule()
                const decoded = decode(llmJsonOutput)
                logInfo(`[TOON] ✅ Successfully decoded entire output as TOON format`).catch(() => { })
                
                // If the decoded object has a 'text' property (from string input), extract it
                if (decoded && typeof decoded === 'object' && 'text' in decoded && Object.keys(decoded).length === 1) {
                    logInfo(`[TOON] Extracted 'text' property from decoded object`).catch(() => { })
                    return decoded.text
                }
                
                // If the decoded object has a 'value' property (from primitive input), extract it
                if (decoded && typeof decoded === 'object' && 'value' in decoded && Object.keys(decoded).length === 1) {
                    logInfo(`[TOON] Extracted 'value' property from decoded object`).catch(() => { })
                    return decoded.value
                }
                
                // Otherwise return the full decoded object
                logInfo(`[TOON] Returning full decoded object`).catch(() => { })
                return decoded
            } catch (decodeError) {
                // Not in TOON format, return original string
                logInfo(`[TOON] ❌ Output is not in TOON format (decode failed), returning original string`).catch(() => { })
                return llmJsonOutput
            }
        }

        logInfo(`[TOON] Returning output as-is (type: ${outputType})`).catch(() => { })
        return llmJsonOutput
    } catch (error) {
        logError('[TOON] ❌ Post-process failed:', error).catch(() => { })
        // It might not be in TOON format, or might be a simple string
        return llmJsonOutput // Fallback to original output
    }
}
