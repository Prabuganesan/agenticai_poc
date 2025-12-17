import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import backPage from '@/api/backPage'
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'
// ==============================|| BACK PAGE ||============================== //


const Back = () => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Get session_id from autonomousStore or cookie (for back navigation)
        
        // Call the back API
        backPage.back()
            .then((response) => {
                // Handle successful response - check if API returned a redirect URL
                    window.location.href = response.data.redirectUrl
            })
            .catch((error) => {
                console.error('Error calling back API:', error)                
                    // If session expired and no redirect URL, navigate to unauthorized
                    if (error?.response?.status === 401) {
                        setLoading(false)
                        navigate('/unauthorized')
                    } else {
                        setLoading(false)
                        navigate(-1)
                    }
            })
    }, [navigate])

    // Show loading indicator while processing back navigation
    return <BackdropLoader open={loading} />
}

export default Back

