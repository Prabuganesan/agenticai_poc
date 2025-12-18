// Stub file to prevent import errors

const workspaceApi = {
    getAllWorkspacesByOrganizationId: () => Promise.resolve({ data: [] }),
    getWorkspacesByUserId: () => Promise.resolve({ data: [] }),
    getSharedWorkspacesForItem: () => Promise.resolve({ data: [] }),
    setSharedWorkspacesForItem: () => Promise.resolve({ data: {} }),
    switchWorkspace: () => Promise.resolve({ data: {} })
}

export default workspaceApi

