// Get server URL from environment variables
export const getServerURL = (): string => {
    const port = parseInt(process.env.SERVER_PORT || '', 10) || 3000
    const host = process.env.HOST || 'localhost'
    const protocol = process.env.PROTOCOL || 'http'
    return `${protocol}://${host}:${port}`
}
