import { StatusCodes } from 'http-status-codes'
import { InternalAutonomousError } from '../../errors/internalAutonomousError'
import { getErrorMessage } from '../../errors/utils'
import { getVoices } from 'autonomous-components'
import { databaseEntities } from '../../utils'
import { getDataSource } from '../../DataSource'

export enum TextToSpeechProvider {
    OPENAI = 'openai',
    ELEVEN_LABS = 'elevenlabs'
}

export interface TTSRequest {
    text: string
    provider: TextToSpeechProvider
    credentialId: string
    voice?: string
    model?: string
}

export interface TTSResponse {
    audioBuffer: Buffer
    contentType: string
}

const getVoicesForProvider = async (provider: string, orgId: string, credentialId?: string): Promise<any[]> => {
    try {
        if (!credentialId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'Credential ID required for this provider')
        }
        if (!orgId) {
            throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'orgId is required')
        }

        const appDataSource = getDataSource(parseInt(orgId))

        const options = {
            orgId: orgId,
            chatflowid: '',
            chatId: '',
            appDataSource: appDataSource,
            databaseEntities: databaseEntities
        }

        return await getVoices(provider, credentialId, options)
    } catch (error) {
        throw new InternalAutonomousError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: textToSpeechService.getVoices - ${getErrorMessage(error)}`
        )
    }
}

export default {
    getVoices: getVoicesForProvider
}
