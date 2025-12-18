import * as Server from '../index'
import { logInfo, logError } from '../utils/logger/system-helper'
import { BaseCommand } from './base'

export default class Start extends BaseCommand {
    async run(): Promise<void> {
        logInfo('Starting Kodivian...').catch(() => { })
        // DataSource.init() removed - per-org databases are initialized in Server.start() via DataSourceManager
        await Server.start()
    }

    async catch(error: Error) {
        if (error.stack) logError(error.stack).catch(() => { })
        console.error('❌ [server]: Fatal error during startup:', error)
        await new Promise((resolve) => {
            setTimeout(resolve, 1000)
        })
        await this.failExit()
    }

    async stopProcess() {
        try {
            logInfo(`Shutting down Kodivian...`).catch(() => { })
            const serverApp = Server.getInstance()
            if (serverApp) await serverApp.stopApp()
        } catch (error) {
            logError('There was an error shutting down Kodivian...', error).catch(() => { })
            await this.failExit()
        }

        await this.gracefullyExit()
    }
}
