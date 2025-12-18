/**
 * Log Utility Functions
 * Helper functions for formatting and processing log entries
 */

/**
 * Format ISO timestamp to readable format
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Formatted date string (e.g., "Jan 27, 2025 10:30:45 AM")
 */
export const formatTimestamp = (timestamp) => {
    if (!timestamp) return ''
    try {
        const date = new Date(timestamp)
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        })
    } catch (error) {
        return timestamp
    }
}

/**
 * Get relative time string (e.g., "2 minutes ago")
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Relative time string
 */
export const getRelativeTime = (timestamp) => {
    if (!timestamp) return ''
    try {
        const date = new Date(timestamp)
        const now = new Date()
        const diffMs = now - date
        const diffSecs = Math.floor(diffMs / 1000)
        const diffMins = Math.floor(diffSecs / 60)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffSecs < 60) {
            return 'just now'
        } else if (diffMins < 60) {
            return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
        } else {
            return formatTimestamp(timestamp)
        }
    } catch (error) {
        return timestamp
    }
}

/**
 * Get log level display information (text, color, icon)
 * @param {string} level - Log level (error, warn, info, debug, verbose)
 * @returns {object} Level info with text, color, and icon
 */
export const formatLogLevel = (level) => {
    const levelMap = {
        error: {
            text: 'Error',
            color: '#f44336',
            bgColor: '#ffebee',
            borderColor: '#f44336',
            icon: '❌'
        },
        warn: {
            text: 'Warning',
            color: '#ff9800',
            bgColor: '#fff3e0',
            borderColor: '#ff9800',
            icon: '⚠️'
        },
        info: {
            text: 'Info',
            color: '#2196f3',
            bgColor: '#e3f2fd',
            borderColor: '#2196f3',
            icon: 'ℹ️'
        },
        debug: {
            text: 'Debug',
            color: '#9c27b0',
            bgColor: '#f3e5f5',
            borderColor: '#9c27b0',
            icon: '🔍'
        },
        verbose: {
            text: 'Verbose',
            color: '#607d8b',
            bgColor: '#eceff1',
            borderColor: '#607d8b',
            icon: '📝'
        }
    }

    return levelMap[level?.toLowerCase()] || {
        text: level || 'Unknown',
        color: '#757575',
        bgColor: '#f5f5f5',
        borderColor: '#757575',
        icon: '📄'
    }
}

/**
 * Parse single JSON log line
 * @param {string} jsonLine - JSON string line
 * @returns {object|null} Parsed log entry or null if invalid
 */
export const parseLogEntry = (jsonLine) => {
    if (!jsonLine || !jsonLine.trim()) return null
    try {
        return JSON.parse(jsonLine)
    } catch (error) {
        console.warn('Failed to parse log entry:', jsonLine.substring(0, 100))
        return null
    }
}

/**
 * Truncate message to specified length
 * @param {string} message - Log message
 * @param {number} maxLength - Maximum length (default: 200)
 * @returns {string} Truncated message
 */
export const truncateMessage = (message, maxLength = 200) => {
    if (!message) return ''
    if (message.length <= maxLength) return message
    return message.substring(0, maxLength) + '...'
}

/**
 * Format log entry for display
 * @param {object} logEntry - Log entry object
 * @returns {object} Formatted log entry with display properties
 */
export const formatLogEntry = (logEntry) => {
    if (!logEntry) return null

    return {
        ...logEntry,
        formattedTimestamp: formatTimestamp(logEntry.timestamp),
        relativeTime: getRelativeTime(logEntry.timestamp),
        levelInfo: formatLogLevel(logEntry.level),
        truncatedMessage: truncateMessage(logEntry.message, 200),
        displayModule: logEntry.module || 'unknown',
        displayGroup: logEntry.group || 'unknown'
    }
}

/**
 * Filter logs client-side (if needed for additional filtering)
 * @param {array} logs - Array of log entries
 * @param {object} filters - Filter criteria
 * @returns {array} Filtered logs
 */
export const filterLogs = (logs, filters) => {
    if (!logs || !Array.isArray(logs)) return []

    return logs.filter((log) => {
        // Level filter
        if (filters.level && log.level !== filters.level) {
            return false
        }

        // Module filter
        if (filters.module && log.module !== filters.module) {
            return false
        }

        // Group filter
        if (filters.group && log.group !== filters.group) {
            return false
        }

        // UserId filter
        if (filters.userId && log.userId !== filters.userId) {
            return false
        }

        // OrgId filter
        if (filters.orgId && log.orgId?.toString() !== filters.orgId) {
            return false
        }

        // Search filter
        if (filters.search) {
            const searchLower = filters.search.toLowerCase()
            const messageMatch = log.message?.toLowerCase().includes(searchLower)
            const contextMatch = JSON.stringify(log.context || {}).toLowerCase().includes(searchLower)
            if (!messageMatch && !contextMatch) {
                return false
            }
        }

        return true
    })
}

/**
 * Sort logs by timestamp
 * @param {array} logs - Array of log entries
 * @param {string} order - 'asc' or 'desc' (default: 'desc')
 * @returns {array} Sorted logs
 */
export const sortLogsByTimestamp = (logs, order = 'desc') => {
    if (!logs || !Array.isArray(logs)) return []

    return [...logs].sort((a, b) => {
        const dateA = new Date(a.timestamp || 0).getTime()
        const dateB = new Date(b.timestamp || 0).getTime()
        return order === 'asc' ? dateA - dateB : dateB - dateA
    })
}

/**
 * Copy log entry to clipboard
 * @param {object} logEntry - Log entry to copy
 * @returns {Promise<boolean>} Success status
 */
export const copyLogToClipboard = async (logEntry) => {
    if (!logEntry) return false

    try {
        const logText = JSON.stringify(logEntry, null, 2)
        await navigator.clipboard.writeText(logText)
        return true
    } catch (error) {
        console.error('Failed to copy log to clipboard:', error)
        return false
    }
}

