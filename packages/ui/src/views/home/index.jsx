import { useEffect } from 'react'
import { Box } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import kodivianLogo from '@/assets/images/kodivian-logo.png'
import { headerHeight } from '@/store/constant'
import { useError } from '@/store/context/ErrorContext'
import useApi from '@/hooks/useApi'
import authApi from '@/api/auth'

const Home = () => {
    const navigate = useNavigate()
    const currentUser = useSelector((state) => state.auth.user)
    const { handleError } = useError()
    const getAllPermissionsApi = useApi(authApi.getAllPermissions)

    // Validate session on mount by calling an API endpoint
    // This ensures session expiration is detected even if localStorage has stale data
    useEffect(() => {
        // If no user in Redux state, redirect immediately
        if (!currentUser) {
            navigate('/unauthorized', { replace: true })
            return
        }

        // Validate session by calling permissions API
        // This will trigger 401 interceptor if session expired, which will redirect to unauthorized
        getAllPermissionsApi.request().catch((err) => {
            // Only handle error if it's not already being handled by interceptor
            // The API interceptor will handle 401 errors and redirect to unauthorized
            if (err?.response?.status !== 401) {
                handleError(err)
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                padding: 0,
                margin: 0,
                boxSizing: 'border-box'
            }}
        >
            <Box
                component="img"
                src={kodivianLogo}
                alt="Kodivian"
                sx={{
                    maxWidth: 'min(400px, 50vw)',
                    maxHeight: 'min(400px, 60vh)',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0 auto'
                }}
            />
        </Box>
    )
}

export default Home

