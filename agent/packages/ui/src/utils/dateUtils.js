/**
 * Date Utility Functions
 * Helper functions for date formatting and manipulation
 */

/**
 * Format date for API filter (ISO 8601 format)
 * @param {Date|string} date - Date object or ISO string
 * @param {string} type - 'from' or 'to' (determines if we set time to start/end of day)
 * @returns {string} ISO 8601 formatted date string
 */
export const formatDateForFilter = (date, type = 'from') => {
    if (!date) return ''

    try {
        const dateObj = date instanceof Date ? date : new Date(date)

        if (type === 'from') {
            // Set to start of day (00:00:00)
            dateObj.setHours(0, 0, 0, 0)
        } else if (type === 'to') {
            // Set to end of day (23:59:59)
            dateObj.setHours(23, 59, 59, 999)
        }

        return dateObj.toISOString()
    } catch (error) {
        console.error('Error formatting date:', error)
        return ''
    }
}

/**
 * Validate date range
 * @param {Date|string} dateFrom - Start date
 * @param {Date|string} dateTo - End date
 * @returns {object} Validation result with isValid and error message
 */
export const validateDateRange = (dateFrom, dateTo) => {
    if (!dateFrom || !dateTo) {
        return {
            isValid: false,
            error: 'Both start and end dates are required'
        }
    }

    try {
        const from = dateFrom instanceof Date ? dateFrom : new Date(dateFrom)
        const to = dateTo instanceof Date ? dateTo : new Date(dateTo)

        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            return {
                isValid: false,
                error: 'Invalid date format'
            }
        }

        if (from > to) {
            return {
                isValid: false,
                error: 'Start date must be before end date'
            }
        }

        // Check if range is too large (e.g., more than 1 year)
        const diffMs = to - from
        const diffDays = diffMs / (1000 * 60 * 60 * 24)
        if (diffDays > 365) {
            return {
                isValid: false,
                error: 'Date range cannot exceed 1 year'
            }
        }

        return {
            isValid: true,
            error: null
        }
    } catch (error) {
        return {
            isValid: false,
            error: 'Error validating date range'
        }
    }
}

/**
 * Get date before specified time unit
 * @param {string} unit - Time unit ('hours', 'days', 'months')
 * @param {number} value - Number of units
 * @returns {Date} Date object
 */
export const getDateBefore = (unit, value) => {
    const now = new Date()

    switch (unit) {
        case 'hours':
            now.setHours(now.getHours() - value)
            break
        case 'days':
            now.setDate(now.getDate() - value)
            break
        case 'months':
            now.setMonth(now.getMonth() - value)
            break
        default:
            console.warn(`Unknown time unit: ${unit}`)
    }

    return now
}

/**
 * Format date for display
 * @param {Date|string} date - Date object or ISO string
 * @param {string} format - Format type ('short', 'medium', 'long', 'full')
 * @returns {string} Formatted date string
 */
export const formatDateForDisplay = (date, format = 'medium') => {
    if (!date) return ''

    try {
        const dateObj = date instanceof Date ? date : new Date(date)

        const options = {
            short: { year: 'numeric', month: 'short', day: 'numeric' },
            medium: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
            long: { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' },
            full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }
        }

        return dateObj.toLocaleString('en-US', options[format] || options.medium)
    } catch (error) {
        console.error('Error formatting date for display:', error)
        return date?.toString() || ''
    }
}

/**
 * Get date range for quick filters
 * @param {string} preset - Preset name ('lastHour', 'last24Hours', 'last7Days', 'last30Days')
 * @returns {object} Object with dateFrom and dateTo
 */
export const getDateRangePreset = (preset) => {
    const now = new Date()
    let dateFrom = new Date(now)

    switch (preset) {
        case 'lastHour':
            dateFrom.setHours(now.getHours() - 1)
            break
        case 'last24Hours':
            dateFrom.setHours(now.getHours() - 24)
            break
        case 'last7Days':
            dateFrom.setDate(now.getDate() - 7)
            break
        case 'last30Days':
            dateFrom.setDate(now.getDate() - 30)
            break
        default:
            dateFrom.setHours(now.getHours() - 1) // Default to last hour
    }

    return {
        dateFrom: dateFrom.toISOString(),
        dateTo: now.toISOString()
    }
}

/**
 * Check if date is today
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is today
 */
export const isToday = (date) => {
    if (!date) return false

    try {
        const dateObj = date instanceof Date ? date : new Date(date)
        const today = new Date()

        return (
            dateObj.getDate() === today.getDate() &&
            dateObj.getMonth() === today.getMonth() &&
            dateObj.getFullYear() === today.getFullYear()
        )
    } catch (error) {
        return false
    }
}

/**
 * Get time difference in human-readable format
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date (default: now)
 * @returns {string} Human-readable time difference
 */
export const getTimeDifference = (date1, date2 = new Date()) => {
    if (!date1) return ''

    try {
        const d1 = date1 instanceof Date ? date1 : new Date(date1)
        const d2 = date2 instanceof Date ? date2 : new Date(date2)

        const diffMs = Math.abs(d2 - d1)
        const diffSecs = Math.floor(diffMs / 1000)
        const diffMins = Math.floor(diffSecs / 60)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffSecs < 60) {
            return `${diffSecs} second${diffSecs !== 1 ? 's' : ''}`
        } else if (diffMins < 60) {
            return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`
        } else {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''}`
        }
    } catch (error) {
        return ''
    }
}

/**
 * Safely format a date with moment, checking for validity
 * @param {string|Date} date - Date to format
 * @param {string} format - Moment format string
 * @returns {string} Formatted date or empty string
 */
const formatDateSafe = (date, format) => {
    if (!date) return ''

    try {
        const dateObj = date instanceof Date ? date : new Date(date)
        if (isNaN(dateObj.getTime())) return ''

        // Use native formatting to avoid moment dependency in this util
        return dateObj.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
    } catch {
        return ''
    }
}

/**
 * Format last updated date safe - Use this with moment in components
 * This function expects moment to be imported by the caller
 * @param {string|Date} updatedDate - Last updated date
 * @param {string|Date} createdDate - Created date (fallback)
 * @param {Function} momentFn - Moment function from component
 * @param {string} format - Moment format string
 * @returns {string} Formatted date or 'N/A'
 */
export const formatLastUpdatedSafe = (updatedDate, createdDate, momentFn, format = 'MMMM Do, YYYY HH:mm:ss') => {
    // Try updatedDate first
    if (updatedDate) {
        const m = momentFn(updatedDate)
        if (m.isValid()) {
            return m.format(format)
        }
    }

    // Fallback to createdDate
    if (createdDate) {
        const m = momentFn(createdDate)
        if (m.isValid()) {
            return m.format(format)
        }
    }

    return 'N/A'
}

