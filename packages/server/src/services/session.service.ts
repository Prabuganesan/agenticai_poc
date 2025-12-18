/**
 * Simplified Session Service for Single-Org Kodivian
 * No Redis, no designer service - returns static user data
 */

import { logInfo } from '../utils/logger/system-helper'

export class SessionService {
    // Accept optional services for backward compatibility (not used in single-org mode)
    constructor(private userDataService?: any, private orgConfigService?: any) { }

    /**
     * Validate session - for single-org, always returns default user
     * No Redis lookup, no designer service call
     */
    async validateChainsysSession(orgId: string, chainsysSessionId: string): Promise<any> {
        logInfo(`Session validated (single-org mode) - orgId: ${orgId}`).catch(() => { })

        // Return default user data for single-org mode
        return this.getDefaultUserData()
    }

    /**
     * Get default user data for single-org mode
     */
    private getDefaultUserData(): any {
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

    /**
     * Get user data for localStorage setup
     */
    getUserDataForLocalStorage(userData: any): any {
        const userInfo = userData?.UserInfoDetails?.UserInfo
        const personalInfo = userInfo?.personalInfo || {}
        const profileInfo = userInfo?.profileInfo || {}

        return {
            roleId: personalInfo.roleId || 'admin',
            userId: personalInfo.userId || 'kodivian-user',
            userName: personalInfo.userName || 'Kodivian User',
            firstName: personalInfo.firstName || 'Kodivian',
            lastName: personalInfo.lastName || 'User',
            email: personalInfo.email || 'user@kodivian.local',
            title: personalInfo.title || 'Administrator',
            manager: personalInfo.manager || '',
            managerId: personalInfo.managerId || '',
            assignedApps: userData?.assignedApps || [],
            userTimeZone: profileInfo.timeZoneId || 'UTC',
            userDateFormat: profileInfo.dateFormat || 'MM/DD/YYYY',
            userTimeFormat: profileInfo.timeFormat || '12',
            userGroupsId: personalInfo.userGroupsId || '',
            userResponsibilitiesId: personalInfo.userResponsibilitiesId || '',
            orgTimeZone: userData?.orgTimeZone || 'UTC',
            contextName: userData?.contextName || 'kodivian',
            orgDefaultLang: profileInfo.orgDefaultLang || 'en',
            displayOrgLogoInAppHeader: true,
            appBuilderURL: '',
            socketServerUrl: '',
            platformWebNodeHostName: '',
            designerNodeHostName: ''
        }
    }
}
