/**
 * Format large numbers with K, M suffixes
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export const formatNumber = (num) => {
    if (num === null || num === undefined) return '0'
    if (num < 1000) return num.toString()
    if (num < 1000000) return (num / 1000).toFixed(1) + 'K'
    if (num < 1000000000) return (num / 1000000).toFixed(1) + 'M'
    return (num / 1000000000).toFixed(1) + 'B'
}

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency
 */
export const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '$0.00'
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
    }).format(amount)
}

/**
 * Format date timestamp
 * @param {string|Date|number} date - Date to format
 * @returns {string} Formatted date
 */
export const formatDate = (date) => {
    if (!date) return '-'
    const d = new Date(date)
    if (isNaN(d.getTime())) return '-'
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(d)
}

/**
 * Format duration in milliseconds
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (ms) => {
    if (ms === null || ms === undefined) return '-'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
    return `${(ms / 3600000).toFixed(1)}h`
}

/**
 * Calculate percentage
 * @param {number} value - Value
 * @param {number} total - Total
 * @returns {number} Percentage
 */
export const calculatePercentage = (value, total) => {
    if (!total || total === 0) return 0
    return ((value / total) * 100).toFixed(1)
}

/**
 * Get time range dates
 * @param {string} range - Time range (today, week, month, custom)
 * @param {Date} [customStart] - Custom start date
 * @param {Date} [customEnd] - Custom end date
 * @returns {{startDate: Date, endDate: Date}} Date range
 */
export const getTimeRange = (range, customStart, customEnd) => {
    const now = new Date()
    let startDate
    let endDate

    switch (range) {
        case 'today':
            startDate = new Date(now)
            startDate.setHours(0, 0, 0, 0)
            endDate = new Date(now)
            endDate.setHours(23, 59, 59, 999)
            break
        case 'week':
            startDate = new Date(now)
            startDate.setDate(startDate.getDate() - 7)
            startDate.setHours(0, 0, 0, 0)
            endDate = new Date(now)
            endDate.setHours(23, 59, 59, 999)
            break
        case 'month':
            startDate = new Date(now)
            startDate.setMonth(startDate.getMonth() - 1)
            startDate.setHours(0, 0, 0, 0)
            endDate = new Date(now)
            endDate.setHours(23, 59, 59, 999)
            break
        case 'custom':
            // For custom range, use provided dates or default to last month
            if (customStart && customEnd) {
                startDate = new Date(customStart)
                startDate.setHours(0, 0, 0, 0)
                endDate = new Date(customEnd)
                endDate.setHours(23, 59, 59, 999)
            } else if (customStart) {
                startDate = new Date(customStart)
                startDate.setHours(0, 0, 0, 0)
                endDate = new Date(now)
                endDate.setHours(23, 59, 59, 999)
            } else if (customEnd) {
                startDate = new Date(now)
                startDate.setMonth(startDate.getMonth() - 1)
                startDate.setHours(0, 0, 0, 0)
                endDate = new Date(customEnd)
                endDate.setHours(23, 59, 59, 999)
            } else {
                // Default to last month if no custom dates provided
                startDate = new Date(now)
                startDate.setMonth(startDate.getMonth() - 1)
                startDate.setHours(0, 0, 0, 0)
                endDate = new Date(now)
                endDate.setHours(23, 59, 59, 999)
            }
            break
        default:
            startDate = new Date(now)
            startDate.setMonth(startDate.getMonth() - 1)
            startDate.setHours(0, 0, 0, 0)
            endDate = new Date(now)
            endDate.setHours(23, 59, 59, 999)
    }

    return { startDate, endDate }
}

/**
 * Convert date to ISO string for API
 * @param {Date} date - Date object
 * @returns {string} ISO string
 */
export const dateToISO = (date) => {
    if (!date) return undefined
    return date.toISOString()
}

