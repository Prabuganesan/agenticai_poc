import path from 'path'
import * as fs from 'fs'
import { StatusCodes } from 'http-status-codes'
import { InternalKodivianError } from '../../errors/internalKodivianError'
import { getErrorMessage } from '../../errors/utils'
import readline from 'readline'
import config from '../../utils/config'
import { getAutonomousDataPath } from '../../utils'
import { getFlagStatus } from '../../utils/logger/env-flag-loader'
import { isGroupEnabled } from '../../utils/logger/flag-checker'

// Types
export interface LogEntry {
    timestamp: string
    level: string
    message: string
    module?: string
    group?: string
    orgId?: string | number
    userId?: string
    service?: string
    context?: Record<string, any>
    error?: {
        name?: string
        message?: string
        stack?: string
    }
    [key: string]: any
}

export interface LogFilters {
    orgId?: string
    page?: number
    limit?: number
    level?: string
    module?: string
    group?: string
    userId?: string
    service?: string
    dateFrom?: string
    dateTo?: string
    search?: string
}

export interface LogQueryResponse {
    success: boolean
    logs: LogEntry[]
    total: number
    page: number
    limit: number
    hasMore: boolean
}

export interface LogStats {
    totalLogs: number
    logsByLevel: Array<{ level: string; count: number }>
    logsByModule: Array<{ module: string; count: number; enabled: boolean }>
    logsByGroup: { [groupName: string]: number }
    recentActivity: {
        lastHour: number
        last24Hours: number
        last7Days: number
    }
    errorRate: number
    averageLogsPerMinute: number
    contextStats: {
        uniqueUsers: number
        uniqueOrgs: number
    }
}

// Module/Group structure
const MODULE_GROUPS: Record<string, string[]> = {
    system: ['system', 'api', 'security'],
    workflows: ['chatflow', 'agentflow', 'execution'],
    services: ['assistant', 'usage', 'tool'],
    storage: ['documentstore', 'database', 'file'],
    infrastructure: ['queue', 'cache', 'session', 'streaming']
}

const ALL_MODULES = Object.values(MODULE_GROUPS).flat()
const ALL_GROUPS = Object.keys(MODULE_GROUPS)

// Helper: Read JSON log file and parse lines
const readJsonLogFile = async (filePath: string): Promise<LogEntry[]> => {
    return new Promise((resolve, reject) => {
        // Check if file exists first
        if (!fs.existsSync(filePath)) {
            resolve([])
            return
        }

        const logs: LogEntry[] = []
        let lineCount = 0
        const rl = readline.createInterface({
            input: fs.createReadStream(filePath),
            crlfDelay: Infinity
        })

        rl.on('line', (line) => {
            lineCount++
            if (!line.trim()) return
            try {
                const logData = JSON.parse(line)
                logs.push(logData as LogEntry)
            } catch (error) {
                // Skip invalid JSON lines
                console.warn(`[LogService] Skipping invalid JSON line ${lineCount} in ${filePath}: ${line.substring(0, 100)}`)
            }
        })

        rl.on('close', () => {
            resolve(logs)
        })

        rl.on('error', (error) => {
            console.error(`[LogService] Error reading file ${filePath}:`, getErrorMessage(error))
            reject(new Error(`Error reading file ${filePath}: ${getErrorMessage(error)}`))
        })
    })
}

// Helper: Discover all orgId directories in the logs directory
const getAllOrgIds = (): string[] => {
    const baseDir = path.resolve(config.logging.dir)
    if (!fs.existsSync(baseDir)) {
        return []
    }

    const orgIds: string[] = []
    const entries = fs.readdirSync(baseDir, { withFileTypes: true })

    for (const entry of entries) {
        // Skip system directory and non-directories
        if (entry.name === 'system' || !entry.isDirectory()) {
            continue
        }

        // Check if it's a valid orgId directory (contains group subdirectories)
        const orgDir = path.join(baseDir, entry.name)
        const subEntries = fs.readdirSync(orgDir, { withFileTypes: true })
        const hasGroupDir = subEntries.some((sub) => sub.isDirectory() && ALL_GROUPS.includes(sub.name))

        if (hasGroupDir) {
            orgIds.push(entry.name)
        }
    }

    return orgIds
}

// Helper: Get log file for a module (simplified - only current file, no rotation)
const getLogFilesForModule = (group: string, module: string, orgId?: string): string[] => {
    const baseDir = path.resolve(config.logging.dir) // Resolve to absolute path
    const files: string[] = []
    const baseFileName = `${module}.json`

    // System group: Always in logs/system/ (no orgId)
    if (group === 'system') {
        const moduleDir = path.resolve(path.join(baseDir, 'system'))

        if (fs.existsSync(moduleDir)) {
            const currentFile = path.resolve(path.join(moduleDir, baseFileName))

            if (fs.existsSync(currentFile)) {
                files.push(currentFile)
            }
        }
    } else {
        // Other groups: Always org-specific at logs/{orgId}/{group}/
        if (orgId) {
            // Specific orgId: Look in logs/{orgId}/{group}/
            const moduleDir = path.resolve(path.join(baseDir, orgId.toString(), group))

            if (fs.existsSync(moduleDir)) {
                const currentFile = path.resolve(path.join(moduleDir, baseFileName))

                if (fs.existsSync(currentFile)) {
                    files.push(currentFile)
                }
            }
        } else {
            // No orgId specified: Scan all orgId directories
            const orgIds = getAllOrgIds()

            for (const foundOrgId of orgIds) {
                const moduleDir = path.resolve(path.join(baseDir, foundOrgId, group))

                if (fs.existsSync(moduleDir)) {
                    const currentFile = path.resolve(path.join(moduleDir, baseFileName))

                    if (fs.existsSync(currentFile)) {
                        files.push(currentFile)
                    }
                }
            }
        }
    }

    return files
}

// Helper: Get log files for date range (simplified - only current file)
const getLogFilesInDateRange = (group: string, module: string, orgId: string | undefined, dateFrom?: string, dateTo?: string): string[] => {
    // Simplified: Just return current file, date filtering will be done on log entries
    const allFiles = getLogFilesForModule(group, module, orgId)
    return allFiles
}

// Helper: Filter logs by criteria
const filterLogs = (logs: LogEntry[], filters: LogFilters): LogEntry[] => {
    // Normalize filters: treat empty strings as undefined
    const normalizedFilters: LogFilters = {
        ...filters,
        level: filters.level?.trim() || undefined,
        module: filters.module?.trim() || undefined,
        group: filters.group?.trim() || undefined,
        userId: filters.userId?.trim() || undefined,
        service: filters.service?.trim() || undefined,
        orgId: filters.orgId?.trim() || undefined,
        search: filters.search?.trim() || undefined,
        dateFrom: filters.dateFrom?.trim() || undefined,
        dateTo: filters.dateTo?.trim() || undefined
    }

    return logs.filter((log) => {
        // Level filter
        if (normalizedFilters.level && log.level !== normalizedFilters.level) {
            return false
        }

        // Module filter
        if (normalizedFilters.module && log.module !== normalizedFilters.module) {
            return false
        }

        // Group filter
        if (normalizedFilters.group && log.group !== normalizedFilters.group) {
            return false
        }

        // UserId filter
        if (normalizedFilters.userId && log.userId !== normalizedFilters.userId) {
            return false
        }

        // Service filter
        if (normalizedFilters.service) {
            const logService = log.service || log.label || ''
            if (logService !== normalizedFilters.service) {
                return false
            }
        }

        // OrgId filter (skip for system logs, as they don't need orgId filtering)
        if (normalizedFilters.orgId && log.group !== 'system' && log.orgId?.toString() !== normalizedFilters.orgId) {
            return false
        }

        // Date range filter
        if (normalizedFilters.dateFrom || normalizedFilters.dateTo) {
            const logDate = new Date(log.timestamp)
            if (normalizedFilters.dateFrom && logDate < new Date(normalizedFilters.dateFrom)) {
                return false
            }
            if (normalizedFilters.dateTo && logDate > new Date(normalizedFilters.dateTo)) {
                return false
            }
        }

        // Search filter (full-text search in message and context)
        if (normalizedFilters.search) {
            const searchLower = normalizedFilters.search.toLowerCase()
            const messageMatch = log.message?.toLowerCase().includes(searchLower)
            const contextMatch = JSON.stringify(log.context || {})
                .toLowerCase()
                .includes(searchLower)
            if (!messageMatch && !contextMatch) {
                return false
            }
        }

        return true
    })
}

// Query logs with filters and pagination
const queryLogs = async (filters: LogFilters): Promise<LogQueryResponse> => {
    try {
        const page = filters.page || 1
        const limit = filters.limit || 50

        // Normalize filters: treat empty strings as undefined
        const normalizedFilters: LogFilters = {
            ...filters,
            orgId: filters.orgId?.trim() || undefined,
            level: filters.level?.trim() || undefined,
            module: filters.module?.trim() || undefined,
            group: filters.group?.trim() || undefined,
            userId: filters.userId?.trim() || undefined,
            service: filters.service?.trim() || undefined,
            search: filters.search?.trim() || undefined,
            dateFrom: filters.dateFrom?.trim() || undefined,
            dateTo: filters.dateTo?.trim() || undefined
        }

        const orgId = normalizedFilters.orgId

        // Determine which groups/modules to query
        const groupsToQuery = normalizedFilters.group ? [normalizedFilters.group] : ALL_GROUPS
        const modulesToQuery = normalizedFilters.module ? [normalizedFilters.module] : ALL_MODULES

        // Collect all logs
        const allLogs: LogEntry[] = []

        for (const group of groupsToQuery) {
            // Skip disabled groups
            if (!isGroupEnabled(group)) {
                continue
            }

            // Get modules for this group
            // If a module filter is specified, only include it if it belongs to this group
            // Otherwise, include all modules for this group
            const groupModules = normalizedFilters.module
                ? MODULE_GROUPS[group]?.includes(normalizedFilters.module)
                    ? [normalizedFilters.module]
                    : []
                : MODULE_GROUPS[group] || []

            for (const module of groupModules) {
                // No need to check modulesToQuery here - groupModules already contains the correct modules
                // If a module filter was specified, groupModules only contains that module if it belongs to this group
                // If no module filter was specified, groupModules contains all modules for this group

                // Get log files for this module (simplified - only current file)
                const files = getLogFilesInDateRange(group, module, orgId, normalizedFilters.dateFrom, normalizedFilters.dateTo)

                // Read and parse all files
                for (const file of files) {
                    try {
                        const logs = await readJsonLogFile(file)
                        // Add group/module info if not present
                        logs.forEach((log) => {
                            if (!log.group) log.group = group
                            if (!log.module) log.module = module
                        })
                        allLogs.push(...logs)
                    } catch (error) {
                        console.error(`[LogService] Error reading log file ${file}:`, error)
                        console.error(`[LogService] Error details: ${getErrorMessage(error)}`)
                    }
                }
            }
        }

        // Filter logs (use normalized filters)
        const filteredLogs = filterLogs(allLogs, normalizedFilters)

        // Sort by timestamp (newest first)
        filteredLogs.sort((a, b) => {
            const dateA = new Date(a.timestamp).getTime()
            const dateB = new Date(b.timestamp).getTime()
            return dateB - dateA
        })

        // Paginate
        const total = filteredLogs.length
        const startIndex = (page - 1) * limit
        const endIndex = startIndex + limit
        const paginatedLogs = filteredLogs.slice(startIndex, endIndex)

        return {
            success: true,
            logs: paginatedLogs,
            total,
            page,
            limit,
            hasMore: endIndex < total
        }
    } catch (error) {
        console.error(`[LogService] Error in queryLogs:`, error)
        throw new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error querying logs: ${getErrorMessage(error)}`)
    }
}

// Get log statistics
const getLogStats = async (orgId?: string): Promise<LogStats> => {
    try {
        const allLogs: LogEntry[] = []
        const now = new Date()
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        // Collect logs from all enabled groups/modules
        for (const [group, modules] of Object.entries(MODULE_GROUPS)) {
            if (!isGroupEnabled(group)) {
                continue
            }

            for (const module of modules) {
                const files = getLogFilesForModule(group, module, orgId)
                for (const file of files) {
                    try {
                        const logs = await readJsonLogFile(file)
                        logs.forEach((log) => {
                            if (!log.group) log.group = group
                            if (!log.module) log.module = module
                        })
                        allLogs.push(...logs)
                    } catch (error) {
                        // Skip errors
                    }
                }
            }
        }

        // Calculate statistics
        const totalLogs = allLogs.length
        const levelCounts: Record<string, number> = {}
        const moduleCounts: Record<string, number> = {}
        const groupCounts: Record<string, number> = {}
        const userIds = new Set<string>()
        const orgIds = new Set<string>()
        let errorCount = 0
        let lastHourCount = 0
        let last24HoursCount = 0
        let last7DaysCount = 0

        for (const log of allLogs) {
            // Level counts
            const level = log.level || 'unknown'
            levelCounts[level] = (levelCounts[level] || 0) + 1
            if (level === 'error') errorCount++

            // Module counts
            const module = log.module || 'unknown'
            moduleCounts[module] = (moduleCounts[module] || 0) + 1

            // Group counts
            const group = log.group || 'unknown'
            groupCounts[group] = (groupCounts[group] || 0) + 1

            // Context stats
            if (log.userId) userIds.add(log.userId)
            if (log.orgId) orgIds.add(log.orgId.toString())

            // Recent activity
            const logDate = new Date(log.timestamp)
            if (logDate >= oneHourAgo) lastHourCount++
            if (logDate >= oneDayAgo) last24HoursCount++
            if (logDate >= sevenDaysAgo) last7DaysCount++
        }

        // Calculate error rate
        const errorRate = totalLogs > 0 ? (errorCount / totalLogs) * 100 : 0

        // Calculate average logs per minute (based on last 24 hours)
        const minutesIn24Hours = 24 * 60
        const averageLogsPerMinute = last24HoursCount / minutesIn24Hours

        // Get module enabled status
        const flagStatus = getFlagStatus()
        const logsByModule = Object.entries(moduleCounts).map(([module, count]) => {
            // Find which group this module belongs to
            let enabled = true
            for (const [group, modules] of Object.entries(MODULE_GROUPS)) {
                if (modules.includes(module)) {
                    enabled = isGroupEnabled(group)
                    break
                }
            }
            return { module, count, enabled }
        })

        return {
            totalLogs,
            logsByLevel: Object.entries(levelCounts).map(([level, count]) => ({ level, count })),
            logsByModule,
            logsByGroup: groupCounts,
            recentActivity: {
                lastHour: lastHourCount,
                last24Hours: last24HoursCount,
                last7Days: last7DaysCount
            },
            errorRate: Math.round(errorRate * 100) / 100,
            averageLogsPerMinute: Math.round(averageLogsPerMinute * 100) / 100,
            contextStats: {
                uniqueUsers: userIds.size,
                uniqueOrgs: orgIds.size
            }
        }
    } catch (error) {
        throw new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting log stats: ${getErrorMessage(error)}`)
    }
}

// Get all filter options
const getAllFilters = async (orgId?: string) => {
    try {
        const allLogs: LogEntry[] = []

        // Collect logs from all enabled groups/modules
        for (const [group, modules] of Object.entries(MODULE_GROUPS)) {
            if (!isGroupEnabled(group)) {
                continue
            }

            for (const module of modules) {
                const files = getLogFilesForModule(group, module, orgId)
                for (const file of files) {
                    try {
                        const logs = await readJsonLogFile(file)
                        logs.forEach((log) => {
                            if (!log.group) log.group = group
                            if (!log.module) log.module = module
                        })
                        allLogs.push(...logs)
                    } catch (error) {
                        // Skip errors
                    }
                }
            }
        }

        // Extract unique values
        const levelCounts: Record<string, number> = {}
        const serviceCounts: Record<string, number> = {}
        const moduleCounts: Record<string, number> = {}
        const groupModules: Record<string, Record<string, { enabled: boolean; count: number }>> = {}

        for (const log of allLogs) {
            // Levels
            const level = log.level || 'unknown'
            levelCounts[level] = (levelCounts[level] || 0) + 1

            // Services
            const service = log.service || log.label || 'unknown'
            serviceCounts[service] = (serviceCounts[service] || 0) + 1

            // Modules
            const module = log.module || 'unknown'
            moduleCounts[module] = (moduleCounts[module] || 0) + 1

            // Group/Module structure
            const group = log.group || 'unknown'
            if (!groupModules[group]) {
                groupModules[group] = {}
            }
            if (!groupModules[group][module]) {
                groupModules[group][module] = { enabled: isGroupEnabled(group), count: 0 }
            }
            groupModules[group][module].count++
        }

        // Build response
        const flagStatus = getFlagStatus()
        const groups: Record<string, { modules: Record<string, { enabled: boolean; count: number }>; displayName: string }> = {}

        for (const [groupName, modules] of Object.entries(MODULE_GROUPS)) {
            const enabled = isGroupEnabled(groupName)
            groups[groupName] = {
                modules: {},
                displayName: groupName.charAt(0).toUpperCase() + groupName.slice(1)
            }

            for (const module of modules) {
                groups[groupName].modules[module] = {
                    enabled,
                    count: moduleCounts[module] || 0
                }
            }
        }

        return {
            success: true,
            levels: Object.entries(levelCounts).map(([level, count]) => ({ level, count })),
            services: Object.entries(serviceCounts).map(([service, count]) => ({ service, count })),
            modules: Object.entries(moduleCounts).map(([module, count]) => ({
                module,
                count,
                enabled: Object.values(groups).some((g) => g.modules[module]?.enabled)
            })),
            groups
        }
    } catch (error) {
        throw new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting filters: ${getErrorMessage(error)}`)
    }
}

// Get log groups structure
const getLogGroups = async (orgId?: string) => {
    try {
        const flagStatus = getFlagStatus()
        const groups: Record<string, { modules: Record<string, { enabled: boolean; count: number }> }> = {}

        // Get counts for each module
        const moduleCounts: Record<string, number> = {}

        for (const [groupName, modules] of Object.entries(MODULE_GROUPS)) {
            const enabled = isGroupEnabled(groupName)
            groups[groupName] = { modules: {} }

            for (const module of modules) {
                const files = getLogFilesForModule(groupName, module, orgId)
                let count = 0

                for (const file of files) {
                    try {
                        const logs = await readJsonLogFile(file)
                        count += logs.length
                    } catch (error) {
                        // Skip errors
                    }
                }

                moduleCounts[module] = count
                groups[groupName].modules[module] = {
                    enabled,
                    count
                }
            }
        }

        return {
            success: true,
            groups
        }
    } catch (error) {
        throw new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting log groups: ${getErrorMessage(error)}`)
    }
}

// Get log levels
const getLogLevels = async (orgId?: string) => {
    try {
        const allLogs: LogEntry[] = []

        for (const [group, modules] of Object.entries(MODULE_GROUPS)) {
            if (!isGroupEnabled(group)) continue

            for (const module of modules) {
                const files = getLogFilesForModule(group, module, orgId)
                for (const file of files) {
                    try {
                        const logs = await readJsonLogFile(file)
                        allLogs.push(...logs)
                    } catch (error) {
                        // Skip errors
                    }
                }
            }
        }

        const levelCounts: Record<string, number> = {}
        const levelColors: Record<string, string> = {
            error: '#f44336',
            warn: '#ff9800',
            info: '#2196f3',
            debug: '#9c27b0',
            verbose: '#607d8b'
        }

        for (const log of allLogs) {
            const level = log.level || 'unknown'
            levelCounts[level] = (levelCounts[level] || 0) + 1
        }

        return {
            success: true,
            levels: Object.entries(levelCounts).map(([level, count]) => ({
                level,
                count,
                color: levelColors[level] || '#757575'
            }))
        }
    } catch (error) {
        throw new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting log levels: ${getErrorMessage(error)}`)
    }
}

// Get services
const getServices = async (orgId?: string) => {
    try {
        const allLogs: LogEntry[] = []

        for (const [group, modules] of Object.entries(MODULE_GROUPS)) {
            if (!isGroupEnabled(group)) continue

            for (const module of modules) {
                const files = getLogFilesForModule(group, module, orgId)
                for (const file of files) {
                    try {
                        const logs = await readJsonLogFile(file)
                        allLogs.push(...logs)
                    } catch (error) {
                        // Skip errors
                    }
                }
            }
        }

        const serviceCounts: Record<string, number> = {}

        for (const log of allLogs) {
            const service = log.service || log.label || 'unknown'
            serviceCounts[service] = (serviceCounts[service] || 0) + 1
        }

        return {
            success: true,
            services: Object.entries(serviceCounts).map(([service, count]) => ({ service, count }))
        }
    } catch (error) {
        throw new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting services: ${getErrorMessage(error)}`)
    }
}

// Get modules
const getModules = async (orgId?: string) => {
    try {
        const flagStatus = getFlagStatus()
        const moduleCounts: Record<string, number> = {}

        for (const [group, modules] of Object.entries(MODULE_GROUPS)) {
            const enabled = isGroupEnabled(group)

            for (const module of modules) {
                const files = getLogFilesForModule(group, module, orgId)
                let count = 0

                for (const file of files) {
                    try {
                        const logs = await readJsonLogFile(file)
                        count += logs.length
                    } catch (error) {
                        // Skip errors
                    }
                }

                moduleCounts[module] = count
            }
        }

        return {
            success: true,
            modules: Object.entries(moduleCounts).map(([module, count]) => {
                // Find which group this module belongs to
                let enabled = true
                for (const [group, modules] of Object.entries(MODULE_GROUPS)) {
                    if (modules.includes(module)) {
                        enabled = isGroupEnabled(group)
                        break
                    }
                }
                return { module, count, enabled }
            })
        }
    } catch (error) {
        throw new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting modules: ${getErrorMessage(error)}`)
    }
}

// Legacy method (keep for backward compatibility)
const getLogs = async (startDate?: string, endDate?: string) => {
    if (!startDate || !endDate) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: logService.getLogs - No start date or end date provided`
        )
    }

    if (startDate > endDate) {
        throw new InternalKodivianError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: logService.getLogs - Start date is greater than end date`
        )
    }

    try {
        const promises: Promise<string>[] = []
        const files = generateDateRange(startDate, endDate)

        // Use KODIVIAN_DATA_PATH/.kodivian/logs for log files
        const dataPath = getAutonomousDataPath()
        const logsPath = path.join(dataPath, 'logs')

        // Ensure logs directory exists
        if (!fs.existsSync(logsPath)) {
            return []
        }

        // Collect all file read promises
        for (const date of files) {
            // Winston DailyRotateFile creates files as: server-YYYY-MM-DD-HH.log
            // So we need to match: server-{date}.log (not server.log.{date})
            const filePath = path.join(logsPath, `server-${date}.log`)
            if (fs.existsSync(filePath)) {
                promises.push(readFile(filePath))
            }
        }

        // Wait for all file reads to complete
        if (promises.length > 0) {
            const results = await Promise.all(promises)
            return results
        } else {
            return []
        }
    } catch (error) {
        throw new InternalKodivianError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: logService.getLogs - ${getErrorMessage(error)}`)
    }
}

const generateDateRange = (startDate: string, endDate: string) => {
    const start = startDate.split('-')
    const end = endDate.split('-')
    const startYear = parseInt(start[0], 10)
    const startMonth = parseInt(start[1], 10) - 1 // JS months are 0-indexed
    const startDay = parseInt(start[2], 10)
    const startHour = parseInt(start[3], 10)

    const endYear = parseInt(end[0], 10)
    const endMonth = parseInt(end[1], 10) - 1
    const endDay = parseInt(end[2], 10)
    const endHour = parseInt(end[3], 10)

    const result = []
    const startTime = new Date(startYear, startMonth, startDay, startHour)
    const endTime = new Date(endYear, endMonth, endDay, endHour)

    for (let time = startTime; time <= endTime; time.setHours(time.getHours() + 1)) {
        const year = time.getFullYear()
        const month = (time.getMonth() + 1).toString().padStart(2, '0')
        const day = time.getDate().toString().padStart(2, '0')
        const hour = time.getHours().toString().padStart(2, '0')
        result.push(`${year}-${month}-${day}-${hour}`)
    }

    return result
}

const readFile = (filePath: string): Promise<string> => {
    return new Promise<string>(function (resolve, reject) {
        const lines: string[] = []
        var rl = readline.createInterface({
            input: fs.createReadStream(filePath)
        })

        rl.on('line', (line) => {
            lines.push(line)
        })

        rl.on('close', () => {
            // Add newlines to lines
            resolve(lines.join('\n'))
        })

        rl.on('error', (error) => {
            reject(`Error reading file ${filePath}: ${error}`)
        })
    })
}

export default {
    getLogs, // Legacy method
    queryLogs,
    getLogStats,
    getAllFilters,
    getLogGroups,
    getLogLevels,
    getServices,
    getModules
}
