/**
 * Helper utilities for Oracle-compatible query building
 * Oracle stores unquoted identifiers as uppercase, so raw SQL strings need uppercase column names
 */

/**
 * Get the database type from environment variable (fallback method)
 * Note: For per-org databases, prefer passing dbType parameter explicitly
 */
function getDatabaseType(): 'postgres' | 'oracle' {
    const dbType = process.env.MAIN_DB_TYPE?.toUpperCase() || 'POSTGRES'
    return dbType === 'ORACLE' ? 'oracle' : 'postgres'
}

/**
 * Convert column name to database-appropriate case
 * - Oracle: Uppercase (unquoted identifiers are stored as uppercase)
 * - PostgreSQL: Lowercase (unquoted identifiers are stored as lowercase)
 * 
 * @param columnName - The column name to convert
 * @param dbType - Optional database type. If not provided, uses MAIN_DB_TYPE env var
 */
export function getColumnName(columnName: string, dbType?: 'postgres' | 'oracle'): string {
    const type = dbType || getDatabaseType()
    return type === 'oracle' ? columnName.toUpperCase() : columnName.toLowerCase()
}

/**
 * Convert table alias + column name to database-appropriate case
 * Example: 'chat_message.chatid' -> 'CHAT_MESSAGE.CHATID' (Oracle) or 'chat_message.chatid' (PostgreSQL)
 * 
 * @param alias - The table alias
 * @param columnName - The column name
 * @param dbType - Optional database type. If not provided, uses MAIN_DB_TYPE env var
 */
export function getQualifiedColumnName(alias: string, columnName: string, dbType?: 'postgres' | 'oracle'): string {
    const type = dbType || getDatabaseType()
    if (type === 'oracle') {
        return `${alias.toUpperCase()}.${columnName.toUpperCase()}`
    }
    return `${alias.toLowerCase()}.${columnName.toLowerCase()}`
}

/**
 * Helper to build WHERE clause conditions with proper case
 * Example: getWhereCondition('chat_message', 'chatid', 'chatId') 
 * Returns: 'CHAT_MESSAGE.CHATID = :chatId' (Oracle) or 'chat_message.chatid = :chatId' (PostgreSQL)
 */
export function getWhereCondition(alias: string, columnName: string, paramName: string, operator: string = '='): string {
    const qualified = getQualifiedColumnName(alias, columnName)
    return `${qualified} ${operator} :${paramName}`
}

/**
 * Helper to build ORDER BY clause with proper case
 */
export function getOrderBy(alias: string, columnName: string, direction: 'ASC' | 'DESC' = 'ASC'): string {
    const qualified = getQualifiedColumnName(alias, columnName)
    return `${qualified} ${direction}`
}

/**
 * Get qualified column name for TypeORM QueryBuilder
 * Preserves the alias as-is and quotes it for Oracle to match TypeORM's quoted aliases
 * Converts column name based on database type
 * Use this when the alias is provided by TypeORM QueryBuilder (which quotes it in FROM clause)
 * 
 * @param alias - The table alias (as provided to QueryBuilder)
 * @param columnName - The column name to convert
 * @param dbType - Optional database type. If not provided, uses MAIN_DB_TYPE env var
 */
export function getQualifiedColumnNameForQueryBuilder(alias: string, columnName: string, dbType?: 'postgres' | 'oracle'): string {
    const type = dbType || getDatabaseType()
    // For Oracle: Quote the alias to match TypeORM's quoted alias in FROM clause
    // For PostgreSQL: Use alias as-is (lowercase, unquoted)
    const column = type === 'oracle' ? columnName.toUpperCase() : columnName.toLowerCase()
    if (type === 'oracle') {
        // Quote the alias to match TypeORM's quoted alias: "chat_message"
        return `"${alias}".${column}`
    }
    return `${alias}.${column}`
}

