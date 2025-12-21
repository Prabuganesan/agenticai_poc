// TODO: add settings

import { Platform } from '../../Interface'

const getSettings = async () => {
    try {
        // For kodivian server, always return OPEN_SOURCE platform type
        // License verification is not needed for kodivian server
        return { PLATFORM_TYPE: Platform.OPEN_SOURCE }
    } catch (error) {
        return {}
    }
}

export default {
    getSettings
}
