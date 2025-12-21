import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalKodivianError } from '../../errors/internalKodivianError'

// we need eslint because we have to pass next arg for the error middleware
// eslint-disable-next-line
async function errorHandlerMiddleware(err: InternalKodivianError, req: Request, res: Response, next: NextFunction) {
    const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR

    // Sanitize error messages in production
    let errorMessage = err.message
    if (process.env.NODE_ENV === 'production') {
        // Hide internal error details
        if (err.message.includes('401 Incorrect API key provided')) {
            errorMessage = '401 Invalid model key or Incorrect local model configuration.'
        } else if (statusCode === StatusCodes.INTERNAL_SERVER_ERROR) {
            // Generic error message for 500 errors in production
            errorMessage = 'An internal server error occurred. Please try again later.'
        } else if (err.message.includes('Cannot find module') || err.message.includes('Module not found')) {
            // Don't expose module paths
            errorMessage = 'A required module is missing. Please contact support.'
        } else if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
            // Don't expose connection details
            errorMessage = 'Unable to connect to required service. Please try again later.'
        }

        // Remove any file paths or system paths from error messages
        errorMessage = errorMessage.replace(/\/[^\s]+/g, '[path]')
        errorMessage = errorMessage.replace(/[A-Z]:\\[^\s]+/g, '[path]')
    }

    let displayedError = {
        statusCode,
        success: false,
        message: errorMessage,
        // Never expose stack traces to clients
        stack: {}
    }

    if (!req.body || !req.body.streaming || req.body.streaming === 'false') {
        res.setHeader('Content-Type', 'application/json')
        res.status(displayedError.statusCode).json(displayedError)
    }
}

export default errorHandlerMiddleware
