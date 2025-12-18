import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'
import parser from 'html-react-parser'

// Material
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Box, Stack, OutlinedInput, Typography } from '@mui/material'

// Project imports
import { StyledButton } from '@/ui-component/button/StyledButton'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import CredentialInputHandler from './CredentialInputHandler'

// Icons
import { IconHandStop, IconX } from '@tabler/icons-react'

// API
import credentialsApi from '@/api/credentials'
import oauth2Api from '@/api/oauth2'

// Hooks
import useApi from '@/hooks/useApi'

// utils
import useNotifier from '@/utils/useNotifier'
import { initializeDefaultNodeData } from '@/utils/genericHelper'

// const
import { baseURL, REDACTED_CREDENTIAL_VALUE, getAutonomousDocsPath } from '@/store/constant'
import { HIDE_CANVAS_DIALOG, SHOW_CANVAS_DIALOG } from '@/store/actions'
import keySVG from '@/assets/images/key.svg'

const AddEditCredentialDialog = ({ show, dialogProps, onCancel, onConfirm, setError }) => {
    const portalElement = document.getElementById('portal')

    const dispatch = useDispatch()

    // ==============================|| Snackbar ||============================== //

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const getSpecificCredentialApi = useApi(credentialsApi.getSpecificCredential)
    const getSpecificComponentCredentialApi = useApi(credentialsApi.getSpecificComponentCredential)

    const [credential, setCredential] = useState({})
    const [name, setName] = useState('')
    const [credentialData, setCredentialData] = useState({})
    const [componentCredential, setComponentCredential] = useState({})
    const [shared, setShared] = useState(false)
    const [oauthSaving, setOauthSaving] = useState(false) // Track if OAuth flow has saved the credential

    useEffect(() => {
        if (getSpecificCredentialApi.data) {
            const shared = getSpecificCredentialApi.data.shared
            setShared(shared)
            if (!shared) {
                setCredential(getSpecificCredentialApi.data)
                if (getSpecificCredentialApi.data.name) {
                    setName(getSpecificCredentialApi.data.name)
                }
                if (getSpecificCredentialApi.data.plainDataObj) {
                    setCredentialData(getSpecificCredentialApi.data.plainDataObj)
                }
                getSpecificComponentCredentialApi.request(getSpecificCredentialApi.data.credentialName)
            }
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getSpecificCredentialApi.data])

    useEffect(() => {
        if (getSpecificComponentCredentialApi.data) {
            setComponentCredential(getSpecificComponentCredentialApi.data)
        }
    }, [getSpecificComponentCredentialApi.data])

    useEffect(() => {
        if (getSpecificCredentialApi.error && setError) {
            setError(getSpecificCredentialApi.error)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getSpecificCredentialApi.error])

    useEffect(() => {
        if (getSpecificComponentCredentialApi.error && setError) {
            setError(getSpecificComponentCredentialApi.error)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getSpecificComponentCredentialApi.error])

    useEffect(() => {
        if (dialogProps.type === 'EDIT' && dialogProps.data) {
            // When credential dialog is opened from Credentials dashboard
            setOauthSaving(false) // Reset OAuth saving state
            getSpecificCredentialApi.request(dialogProps.data.id)
        } else if (dialogProps.type === 'EDIT' && dialogProps.credentialId) {
            // When credential dialog is opened from node in canvas
            setOauthSaving(false) // Reset OAuth saving state
            getSpecificCredentialApi.request(dialogProps.credentialId)
        } else if (dialogProps.type === 'ADD' && dialogProps.credentialComponent) {
            // When credential dialog is to add a new credential
            setName('')
            setCredential({})
            setOauthSaving(false) // Reset OAuth saving state
            const defaultCredentialData = initializeDefaultNodeData(dialogProps.credentialComponent.inputs)
            setCredentialData(defaultCredentialData)
            setComponentCredential(dialogProps.credentialComponent)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dialogProps])

    useEffect(() => {
        if (show) dispatch({ type: SHOW_CANVAS_DIALOG })
        else dispatch({ type: HIDE_CANVAS_DIALOG })
        return () => dispatch({ type: HIDE_CANVAS_DIALOG })
    }, [show, dispatch])

    const addNewCredential = async () => {
        try {
            const obj = {
                name,
                credentialName: componentCredential.name,
                plainDataObj: credentialData
            }
            const createResp = await credentialsApi.createCredential(obj)
            if (createResp.data) {
                enqueueSnackbar({
                    message: 'New Credential added',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
                onConfirm(createResp.data.id)
            }
        } catch (error) {
            if (setError) setError(error)
            enqueueSnackbar({
                message: `Failed to add new Credential: ${typeof error.response.data === 'object' ? error.response.data.message : error.response.data
                    }`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
            onCancel()
        }
    }

    const saveCredential = async () => {
        try {
            const saveObj = {
                name,
                credentialName: componentCredential.name
            }

            let plainDataObj = {}
            for (const key in credentialData) {
                if (credentialData[key] !== REDACTED_CREDENTIAL_VALUE) {
                    plainDataObj[key] = credentialData[key]
                }
            }
            if (Object.keys(plainDataObj).length) saveObj.plainDataObj = plainDataObj

            const saveResp = await credentialsApi.updateCredential(credential.id, saveObj)
            if (saveResp.data) {
                enqueueSnackbar({
                    message: 'Credential saved',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
                onConfirm(saveResp.data.id)
            }
        } catch (error) {
            if (setError) setError(error)
            enqueueSnackbar({
                message: `Failed to save Credential: ${typeof error.response.data === 'object' ? error.response.data.message : error.response.data
                    }`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
            onCancel()
        }
    }

    const setOAuth2 = async () => {
        try {
            // Validate name is required
            if (!name || !name.trim()) {
                enqueueSnackbar({
                    message: 'Credential Name is required',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
                return
            }

            let credentialId = null

            // First save or add the credential
            if (dialogProps.type === 'ADD' && !credential.id) {
                // Add new credential first (only if not already saved via OAuth)
                const obj = {
                    name,
                    credentialName: componentCredential.name,
                    plainDataObj: credentialData
                }
                const createResp = await credentialsApi.createCredential(obj)
                if (createResp.data) {
                    credentialId = createResp.data.id
                    // Store the credential ID so subsequent Save will UPDATE instead of creating new
                    setCredential({ id: credentialId })
                }
            } else {
                // Save existing credential first (or credential already created via OAuth)
                const saveObj = {
                    name,
                    credentialName: componentCredential.name
                }

                let plainDataObj = {}
                for (const key in credentialData) {
                    if (credentialData[key] !== REDACTED_CREDENTIAL_VALUE) {
                        plainDataObj[key] = credentialData[key]
                    }
                }
                if (Object.keys(plainDataObj).length) saveObj.plainDataObj = plainDataObj

                const saveResp = await credentialsApi.updateCredential(credential.id, saveObj)
                if (saveResp.data) {
                    credentialId = credential.id
                }
            }

            if (!credentialId) {
                throw new Error('Failed to save credential')
            }

            // Mark that OAuth has saved the credential
            setOauthSaving(true)

            const authResponse = await oauth2Api.authorize(credentialId)

            if (authResponse.data && authResponse.data.success && authResponse.data.authorizationUrl) {
                // Open the authorization URL in a new window/tab
                const authWindow = window.open(
                    authResponse.data.authorizationUrl,
                    '_blank',
                    'width=600,height=700,scrollbars=yes,resizable=yes'
                )

                if (!authWindow) {
                    throw new Error('Failed to open authorization window. Please check if popups are blocked.')
                }

                // Listen for messages from the popup window
                const handleMessage = (event) => {
                    // Verify origin if needed (you may want to add origin checking)
                    if (event.data && (event.data.type === 'OAUTH2_SUCCESS' || event.data.type === 'OAUTH2_ERROR')) {
                        window.removeEventListener('message', handleMessage)

                        // Clear the cleanup timeout since we received a message
                        if (handleMessage.cleanupTimeout) {
                            clearTimeout(handleMessage.cleanupTimeout)
                        }

                        if (event.data.type === 'OAUTH2_SUCCESS') {
                            enqueueSnackbar({
                                message: 'OAuth2 authorization completed successfully',
                                options: {
                                    key: new Date().getTime() + Math.random(),
                                    variant: 'success',
                                    action: (key) => (
                                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                            <IconX />
                                        </Button>
                                    )
                                }
                            })
                            onConfirm(credentialId)
                        } else if (event.data.type === 'OAUTH2_ERROR') {
                            enqueueSnackbar({
                                message: event.data.message || 'OAuth2 authorization failed',
                                options: {
                                    key: new Date().getTime() + Math.random(),
                                    variant: 'error',
                                    persist: true,
                                    action: (key) => (
                                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                            <IconX />
                                        </Button>
                                    )
                                }
                            })
                        }

                        // Try to close the auth window if it's still open
                        // Wrapped in try-catch because COOP restrictions may prevent this
                        // when popup is on cross-origin domain (Google)
                        try {
                            if (authWindow && !authWindow.closed) {
                                authWindow.close()
                            }
                        } catch (e) {
                            // Silently ignore - popup will auto-close itself
                        }
                    }
                }

                // Add message listener
                window.addEventListener('message', handleMessage)

                // Cleanup after a reasonable timeout (5 minutes)
                // Note: We no longer poll window.closed to avoid COOP warnings
                // The OAuth flow will complete via postMessage from the callback page
                const cleanupTimeout = setTimeout(() => {
                    window.removeEventListener('message', handleMessage)
                    // Note: Cannot reliably check authWindow.closed due to COOP restrictions
                    // when popup is on cross-origin (Google's domain)
                    // The popup will auto-close itself after successful/failed auth
                }, 300000) // 5 minutes

                // Store cleanup function so handleMessage can clear it early
                handleMessage.cleanupTimeout = cleanupTimeout
            } else {
                throw new Error('Invalid response from authorization endpoint')
            }
        } catch (error) {
            console.error('OAuth2 authorization error:', error)
            if (setError) setError(error)
            enqueueSnackbar({
                message: `OAuth2 authorization failed: ${error.response?.data?.message || error.message || 'Unknown error'}`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
        }
    }

    const component = show ? (
        <Dialog
            fullWidth
            maxWidth='sm'
            open={show}
            onClose={onCancel}
            aria-labelledby='alert-dialog-title'
            aria-describedby='alert-dialog-description'
        >
            <DialogTitle sx={{ fontSize: '1rem' }} id='alert-dialog-title'>
                {!shared && componentCredential && componentCredential.label && (
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                        <div
                            style={{
                                width: 50,
                                height: 50,
                                marginRight: 10,
                                borderRadius: '50%',
                                backgroundColor: 'white'
                            }}
                        >
                            <img
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    padding: 7,
                                    borderRadius: '50%',
                                    objectFit: 'contain'
                                }}
                                alt={componentCredential.name}
                                src={`${baseURL}/api/v1/components-credentials-icon/${componentCredential.name}`}
                                onError={(e) => {
                                    e.target.onerror = null
                                    e.target.style.padding = '5px'
                                    e.target.src = keySVG
                                }}
                            />
                        </div>
                        {componentCredential.label}
                    </div>
                )}
            </DialogTitle>
            <DialogContent>
                {shared && (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: 10,
                            background: '#f37a97',
                            padding: 10,
                            marginTop: 10,
                            marginBottom: 10
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}
                        >
                            <IconHandStop size={25} color='white' />
                            <span style={{ color: 'white', marginLeft: 10, fontWeight: 400 }}>Cannot edit shared credential.</span>
                        </div>
                    </div>
                )}
                {!shared && componentCredential && componentCredential.description && (
                    <Box sx={{ pl: 2, pr: 2 }}>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                borderRadius: 10,
                                background: 'rgb(254,252,191)',
                                padding: 10,
                                marginTop: 10,
                                marginBottom: 10
                            }}
                        >
                            <span style={{ color: 'rgb(116,66,16)' }}>
                                {parser(
                                    componentCredential.description
                                        .replace('[AUTONOMOUS_DOCS]', getAutonomousDocsPath())
                                )}
                            </span>
                        </div>
                    </Box>
                )}
                {!shared && componentCredential && componentCredential.label && (
                    <Box sx={{ p: 2 }}>
                        <Stack sx={{ position: 'relative' }} direction='row'>
                            <Typography variant='overline'>
                                Credential Name
                                <span style={{ color: 'red' }}>&nbsp;*</span>
                            </Typography>
                        </Stack>
                        <OutlinedInput
                            id='credName'
                            type='string'
                            fullWidth
                            placeholder={componentCredential.label}
                            value={name}
                            name='name'
                            onChange={(e) => setName(e.target.value)}
                        />
                    </Box>
                )}
                {!shared && componentCredential && componentCredential.name && componentCredential.name.includes('OAuth2') && (
                    <Box sx={{ p: 2 }}>
                        <Stack sx={{ position: 'relative' }} direction='row'>
                            <Typography variant='overline'>OAuth Redirect URL</Typography>
                        </Stack>
                        <OutlinedInput
                            id='oauthRedirectUrl'
                            type='string'
                            disabled
                            fullWidth
                            value={`${baseURL}/api/v1/oauth2-credential/callback`}
                        />
                    </Box>
                )}
                {!shared &&
                    componentCredential &&
                    componentCredential.inputs &&
                    componentCredential.inputs
                        .filter((inputParam) => inputParam.hidden !== true)
                        .map((inputParam, index) => <CredentialInputHandler key={index} inputParam={inputParam} data={credentialData} />)}

                {!shared && componentCredential && componentCredential.name && componentCredential.name.includes('OAuth2') && (
                    <Box sx={{ p: 2 }}>
                        <Button variant='contained' color='secondary' onClick={() => setOAuth2()}>
                            Authenticate
                        </Button>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                {!shared && (
                    <StyledButton
                        disabled={!name}
                        variant='contained'
                        onClick={() => (credential.id ? saveCredential() : addNewCredential())}
                        title={oauthSaving ? 'Update credential name or close dialog' : ''}
                    >
                        {oauthSaving ? 'Update' : dialogProps.confirmButtonName}
                    </StyledButton>
                )}
            </DialogActions>
            <ConfirmDialog />
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

AddEditCredentialDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func,
    setError: PropTypes.func
}

export default AddEditCredentialDialog
