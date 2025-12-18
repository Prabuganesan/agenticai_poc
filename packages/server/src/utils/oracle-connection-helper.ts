/**
 * Oracle Connection Helper - STUB (PostgreSQL Only)
 * Oracle support removed - provides stub for backwards compatibility
 */

import { logWarn } from './logger/system-helper'

export class OracleConnectionHelper {
    /**
     * Check if error is retryable (stub - always returns false)
     */
    static isRetryableError(error: Error): boolean {
        return false
    }

    /**
     * Get error details (stub)
     */
    static getErrorDetails(error: Error): { message: string; isRetryable: boolean } {
        return {
            message: error.message,
            isRetryable: false
        }
    }

    /**
     * Execute query with retry (stub - throws not supported)
     */
    static async executeWithRetry(
        pool: any,
        query: string,
        params?: any,
        retries?: number
    ): Promise<any> {
        logWarn('OracleConnectionHelper: Oracle not supported - PostgreSQL only').catch(() => { })
        throw new Error('Oracle database not supported. Please use PostgreSQL.')
    }
}
