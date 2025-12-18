/**
 * Database Query Helper - PostgreSQL Only
 * Oracle support removed - all functions return lowercase PostgreSQL format
 */

/**
 * Get column name for query builder (PostgreSQL format)
 * @param columnName - The column name
 * @param dbType - Database type (always 'postgres' now)
 * @returns The column name in lowercase
 */
export function getColumnName(columnName: string, dbType?: string): string {
    return columnName.toLowerCase()
}

/**
 * Get qualified column name for query builder with table alias
 * @param tableAlias - The table alias (e.g., 'chat_message')
 * @param columnName - The column name
 * @param dbType - Database type (always 'postgres' now)
 * @returns Formatted column reference (e.g., 'chat_message.chatid')
 */
export function getQualifiedColumnNameForQueryBuilder(
    tableAlias: string,
    columnName: string,
    dbType?: string
): string {
    // PostgreSQL uses lowercase - return as-is
    return `${tableAlias}.${columnName.toLowerCase()}`
}

/**
 * Get table name (PostgreSQL format)
 * @param tableName - The table name
 * @param dbType - Database type (always 'postgres' now)
 * @returns The table name in lowercase
 */
export function getTableName(tableName: string, dbType?: string): string {
    return tableName.toLowerCase()
}
