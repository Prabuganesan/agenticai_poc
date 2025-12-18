/**
 * Response transformation utilities
 * Maps internal schema (guid) to API response format (id) for backward compatibility with frontend
 * Uses numeric timestamps (milliseconds) - frontend moment.js can handle this directly
 */

/**
 * Transform entity with guid to include id field for API response
 * This maintains backward compatibility with frontend that expects 'id' field
 * Also maps last_modified_on to updatedDate and created_on to createdDate as numeric timestamps
 * Frontend uses moment.js which can handle numeric timestamps directly
 */
export function transformEntityForResponse<T extends { guid: string; [key: string]: any }>(
    entity: T | null | undefined
): (T & { id: string; updatedDate?: number; createdDate?: number }) | null {
    if (!entity) return null
    const transformed: any = {
        ...entity,
        id: entity.guid
    }
    // Map timestamps as numeric (milliseconds) - moment.js can handle this directly
    // Convert to number if TypeORM returns as string
    if (entity.created_on !== undefined) {
        transformed.createdDate = typeof entity.created_on === 'string' ? parseInt(entity.created_on) : entity.created_on
    }
    if (entity.last_modified_on !== undefined) {
        transformed.updatedDate = typeof entity.last_modified_on === 'string' ? parseInt(entity.last_modified_on) : entity.last_modified_on
    } else if (entity.created_on !== undefined) {
        // Fallback to created_on if last_modified_on is not available
        transformed.updatedDate = typeof entity.created_on === 'string' ? parseInt(entity.created_on) : entity.created_on
    }
    return transformed
}

/**
 * Transform array of entities with guid to include id field
 * Also maps last_modified_on to updatedDate and created_on to createdDate as numeric timestamps
 * Frontend uses moment.js which can handle numeric timestamps directly
 */
export function transformEntitiesForResponse<T extends { guid: string; [key: string]: any }>(
    entities: T[] | null | undefined
): (T & { id: string; updatedDate?: number; createdDate?: number })[] {
    if (!entities) return []
    return entities.map((entity) => {
        const transformed: any = {
            ...entity,
            id: entity.guid
        }
        // Map timestamps as numeric (milliseconds) - moment.js can handle this directly
        // Convert to number if TypeORM returns as string
        if (entity.created_on !== undefined) {
            transformed.createdDate = typeof entity.created_on === 'string' ? parseInt(entity.created_on) : entity.created_on
        }
        if (entity.last_modified_on !== undefined) {
            transformed.updatedDate =
                typeof entity.last_modified_on === 'string' ? parseInt(entity.last_modified_on) : entity.last_modified_on
        } else if (entity.created_on !== undefined) {
            // Fallback to created_on if last_modified_on is not available
            transformed.updatedDate = typeof entity.created_on === 'string' ? parseInt(entity.created_on) : entity.created_on
        }
        return transformed
    })
}

/**
 * Transform paginated response with entities
 */
export function transformPaginatedResponse<T extends { guid: string; [key: string]: any }>(
    response: { data: T[]; total: number } | T[]
): { data: (T & { id: string })[]; total: number } | (T & { id: string })[] {
    if (Array.isArray(response)) {
        return transformEntitiesForResponse(response)
    }
    return {
        data: transformEntitiesForResponse(response.data),
        total: response.total
    }
}
