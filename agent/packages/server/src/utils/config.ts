// BEWARE: This file is an intereem solution until we have a proper config strategy

import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), override: true })

// Inline getAutonomousDataPath to avoid circular dependency with index.ts
// (index.ts imports logger, logger imports config, so config can't import from index)
const getAutonomousDataPath = (): string => {
    if (process.env.AUTONOMOUS_DATA_PATH) {
        return path.join(process.env.AUTONOMOUS_DATA_PATH, '.autonomous')
    }
    // Default to .autonomous inside the server package directory
    // __dirname in compiled code will be dist/utils, so we go up to server root
    const serverRoot = path.resolve(__dirname, '..', '..')
    return path.join(serverRoot, '.autonomous')
}

// default config
const loggingConfig = {
    dir: path.join(getAutonomousDataPath(), 'logs'),
    // Server logger: General application logs (errors, info, warnings)
    // Uses DailyRotateFile - creates hourly files: server-YYYY-MM-DD-HH.log
    server: {
        level: process.env.LOG_LEVEL ?? 'info',
        filename: 'server-%DATE%.log', // DailyRotateFile will replace %DATE% with date pattern
        errorFilename: 'server-error.log'
    },
    // Express request logger: HTTP request/response logs
    // Uses regular File transport - creates single file: server-requests.log.jsonl
    express: {
        level: process.env.LOG_LEVEL ?? 'info',
        format: 'jsonl', // JSON Lines format for structured logging
        filename: 'server-requests.log.jsonl' // should end with .jsonl
    }
}

export default {
    logging: loggingConfig
}
