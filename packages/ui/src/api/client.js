import axios from 'axios'
import { baseURL, ErrorMessage } from '@/store/constant'
import AuthUtils from '@/utils/authUtils'
import { isEncryptionEnabled, encryptRequest, decryptResponse, getEncryptionSessionId } from '@/utils/crypto'

const apiClient = axios.create({
    baseURL: `${baseURL}/api/v1`,
    headers: {
        'Content-type': 'application/json',
        'x-request-from': 'internal'
    },
    withCredentials: true
})

// Request interceptor for encryption
apiClient.interceptors.request.use(
    function (config) {
        // Skip encryption for crypto endpoints
        if (config.url?.includes('/crypto/')) {
            return config
        }

        // Skip encryption for file uploads (multipart/form-data)
        const contentType = config.headers['Content-Type'] || config.headers['content-type']
        const isMultipart = contentType?.includes('multipart/form-data')
        const isFormData = config.data instanceof FormData

        if (isMultipart || isFormData) {
            // Don't encrypt file uploads
            return config
        }

        // Add encryption headers if enabled (for both GET and POST requests)
        if (isEncryptionEnabled()) {
            config.headers['X-Encrypted'] = 'true'
            config.headers['X-Session-Id'] = getEncryptionSessionId()

            // Encrypt request body if present (POST/PUT/PATCH)
            if (config.data && typeof config.data === 'object') {
                const encryptedData = encryptRequest(config.data)
                config.data = encryptedData
            }
        }

        return config
    },
    function (error) {
        return Promise.reject(error)
    }
)

// Response interceptor for decryption and auth
apiClient.interceptors.response.use(
    function (response) {
        // Decrypt response if encrypted
        if (response.headers['x-encrypted'] === 'true' && response.data) {
            try {
                response.data = decryptResponse(response.data)
            } catch (error) {
                console.error('[Encryption] Failed to decrypt response:', error)
            }
        }
        return response
    },
    async (error) => {
        if (error.response?.status === 401) {
            // For kodivian server, sessions are managed via cookies (AUTOID)
            // No token refresh needed - session is validated server-side
            // If 401, session is expired/invalid - clear local storage and redirect
            localStorage.removeItem('username')
            localStorage.removeItem('password')
            AuthUtils.removeCurrentUser()
        }

        return Promise.reject(error)
    }
)

export default apiClient
