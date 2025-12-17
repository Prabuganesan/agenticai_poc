import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm'

/**
 * Custom naming strategy for Oracle compatibility
 * Converts table and column names to uppercase for Oracle (unquoted identifiers)
 * Keeps lowercase for PostgreSQL
 */
export class OracleNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
    private isOracle: boolean

    constructor(isOracle: boolean = false) {
        super()
        this.isOracle = isOracle
    }

    tableName(className: string, customName: string): string {
        // customName comes from @Entity('table_name') decorator
        // className is the class name if no customName is provided
        // Use customName if provided (from @Entity decorator), otherwise use className
        const tableName = customName || className
        // For Oracle, convert to uppercase (unquoted identifiers are stored as uppercase)
        // For PostgreSQL, keep as-is (unquoted identifiers are stored as lowercase)
        return this.isOracle ? tableName.toUpperCase() : tableName
    }

    columnName(propertyName: string, customName: string, embeddedPrefixes: string[]): string {
        const columnName = customName || propertyName
        // For Oracle, convert to uppercase
        // For PostgreSQL, keep as-is
        return this.isOracle ? columnName.toUpperCase() : columnName
    }

    relationName(propertyName: string): string {
        return this.isOracle ? propertyName.toUpperCase() : propertyName
    }

    joinColumnName(relationName: string, referencedColumnName: string): string {
        return this.isOracle 
            ? `${relationName.toUpperCase()}_${referencedColumnName.toUpperCase()}`
            : `${relationName}_${referencedColumnName}`
    }

    joinTableName(firstTableName: string, secondTableName: string): string {
        const first = this.isOracle ? firstTableName.toUpperCase() : firstTableName
        const second = this.isOracle ? secondTableName.toUpperCase() : secondTableName
        return `${first}_${second}`
    }

    joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
        const name = columnName || propertyName
        return this.isOracle ? name.toUpperCase() : name
    }

    classTableInheritanceParentColumnName(parentTableName: string, parentTableIdPropertyName: string): string {
        return this.isOracle ? parentTableIdPropertyName.toUpperCase() : parentTableIdPropertyName
    }
}

