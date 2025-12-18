import { useState } from 'react'
import { useError } from '@/store/context/ErrorContext'

export default (apiFunc) => {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setApiError] = useState(null)
    const { setError, handleError } = useError()

    const request = async (...args) => {
        setLoading(true)
        try {
            const result = await apiFunc(...args)
            setData(result?.data ?? null)
            setError(null)
            setApiError(null)
            return result // Return the axios response so it can be used directly
        } catch (err) {
            handleError(err || 'Unexpected Error!')
            setApiError(err || 'Unexpected Error!')
            throw err // Re-throw error so caller can handle it
        } finally {
            setLoading(false)
        }
    }

    return {
        error,
        data,
        loading,
        request
    }
}
