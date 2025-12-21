import { InternalKodivianError } from '../errors/internalKodivianError'
import { StatusCodes } from 'http-status-codes'
import { Request } from 'express'

type Pagination = {
    page: number
    limit: number
}

export const getPageAndLimitParams = (req: Request): Pagination => {
    // by default assume no pagination
    let page = -1
    let limit = -1
    const pageParam = req.query.page || req.body?.page
    const limitParam = req.query.limit || req.body?.limit

    if (pageParam) {
        // if page is provided, make sure it's a positive number
        page = parseInt(pageParam as string)
        if (page < 0) {
            throw new InternalKodivianError(StatusCodes.PRECONDITION_FAILED, `Error: page cannot be negative!`)
        }
    }
    if (limitParam) {
        // if limit is provided, make sure it's a positive number
        limit = parseInt(limitParam as string)
        if (limit < 0) {
            throw new InternalKodivianError(StatusCodes.PRECONDITION_FAILED, `Error: limit cannot be negative!`)
        }
    }
    return { page, limit }
}
