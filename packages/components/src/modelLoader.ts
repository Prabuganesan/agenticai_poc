import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import { INodeOptionsValue } from './Interface'

export enum MODEL_TYPE {
    CHAT = 'chat',
    LLM = 'llm',
    EMBEDDING = 'embedding'
}

const getModelsJSONPath = (): string => {
    // Check multiple possible locations for models.json
    // __dirname in compiled code will be dist/src, so we need to go up to find models.json
    const checkModelsPaths = [
        path.join(__dirname, '..', 'models.json'), // dist/models.json (from dist/src)
        path.join(__dirname, '..', '..', 'models.json'), // models.json (from dist/src)
        path.join(__dirname, '..', '..', '..', 'models.json'), // packages/components/models.json (from dist/src)
        path.join(process.cwd(), 'packages', 'components', 'models.json'), // From project root
        path.join(process.cwd(), 'models.json') // From project root
    ]
    for (const checkPath of checkModelsPaths) {
        if (fs.existsSync(checkPath)) {
            return checkPath
        }
    }
    return ''
}

const isValidUrl = (urlString: string) => {
    let url
    try {
        url = new URL(urlString)
    } catch (e) {
        return false
    }
    return url.protocol === 'http:' || url.protocol === 'https:'
}

// Cache for models.json to avoid repeated file reads/network calls
let cachedModels: any = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache

/**
 * Load the raw model file from either a URL or a local file
 * If any of the loading fails, fallback to the default models.json file on disk
 * OPTIMIZED: Always prioritize local file to avoid network delays
 */
const getRawModelFile = async () => {
    // Return cached data if still valid
    if (cachedModels && Date.now() - cacheTimestamp < CACHE_TTL) {
        return cachedModels
    }

    // STEP 1: ALWAYS check local file FIRST (fastest, no network call)
    // This should be the primary source since the file exists in the package
    const localPath = getModelsJSONPath()
    if (localPath && fs.existsSync(localPath)) {
        try {
            const models = await fs.promises.readFile(localPath, 'utf8')
            if (models) {
                const parsed = JSON.parse(models)
                cachedModels = parsed
                cacheTimestamp = Date.now()
                return parsed
            }
        } catch (e) {
            // If reading local file fails, continue to other options
        }
    }

    // STEP 2: Check if MODEL_LIST_CONFIG_JSON env var points to a local file
    const modelFile = process.env.MODEL_LIST_CONFIG_JSON
    //const modelFile = process.env.MODEL_LIST_CONFIG_JSON ?? 'https://raw.githubusercontent.com/FlowiseAI/Flowise/main/packages/components/models.json'

    // If modelFile is a local path (not URL), try to read it
    if (modelFile && !isValidUrl(modelFile) && fs.existsSync(modelFile)) {
        try {
            const models = await fs.promises.readFile(modelFile, 'utf8')
            if (models) {
                const parsed = JSON.parse(models)
                cachedModels = parsed
                cacheTimestamp = Date.now()
                return parsed
            }
        } catch (e) {
            // If reading fails, continue to URL fetch
        }
    }

    // STEP 3: Only fetch from URL if modelFile is provided and is a valid URL
    if (modelFile && isValidUrl(modelFile)) {
        try {
            // Use Promise.race with a very short timeout since URL should respond in ~2 seconds
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout after 3 seconds')), 3000)
            })

            const fetchPromise = axios.get(modelFile, {
                timeout: 3000, // 3 second timeout (URL works in 2s, so 3s is safe)
                validateStatus: (status) => status === 200,
                maxRedirects: 5,
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            })

            const resp = (await Promise.race([fetchPromise, timeoutPromise])) as any
            if (resp && resp.data) {
                cachedModels = resp.data
                cacheTimestamp = Date.now()
                return resp.data
            }
        } catch (fetchError) {
            // If URL fetch fails/times out, fall through to final local file check
        }
    }

    // STEP 4: Final fallback - try local file one more time (in case path resolution failed earlier)
    if (localPath && fs.existsSync(localPath)) {
        try {
            const models = await fs.promises.readFile(localPath, 'utf8')
            if (models) {
                const parsed = JSON.parse(models)
                cachedModels = parsed
                cacheTimestamp = Date.now()
                return parsed
            }
        } catch (e) {
            // Last resort - return empty object
        }
    }

    // If all else fails, return empty object (should never happen if models.json exists)
    return {}
}

const getModelConfig = async (category: MODEL_TYPE, name: string) => {
    const models = await getRawModelFile()

    const categoryModels = models[category]
    return categoryModels.find((model: INodeOptionsValue) => model.name === name)
}

export const getModelConfigByModelName = async (category: MODEL_TYPE, provider: string | undefined, name: string | undefined) => {
    const models = await getRawModelFile()

    const categoryModels = models[category]
    return getSpecificModelFromCategory(categoryModels, provider, name)
}

const getSpecificModelFromCategory = (categoryModels: any, provider: string | undefined, name: string | undefined) => {
    for (const cm of categoryModels) {
        if (cm.models && cm.name.toLowerCase() === provider?.toLowerCase()) {
            for (const m of cm.models) {
                if (m.name === name) {
                    return m
                }
            }
        }
    }
    return undefined
}

export const getModels = async (category: MODEL_TYPE, name: string) => {
    const returnData: INodeOptionsValue[] = []
    try {
        const modelConfig = await getModelConfig(category, name)
        returnData.push(...modelConfig.models)
        return returnData
    } catch (e) {
        throw new Error(`Error: getModels - ${e}`)
    }
}

export const getRegions = async (category: MODEL_TYPE, name: string) => {
    const returnData: INodeOptionsValue[] = []
    try {
        const modelConfig = await getModelConfig(category, name)
        returnData.push(...modelConfig.regions)
        return returnData
    } catch (e) {
        throw new Error(`Error: getRegions - ${e}`)
    }
}
