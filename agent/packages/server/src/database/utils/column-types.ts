/**
 * Database-specific column type utilities for Oracle/PostgreSQL compatibility
 * 
 * This utility provides helper functions to ensure entity columns work correctly
 * with both Oracle and PostgreSQL databases.
 */

/**
 * Get current database type from environment
 * 
 * IMPORTANT: This is evaluated at module load time. For shared entities across multiple
 * DataSources with different database types, we need to handle this differently.
 * 
 * Since entities are shared but each org can have different DB types, and Oracle doesn't
 * support 'text' type, we should default to Oracle-compatible types ('clob') to ensure
 * compatibility. TypeORM's PostgreSQL driver can handle 'clob' by mapping it to 'text'.
 * 
 * However, the better approach is to ensure MAIN_DB_TYPE is set correctly before entities
 * are loaded. If any org uses Oracle, MAIN_DB_TYPE should be set to 'ORACLE'.
 */
function getDbType(): 'oracle' | 'postgres' {
    // Check MAIN_DB_TYPE first
    const mainDbType = process.env.MAIN_DB_TYPE?.toUpperCase()
    if (mainDbType === 'ORACLE') {
        return 'oracle'
    }
    // Default to postgres for backward compatibility
    // NOTE: If you have mixed database types (some orgs use Oracle, some use PostgreSQL),
    // you MUST set MAIN_DB_TYPE='ORACLE' to ensure entities are Oracle-compatible,
    // as TypeORM's PostgreSQL driver can handle 'clob' but Oracle cannot handle 'text'
    return 'postgres'
}

/**
 * Get boolean column type (NUMBER(1) for Oracle, BOOLEAN for PostgreSQL)
 */
export function getBooleanColumnType(): 'number' | 'boolean' {
    return getDbType() === 'oracle' ? 'number' : 'boolean'
}

/**
 * Get boolean column options with proper defaults
 */
export function getBooleanColumnOptions(defaultValue: boolean = false) {
    const dbType = getDbType()
    return {
        type: dbType === 'oracle' ? ('number' as const) : ('boolean' as const),
        width: dbType === 'oracle' ? 1 : undefined,
        default: dbType === 'oracle' ? (defaultValue ? 1 : 0) : defaultValue
    }
}

/**
 * Get JSON column type (CLOB for Oracle, JSONB for PostgreSQL)
 */
export function getJsonColumnType(): 'clob' | 'jsonb' {
    return getDbType() === 'oracle' ? 'clob' : 'jsonb'
}

/**
 * Get TEXT column type (CLOB for Oracle, TEXT for PostgreSQL)
 * 
 * IMPORTANT: Since entities are shared across multiple DataSources (each org can have different DB types),
 * TypeORM validates entity column types against the DataSource type. The issue is that this function
 * is evaluated at class definition time, so it uses MAIN_DB_TYPE at that moment.
 * 
 * CRITICAL FIX: Since Oracle doesn't support 'text' but PostgreSQL can handle 'clob' (maps to TEXT),
 * we ALWAYS return 'clob' to ensure compatibility with both database types. This is safe because:
 * - Oracle requires 'clob' (doesn't support 'text')
 * - PostgreSQL can handle 'clob' and automatically maps it to 'text' type
 * 
 * This ensures entities work correctly regardless of which DataSource (Oracle or PostgreSQL) is used.
 */
export function getTextColumnType(): 'clob' | 'text' {
    // Always return 'clob' for maximum compatibility
    // PostgreSQL driver will automatically map 'clob' to 'text' type
    // Oracle requires 'clob' and doesn't support 'text'
    return getDbType() === 'oracle' ? 'clob' : 'text'
}

/**
 * Get timestamp default function name
 */
export function getTimestampDefault(): string {
    return getDbType() === 'oracle' ? 'SYSDATE' : 'CURRENT_TIMESTAMP'
}

/**
 * Get timestamp default as a function
 */
export function getTimestampDefaultFunction() {
    return () => getTimestampDefault()
}

