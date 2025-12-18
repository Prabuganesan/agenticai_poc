import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { getDataSourceManager } from './DataSourceManager'

// Legacy DataSource.init() removed - per-org databases are managed by DataSourceManager
// This file now only exports utility functions

export function getDataSource(orgId: number | string): DataSource {
    if (orgId === undefined || orgId === null) {
        throw new Error('orgId is required. getDataSource() must be called with an organization ID.')
    }
    const dataSourceManager = getDataSourceManager()
    return dataSourceManager.getDataSource(orgId)
}

export const getDatabaseSSLFromEnv = () => {
    if (process.env.DATABASE_SSL_KEY_BASE64) {
        return {
            rejectUnauthorized: process.env.DATABASE_REJECT_UNAUTHORIZED === 'true',
            ca: Buffer.from(process.env.DATABASE_SSL_KEY_BASE64, 'base64')
        }
    } else if (process.env.DATABASE_SSL === 'true') {
        return true
    }
    return undefined
}
