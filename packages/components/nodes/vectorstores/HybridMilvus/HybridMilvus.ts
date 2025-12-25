import { DataType, ErrorCode, MetricType, IndexType } from '@zilliz/milvus2-sdk-node'
import { Document } from '@langchain/core/documents'
import { MilvusLibArgs, Milvus } from '@langchain/community/vectorstores/milvus'
import { Embeddings } from '@langchain/core/embeddings'
import { BaseRetriever } from '@langchain/core/retrievers'
import { ICommonObject, INode, INodeData, INodeOutputsValue, INodeParams } from '../../../src/Interface'
import { KODIVIAN_CHATID, getBaseClasses, getCredentialData, getCredentialParam } from '../../../src/utils'
import { howToUseFileUpload } from '../VectorStoreUtils'
import { MilvusClient } from '@zilliz/milvus2-sdk-node'

interface InsertRow {
    [x: string]: string | number[]
}

const checkJsonString = (value: string): { isJson: boolean; obj: any } => {
    try {
        const result = JSON.parse(value)
        return { isJson: true, obj: result }
    } catch (e) {
        return { isJson: false, obj: null }
    }
}

/**
 * Custom Hybrid Milvus Retriever that implements scalar/semantic query logic
 */
class HybridMilvusRetriever extends BaseRetriever {
    lc_namespace = ['kodivian', 'vectorstores', 'hybridmilvus']

    private milvusClient: MilvusClient
    private collectionName: string
    private vectorField: string
    private textField: string
    private embeddings: Embeddings
    private embeddingEndpoint?: string
    private defaultOutputFields: string[]
    private metricType: string
    private k: number
    private milvusFilter?: string
    private vectorStore?: Milvus
    private fields: string[] = []
    private primaryField?: string
    private queryType: string

    constructor(config: {
        milvusClient: MilvusClient
        collectionName: string
        vectorField: string
        textField: string
        embeddings: Embeddings
        embeddingEndpoint?: string
        defaultOutputFields: string[]
        metricType: string
        k: number
        milvusFilter?: string
        vectorStore?: Milvus
        queryType?: string
    }) {
        super()
        this.milvusClient = config.milvusClient
        this.collectionName = config.collectionName
        this.vectorField = config.vectorField
        this.textField = config.textField
        this.embeddings = config.embeddings
        this.embeddingEndpoint = config.embeddingEndpoint
        this.defaultOutputFields = config.defaultOutputFields
        this.metricType = config.metricType
        this.k = config.k
        this.milvusFilter = config.milvusFilter
        this.vectorStore = config.vectorStore
        this.queryType = config.queryType || 'auto'
    }

    async _getRelevantDocuments(query: string): Promise<Document[]> {
        // Discover fields if not already done
        if (this.vectorStore && this.fields.length === 0) {
            await this.vectorStore.grabCollectionFields()
            this.fields = this.vectorStore.fields || []
            this.primaryField = this.vectorStore.primaryField
        }

        // Determine query type based on parameter (or auto-detect if auto)
        let useScalar = false
        if (this.queryType === 'scalar') {
            useScalar = true
        } else if (this.queryType === 'auto') {
            // Auto-detect: check if query is a counting/list query (scalar) vs semantic search
            useScalar = this.isScalarQuery(query)
        } else {
            // Default to semantic for explicit semantic queries
            useScalar = false
        }

        if (useScalar) {
            // Check if this is a counting query
            const isCount = this.isCountQuery(query)

            // Extract filter from query - try to parse natural language to Milvus filter
            const filter = this.extractFilter(query)

            // For scalar queries without filters (e.g., "list all employees", "how many employees"),
            // we can still query all records up to the limit
            const combinedFilter = filter
                ? this.milvusFilter
                    ? `(${this.milvusFilter}) AND (${filter})`
                    : filter
                : this.milvusFilter || undefined

            // Execute scalar query
            try {
                const hasColResp = await this.milvusClient.hasCollection({
                    collection_name: this.collectionName
                })
                if (hasColResp.status.error_code !== ErrorCode.SUCCESS || !hasColResp.value) {
                    throw new Error(`Collection not found: ${this.collectionName}`)
                }

                const loadResp = await this.milvusClient.loadCollectionSync({
                    collection_name: this.collectionName
                })
                if (loadResp.error_code !== ErrorCode.SUCCESS) {
                    throw new Error(`Error loading collection: ${loadResp}`)
                }

                // For counting queries, get the actual count
                if (isCount) {
                    // Use query with limit 1 to get count, or use getCollectionStats if available
                    // Since Milvus query returns data, we'll query with a high limit to count
                    // For better performance, we could use getCollectionStats, but query works too
                    const queryParams: any = {
                        collection_name: this.collectionName,
                        output_fields: ['id'], // Only need id for counting
                        limit: 16384 // Milvus max limit for counting
                    }

                    if (combinedFilter) {
                        queryParams.filter = combinedFilter
                    }

                    const results = await this.milvusClient.query(queryParams)
                    const count = results?.data?.length || 0

                    // Return a special document with the count information
                    // Format it in a natural language way that the LLM can easily understand
                    // Make it explicit that this is the answer to a "how many" question
                    const countText = combinedFilter
                        ? `Answer: There are ${count} records that match the specified criteria.`
                        : `Answer: There are ${count} total records.`

                    const countDoc = new Document({
                        pageContent: countText,
                        metadata: {
                            _queryType: 'scalar',
                            _isCount: true,
                            _count: count,
                            _filter: combinedFilter || null
                        }
                    })

                    return [countDoc]
                }

                // For list queries, return documents as usual
                // Only return id and documentText to minimize token usage (vector not needed for AI)
                const outputFields = [this.textField, 'id'].filter((field) => field !== this.vectorField)

                // Query with or without filter (for list/count queries without filters)
                // Request more than k to account for potential duplicates, then deduplicate
                const queryParams: any = {
                    collection_name: this.collectionName,
                    output_fields: outputFields,
                    limit: Math.max(this.k * 2, 100) // Request more to account for duplicates
                }

                if (combinedFilter) {
                    queryParams.filter = combinedFilter
                }

                const results = await this.milvusClient.query(queryParams)

                // Deduplicate by id to ensure unique results
                const seenIds = new Set<string>()
                const uniqueResults: any[] = []
                for (const result of results?.data || []) {
                    const id = result.id || result[this.primaryField || 'id']
                    if (id && !seenIds.has(String(id))) {
                        seenIds.add(String(id))
                        uniqueResults.push(result)
                        // Stop once we have k unique results
                        if (uniqueResults.length >= this.k) {
                            break
                        }
                    }
                }

                return this.formatResults(uniqueResults, true)
            } catch (error: any) {
                // If scalar query fails, fall back to semantic (if embeddings available)
                console.warn('Scalar query failed, attempting semantic fallback:', error.message)
                if (this.embeddings && typeof this.embeddings.embedQuery === 'function') {
                    return await this.semanticSearch(query)
                } else {
                    throw new Error(`Scalar query failed: ${error.message}. Cannot fall back to semantic search: embeddings not available`)
                }
            }
        } else {
            // Semantic search
            return await this.semanticSearch(query)
        }
    }

    private async semanticSearch(query: string): Promise<Document[]> {
        // Validate embeddings before attempting semantic search
        if (!this.embeddings || typeof this.embeddings.embedQuery !== 'function') {
            throw new Error(
                'Embeddings object is required for semantic search but is not available or embedQuery method is not a function. Please ensure embeddings are properly configured.'
            )
        }

        try {
            const vector = await this.getEmbedding(query)

            const hasColResp = await this.milvusClient.hasCollection({
                collection_name: this.collectionName
            })
            if (hasColResp.status.error_code !== ErrorCode.SUCCESS || !hasColResp.value) {
                throw new Error(`Collection not found: ${this.collectionName}`)
            }

            const loadResp = await this.milvusClient.loadCollectionSync({
                collection_name: this.collectionName
            })
            if (loadResp.error_code !== ErrorCode.SUCCESS) {
                throw new Error(`Error loading collection: ${loadResp}`)
            }

            // Only return id and documentText to minimize token usage (vector not needed for AI)
            const outputFields = [this.textField, 'id'].filter((field) => field !== this.vectorField)

            // Use metric type from vector store if available
            const metricType = this.vectorStore?.indexCreateParams?.metric_type || this.metricType

            const search_params: any = {
                anns_field: this.vectorField,
                topk: this.k.toString(),
                metric_type: metricType,
                params: JSON.stringify(this.vectorStore?.indexSearchParams || {})
            }

            const searchResp = await this.milvusClient.search({
                collection_name: this.collectionName,
                search_params,
                output_fields: outputFields,
                vector_type: DataType.FloatVector,
                vectors: [vector],
                filter: this.milvusFilter
            })

            if (searchResp.status.error_code !== ErrorCode.SUCCESS) {
                throw new Error(`Error searching data: ${JSON.stringify(searchResp)}`)
            }

            // Format results with proper score normalization
            const results: [Document, number][] = []
            if (searchResp.results && Array.isArray(searchResp.results)) {
                searchResp.results.forEach((result: any) => {
                    const fields = {
                        pageContent: '',
                        metadata: {} as Record<string, any>
                    }

                    // Only keep id and documentText (textField) - exclude vector and other fields to minimize tokens
                    Object.keys(result).forEach((key) => {
                        if (key === this.textField) {
                            fields.pageContent = result[key]
                        } else if (key === 'id' || key === this.primaryField) {
                            // Only include id in metadata
                            if (typeof result[key] === 'string') {
                                const { isJson, obj } = checkJsonString(result[key])
                                fields.metadata[key] = isJson ? obj : result[key]
                            } else {
                                fields.metadata[key] = result[key]
                            }
                        }
                        // Explicitly exclude vector field and other fields to save tokens
                    })

                    // If no pageContent found, use id as fallback
                    if (!fields.pageContent) {
                        fields.pageContent = result[this.textField] || result['id'] || JSON.stringify({ id: result['id'] })
                    }

                    // Normalize score based on metric type
                    let normalizedScore = result.score || 0
                    switch (metricType) {
                        case MetricType.L2:
                            normalizedScore = 1 / (1 + result.score)
                            break
                        case MetricType.IP:
                        case MetricType.COSINE:
                            normalizedScore = (result.score + 1) / 2
                            break
                    }

                    // Add query type metadata
                    fields.metadata._queryType = 'semantic'
                    fields.metadata._score = normalizedScore

                    results.push([new Document(fields), normalizedScore])
                })
            }

            // Return just Documents (BaseRetriever expects Document[])
            return results.map(([doc]) => doc)
        } catch (error: any) {
            throw new Error(`Semantic search failed: ${error.message}`)
        }
    }

    private formatResults(results: any[], isScalar: boolean): Document[] {
        const documents: Document[] = []

        for (const result of results) {
            const fields: any = {
                pageContent: '',
                metadata: {} as Record<string, any>
            }

            // Only keep id and documentText (textField) - exclude vector and other fields to minimize tokens
            Object.keys(result).forEach((key) => {
                if (key === this.textField) {
                    fields.pageContent = result[key]
                } else if (key === 'id' || key === this.primaryField) {
                    // Only include id in metadata
                    if (typeof result[key] === 'string') {
                        const { isJson, obj } = checkJsonString(result[key])
                        fields.metadata[key] = isJson ? obj : result[key]
                    } else {
                        fields.metadata[key] = result[key]
                    }
                }
                // Explicitly exclude vector field and other fields to save tokens
            })

            // If no pageContent found, use id as fallback
            if (!fields.pageContent) {
                fields.pageContent = result[this.textField] || result['id'] || JSON.stringify({ id: result['id'] })
            }

            // Add query type metadata
            fields.metadata._queryType = isScalar ? 'scalar' : 'semantic'

            documents.push(new Document(fields))
        }

        return documents
    }

    private isScalarQuery(query: string): boolean {
        // Heuristic: check for structured query patterns
        const scalarKeywords = [
            'list',
            'show',
            'find all',
            'how many',
            'count',
            'number of',
            'total',
            'where',
            'filter',
            'department',
            'leavetype',
            '==',
            '!=',
            '>',
            '<',
            '>=',
            '<='
        ]
        const lowerQuery = query.toLowerCase()
        return scalarKeywords.some((keyword) => lowerQuery.includes(keyword))
    }

    private isCountQuery(query: string): boolean {
        // Detect counting queries that need actual count, not just documents
        const countKeywords = ['how many', 'count', 'number of', 'total']
        const lowerQuery = query.toLowerCase()
        return countKeywords.some((keyword) => lowerQuery.includes(keyword))
    }

    private extractFilter(query: string): string | null {
        // Simple extraction - in production, you might want to use LLM for this
        // Examples:
        // "list employees in HR" -> 'department == "HR"'
        // "show all leave requests for January" -> 'leavetype == "Annual" AND month == "January"'

        const lowerQuery = query.toLowerCase()

        // Extract department
        const deptMatch = query.match(/department\s*(?:is|==|=)\s*["']?(\w+)["']?/i) || query.match(/(?:in|from)\s+(\w+)/i)
        if (deptMatch) {
            return `department == "${deptMatch[1]}"`
        }

        // Extract leave type
        const leaveMatch = query.match(/leave\s*(?:type|kind)\s*(?:is|==|=)\s*["']?(\w+)["']?/i) || query.match(/(\w+)\s+leave/i)
        if (leaveMatch) {
            return `leavetype == "${leaveMatch[1]}"`
        }

        // If query contains explicit filter syntax, extract it
        const filterMatch = query.match(/(\w+)\s*(==|!=|>|<|>=|<=)\s*["']?([^"']+)["']?/i)
        if (filterMatch) {
            return `${filterMatch[1]} ${filterMatch[2]} "${filterMatch[3]}"`
        }

        return null
    }

    private async getEmbedding(text: string): Promise<number[]> {
        if (this.embeddingEndpoint) {
            try {
                const res = await fetch(this.embeddingEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ input: text })
                })
                if (!res.ok) throw new Error(`Embedding endpoint error: ${res.status}`)
                const data = await res.json()
                const vector = data?.vector || data?.data || data?.embedding
                if (!Array.isArray(vector)) throw new Error('Invalid embedding payload. Expected array "vector".')
                return vector as number[]
            } catch (error: any) {
                console.warn('Embedding endpoint failed, using embeddings object:', error.message)
                // Fall back to embeddings object
                if (!this.embeddings || typeof this.embeddings.embedQuery !== 'function') {
                    throw new Error('Embeddings object is not available or embedQuery method is not a function')
                }
                return await this.embeddings.embedQuery(text)
            }
        }
        if (!this.embeddings || typeof this.embeddings.embedQuery !== 'function') {
            throw new Error('Embeddings object is required for semantic search but is not available or embedQuery method is not a function')
        }
        return await this.embeddings.embedQuery(text)
    }
}

class HybridMilvusUpsert extends Milvus {
    async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
        if (vectors.length === 0) {
            return
        }
        await this.ensureCollection(vectors, documents)

        const insertDatas: InsertRow[] = []

        for (let index = 0; index < vectors.length; index++) {
            const vec = vectors[index]
            const doc = documents[index]
            const data: InsertRow = {
                [this.textField]: doc.pageContent,
                [this.vectorField]: vec
            }
            this.fields.forEach((field) => {
                switch (field) {
                    case this.primaryField:
                        if (!this.autoId) {
                            if (doc.metadata[this.primaryField] === undefined) {
                                throw new Error(
                                    `The Collection's primaryField is configured with autoId=false, thus its value must be provided through metadata.`
                                )
                            }
                            data[field] = doc.metadata[this.primaryField]
                        }
                        break
                    case this.textField:
                        data[field] = doc.pageContent
                        break
                    case this.vectorField:
                        data[field] = vec
                        break
                    default: // metadata fields
                        if (doc.metadata[field] === undefined) {
                            throw new Error(`The field "${field}" is not provided in documents[${index}].metadata.`)
                        } else if (typeof doc.metadata[field] === 'object') {
                            data[field] = JSON.stringify(doc.metadata[field])
                        } else {
                            data[field] = doc.metadata[field]
                        }
                        break
                }
            })

            insertDatas.push(data)
        }

        const descIndexResp = await this.client.describeIndex({
            collection_name: this.collectionName
        })

        if (descIndexResp.status.error_code === ErrorCode.IndexNotExist) {
            const resp = await this.client.createIndex({
                collection_name: this.collectionName,
                field_name: this.vectorField,
                index_name: `myindex_${Date.now().toString()}`,
                index_type: IndexType.AUTOINDEX,
                metric_type: MetricType.L2
            })
            if (resp.error_code !== ErrorCode.SUCCESS) {
                throw new Error(`Error creating index`)
            }
        }

        const insertResp = await this.client.insert({
            collection_name: this.collectionName,
            fields_data: insertDatas
        })

        if (insertResp.status.error_code !== ErrorCode.SUCCESS) {
            throw new Error(`Error inserting data: ${JSON.stringify(insertResp)}`)
        }

        await this.client.flushSync({ collection_names: [this.collectionName] })
    }
}

class HybridMilvus_VectorStores implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    badge: string
    baseClasses: string[]
    inputs: INodeParams[]
    credential: INodeParams
    outputs: INodeOutputsValue[]

    constructor() {
        this.label = 'Hybrid Milvus'
        this.name = 'hybridMilvus'
        this.version = 1.0
        this.type = 'HybridMilvus'
        this.icon = 'milvus.svg'
        this.category = 'Vector Stores'
        this.badge = 'NEW'
        this.description = `Hybrid scalar/semantic query vector store for Milvus. Automatically detects structured queries (scalar) vs natural language queries (semantic) and uses the appropriate query method.`
        this.baseClasses = [this.type, 'VectorStoreRetriever', 'BaseRetriever']
        this.credential = {
            label: 'Connect Credential',
            name: 'credential',
            type: 'credential',
            optional: true,
            credentialNames: ['milvusAuth']
        }
        this.inputs = [
            {
                label: 'Document',
                name: 'document',
                type: 'Document',
                list: true,
                optional: true
            },
            {
                label: 'Embeddings',
                name: 'embeddings',
                type: 'Embeddings'
            },
            {
                label: 'Milvus Server URL',
                name: 'milvusServerUrl',
                type: 'string',
                placeholder: 'http://localhost:19530'
            },
            {
                label: 'Milvus Collection Name',
                name: 'milvusCollection',
                type: 'string'
            },
            {
                label: 'Milvus Partition Name',
                name: 'milvusPartition',
                default: '_default',
                type: 'string',
                optional: true
            },
            {
                label: 'File Upload',
                name: 'fileUpload',
                description: 'Allow file upload on the chat',
                hint: {
                    label: 'How to use',
                    value: howToUseFileUpload
                },
                type: 'boolean',
                additionalParams: true,
                optional: true
            },
            {
                label: 'Milvus Text Field',
                name: 'milvusTextField',
                type: 'string',
                default: 'documentText',
                placeholder: 'documentText',
                optional: true,
                description: 'Name of the text field containing document summaries. Default: documentText (hardcoded standard)',
                additionalParams: true
            },
            {
                label: 'Milvus Filter',
                name: 'milvusFilter',
                type: 'string',
                optional: true,
                description:
                    'Filter data with a simple string query. Refer Milvus <a target="_blank" href="https://milvus.io/blog/2022-08-08-How-to-use-string-data-to-empower-your-similarity-search-applications.md#Hybrid-search">docs</a> for more details.',
                placeholder: 'department == "HR"',
                additionalParams: true,
                acceptVariable: true
            },
            {
                label: 'Top K',
                name: 'topK',
                description: 'Number of top results to fetch. Default to 4',
                placeholder: '4',
                type: 'number',
                additionalParams: true,
                optional: true
            },
            {
                label: 'Vector Field Name',
                name: 'vectorField',
                type: 'string',
                default: 'vector',
                optional: true,
                description: 'Name of the vector field in Milvus collection. Default: vector (hardcoded standard)',
                additionalParams: true
            },
            {
                label: 'Query Type',
                name: 'queryType',
                type: 'options',
                default: 'auto',
                options: [
                    {
                        label: 'Auto',
                        name: 'auto',
                        description: 'Auto-detect query type: scalar for counting/list queries, semantic for natural language'
                    },
                    { label: 'Semantic', name: 'semantic', description: 'Use vector search for natural language queries' },
                    { label: 'Scalar', name: 'scalar', description: 'Use direct Milvus query for structured queries' }
                ],
                description: 'Query type - auto detects counting/list queries (scalar) vs semantic search. Default: auto',
                additionalParams: true,
                optional: true
            },
            {
                label: 'Output Fields (CSV)',
                name: 'outputFieldsCsv',
                type: 'string',
                default: 'name,department,leavetype',
                description:
                    'Comma-separated list of fields to return from Milvus. If collection fields are discovered automatically, this is used as fallback.',
                additionalParams: true,
                optional: true
            },
            {
                label: 'Metric Type',
                name: 'metricType',
                type: 'options',
                default: 'COSINE',
                options: [
                    { label: 'COSINE', name: 'COSINE' },
                    { label: 'L2', name: 'L2' },
                    { label: 'IP', name: 'IP' }
                ],
                description: 'Distance metric for vector search. If collection index exists, its metric type will be used instead.',
                additionalParams: true,
                optional: true
            },
            {
                label: 'Embedding Endpoint (POST)',
                name: 'embeddingEndpoint',
                type: 'string',
                optional: true,
                description:
                    'Optional external embedding endpoint. POSTs {input: string} and expects {vector: number[]}. If not provided, uses Embeddings object.',
                additionalParams: true
            },
            {
                label: 'Secure',
                name: 'secure',
                type: 'boolean',
                optional: true,
                description: 'Enable secure connection to Milvus server',
                additionalParams: true
            },
            {
                label: 'Client PEM Path',
                name: 'clientPemPath',
                type: 'string',
                optional: true,
                description: 'Path to the client PEM file',
                additionalParams: true
            },
            {
                label: 'Client Key Path',
                name: 'clientKeyPath',
                type: 'string',
                optional: true,
                description: 'Path to the client key file',
                additionalParams: true
            },
            {
                label: 'CA PEM Path',
                name: 'caPemPath',
                type: 'string',
                optional: true,
                description: 'Path to the root PEM file',
                additionalParams: true
            },
            {
                label: 'Server Name',
                name: 'serverName',
                type: 'string',
                optional: true,
                description: 'Server name for the secure connection',
                additionalParams: true
            }
        ]
        this.outputs = [
            {
                label: 'Hybrid Milvus Retriever',
                name: 'retriever',
                baseClasses: this.baseClasses
            },
            {
                label: 'Hybrid Milvus Vector Store',
                name: 'vectorStore',
                baseClasses: [this.type, ...getBaseClasses(Milvus)]
            }
        ]
    }

    async init(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        // server setup
        let address = nodeData.inputs?.milvusServerUrl as string
        // Extract host:port from URL if it contains http:// or https://
        if (address && (address.startsWith('http://') || address.startsWith('https://'))) {
            try {
                const url = new URL(address)
                address = `${url.hostname}:${url.port || '19530'}`
            } catch (e) {
                // If URL parsing fails, try to extract manually
                address = address.replace(/^https?:\/\//, '').replace(/\/$/, '')
                // Ensure port is included if missing
                if (!address.includes(':')) {
                    address = `${address}:19530`
                }
            }
        }
        const collectionName = nodeData.inputs?.milvusCollection as string
        const _milvusFilter = nodeData.inputs?.milvusFilter as string
        const textField = nodeData.inputs?.milvusTextField as string
        const isFileUploadEnabled = nodeData.inputs?.fileUpload as boolean

        // embeddings
        const embeddings = nodeData.inputs?.embeddings as Embeddings
        const topK = nodeData.inputs?.topK as string

        // output
        const output = nodeData.outputs?.output as string

        // format data
        const k = topK ? parseFloat(topK) : 4

        // credential
        const credentialData = await getCredentialData(nodeData.credential ?? '', options)
        const milvusUser = getCredentialParam('milvusUser', credentialData, nodeData)
        const milvusPassword = getCredentialParam('milvusPassword', credentialData, nodeData)

        // Additional params with hardcoded standard defaults
        const vectorField = (nodeData.inputs?.vectorField as string) || 'vector' // hardcoded standard
        const textFieldDefault = textField || 'documentText' // hardcoded standard
        const outputFieldsCsv = (nodeData.inputs?.outputFieldsCsv as string) || ''
        const metricType = (nodeData.inputs?.metricType as string) || 'COSINE'
        const embeddingEndpoint = nodeData.inputs?.embeddingEndpoint as string | undefined
        const queryType = (nodeData.inputs?.queryType as string) || 'auto'

        // Parse output fields and ensure documentText is always included
        let defaultOutputFields = outputFieldsCsv
            .split(',')
            .map((s) => s.trim())
            .filter((s) => !!s)

        // Always include documentText (hardcoded standard field)
        if (!defaultOutputFields.includes(textFieldDefault)) {
            defaultOutputFields = [textFieldDefault, ...defaultOutputFields]
        }

        // tls
        const secure = nodeData.inputs?.secure as boolean
        const clientPemPath = nodeData.inputs?.clientPemPath as string
        const clientKeyPath = nodeData.inputs?.clientKeyPath as string
        const caPemPath = nodeData.inputs?.caPemPath as string
        const serverName = nodeData.inputs?.serverName as string

        // partition
        const partitionName = nodeData.inputs?.milvusPartition ?? '_default'

        // init MilvusLibArgs with hardcoded standard fields
        const milVusArgs: MilvusLibArgs = {
            url: address,
            collectionName: collectionName,
            partitionName: partitionName,
            textField: textFieldDefault
        }

        if (secure) {
            milVusArgs.clientConfig = {
                address: address,
                ssl: secure,
                tls: {
                    rootCertPath: caPemPath,
                    certChainPath: clientPemPath,
                    privateKeyPath: clientKeyPath,
                    serverName: serverName
                }
            }
        }

        if (milvusUser) milVusArgs.username = milvusUser
        if (milvusPassword) milVusArgs.password = milvusPassword

        let milvusFilter = _milvusFilter
        if (isFileUploadEnabled && options.chatId) {
            if (milvusFilter) milvusFilter += ` OR ${KODIVIAN_CHATID} == "${options.chatId}" OR NOT EXISTS(${KODIVIAN_CHATID})`
            else milvusFilter = `${KODIVIAN_CHATID} == "${options.chatId}" OR NOT EXISTS(${KODIVIAN_CHATID})`
        }

        // Use LangChain Milvus for field discovery
        const vectorStore = await Milvus.fromExistingCollection(embeddings, milVusArgs)

        // Create Milvus client for direct queries
        const clientConfig: any = {
            address: address
        }

        if (secure) {
            clientConfig.ssl = secure
            clientConfig.tls = {
                rootCertPath: caPemPath,
                certChainPath: clientPemPath,
                privateKeyPath: clientKeyPath,
                serverName: serverName
            }
        }

        if (milvusUser) clientConfig.username = milvusUser
        if (milvusPassword) clientConfig.password = milvusPassword

        const milvusClient = new MilvusClient(clientConfig)

        const retriever = new HybridMilvusRetriever({
            milvusClient,
            collectionName,
            vectorField,
            textField: textFieldDefault,
            embeddings,
            embeddingEndpoint,
            defaultOutputFields,
            metricType,
            k,
            milvusFilter,
            vectorStore,
            queryType
        })

        if (output === 'retriever') {
            return retriever
        } else if (output === 'vectorStore') {
            // Return vector store with hybrid capability
            ;(vectorStore as any).k = k
            if (milvusFilter) {
                ;(vectorStore as any).filter = milvusFilter
            }
            // Add hybrid search capability - attach retriever
            ;(vectorStore as any).hybridRetriever = retriever

            // Make vectorStore work as a retriever by adding all necessary methods
            // This allows agents to call .invoke() on the vectorStore
            // The invoke method is required by ConversationalRetrievalToolAgent
            ;(vectorStore as any).invoke = async (query: string) => {
                return await retriever.invoke(query)
            }

            // Also add getRelevantDocuments for compatibility
            ;(vectorStore as any).getRelevantDocuments = async (query: string) => {
                return await retriever.getRelevantDocuments(query)
            }

            // Override asRetriever to return our hybrid retriever
            ;(vectorStore as any).asRetriever = (config?: any) => {
                return retriever
            }

            return vectorStore
        }
        return retriever
    }
}

module.exports = { nodeClass: HybridMilvus_VectorStores }
