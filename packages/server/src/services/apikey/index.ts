import { StatusCodes } from 'http-status-codes'
import { generateAPIKey, generateSecretHash } from '../../utils/apiKey'
import { addChatflowsCount } from '../../utils/addChatflowsCount'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { getErrorMessage } from '../../errors/utils'
import { ApiKey } from '../../database/entities/ApiKey'
import { getDataSource } from '../../DataSource'
import { generateGuid } from '../../utils/guidGenerator'

const getAllApiKeysFromDB = async (orgId: string, userId?: number, page: number = -1, limit: number = -1) => {
    const dataSource = getDataSource(parseInt(orgId))
    const queryBuilder = dataSource.getRepository(ApiKey).createQueryBuilder('api_key').orderBy('api_key.last_modified_on', 'DESC')

    // User-based isolation: filter by created_by
    if (userId !== undefined) {
        queryBuilder.andWhere('api_key.created_by = :userId', { userId })
    }

    if (page > 0 && limit > 0) {
        queryBuilder.skip((page - 1) * limit)
        queryBuilder.take(limit)
    }
    const [data, total] = await queryBuilder.getManyAndCount()
    const keysWithChatflows = await addChatflowsCount(data, orgId)

    if (page > 0 && limit > 0) {
        return { total, data: keysWithChatflows }
    } else {
        return keysWithChatflows
    }
}

const getAllApiKeys = async (
    orgId: string,
    userId?: string | number,
    autoCreateNewKey?: boolean,
    page: number = -1,
    limit: number = -1
) => {
    try {
        const userIdNum = userId ? (typeof userId === 'number' ? userId : parseInt(userId)) : undefined
        let keys = await getAllApiKeysFromDB(orgId, userIdNum, page, limit)
        const isEmpty = keys?.total === 0 || (Array.isArray(keys) && keys?.length === 0)
        // Only auto-create if userId is available and autoCreateNewKey is true
        if (isEmpty && autoCreateNewKey && userIdNum !== undefined) {
            const dataSource = getDataSource(parseInt(orgId))
            // Check if a key with name "DefaultKey" already exists
            const existingKey = await dataSource.getRepository(ApiKey).findOne({
                where: { keyName: 'DefaultKey' }
            })

            if (existingKey) {
                if (existingKey.created_by === userIdNum) {
                    // Key exists and belongs to current user, do nothing (they already have it)
                } else {
                    // Key exists but belongs to another user - create with unique name
                    let keyName = 'DefaultKey'
                    let counter = 1
                    let keyNameExists = true
                    while (keyNameExists) {
                        const checkKey = await dataSource.getRepository(ApiKey).findOne({
                            where: { keyName }
                        })
                        if (!checkKey) {
                            keyNameExists = false
                        } else {
                            keyName = `DefaultKey_${counter}`
                            counter++
                        }
                    }
                    await createApiKey(keyName, orgId, userIdNum.toString())
                }
            } else {
                // No key exists, create a new one
                await createApiKey('DefaultKey', orgId, userIdNum.toString())
            }
            keys = await getAllApiKeysFromDB(orgId, userIdNum, page, limit)
        }
        return keys
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: apikeyService.getAllApiKeys - ${getErrorMessage(error)}`
        )
    }
}

const getApiKey = async (apiKey: string, orgId: string) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const currentKey = await dataSource.getRepository(ApiKey).findOneBy({
            apiKey: apiKey
        })
        if (!currentKey) {
            return undefined
        }
        return currentKey
    } catch (error) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: apikeyService.getApiKey - ${getErrorMessage(error)}`)
    }
}

const getApiKeyById = async (apiKeyId: string, orgId: string, userId?: number) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const whereClause: any = {
            guid: apiKeyId
        }
        // User-based isolation: filter by created_by
        if (userId !== undefined) {
            whereClause.created_by = userId
        }
        const currentKey = await dataSource.getRepository(ApiKey).findOneBy(whereClause)
        if (!currentKey) {
            return undefined
        }
        return currentKey
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: apikeyService.getApiKeyById - ${getErrorMessage(error)}`
        )
    }
}

const createApiKey = async (keyName: string, orgId: string, userId?: string) => {
    try {
        const apiKey = generateAPIKey()
        const apiSecret = generateSecretHash(apiKey)
        const dataSource = getDataSource(parseInt(orgId))
        const newKey = new ApiKey()
        newKey.guid = generateGuid()
        newKey.apiKey = apiKey
        newKey.apiSecret = apiSecret
        newKey.keyName = keyName
        const userIdNum = userId ? parseInt(userId) : undefined
        if (userIdNum === undefined) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'User ID is required')
        }
        newKey.created_by = userIdNum
        newKey.created_on = Date.now()
        const key = dataSource.getRepository(ApiKey).create(newKey)
        await dataSource.getRepository(ApiKey).save(key)
        return await getAllApiKeysFromDB(orgId, userIdNum)
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: apikeyService.createApiKey - ${getErrorMessage(error)}`
        )
    }
}

// Update api key
const updateApiKey = async (id: string, keyName: string, orgId: string, userId?: string) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const userIdNum = userId ? parseInt(userId) : undefined
        const whereClause: any = {
            guid: id
        }
        // User-based isolation: only allow update of own API keys
        if (userIdNum !== undefined) {
            whereClause.created_by = userIdNum
        }
        const currentKey = await dataSource.getRepository(ApiKey).findOneBy(whereClause)
        if (!currentKey) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `ApiKey ${id} not found`)
        }
        currentKey.keyName = keyName
        if (userIdNum !== undefined) {
            currentKey.last_modified_by = userIdNum
            currentKey.last_modified_on = Date.now()
        }
        await dataSource.getRepository(ApiKey).save(currentKey)
        return await getAllApiKeysFromDB(orgId, userIdNum)
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: apikeyService.updateApiKey - ${getErrorMessage(error)}`
        )
    }
}

const deleteApiKey = async (id: string, orgId: string, userId?: number) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const whereClause: any = {
            guid: id
        }
        // User-based isolation: only allow deletion of own API keys
        if (userId !== undefined) {
            whereClause.created_by = userId
        }
        const dbResponse = await dataSource.getRepository(ApiKey).delete(whereClause)
        if (!dbResponse || dbResponse.affected === 0) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `ApiKey ${id} not found`)
        }
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: apikeyService.deleteApiKey - ${getErrorMessage(error)}`
        )
    }
}

const importKeys = async (body: any, orgId: string) => {
    try {
        const jsonFile = body.jsonFile
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const splitDataURI = jsonFile.split(',')
        if (splitDataURI[0] !== 'data:application/json;base64') {
            throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Invalid dataURI`)
        }
        const bf = Buffer.from(splitDataURI[1] || '', 'base64')
        const plain = bf.toString('utf8')
        const keys = JSON.parse(plain)

        // Validate schema of imported keys
        if (!Array.isArray(keys)) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, `Invalid format: Expected an array of API keys`)
        }

        const requiredFields = ['keyName', 'apiKey', 'apiSecret']
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            if (typeof key !== 'object' || key === null) {
                throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, `Invalid format: Key at index ${i} is not an object`)
            }

            for (const field of requiredFields) {
                if (!(field in key)) {
                    throw new InternalAutonomousError(
                        StatusCodes.BAD_REQUEST,
                        `Invalid format: Key at index ${i} is missing required field '${field}'`
                    )
                }
                if (typeof key[field] !== 'string') {
                    throw new InternalAutonomousError(
                        StatusCodes.BAD_REQUEST,
                        `Invalid format: Key at index ${i} field '${field}' must be a string`
                    )
                }
                if (key[field].trim() === '') {
                    throw new InternalAutonomousError(
                        StatusCodes.BAD_REQUEST,
                        `Invalid format: Key at index ${i} field '${field}' cannot be empty`
                    )
                }
            }
        }

        const dataSource = getDataSource(parseInt(orgId))
        const userId = body.userId ? parseInt(body.userId) : undefined
        if (userId === undefined) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'User ID is required for import')
        }

        // User-based isolation: only fetch and manage the current user's API keys
        const allApiKeys = await dataSource.getRepository(ApiKey).findBy({
            created_by: userId
        })

        if (body.importMode === 'replaceAll') {
            // User-based isolation: only delete the current user's API keys, not all keys in the organization
            await dataSource.getRepository(ApiKey).delete({
                created_by: userId
            })
        }
        if (body.importMode === 'errorIfExist') {
            // if importMode is errorIfExist, check for existing keys and raise error before any modification to the DB
            // Only check within the current user's keys for user-based isolation
            for (const key of keys) {
                const keyNameExists = allApiKeys.find((k) => k.keyName === key.keyName)
                if (keyNameExists) {
                    throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Key with name ${key.keyName} already exists`)
                }
            }
        }
        // iterate through the keys and add them to the database
        // Only check for existing keys within the current user's keys for user-based isolation
        for (const key of keys) {
            const keyNameExists = allApiKeys.find((k) => k.keyName === key.keyName)
            if (keyNameExists) {
                const keyIndex = allApiKeys.findIndex((k) => k.keyName === key.keyName)
                switch (body.importMode) {
                    case 'overwriteIfExist':
                    case 'replaceAll': {
                        // Primary key (guid) is immutable - cannot modify it
                        // Delete the old key and create a new one instead
                        const currentKey = allApiKeys[keyIndex]
                        await dataSource.getRepository(ApiKey).delete({
                            guid: currentKey.guid
                        })
                        // Create new key with the imported data
                        const newKey = new ApiKey()
                        newKey.guid = generateGuid()
                        newKey.apiKey = key.apiKey
                        newKey.apiSecret = key.apiSecret
                        newKey.keyName = key.keyName
                        newKey.created_by = userId
                        newKey.created_on = Date.now()
                        newKey.last_modified_by = userId
                        newKey.last_modified_on = Date.now()
                        const newKeyEntity = dataSource.getRepository(ApiKey).create(newKey)
                        await dataSource.getRepository(ApiKey).save(newKeyEntity)
                        break
                    }
                    case 'ignoreIfExist': {
                        // ignore this key and continue
                        continue
                    }
                    case 'errorIfExist': {
                        // should not reach here as we have already checked for existing keys
                        throw new Error(`Key with name ${key.keyName} already exists`)
                    }
                    default: {
                        throw new Error(`Unknown overwrite option ${body.importMode}`)
                    }
                }
            } else {
                const newKey = new ApiKey()
                newKey.guid = generateGuid()
                newKey.apiKey = key.apiKey
                newKey.apiSecret = key.apiSecret
                newKey.keyName = key.keyName
                newKey.created_by = userId
                newKey.created_on = Date.now()
                const newKeyEntity = dataSource.getRepository(ApiKey).create(newKey)
                await dataSource.getRepository(ApiKey).save(newKeyEntity)
            }
        }
        const userIdNum = body.userId ? parseInt(body.userId) : undefined
        return await getAllApiKeysFromDB(orgId, userIdNum)
    } catch (error) {
        throw new InternalAutonomousError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: apikeyService.importKeys - ${getErrorMessage(error)}`)
    }
}

const verifyApiKey = async (paramApiKey: string, orgId?: string): Promise<string> => {
    try {
        // If orgId is provided, use specific org's database
        // Require orgId upfront - no cross-org search
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))
        const apiKey = await dataSource.getRepository(ApiKey).findOneBy({
            apiKey: paramApiKey
        })
        if (!apiKey) {
            throw new InternalAutonomousError(StatusCodes.UNAUTHORIZED, `Unauthorized`)
        }
        return 'OK'
    } catch (error) {
        if (error instanceof InternalAutonomousError && error.statusCode === StatusCodes.UNAUTHORIZED) {
            throw error
        } else {
            throw new InternalAutonomousError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: apikeyService.verifyApiKey - ${getErrorMessage(error)}`
            )
        }
    }
}

export default {
    createApiKey,
    deleteApiKey,
    getAllApiKeys,
    updateApiKey,
    verifyApiKey,
    getApiKey,
    getApiKeyById,
    importKeys
}
