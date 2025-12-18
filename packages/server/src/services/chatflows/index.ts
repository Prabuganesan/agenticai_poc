import { ICommonObject, removeFolderFromStorage } from 'kodivian-components'
import { StatusCodes } from 'http-status-codes'
import { ChatflowType, IReactFlowObject } from '../../Interface'
import { AUTONOMOUS_COUNTER_STATUS, AUTONOMOUS_METRIC_COUNTERS } from '../../Interface.Metrics'
import { UsageCacheManager } from '../../UsageCacheManager'
import { ChatFlow, EnumChatflowType } from '../../database/entities/ChatFlow'
import { ChatMessage } from '../../database/entities/ChatMessage'
import { ChatMessageFeedback } from '../../database/entities/ChatMessageFeedback'
import { UpsertHistory } from '../../database/entities/UpsertHistory'
// Workspace and getWorkspaceSearchOptions removed for autonomous server
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { getErrorMessage } from '../../errors/utils'
import documentStoreService from '../../services/documentstore'
import { constructGraphs, getEndingNodes, isFlowValidForStream } from '../../utils'
import { containsBase64File, updateFlowDataWithFilePaths } from '../../utils/fileRepository'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { utilGetUploadsConfig } from '../../utils/getUploadsConfig'
import { logInfo, logError, logWarn } from '../../utils/logger/system-helper'
import { updateStorageUsage } from '../../utils/quotaUsage'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'
import { getDataSource } from '../../DataSource'
import { generateGuid } from '../../utils/guidGenerator'

export const enum ChatflowErrorMessage {
    INVALID_CHATFLOW_TYPE = 'Invalid Chatflow Type'
}

export function validateChatflowType(type: ChatflowType | undefined) {
    if (!Object.values(EnumChatflowType).includes(type as EnumChatflowType))
        throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, ChatflowErrorMessage.INVALID_CHATFLOW_TYPE)
}

// Check if chatflow valid for streaming
const checkIfChatflowIsValidForStreaming = async (chatflowId: string, orgId: string, userId?: number): Promise<any> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))

        // User-based isolation: allow access to chatflows created by user OR public chatflows
        let chatflow: ChatFlow | null = null
        if (userId !== undefined) {
            // First try to find chatflow created by user
            chatflow = await dataSource.getRepository(ChatFlow).findOne({
                where: {
                    guid: chatflowId,
                    created_by: userId
                }
            })
            // If not found, check if it's a public flow
            if (!chatflow) {
                chatflow = await dataSource.getRepository(ChatFlow).findOne({
                    where: {
                        guid: chatflowId,
                        isPublic: true
                    }
                })
            }
        } else {
            // No userId provided - allow access to any chatflow in the org (for backward compatibility)
            chatflow = await dataSource.getRepository(ChatFlow).findOneBy({
                guid: chatflowId
            })
        }

        if (!chatflow) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found`)
        }

        /* Check for post-processing settings, if available isStreamValid is always false */
        let chatflowConfig: ICommonObject = {}
        if (chatflow.chatbotConfig) {
            chatflowConfig = JSON.parse(chatflow.chatbotConfig)
            if (chatflowConfig?.postProcessing?.enabled === true) {
                return { isStreaming: false }
            }
        }

        if (chatflow.type === 'AGENTFLOW') {
            return { isStreaming: true }
        }

        /*** Get Ending Node with Directed Graph  ***/
        const flowData = chatflow.flowData
        const parsedFlowData: IReactFlowObject = JSON.parse(flowData)
        const nodes = parsedFlowData.nodes
        const edges = parsedFlowData.edges
        const { graph, nodeDependencies } = constructGraphs(nodes, edges)

        const endingNodes = getEndingNodes(nodeDependencies, graph, nodes)

        let isStreaming = false
        for (const endingNode of endingNodes) {
            const endingNodeData = endingNode.data
            const isEndingNode = endingNodeData?.outputs?.output === 'EndingNode'
            // Once custom function ending node exists, flow is always unavailable to stream
            if (isEndingNode) {
                return { isStreaming: false }
            }
            isStreaming = isFlowValidForStream(nodes, endingNodeData)
        }

        // If it is a Multi/Sequential Agents, always enable streaming
        if (endingNodes.filter((node) => node.data.category === 'Multi Agents' || node.data.category === 'Sequential Agents').length > 0) {
            return { isStreaming: true }
        }

        const dbResponse = { isStreaming: isStreaming }
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.checkIfChatflowIsValidForStreaming - ${getErrorMessage(error)}`
        )
    }
}

// Check if chatflow valid for uploads
const checkIfChatflowIsValidForUploads = async (chatflowId: string, orgId: string): Promise<any> => {
    try {
        const dbResponse = await utilGetUploadsConfig(chatflowId, orgId)
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.checkIfChatflowIsValidForUploads - ${getErrorMessage(error)}`
        )
    }
}

const deleteChatflow = async (req: AuthenticatedRequest, chatflowId: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))

        // Verify chatflow belongs to orgId
        await getChatflowById(chatflowId, orgId)

        const dbResponse = await dataSource.getRepository(ChatFlow).delete({ guid: chatflowId })

        // Update document store usage
        await documentStoreService.updateDocumentStoreUsage(chatflowId, undefined, orgId)

        // Delete all chat messages
        await dataSource.getRepository(ChatMessage).delete({ chatflowid: chatflowId })

        // Delete all chat feedback
        await dataSource.getRepository(ChatMessageFeedback).delete({ chatflowid: chatflowId })

        // Delete all upsert history
        await dataSource.getRepository(UpsertHistory).delete({ chatflowid: chatflowId })

        try {
            // Delete all uploads corresponding to this chatflow
            const { totalSize } = await removeFolderFromStorage(orgId, chatflowId)
            await updateStorageUsage(orgId, totalSize, appServer.usageCacheManager)
        } catch (e: any) {
            // Log error with details for debugging
            const errorMessage = getErrorMessage(e)
            // If folder doesn't exist, it's not a critical error - just log as info
            if (errorMessage?.includes('ENOENT') || errorMessage?.includes('not found') || errorMessage?.includes('does not exist')) {
                logInfo(`[server]: File storage folder not found for chatflow ${chatflowId} (no uploads to delete)`).catch(() => { })
            } else {
                logError(`[server]: Error deleting file storage for chatflow ${chatflowId}: ${errorMessage}`).catch(() => { })
            }
        }
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.deleteChatflow - ${getErrorMessage(error)}`
        )
    }
}

const getAllChatflows = async (req: AuthenticatedRequest, type?: ChatflowType, page: number = -1, limit: number = -1) => {
    try {
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))

        // Org-level sharing: Show ALL chatflows in the organization
        // userId is used for marking isCreator but not for filtering
        const userId = req.userId ? parseInt(String(req.userId), 10) : undefined

        const queryBuilder = dataSource
            .getRepository(ChatFlow)
            .createQueryBuilder('chat_flow')
            .orderBy('chat_flow.last_modified_on', 'DESC')

        // NO userId filtering - show all chatflows in the org

        if (page > 0 && limit > 0) {
            queryBuilder.skip((page - 1) * limit)
            queryBuilder.take(limit)
        }
        if (type === 'AGENTFLOW') {
            queryBuilder.andWhere('chat_flow.type = :type', { type: 'AGENTFLOW' })
        } else if (type === 'ASSISTANT') {
            queryBuilder.andWhere('chat_flow.type = :type', { type: 'ASSISTANT' })
        } else if (type === 'CHATFLOW') {
            // fetch all chatflows that are not agentflow
            queryBuilder.andWhere('chat_flow.type = :type', { type: 'CHATFLOW' })
        }
        const [data, total] = await queryBuilder.getManyAndCount()

        // Add isCreator flag to each chatflow for frontend permission checks
        const dataWithCreatorFlag = data.map((chatflow) => ({
            ...chatflow,
            isCreator: userId && chatflow.created_by === userId,
            creatorId: chatflow.created_by
        }))

        if (page > 0 && limit > 0) {
            return { data: dataWithCreatorFlag, total }
        } else {
            return dataWithCreatorFlag
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.getAllChatflows - ${getErrorMessage(error)}`
        )
    }
}

async function getAllChatflowsCountByOrganization(type: ChatflowType, organizationId: string): Promise<number> {
    try {
        const dataSource = getDataSource(parseInt(organizationId))

        // For autonomous server, use orgId directly
        const chatflowsCount = await dataSource.getRepository(ChatFlow).countBy({
            type
        })

        return chatflowsCount
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.getAllChatflowsCountByOrganization - ${getErrorMessage(error)}`
        )
    }
}

const getAllChatflowsCount = async (req: AuthenticatedRequest, type?: ChatflowType): Promise<number> => {
    try {
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))

        if (type) {
            const dbResponse = await dataSource.getRepository(ChatFlow).countBy({
                type
            })
            return dbResponse
        }
        const dbResponse = await dataSource.getRepository(ChatFlow).countBy({})
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.getAllChatflowsCount - ${getErrorMessage(error)}`
        )
    }
}

const getChatflowByApiKey = async (apiKeyId: string, orgId: string, keyonly?: unknown): Promise<any> => {
    try {
        // Here we only get chatflows that are bounded by the apikeyid and chatflows that are not bounded by any apikey
        const dataSource = getDataSource(parseInt(orgId))
        let query = dataSource.getRepository(ChatFlow).createQueryBuilder('cf').where('cf.apikeyid = :apikeyid', { apikeyid: apiKeyId })
        if (keyonly === undefined) {
            query = query.orWhere('cf.apikeyid IS NULL').orWhere('cf.apikeyid = ""')
        }

        const dbResponse = await query.orderBy('cf.name', 'ASC').getMany()
        if (dbResponse.length < 1) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Chatflow not found in the database!`)
        }
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.getChatflowByApiKey - ${getErrorMessage(error)}`
        )
    }
}

const getChatflowById = async (chatflowId: string, orgId: string, userId?: number): Promise<any> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))

        // Org-level sharing: Allow access to any chatflow in the org
        // No userId filtering - all users can view all chatflows
        const dbResponse = await dataSource.getRepository(ChatFlow).findOne({
            where: {
                guid: chatflowId
            }
        })

        if (!dbResponse) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found in the database!`)
        }

        // Add isCreator flag for permission checks
        const responseWithCreatorFlag = {
            ...dbResponse,
            isCreator: userId && dbResponse.created_by === userId,
            creatorId: dbResponse.created_by
        }

        return responseWithCreatorFlag
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.getChatflowById - ${getErrorMessage(error)}`
        )
    }
}

const saveChatflow = async (req: AuthenticatedRequest, newChatFlow: ChatFlow, usageCacheManager: UsageCacheManager): Promise<any> => {
    validateChatflowType(newChatFlow.type)
    const appServer = getRunningExpressApp()
    const orgId = req.orgId
    const userId = req.userId

    if (!orgId) {
        throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
    }

    const dataSource = getDataSource(parseInt(orgId))

    // Generate GUID if not provided
    if (!newChatFlow.guid) {
        newChatFlow.guid = generateGuid()
    }

    // Track userId (createdBy) - Set from authenticated request and convert to number
    const userIdNum = userId ? parseInt(userId) : undefined
    if (userIdNum !== undefined) {
        newChatFlow.created_by = userIdNum
        newChatFlow.created_on = Date.now()
    } else {
        throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'User ID is required')
    }

    // Check if a chatflow with the same name already exists in this org
    // Also check if the GUID already exists (might be re-saving a previously created chatflow)
    if (newChatFlow.name) {
        // First check if a chatflow with this GUID already exists
        const existingByGuid = newChatFlow.guid
            ? await dataSource.getRepository(ChatFlow).findOneBy({
                guid: newChatFlow.guid
            })
            : null

        // If GUID exists, this is a re-save of existing chatflow - allow it
        if (existingByGuid) {
            // GUID exists, so this is an update scenario - name check is handled in updateChatflow
            // But since we're in saveChatflow, we'll allow it if it's the same chatflow
            if (existingByGuid.name !== newChatFlow.name) {
                // Name is being changed - check if new name is available
                const existingByName = await dataSource.getRepository(ChatFlow).findOne({
                    where: {
                        name: newChatFlow.name
                    }
                })
                if (existingByName && existingByName.guid !== newChatFlow.guid) {
                    throw new InternalAutonomousError(
                        StatusCodes.CONFLICT,
                        `A chatflow with the name "${newChatFlow.name}" already exists in this organization. Please use a different name.`
                    )
                }
            }
        } else {
            // GUID doesn't exist - this is a new chatflow
            // Check if name is already taken
            const existingByName = await dataSource.getRepository(ChatFlow).findOne({
                where: {
                    name: newChatFlow.name
                }
            })
            if (existingByName) {
                throw new InternalAutonomousError(
                    StatusCodes.CONFLICT,
                    `A chatflow with the name "${newChatFlow.name}" already exists in this organization. Please use a different name.`
                )
            }
        }
    }

    // Auto-populate display_name from name (max 50 chars)
    if (newChatFlow.name) {
        newChatFlow.display_name = newChatFlow.name.substring(0, 50)
    }

    let dbResponse: ChatFlow
    if (containsBase64File(newChatFlow)) {
        // we need a 2-step process, as we need to save the chatflow first and then update the file paths
        // this is because we need the chatflow id to create the file paths

        // step 1 - save with empty flowData
        const incomingFlowData = newChatFlow.flowData
        newChatFlow.flowData = JSON.stringify({})
        const chatflow = dataSource.getRepository(ChatFlow).create(newChatFlow)
        const step1Results = await dataSource.getRepository(ChatFlow).save(chatflow)

        // step 2 - convert base64 to file paths and update the chatflow
        step1Results.flowData = await updateFlowDataWithFilePaths(step1Results.guid, incomingFlowData, orgId, usageCacheManager)
        await _checkAndUpdateDocumentStoreUsage(step1Results, orgId)
        dbResponse = await dataSource.getRepository(ChatFlow).save(step1Results)
    } else {
        const chatflow = dataSource.getRepository(ChatFlow).create(newChatFlow)
        dbResponse = await dataSource.getRepository(ChatFlow).save(chatflow)
    }

    // Product ID not needed for autonomous server
    const productId = ''

    // Telemetry removed

    appServer.metricsProvider?.incrementCounter(
        dbResponse?.type === 'AGENTFLOW' ? AUTONOMOUS_METRIC_COUNTERS.AGENTFLOW_CREATED : AUTONOMOUS_METRIC_COUNTERS.CHATFLOW_CREATED,
        { status: AUTONOMOUS_COUNTER_STATUS.SUCCESS }
    )

    return dbResponse
}

const updateChatflow = async (req: AuthenticatedRequest, chatflow: ChatFlow, updateChatFlow: ChatFlow): Promise<any> => {
    const appServer = getRunningExpressApp()
    const orgId = req.orgId
    const userId = req.userId
    if (!orgId) {
        throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
    }

    const dataSource = getDataSource(parseInt(orgId))

    if (updateChatFlow.flowData && containsBase64File(updateChatFlow)) {
        updateChatFlow.flowData = await updateFlowDataWithFilePaths(
            chatflow.guid,
            updateChatFlow.flowData,
            orgId,
            appServer.usageCacheManager
        )
    }
    if (updateChatFlow.type || updateChatFlow.type === '') {
        validateChatflowType(updateChatFlow.type)
    } else {
        updateChatFlow.type = chatflow.type
    }

    // Check if name is being changed and if the new name already exists in the same org
    if (updateChatFlow.name && updateChatFlow.name !== chatflow.name) {
        const existingChatflow = await dataSource.getRepository(ChatFlow).findOne({
            where: {
                name: updateChatFlow.name
            }
        })
        if (existingChatflow && existingChatflow.guid !== chatflow.guid) {
            throw new InternalAutonomousError(
                StatusCodes.CONFLICT,
                `A chatflow with the name "${updateChatFlow.name}" already exists in this organization. Please use a different name.`
            )
        }
    }

    // Auto-populate display_name from name if name is being updated (max 50 chars)
    if (updateChatFlow.name) {
        updateChatFlow.display_name = updateChatFlow.name.substring(0, 50)
    }

    // Set last_modified_by and last_modified_on if userId provided
    const userIdNum = userId ? parseInt(userId) : undefined
    if (userIdNum !== undefined) {
        updateChatFlow.last_modified_by = userIdNum
        updateChatFlow.last_modified_on = Date.now()
    }

    const newDbChatflow = dataSource.getRepository(ChatFlow).merge(chatflow, updateChatFlow)
    await _checkAndUpdateDocumentStoreUsage(newDbChatflow, orgId)
    const dbResponse = await dataSource.getRepository(ChatFlow).save(newDbChatflow)

    return dbResponse
}

// Get specific chatflow chatbotConfig via id (PUBLIC endpoint, used to retrieve config for embedded chat)
// Safe as public endpoint as chatbotConfig doesn't contain sensitive credential
// NOTE: This searches across all orgs - for per-org databases, we need orgId
// For now, we'll search all orgs (less efficient but maintains backward compatibility)
const getSinglePublicChatbotConfig = async (chatflowId: string, baseURL?: string, orgId?: string, userId?: number): Promise<any> => {
    try {
        let dbResponse: ChatFlow | null = null

        if (orgId) {
            // If orgId is provided, use specific org's database
            const dataSource = getDataSource(parseInt(orgId))

            // User-based isolation: allow access to chatflows created by user OR public chatflows
            if (userId !== undefined) {
                // First try to find chatflow created by user
                dbResponse = await dataSource.getRepository(ChatFlow).findOne({
                    where: {
                        guid: chatflowId,
                        created_by: userId
                    }
                })
                // If not found, check if it's a public flow
                if (!dbResponse) {
                    dbResponse = await dataSource.getRepository(ChatFlow).findOne({
                        where: {
                            guid: chatflowId,
                            isPublic: true
                        }
                    })
                }
            } else {
                // No userId provided - allow access to any chatflow in the org (for backward compatibility)
                dbResponse = await dataSource.getRepository(ChatFlow).findOneBy({
                    guid: chatflowId
                })
            }
        } else {
            // Require orgId upfront - no cross-org search
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        if (!dbResponse) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found`)
        }
        const uploadsConfig = await utilGetUploadsConfig(chatflowId, orgId)
        // Default theme configuration for embed
        // Use provided baseURL or construct from environment
        const contextPath = process.env.CONTEXT_PATH || '/autonomous'
        const finalBaseURL = baseURL
            ? `${baseURL}${contextPath}`
            : (() => {
                const httpProtocol = process.env.HTTP_PROTOCOL || 'http'
                const host = process.env.HOST || 'localhost'
                const port = process.env.SERVER_PORT || '3000'
                return `${httpProtocol}://${host}:${port}${contextPath}`
            })()
        const defaultTheme = {
            button: {
                backgroundColor: '#ffffff',
                right: 20,
                bottom: 20,
                size: 50,
                dragAndDrop: true,
                iconColor: 'white',
                customIconSrc: `${finalBaseURL}/Ari-logo.png`,
                autoWindowOpen: {
                    autoOpen: true,
                    openDelay: 2,
                    autoOpenOnMobile: false
                }
            },
            chatWindow: {
                footer: {
                    text: 'Powered by Autonomous SAB',
                    company: '',
                    companyLink: ''
                }
            },
            customCSS: `
                [id*="autonomous-chatbot"], [class*="autonomous-chatbot"], [id*="chatbot-button"], [class*="chatbot-button"], button[style*="position: fixed"] {
                    background-color: #ffffff !important;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
                    border-radius: 50% !important;
                }
                [id*="autonomous-chatbot"] img, [class*="autonomous-chatbot"] img, [id*="chatbot-button"] img, [class*="chatbot-button"] img, button[style*="position: fixed"] img, img[alt*="Bubble"], img[alt*="button"], img.rounded-full {
                    width: 50px !important;
                    height: 30px !important;
                    object-fit: contain !important;
                    max-width: 50px !important;
                    max-height: 30px !important;
                }
                img[style*="width: 30px"], img[style*="height: 30px"] {
                    width: 50px !important;
                    height: 30px !important;
                    max-width: 50px !important;
                    max-height: 30px !important;
                }
                /* Chatbot Header Container - Ensure proper spacing */
                [class*="chatbot-header"], [id*="chatbot-header"], [class*="header"], [class*="chat-window-header"] {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    gap: 8px !important;
                    padding: 8px 12px !important;
                    position: relative !important;
                }
                /* Header Actions Container */
                [class*="header-actions"], [class*="header-controls"], [class*="chatbot-actions"] {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    margin-left: auto !important;
                }
                /* Close and Reset Button Styling - More Specific */
                [class*="chatbot-header"] button[aria-label*="close"],
                [class*="chatbot-header"] button[aria-label*="Close"],
                [class*="chatbot-header"] button[title*="close"],
                [class*="chatbot-header"] button[title*="Close"],
                [class*="header-actions"] button[aria-label*="close"],
                [class*="header-actions"] button[aria-label*="Close"],
                [class*="header-controls"] button[aria-label*="close"],
                [class*="header-controls"] button[aria-label*="Close"],
                [class*="chatbot-header"] button[aria-label*="reset"],
                [class*="chatbot-header"] button[aria-label*="Reset"],
                [class*="chatbot-header"] button[title*="reset"],
                [class*="chatbot-header"] button[title*="Reset"],
                [class*="header-actions"] button[aria-label*="reset"],
                [class*="header-actions"] button[aria-label*="Reset"],
                [class*="header-controls"] button[aria-label*="reset"],
                [class*="header-controls"] button[aria-label*="Reset"] {
                    background: rgba(255, 255, 255, 0.95) !important;
                    border: 1px solid rgba(0, 0, 0, 0.1) !important;
                    border-radius: 8px !important;
                    padding: 6px !important;
                    min-width: 32px !important;
                    min-height: 32px !important;
                    width: 32px !important;
                    height: 32px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    color: #666 !important;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
                    margin: 0 !important;
                    flex-shrink: 0 !important;
                }
                [class*="chatbot-header"] button[aria-label*="close"]:hover,
                [class*="chatbot-header"] button[aria-label*="Close"]:hover,
                [class*="header-actions"] button[aria-label*="close"]:hover,
                [class*="header-controls"] button[aria-label*="close"]:hover,
                [class*="chatbot-header"] button[aria-label*="reset"]:hover,
                [class*="chatbot-header"] button[aria-label*="Reset"]:hover,
                [class*="header-actions"] button[aria-label*="reset"]:hover,
                [class*="header-controls"] button[aria-label*="reset"]:hover {
                    background: rgba(0, 0, 0, 0.05) !important;
                    border-color: rgba(0, 0, 0, 0.2) !important;
                    transform: scale(1.05) !important;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15) !important;
                    color: #333 !important;
                }
                [class*="chatbot-header"] button svg,
                [class*="header-actions"] button svg,
                [class*="header-controls"] button svg {
                    width: 18px !important;
                    height: 18px !important;
                    stroke-width: 2 !important;
                    flex-shrink: 0 !important;
                }
            `
        }
        // even if chatbotConfig is not set but uploads are enabled
        // send uploadsConfig to the chatbot
        if (dbResponse.chatbotConfig || uploadsConfig) {
            try {
                const parsedConfig = dbResponse.chatbotConfig ? JSON.parse(dbResponse.chatbotConfig) : {}
                const ttsConfig =
                    typeof dbResponse.textToSpeech === 'string' ? JSON.parse(dbResponse.textToSpeech) : dbResponse.textToSpeech

                let isTTSEnabled = false
                if (ttsConfig) {
                    Object.keys(ttsConfig).forEach((provider) => {
                        if (provider !== 'none' && ttsConfig?.[provider]?.status) {
                            isTTSEnabled = true
                        }
                    })
                }
                delete parsedConfig.allowedOrigins
                delete parsedConfig.allowedOriginsError
                // Merge default theme with existing config theme (if any)
                const mergedTheme = parsedConfig.theme
                    ? {
                        ...defaultTheme,
                        ...parsedConfig.theme,
                        button: { ...defaultTheme.button, ...parsedConfig.theme.button },
                        chatWindow: {
                            ...defaultTheme.chatWindow,
                            ...parsedConfig.theme.chatWindow,
                            footer: { ...defaultTheme.chatWindow.footer, ...parsedConfig.theme.chatWindow?.footer }
                        }
                    }
                    : defaultTheme
                return { ...parsedConfig, theme: mergedTheme, uploads: uploadsConfig, flowData: dbResponse.flowData, isTTSEnabled }
            } catch (e) {
                throw new InternalAutonomousError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error parsing Chatbot Config for Chatflow ${chatflowId}`
                )
            }
        }
        // Return default config with theme even if no chatbotConfig exists
        return { theme: defaultTheme, uploads: uploadsConfig, flowData: dbResponse.flowData, isTTSEnabled: false }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.getSinglePublicChatbotConfig - ${getErrorMessage(error)}`
        )
    }
}

const getEmbedTheme = async (chatflowId: string, baseURL?: string, orgId?: string): Promise<any> => {
    try {
        // Require orgId upfront - no cross-org search
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))
        const dbResponse = await dataSource.getRepository(ChatFlow).findOneBy({
            guid: chatflowId
        })

        if (!dbResponse) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found`)
        }
        // Construct baseURL
        const contextPath = process.env.CONTEXT_PATH || '/autonomous'
        const finalBaseURL = baseURL
            ? `${baseURL}${contextPath}`
            : (() => {
                const httpProtocol = process.env.HTTP_PROTOCOL || 'http'
                const host = process.env.HOST || 'localhost'
                const port = process.env.SERVER_PORT || '3000'
                return `${httpProtocol}://${host}:${port}${contextPath}`
            })()
        // Default theme configuration
        const defaultTheme = {
            button: {
                backgroundColor: '#ffffff',
                right: 20,
                bottom: 20,
                size: 50,
                dragAndDrop: true,
                iconColor: 'white',
                customIconSrc: `${finalBaseURL}/Ari-logo.png`,
                autoWindowOpen: {
                    autoOpen: true,
                    openDelay: 2,
                    autoOpenOnMobile: false
                }
            },
            chatWindow: {
                footer: {
                    text: 'Powered by Autonomous SAB',
                    company: '',
                    companyLink: ''
                }
            },
            customCSS: `
                [id*="autonomous-chatbot"], [class*="autonomous-chatbot"], [id*="chatbot-button"], [class*="chatbot-button"], button[style*="position: fixed"] {
                    background-color: #ffffff !important;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
                    border-radius: 50% !important;
                }
                [id*="autonomous-chatbot"] img, [class*="autonomous-chatbot"] img, [id*="chatbot-button"] img, [class*="chatbot-button"] img, button[style*="position: fixed"] img, img[alt*="Bubble"], img[alt*="button"], img.rounded-full {
                    width: 50px !important;
                    height: 30px !important;
                    object-fit: contain !important;
                    max-width: 50px !important;
                    max-height: 30px !important;
                }
                img[style*="width: 30px"], img[style*="height: 30px"] {
                    width: 50px !important;
                    height: 30px !important;
                    max-width: 50px !important;
                    max-height: 30px !important;
                }
                /* Chatbot Header Container - Ensure proper spacing */
                [class*="chatbot-header"], [id*="chatbot-header"], [class*="header"], [class*="chat-window-header"] {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    gap: 8px !important;
                    padding: 8px 12px !important;
                    position: relative !important;
                }
                /* Header Actions Container */
                [class*="header-actions"], [class*="header-controls"], [class*="chatbot-actions"] {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    margin-left: auto !important;
                }
                /* Close and Reset Button Styling - More Specific */
                [class*="chatbot-header"] button[aria-label*="close"],
                [class*="chatbot-header"] button[aria-label*="Close"],
                [class*="chatbot-header"] button[title*="close"],
                [class*="chatbot-header"] button[title*="Close"],
                [class*="header-actions"] button[aria-label*="close"],
                [class*="header-actions"] button[aria-label*="Close"],
                [class*="header-controls"] button[aria-label*="close"],
                [class*="header-controls"] button[aria-label*="Close"],
                [class*="chatbot-header"] button[aria-label*="reset"],
                [class*="chatbot-header"] button[aria-label*="Reset"],
                [class*="chatbot-header"] button[title*="reset"],
                [class*="chatbot-header"] button[title*="Reset"],
                [class*="header-actions"] button[aria-label*="reset"],
                [class*="header-actions"] button[aria-label*="Reset"],
                [class*="header-controls"] button[aria-label*="reset"],
                [class*="header-controls"] button[aria-label*="Reset"] {
                    background: rgba(255, 255, 255, 0.95) !important;
                    border: 1px solid rgba(0, 0, 0, 0.1) !important;
                    border-radius: 8px !important;
                    padding: 6px !important;
                    min-width: 32px !important;
                    min-height: 32px !important;
                    width: 32px !important;
                    height: 32px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    color: #666 !important;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
                    margin: 0 !important;
                    flex-shrink: 0 !important;
                }
                [class*="chatbot-header"] button[aria-label*="close"]:hover,
                [class*="chatbot-header"] button[aria-label*="Close"]:hover,
                [class*="header-actions"] button[aria-label*="close"]:hover,
                [class*="header-controls"] button[aria-label*="close"]:hover,
                [class*="chatbot-header"] button[aria-label*="reset"]:hover,
                [class*="chatbot-header"] button[aria-label*="Reset"]:hover,
                [class*="header-actions"] button[aria-label*="reset"]:hover,
                [class*="header-controls"] button[aria-label*="reset"]:hover {
                    background: rgba(0, 0, 0, 0.05) !important;
                    border-color: rgba(0, 0, 0, 0.2) !important;
                    transform: scale(1.05) !important;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15) !important;
                    color: #333 !important;
                }
                [class*="chatbot-header"] button svg,
                [class*="header-actions"] button svg,
                [class*="header-controls"] button svg {
                    width: 18px !important;
                    height: 18px !important;
                    stroke-width: 2 !important;
                    flex-shrink: 0 !important;
                }
            `
        }
        // If chatbotConfig exists, merge theme from it
        if (dbResponse.chatbotConfig) {
            try {
                const parsedConfig = JSON.parse(dbResponse.chatbotConfig)
                if (parsedConfig.theme) {
                    // Merge user theme with default theme
                    return {
                        ...defaultTheme,
                        ...parsedConfig.theme,
                        button: { ...defaultTheme.button, ...parsedConfig.theme.button },
                        chatWindow: {
                            ...defaultTheme.chatWindow,
                            ...parsedConfig.theme.chatWindow,
                            footer: {
                                ...defaultTheme.chatWindow.footer,
                                ...parsedConfig.theme.chatWindow?.footer
                            }
                        }
                    }
                }
            } catch (e) {
                // If parsing fails, return default theme
                logWarn(`Error parsing chatbotConfig for theme: ${getErrorMessage(e)}`).catch(() => { })
            }
        }
        // Return default theme only (no sensitive data)
        return defaultTheme
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.getEmbedTheme - ${getErrorMessage(error)}`
        )
    }
}

const _checkAndUpdateDocumentStoreUsage = async (chatflow: ChatFlow, orgId: string) => {
    const parsedFlowData: IReactFlowObject = JSON.parse(chatflow.flowData)
    const nodes = parsedFlowData.nodes
    // from the nodes array find if there is a node with name == documentStore)
    const node = nodes.length > 0 && nodes.find((node) => node.data.name === 'documentStore')
    if (!node || !node.data || !node.data.inputs || node.data.inputs['selectedStore'] === undefined) {
        await documentStoreService.updateDocumentStoreUsage(chatflow.guid, undefined, orgId)
    } else {
        await documentStoreService.updateDocumentStoreUsage(chatflow.guid, node.data.inputs['selectedStore'], orgId)
    }
}

const checkIfChatflowHasChanged = async (chatflowId: string, lastUpdatedDateTime: string | undefined, orgId: string): Promise<any> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        //**
        const chatflow = await dataSource.getRepository(ChatFlow).findOneBy({
            guid: chatflowId
        })
        if (!chatflow) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found`)
        }
        // Handle undefined or empty lastUpdatedDateTime
        if (!lastUpdatedDateTime || lastUpdatedDateTime === 'undefined' || lastUpdatedDateTime === 'null') {
            // If no lastUpdatedDateTime provided, consider it changed if chatflow has been modified
            return { hasChanged: chatflow.last_modified_on !== null && chatflow.last_modified_on !== undefined }
        }

        // Both last_modified_on and lastUpdatedDateTime are numeric timestamps (milliseconds)
        // Compare them as numbers for accurate comparison
        // Note: If last_modified_on is null, use created_on (matches frontend behavior where updatedDate falls back to createdDate)
        let dbTimestamp: number | null = null
        const timestampToCompare =
            chatflow.last_modified_on !== undefined && chatflow.last_modified_on !== null ? chatflow.last_modified_on : chatflow.created_on

        if (timestampToCompare !== undefined && timestampToCompare !== null) {
            try {
                const numTimestamp = typeof timestampToCompare === 'string' ? parseFloat(timestampToCompare) : timestampToCompare

                // Validate timestamp is valid
                if (!isNaN(numTimestamp) && isFinite(numTimestamp) && numTimestamp >= 0 && numTimestamp <= 4102444800000) {
                    dbTimestamp = numTimestamp
                }
            } catch (error) {
                // If conversion fails, treat as null
                dbTimestamp = null
            }
        }

        // Convert frontend timestamp to number for comparison
        let frontendTimestamp: number | null = null
        try {
            const parsed = parseFloat(lastUpdatedDateTime)
            if (!isNaN(parsed) && isFinite(parsed) && parsed >= 0 && parsed <= 4102444800000) {
                frontendTimestamp = parsed
            }
        } catch (error) {
            // If conversion fails, treat as null
            frontendTimestamp = null
        }

        // Compare numeric timestamps
        // If either is null, consider it changed
        if (dbTimestamp === null || frontendTimestamp === null) {
            return { hasChanged: dbTimestamp !== frontendTimestamp }
        }

        // Compare timestamps (allow small difference for rounding errors)
        const difference = Math.abs(dbTimestamp - frontendTimestamp)
        return { hasChanged: difference > 1000 } // Changed if difference is more than 1 second
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.checkIfChatflowHasChanged - ${getErrorMessage(error)}`
        )
    }
}

export default {
    checkIfChatflowIsValidForStreaming,
    checkIfChatflowIsValidForUploads,
    deleteChatflow,
    getAllChatflows,
    getAllChatflowsCount,
    getChatflowByApiKey,
    getChatflowById,
    saveChatflow,
    updateChatflow,
    getSinglePublicChatbotConfig,
    getEmbedTheme,
    checkIfChatflowHasChanged,
    getAllChatflowsCountByOrganization
}
