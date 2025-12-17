import { Request } from 'express'
import { StatusCodes } from 'http-status-codes'
import { utilBuildChatflow } from '../../utils/buildChatflow'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { getErrorMessage } from '../../errors/utils'

const buildChatflow = async (req: Request) => {
    try {
        const dbResponse = await utilBuildChatflow(req)
        return dbResponse
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: predictionsServices.buildChatflow - ${getErrorMessage(error)}`
        )
    }
}

export default {
    buildChatflow
}
