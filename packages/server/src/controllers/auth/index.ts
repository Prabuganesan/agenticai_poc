import { Request, Response, NextFunction } from 'express'

/**
 * Get user permissions
 * For kodivian server, all users are global admins with no permission restrictions
 * Returns empty array as permissions are not used
 */
const getPermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // For kodivian server, no permission restrictions - return empty array
        // req is AuthenticatedRequest after middleware, but we use Request type for compatibility
        return res.json([])
    } catch (error) {
        next(error)
    }
}

export default {
    getPermissions
}
