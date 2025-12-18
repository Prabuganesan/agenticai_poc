/**
 * Generates a 15-character unique GUID
 * Uses base62 encoding (0-9, A-Z, a-z) for compact representation
 * Format: timestamp component (8 chars) + random component (7 chars)
 */
export function generateGuid(): string {
    // Get current timestamp in milliseconds
    const timestamp = Date.now()

    // Convert timestamp to base62 (8 characters)
    const timestampPart = base62Encode(timestamp).substring(0, 8).padStart(8, '0')

    // Generate random component (7 characters)
    const randomPart = generateRandomBase62(7)

    // Combine: 8 chars timestamp + 7 chars random = 15 chars total
    return (timestampPart + randomPart).substring(0, 15)
}

/**
 * Base62 encoding (0-9, A-Z, a-z)
 */
function base62Encode(num: number): string {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    let result = ''
    let n = num

    if (n === 0) return '0'

    while (n > 0) {
        result = chars[n % 62] + result
        n = Math.floor(n / 62)
    }

    return result
}

/**
 * Generate random base62 string of specified length
 */
function generateRandomBase62(length: number): string {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    let result = ''

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length)
        result += chars[randomIndex]
    }

    return result
}
