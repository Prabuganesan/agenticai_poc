import { useAuth } from '@/hooks/useAuth'
import { useConfig } from '@/store/context/ConfigContext'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { Navigate } from 'react-router'
import { useLocation } from 'react-router-dom'

export const RequireAuth = ({ permission, display, children }) => {
    const location = useLocation()
    const { loading } = useConfig()
    const { hasPermission } = useAuth()
    const isGlobal = useSelector((state) => state.auth.isGlobal)
    const currentUser = useSelector((state) => state.auth.user)

    if (loading) {
        return null
    }

    if (!currentUser) {
        return <Navigate to='/unauthorized' replace state={{ path: location.pathname }} />
    }
    
    if (display) {
        if (permission && !hasPermission(permission) && !isGlobal) {
            return <Navigate to='/unauthorized' replace state={{ path: location.pathname }} />
        }
        return children
    }

    if (permission && !hasPermission(permission) && !isGlobal) {
        return <Navigate to='/unauthorized' replace />
    }

    return children
}

RequireAuth.propTypes = {
    permission: PropTypes.string,
    display: PropTypes.string,
    children: PropTypes.element
}
