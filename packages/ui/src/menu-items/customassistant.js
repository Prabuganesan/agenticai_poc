// assets
import { IconTrash, IconMessage, IconAdjustmentsHorizontal } from '@tabler/icons-react'

// constant
const icons = {
    IconTrash,
    IconMessage,
    IconAdjustmentsHorizontal
}

// ==============================|| SETTINGS MENU ITEMS ||============================== //

const customAssistantSettings = {
    id: 'settings',
    title: '',
    type: 'group',
    children: [
        {
            id: 'viewMessages',
            title: 'View Messages',
            type: 'item',
            url: '',
            icon: icons.IconMessage
        },
        // Leads feature removed for kodivian server deployment
        // {
        //     id: 'viewLeads',
        //     title: 'View Leads',
        //     type: 'item',
        //     url: '',
        //     icon: icons.IconUsers
        // },
        {
            id: 'chatflowConfiguration',
            title: 'Configuration',
            type: 'item',
            url: '',
            icon: icons.IconAdjustmentsHorizontal,
            permission: 'assistants:update'
        },
        {
            id: 'deleteAssistant',
            title: 'Delete Assistant',
            type: 'item',
            url: '',
            icon: icons.IconTrash,
            permission: 'assistants:delete'
        }
    ]
}

export default customAssistantSettings
