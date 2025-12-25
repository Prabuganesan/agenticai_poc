/**
 * Simplified User Data Service for Single-Org Kodivian
 * No designer service HTTP calls - returns static user data
 */

import { logInfo } from '../utils/logger/system-helper'

export class UserDataService {
    // Accept optional orgConfigService for backward compatibility (not used in single-org mode)
    constructor(private orgConfigService?: any) { }

    /**
     * Fetch user data - for single-org, returns default user
     * No designer service HTTP call
     */
    async fetchUserDataFromExternalAPI(kodivianSessionId: string, orgId: string): Promise<any> {
        logInfo(`User data fetched (single-org mode) - orgId: ${orgId}`).catch(() => { })

        // Return default user data for single-org mode
        return {
            UserInfoDetails: {
                UserInfo: {
                    personalInfo: {
                        userId: 'kodivian-user',
                        userName: 'Kodivian User',
                        firstName: 'Kodivian',
                        lastName: 'User',
                        email: 'user@kodivian.local',
                        roleId: 'admin',
                        title: 'Administrator',
                        manager: '',
                        managerId: '',
                        userGroupsId: '',
                        userResponsibilitiesId: ''
                    },
                    profileInfo: {
                        timeZoneId: 'UTC',
                        dateFormat: 'MM/DD/YYYY',
                        timeFormat: '12',
                        orgDefaultLang: 'en'
                    }
                }
            },
            assignedApps: [],
            orgTimeZone: 'UTC',
            contextName: 'kodivian',
            displayOrgLogoInAppHeader: 'Y',
            appBuilderURL: '',
            socketServerUrl: '',
            platformWebNodeHostName: '',
            designerNodeHostName: ''
        }
    }
}
