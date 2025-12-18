// TODO: add settings

import { Platform } from '../../Interface'

const getSettings = async () => {
    try {
        // For autonomous server, always return OPEN_SOURCE platform type
        // License verification is not needed for autonomous server
        return { PLATFORM_TYPE: Platform.OPEN_SOURCE }
    } catch (error) {
        return {}
    }
}

export default {
    getSettings
}
