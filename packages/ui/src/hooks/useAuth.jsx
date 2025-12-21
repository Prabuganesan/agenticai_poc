import { useSelector } from 'react-redux'

export const useAuth = () => {
    // For kodivian server, always allow all features (no license/platform restrictions)
    const permissions = useSelector((state) => state.auth.permissions)
    const isGlobal = useSelector((state) => state.auth.isGlobal)

    const hasPermission = (permissionId) => {
        // For kodivian server, always allow if global admin or no permission required
        if (isGlobal || !permissionId) {
            return true
        }
        const permissionIds = permissionId.split(',')
        if (permissions && permissions.length) {
            return permissionIds.some((permissionId) => permissions.includes(permissionId))
        }
        return false
    }

    const hasAssignedWorkspace = (_workspaceId) => {
        // For kodivian server, always allow (no workspace restrictions)
        // Since kodivian server uses orgId instead of workspaceId, always return true
        return true
    }

    const hasDisplay = (display) => {
        // For kodivian server, all features are enabled (no feature flag checks)
        if (!display) {
            return true
        }
        // Always return true for kodivian server - all features available
        return true
    }

    return { hasPermission, hasAssignedWorkspace, hasDisplay }
}
