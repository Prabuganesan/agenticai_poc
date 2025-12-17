import { logInfo, logError } from '../utils/logger/system-helper'
import { UserDataService } from './user-data.service'
import { OrganizationConfigService } from './org-config.service'

export class SessionService {
    constructor(private userDataService: UserDataService, private orgConfigService: OrganizationConfigService) {}

    /**
     * Validate chainsysSessionId and fetch user data
     * EXACT IMPLEMENTATION from autonomous server
     */
    async validateChainsysSession(orgId: string, chainsysSessionId: string): Promise<any> {
        logInfo(`Validating chainsys session (lightweight flow) - orgId: ${orgId}, chainsysSessionId: ${chainsysSessionId}`).catch(() => {})

        // Fetch user data from external API (Designer)
        const userData = await this.userDataService.fetchUserDataFromExternalAPI(chainsysSessionId, orgId)

        if (!userData) {
            logError(`User data not found for chainsysSessionId: ${chainsysSessionId}, orgId: ${orgId}`).catch(() => {})
            throw new Error(`User not found for chainsysSessionId: ${chainsysSessionId}`)
        }

        logInfo(
            `Chainsys session validated successfully (orgId: ${orgId}, userId: ${userData.UserInfoDetails?.UserInfo?.personalInfo?.userId})`
        ).catch(() => {})

        return userData
    }

    /**
     * Get user data for localStorage setup
     * EXACT IMPLEMENTATION from autonomous server
     */
    getUserDataForLocalStorage(userData: any): any {
        try {
            // Extract user info from the Redis data (already fetched from designer service)
            const userInfo = userData?.UserInfoDetails?.UserInfo
            const personalInfo = userInfo?.personalInfo || {}
            const profileInfo = userInfo?.profileInfo || {}

            // Format data for localStorage (exact structure from autonomous server)
            return {
                roleId: personalInfo.roleId,
                userId: personalInfo.userId,
                userName: personalInfo.userName,
                firstName: personalInfo.firstName,
                lastName: personalInfo.lastName,
                email: personalInfo.email,
                title: personalInfo.title,
                manager: personalInfo.manager,
                managerId: personalInfo.managerId,
                assignedApps: userData?.assignedApps,
                userTimeZone: profileInfo.timeZoneId,
                userDateFormat: profileInfo.dateFormat,
                userTimeFormat: profileInfo.timeFormat,
                userGroupsId: personalInfo.userGroupsId,
                userResponsibilitiesId: personalInfo.userResponsibilitiesId,
                orgTimeZone: userData?.orgTimeZone,
                contextName: userData?.contextName,
                orgDefaultLang: profileInfo.orgDefaultLang,
                displayOrgLogoInAppHeader: userData?.displayOrgLogoInAppHeader === 'Y',
                appBuilderURL: userData?.appBuilderURL,
                socketServerUrl: userData?.socketServerUrl,
                platformWebNodeHostName: userData?.platformWebNodeHostName,
                designerNodeHostName: userData?.designerNodeHostName
            }
        } catch (error) {
            logError(`Failed to format user data for localStorage: ${error instanceof Error ? error.message : String(error)}`, error).catch(
                () => {}
            )

            // Return default values if formatting fails
            return {
                roleId: '',
                userId: '',
                userName: '',
                firstName: '',
                lastName: '',
                email: '',
                title: '',
                manager: '',
                managerId: '',
                assignedApps: [],
                userTimeZone: 'UTC',
                userDateFormat: 'MM/DD/YYYY',
                userTimeFormat: '12',
                userGroupsId: '',
                userResponsibilitiesId: '',
                orgTimeZone: 'UTC',
                contextName: '',
                orgDefaultLang: 'en',
                displayOrgLogoInAppHeader: true,
                appBuilderURL: '',
                socketServerUrl: '',
                platformWebNodeHostName: '',
                designerNodeHostName: ''
            }
        }
    }
}
