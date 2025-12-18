/**
 * Oracle Naming Strategy - STUB (PostgreSQL Only)
 * Oracle support removed - provides stub for backwards compatibility
 */

import { DefaultNamingStrategy } from 'typeorm'

/**
 * Stub class for backwards compatibility
 * PostgreSQL only - no actual naming strategy changes needed
 */
export class OracleNamingStrategy extends DefaultNamingStrategy {
    constructor(uppercase?: boolean) {
        super()
        // Oracle uppercase naming not needed for PostgreSQL
    }
}
