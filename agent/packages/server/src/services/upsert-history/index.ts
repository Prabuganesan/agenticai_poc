import { MoreThanOrEqual, LessThanOrEqual, Between, In } from 'typeorm'
import { StatusCodes } from 'http-status-codes'
import { UpsertHistory } from '../../database/entities/UpsertHistory'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { getErrorMessage } from '../../errors/utils'
import { getDataSource } from '../../DataSource'

const getAllUpsertHistory = async (
    sortOrder: string | undefined,
    chatflowid: string | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    orgId: string
) => {
    try {
        const dataSource = getDataSource(parseInt(orgId))

        let createdDateQuery
        if (startDate || endDate) {
            if (startDate && endDate) {
                createdDateQuery = Between(new Date(startDate).getTime(), new Date(endDate).getTime())
            } else if (startDate) {
                createdDateQuery = MoreThanOrEqual(new Date(startDate).getTime())
            } else if (endDate) {
                createdDateQuery = LessThanOrEqual(new Date(endDate).getTime())
            }
        }
        let upsertHistory = await dataSource.getRepository(UpsertHistory).find({
            where: {
                chatflowid,
                created_on: createdDateQuery
            },
            order: {
                created_on: sortOrder === 'DESC' ? 'DESC' : 'ASC'
            }
        })
        upsertHistory = upsertHistory.map((hist) => {
            return {
                ...hist,
                result: hist.result ? JSON.parse(hist.result) : {},
                flowData: hist.flowData ? JSON.parse(hist.flowData) : {}
            }
        })

        return upsertHistory
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: upsertHistoryServices.getAllUpsertHistory - ${getErrorMessage(error)}`
        )
    }
}

const patchDeleteUpsertHistory = async (ids: string[] = [], orgId: string): Promise<any> => {
    try {
        const dataSource = getDataSource(parseInt(orgId))
        const dbResponse = await dataSource.getRepository(UpsertHistory).delete({ guid: In(ids) })
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: upsertHistoryServices.patchDeleteUpsertHistory - ${getErrorMessage(error)}`
        )
    }
}

export default {
    getAllUpsertHistory,
    patchDeleteUpsertHistory
}
