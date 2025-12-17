import { ICommonObject } from 'autonomous-components'
import { StatusCodes } from 'http-status-codes'
import { cloneDeep, isEqual, uniqWith } from 'lodash'
import OpenAI from 'openai'
import { DeleteResult, QueryRunner } from 'typeorm'
import { Assistant } from '../../database/entities/Assistant'
import { Credential } from '../../database/entities/Credential'
import { DocumentStore } from '../../database/entities/DocumentStore'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { getErrorMessage } from '../../errors/utils'
import { AssistantType } from '../../Interface'
import { INodeParams } from 'autonomous-components'
import { AUTONOMOUS_COUNTER_STATUS, AUTONOMOUS_METRIC_COUNTERS } from '../../Interface.Metrics'
import { databaseEntities, decryptCredentialData } from '../../utils'
import { INPUT_PARAMS_TYPE } from '../../utils/constants'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { ASSISTANT_PROMPT_GENERATOR } from '../../utils/prompt'
import { checkUsageLimit } from '../../utils/quotaUsage'
import nodesService from '../nodes'
import { getDataSource } from '../../DataSource'
import { generateGuid } from '../../utils/guidGenerator'
import { getColumnName } from '../../database/utils/oracle-query-helper'
import { assistantLog } from '../../utils/logger/module-methods'

const createAssistant = async (requestBody: any, orgId: string, userId?: string): Promise<Assistant> => {
    try {
        const appServer = getRunningExpressApp()
        const dataSource = getDataSource(parseInt(orgId))
        if (!requestBody.details) {
            throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Invalid request body`)
        }
        const assistantDetails = JSON.parse(requestBody.details)

        if (requestBody.type === 'CUSTOM') {
            // Map frontend 'id' (which is actually guid) to 'guid', and remove 'id' to prevent it from being assigned to numeric id field
            const { id, ...requestBodyWithoutId } = requestBody
            const requestBodyWithGuid = id ? { ...requestBodyWithoutId, guid: id } : requestBodyWithoutId
            const newAssistant = new Assistant()
            Object.assign(newAssistant, requestBodyWithGuid)
            // Generate GUID if not provided
            if (!newAssistant.guid) {
                newAssistant.guid = generateGuid()
            }
            // Handle credential: For CUSTOM assistants, credential is optional
            // Frontend may send UUID (from uuidv4()) or a valid GUID, or null/empty
            // If credential is provided, validate it's a guid (15 chars), not a UUID
            if (newAssistant.credential) {
                // If credential is a UUID (36 chars) or empty string, clear it (CUSTOM assistants don't require credential)
                if (newAssistant.credential.length !== 15 || newAssistant.credential.trim() === '') {
                    // Frontend is sending UUID or empty - for CUSTOM assistants, we can just clear it
                    newAssistant.credential = undefined
                } else {
                    // Verify the credential exists if it's a valid GUID
                    const credential = await dataSource.getRepository(Credential).findOneBy({
                        guid: newAssistant.credential
                    })
                    if (!credential) {
                        // Credential not found - clear it for CUSTOM assistants
                        newAssistant.credential = undefined
                    }
                }
            }
            // Set created_by and created_on
            const userIdNum = userId ? parseInt(userId) : undefined
            if (userIdNum === undefined) {
                throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'User ID is required')
            }
            newAssistant.created_by = userIdNum
            newAssistant.created_on = Date.now()

            // Extract name from details JSON and populate display_name (max 50 chars)
            if (assistantDetails.name) {
                newAssistant.display_name = assistantDetails.name.substring(0, 50)
            }

            const assistant = dataSource.getRepository(Assistant).create(newAssistant)

            // Log database operation
            const saveStartTime = Date.now()
            let dbResponse: Assistant
            try {
                dbResponse = await dataSource.getRepository(Assistant).save(assistant)
                const saveDuration = Date.now() - saveStartTime

                try {
                    const { databaseLog } = await import('../../utils/logger/module-methods')
                    await databaseLog('info', 'Database save operation (Assistant)', {
                        userId: userIdNum.toString(),
                        orgId: orgId,
                        operation: 'save',
                        table: 'auto_assistant',
                        durationMs: saveDuration,
                        success: true,
                        recordId: dbResponse.guid
                    }).catch(() => {})
                } catch (logError) {
                    // Silently fail
                }
            } catch (dbError) {
                const saveDuration = Date.now() - saveStartTime

                try {
                    const { databaseLog } = await import('../../utils/logger/module-methods')
                    await databaseLog('error', 'Database save operation failed (Assistant)', {
                        userId: userIdNum.toString(),
                        orgId: orgId,
                        operation: 'save',
                        table: 'auto_assistant',
                        durationMs: saveDuration,
                        success: false,
                        error: dbError instanceof Error ? dbError.message : String(dbError)
                    }).catch(() => {})
                } catch (logError) {
                    // Silently fail
                }
                throw dbError
            }

            // Telemetry removed
            appServer.metricsProvider?.incrementCounter(AUTONOMOUS_METRIC_COUNTERS.ASSISTANT_CREATED, {
                status: AUTONOMOUS_COUNTER_STATUS.SUCCESS
            })

            // Log assistant creation
            try {
                const assistantDetails = dbResponse.details ? JSON.parse(dbResponse.details) : {}
                await assistantLog('info', 'Assistant created', {
                    userId: userIdNum.toString(),
                    orgId,
                    assistantId: dbResponse.guid,
                    assistantType: dbResponse.type || 'CUSTOM',
                    assistantName: assistantDetails.name || 'Unnamed'
                }).catch(() => {}) // Don't fail if logging fails
            } catch (logError) {
                // Silently fail - logging should not break assistant creation
            }

            return dbResponse
        }

        try {
            // Handle credential: frontend sends 'id' (which is actually guid from transformEntityForResponse)
            // Validate credential is a guid (15 chars), not a UUID
            let credentialGuid = requestBody.credential
            if (!credentialGuid) {
                throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Credential is required')
            }
            // If credential is a UUID (36 chars), it's invalid - we need a 15-char guid
            if (credentialGuid.length !== 15) {
                throw new InternalAutonomousError(
                    StatusCodes.BAD_REQUEST,
                    `Invalid credential ID. Expected 15-character GUID, got ${credentialGuid.length}-character value. Please select a valid credential.`
                )
            }

            const credential = await dataSource.getRepository(Credential).findOneBy({
                guid: credentialGuid
            })

            if (!credential) {
                throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Credential ${credentialGuid} not found`)
            }

            // Decrpyt credentialData
            const decryptedCredentialData = await decryptCredentialData(credential.encryptedData)
            const openAIApiKey = decryptedCredentialData['openAIApiKey']
            if (!openAIApiKey) {
                throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `OpenAI ApiKey not found`)
            }
            const openai = new OpenAI({ apiKey: openAIApiKey })

            // Prepare tools
            let tools = []
            if (assistantDetails.tools) {
                for (const tool of assistantDetails.tools ?? []) {
                    tools.push({
                        type: tool
                    })
                }
            }

            // Save tool_resources to be stored later into database
            const savedToolResources = cloneDeep(assistantDetails.tool_resources)

            // Cleanup tool_resources for creating assistant
            if (assistantDetails.tool_resources) {
                for (const toolResource in assistantDetails.tool_resources) {
                    if (toolResource === 'file_search') {
                        assistantDetails.tool_resources['file_search'] = {
                            vector_store_ids: assistantDetails.tool_resources['file_search'].vector_store_ids
                        }
                    } else if (toolResource === 'code_interpreter') {
                        assistantDetails.tool_resources['code_interpreter'] = {
                            file_ids: assistantDetails.tool_resources['code_interpreter'].file_ids
                        }
                    }
                }
            }

            // If the assistant doesn't exist, create a new one
            if (!assistantDetails.id) {
                const newAssistant = await openai.beta.assistants.create({
                    name: assistantDetails.name,
                    description: assistantDetails.description,
                    instructions: assistantDetails.instructions,
                    model: assistantDetails.model,
                    tools,
                    tool_resources: assistantDetails.tool_resources,
                    temperature: assistantDetails.temperature,
                    top_p: assistantDetails.top_p
                })
                assistantDetails.id = newAssistant.id
            } else {
                const retrievedAssistant = await openai.beta.assistants.retrieve(assistantDetails.id)
                let filteredTools = uniqWith([...retrievedAssistant.tools.filter((tool) => tool.type === 'function'), ...tools], isEqual)
                // Remove empty functions
                filteredTools = filteredTools.filter((tool) => !(tool.type === 'function' && !(tool as any).function))

                await openai.beta.assistants.update(assistantDetails.id, {
                    name: assistantDetails.name,
                    description: assistantDetails.description ?? '',
                    instructions: assistantDetails.instructions ?? '',
                    model: assistantDetails.model,
                    tools: filteredTools,
                    tool_resources: assistantDetails.tool_resources,
                    temperature: assistantDetails.temperature,
                    top_p: assistantDetails.top_p
                })
            }

            const newAssistantDetails = {
                ...assistantDetails
            }
            if (savedToolResources) newAssistantDetails.tool_resources = savedToolResources

            requestBody.details = JSON.stringify(newAssistantDetails)
        } catch (error) {
            throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error creating new assistant - ${getErrorMessage(error)}`)
        }
        const newAssistant = new Assistant()
        Object.assign(newAssistant, requestBody)
        // Generate GUID if not provided
        if (!newAssistant.guid) {
            newAssistant.guid = generateGuid()
        }
        // Set created_by and created_on
        const userIdNum = userId ? parseInt(userId) : undefined
        if (userIdNum === undefined) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'User ID is required')
        }
        newAssistant.created_by = userIdNum
        newAssistant.created_on = Date.now()

        // Extract name from details JSON and populate display_name (max 50 chars)
        if (newAssistant.details) {
            try {
                const details = JSON.parse(newAssistant.details)
                if (details.name) {
                    newAssistant.display_name = details.name.substring(0, 50)
                }
            } catch (e) {
                // If details is not valid JSON, skip display_name population
            }
        }

        const assistant = dataSource.getRepository(Assistant).create(newAssistant)
        const dbResponse = await dataSource.getRepository(Assistant).save(assistant)

        // Telemetry removed

        appServer.metricsProvider?.incrementCounter(AUTONOMOUS_METRIC_COUNTERS.ASSISTANT_CREATED, {
            status: AUTONOMOUS_COUNTER_STATUS.SUCCESS
        })

        // Log assistant creation
        try {
            const assistantDetails = dbResponse.details ? JSON.parse(dbResponse.details) : {}
            await assistantLog('info', 'Assistant created', {
                userId: userIdNum.toString(),
                orgId,
                assistantId: dbResponse.guid,
                assistantType: dbResponse.type || 'CUSTOM',
                assistantName: assistantDetails.name || 'Unnamed'
            }).catch(() => {}) // Don't fail if logging fails
        } catch (logError) {
            // Silently fail - logging should not break assistant creation
        }

        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: assistantsService.createAssistant - ${getErrorMessage(error)}`
        )
    }
}

const deleteAssistant = async (assistantId: string, isDeleteBoth: any, orgId: string, userId?: number): Promise<DeleteResult> => {
    try {
        const appServer = getRunningExpressApp()
        const dataSource = getDataSource(parseInt(orgId))
        const whereClause: any = {
            guid: assistantId
        }
        // User-based isolation: only allow deletion of own assistants
        if (userId !== undefined) {
            whereClause.created_by = userId
        }
        const assistant = await dataSource.getRepository(Assistant).findOneBy(whereClause)
        if (!assistant) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Assistant ${assistantId} not found`)
        }
        if (assistant.type === 'CUSTOM') {
            const dbResponse = await dataSource.getRepository(Assistant).delete({ guid: assistantId })

            // Log assistant deletion
            try {
                const assistantDetails = assistant.details ? JSON.parse(assistant.details) : {}
                await assistantLog('info', 'Assistant deleted', {
                    userId: userId?.toString() || 'unknown',
                    orgId,
                    assistantId: assistant.guid,
                    assistantType: assistant.type || 'CUSTOM',
                    assistantName: assistantDetails.name || 'Unnamed',
                    isDeleteBoth: isDeleteBoth ? 'true' : 'false'
                }).catch(() => {}) // Don't fail if logging fails
            } catch (logError) {
                // Silently fail - logging should not break assistant deletion
            }

            return dbResponse
        }
        try {
            const assistantDetails = JSON.parse(assistant.details)
            // For OPENAI assistants, credential is required
            // For CUSTOM assistants, credential may be null
            const credentialGuid = assistant.credential
            if (credentialGuid) {
                // Validate credential guid is 15 chars (should already be valid from database, but check for safety)
                if (credentialGuid.length !== 15) {
                    throw new InternalAutonomousError(
                        StatusCodes.BAD_REQUEST,
                        `Invalid credential ID in database. Expected 15-character GUID, got ${credentialGuid.length}-character value.`
                    )
                }

                const credential = await dataSource.getRepository(Credential).findOneBy({
                    guid: credentialGuid
                })

                if (!credential) {
                    throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Credential ${credentialGuid} not found`)
                }

                // Decrpyt credentialData
                const decryptedCredentialData = await decryptCredentialData(credential.encryptedData)
                const openAIApiKey = decryptedCredentialData['openAIApiKey']
                if (!openAIApiKey) {
                    throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `OpenAI ApiKey not found`)
                }

                const openai = new OpenAI({ apiKey: openAIApiKey })
                const dbResponse = await dataSource.getRepository(Assistant).delete({ guid: assistantId })
                if (isDeleteBoth) await openai.beta.assistants.del(assistantDetails.id)

                // Log assistant deletion
                try {
                    await assistantLog('info', 'Assistant deleted', {
                        userId: userId?.toString() || 'unknown',
                        orgId,
                        assistantId: assistant.guid,
                        assistantType: assistant.type || 'OPENAI',
                        assistantName: assistantDetails.name || 'Unnamed',
                        isDeleteBoth: isDeleteBoth ? 'true' : 'false',
                        openaiAssistantId: assistantDetails.id
                    }).catch(() => {}) // Don't fail if logging fails
                } catch (logError) {
                    // Silently fail - logging should not break assistant deletion
                }

                return dbResponse
            } else {
                // No credential - just delete from database (for CUSTOM assistants)
                const dbResponse = await dataSource.getRepository(Assistant).delete({ guid: assistantId })
                return dbResponse
            }
        } catch (error: any) {
            throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error deleting assistant - ${getErrorMessage(error)}`)
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: assistantsService.deleteAssistant - ${getErrorMessage(error)}`
        )
    }
}

async function getAssistantsCountByOrganization(type: AssistantType, organizationId: string): Promise<number> {
    try {
        const dataSource = getDataSource(parseInt(organizationId))

        // For autonomous server, use orgId directly
        // Handle CLOB comparison for Oracle by using TO_CHAR() if needed
        const dbType = (dataSource.options.type as 'postgres' | 'oracle') || 'postgres'
        const columnName = getColumnName('type', dbType)
        const typeCondition = dbType === 'oracle' ? `TO_CHAR(assistant.${columnName}) = :type` : `assistant.${columnName} = :type`

        const assistantsCount = await dataSource
            .getRepository(Assistant)
            .createQueryBuilder('assistant')
            .where(typeCondition, { type })
            .getCount()

        return assistantsCount
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: assistantsService.getAssistantsCountByOrganization - ${getErrorMessage(error)}`
        )
    }
}

const getAllAssistants = async (orgId: string, userId?: number, type?: AssistantType): Promise<Assistant[]> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))

        // Handle CLOB comparison for Oracle by using TO_CHAR() if needed
        const dbType = (dataSource.options.type as 'postgres' | 'oracle') || 'postgres'
        let queryBuilder = dataSource.getRepository(Assistant).createQueryBuilder('assistant')

        if (type) {
            const columnName = getColumnName('type', dbType)
            const typeCondition = dbType === 'oracle' ? `TO_CHAR(assistant.${columnName}) = :type` : `assistant.${columnName} = :type`
            queryBuilder = queryBuilder.where(typeCondition, { type })
        }

        // Org-level sharing: NO userId filtering
        const data = await queryBuilder.getMany()

        // Add isCreator flag
        return data.map((assistant) => ({
            ...assistant,
            isCreator: userId && assistant.created_by === userId,
            creatorId: assistant.created_by
        })) as Assistant[]
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: assistantsService.getAllAssistants - ${getErrorMessage(error)}`
        )
    }
}

const getAllAssistantsCount = async (orgId: string, type?: AssistantType): Promise<number> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))

        // Handle CLOB comparison for Oracle by using TO_CHAR() if needed
        const dbType = (dataSource.options.type as 'postgres' | 'oracle') || 'postgres'
        let queryBuilder = dataSource.getRepository(Assistant).createQueryBuilder('assistant')

        if (type) {
            const columnName = getColumnName('type', dbType)
            const typeCondition = dbType === 'oracle' ? `TO_CHAR(assistant.${columnName}) = :type` : `assistant.${columnName} = :type`
            queryBuilder = queryBuilder.where(typeCondition, { type })
        }

        const dbResponse = await queryBuilder.getCount()
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: assistantsService.getAllAssistantsCount - ${getErrorMessage(error)}`
        )
    }
}

const getAssistantById = async (assistantId: string, orgId: string, userId?: number): Promise<Assistant> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))

        // Org-level sharing: Allow access to any assistant in the org
        const dbResponse = await dataSource.getRepository(Assistant).findOneBy({
            guid: assistantId
        })

        if (!dbResponse) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Assistant ${assistantId} not found`)
        }

        // Add isCreator flag
        return {
            ...dbResponse,
            isCreator: userId && dbResponse.created_by === userId,
            creatorId: dbResponse.created_by
        } as Assistant
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: assistantsService.getAssistantById - ${getErrorMessage(error)}`
        )
    }
}

const updateAssistant = async (assistantId: string, requestBody: any, orgId: string, userId?: string): Promise<Assistant> => {
    try {
        const appServer = getRunningExpressApp()
        const dataSource = getDataSource(parseInt(orgId))
        const userIdNum = userId ? parseInt(userId) : undefined
        const whereClause: any = {
            guid: assistantId
        }
        // User-based isolation: only allow update of own assistants
        if (userIdNum !== undefined) {
            whereClause.created_by = userIdNum
        }
        const assistant = await dataSource.getRepository(Assistant).findOneBy(whereClause)

        if (!assistant) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Assistant ${assistantId} not found`)
        }

        if (assistant.type === 'CUSTOM') {
            const body = requestBody
            // Map frontend 'id' (which is actually guid) to 'guid', and remove 'id' to prevent it from being assigned to numeric id field
            const { id, ...bodyWithoutId } = body
            const bodyWithGuid = id ? { ...bodyWithoutId, guid: id } : bodyWithoutId
            const updateAssistant = new Assistant()
            Object.assign(updateAssistant, bodyWithGuid)
            // Handle credential: For CUSTOM assistants, credential is optional
            // If provided, validate it's a guid (15 chars), not a UUID
            // If UUID or empty, clear it (set to undefined)
            if (updateAssistant.credential) {
                if (updateAssistant.credential.length !== 15 || updateAssistant.credential.trim() === '') {
                    // Invalid credential (UUID or empty) - clear it for CUSTOM assistants
                    updateAssistant.credential = undefined
                } else {
                    // Verify the credential exists if it's a valid GUID
                    const credential = await dataSource.getRepository(Credential).findOneBy({
                        guid: updateAssistant.credential
                    })
                    if (!credential) {
                        // Credential not found - clear it for CUSTOM assistants
                        updateAssistant.credential = undefined
                    }
                }
            }
            // Set last_modified_by and last_modified_on
            if (userIdNum !== undefined) {
                updateAssistant.last_modified_by = userIdNum
                updateAssistant.last_modified_on = Date.now()
            }

            // Extract name from details JSON and populate display_name (max 50 chars)
            if (updateAssistant.details) {
                try {
                    const assistantDetails = JSON.parse(updateAssistant.details)
                    if (assistantDetails.name) {
                        updateAssistant.display_name = assistantDetails.name.substring(0, 50)
                    }
                } catch (e) {
                    // If details is not valid JSON, skip display_name population
                }
            }

            dataSource.getRepository(Assistant).merge(assistant, updateAssistant)
            const dbResponse = await dataSource.getRepository(Assistant).save(assistant)
            return dbResponse
        }

        try {
            const openAIAssistantId = JSON.parse(assistant.details)?.id
            const body = requestBody
            const assistantDetails = JSON.parse(body.details)

            // Handle credential: frontend sends 'id' (which is actually guid from transformEntityForResponse)
            // Validate credential is a guid (15 chars), not a UUID
            let credentialGuid = body.credential
            if (credentialGuid && credentialGuid.length !== 15) {
                throw new InternalAutonomousError(
                    StatusCodes.BAD_REQUEST,
                    `Invalid credential ID. Expected 15-character GUID, got ${credentialGuid.length}-character value. Please select a valid credential.`
                )
            }

            const credential = await dataSource.getRepository(Credential).findOneBy({
                guid: credentialGuid
            })

            if (!credential) {
                throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Credential ${credentialGuid} not found`)
            }

            // Decrpyt credentialData
            const decryptedCredentialData = await decryptCredentialData(credential.encryptedData)
            const openAIApiKey = decryptedCredentialData['openAIApiKey']
            if (!openAIApiKey) {
                throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `OpenAI ApiKey not found`)
            }

            const openai = new OpenAI({ apiKey: openAIApiKey })

            let tools = []
            if (assistantDetails.tools) {
                for (const tool of assistantDetails.tools ?? []) {
                    tools.push({
                        type: tool
                    })
                }
            }

            // Save tool_resources to be stored later into database
            const savedToolResources = cloneDeep(assistantDetails.tool_resources)

            // Cleanup tool_resources before updating
            if (assistantDetails.tool_resources) {
                for (const toolResource in assistantDetails.tool_resources) {
                    if (toolResource === 'file_search') {
                        assistantDetails.tool_resources['file_search'] = {
                            vector_store_ids: assistantDetails.tool_resources['file_search'].vector_store_ids
                        }
                    } else if (toolResource === 'code_interpreter') {
                        assistantDetails.tool_resources['code_interpreter'] = {
                            file_ids: assistantDetails.tool_resources['code_interpreter'].file_ids
                        }
                    }
                }
            }

            const retrievedAssistant = await openai.beta.assistants.retrieve(openAIAssistantId)
            let filteredTools = uniqWith([...retrievedAssistant.tools.filter((tool) => tool.type === 'function'), ...tools], isEqual)
            filteredTools = filteredTools.filter((tool) => !(tool.type === 'function' && !(tool as any).function))

            await openai.beta.assistants.update(openAIAssistantId, {
                name: assistantDetails.name,
                description: assistantDetails.description,
                instructions: assistantDetails.instructions,
                model: assistantDetails.model,
                tools: filteredTools,
                tool_resources: assistantDetails.tool_resources,
                temperature: assistantDetails.temperature,
                top_p: assistantDetails.top_p
            })

            const newAssistantDetails = {
                ...assistantDetails,
                id: openAIAssistantId
            }
            if (savedToolResources) newAssistantDetails.tool_resources = savedToolResources

            const updateAssistant = new Assistant()
            body.details = JSON.stringify(newAssistantDetails)
            Object.assign(updateAssistant, body)
            // Set last_modified_by and last_modified_on
            if (userIdNum !== undefined) {
                updateAssistant.last_modified_by = userIdNum
                updateAssistant.last_modified_on = Date.now()
            }

            // Extract name from details JSON and populate display_name (max 50 chars)
            if (newAssistantDetails.name) {
                updateAssistant.display_name = newAssistantDetails.name.substring(0, 50)
            }

            dataSource.getRepository(Assistant).merge(assistant, updateAssistant)
            const dbResponse = await dataSource.getRepository(Assistant).save(assistant)

            // Log assistant update
            try {
                const assistantDetails = dbResponse.details ? JSON.parse(dbResponse.details) : {}
                await assistantLog('info', 'Assistant updated', {
                    userId: userIdNum?.toString() || 'unknown',
                    orgId,
                    assistantId: dbResponse.guid,
                    assistantType: dbResponse.type || 'CUSTOM',
                    assistantName: assistantDetails.name || 'Unnamed'
                }).catch(() => {}) // Don't fail if logging fails
            } catch (logError) {
                // Silently fail - logging should not break assistant update
            }

            return dbResponse
        } catch (error) {
            throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error updating assistant - ${getErrorMessage(error)}`)
        }
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: assistantsService.updateAssistant - ${getErrorMessage(error)}`
        )
    }
}

const importAssistants = async (
    newAssistants: Partial<Assistant>[],
    orgId: string,
    userId: string,
    queryRunner?: QueryRunner
): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const dataSource = getDataSource(parseInt(orgId))
        const repository = queryRunner ? queryRunner.manager.getRepository(Assistant) : dataSource.getRepository(Assistant)

        // step 1 - check whether array is zero
        if (newAssistants.length == 0) return

        await checkUsageLimit('flows', appServer.usageCacheManager, newAssistants.length)

        // step 2 - check whether guids are duplicate in database
        let guids = '('
        let count: number = 0
        const lastCount = newAssistants.length - 1
        newAssistants.forEach((newAssistant) => {
            const guid = newAssistant.guid || generateGuid()
            guids += `'${guid}'`
            if (lastCount != count) guids += ','
            if (lastCount == count) guids += ')'
            count += 1
        })

        const selectResponse = await repository
            .createQueryBuilder('assistant')
            .select('assistant.guid')
            .where(`assistant.guid IN ${guids}`)
            .getMany()
        const foundGuids = selectResponse.map((response) => {
            return response.guid
        })

        // step 3 - remove guids that are duplicate and generate new ones, set created_by and created_on
        const userIdNum = parseInt(userId)
        const prepVariables: Partial<Assistant>[] = newAssistants.map((newAssistant) => {
            let guid: string = newAssistant.guid || generateGuid()
            if (foundGuids.includes(guid)) {
                guid = generateGuid()
            }
            newAssistant.guid = guid
            newAssistant.created_by = userIdNum
            newAssistant.created_on = Date.now()
            return newAssistant
        })

        // step 4 - transactional insert array of entities
        const insertResponse = await repository.insert(prepVariables)

        return insertResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: assistantsService.importAssistants - ${getErrorMessage(error)}`
        )
    }
}

const getChatModels = async (): Promise<any> => {
    try {
        const dbResponse = await nodesService.getAllNodesForCategory('Chat Models')
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: assistantsService.getChatModels - ${getErrorMessage(error)}`
        )
    }
}

const getDocumentStores = async (orgId: string): Promise<any> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const stores = await dataSource.getRepository(DocumentStore).findBy({})
        const returnData = []
        for (const store of stores) {
            if (store.status === 'UPSERTED') {
                const obj = {
                    name: store.guid,
                    label: store.name,
                    description: store.description
                }
                returnData.push(obj)
            }
        }
        return returnData
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: assistantsService.getDocumentStores - ${getErrorMessage(error)}`
        )
    }
}

const getTools = async (): Promise<any> => {
    try {
        const tools = await nodesService.getAllNodesForCategory('Tools')
        const mcpTools = await nodesService.getAllNodesForCategory('Tools (MCP)')

        // filter out those tools that input params type are not in the list
        const filteredTools = [...tools, ...mcpTools].filter((tool) => {
            const inputs = tool.inputs || []
            return inputs.every((input: INodeParams) => INPUT_PARAMS_TYPE.includes(input.type))
        })
        return filteredTools
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: assistantsService.getTools - ${getErrorMessage(error)}`
        )
    }
}

const generateAssistantInstruction = async (task: string, selectedChatModel: ICommonObject, orgId: string): Promise<ICommonObject> => {
    try {
        const appServer = getRunningExpressApp()
        const appDataSource = getDataSource(parseInt(orgId))

        if (selectedChatModel && Object.keys(selectedChatModel).length > 0) {
            const nodeInstanceFilePath = appServer.nodesPool.componentNodes[selectedChatModel.name].filePath as string
            const nodeModule = await import(nodeInstanceFilePath)
            const newNodeInstance = new nodeModule.nodeClass()
            const nodeData = {
                credential: selectedChatModel.credential || selectedChatModel.inputs['AUTONOMOUS_CREDENTIAL_ID'] || undefined,
                inputs: selectedChatModel.inputs,
                id: `${selectedChatModel.name}_0`
            }
            const options: ICommonObject = {
                appDataSource: appDataSource,
                databaseEntities,
                logger: undefined
            }
            const llmNodeInstance = await newNodeInstance.init(nodeData, '', options)
            const startTime = Date.now()
            const response = await llmNodeInstance.invoke([
                {
                    role: 'user',
                    content: ASSISTANT_PROMPT_GENERATOR.replace('{{task}}', task)
                }
            ])
            const endTime = Date.now()
            const processingTimeMs = endTime - startTime
            const content = response?.content || response.kwargs?.content

            // Track LLM usage
            try {
                const { trackLLMUsage, extractUsageMetadata, extractProviderAndModel } = await import('../../utils/llm-usage-tracker')
                const { provider, model } = extractProviderAndModel(nodeData, response)
                const { promptTokens, completionTokens, totalTokens } = extractUsageMetadata(response)

                if (totalTokens > 0) {
                    await trackLLMUsage({
                        requestId: `assistant_${Date.now()}`,
                        orgId,
                        userId: '0', // Assistant generation doesn't have userId
                        feature: 'assistant',
                        nodeName: selectedChatModel.name,
                        location: 'instruction_generation',
                        provider,
                        model,
                        requestType: 'chat',
                        promptTokens,
                        completionTokens,
                        totalTokens,
                        processingTimeMs,
                        responseLength: typeof content === 'string' ? content.length : 0,
                        success: true
                    })
                }
            } catch (error) {
                // Don't fail if tracking fails
                console.error('Error tracking LLM usage in assistant generation:', error)
            }

            return { content }
        }

        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: assistantsService.generateAssistantInstruction - Error generating tool description`
        )
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: assistantsService.generateAssistantInstruction - ${getErrorMessage(error)}`
        )
    }
}

export default {
    createAssistant,
    deleteAssistant,
    getAllAssistants,
    getAllAssistantsCount,
    getAssistantById,
    updateAssistant,
    importAssistants,
    getChatModels,
    getDocumentStores,
    getTools,
    generateAssistantInstruction,
    getAssistantsCountByOrganization
}
