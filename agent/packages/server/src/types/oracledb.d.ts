declare module 'oracledb' {
    export interface Pool {
        getConnection(): Promise<Connection>
        close(drainTime?: number): Promise<void>
        connectionsOpen?: number
        connectionsInUse?: number
        poolMax?: number
        poolMin?: number
    }

    export interface Connection {
        execute(sql: string, binds?: any[], options?: ExecuteOptions): Promise<Result>
        close(): Promise<void>
    }

    export interface Result {
        rows?: any[]
        outBinds?: any
        rowsAffected?: number
        metaData?: any[]
    }

    export interface ExecuteOptions {
        outFormat?: number
    }

    export interface PoolAttributes {
        user: string
        password: string
        connectString: string
        poolMin?: number
        poolMax?: number
        poolIncrement?: number
        poolTimeout?: number
        poolPingInterval?: number
        poolAlias?: string
    }

    export function createPool(poolAttrs: PoolAttributes): Promise<Pool>
    export function initOracleClient(options?: { libDir?: string }): void
    export function getConnection(connectionAttributes?: PoolAttributes): Promise<Connection>
    export const versionString: string
    export const BLOB: number
    export const CLOB: number
    export const OUT_FORMAT_OBJECT: number
    export let fetchAsBuffer: number[]
    export let fetchAsString: number[]
}
