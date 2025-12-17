import { getDataSource } from '../DataSource'
import { ChatFlow } from '../database/entities/ChatFlow'
import { DocumentStore } from '../database/entities/DocumentStore'
import { Variable } from '../database/entities/Variable'
import { Credential } from '../database/entities/Credential'

/**
 * Check if user is the creator of a resource
 * @param resource Resource with created_by field
 * @param userId User ID as string
 * @returns true if user is the creator
 */
export function isCreator(resource: any, userId: string): boolean {
    const userIdNum = parseInt(userId, 10)
    const created_by = parseInt(resource.created_by)
    if (isNaN(userIdNum)) {
        return false
    }
    return created_by === userIdNum
}

/**
 * Resource type for permission checks
 */
export type ResourceType = 'chatflow' | 'documentstore' | 'variable' | 'credential'

/**
 * Result of permission check
 */
export interface PermissionCheckResult {
    canModify: boolean
    isCreator: boolean
    resource?: any
}

/**
 * Check if user can modify (update/delete) a resource
 * Only the creator can modify their resources
 *
 * @param resourceType Type of resource to check
 * @param resourceId Resource ID (as string or number)
 * @param userId User ID as string
 * @param orgId Organization ID as string
 * @returns Permission check result with canModify, isCreator flags and resource
 */
export async function canModifyResource(
    resourceType: ResourceType,
    resourceId: string | number,
    userId: string,
    orgId: string
): Promise<PermissionCheckResult> {
    try {
        const orgIdNum = parseInt(orgId, 10)
        if (isNaN(orgIdNum)) {
            return { canModify: false, isCreator: false }
        }

        const dataSource = getDataSource(orgIdNum)
        if (!dataSource) {
            return { canModify: false, isCreator: false }
        }

        // Get repository based on resource type
        let repository: any
        switch (resourceType) {
            case 'chatflow':
                repository = dataSource.getRepository(ChatFlow)
                break
            case 'documentstore':
                repository = dataSource.getRepository(DocumentStore)
                break
            case 'variable':
                repository = dataSource.getRepository(Variable)
                break
            case 'credential':
                repository = dataSource.getRepository(Credential)
                break
            default:
                return { canModify: false, isCreator: false }
        }

        // Fetch resource
        const resource = await repository.findOne({
            where: { guid: resourceId }
        })

        if (!resource) {
            return { canModify: false, isCreator: false }
        }

        // Check if user is creator
        const creator = isCreator(resource, userId)

        return {
            canModify: creator,
            isCreator: creator,
            resource
        }
    } catch (error) {
        console.error('[Permissions] Error checking resource permissions:', error)
        return { canModify: false, isCreator: false }
    }
}

/**
 * Check if user can view a resource
 * All users in the same org can view all resources
 *
 * @param resourceType Type of resource
 * @param resourceId Resource ID
 * @param userId User ID
 * @param orgId Organization ID
 * @returns true if user can view the resource (always true for same org)
 */
export async function canViewResource(
    resourceType: ResourceType,
    resourceId: string | number,
    userId: string,
    orgId: string
): Promise<boolean> {
    // In org-level sharing, all users can view all resources in their org
    // The resource must exist and belong to the same org
    // This is already enforced by the org-level database isolation
    return true
}
