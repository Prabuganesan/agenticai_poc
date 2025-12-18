type ErrorWithMessage = {
    message: string
}

const isErrorWithMessage = (error: unknown): error is ErrorWithMessage => {
    return (
        typeof error === 'object' && error !== null && 'message' in error && typeof (error as Record<string, unknown>).message === 'string'
    )
}

const toErrorWithMessage = (maybeError: unknown): ErrorWithMessage => {
    if (isErrorWithMessage(maybeError)) return maybeError

    try {
        return new Error(JSON.stringify(maybeError))
    } catch {
        // fallback in case there's an error stringifying the maybeError
        // like with circular references for example.
        return new Error(String(maybeError))
    }
}

export const getErrorMessage = (error: unknown) => {
    return toErrorWithMessage(error).message
}

/**
 * Sanitizes error messages that may contain sensitive information like API keys, credentials, or quota details.
 * Logs the full error server-side and returns a user-friendly message for the frontend.
 *
 * @param error - The error object or message
 * @param logger - Optional logger function to log the full error
 * @returns Sanitized error message safe to send to frontend
 */
export const sanitizeErrorMessage = (error: unknown, logger?: (message: string, error?: unknown) => void | Promise<void>): string => {
    const errorMessage = getErrorMessage(error)
    const errorString = typeof error === 'string' ? error : JSON.stringify(error, null, 2)
    const lowerMessage = errorMessage.toLowerCase()

    // Check if error is related to API keys, credentials, authentication, or quota
    const isSensitiveError =
        lowerMessage.includes('api key') ||
        lowerMessage.includes('apikey') ||
        lowerMessage.includes('api_key') ||
        lowerMessage.includes('credential') ||
        lowerMessage.includes('authentication') ||
        lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('forbidden') ||
        lowerMessage.includes('quota') ||
        lowerMessage.includes('rate limit') ||
        lowerMessage.includes('billing') ||
        lowerMessage.includes('exceeded') ||
        lowerMessage.includes('invalid key') ||
        lowerMessage.includes('expired') ||
        lowerMessage.includes('token') ||
        (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 401) ||
        (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 403) ||
        (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 429)

    if (isSensitiveError) {
        // Log the full error server-side
        if (logger) {
            const logResult = logger(`[Sensitive Error Detected] Full error details: ${errorString}`, error)
            if (logResult && typeof logResult.catch === 'function') {
                logResult.catch(() => {})
            }
        } else {
            console.error('[Sensitive Error Detected] Full error details:', errorString)
        }

        // Return sanitized messages based on error type
        if (lowerMessage.includes('quota') || lowerMessage.includes('rate limit') || lowerMessage.includes('exceeded')) {
            return 'API quota or rate limit exceeded. Please check your API plan and billing details, or try again later.'
        }
        if (
            lowerMessage.includes('api key') ||
            lowerMessage.includes('apikey') ||
            lowerMessage.includes('invalid key') ||
            lowerMessage.includes('expired')
        ) {
            return 'API key issue detected. Please verify your API key configuration in the credentials settings.'
        }
        if (lowerMessage.includes('authentication') || lowerMessage.includes('unauthorized') || lowerMessage.includes('forbidden')) {
            return 'Authentication failed. Please check your API credentials configuration.'
        }
        if (lowerMessage.includes('billing')) {
            return 'Billing or subscription issue detected. Please check your account billing details.'
        }

        // Generic sensitive error message
        return 'An authentication or configuration error occurred. Please check your API credentials and settings.'
    }

    // For non-sensitive errors, return the original message
    return errorMessage
}
