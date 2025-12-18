// authSlice.js
import { createSlice } from '@reduxjs/toolkit'
import AuthUtils from '@/utils/authUtils'

const userStr = localStorage.getItem('user')
const isAuthenticatedStr = localStorage.getItem('isAuthenticated')
const isGlobalStr = localStorage.getItem('isGlobal')
const permissionsStr = localStorage.getItem('permissions')
const featuresStr = localStorage.getItem('features')

const initialState = {
    user: userStr ? JSON.parse(userStr) : null,
    isAuthenticated: 'true' === isAuthenticatedStr,
    isGlobal: 'true' === isGlobalStr,
    token: null,
    permissions:
        permissionsStr && permissionsStr !== 'undefined'
            ? JSON.parse(permissionsStr)
            : null,
    features:
        featuresStr && featuresStr !== 'undefined'
            ? JSON.parse(featuresStr)
            : null
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        loginSuccess: (state, action) => {
            AuthUtils.updateStateAndLocalStorage(state, action.payload)
        },
        logoutSuccess: (state) => {
            state.user = null
            state.token = null
            state.permissions = null
            state.features = null
            state.isAuthenticated = false
            state.isGlobal = false
            AuthUtils.removeCurrentUser()
        },
        userProfileUpdated: (state, action) => {
            const user = AuthUtils.extractUser(action.payload)
            state.user.name = user.name
            state.user.email = user.email
            AuthUtils.updateCurrentUser(state.user)
        }
    }
})

export const { loginSuccess, logoutSuccess, userProfileUpdated } = authSlice.actions
export default authSlice.reducer
