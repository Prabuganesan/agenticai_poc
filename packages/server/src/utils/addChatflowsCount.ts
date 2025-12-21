import { StatusCodes } from 'http-status-codes'
import { ChatFlow } from '../database/entities/ChatFlow'
import { InternalKodivianError } from '../errors/internalKodivianError'
import { getErrorMessage } from '../errors/utils'
import { getDataSource } from '../DataSource'

export const addChatflowsCount = async (keys: any, orgId: string) => {
    try {
        let tmpResult = keys
        if (typeof keys !== 'undefined' && keys.length > 0) {
            const updatedKeys: any[] = []
            //iterate through keys and get chatflows
            const dataSource = getDataSource(parseInt(orgId))
            for (const key of keys) {
                const chatflows = await dataSource
                    .getRepository(ChatFlow)
                    .createQueryBuilder('cf')
                    .where('cf.apikeyid = :apikeyid', { apikeyid: key.guid })
                    .getMany()
                const linkedChatFlows: any[] = []
                chatflows.map((cf) => {
                    linkedChatFlows.push({
                        flowName: cf.name,
                        category: cf.category,
                        last_modified_on: cf.last_modified_on
                    })
                })
                key.chatFlows = linkedChatFlows
                updatedKeys.push(key)
            }
            tmpResult = updatedKeys
        }
        return tmpResult
    } catch (error) {
        throw new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: addChatflowsCount - ${getErrorMessage(error)}`)
    }
}
