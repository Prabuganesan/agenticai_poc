import { cloneDeep, omit } from 'lodash'
import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { INodeData, MODE } from '../../Interface'
import { INodeOptionsValue } from 'autonomous-components'
import { databaseEntities } from '../../utils'
import { logInfo, logError, logWarn, logDebug } from '../../utils/logger/system-helper'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { getErrorMessage } from '../../errors/utils'
import { OMIT_QUEUE_JOB_DATA } from '../../utils/constants'
import { executeCustomNodeFunction } from '../../utils/executeCustomNodeFunction'
import { getDataSource } from '../../DataSource'

// Get all component nodes
const getAllNodes = async () => {
    try {
        const appServer = getRunningExpressApp()
        const dbResponse = []
        for (const nodeName in appServer.nodesPool.componentNodes) {
            const clonedNode = cloneDeep(appServer.nodesPool.componentNodes[nodeName])
            dbResponse.push(clonedNode)
        }
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: nodesService.getAllNodes - ${getErrorMessage(error)}`)
    }
}

// Get all component nodes for a specific category
const getAllNodesForCategory = async (category: string) => {
    try {
        const appServer = getRunningExpressApp()
        const dbResponse = []
        for (const nodeName in appServer.nodesPool.componentNodes) {
            const componentNode = appServer.nodesPool.componentNodes[nodeName]
            if (componentNode.category === category) {
                const clonedNode = cloneDeep(componentNode)
                dbResponse.push(clonedNode)
            }
        }
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: nodesService.getAllNodesForCategory - ${getErrorMessage(error)}`
        )
    }
}

// Get specific component node via name
const getNodeByName = async (nodeName: string) => {
    try {
        const appServer = getRunningExpressApp()
        if (Object.prototype.hasOwnProperty.call(appServer.nodesPool.componentNodes, nodeName)) {
            const dbResponse = appServer.nodesPool.componentNodes[nodeName]
            return dbResponse
        } else {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Node ${nodeName} not found`)
        }
    } catch (error) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: nodesService.getAllNodes - ${getErrorMessage(error)}`)
    }
}

// Returns specific component node icon via name
const getSingleNodeIcon = async (nodeName: string) => {
    try {
        const appServer = getRunningExpressApp()
        if (Object.prototype.hasOwnProperty.call(appServer.nodesPool.componentNodes, nodeName)) {
            const nodeInstance = appServer.nodesPool.componentNodes[nodeName]
            if (nodeInstance.icon === undefined) {
                throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Node ${nodeName} icon not found`)
            }

            if (nodeInstance.icon.endsWith('.svg') || nodeInstance.icon.endsWith('.png') || nodeInstance.icon.endsWith('.jpg')) {
                const filepath = nodeInstance.icon
                return filepath
            } else {
                throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Node ${nodeName} icon is missing icon`)
            }
        } else {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Node ${nodeName} not found`)
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: nodesService.getSingleNodeIcon - ${getErrorMessage(error)}`
        )
    }
}

const getSingleNodeAsyncOptions = async (nodeName: string, requestBody: any): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const nodeData: INodeData = requestBody || {}

        if (!Object.prototype.hasOwnProperty.call(appServer.nodesPool.componentNodes, nodeName)) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Node ${nodeName} not found`)
        }

        const nodeInstance = appServer.nodesPool.componentNodes[nodeName]
        const methodName = nodeData.loadMethod || ''

        // Check if node has loadMethods and the specific method exists
        if (!nodeInstance.loadMethods) {
            logWarn(`Node ${nodeName} does not have loadMethods defined`).catch(() => {})
            return []
        }

        if (!methodName) {
            logWarn(`No loadMethod specified for node ${nodeName}`).catch(() => {})
            return []
        }

        if (!nodeInstance.loadMethods[methodName]) {
            logWarn(`Node ${nodeName} does not have loadMethod ${methodName}`).catch(() => {})
            return []
        }

        try {
            const startTime = Date.now()
            logInfo(`Executing loadMethod ${methodName} for node ${nodeName}`).catch(() => {})

            // Get orgId from requestBody - required
            const orgId = requestBody.orgId || (requestBody as any).activeOrgId
            if (!orgId) {
                throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'orgId is required in request body')
            }
            const appDataSource = getDataSource(parseInt(orgId))

            const dbResponse: INodeOptionsValue[] = await nodeInstance.loadMethods[methodName].call(nodeInstance, nodeData, {
                appDataSource: appDataSource,
                databaseEntities: databaseEntities,
                componentNodes: appServer.nodesPool.componentNodes,
                previousNodes: requestBody.previousNodes,
                currentNode: requestBody.currentNode,
                searchOptions: requestBody.searchOptions,
                cachePool: appServer.cachePool
            })

            const duration = Date.now() - startTime
            logInfo(
                `loadMethod ${methodName} for node ${nodeName} completed in ${duration}ms, returned ${dbResponse?.length || 0} items`
            ).catch(() => {})

            return dbResponse
        } catch (error) {
            logError(`Error executing loadMethod ${methodName} for node ${nodeName}:`, error).catch(() => {})
            return []
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: nodesService.getSingleNodeAsyncOptions - ${getErrorMessage(error)}`
        )
    }
}

// execute custom function node
const executeCustomFunction = async (requestBody: any, orgId: string) => {
    if (!orgId) {
        throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'orgId is required for custom function execution')
    }
    const appServer = getRunningExpressApp()
    const orgIdNum = parseInt(orgId)
    if (isNaN(orgIdNum)) {
        throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, `Invalid orgId: ${orgId}. Must be a valid number.`)
    }
    const appDataSource = getDataSource(orgIdNum)

    const executeData = {
        appDataSource: appDataSource,
        componentNodes: appServer.nodesPool.componentNodes,
        data: requestBody,
        isExecuteCustomFunction: true,
        orgId
    }

    if (process.env.MODE === MODE.QUEUE) {
        const orgIdNum = parseInt(orgId || '0')
        if (!orgIdNum) {
            throw new Error(`Invalid organization ID: ${orgId}. orgId is required for queue mode.`)
        }
        const predictionQueue = appServer.queueManager.getQueue(orgIdNum, 'prediction')

        const job = await predictionQueue.addJob(omit(executeData, OMIT_QUEUE_JOB_DATA))
        logDebug(`[server]: Execute Custom Function Job added to queue by ${orgId}: ${job.id}`).catch(() => {})

        const queueEvents = predictionQueue.getQueueEvents()
        const result = await job.waitUntilFinished(queueEvents)
        if (!result) {
            throw new Error('Failed to execute custom function')
        }

        return result
    } else {
        return await executeCustomNodeFunction(executeData)
    }
}

export default {
    getAllNodes,
    getNodeByName,
    getSingleNodeIcon,
    getSingleNodeAsyncOptions,
    executeCustomFunction,
    getAllNodesForCategory
}
