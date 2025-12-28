// assets
import {
    IconHome,
    IconList,
    IconUsersGroup,
    IconHierarchy,
    IconBuildingStore,
    IconKey,
    IconTool,
    IconLock,
    IconRobot,
    IconVariable,
    IconFiles,
    IconListCheck,
    IconChartBar,
    IconArrowBack,
    IconStack2,
    IconSettings,
    IconActivity,
    IconPackage
} from '@tabler/icons-react'

// constant
const icons = {
    IconHome,
    IconHierarchy,
    IconUsersGroup,
    IconBuildingStore,
    IconList,
    IconKey,
    IconTool,
    IconLock,
    IconRobot,
    IconVariable,
    IconFiles,
    IconListCheck,
    IconChartBar,
    IconArrowBack,
    IconStack2,
    IconSettings,
    IconActivity,
    IconPackage
}

// ==============================|| DASHBOARD MENU ITEMS - GROUPED ||============================== //

const dashboard = {
    id: 'dashboard',
    title: '',
    type: 'group',
    children: [
        // Home - Always visible at top
        {
            id: 'primary',
            title: '',
            type: 'group',
            children: [
                {
                    id: 'home',
                    title: 'Home',
                    type: 'item',
                    url: '/home',
                    icon: icons.IconHome,
                    breadcrumbs: true
                }
            ]
        },
        // BUILD GROUP - Agent creation tools
        {
            id: 'build',
            title: 'Build',
            type: 'group',
            children: [
                {
                    id: 'chatflows',
                    title: 'Agent',
                    type: 'item',
                    url: '/agent',
                    icon: icons.IconHierarchy,
                    breadcrumbs: true,
                    permission: 'chatflows:view'
                },
                {
                    id: 'agentflows',
                    title: 'Multi-Agent',
                    type: 'item',
                    url: '/multiagent',
                    icon: icons.IconUsersGroup,
                    breadcrumbs: true,
                    permission: 'agentflows:view'
                },
                {
                    id: 'assistants',
                    title: 'Assistants',
                    type: 'item',
                    url: '/assistants',
                    icon: icons.IconRobot,
                    breadcrumbs: true,
                    permission: 'assistants:view'
                }
            ]
        },
        // CONFIGURE GROUP - Settings and configuration
        {
            id: 'configure',
            title: 'Configure',
            type: 'group',
            children: [
                {
                    id: 'tools',
                    title: 'Tools',
                    type: 'item',
                    url: '/tools',
                    icon: icons.IconTool,
                    breadcrumbs: true,
                    permission: 'tools:view'
                },
                {
                    id: 'credentials',
                    title: 'Credentials',
                    type: 'item',
                    url: '/credentials',
                    icon: icons.IconLock,
                    breadcrumbs: true,
                    permission: 'credentials:view'
                },
                {
                    id: 'variables',
                    title: 'Variables',
                    type: 'item',
                    url: '/variables',
                    icon: icons.IconVariable,
                    breadcrumbs: true,
                    permission: 'variables:view'
                },
                {
                    id: 'apikey',
                    title: 'API Keys',
                    type: 'item',
                    url: '/apikey',
                    icon: icons.IconKey,
                    breadcrumbs: true,
                    permission: 'apikeys:view'
                }
            ]
        },
        // MONITOR GROUP - Observability and tracking
        {
            id: 'monitor',
            title: 'Monitor',
            type: 'group',
            children: [
                {
                    id: 'executions',
                    title: 'Executions',
                    type: 'item',
                    url: '/executions',
                    icon: icons.IconListCheck,
                    breadcrumbs: true,
                    permission: 'executions:view'
                },
                {
                    id: 'llm-usage',
                    title: 'LLM Usage',
                    type: 'item',
                    url: '/llm-usage',
                    icon: icons.IconChartBar,
                    breadcrumbs: true
                },
                {
                    id: 'logs',
                    title: 'Logs',
                    type: 'item',
                    url: '/logs',
                    icon: icons.IconList,
                    breadcrumbs: true,
                    display: 'feat:logs',
                    permission: 'logs:view'
                },
                {
                    id: 'schedules',
                    title: 'Schedules',
                    type: 'item',
                    url: '/schedules',
                    icon: icons.IconActivity,
                    breadcrumbs: true
                },
                {
                    id: 'queues',
                    title: 'Queues',
                    type: 'item',
                    url: '/queues',
                    icon: icons.IconListCheck,
                    breadcrumbs: true
                }
            ]
        },
        // RESOURCES GROUP - Templates and storage
        {
            id: 'resources',
            title: 'Resources',
            type: 'group',
            children: [
                {
                    id: 'marketplaces',
                    title: 'Marketplaces',
                    type: 'item',
                    url: '/marketplaces',
                    icon: icons.IconBuildingStore,
                    breadcrumbs: true,
                    permission: 'templates:marketplace,templates:custom'
                },
                {
                    id: 'document-stores',
                    title: 'Document Stores',
                    type: 'item',
                    url: '/document-stores',
                    icon: icons.IconFiles,
                    breadcrumbs: true,
                    permission: 'documentStores:view'
                }
            ]
        },
        // Back button - standalone
        {
            id: 'back',
            title: 'Back',
            type: 'item',
            url: '/back',
            icon: icons.IconArrowBack,
            breadcrumbs: false
        }
    ]
}

export default dashboard

