import React from 'react'
import App from '@/App'
import { store } from '@/store'
import { createRoot } from 'react-dom/client'
import config from '@/config'
import { initializeEncryption } from '@/utils/crypto'

// style + assets
import '@/assets/scss/style.scss'

// third party
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { SnackbarProvider } from 'notistack'
import ConfirmContextProvider from '@/store/context/ConfirmContextProvider'
import { ReactFlowContext } from '@/store/context/ReactFlowContext'
import { ConfigProvider } from '@/store/context/ConfigContext'
import { ErrorProvider } from '@/store/context/ErrorContext'
import SimpleCrypto from 'simple-crypto-js'
import { loginSuccess } from '@/store/reducers/authSlice'

// Helper function to get cookie value
const getCookie = (name) => {
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop().split(';').shift()
    return null
}

const initializeFromKodivianStore = () => {
    try {
        const kodivianStoreStr = localStorage.getItem('kodivianStore')

        if (!kodivianStoreStr) {
            return false
        }

        let encryptedString = kodivianStoreStr
        try {
            const parsed = JSON.parse(kodivianStoreStr)
            encryptedString = typeof parsed === 'string' ? parsed : kodivianStoreStr
        } catch (parseError) {
            encryptedString = kodivianStoreStr
        }

        const cryptoKey = process.env.REACT_APP_SIMPLE_CRYPTO_KEY || '$mrT@pP-6!dr'
        const simpleCrypto = new SimpleCrypto(cryptoKey)
        const decryptedStore = simpleCrypto.decryptObject(encryptedString)

        console.log("decryptedStore===>", decryptedStore)

        if (decryptedStore && decryptedStore.userId) {
            // Only store non-sensitive user info in localStorage
            // orgId and userId are NOT stored here - they come from kodivianStore (encrypted)
            const user = {
                id: decryptedStore.userId,
                email: decryptedStore.email || '',
                name: decryptedStore.userName || ''
                // orgId and userId are NOT stored - use AuthUtils.getOrgIdFromStore() instead
            }

            localStorage.setItem('user', JSON.stringify(user))
            localStorage.setItem('isAuthenticated', 'true')
            localStorage.setItem('isGlobal', 'true')
            localStorage.setItem('permissions', JSON.stringify([]))
            localStorage.setItem('features', JSON.stringify({}))

            return true
        }
    } catch (error) {
        console.error('Error initializing from kodivianStore:', error)
    }
    return false
}

const checkAuthentication = () => {
    initializeFromKodivianStore()

    const autoId = getCookie('AUTOID')
    const user = localStorage.getItem('user')
    const kodivianStore = localStorage.getItem('kodivianStore')

    const urlParams = new URLSearchParams(window.location.search)
    const params = urlParams.get('params')

    if (params) {
        const sessionHandlerUrl = `${config.basename}/api/v1/sessionhandler?params=${encodeURIComponent(params)}`
        window.location.href = sessionHandlerUrl
        return false
    }

    if (!autoId && !user && !kodivianStore) {
        const currentPath = window.location.pathname
        if (!currentPath.includes('/unauthorized') && !currentPath.includes('/license-expired')) {
            return true
        }
    }

    return true
}

const container = document.getElementById('root')
if (container) {
    const authResult = checkAuthentication()

    const userStr = localStorage.getItem('user')
    if (userStr) {
        try {
            const user = JSON.parse(userStr)
            // Get orgId and userId from kodivianStore (encrypted), not from localStorage
            const kodivianStoreStr = localStorage.getItem('kodivianStore')
            let orgId, userId
            if (kodivianStoreStr) {
                try {
                    let encryptedString = kodivianStoreStr
                    try {
                        const parsed = JSON.parse(kodivianStoreStr)
                        encryptedString = typeof parsed === 'string' ? parsed : kodivianStoreStr
                    } catch (parseError) {
                        encryptedString = kodivianStoreStr
                    }
                    const cryptoKey = process.env.REACT_APP_SIMPLE_CRYPTO_KEY || '$mrT@pP-6!dr'
                    const simpleCrypto = new SimpleCrypto(cryptoKey)
                    const decryptedStore = simpleCrypto.decryptObject(encryptedString)
                    orgId = decryptedStore?.orgId
                    userId = decryptedStore?.userId
                } catch (e) {
                    console.error('Error decrypting kodivianStore:', e)
                }
            }

            const loginPayload = {
                id: userId || user.id,
                name: user.name || '',
                email: user.email || '',
                orgId: orgId,
                userId: userId,
                token: null,
                permissions: [],
                features: {}
            }
            store.dispatch(loginSuccess(loginPayload))
        } catch (e) {
            console.error('Failed to update Redux store', e)
        }
    }

    // Initialize E2E encryption (non-blocking)
    initializeEncryption(config.basename).catch((error) => {
        console.error('[Encryption] Initialization failed:', error)
    })

    const root = createRoot(container)

    if (authResult) {
        root.render(
            <React.StrictMode>
                <Provider store={store}>
                    <BrowserRouter basename={config.basename}>
                        <SnackbarProvider>
                            <ConfigProvider>
                                <ErrorProvider>
                                    <ConfirmContextProvider>
                                        <ReactFlowContext>
                                            <App />
                                        </ReactFlowContext>
                                    </ConfirmContextProvider>
                                </ErrorProvider>
                            </ConfigProvider>
                        </SnackbarProvider>
                    </BrowserRouter>
                </Provider>
            </React.StrictMode>
        )
    }
}
