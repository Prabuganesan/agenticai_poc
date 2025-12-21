import { lazy } from 'react'

import Loadable from '@/ui-component/loading/Loadable'
import AuthLayout from '@/layout/AuthLayout'

// Keep only error pages for kodivian server (auth handled externally)
const UnauthorizedPage = Loadable(lazy(() => import('@/views/auth/unauthorized')))
const LicenseExpiredPage = Loadable(lazy(() => import('@/views/auth/expired')))

const AuthRoutes = {
    path: '/',
    element: <AuthLayout />,
    children: [
        {
            path: '/unauthorized',
            element: <UnauthorizedPage />
        },
        {
            path: '/license-expired',
            element: <LicenseExpiredPage />
        }
    ]
}

export default AuthRoutes
