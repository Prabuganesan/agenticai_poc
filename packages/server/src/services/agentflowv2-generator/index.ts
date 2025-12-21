import { StatusCodes } from 'http-status-codes'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import { getErrorMessage } from '../../errors/utils'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import path from 'path'
import * as fs from 'fs'
import { generateAgentflowv2 as generateAgentflowv2_json } from 'kodivian-components'
import { z } from 'zod'
import { sysPrompt } from './prompt'
import { databaseEntities } from '../../utils'
import { logDebug } from '../../utils/logger/system-helper'
import { MODE } from '../../Interface'

// Define the Zod schema for Agentflowv2 data structure
const NodeType = z.object({
    id: z.string(),
    type: z.string(),
    position: z.object({
        x: z.number(),
        y: z.number()
    }),
    width: z.number(),
    height: z.number(),
    selected: z.boolean().optional(),
    positionAbsolute: z
        .object({
            x: z.number(),
            y: z.number()
        })
        .optional(),
    dragging: z.boolean().optional(),
    data: z.any().optional(),
    parentNode: z.string().optional()
})

const EdgeType = z.object({
    source: z.string(),
    sourceHandle: z.string(),
    target: z.string(),
    targetHandle: z.string(),
    data: z
        .object({
            sourceColor: z.string().optional(),
            targetColor: z.string().optional(),
            edgeLabel: z.string().optional(),
            isHumanInput: z.boolean().optional()
        })
        .optional(),
    type: z.string().optional(),
    id: z.string()
})

const AgentFlowV2Type = z
    .object({
        description: z.string().optional(),
        usecases: z.array(z.string()).optional(),
        nodes: z.array(NodeType),
        edges: z.array(EdgeType)
    })
    .describe('Generate Agentflowv2 nodes and edges')

// Type for the templates array
type AgentFlowV2Template = z.infer<typeof AgentFlowV2Type>

const getAllAgentFlow2Nodes = async () => {
    const appServer = getRunningExpressApp()
    const nodes = appServer.nodesPool.componentNodes
    const agentFlow2Nodes = []
    for (const node in nodes) {
        if (nodes[node].category === 'Agent Flows') {
            agentFlow2Nodes.push({
                name: nodes[node].name,
                label: nodes[node].label,
                description: nodes[node].description
            })
        }
    }
    return JSON.stringify(agentFlow2Nodes, null, 2)
}

const getAllToolNodes = async () => {
    const appServer = getRunningExpressApp()
    const nodes = appServer.nodesPool.componentNodes
    const toolNodes = []
    const disabled_nodes = process.env.DISABLED_NODES ? process.env.DISABLED_NODES.split(',') : []

    for (const node in nodes) {
        if (nodes[node].category.includes('Tools')) {
            if (disabled_nodes.includes(nodes[node].name)) {
                continue
            }
            toolNodes.push({
                name: nodes[node].name,
                description: nodes[node].description
            })
        }
    }
    return JSON.stringify(toolNodes, null, 2)
}

const getAllAgentflowv2Marketplaces = async () => {
    const templates: AgentFlowV2Template[] = []
    let marketplaceDir = path.join(__dirname, '..', '..', '..', 'marketplaces', 'agentflowsv2')
    let jsonsInDir = fs.readdirSync(marketplaceDir).filter((file) => path.extname(file) === '.json')
    jsonsInDir.forEach((file) => {
        try {
            const filePath = path.join(__dirname, '..', '..', '..', 'marketplaces', 'agentflowsv2', file)
            const fileData = fs.readFileSync(filePath)
            const fileDataObj = JSON.parse(fileData.toString())
            
            // Ensure nodes and edges are arrays before processing
            if (!Array.isArray(fileDataObj.nodes)) {
                console.warn(`Template file ${file} has invalid or missing nodes array, skipping`)
                return // Skip this file
            }
            if (!Array.isArray(fileDataObj.edges)) {
                console.warn(`Template file ${file} has invalid or missing edges array, skipping`)
                return // Skip this file
            }
            
            // get rid of the node.data, remain all other properties
            const filteredNodes = fileDataObj.nodes.map((node: any) => {
                return {
                    ...node,
                    data: undefined
                }
            })

            const title = file.split('.json')[0]
            const template = {
                title,
                description: fileDataObj.description || `Template from ${file}`,
                usecases: fileDataObj.usecases || [],
                nodes: filteredNodes,
                edges: fileDataObj.edges
            }

            // Validate template against schema
            const validatedTemplate = AgentFlowV2Type.parse(template)
            templates.push({
                ...validatedTemplate,
                // @ts-ignore
                title: title
            })
        } catch (error) {
            console.error(`Error processing template file ${file}:`, error)
            // Continue with next file instead of failing completely
        }
    })

    // Format templates into the requested string format
    let formattedTemplates = ''
    templates.forEach((template: AgentFlowV2Template, index: number) => {
        formattedTemplates += `Example ${index + 1}: <<${(template as any).title}>> - ${template.description}\n`
        formattedTemplates += `"nodes": [\n`

        // Format nodes with proper indentation
        // Ensure nodes is an array before stringifying
        const nodesArray = Array.isArray(template.nodes) ? template.nodes : []
        const nodesJson = JSON.stringify(nodesArray, null, 3)
        // Split by newlines and add 3 spaces to the beginning of each line except the first and last
        const nodesLines = nodesJson ? nodesJson.split('\n') : []
        if (nodesLines && nodesLines.length > 2) {
            formattedTemplates += `   ${nodesLines[0]}\n`
            for (let i = 1; i < nodesLines.length - 1; i++) {
                formattedTemplates += `   ${nodesLines[i]}\n`
            }
            formattedTemplates += `   ${nodesLines[nodesLines.length - 1]}\n`
        } else {
            formattedTemplates += `   ${nodesJson || '[]'}\n`
        }

        formattedTemplates += `]\n`
        formattedTemplates += `"edges": [\n`

        // Format edges with proper indentation
        // Ensure edges is an array before stringifying
        const edgesArray = Array.isArray(template.edges) ? template.edges : []
        const edgesJson = JSON.stringify(edgesArray, null, 3)
        // Split by newlines and add tab to the beginning of each line except the first and last
        const edgesLines = edgesJson ? edgesJson.split('\n') : []
        if (edgesLines && edgesLines.length > 2) {
            formattedTemplates += `\t${edgesLines[0]}\n`
            for (let i = 1; i < edgesLines.length - 1; i++) {
                formattedTemplates += `\t${edgesLines[i]}\n`
            }
            formattedTemplates += `\t${edgesLines[edgesLines.length - 1]}\n`
        } else {
            formattedTemplates += `\t${edgesJson || '[]'}\n`
        }

        formattedTemplates += `]\n\n`
    })

    return formattedTemplates
}

const generateAgentflowv2 = async (question: string, selectedChatModel: Record<string, any>, orgId: string) => {
    try {
        if (!orgId) {
            throw new Error('orgId is required for generateAgentflowv2')
        }
        const agentFlow2Nodes = await getAllAgentFlow2Nodes()
        const toolNodes = await getAllToolNodes()
        const marketplaceTemplates = await getAllAgentflowv2Marketplaces()

        const prompt = sysPrompt
            .replace('{agentFlow2Nodes}', agentFlow2Nodes)
            .replace('{marketplaceTemplates}', marketplaceTemplates)
            .replace('{userRequest}', question)
        const { getDataSource } = await import('../../DataSource')
        const options: Record<string, any> = {
            appDataSource: getDataSource(parseInt(orgId)),
            databaseEntities: databaseEntities,
            logger: undefined
        }

        let response

        if (process.env.MODE === MODE.QUEUE) {
            if (!orgId) {
                throw new Error('orgId is required for queue mode in agentflowv2-generator')
            }
            const orgIdNum = parseInt(orgId || '0')
            if (!orgIdNum) {
                throw new Error(`Invalid organization ID: ${orgId}. orgId is required for queue mode.`)
            }
            const predictionQueue = getRunningExpressApp().queueManager.getQueue(orgIdNum, 'prediction')
            const job = await predictionQueue.addJob({
                prompt,
                question,
                toolNodes,
                selectedChatModel,
                isAgentFlowGenerator: true,
                orgId: orgIdNum
            })
            logDebug(`[server]: Generated Agentflowv2 Job added to queue: ${job.id} for orgId ${orgIdNum}`).catch(() => {})
            const queueEvents = predictionQueue.getQueueEvents()
            response = await job.waitUntilFinished(queueEvents)
        } else {
            response = await generateAgentflowv2_json(
                { prompt, componentNodes: getRunningExpressApp().nodesPool.componentNodes, toolNodes, selectedChatModel },
                question,
                options
            )
        }

        try {
            // Handle undefined or null response (e.g., from rate limit errors)
            if (response === undefined || response === null) {
                throw new Error('No response received from agentflowv2 generator. This may be due to API rate limits or service errors.')
            }

            // Try to parse and validate the response if it's a string
            let responseObj: any
            if (typeof response === 'string') {
                // Handle empty string
                if (response.trim() === '') {
                    throw new Error('Empty response received from agentflowv2 generator')
                }
                try {
                    responseObj = JSON.parse(response)
                } catch (parseErr) {
                    throw new Error(`Failed to parse response as JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`)
                }
            }
            // If response is already an object
            else if (typeof response === 'object') {
                responseObj = response
            }
            // Unexpected response type
            else {
                throw new Error(`Unexpected response type: ${typeof response}`)
            }

            // Ensure responseObj is not null or undefined
            if (!responseObj) {
                throw new Error('Response object is null or undefined')
            }

            // Ensure nodes and edges are always arrays (default to empty arrays if missing)
            if (!Array.isArray(responseObj.nodes)) {
                responseObj.nodes = []
            }
            if (!Array.isArray(responseObj.edges)) {
                responseObj.edges = []
            }

            const validatedResponse = AgentFlowV2Type.parse(responseObj)
            return validatedResponse
        } catch (parseError) {
            console.error('Failed to parse or validate response:', parseError)
            // If parsing fails, return an error object with more details
            const errorMessage = parseError instanceof Error ? parseError.message : String(parseError)
            return {
                error: `Failed to validate response format: ${errorMessage}`,
                rawResponse: response,
                nodes: [],
                edges: []
            } as any // Type assertion to avoid type errors
        }
    } catch (error: any) {
        // Check if this is a rate limit error from Gemini API
        if (error?.status === 429 || error?.statusText === 'Too Many Requests') {
            const retryDelay = error?.errorDetails?.find?.((detail: any) => detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo')?.retryDelay || '8s'
            const quotaFailure = error?.errorDetails?.find?.((detail: any) => detail['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure')
            let errorMessage = `API rate limit exceeded. Please retry after ${retryDelay}.`
            if (quotaFailure?.violations) {
                const violations = quotaFailure.violations.map((v: any) => v.quotaId).join(', ')
                errorMessage += ` Quota limits: ${violations}`
            }
            throw new InternalKodivianError(StatusCodes.TOO_MANY_REQUESTS, `Error: generateAgentflowv2 - ${errorMessage}`)
        }
        
        // Check if error message indicates undefined/null access
        const errorMsg = getErrorMessage(error)
        if (errorMsg.includes('Cannot read properties of undefined') || errorMsg.includes('reading \'length\'')) {
            throw new InternalKodivianError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: generateAgentflowv2 - Invalid response format received. This may be due to API rate limits or service errors. Original error: ${errorMsg}`
            )
        }
        
        throw new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: generateAgentflowv2 - ${errorMsg}`)
    }
}

export default {
    generateAgentflowv2
}
