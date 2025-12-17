import { StatusCodes } from 'http-status-codes'
import { omit } from 'lodash'
import { ICredentialReturnResponse } from '../../Interface'
import { Credential } from '../../database/entities/Credential'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { getErrorMessage } from '../../errors/utils'
import { decryptCredentialData, transformToCredentialEntity, REDACTED_CREDENTIAL_VALUE } from '../../utils'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { AuthenticatedRequest } from '../../middlewares/session-validation.middleware'
import { getDataSource } from '../../DataSource'
import { generateGuid } from '../../utils/guidGenerator'

const createCredential = async (req: AuthenticatedRequest, requestBody: any) => {
    try {
        const appServer = getRunningExpressApp()
        const orgId = req.orgId
        const userId = req.userId

        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const newCredential = await transformToCredentialEntity(requestBody)

        // Generate GUID if not provided
        if (requestBody.guid) {
            newCredential.guid = requestBody.guid
        } else {
            newCredential.guid = generateGuid()
        }

        // Set created_by and created_on
        const userIdNum = userId ? parseInt(userId) : undefined
        if (userIdNum === undefined) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'User ID is required')
        }
        newCredential.created_by = userIdNum
        newCredential.created_on = Date.now()

        const dataSource = getDataSource(parseInt(orgId))
        const credential = await dataSource.getRepository(Credential).create(newCredential)
        const dbResponse = await dataSource.getRepository(Credential).save(credential)
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: credentialsService.createCredential - ${getErrorMessage(error)}`
        )
    }
}

// Delete all credentials from chatflowid
const deleteCredentials = async (req: AuthenticatedRequest, credentialId: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))
        const userId = req.userId ? parseInt(req.userId) : undefined
        const whereClause: any = {
            guid: credentialId
        }
        // User-based isolation: only allow deletion of own credentials
        if (userId !== undefined) {
            whereClause.created_by = userId
        }
        const dbResponse = await dataSource.getRepository(Credential).delete(whereClause)
        if (!dbResponse || dbResponse.affected === 0) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Credential ${credentialId} not found`)
        }
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: credentialsService.deleteCredential - ${getErrorMessage(error)}`
        )
    }
}

const getAllCredentials = async (req: AuthenticatedRequest, paramCredentialName?: any) => {
    try {
        const appServer = getRunningExpressApp()
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))
        let dbResponse: any[] = []
        const whereClause: any = {}
        if (paramCredentialName) {
            if (Array.isArray(paramCredentialName)) {
                for (let i = 0; i < paramCredentialName.length; i += 1) {
                    const name = paramCredentialName[i] as string
                    const credentials = await dataSource.getRepository(Credential).findBy({
                        credentialName: name,
                        ...whereClause
                    })
                    dbResponse.push(...credentials)
                }
            } else {
                const credentials = await dataSource.getRepository(Credential).findBy({
                    credentialName: paramCredentialName,
                    ...whereClause
                })
                dbResponse = [...credentials]
            }
        } else {
            const credentials = await dataSource.getRepository(Credential).findBy(whereClause)
            for (const credential of credentials) {
                dbResponse.push(omit(credential, ['encryptedData']))
            }
        }
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: credentialsService.getAllCredentials - ${getErrorMessage(error)}`
        )
    }
}

const getCredentialById = async (req: AuthenticatedRequest, credentialId: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))
        const whereClause: any = {
            guid: credentialId
        }
        const credential = await dataSource.getRepository(Credential).findOneBy(whereClause)
        if (!credential) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Credential ${credentialId} not found`)
        }
        // Decrpyt credentialData
        const decryptedCredentialData = await decryptCredentialData(
            credential.encryptedData,
            credential.credentialName,
            appServer.nodesPool.componentCredentials
        )
        const returnCredential: ICredentialReturnResponse = {
            ...credential,
            plainDataObj: decryptedCredentialData
        }
        const dbResponse: any = omit(returnCredential, ['encryptedData'])
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: credentialsService.getCredentialById - ${getErrorMessage(error)}`
        )
    }
}

const updateCredential = async (req: AuthenticatedRequest, credentialId: string, requestBody: any): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const orgId = req.orgId
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const dataSource = getDataSource(parseInt(orgId))
        const userId = req.userId ? parseInt(req.userId) : undefined
        const whereClause: any = {
            guid: credentialId
        }
        // User-based isolation: only allow update of own credentials
        if (userId !== undefined) {
            whereClause.created_by = userId
        }
        const credential = await dataSource.getRepository(Credential).findOneBy(whereClause)
        if (!credential) {
            throw new InternalAutonomousError(StatusCodes.NOT_FOUND, `Credential ${credentialId} not found`)
        }
        const decryptedCredentialData = await decryptCredentialData(credential.encryptedData)

        // Fix: If the new value is the redacted string, keep the old value
        for (const key in requestBody.plainDataObj) {
            if (requestBody.plainDataObj[key] === REDACTED_CREDENTIAL_VALUE) {
                requestBody.plainDataObj[key] = decryptedCredentialData[key]
            }
        }

        requestBody.plainDataObj = { ...decryptedCredentialData, ...requestBody.plainDataObj }
        const updateCredential = await transformToCredentialEntity(requestBody)
        // Set last_modified_by and last_modified_on
        if (userId !== undefined) {
            updateCredential.last_modified_by = userId
            updateCredential.last_modified_on = Date.now()
        }
        await dataSource.getRepository(Credential).merge(credential, updateCredential)
        const dbResponse = await dataSource.getRepository(Credential).save(credential)
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: credentialsService.updateCredential - ${getErrorMessage(error)}`
        )
    }
}

export default {
    createCredential,
    deleteCredentials,
    getAllCredentials,
    getCredentialById,
    updateCredential
}
