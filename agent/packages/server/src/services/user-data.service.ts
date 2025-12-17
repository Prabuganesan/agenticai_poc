import { logInfo, logError, logWarn } from '../utils/logger/system-helper'
import { OrganizationConfigService } from './org-config.service'
import * as fs from 'fs'
import * as path from 'path'

export class UserDataService {
    constructor(private orgConfigService: OrganizationConfigService) {}

    /**
     * Fetch user data from external API (Designer service)
     * EXACT IMPLEMENTATION from autonomous server
     * @param chainsysSessionId - Chainsys Session ID
     * @param orgId - Organization ID
     * @returns User data from designer service
     */
    async fetchUserDataFromExternalAPI(chainsysSessionId: string, orgId: string): Promise<any> {
        try {
            logInfo(
                `=== FETCHING USER DATA VIA WEB SERVICE === (chainsysSessionId: ${chainsysSessionId}, orgId: ${orgId}, timestamp: ${new Date().toISOString()})`
            ).catch(() => {})

            // Prepare session details (exact structure from autonomous server)
            const sessionDetails = {
                authenticationDetails: {
                    SessionType: 'NODEJS',
                    HardwareId: '',
                    PushNotificationTokenForAPNS: '',
                    DeviceId: '',
                    OsName: '',
                    OsVersion: '',
                    Model: '',
                    PushNotificationTokenForFCM: '',
                    MobileAppName: '',
                    ChainsysSessionid: chainsysSessionId,
                    UserAgent: 'Autonomous-AgentServer/1.0',
                    RemoteAddress: '127.0.0.1'
                }
            }

            // Prepare process info data (exact structure from autonomous server)
            const processInfoData = {
                sessionId: chainsysSessionId,
                inputJson: JSON.stringify(sessionDetails)
            }

            // Get designer info from orgConfig
            const orgConfig = this.orgConfigService.getOrgConfig(parseInt(orgId))
            if (!orgConfig?.designerInfo) {
                throw new Error(`Designer configuration not found for orgId: ${orgId}`)
            }

            const designerInfo = orgConfig.designerInfo
            const protocol = designerInfo.is_ssl_enabled === 'Y' ? 'https:' : 'http:'

            // Build service URL (exact logic from autonomous server)
            let serviceUrl: string
            if (designerInfo.dsngrproxy_host_name) {
                serviceUrl = `${protocol}//${designerInfo.dsngrproxy_host_name}/${designerInfo.app_designer_path}/rest/nodeservicecontroller/fetchuserinfo`
            } else {
                serviceUrl = `${protocol}//${designerInfo.dsngr_host_name}:${designerInfo.app_designer_port}/${designerInfo.app_designer_path}/rest/nodeservicecontroller/fetchuserinfo`
            }

            logInfo(
                `Making HTTP request to designer service (url: ${serviceUrl}, orgId: ${orgId}, chainsysSessionId: ${chainsysSessionId})`
            ).catch(() => {})

            // Check for userinput.json file (for local testing without designer server)
            // Set SKIP_DESIGNER_SERVICE=true to use userinput.json instead of calling designer service
            const USE_USERINPUT_JSON = process.env.SKIP_DESIGNER_SERVICE === 'true'

            if (USE_USERINPUT_JSON) {
                // Check for userinput.json file
                // File is located at: packages/server/userinput.json
                // When compiled, code runs from: dist/services/user-data.service.js
                // So __dirname = dist/services/, and we need to go up 2 levels to reach server folder
                const possiblePaths = [
                    path.join(__dirname, '..', '..', 'userinput.json'), // From dist/services -> packages/server/userinput.json (most likely)
                    path.join(process.cwd(), 'userinput.json'), // Current working directory
                    path.join(process.cwd(), 'packages', 'server', 'userinput.json'), // From workspace root
                    path.join(process.cwd(), 'server', 'userinput.json') // Alternative workspace structure
                ]

                let userInputPath: string | null = null
                for (const testPath of possiblePaths) {
                    try {
                        if (fs.existsSync(testPath)) {
                            userInputPath = testPath
                            break
                        }
                    } catch (err) {
                        // Continue checking other paths
                    }
                }

                if (userInputPath) {
                    try {
                        const userInputContent = fs.readFileSync(userInputPath, 'utf8')
                        const result = JSON.parse(userInputContent)

                        // Handle two possible formats:
                        // 1. Designer service format: { status: "SUCCESS", statusInfo: {...} }
                        // 2. Direct format: { Status: "Success", UserInfoDetails: {...} }
                        let statusInfo: any

                        if (result.statusInfo) {
                            // Format 1: Designer service response format
                            if (result.status?.toUpperCase() !== 'SUCCESS') {
                                logWarn('userinput.json has non-SUCCESS status, falling back to designer service').catch(() => {})
                                throw new Error('Non-SUCCESS status in userinput.json')
                            }
                            statusInfo = typeof result.statusInfo === 'string' ? JSON.parse(result.statusInfo) : result.statusInfo
                        } else if (result.Status) {
                            // Format 2: Direct format (userinput.json structure)
                            if (result.Status?.toUpperCase() !== 'SUCCESS') {
                                logWarn('userinput.json has non-SUCCESS Status, falling back to designer service').catch(() => {})
                                throw new Error('Non-SUCCESS Status in userinput.json')
                            }
                            // Use the entire result as statusInfo
                            statusInfo = result
                        } else {
                            throw new Error('userinput.json has invalid structure - missing status/Status or statusInfo')
                        }

                        // Validate statusInfo structure
                        if (statusInfo.Status?.toUpperCase() !== 'SUCCESS') {
                            throw new Error(`User info validation failed in userinput.json: ${statusInfo.Message || 'Invalid session'}`)
                        }

                        logInfo(
                            `Successfully loaded user data from userinput.json (userId: ${String(
                                statusInfo.UserInfoDetails?.UserInfo?.personalInfo?.userId || statusInfo.userId
                            )}, orgId: ${String(statusInfo.UserInfoDetails?.UserInfo?.personalInfo?.orgId || statusInfo.orgId)}, status: ${
                                statusInfo.Status
                            })`
                        ).catch(() => {})

                        return statusInfo
                    } catch (fileError) {
                        const errorContext: Record<string, any> =
                            fileError instanceof Error ? { error: fileError.message, stack: fileError.stack } : { error: String(fileError) }
                        logWarn(
                            `Failed to read or parse userinput.json, falling back to designer service: ${
                                fileError instanceof Error ? fileError.message : String(fileError)
                            }`,
                            errorContext
                        ).catch(() => {})
                        // Continue to designer service call below
                    }
                }
            }
            // ====================================================================
            // END: userinput.json support block
            // ====================================================================

            // Make HTTP request (exact implementation from autonomous server)
            let response: Response
            try {
                response = await fetch(serviceUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'User-Agent': 'Autonomous-AgentServer/1.0'
                    },
                    body: JSON.stringify(processInfoData)
                })
            } catch (fetchError) {
                logError(
                    `HTTP fetch failed (url: ${serviceUrl}): ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
                    fetchError
                ).catch(() => {})
                throw new Error(
                    `Failed to connect to designer service: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
                )
            }

            if (!response.ok) {
                let errorBody: string = ''
                try {
                    errorBody = await response.text()
                } catch (e) {
                    // Ignore error reading body
                }
                logError(
                    `Designer service returned non-OK status (${response.status} ${
                        response.statusText
                    }, url: ${serviceUrl}): ${errorBody.substring(0, 500)}`
                ).catch(() => {})
                throw new Error(
                    `Designer service request failed: ${response.status} ${response.statusText}${
                        errorBody ? ` - ${errorBody.substring(0, 200)}` : ''
                    }`
                )
            }

            let result: any
            try {
                result = await response.json()
            } catch (parseError) {
                const textBody = await response.text()
                logError(
                    `Failed to parse designer service response as JSON (url: ${serviceUrl}, status: ${
                        response.status
                    }): ${textBody.substring(0, 500)}`
                ).catch(() => {})
                throw new Error(
                    `Designer service returned invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`
                )
            }

            if (result.status?.toUpperCase() !== 'SUCCESS') {
                logError(
                    `Designer service returned error status (${result.status}): ${result.message || 'Unknown error'} - ${JSON.stringify(
                        result
                    ).substring(0, 500)}`
                ).catch(() => {})
                throw new Error(`Designer service returned error: ${result.message || 'Unknown error'}`)
            }

            // Parse statusInfo (exact logic from autonomous server)
            let statusInfo: any
            try {
                statusInfo = typeof result.statusInfo === 'string' ? JSON.parse(result.statusInfo) : result.statusInfo
            } catch (parseError) {
                throw new Error(`Failed to parse statusInfo: ${parseError}`)
            }

            if (statusInfo.Status?.toUpperCase() !== 'SUCCESS') {
                throw new Error(`User info validation failed: ${statusInfo.Message || 'Invalid session'}`)
            }

            logInfo(
                `User data fetched successfully via web service (userId: ${String(
                    statusInfo.UserInfoDetails?.UserInfo?.personalInfo?.userId
                )}, orgId: ${String(statusInfo.UserInfoDetails?.UserInfo?.personalInfo?.orgId)}, status: ${statusInfo.Status})`
            ).catch(() => {})

            return statusInfo
        } catch (error) {
            logError(
                `Failed to fetch user data via web service (chainsysSessionId: ${chainsysSessionId}, orgId: ${orgId}): ${
                    error instanceof Error ? error.message : String(error)
                }`,
                error
            ).catch(() => {})
            throw error
        }
    }
}
