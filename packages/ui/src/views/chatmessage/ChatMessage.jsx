import { useState, useRef, useEffect, useCallback, Fragment, useContext, memo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import PropTypes from 'prop-types'
import { cloneDeep } from 'lodash'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import { EventStreamContentType, fetchEventSource } from '@microsoft/fetch-event-source'
import { useSearchParams } from 'react-router-dom'

import {
    Box,
    Button,
    Card,
    CardMedia,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    InputAdornment,
    OutlinedInput,
    Typography,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField
} from '@mui/material'
import { darken, useTheme } from '@mui/material/styles'
import {
    IconCircleDot,
    IconDownload,
    IconSend,
    IconMicrophone,
    IconPhotoPlus,
    IconTrash,
    IconX,
    IconTool,
    IconSquareFilled,
    IconCheck,
    IconPaperclip,
    IconSparkles,
    IconVolume,
    IconArrowsMaximize,
    IconMenu2,
    IconThumbUp
} from '@tabler/icons-react'
import kodivianPNG from '@/assets/images/kodivian-logo.png'
import userPNG from '@/assets/images/account.png'
import multiagent_supervisorPNG from '@/assets/images/multiagent_supervisor.png'
import multiagent_workerPNG from '@/assets/images/multiagent_worker.png'
import audioUploadSVG from '@/assets/images/wave-sound.jpg'

// project import
import NodeInputHandler from '@/views/canvas/NodeInputHandler'
import { MemoizedReactMarkdown } from '@/ui-component/markdown/MemoizedReactMarkdown'
import { SafeHTML } from '@/ui-component/safe/SafeHTML'
import SourceDocDialog from '@/ui-component/dialog/SourceDocDialog'
import ChatFeedbackContentDialog from '@/ui-component/dialog/ChatFeedbackContentDialog'
import StarterPromptsCard from '@/ui-component/cards/StarterPromptsCard'
import AgentReasoningCard from './AgentReasoningCard'
import AgentExecutedDataCard from './AgentExecutedDataCard'
import ChatSidebar from './ChatSidebar'
import { ImageButton, ImageSrc, ImageBackdrop, ImageMarked } from '@/ui-component/button/ImageButton'
import CopyToClipboardButton from '@/ui-component/button/CopyToClipboardButton'
import ThumbsUpButton from '@/ui-component/button/ThumbsUpButton'
import ThumbsDownButton from '@/ui-component/button/ThumbsDownButton'
import { cancelAudioRecording, startAudioRecording, stopAudioRecording } from './audio-recording'
import './audio-recording.css'
import './ChatMessage.css'

// api
import chatmessageApi from '@/api/chatmessage'
import chatflowsApi from '@/api/chatflows'
import predictionApi from '@/api/prediction'
import vectorstoreApi from '@/api/vectorstore'
import attachmentsApi from '@/api/attachments'
import chatmessagefeedbackApi from '@/api/chatmessagefeedback'
import executionsApi from '@/api/executions'
import ttsApi from '@/api/tts'
import chatSessionsApi from '@/api/chatSessions'

// Hooks
import useApi from '@/hooks/useApi'
import { flowContext } from '@/store/context/ReactFlowContext'

// Const
import { baseURL, maxScroll } from '@/store/constant'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'

// Utils
import { isValidURL, removeDuplicateURL, setLocalStorageChatflow } from '@/utils/genericHelper'
import useNotifier from '@/utils/useNotifier'
import FollowUpPromptsCard from '@/ui-component/cards/FollowUpPromptsCard'

// History
import { ChatInputHistory } from './ChatInputHistory'

const messageImageStyle = {
    width: '128px',
    height: '128px',
    objectFit: 'cover'
}

const CardWithDeleteOverlay = ({ item, disabled, customization, onDelete }) => {
    const [isHovered, setIsHovered] = useState(false)
    const defaultBackgroundColor = customization.isDarkMode ? 'rgba(0, 0, 0, 0.3)' : 'transparent'

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ position: 'relative', display: 'inline-block' }}
        >
            <Card
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: '48px',
                    width: 'max-content',
                    p: 2,
                    mr: 1,
                    flex: '0 0 auto',
                    transition: 'opacity 0.3s',
                    opacity: isHovered ? 1 : 1,
                    backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.3)' : defaultBackgroundColor
                }}
                variant='outlined'
            >
                <IconPaperclip size={20} style={{ transition: 'filter 0.3s', filter: isHovered ? 'blur(2px)' : 'none' }} />
                <span
                    style={{
                        marginLeft: '5px',
                        color: customization.isDarkMode ? 'white' : 'inherit',
                        transition: 'filter 0.3s',
                        filter: isHovered ? 'blur(2px)' : 'none'
                    }}
                >
                    {item.name}
                </span>
            </Card>
            {isHovered && !disabled && (
                <Button
                    disabled={disabled}
                    onClick={() => onDelete(item)}
                    startIcon={<IconTrash color='white' size={22} />}
                    title='Remove attachment'
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'transparent',
                        '&:hover': {
                            backgroundColor: 'transparent'
                        }
                    }}
                ></Button>
            )}
        </div>
    )
}

CardWithDeleteOverlay.propTypes = {
    item: PropTypes.object,
    customization: PropTypes.object,
    disabled: PropTypes.bool,
    onDelete: PropTypes.func
}

const ChatMessage = ({ open, chatflowid, isAgentCanvas, isDialog, previews, setPreviews, onExpand, onClose }) => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    const [searchParams, setSearchParams] = useSearchParams()

    const ps = useRef()
    const messageListRef = useRef()

    const dispatch = useDispatch()
    const { onAgentflowNodeStatusUpdate, clearAgentflowNodeStatus } = useContext(flowContext)

    useNotifier()
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    // Sidebar state - default to true for all modes (user can close it)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [currentChatId, setCurrentChatId] = useState(null)

    const [userInput, setUserInput] = useState('')
    const [loading, setLoading] = useState(false)
    const loadingRef = useRef(loading)
    useEffect(() => {
        loadingRef.current = loading
    }, [loading])

    const [messages, setMessages] = useState([
        {
            message: 'Hi there! How can I help?',
            type: 'apiMessage'
        }
    ])
    const [isChatFlowAvailableToStream, setIsChatFlowAvailableToStream] = useState(false)
    const [isChatFlowAvailableForSpeech, setIsChatFlowAvailableForSpeech] = useState(false)
    const [sourceDialogOpen, setSourceDialogOpen] = useState(false)
    const [sourceDialogProps, setSourceDialogProps] = useState({})
    // Initialize chatId from URL params only - no fallback, wait for session creation
    const urlChatId = searchParams.get('chatId')
    const [chatId, setChatId] = useState(urlChatId || null)
    const [isMessageStopping, setIsMessageStopping] = useState(false)
    const [uploadedFiles, setUploadedFiles] = useState([])
    const [imageUploadAllowedTypes, setImageUploadAllowedTypes] = useState('')
    const [fileUploadAllowedTypes, setFileUploadAllowedTypes] = useState('')
    const [inputHistory] = useState(new ChatInputHistory(10))

    const inputRef = useRef(null)
    const getChatmessageApi = useApi(chatmessageApi.getInternalChatmessageFromChatflow)
    const getAllExecutionsApi = useApi(executionsApi.getAllExecutions)
    const getIsChatflowStreamingApi = useApi(chatflowsApi.getIsChatflowStreaming)
    const getAllowChatFlowUploads = useApi(chatflowsApi.getAllowChatflowUploads)
    const getChatflowConfig = useApi(chatflowsApi.getSpecificChatflow)
    const createChatSessionApi = useApi(chatSessionsApi.createChatSession)
    const listChatSessionsApi = useApi(chatSessionsApi.listChatSessions)

    const [starterPrompts, setStarterPrompts] = useState([])

    // full file upload
    const [fullFileUpload, setFullFileUpload] = useState(false)
    const [fullFileUploadAllowedTypes, setFullFileUploadAllowedTypes] = useState('*')

    // feedback
    const [chatFeedbackStatus, setChatFeedbackStatus] = useState(false)
    const [feedbackId, setFeedbackId] = useState('')
    const [showFeedbackContentDialog, setShowFeedbackContentDialog] = useState(false)

    // Leads feature removed for autonomous server deployment
    // const [leadsConfig, setLeadsConfig] = useState(null)
    // const [leadName, setLeadName] = useState('')
    // const [leadEmail, setLeadEmail] = useState('')
    // const [leadPhone, setLeadPhone] = useState('')
    // const [isLeadSaving, setIsLeadSaving] = useState(false)
    // const [isLeadSaved, setIsLeadSaved] = useState(false)
    // Leads removed - leadsConfig and isLeadSaved no longer needed

    // follow-up prompts
    const [followUpPromptsStatus, setFollowUpPromptsStatus] = useState(false)
    const [followUpPrompts, setFollowUpPrompts] = useState([])

    // drag & drop and file input
    const imgUploadRef = useRef(null)
    const fileUploadRef = useRef(null)
    const [isChatFlowAvailableForImageUploads, setIsChatFlowAvailableForImageUploads] = useState(false)
    const [isChatFlowAvailableForFileUploads, setIsChatFlowAvailableForFileUploads] = useState(false)
    const [isChatFlowAvailableForRAGFileUploads, setIsChatFlowAvailableForRAGFileUploads] = useState(false)
    const [isDragActive, setIsDragActive] = useState(false)

    // recording
    const [isRecording, setIsRecording] = useState(false)
    const [recordingNotSupported, setRecordingNotSupported] = useState(false)
    const [isLoadingRecording, setIsLoadingRecording] = useState(false)

    const [openFeedbackDialog, setOpenFeedbackDialog] = useState(false)
    const [feedback, setFeedback] = useState('')
    const [pendingActionData, setPendingActionData] = useState(null)
    const [feedbackType, setFeedbackType] = useState('')

    // start input type
    const [startInputType, setStartInputType] = useState('')
    const [formTitle, setFormTitle] = useState('')
    const [formDescription, setFormDescription] = useState('')
    const [formInputsData, setFormInputsData] = useState({})
    const [formInputParams, setFormInputParams] = useState([])

    const [isConfigLoading, setIsConfigLoading] = useState(true)

    // TTS state
    const [isTTSLoading, setIsTTSLoading] = useState({})
    const [isTTSPlaying, setIsTTSPlaying] = useState({})
    const [ttsAudio, setTtsAudio] = useState({})
    const [isTTSEnabled, setIsTTSEnabled] = useState(false)

    // TTS streaming state
    const [ttsStreamingState, setTtsStreamingState] = useState({
        mediaSource: null,
        sourceBuffer: null,
        audio: null,
        chunkQueue: [],
        isBuffering: false,
        audioFormat: null,
        abortController: null
    })

    // Ref to prevent auto-scroll during TTS actions (using ref to avoid re-renders)
    const isTTSActionRef = useRef(false)
    const ttsTimeoutRef = useRef(null)

    // Debounced refresh mechanism to prevent excessive blinking
    const refreshTimeoutRef = useRef(null)
    const isRefreshingRef = useRef(false)

    // Track if we've already created an initial session for this chatflow
    const initialSessionCreatedRef = useRef(false)

    // Track the last loaded chatId to prevent re-loading the same chat
    const lastLoadedChatIdRef = useRef(null)

    // Track last refresh time to prevent excessive refreshes
    const lastRefreshTimeRef = useRef(0)
    const MIN_REFRESH_INTERVAL = 1000 // Minimum 1 second between refreshes

    // Debounced function to refresh chat sessions (prevents excessive blinking)
    const debouncedRefreshSessions = useCallback((immediate = false) => {
        const now = Date.now()
        const timeSinceLastRefresh = now - lastRefreshTimeRef.current

        // If already refreshing, skip (even for immediate)
        if (isRefreshingRef.current) {
            return
        }

        // If we refreshed recently, debounce even immediate requests
        if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL && !immediate) {
            // Clear any pending refresh
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current)
            }
            // Schedule refresh after minimum interval
            refreshTimeoutRef.current = setTimeout(() => {
                debouncedRefreshSessions(true)
            }, MIN_REFRESH_INTERVAL - timeSinceLastRefresh)
            return
        }

        // Clear any pending refresh
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current)
            refreshTimeoutRef.current = null
        }

        const refresh = async () => {
            if (!chatflowid || !listChatSessionsApi) return

            // Skip if already refreshing
            if (isRefreshingRef.current) return

            isRefreshingRef.current = true
            lastRefreshTimeRef.current = Date.now()

            try {
                await listChatSessionsApi.request(chatflowid, 1, 50)
            } catch (error) {
                console.error('Failed to refresh chat sessions:', error)
            } finally {
                // Reset refreshing flag after a short delay
                setTimeout(() => {
                    isRefreshingRef.current = false
                }, 300)
            }
        }

        if (immediate && timeSinceLastRefresh >= MIN_REFRESH_INTERVAL) {
            refresh()
        } else {
            // Debounce: wait 500ms before refreshing
            refreshTimeoutRef.current = setTimeout(refresh, 500)
        }
    }, [chatflowid, listChatSessionsApi])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current)
            }
        }
    }, [])

    const isFileAllowedForUpload = (file) => {
        const constraints = getAllowChatFlowUploads.data
        /**
         * {isImageUploadAllowed: boolean, imgUploadSizeAndTypes: Array<{ fileTypes: string[], maxUploadSize: number }>}
         */
        let acceptFile = false

        // Early return if constraints are not available yet
        if (!constraints) {
            console.warn('Upload constraints not loaded yet')
            return false
        }

        if (constraints.isImageUploadAllowed) {
            const fileType = file.type
            const sizeInMB = file.size / 1024 / 1024
            if (constraints.imgUploadSizeAndTypes && Array.isArray(constraints.imgUploadSizeAndTypes)) {
                constraints.imgUploadSizeAndTypes.forEach((allowed) => {
                    if (allowed.fileTypes && allowed.fileTypes.includes(fileType) && sizeInMB <= allowed.maxUploadSize) {
                        acceptFile = true
                    }
                })
            }
        }

        if (fullFileUpload) {
            return true
        } else if (constraints.isRAGFileUploadAllowed) {
            const fileExt = file.name.split('.').pop()
            if (fileExt && constraints.fileUploadSizeAndTypes && Array.isArray(constraints.fileUploadSizeAndTypes)) {
                constraints.fileUploadSizeAndTypes.forEach((allowed) => {
                    if (allowed.fileTypes && allowed.fileTypes.length === 1 && allowed.fileTypes[0] === '*') {
                        acceptFile = true
                    } else if (allowed.fileTypes && allowed.fileTypes.includes(`.${fileExt}`)) {
                        acceptFile = true
                    }
                })
            }
        }
        if (!acceptFile) {
            alert(`Cannot upload file. Kindly check the allowed file types and maximum allowed size.`)
        }
        return acceptFile
    }

    const handleDrop = async (e) => {
        if (!isChatFlowAvailableForImageUploads && !isChatFlowAvailableForFileUploads) {
            return
        }
        e.preventDefault()
        setIsDragActive(false)
        let files = []
        let uploadedFiles = []

        if (e.dataTransfer.files.length > 0) {
            for (const file of e.dataTransfer.files) {
                if (isFileAllowedForUpload(file) === false) {
                    return
                }
                const reader = new FileReader()
                const { name } = file
                // Only add files
                if (!file.type || !imageUploadAllowedTypes.includes(file.type)) {
                    uploadedFiles.push({ file, type: fullFileUpload ? 'file:full' : 'file:rag' })
                }
                files.push(
                    new Promise((resolve) => {
                        reader.onload = (evt) => {
                            if (!evt?.target?.result) {
                                return
                            }
                            const { result } = evt.target
                            let previewUrl
                            if (file.type.startsWith('audio/')) {
                                previewUrl = audioUploadSVG
                            } else {
                                previewUrl = URL.createObjectURL(file)
                            }
                            resolve({
                                data: result,
                                preview: previewUrl,
                                type: 'file',
                                name: name,
                                mime: file.type
                            })
                        }
                        reader.readAsDataURL(file)
                    })
                )
            }

            const newFiles = await Promise.all(files)
            setUploadedFiles(uploadedFiles)
            setPreviews((prevPreviews) => [...prevPreviews, ...newFiles])
        }

        if (e.dataTransfer.items) {
            //TODO set files
            for (const item of e.dataTransfer.items) {
                if (item.kind === 'string' && item.type.match('^text/uri-list')) {
                    item.getAsString((s) => {
                        let upload = {
                            data: s,
                            preview: s,
                            type: 'url',
                            name: s ? s.substring(s.lastIndexOf('/') + 1) : ''
                        }
                        setPreviews((prevPreviews) => [...prevPreviews, upload])
                    })
                } else if (item.kind === 'string' && item.type.match('^text/html')) {
                    item.getAsString((s) => {
                        if (s.indexOf('href') === -1) return
                        //extract href
                        let start = s ? s.substring(s.indexOf('href') + 6) : ''
                        let hrefStr = start.substring(0, start.indexOf('"'))

                        let upload = {
                            data: hrefStr,
                            preview: hrefStr,
                            type: 'url',
                            name: hrefStr ? hrefStr.substring(hrefStr.lastIndexOf('/') + 1) : ''
                        }
                        setPreviews((prevPreviews) => [...prevPreviews, upload])
                    })
                }
            }
        }
    }

    const handleFileChange = async (event) => {
        const fileObj = event.target.files && event.target.files[0]
        if (!fileObj) {
            return
        }
        let files = []
        let uploadedFiles = []
        for (const file of event.target.files) {
            if (isFileAllowedForUpload(file) === false) {
                return
            }
            // Only add files
            if (!file.type || !imageUploadAllowedTypes.includes(file.type)) {
                uploadedFiles.push({ file, type: fullFileUpload ? 'file:full' : 'file:rag' })
            }
            const reader = new FileReader()
            const { name } = file
            files.push(
                new Promise((resolve) => {
                    reader.onload = (evt) => {
                        if (!evt?.target?.result) {
                            return
                        }
                        const { result } = evt.target
                        resolve({
                            data: result,
                            preview: URL.createObjectURL(file),
                            type: 'file',
                            name: name,
                            mime: file.type
                        })
                    }
                    reader.readAsDataURL(file)
                })
            )
        }

        const newFiles = await Promise.all(files)
        setUploadedFiles(uploadedFiles)
        setPreviews((prevPreviews) => [...prevPreviews, ...newFiles])
        // 👇️ reset file input
        event.target.value = null
    }

    const addRecordingToPreviews = (blob) => {
        let mimeType = ''
        const pos = blob.type.indexOf(';')
        if (pos === -1) {
            mimeType = blob.type
        } else {
            mimeType = blob.type ? blob.type.substring(0, pos) : ''
        }
        // read blob and add to previews
        const reader = new FileReader()
        reader.readAsDataURL(blob)
        reader.onloadend = () => {
            const base64data = reader.result
            const upload = {
                data: base64data,
                preview: audioUploadSVG,
                type: 'audio',
                name: `audio_${Date.now()}.wav`,
                mime: mimeType
            }
            setPreviews((prevPreviews) => [...prevPreviews, upload])
        }
    }

    const handleDrag = (e) => {
        if (isChatFlowAvailableForImageUploads || isChatFlowAvailableForFileUploads) {
            e.preventDefault()
            e.stopPropagation()
            if (e.type === 'dragenter' || e.type === 'dragover') {
                setIsDragActive(true)
            } else if (e.type === 'dragleave') {
                setIsDragActive(false)
            }
        }
    }

    const handleAbort = async () => {
        setIsMessageStopping(true)
        try {
            // Stop all TTS streams first
            await handleTTSAbortAll()
            stopAllTTS()

            await chatmessageApi.abortMessage(chatflowid, chatId)
            setIsMessageStopping(false)
        } catch (error) {
            setIsMessageStopping(false)
            enqueueSnackbar({
                message: error?.response?.data && typeof error.response.data === 'object' ? error.response.data.message : error?.response?.data || error?.message || 'Unknown error',
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

    const handleDeletePreview = (itemToDelete) => {
        if (itemToDelete.type === 'file') {
            URL.revokeObjectURL(itemToDelete.preview) // Clean up for file
        }
        setPreviews(previews.filter((item) => item !== itemToDelete))
    }

    const handleFileUploadClick = () => {
        // 👇️ open file input box on click of another element
        fileUploadRef.current.click()
    }

    const handleImageUploadClick = () => {
        // 👇️ open file input box on click of another element
        imgUploadRef.current.click()
    }

    const clearPreviews = () => {
        // Revoke the data uris to avoid memory leaks
        previews.forEach((file) => URL.revokeObjectURL(file.preview))
        setPreviews([])
    }

    const onMicrophonePressed = () => {
        setIsRecording(true)
        startAudioRecording(setIsRecording, setRecordingNotSupported)
    }

    const onRecordingCancelled = () => {
        if (!recordingNotSupported) cancelAudioRecording()
        setIsRecording(false)
        setRecordingNotSupported(false)
    }

    const onRecordingStopped = async () => {
        setIsLoadingRecording(true)
        stopAudioRecording(addRecordingToPreviews)
    }

    const onSourceDialogClick = (data, title) => {
        setSourceDialogProps({ data, title })
        setSourceDialogOpen(true)
    }

    const onURLClick = (data) => {
        window.open(data, '_blank')
    }

    const scrollToBottom = () => {
        // Try message list first (more accurate)
        if (messageListRef.current) {
            messageListRef.current.scrollTo({ top: messageListRef.current.scrollHeight, behavior: 'smooth' })
        } else if (ps.current) {
            // Fallback to cloud container
            ps.current.scrollTo({ top: maxScroll })
        }
    }

    // Helper function to manage TTS action flag
    const setTTSAction = (isActive) => {
        isTTSActionRef.current = isActive
        if (ttsTimeoutRef.current) {
            clearTimeout(ttsTimeoutRef.current)
            ttsTimeoutRef.current = null
        }
        if (isActive) {
            // Reset the flag after a longer delay to ensure all state changes are complete
            ttsTimeoutRef.current = setTimeout(() => {
                isTTSActionRef.current = false
                ttsTimeoutRef.current = null
            }, 300)
        }
    }

    const onChange = useCallback((e) => setUserInput(e.target.value), [setUserInput])

    const updateLastMessage = (text) => {
        setMessages((prevMessages) => {
            let allMessages = [...cloneDeep(prevMessages)]
            if (allMessages.length === 0) return allMessages

            // If last message is user message (start event missed), append new api message
            if (allMessages[allMessages.length - 1].type === 'userMessage') {
                allMessages.push({
                    message: text,
                    type: 'apiMessage'
                })
                return allMessages
            }

            allMessages[allMessages.length - 1].message += text
            allMessages[allMessages.length - 1].feedback = null
            return allMessages
        })
    }

    const updateErrorMessage = (errorMessage) => {
        setMessages((prevMessages) => {
            let allMessages = [...cloneDeep(prevMessages)]
            allMessages.push({ message: errorMessage, type: 'apiMessage' })
            return allMessages
        })
    }

    const updateLastMessageSourceDocuments = (sourceDocuments) => {
        setMessages((prevMessages) => {
            let allMessages = [...cloneDeep(prevMessages)]
            if (allMessages.length === 0) return allMessages
            if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages
            allMessages[allMessages.length - 1].sourceDocuments = sourceDocuments
            return allMessages
        })
    }

    const updateLastMessageAgentReasoning = (agentReasoning) => {
        setMessages((prevMessages) => {
            let allMessages = [...cloneDeep(prevMessages)]
            if (allMessages.length === 0) return allMessages
            if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages
            allMessages[allMessages.length - 1].agentReasoning = agentReasoning
            return allMessages
        })
    }

    const updateAgentFlowEvent = (event) => {
        if (event === 'INPROGRESS') {
            setMessages((prevMessages) => [...prevMessages, { message: '', type: 'apiMessage', agentFlowEventStatus: event }])
        } else {
            setMessages((prevMessages) => {
                let allMessages = [...cloneDeep(prevMessages)]
                if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages
                allMessages[allMessages.length - 1].agentFlowEventStatus = event
                return allMessages
            })
        }
    }

    const updateAgentFlowExecutedData = (agentFlowExecutedData) => {
        setMessages((prevMessages) => {
            let allMessages = [...cloneDeep(prevMessages)]
            if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages
            allMessages[allMessages.length - 1].agentFlowExecutedData = agentFlowExecutedData
            return allMessages
        })
    }

    const updateLastMessageAction = (action) => {
        setMessages((prevMessages) => {
            let allMessages = [...cloneDeep(prevMessages)]
            if (allMessages.length === 0) return allMessages
            if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages
            allMessages[allMessages.length - 1].action = action
            return allMessages
        })
    }

    const updateLastMessageArtifacts = (artifacts) => {
        artifacts.forEach((artifact) => {
            if (artifact.type === 'png' || artifact.type === 'jpeg') {
                artifact.data = `${baseURL}/api/v1/get-upload-file?chatflowId=${chatflowid}&chatId=${chatId}&fileName=${artifact.data.replace(
                    'FILE-STORAGE::',
                    ''
                )}`
            }
        })
        setMessages((prevMessages) => {
            let allMessages = [...cloneDeep(prevMessages)]
            if (allMessages.length === 0) return allMessages
            if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages
            allMessages[allMessages.length - 1].artifacts = artifacts
            return allMessages
        })
    }

    const updateLastMessageNextAgent = (nextAgent) => {
        setMessages((prevMessages) => {
            let allMessages = [...cloneDeep(prevMessages)]
            if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages
            const lastAgentReasoning = allMessages[allMessages.length - 1].agentReasoning
            if (lastAgentReasoning && lastAgentReasoning.length > 0) {
                lastAgentReasoning.push({ nextAgent })
            }
            allMessages[allMessages.length - 1].agentReasoning = lastAgentReasoning
            return allMessages
        })
    }

    const updateLastMessageNextAgentFlow = (nextAgentFlow) => {
        onAgentflowNodeStatusUpdate(nextAgentFlow)
    }

    const updateLastMessageUsedTools = (usedTools) => {
        setMessages((prevMessages) => {
            let allMessages = [...cloneDeep(prevMessages)]
            if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages

            // When usedTools are received, check if there are matching calledTools to replace
            const lastMessage = allMessages[allMessages.length - 1]
            if (lastMessage.calledTools && lastMessage.calledTools.length > 0) {
                // Replace calledTools with usedTools for matching tool names
                const updatedCalledTools = lastMessage.calledTools.map((calledTool) => {
                    const matchingUsedTool = usedTools.find((usedTool) => usedTool.tool === calledTool.tool)
                    return matchingUsedTool || calledTool
                })

                // Remove calledTools that have been replaced by usedTools
                const remainingCalledTools = updatedCalledTools.filter(
                    (calledTool) => !usedTools.some((usedTool) => usedTool.tool === calledTool.tool)
                )

                allMessages[allMessages.length - 1].calledTools = remainingCalledTools.length > 0 ? remainingCalledTools : undefined
            }

            allMessages[allMessages.length - 1].usedTools = usedTools
            return allMessages
        })
    }

    const updateLastMessageCalledTools = (calledTools) => {
        setMessages((prevMessages) => {
            let allMessages = [...cloneDeep(prevMessages)]
            if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages
            allMessages[allMessages.length - 1].calledTools = calledTools
            return allMessages
        })
    }

    const cleanupCalledTools = () => {
        setMessages((prevMessages) => {
            let allMessages = [...cloneDeep(prevMessages)]
            if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages

            // Remove any remaining calledTools when the stream ends
            const lastMessage = allMessages[allMessages.length - 1]
            if (lastMessage && lastMessage.calledTools && lastMessage.calledTools.length > 0) {
                // Only remove if there are still calledTools and no matching usedTools
                const hasUsedTools = lastMessage.usedTools && lastMessage.usedTools.length > 0
                if (!hasUsedTools) {
                    allMessages[allMessages.length - 1].calledTools = undefined
                }
            }

            return allMessages
        })
    }

    const updateLastMessageFileAnnotations = (fileAnnotations) => {
        setMessages((prevMessages) => {
            let allMessages = [...cloneDeep(prevMessages)]
            if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages
            allMessages[allMessages.length - 1].fileAnnotations = fileAnnotations
            return allMessages
        })
    }

    const abortMessage = () => {
        setIsMessageStopping(false)
        setMessages((prevMessages) => {
            let allMessages = [...cloneDeep(prevMessages)]
            if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages
            const lastAgentReasoning = allMessages[allMessages.length - 1].agentReasoning
            if (lastAgentReasoning && lastAgentReasoning.length > 0) {
                allMessages[allMessages.length - 1].agentReasoning = lastAgentReasoning.filter((reasoning) => !reasoning.nextAgent)
            }
            allMessages[allMessages.length - 1].calledTools = undefined
            return allMessages
        })
        setTimeout(() => {
            inputRef.current?.focus()
        }, 100)
        enqueueSnackbar({
            message: 'Message stopped',
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
    }

    const handleError = (message = 'Oops! There seems to be an error. Please try again.') => {
        message = message.replace(`Unable to parse JSON response from chat agent.\n\n`, '')
        setMessages((prevMessages) => [...prevMessages, { message, type: 'apiMessage' }])
        setLoading(false)
        setUserInput('')
        setUploadedFiles([])
        setTimeout(() => {
            inputRef.current?.focus()
        }, 100)
    }

    const handlePromptClick = async (promptStarterInput) => {
        setUserInput(promptStarterInput)
        handleSubmit(undefined, promptStarterInput)
    }

    const handleFollowUpPromptClick = async (promptStarterInput) => {
        setUserInput(promptStarterInput)
        setFollowUpPrompts([])
        handleSubmit(undefined, promptStarterInput)
    }

    const onSubmitResponse = (actionData, feedback = '', type = '') => {
        let fbType = feedbackType
        if (type) {
            fbType = type
        }
        const question = feedback ? feedback : fbType.charAt(0).toUpperCase() + fbType.slice(1)
        handleSubmit(undefined, question, undefined, {
            type: fbType,
            startNodeId: actionData?.nodeId,
            feedback
        })
    }

    const handleSubmitFeedback = () => {
        if (pendingActionData) {
            onSubmitResponse(pendingActionData, feedback)
            setOpenFeedbackDialog(false)
            setFeedback('')
            setPendingActionData(null)
            setFeedbackType('')
        }
    }

    const handleActionClick = async (elem, action) => {
        setUserInput(elem.label)
        setMessages((prevMessages) => {
            let allMessages = [...cloneDeep(prevMessages)]
            if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages
            allMessages[allMessages.length - 1].action = null
            return allMessages
        })
        if (elem.type.includes('agentflowv2')) {
            const type = elem.type.includes('approve') ? 'proceed' : 'reject'
            setFeedbackType(type)

            if (action.data && action.data.input && action.data.input.humanInputEnableFeedback) {
                setPendingActionData(action.data)
                setOpenFeedbackDialog(true)
            } else {
                onSubmitResponse(action.data, '', type)
            }
        } else {
            handleSubmit(undefined, elem.label, action)
        }
    }

    const updateMetadata = (data, input) => {
        // set message id that is needed for feedback
        if (data.chatMessageId) {
            setMessages((prevMessages) => {
                let allMessages = [...cloneDeep(prevMessages)]
                if (allMessages[allMessages.length - 1].type === 'apiMessage') {
                    allMessages[allMessages.length - 1].id = data.chatMessageId
                }
                return allMessages
            })
        }

        // Update chatId from response (backend may have created a new one)
        // Always update if we get a chatId back, even if we didn't send one
        if (data.chatId) {
            const newChatId = data.chatId
            const wasNewChat = !chatId || !currentChatId

            setChatId(newChatId)
            setCurrentChatId(newChatId)

            const currentUrlChatId = searchParams.get('chatId')
            if (currentUrlChatId !== newChatId) {
                setSearchParams((prev) => {
                    const newParams = new URLSearchParams(prev)
                    newParams.set('chatId', newChatId)
                    return newParams
                }, { replace: true })
            }
            setLocalStorageChatflow(chatflowid, newChatId)

            // Refresh sidebar when chatId is set/updated (debounced to prevent blinking)
            if (chatflowid) {
                debouncedRefreshSessions(wasNewChat) // Immediate for new chats, debounced for existing
            }
        }

        if (input === '' && data.question) {
            // the response contains the question even if it was in an audio format
            // so if input is empty but the response contains the question, update the user message to show the question
            setMessages((prevMessages) => {
                let allMessages = [...cloneDeep(prevMessages)]
                if (allMessages[allMessages.length - 2].type === 'apiMessage') return allMessages
                allMessages[allMessages.length - 2].message = data.question
                return allMessages
            })
        }

        if (data.followUpPrompts) {
            const followUpPrompts = JSON.parse(data.followUpPrompts)
            if (typeof followUpPrompts === 'string') {
                setFollowUpPrompts(JSON.parse(followUpPrompts))
            } else {
                setFollowUpPrompts(followUpPrompts)
            }
        }
    }

    const handleFileUploads = async (uploads) => {
        if (!uploadedFiles.length) return uploads

        if (fullFileUpload) {
            const filesWithFullUploadType = uploadedFiles.filter((file) => file.type === 'file:full')
            if (filesWithFullUploadType.length > 0) {
                const formData = new FormData()
                for (const file of filesWithFullUploadType) {
                    formData.append('files', file.file)
                }
                formData.append('chatId', chatId)

                const response = await attachmentsApi.createAttachment(chatflowid, chatId, formData)
                const data = response.data

                for (const extractedFileData of data) {
                    const content = extractedFileData.content
                    const fileName = extractedFileData.name

                    // find matching name in previews and replace data with content
                    const uploadIndex = uploads.findIndex((upload) => upload.name === fileName)

                    if (uploadIndex !== -1) {
                        uploads[uploadIndex] = {
                            ...uploads[uploadIndex],
                            data: content,
                            name: fileName,
                            type: 'file:full'
                        }
                    }
                }
            }
        } else if (isChatFlowAvailableForRAGFileUploads) {
            const filesWithRAGUploadType = uploadedFiles.filter((file) => file.type === 'file:rag')

            if (filesWithRAGUploadType.length > 0) {
                const formData = new FormData()
                for (const file of filesWithRAGUploadType) {
                    formData.append('files', file.file)
                }
                formData.append('chatId', chatId)

                await vectorstoreApi.upsertVectorStoreWithFormData(chatflowid, formData)

                // delay for vector store to be updated
                const delay = (delayInms) => {
                    return new Promise((resolve) => setTimeout(resolve, delayInms))
                }
                await delay(2500) //TODO: check if embeddings can be retrieved using file name as metadata filter

                uploads = uploads.map((upload) => {
                    return {
                        ...upload,
                        type: 'file:rag'
                    }
                })
            }
        }
        return uploads
    }

    // Handle form submission
    const handleSubmit = async (e, selectedInput, action, humanInput) => {
        if (e) e.preventDefault()

        if (!selectedInput && userInput.trim() === '') {
            const containsFile = previews.filter((item) => !item.mime.startsWith('image') && item.type !== 'audio').length > 0
            if (!previews.length || (previews.length && containsFile)) {
                return
            }
        }

        let input = userInput

        if (typeof selectedInput === 'string') {
            if (selectedInput !== undefined && selectedInput.trim() !== '') input = selectedInput

            if (input.trim()) {
                inputHistory.addToHistory(input)
            }
        } else if (typeof selectedInput === 'object') {
            input = Object.entries(selectedInput)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n')
        }

        setLoading(true)
        clearAgentflowNodeStatus()

        let uploads = previews.map((item) => {
            return {
                data: item.data,
                type: item.type,
                name: item.name,
                mime: item.mime
            }
        })

        try {
            uploads = await handleFileUploads(uploads)
        } catch (error) {
            handleError('Unable to upload documents')
            return
        }

        clearPreviews()
        setMessages((prevMessages) => [...prevMessages, { message: input, type: 'userMessage', fileUploads: uploads }])

        // Send user question to Prediction Internal API
        // Use currentChatId to ensure we're using the correct chat (not stale state)
        // Allow null chatId - backend will create one if needed
        const activeChatId = currentChatId || chatId

        try {
            const params = {
                question: input,
                chatId: activeChatId || undefined // Send undefined if null, backend will create chatId
            }
            if (typeof selectedInput === 'object') {
                params.form = selectedInput
                delete params.question
            }
            if (uploads && uploads.length > 0) params.uploads = uploads
            // Leads feature removed for autonomous server deployment
            // if (leadEmail) params.leadEmail = leadEmail
            if (action) params.action = action
            if (humanInput) params.humanInput = humanInput

            if (isChatFlowAvailableToStream) {
                fetchResponseFromEventStream(chatflowid, params)
            } else {
                const response = await predictionApi.sendMessageAndGetPrediction(chatflowid, params)
                if (response.data) {
                    const data = response.data

                    updateMetadata(data, input)

                    let text = ''
                    if (data.text) text = data.text
                    else if (data.json) text = '```json\n' + JSON.stringify(data.json, null, 2)
                    else text = JSON.stringify(data, null, 2)

                    setMessages((prevMessages) => [
                        ...prevMessages,
                        {
                            message: text,
                            id: data?.chatMessageId,
                            sourceDocuments: data?.sourceDocuments,
                            usedTools: data?.usedTools,
                            calledTools: data?.calledTools,
                            fileAnnotations: data?.fileAnnotations,
                            agentReasoning: data?.agentReasoning,
                            agentFlowExecutedData: data?.agentFlowExecutedData,
                            action: data?.action,
                            artifacts: data?.artifacts,
                            type: 'apiMessage',
                            feedback: null
                        }
                    ])

                    // Update chatId from response (backend may have created a new one)
                    // Always update if we get a chatId back, even if we didn't send one
                    if (data.chatId) {
                        setChatId(data.chatId)
                        setCurrentChatId(data.chatId)

                        const currentUrlChatId = searchParams.get('chatId')
                        if (currentUrlChatId !== data.chatId) {
                            setSearchParams((prev) => {
                                const newParams = new URLSearchParams(prev)
                                newParams.set('chatId', data.chatId)
                                return newParams
                            }, { replace: true })
                        }
                        setLocalStorageChatflow(chatflowid, data.chatId)
                    }
                    setLoading(false)
                    setUserInput('')
                    setUploadedFiles([])

                    // Refresh sessions (debounced - updateMetadata should handle this, but this is a fallback)
                    if (chatflowid && data.chatId) {
                        debouncedRefreshSessions()
                    }

                    setTimeout(() => {
                        inputRef.current?.focus()
                        scrollToBottom()
                    }, 100)
                }
            }
        } catch (error) {
            handleError(error?.response?.data?.message || error?.message || error || 'Unexpected Error!')
            return
        }
    }

    const fetchResponseFromEventStream = async (chatflowid, params) => {
        // Use currentChatId to ensure we're using the correct chat
        // Allow null chatId - backend will create one if needed
        const activeChatId = currentChatId || params.chatId || chatId
        params.chatId = activeChatId || undefined // Send undefined if null, backend will create chatId
        const chatIdForStream = activeChatId
        const input = params.question
        params.streaming = true
        await fetchEventSource(`${baseURL}/api/v1/internal-prediction/${chatflowid}`, {
            openWhenHidden: true,
            method: 'POST',
            body: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json',
                'x-request-from': 'internal'
            },
            async onopen(response) {
                if (response.ok && response.headers.get('content-type') === EventStreamContentType) {
                    //console.log('EventSource Open')
                }
            },
            async onmessage(ev) {
                const payload = JSON.parse(ev.data)
                switch (payload.event) {
                    case 'start':
                        setMessages((prevMessages) => [...prevMessages, { message: '', type: 'apiMessage' }])
                        break
                    case 'token':
                        updateLastMessage(payload.data)
                        break
                    case 'sourceDocuments':
                        updateLastMessageSourceDocuments(payload.data)
                        break
                    case 'usedTools':
                        updateLastMessageUsedTools(payload.data)
                        break
                    case 'calledTools':
                        updateLastMessageCalledTools(payload.data)
                        break
                    case 'fileAnnotations':
                        updateLastMessageFileAnnotations(payload.data)
                        break
                    case 'agentReasoning':
                        updateLastMessageAgentReasoning(payload.data)
                        break
                    case 'agentFlowEvent':
                        updateAgentFlowEvent(payload.data)
                        break
                    case 'agentFlowExecutedData':
                        updateAgentFlowExecutedData(payload.data)
                        break
                    case 'artifacts':
                        updateLastMessageArtifacts(payload.data)
                        break
                    case 'action':
                        updateLastMessageAction(payload.data)
                        break
                    case 'nextAgent':
                        updateLastMessageNextAgent(payload.data)
                        break
                    case 'nextAgentFlow':
                        updateLastMessageNextAgentFlow(payload.data)
                        break
                    case 'metadata':
                        updateMetadata(payload.data, input)
                        break
                    case 'error':
                        updateErrorMessage(payload.data)
                        break
                    case 'abort':
                        abortMessage(payload.data)
                        closeResponse()
                        break
                    case 'tts_start':
                        handleTTSStart(payload.data)
                        break
                    case 'tts_data':
                        handleTTSDataChunk(payload.data.audioChunk)
                        break
                    case 'tts_end':
                        handleTTSEnd()
                        break
                    case 'tts_abort':
                        handleTTSAbort(payload.data)
                        break
                    case 'end':
                        cleanupCalledTools()
                        // Use the chatId from the stream params, not from closure
                        setLocalStorageChatflow(chatflowid, chatIdForStream)

                        // Update chatId state if we have one from stream
                        if (chatIdForStream) {
                            const wasNewChat = !chatId || !currentChatId
                            setChatId(chatIdForStream)
                            setCurrentChatId(chatIdForStream)
                            const currentUrlChatId = searchParams.get('chatId')
                            if (currentUrlChatId !== chatIdForStream) {
                                setSearchParams((prev) => {
                                    const newParams = new URLSearchParams(prev)
                                    newParams.set('chatId', chatIdForStream)
                                    return newParams
                                }, { replace: true })
                            }

                            // Refresh sessions after streaming completes (debounced)
                            if (chatflowid) {
                                debouncedRefreshSessions(wasNewChat) // Immediate for new chats
                            }
                        } else {
                            // Fallback refresh if no chatId was set (debounced)
                            if (chatflowid) {
                                debouncedRefreshSessions()
                            }
                        }
                        closeResponse()
                        break
                }
            },
            async onclose() {
                cleanupCalledTools()
                closeResponse()
            },
            async onerror(err) {
                console.error('EventSource Error: ', err)
                closeResponse()
                throw err
            }
        })
    }

    const closeResponse = () => {
        cleanupCalledTools()
        setLoading(false)
        setUserInput('')
        setUploadedFiles([])

        // Refresh sessions after message completes (debounced - updateMetadata should handle this)
        if (chatflowid) {
            debouncedRefreshSessions()
        }

        setTimeout(() => {
            inputRef.current?.focus()
            scrollToBottom()
        }, 100)
    }
    // Prevent blank submissions and allow for multiline input
    const handleEnter = (e) => {
        // Check if IME composition is in progress
        const isIMEComposition = e.isComposing || e.keyCode === 229
        if (e.key === 'ArrowUp' && !isIMEComposition) {
            e.preventDefault()
            const previousInput = inputHistory.getPreviousInput(userInput)
            setUserInput(previousInput)
        } else if (e.key === 'ArrowDown' && !isIMEComposition) {
            e.preventDefault()
            const nextInput = inputHistory.getNextInput()
            setUserInput(nextInput)
        } else if (e.key === 'Enter' && userInput && !isIMEComposition) {
            if (!e.shiftKey && userInput) {
                handleSubmit(e)
            }
        } else if (e.key === 'Enter') {
            e.preventDefault()
        }
    }

    const getLabel = (URL, source) => {
        if (URL && typeof URL === 'object') {
            if (URL.pathname && typeof URL.pathname === 'string') {
                if (URL.pathname.substring(0, 15) === '/') {
                    return URL.host || ''
                } else {
                    return `${URL.pathname.substring(0, 15)}...`
                }
            } else if (URL.host) {
                return URL.host
            }
        }

        if (source && source.pageContent && typeof source.pageContent === 'string') {
            return `${source.pageContent.substring(0, 15)}...`
        }

        return ''
    }

    const getFileUploadAllowedTypes = () => {
        if (fullFileUpload) {
            return fullFileUploadAllowedTypes === '' ? '*' : fullFileUploadAllowedTypes
        }
        return fileUploadAllowedTypes.includes('*') ? '*' : fileUploadAllowedTypes || '*'
    }

    const downloadFile = async (fileAnnotation) => {
        try {
            const response = await axios.post(
                `${baseURL}/api/v1/openai-assistants-file/download`,
                { fileName: fileAnnotation.fileName, chatflowId: chatflowid, chatId: chatId },
                { responseType: 'blob' }
            )
            const blob = new Blob([response.data], { type: response.headers['content-type'] })
            const downloadUrl = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = downloadUrl
            link.download = fileAnnotation.fileName
            document.body.appendChild(link)
            link.click()
            link.remove()
        } catch (error) {
            console.error('Download failed:', error)
        }
    }

    const getAgentIcon = (nodeName, instructions) => {
        if (nodeName) {
            return `${baseURL}/api/v1/node-icon/${nodeName}`
        } else if (instructions) {
            return multiagent_supervisorPNG
        } else {
            return multiagent_workerPNG
        }
    }

    // Load chat sessions when chatflowId changes or when popup opens
    // Always reload when opening to ensure we have the latest sessions
    useEffect(() => {
        if (chatflowid && open && !listChatSessionsApi.loading) {
            // Always reload sessions when opening to get the latest state
            // This ensures we don't use stale data that might cause duplicate session creation
            listChatSessionsApi.request(chatflowid, 1, 50).then((response) => {
                // Debug: Log the response to see what we're getting
                const responseData = response?.data || response
                console.log('Chat sessions loaded:', {
                    total: responseData?.total,
                    sessionsCount: responseData?.sessions?.length,
                    sessions: responseData?.sessions
                })
            }).catch((error) => {
                console.error('Failed to load chat sessions:', error)
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatflowid, open])

    // Initialize chat when popup opens - wait for sessions to load, then load latest chat
    useEffect(() => {
        if (open && chatflowid) {
            const urlChatId = searchParams.get('chatId')

            // If there's a specific chatId in URL, load that chat
            if (urlChatId) {
                // Only load if this is a different chat than what we've already loaded
                if (urlChatId !== lastLoadedChatIdRef.current) {
                    // Load existing chat from URL
                    setChatId(urlChatId)
                    setCurrentChatId(urlChatId)
                    // Clear messages first, then load messages for this chat
                    setMessages([
                        {
                            message: 'Hi there! How can I help?',
                            type: 'apiMessage'
                        }
                    ])
                    setUserInput('')
                    // Load messages for this chat
                    if (chatflowid) {
                        getChatmessageApi.request(chatflowid, { chatId: urlChatId })
                        lastLoadedChatIdRef.current = urlChatId
                    }
                }
            } else {
                // No chatId in URL - wait for sessions to load, then load the latest chat
                // IMPORTANT: Wait for sessions to load to ensure sidebar shows all chats
                // We check both loading state AND data presence to be sure
                if (listChatSessionsApi.loading || !listChatSessionsApi.data) {
                    // Still loading sessions - wait for them to finish
                    return
                }

                // Sessions are loaded (or failed to load)
                const sessions = listChatSessionsApi.data?.sessions
                    ? (Array.isArray(listChatSessionsApi.data.sessions)
                        ? listChatSessionsApi.data.sessions
                        : [])
                    : (Array.isArray(listChatSessionsApi.data) ? listChatSessionsApi.data : [])

                // If loading is true (user started chatting), don't overwrite state
                if (loadingRef.current) return

                // IMPORTANT: Check if we've already processed this chatflow to prevent duplicate creation
                const isNewChatflow = lastProcessedChatflowRef.current !== chatflowid

                if (sessions.length > 0) {
                    // Chat history exists - load the first (most recent) chat
                    // DO NOT create a new chat if history exists
                    const recentChat = sessions[0]

                    // Only load if this is a different chat than what we've already loaded
                    if (recentChat.chatId !== lastLoadedChatIdRef.current) {
                        setChatId(recentChat.chatId)
                        setCurrentChatId(recentChat.chatId)
                        const currentUrlChatId = searchParams.get('chatId')
                        if (currentUrlChatId !== recentChat.chatId) {
                            setSearchParams((prev) => {
                                const newParams = new URLSearchParams(prev)
                                newParams.set('chatId', recentChat.chatId)
                                return newParams
                            }, { replace: true })
                        }
                        // Load messages
                        setMessages([
                            {
                                message: 'Hi there! How can I help?',
                                type: 'apiMessage'
                            }
                        ])
                        getChatmessageApi.request(chatflowid, { chatId: recentChat.chatId })
                        lastLoadedChatIdRef.current = recentChat.chatId
                    }
                    // Mark that we've processed this chatflow and sessions exist
                    initialSessionCreatedRef.current = false
                    lastProcessedChatflowRef.current = chatflowid
                } else {
                    // No chat history exists - create a new chat session ONLY if:
                    // 1. We haven't already created one for this chatflow (flag check)
                    // 2. This is a new chatflow OR we haven't processed it yet
                    if (initialSessionCreatedRef.current && !isNewChatflow) {
                        // Already attempted to create initial session for this chatflow
                        // Don't create another one, just show empty state and wait for refresh
                        setChatId(null)
                        setCurrentChatId(null)
                        setMessages([
                            {
                                message: 'Hi there! How can I help?',
                                type: 'apiMessage'
                            }
                        ])
                        setUserInput('')
                        return
                    }

                    // Mark that we're creating the initial session to prevent duplicates
                    initialSessionCreatedRef.current = true
                    lastProcessedChatflowRef.current = chatflowid
                    createChatSessionApi.request(chatflowid, 'New Chat').then((response) => {
                        const sessionData = response?.data || response
                        const newChatId = sessionData?.chatId
                        if (newChatId) {
                            setChatId(newChatId)
                            setCurrentChatId(newChatId)
                            const currentUrlChatId = searchParams.get('chatId')
                            if (currentUrlChatId !== newChatId) {
                                setSearchParams((prev) => {
                                    const newParams = new URLSearchParams(prev)
                                    newParams.set('chatId', newChatId)
                                    return newParams
                                }, { replace: true })
                            }
                            setMessages([
                                {
                                    message: 'Hi there! How can I help?',
                                    type: 'apiMessage'
                                }
                            ])
                            setUserInput('')
                            // Refresh sessions to show the new chat in sidebar
                            debouncedRefreshSessions(true) // Immediate refresh
                            // Mark that we've successfully created a session for this chatflow
                            // This prevents creating another one on re-renders
                            initialSessionCreatedRef.current = true
                        } else {
                            // Fallback if chatId not returned - reset flag to allow retry
                            initialSessionCreatedRef.current = false
                            setChatId(null)
                            setCurrentChatId(null)
                            setMessages([
                                {
                                    message: 'Hi there! How can I help?',
                                    type: 'apiMessage'
                                }
                            ])
                            setUserInput('')
                        }
                    }).catch((error) => {
                        console.error('Failed to create initial chat session:', error)
                        // On error, reset flag to allow retry on next open
                        initialSessionCreatedRef.current = false
                        setChatId(null)
                        setCurrentChatId(null)
                        setMessages([
                            {
                                message: 'Hi there! How can I help?',
                                type: 'apiMessage'
                            }
                        ])
                        setUserInput('')
                    })
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, chatflowid, listChatSessionsApi.data, listChatSessionsApi.loading])

    // Track the last chatflow we processed to prevent duplicate session creation
    const lastProcessedChatflowRef = useRef(null)

    // Reset initial session creation flag when popup closes or chatflow changes
    useEffect(() => {
        if (!open) {
            // Reset flag when popup closes
            initialSessionCreatedRef.current = false
            lastProcessedChatflowRef.current = null
            lastLoadedChatIdRef.current = null
        } else if (chatflowid && chatflowid !== lastProcessedChatflowRef.current) {
            // Chatflow changed - reset flag for new chatflow
            initialSessionCreatedRef.current = false
            lastProcessedChatflowRef.current = chatflowid
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatflowid, open])

    // Sync chatId with URL params
    useEffect(() => {
        const urlChatId = searchParams.get('chatId')
        if (urlChatId && urlChatId !== chatId) {
            // Prevent clearing messages if we are in the middle of a generation (loading is true)
            if (loading) {
                setChatId(urlChatId)
                setCurrentChatId(urlChatId)
                return
            }

            setChatId(urlChatId)
            setCurrentChatId(urlChatId)
            // Load messages for the chat from URL - FIXED: pass chatId as params object
            if (chatflowid && urlChatId) {
                setMessages([])
                getChatmessageApi.request(chatflowid, { chatId: urlChatId })
            }
        } else if (!urlChatId && chatId) {
            // Update URL with current chatId
            setSearchParams((prev) => {
                const newParams = new URLSearchParams(prev)
                newParams.set('chatId', chatId)
                return newParams
            }, { replace: true })
            setCurrentChatId(chatId)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, loading])

    // Handle new chat creation
    const handleNewChat = useCallback(async () => {
        try {
            const response = await createChatSessionApi.request(chatflowid, 'New Chat')
            // Response is the axios response object, data is in response.data
            const sessionData = response?.data || response
            const newChatId = sessionData?.chatId
            if (!newChatId) {
                throw new Error('No chatId returned from server')
            }
            setChatId(newChatId)
            setCurrentChatId(newChatId)
            // Reset messages to initial state
            setMessages([
                {
                    message: 'Hi there! How can I help?',
                    type: 'apiMessage'
                }
            ])
            setUserInput('')
            setSearchParams((prev) => {
                const newParams = new URLSearchParams(prev)
                newParams.set('chatId', newChatId)
                return newParams
            }, { replace: true })
            // Refresh sessions after creating new chat (immediate to show in sidebar)
            if (chatflowid) {
                debouncedRefreshSessions(true) // Immediate refresh for new chat
            }
        } catch (error) {
            console.error('Failed to create new chat:', error)
            // No fallback - show error to user
            enqueueSnackbar({
                message: 'Failed to create new chat session. Please try again.',
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    autoHideDuration: 3000
                }
            })
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatflowid, createChatSessionApi, listChatSessionsApi, setSearchParams])

    // Handle chat selection
    const handleSelectChat = useCallback(
        (selectedChatId) => {
            if (!selectedChatId) return

            // Clear current state first
            setChatId(selectedChatId)
            setCurrentChatId(selectedChatId)
            setMessages([])
            setUserInput('')

            // Update URL immediately
            // Update URL immediately
            setSearchParams((prev) => {
                const newParams = new URLSearchParams(prev)
                newParams.set('chatId', selectedChatId)
                return newParams
            }, { replace: true })

            // Load messages for selected chat - FIXED: pass chatId as params object
            if (chatflowid && selectedChatId) {
                getChatmessageApi.request(chatflowid, { chatId: selectedChatId })
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [chatflowid, getChatmessageApi, setSearchParams]
    )


    // Debug: Log sessions data whenever it changes (only log once per actual change to reduce spam)
    const lastSessionsCountRef = useRef(0)
    useEffect(() => {
        if (listChatSessionsApi.data) {
            const sessions = Array.isArray(listChatSessionsApi.data?.sessions)
                ? listChatSessionsApi.data.sessions
                : (Array.isArray(listChatSessionsApi.data) ? listChatSessionsApi.data : [])

            // Only log if count actually changed to reduce console spam
            if (sessions.length !== lastSessionsCountRef.current) {
                console.log('Sessions data updated:', {
                    sessionsCount: sessions.length,
                    sessions: sessions.map(s => ({ chatId: s.chatId, title: s.title }))
                })
                lastSessionsCountRef.current = sessions.length
            }
        }
    }, [listChatSessionsApi.data])

    // Note: Removed automatic refresh on createChatSessionApi.data change
    // handleNewChat already handles refresh, and this was causing duplicate refreshes



    // Get chatmessages successful
    useEffect(() => {
        if (getChatmessageApi.data?.length) {
            const loadedChatId = getChatmessageApi.data[0]?.chatId

            // Only process if this is for the current chat
            if (loadedChatId && (loadedChatId === currentChatId || loadedChatId === chatId)) {
                setChatId(loadedChatId)
                setCurrentChatId(loadedChatId)
                // Reload chat sessions when loading messages (use debounced refresh)
                if (chatflowid) {
                    debouncedRefreshSessions() // Use debounced refresh instead of direct call
                }
                const loadedMessages = getChatmessageApi.data.map((message) => {
                    const obj = {
                        id: message.id,
                        message: message.content,
                        feedback: message.feedback,
                        type: message.role
                    }
                    if (message.sourceDocuments) obj.sourceDocuments = message.sourceDocuments
                    if (message.usedTools) obj.usedTools = message.usedTools
                    if (message.calledTools) obj.calledTools = message.calledTools
                    if (message.fileAnnotations) obj.fileAnnotations = message.fileAnnotations
                    if (message.agentReasoning) obj.agentReasoning = message.agentReasoning
                    if (message.action) obj.action = message.action
                    if (message.artifacts) {
                        obj.artifacts = message.artifacts
                        obj.artifacts.forEach((artifact) => {
                            if (artifact.type === 'png' || artifact.type === 'jpeg') {
                                artifact.data = `${baseURL}/api/v1/get-upload-file?chatflowId=${chatflowid}&chatId=${loadedChatId}&fileName=${artifact.data.replace(
                                    'FILE-STORAGE::',
                                    ''
                                )}`
                            }
                        })
                    }
                    if (message.fileUploads) {
                        obj.fileUploads = message.fileUploads
                        obj.fileUploads.forEach((file) => {
                            if (file.type === 'stored-file') {
                                file.data = `${baseURL}/api/v1/get-upload-file?chatflowId=${chatflowid}&chatId=${loadedChatId}&fileName=${file.name}`
                            }
                        })
                    }
                    if (message.followUpPrompts) obj.followUpPrompts = JSON.parse(message.followUpPrompts)
                    if (message.role === 'apiMessage' && message.execution && message.execution.executionData)
                        obj.agentFlowExecutedData = JSON.parse(message.execution.executionData)
                    return obj
                })
                // Replace messages completely, don't append - ensure each chat shows only its own messages
                setMessages(loadedMessages)
                setLocalStorageChatflow(chatflowid, loadedChatId)
            }
        } else if (getChatmessageApi.data && getChatmessageApi.data.length === 0) {
            // If API returns empty array, it means no messages for this chat
            // Only clear if this is for the current chat
            const loadedChatId = chatId || currentChatId
            if (loadedChatId && (loadedChatId === currentChatId || loadedChatId === chatId)) {
                // Set to initial state for empty chat
                setMessages([
                    {
                        message: 'Hi there! How can I help?',
                        type: 'apiMessage'
                    }
                ])
            }
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getChatmessageApi.data, currentChatId, chatId])

    useEffect(() => {
        if (getAllExecutionsApi.data?.length) {
            const loadedChatId = getAllExecutionsApi.data[0]?.sessionId

            // Only process if this is for the current chat
            if (loadedChatId && (loadedChatId === currentChatId || loadedChatId === chatId)) {
                setChatId(loadedChatId)
                setCurrentChatId(loadedChatId)
                const loadedMessages = getAllExecutionsApi.data.map((execution) => {
                    const executionData =
                        typeof execution.executionData === 'string' ? JSON.parse(execution.executionData) : execution.executionData
                    const obj = {
                        id: execution.id,
                        agentFlow: executionData
                    }
                    return obj
                })
                // Replace messages completely, don't append
                setMessages(loadedMessages)
                setLocalStorageChatflow(chatflowid, loadedChatId)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getAllExecutionsApi.data, currentChatId, chatId])

    // Get chatflow streaming capability
    useEffect(() => {
        if (getIsChatflowStreamingApi.data) {
            setIsChatFlowAvailableToStream(getIsChatflowStreamingApi.data?.isStreaming ?? false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getIsChatflowStreamingApi.data])

    // Get chatflow uploads capability
    useEffect(() => {
        if (getAllowChatFlowUploads.data) {
            setIsChatFlowAvailableForImageUploads(getAllowChatFlowUploads.data?.isImageUploadAllowed ?? false)
            setIsChatFlowAvailableForRAGFileUploads(getAllowChatFlowUploads.data?.isRAGFileUploadAllowed ?? false)
            setIsChatFlowAvailableForSpeech(getAllowChatFlowUploads.data?.isSpeechToTextEnabled ?? false)
            setImageUploadAllowedTypes(getAllowChatFlowUploads.data?.imgUploadSizeAndTypes.map((allowed) => allowed.fileTypes).join(','))
            setFileUploadAllowedTypes(getAllowChatFlowUploads.data?.fileUploadSizeAndTypes.map((allowed) => allowed.fileTypes).join(','))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getAllowChatFlowUploads.data])

    useEffect(() => {
        if (getChatflowConfig.data) {
            setIsConfigLoading(false)
            if (getChatflowConfig.data?.flowData) {
                let nodes = JSON.parse(getChatflowConfig.data?.flowData).nodes ?? []
                const startNode = nodes.find((node) => node.data.name === 'startAgentflow')
                if (startNode) {
                    const startInputType = startNode.data.inputs?.startInputType
                    setStartInputType(startInputType)

                    const formInputTypes = startNode.data.inputs?.formInputTypes
                    if (startInputType === 'formInput' && formInputTypes && formInputTypes.length > 0) {
                        for (const formInputType of formInputTypes) {
                            if (formInputType.type === 'options') {
                                formInputType.options = formInputType.addOptions.map((option) => ({
                                    label: option.option,
                                    name: option.option
                                }))
                            }
                        }
                        setFormInputParams(formInputTypes)
                        setFormInputsData({
                            id: 'formInput',
                            inputs: {},
                            inputParams: formInputTypes
                        })
                        setFormTitle(startNode.data.inputs?.formTitle)
                        setFormDescription(startNode.data.inputs?.formDescription)
                    }

                    getAllExecutionsApi.request({ agentflowId: chatflowid })
                }
            }

            if (getChatflowConfig.data?.chatbotConfig && JSON.parse(getChatflowConfig.data?.chatbotConfig)) {
                let config = JSON.parse(getChatflowConfig.data?.chatbotConfig)
                if (config.starterPrompts) {
                    let inputFields = []
                    Object.getOwnPropertyNames(config.starterPrompts).forEach((key) => {
                        if (config.starterPrompts[key]) {
                            inputFields.push(config.starterPrompts[key])
                        }
                    })
                    setStarterPrompts(inputFields.filter((field) => field.prompt !== ''))
                }
                if (config.chatFeedback) {
                    setChatFeedbackStatus(config.chatFeedback.status)
                }

                // Leads feature removed for autonomous server deployment
                // if (config.leads) {
                //     setLeadsConfig(config.leads)
                //     if (config.leads.status && !getLocalStorageChatflow(chatflowid).lead) {
                //         setMessages((prevMessages) => {
                //             const leadCaptureMessage = {
                //                 message: '',
                //                 type: 'leadCaptureMessage'
                //             }
                //             return [...prevMessages, leadCaptureMessage]
                //         })
                //     }
                // }

                if (config.followUpPrompts) {
                    setFollowUpPromptsStatus(config.followUpPrompts.status)
                }

                if (config.fullFileUpload) {
                    setFullFileUpload(config.fullFileUpload.status)
                    if (config.fullFileUpload?.allowedUploadFileTypes) {
                        setFullFileUploadAllowedTypes(config.fullFileUpload?.allowedUploadFileTypes)
                    }
                }
            }
        }

        // Check if TTS is configured
        if (getChatflowConfig.data && getChatflowConfig.data.textToSpeech) {
            try {
                const ttsConfig =
                    typeof getChatflowConfig.data.textToSpeech === 'string'
                        ? JSON.parse(getChatflowConfig.data.textToSpeech)
                        : getChatflowConfig.data.textToSpeech

                let isEnabled = false
                if (ttsConfig) {
                    Object.keys(ttsConfig).forEach((provider) => {
                        if (provider !== 'none' && ttsConfig?.[provider]?.status) {
                            isEnabled = true
                        }
                    })
                }
                setIsTTSEnabled(isEnabled)
            } catch (error) {
                setIsTTSEnabled(false)
            }
        } else {
            setIsTTSEnabled(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getChatflowConfig.data])

    useEffect(() => {
        if (getChatflowConfig.error) {
            setIsConfigLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getChatflowConfig.error])

    useEffect(() => {
        if (fullFileUpload) {
            setIsChatFlowAvailableForFileUploads(true)
        } else if (isChatFlowAvailableForRAGFileUploads) {
            setIsChatFlowAvailableForFileUploads(true)
        } else {
            setIsChatFlowAvailableForFileUploads(false)
        }
    }, [isChatFlowAvailableForRAGFileUploads, fullFileUpload])

    // Auto scroll chat to bottom (but not during TTS actions)
    useEffect(() => {
        if (!isTTSActionRef.current) {
            scrollToBottom()
        }
    }, [messages])

    useEffect(() => {
        if (isDialog && inputRef) {
            setTimeout(() => {
                inputRef.current?.focus()
            }, 100)
        }
    }, [isDialog, inputRef])

    useEffect(() => {
        if (open && chatflowid) {
            // Load chatflow config and capabilities (NOT messages)
            // Messages are loaded by initialization useEffect based on chatId
            getIsChatflowStreamingApi.request(chatflowid)
            getAllowChatFlowUploads.request(chatflowid)
            getChatflowConfig.request(chatflowid)

            // Add a small delay to ensure content is rendered before scrolling
            setTimeout(() => {
                scrollToBottom()
            }, 100)

            setIsRecording(false)
            setIsConfigLoading(true)

            // Leads feature removed for autonomous server deployment
            // const savedLead = getLocalStorageChatflow(chatflowid)?.lead
            // if (savedLead) {
            //     setIsLeadSaved(!!savedLead)
            //     setLeadEmail(savedLead.email)
            // }
        }

        return () => {
            // Cleanup temporary UI state only - DO NOT reset messages!
            // Messages should persist across open/close cycles
            // They will be cleared only when switching to a different chat
            setUserInput('')
            setUploadedFiles([])
            setLoading(false)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, chatflowid])

    useEffect(() => {
        // wait for audio recording to load and then send
        const containsAudio = previews.filter((item) => item.type === 'audio').length > 0
        if (previews.length >= 1 && containsAudio) {
            setIsRecording(false)
            setRecordingNotSupported(false)
            handlePromptClick('')
        }
        // eslint-disable-next-line
    }, [previews])

    useEffect(() => {
        if (followUpPromptsStatus && messages.length > 0) {
            const lastMessage = messages[messages.length - 1]
            if (lastMessage.type === 'apiMessage' && lastMessage.followUpPrompts) {
                if (Array.isArray(lastMessage.followUpPrompts)) {
                    setFollowUpPrompts(lastMessage.followUpPrompts)
                }
                if (typeof lastMessage.followUpPrompts === 'string') {
                    const followUpPrompts = JSON.parse(lastMessage.followUpPrompts)
                    setFollowUpPrompts(followUpPrompts)
                }
            } else if (lastMessage.type === 'userMessage') {
                setFollowUpPrompts([])
            }
        }
    }, [followUpPromptsStatus, messages])

    const copyMessageToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text || '')
        } catch (error) {
            console.error('Error copying to clipboard:', error)
        }
    }

    const onThumbsUpClick = async (messageId) => {
        const body = {
            chatflowid,
            chatId,
            messageId,
            rating: 'THUMBS_UP',
            content: ''
        }
        const result = await chatmessagefeedbackApi.addFeedback(chatflowid, body)
        if (result.data) {
            const data = result.data
            // Use guid instead of id - backend expects guid for updates
            let id = ''
            if (data && data.guid) {
                id = data.guid
            } else if (data && data.id) {
                // Fallback to id if guid not available (shouldn't happen, but for safety)
                id = data.id
            }
            setMessages((prevMessages) => {
                const allMessages = [...cloneDeep(prevMessages)]
                return allMessages.map((message) => {
                    if (message.id === messageId) {
                        message.feedback = {
                            rating: 'THUMBS_UP'
                        }
                    }
                    return message
                })
            })
            setFeedbackId(id)
            setShowFeedbackContentDialog(true)
        }
    }

    const onThumbsDownClick = async (messageId) => {
        const body = {
            chatflowid,
            chatId,
            messageId,
            rating: 'THUMBS_DOWN',
            content: ''
        }
        const result = await chatmessagefeedbackApi.addFeedback(chatflowid, body)
        if (result.data) {
            const data = result.data
            // Use guid instead of id - backend expects guid for updates
            let id = ''
            if (data && data.guid) {
                id = data.guid
            } else if (data && data.id) {
                // Fallback to id if guid not available (shouldn't happen, but for safety)
                id = data.id
            }
            setMessages((prevMessages) => {
                const allMessages = [...cloneDeep(prevMessages)]
                return allMessages.map((message) => {
                    if (message.id === messageId) {
                        message.feedback = {
                            rating: 'THUMBS_DOWN'
                        }
                    }
                    return message
                })
            })
            setFeedbackId(id)
            setShowFeedbackContentDialog(true)
        }
    }

    const submitFeedbackContent = async (text) => {
        const body = {
            content: text
        }
        const result = await chatmessagefeedbackApi.updateFeedback(feedbackId, body)
        if (result.data) {
            setFeedbackId('')
            setShowFeedbackContentDialog(false)
        }
    }

    // Leads feature removed for autonomous server deployment
    // const handleLeadCaptureSubmit = async (event) => {
    //     if (event) event.preventDefault()
    //     setIsLeadSaving(true)
    //
    //     const body = {
    //         chatflowid,
    //         chatId,
    //         name: leadName,
    //         email: leadEmail,
    //         phone: leadPhone
    //     }
    //
    //     const result = await leadsApi.addLead(body)
    //     if (result.data) {
    //         const data = result.data
    //         setChatId(data.chatId)
    //         setLocalStorageChatflow(chatflowid, data.chatId, { lead: { name: leadName, email: leadEmail, phone: leadPhone } })
    //         setIsLeadSaved(true)
    //         setLeadEmail(leadEmail)
    //         setMessages((prevMessages) => {
    //             let allMessages = [...cloneDeep(prevMessages)]
    //             if (allMessages[allMessages.length - 1].type !== 'leadCaptureMessage') return allMessages
    //             allMessages[allMessages.length - 1].message =
    //                 leadsConfig.successMessage || 'Thank you for submitting your contact information.'
    //             return allMessages
    //         })
    //     }
    //
    //     setIsLeadSaving(false)
    // }

    const cleanupTTSForMessage = (messageId) => {
        if (ttsAudio[messageId]) {
            ttsAudio[messageId].pause()
            ttsAudio[messageId].currentTime = 0
            setTtsAudio((prev) => {
                const newState = { ...prev }
                delete newState[messageId]
                return newState
            })
        }

        if (ttsStreamingState.audio) {
            ttsStreamingState.audio.pause()
            cleanupTTSStreaming()
        }

        setIsTTSPlaying((prev) => {
            const newState = { ...prev }
            delete newState[messageId]
            return newState
        })

        setIsTTSLoading((prev) => {
            const newState = { ...prev }
            delete newState[messageId]
            return newState
        })
    }

    const handleTTSStop = async (messageId) => {
        setTTSAction(true)
        await ttsApi.abortTTS({ chatflowId: chatflowid, chatId, chatMessageId: messageId })
        cleanupTTSForMessage(messageId)
        setIsMessageStopping(false)
    }

    const stopAllTTS = () => {
        Object.keys(ttsAudio).forEach((messageId) => {
            if (ttsAudio[messageId]) {
                ttsAudio[messageId].pause()
                ttsAudio[messageId].currentTime = 0
            }
        })
        setTtsAudio({})

        if (ttsStreamingState.abortController) {
            ttsStreamingState.abortController.abort()
        }

        if (ttsStreamingState.audio) {
            ttsStreamingState.audio.pause()
            cleanupTTSStreaming()
        }

        setIsTTSPlaying({})
        setIsTTSLoading({})
    }

    const handleTTSClick = async (messageId, messageText) => {
        if (isTTSLoading[messageId]) return

        if (isTTSPlaying[messageId] || ttsAudio[messageId]) {
            handleTTSStop(messageId)
            return
        }

        setTTSAction(true)

        // abort all ongoing streams and clear audio sources
        await handleTTSAbortAll()
        stopAllTTS()

        handleTTSStart({ chatMessageId: messageId, format: 'mp3' })
        try {
            const abortController = new AbortController()
            setTtsStreamingState((prev) => ({ ...prev, abortController }))

            const response = await fetch(`${baseURL}/api/v1/text-to-speech/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-request-from': 'internal'
                },
                credentials: 'include',
                signal: abortController.signal,
                body: JSON.stringify({
                    chatflowId: chatflowid,
                    chatId: chatId,
                    chatMessageId: messageId,
                    text: messageText
                })
            })

            if (!response.ok) {
                throw new Error(`TTS request failed: ${response.status}`)
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            let done = false
            while (!done) {
                if (abortController.signal.aborted) {
                    break
                }

                const result = await reader.read()
                done = result.done
                if (done) {
                    break
                }
                const value = result.value
                const chunk = decoder.decode(value, { stream: true })
                buffer += chunk

                const lines = buffer.split('\n\n')
                buffer = lines.pop() || ''

                for (const eventBlock of lines) {
                    if (eventBlock.trim()) {
                        const event = parseSSEEvent(eventBlock)
                        if (event) {
                            switch (event.event) {
                                case 'tts_start':
                                    break
                                case 'tts_data':
                                    if (!abortController.signal.aborted) {
                                        handleTTSDataChunk(event.data.audioChunk)
                                    }
                                    break
                                case 'tts_end':
                                    if (!abortController.signal.aborted) {
                                        handleTTSEnd()
                                    }
                                    break
                            }
                        }
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('TTS request was aborted')
            } else {
                console.error('Error with TTS:', error)
                enqueueSnackbar({
                    message: `TTS failed: ${error.message}`,
                    options: { variant: 'error' }
                })
            }
        } finally {
            setIsTTSLoading((prev) => {
                const newState = { ...prev }
                delete newState[messageId]
                return newState
            })
        }
    }

    const parseSSEEvent = (eventBlock) => {
        const lines = eventBlock.split('\n')
        const event = {}

        for (const line of lines) {
            if (line.startsWith('event:')) {
                event.event = line.substring(6).trim()
            } else if (line.startsWith('data:')) {
                const dataStr = line.substring(5).trim()
                try {
                    const parsed = JSON.parse(dataStr)
                    if (parsed.data) {
                        event.data = parsed.data
                    }
                } catch (e) {
                    console.error('Error parsing SSE data:', e, 'Raw data:', dataStr)
                }
            }
        }

        return event.event ? event : null
    }

    const initializeTTSStreaming = (data) => {
        try {
            const mediaSource = new MediaSource()
            const audio = new Audio()
            audio.src = URL.createObjectURL(mediaSource)

            mediaSource.addEventListener('sourceopen', () => {
                try {
                    const mimeType = data.format === 'mp3' ? 'audio/mpeg' : 'audio/mpeg'
                    const sourceBuffer = mediaSource.addSourceBuffer(mimeType)

                    setTtsStreamingState((prevState) => ({
                        ...prevState,
                        mediaSource,
                        sourceBuffer,
                        audio
                    }))

                    audio.play().catch((playError) => {
                        console.error('Error starting audio playback:', playError)
                    })
                } catch (error) {
                    console.error('Error setting up source buffer:', error)
                    console.error('MediaSource readyState:', mediaSource.readyState)
                    console.error('Requested MIME type:', mimeType)
                }
            })

            audio.addEventListener('playing', () => {
                setIsTTSLoading((prevState) => {
                    const newState = { ...prevState }
                    delete newState[data.chatMessageId]
                    return newState
                })
                setIsTTSPlaying((prevState) => ({
                    ...prevState,
                    [data.chatMessageId]: true
                }))
            })

            audio.addEventListener('ended', () => {
                setIsTTSPlaying((prevState) => {
                    const newState = { ...prevState }
                    delete newState[data.chatMessageId]
                    return newState
                })
                cleanupTTSStreaming()
            })
        } catch (error) {
            console.error('Error initializing TTS streaming:', error)
        }
    }

    const cleanupTTSStreaming = () => {
        setTtsStreamingState((prevState) => {
            if (prevState.abortController) {
                prevState.abortController.abort()
            }

            if (prevState.audio) {
                prevState.audio.pause()
                prevState.audio.removeAttribute('src')
                if (prevState.audio.src) {
                    URL.revokeObjectURL(prevState.audio.src)
                }
            }

            if (prevState.mediaSource) {
                if (prevState.mediaSource.readyState === 'open') {
                    try {
                        prevState.mediaSource.endOfStream()
                    } catch (e) {
                        // Ignore errors during cleanup
                    }
                }
                prevState.mediaSource.removeEventListener('sourceopen', () => { })
            }

            return {
                mediaSource: null,
                sourceBuffer: null,
                audio: null,
                chunkQueue: [],
                isBuffering: false,
                audioFormat: null,
                abortController: null
            }
        })
    }

    const processChunkQueue = () => {
        setTtsStreamingState((prevState) => {
            if (!prevState.sourceBuffer || prevState.sourceBuffer.updating || prevState.chunkQueue.length === 0) {
                return prevState
            }

            const chunk = prevState.chunkQueue.shift()

            try {
                prevState.sourceBuffer.appendBuffer(chunk)
                return {
                    ...prevState,
                    chunkQueue: [...prevState.chunkQueue],
                    isBuffering: true
                }
            } catch (error) {
                console.error('Error appending chunk to buffer:', error)
                return prevState
            }
        })
    }

    const handleTTSStart = (data) => {
        setTTSAction(true)

        // Stop all existing TTS audio before starting new stream
        stopAllTTS()

        setIsTTSLoading((prevState) => ({
            ...prevState,
            [data.chatMessageId]: true
        }))
        setMessages((prevMessages) => {
            const allMessages = [...cloneDeep(prevMessages)]
            const lastMessage = allMessages[allMessages.length - 1]
            if (lastMessage.type === 'userMessage') return allMessages
            if (lastMessage.id) return allMessages
            allMessages[allMessages.length - 1].id = data.chatMessageId
            return allMessages
        })
        setTtsStreamingState({
            mediaSource: null,
            sourceBuffer: null,
            audio: null,
            chunkQueue: [],
            isBuffering: false,
            audioFormat: data.format,
            abortController: null
        })

        setTimeout(() => initializeTTSStreaming(data), 0)
    }

    const handleTTSDataChunk = (base64Data) => {
        try {
            const audioBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))

            setTtsStreamingState((prevState) => {
                const newState = {
                    ...prevState,
                    chunkQueue: [...prevState.chunkQueue, audioBuffer]
                }

                if (prevState.sourceBuffer && !prevState.sourceBuffer.updating) {
                    setTimeout(() => processChunkQueue(), 0)
                }

                return newState
            })
        } catch (error) {
            console.error('Error handling TTS data chunk:', error)
        }
    }

    const handleTTSEnd = () => {
        setTtsStreamingState((prevState) => {
            if (prevState.mediaSource && prevState.mediaSource.readyState === 'open') {
                try {
                    if (prevState.sourceBuffer && prevState.chunkQueue.length > 0 && !prevState.sourceBuffer.updating) {
                        const remainingChunks = [...prevState.chunkQueue]
                        remainingChunks.forEach((chunk, index) => {
                            setTimeout(() => {
                                if (prevState.sourceBuffer && !prevState.sourceBuffer.updating) {
                                    try {
                                        prevState.sourceBuffer.appendBuffer(chunk)
                                        if (index === remainingChunks.length - 1) {
                                            setTimeout(() => {
                                                if (prevState.mediaSource && prevState.mediaSource.readyState === 'open') {
                                                    prevState.mediaSource.endOfStream()
                                                }
                                            }, 100)
                                        }
                                    } catch (error) {
                                        console.error('Error appending remaining chunk:', error)
                                    }
                                }
                            }, index * 50)
                        })
                        return {
                            ...prevState,
                            chunkQueue: []
                        }
                    }

                    if (prevState.sourceBuffer && !prevState.sourceBuffer.updating) {
                        prevState.mediaSource.endOfStream()
                    } else if (prevState.sourceBuffer) {
                        prevState.sourceBuffer.addEventListener(
                            'updateend',
                            () => {
                                if (prevState.mediaSource && prevState.mediaSource.readyState === 'open') {
                                    prevState.mediaSource.endOfStream()
                                }
                            },
                            { once: true }
                        )
                    }
                } catch (error) {
                    console.error('Error ending TTS stream:', error)
                }
            }
            return prevState
        })
    }

    const handleTTSAbort = (data) => {
        const messageId = data.chatMessageId
        cleanupTTSForMessage(messageId)
    }

    const handleTTSAbortAll = async () => {
        const activeTTSMessages = Object.keys(isTTSLoading).concat(Object.keys(isTTSPlaying))
        for (const messageId of activeTTSMessages) {
            await ttsApi.abortTTS({ chatflowId: chatflowid, chatId, chatMessageId: messageId })
        }
    }

    useEffect(() => {
        if (ttsStreamingState.sourceBuffer) {
            const sourceBuffer = ttsStreamingState.sourceBuffer

            const handleUpdateEnd = () => {
                setTtsStreamingState((prevState) => ({
                    ...prevState,
                    isBuffering: false
                }))
                setTimeout(() => processChunkQueue(), 0)
            }

            sourceBuffer.addEventListener('updateend', handleUpdateEnd)

            return () => {
                sourceBuffer.removeEventListener('updateend', handleUpdateEnd)
            }
        }
    }, [ttsStreamingState.sourceBuffer])

    useEffect(() => {
        return () => {
            cleanupTTSStreaming()
            // Cleanup TTS timeout on unmount
            if (ttsTimeoutRef.current) {
                clearTimeout(ttsTimeoutRef.current)
                ttsTimeoutRef.current = null
            }
        }
    }, [])

    const getInputDisabled = () => {
        return (
            loading ||
            !chatflowid ||
            // Leads feature removed for autonomous server deployment
            // (leadsConfig?.status && !isLeadSaved) ||
            (messages.length > 0 && messages[messages.length - 1].action && Object.keys(messages[messages.length - 1].action).length > 0)
        )
    }

    const previewDisplay = (item) => {
        if (item.mime.startsWith('image/')) {
            return (
                <ImageButton
                    focusRipple
                    style={{
                        width: '48px',
                        height: '48px',
                        marginRight: '10px',
                        flex: '0 0 auto'
                    }}
                    disabled={getInputDisabled()}
                    onClick={() => handleDeletePreview(item)}
                >
                    <ImageSrc style={{ backgroundImage: `url(${item.data})` }} />
                    <ImageBackdrop className='MuiImageBackdrop-root' />
                    <ImageMarked className='MuiImageMarked-root'>
                        <IconTrash size={20} color='white' />
                    </ImageMarked>
                </ImageButton>
            )
        } else if (item.mime.startsWith('audio/')) {
            return (
                <Card
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        height: '48px',
                        width: isDialog ? ps?.current?.offsetWidth / 4 : ps?.current?.offsetWidth / 2,
                        p: 0.5,
                        mr: 1,
                        backgroundColor: theme.palette.grey[500],
                        flex: '0 0 auto'
                    }}
                    variant='outlined'
                >
                    <CardMedia component='audio' sx={{ color: 'transparent' }} controls src={item.data} />
                    <IconButton disabled={getInputDisabled()} onClick={() => handleDeletePreview(item)} size='small'>
                        <IconTrash size={20} color='white' />
                    </IconButton>
                </Card>
            )
        } else {
            return (
                <CardWithDeleteOverlay
                    disabled={getInputDisabled()}
                    item={item}
                    customization={customization}
                    onDelete={() => handleDeletePreview(item)}
                />
            )
        }
    }

    const renderFileUploads = (item, index) => {
        if (item?.mime?.startsWith('image/')) {
            return (
                <Card
                    key={index}
                    sx={{
                        p: 0,
                        m: 0,
                        maxWidth: 128,
                        marginRight: '10px',
                        flex: '0 0 auto'
                    }}
                >
                    <CardMedia component='img' image={item.data} sx={{ height: 64 }} alt={'preview'} style={messageImageStyle} />
                </Card>
            )
        } else if (item?.mime?.startsWith('audio/')) {
            return (
                /* eslint-disable jsx-a11y/media-has-caption */
                <audio controls='controls'>
                    Your browser does not support the &lt;audio&gt; tag.
                    <source src={item.data} type={item.mime} />
                </audio>
            )
        } else {
            return (
                <Card
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        height: '48px',
                        width: 'max-content',
                        p: 2,
                        mr: 1,
                        flex: '0 0 auto',
                        backgroundColor: customization.isDarkMode ? 'rgba(0, 0, 0, 0.3)' : 'transparent'
                    }}
                    variant='outlined'
                >
                    <IconPaperclip size={20} />
                    <span
                        style={{
                            marginLeft: '5px',
                            color: customization.isDarkMode ? 'white' : 'inherit'
                        }}
                    >
                        {item.name}
                    </span>
                </Card>
            )
        }
    }

    const agentReasoningArtifacts = (artifacts) => {
        const newArtifacts = cloneDeep(artifacts)
        for (let i = 0; i < newArtifacts.length; i++) {
            const artifact = newArtifacts[i]
            if (artifact && (artifact.type === 'png' || artifact.type === 'jpeg')) {
                const data = artifact.data
                newArtifacts[i].data = `${baseURL}/api/v1/get-upload-file?chatflowId=${chatflowid}&chatId=${chatId}&fileName=${data.replace(
                    'FILE-STORAGE::',
                    ''
                )}`
            }
        }
        return newArtifacts
    }

    const renderArtifacts = (item, index, isAgentReasoning) => {
        if (item.type === 'png' || item.type === 'jpeg') {
            return (
                <Card
                    key={index}
                    sx={{
                        p: 0,
                        m: 0,
                        mt: 2,
                        mb: 2,
                        flex: '0 0 auto'
                    }}
                >
                    <CardMedia
                        component='img'
                        image={item.data}
                        sx={{ height: 'auto' }}
                        alt={'artifact'}
                        style={{
                            width: isAgentReasoning ? '200px' : '100%',
                            height: isAgentReasoning ? '200px' : 'auto',
                            objectFit: 'cover'
                        }}
                    />
                </Card>
            )
        } else if (item.type === 'html') {
            return (
                <div style={{ marginTop: '20px' }}>
                    <SafeHTML html={item.data} />
                </div>
            )
        } else {
            return (
                <MemoizedReactMarkdown chatflowid={chatflowid} isFullWidth={isDialog}>
                    {item.data}
                </MemoizedReactMarkdown>
            )
        }
    }

    if (isConfigLoading) {
        return (
            <Box
                sx={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    backgroundColor: theme.palette.background.paper
                }}
            >
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)'
                    }}
                >
                    <CircularProgress />
                </Box>
            </Box>
        )
    }

    if (startInputType === 'formInput' && messages.length === 1) {
        return (
            <Box
                sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2,
                    backgroundColor: theme.palette.background.paper
                }}
            >
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        position: 'relative'
                    }}
                >
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '100%',
                            maxWidth: '600px',
                            maxHeight: '90%', // Limit height to 90% of parent
                            p: 3,
                            backgroundColor: customization.isDarkMode
                                ? darken(theme.palette.background.paper, 0.2)
                                : theme.palette.background.paper,
                            boxShadow: customization.isDarkMode ? '0px 0px 15px 0px rgba(255, 255, 255, 0.1)' : theme.shadows[3],
                            borderRadius: 2,
                            overflowY: 'auto' // Enable vertical scrolling if content overflows
                        }}
                    >
                        <Typography variant='h4' sx={{ mb: 1, textAlign: 'center' }}>
                            {formTitle || 'Please Fill Out The Form'}
                        </Typography>
                        <Typography variant='body1' sx={{ mb: 3, textAlign: 'center', color: theme.palette.text.secondary }}>
                            {formDescription || 'Complete all fields below to continue'}
                        </Typography>

                        {/* Form inputs */}
                        <Box sx={{ mb: 3 }}>
                            {formInputParams &&
                                formInputParams.map((inputParam, index) => (
                                    <Box key={index} sx={{ mb: 2 }}>
                                        <NodeInputHandler
                                            inputParam={inputParam}
                                            data={formInputsData}
                                            isAdditionalParams={true}
                                            onCustomDataChange={({ inputParam, newValue }) => {
                                                setFormInputsData((prev) => ({
                                                    ...prev,
                                                    inputs: {
                                                        ...prev.inputs,
                                                        [inputParam.name]: newValue
                                                    }
                                                }))
                                            }}
                                        />
                                    </Box>
                                ))}
                        </Box>

                        <Button
                            variant='contained'
                            fullWidth
                            disabled={loading}
                            onClick={() => handleSubmit(null, formInputsData.inputs)}
                            sx={{
                                mb: 2,
                                borderRadius: 20,
                                background: 'linear-gradient(45deg, #673ab7 30%, #1e88e5 90%)'
                            }}
                        >
                            {loading ? 'Submitting...' : 'Submit'}
                        </Button>
                    </Box>
                </Box>
            </Box>
        )
    }

    return (
        <Box sx={{
            display: 'flex',
            height: '100%', // Always use 100% of parent, not viewport height
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
            minHeight: 0, // Allow flex children to shrink
            maxHeight: '100%', // Don't exceed parent
            boxSizing: 'border-box' // Include padding/border in height
        }}>
            {/* Chat Sidebar - Show in all modes */}
            <Box sx={{ position: 'relative', zIndex: 1200, height: '100%', maxHeight: '100%', overflow: 'hidden' }}>
                <ChatSidebar
                    open={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    onToggle={() => setSidebarOpen(!sidebarOpen)}
                    chatflowId={chatflowid}
                    currentChatId={currentChatId || chatId}
                    onSelectChat={handleSelectChat}
                    onNewChat={handleNewChat}
                    isDialog={isDialog}
                    sessions={Array.isArray(listChatSessionsApi.data?.sessions) ? listChatSessionsApi.data.sessions : (Array.isArray(listChatSessionsApi.data) ? listChatSessionsApi.data : [])}
                    isLoading={listChatSessionsApi.loading}
                    onRefreshSessions={() => {
                        debouncedRefreshSessions(true) // Immediate refresh when manually triggered
                    }}
                />
            </Box>
            <Box
                className="chat-message-container"
                sx={{
                    marginLeft: sidebarOpen ? (isDialog ? '200px' : '240px') : 0,
                    width: sidebarOpen ? (isDialog ? 'calc(100% - 200px)' : 'calc(100% - 240px)') : '100%'
                }}
            >
                <div onDragEnter={handleDrag} className="chat-container">
                    {isDragActive && (
                        <div
                            className='image-dropzone'
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragEnd={handleDrag}
                            onDrop={handleDrop}
                        />
                    )}
                    {isDragActive &&
                        (getAllowChatFlowUploads.data?.isImageUploadAllowed || getAllowChatFlowUploads.data?.isRAGFileUploadAllowed) && (
                            <Box className='drop-overlay'>
                                <Typography variant='h2'>Drop here to upload</Typography>
                                {[
                                    ...getAllowChatFlowUploads.data.imgUploadSizeAndTypes,
                                    ...getAllowChatFlowUploads.data.fileUploadSizeAndTypes
                                ].map((allowed) => {
                                    return (
                                        <>
                                            <Typography variant='subtitle1'>{allowed.fileTypes?.join(', ')}</Typography>
                                            {allowed.maxUploadSize && (
                                                <Typography variant='subtitle1'>Max Allowed Size: {allowed.maxUploadSize} MB</Typography>
                                            )}
                                        </>
                                    )
                                })}
                            </Box>
                        )}
                    <Box
                        ref={ps}
                        className={`${isDialog ? 'cloud-dialog' : 'cloud'}`}
                        sx={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            height: '100%',
                            minHeight: 0,
                            maxHeight: '100%',
                            position: 'relative' // Ensure proper positioning context
                        }}
                    >
                        {/* Chat Header */}
                        {!isDialog && (
                            <Box
                                sx={{
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '12px 16px',
                                    borderBottom: `1px solid ${theme.palette.divider}`,
                                    backgroundColor: theme.palette.background.paper,
                                    minHeight: '56px'
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                                    <IconButton
                                        size="small"
                                        onClick={() => setSidebarOpen(!sidebarOpen)}
                                        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                                        sx={{ mr: 0.5 }}
                                    >
                                        {sidebarOpen ? <IconX size={18} /> : <IconMenu2 size={18} />}
                                    </IconButton>
                                    {sidebarOpen ? (
                                        <>
                                            <Box
                                                component="img"
                                                src={userPNG}
                                                alt="User"
                                                sx={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: '50%',
                                                    flexShrink: 0
                                                }}
                                            />
                                            <Typography
                                                variant="body1"
                                                sx={{
                                                    fontWeight: 500,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    flex: 1
                                                }}
                                            >
                                                {listChatSessionsApi.data?.sessions?.find(s => s.chatId === (currentChatId || chatId))?.title || 'New Chat'}
                                            </Typography>
                                        </>
                                    ) : (
                                        <>
                                            <Box
                                                component="img"
                                                src={kodivianPNG}
                                                alt="Kodivian"
                                                sx={{
                                                    width: '50px',
                                                    height: '30px',
                                                    flexShrink: 0,
                                                    objectFit: 'contain'
                                                }}
                                            />
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontWeight: 600,
                                                    flex: 1,
                                                    fontSize: '0.875rem'
                                                }}
                                            >
                                                Kodivian
                                            </Typography>
                                        </>
                                    )}
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                    {onExpand && (
                                        <IconButton
                                            size="small"
                                            title="Expand"
                                            onClick={onExpand}
                                            sx={{
                                                color: theme.palette.text.secondary,
                                                '&:hover': {
                                                    backgroundColor: theme.palette.action.hover,
                                                    color: theme.palette.primary.main
                                                }
                                            }}
                                        >
                                            <IconArrowsMaximize size={20} />
                                        </IconButton>
                                    )}
                                    {onClose && (
                                        <IconButton
                                            size="small"
                                            title="Close"
                                            onClick={onClose}
                                            sx={{
                                                color: theme.palette.text.secondary,
                                                '&:hover': {
                                                    backgroundColor: theme.palette.error.light,
                                                    color: theme.palette.error.main
                                                }
                                            }}
                                        >
                                            <IconX size={20} />
                                        </IconButton>
                                    )}
                                </Box>
                            </Box>
                        )}
                        <Box
                            ref={messageListRef}
                            id='messagelist'
                            className={'messagelist'}
                            sx={{
                                flex: 1,
                                overflowY: 'auto',
                                overflowX: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                padding: 2,
                                minHeight: 0,
                                maxHeight: '100%',
                                width: '100%',
                                height: 0, // Force flex child to respect parent height
                                visibility: 'visible', // Ensure messages are visible
                                opacity: 1 // Ensure messages are visible
                            }}
                        >
                            {messages &&
                                messages.map((message, index) => {
                                    return (
                                        // The latest message sent by the user will be animated while waiting for a response
                                        <Box
                                            sx={{
                                                background:
                                                    message.type === 'apiMessage' /* || message.type === 'leadCaptureMessage' */ // Leads removed
                                                        ? theme.palette.asyncSelect.main
                                                        : '',
                                                display: 'flex',
                                                flexDirection: 'row',
                                                justifyContent: message.type === 'userMessage' ? 'flex-end' : 'flex-start',
                                                alignItems: 'flex-start'
                                            }}
                                            key={index}
                                            className={
                                                message.type === 'userMessage' && loading && index === messages.length - 1
                                                    ? customization.isDarkMode
                                                        ? 'usermessagewaiting-dark'
                                                        : 'usermessagewaiting-light'
                                                    : message.type === 'usermessagewaiting'
                                                        ? 'apimessage'
                                                        : message.type === 'userMessage'
                                                            ? 'usermessage usermessage-right'
                                                            : 'apimessage'
                                            }
                                        >
                                            {/* For user messages: content first, then icon on right */}
                                            {/* For API messages: icon first, then content on left */}
                                            {message.type === 'userMessage' ? (
                                                <>
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            maxWidth: 'calc(100% - 40px)',
                                                            alignItems: 'flex-end',
                                                            textAlign: 'right'
                                                        }}
                                                    >
                                                        {message.fileUploads && message.fileUploads.length > 0 && (
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    flexWrap: 'wrap',
                                                                    flexDirection: 'column',
                                                                    width: '100%',
                                                                    gap: '8px'
                                                                }}
                                                            >
                                                                {message.fileUploads.map((item, index) => {
                                                                    return <>{renderFileUploads(item, index)}</>
                                                                })}
                                                            </div>
                                                        )}
                                                        {message.agentReasoning && message.agentReasoning.length > 0 && (
                                                            <div style={{ display: 'block', flexDirection: 'row', width: '100%' }}>
                                                                {message.agentReasoning.map((agent, index) => (
                                                                    <AgentReasoningCard
                                                                        key={index}
                                                                        agent={agent}
                                                                        index={index}
                                                                        customization={customization}
                                                                        chatflowid={chatflowid}
                                                                        isDialog={isDialog}
                                                                        onSourceDialogClick={onSourceDialogClick}
                                                                        renderArtifacts={renderArtifacts}
                                                                        agentReasoningArtifacts={agentReasoningArtifacts}
                                                                        getAgentIcon={getAgentIcon}
                                                                        removeDuplicateURL={removeDuplicateURL}
                                                                        isValidURL={isValidURL}
                                                                        onURLClick={onURLClick}
                                                                        getLabel={getLabel}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                        {message.agentFlowExecutedData &&
                                                            Array.isArray(message.agentFlowExecutedData) &&
                                                            message.agentFlowExecutedData.length > 0 && (
                                                                <AgentExecutedDataCard
                                                                    status={message.agentFlowEventStatus}
                                                                    execution={message.agentFlowExecutedData}
                                                                    agentflowId={chatflowid}
                                                                    sessionId={chatId}
                                                                />
                                                            )}
                                                        {message.calledTools && (
                                                            <div
                                                                style={{
                                                                    display: 'block',
                                                                    flexDirection: 'row',
                                                                    width: '100%'
                                                                }}
                                                            >
                                                                {message.calledTools.map((tool, index) => {
                                                                    return tool ? (
                                                                        <Chip
                                                                            size='small'
                                                                            key={`called-${index}`}
                                                                            label={tool.tool}
                                                                            component='a'
                                                                            sx={{
                                                                                mr: 1,
                                                                                mt: 1,
                                                                                borderColor: 'primary.main',
                                                                                color: 'primary.main',
                                                                                backgroundColor: 'rgba(25, 118, 210, 0.1)',
                                                                                opacity: 0.9,
                                                                                '&:hover': {
                                                                                    backgroundColor: 'rgba(25, 118, 210, 0.2)',
                                                                                    opacity: 1
                                                                                }
                                                                            }}
                                                                            variant='outlined'
                                                                            clickable
                                                                            icon={<CircularProgress size={15} color='primary' />}
                                                                            onClick={() => onSourceDialogClick(tool, 'Called Tools')}
                                                                        />
                                                                    ) : null
                                                                })}
                                                            </div>
                                                        )}
                                                        {message.usedTools && (
                                                            <div
                                                                style={{
                                                                    display: 'block',
                                                                    flexDirection: 'row',
                                                                    width: '100%'
                                                                }}
                                                            >
                                                                {message.usedTools.map((tool, index) => {
                                                                    return tool ? (
                                                                        <Chip
                                                                            size='small'
                                                                            key={`used-${index}`}
                                                                            label={tool.tool}
                                                                            component='a'
                                                                            sx={{
                                                                                mr: 1,
                                                                                mt: 1,
                                                                                borderColor: tool.error ? 'error.main' : undefined,
                                                                                color: tool.error ? 'error.main' : undefined
                                                                            }}
                                                                            variant='outlined'
                                                                            clickable
                                                                            icon={
                                                                                <IconTool
                                                                                    size={15}
                                                                                    color={tool.error ? theme.palette.error.main : undefined}
                                                                                />
                                                                            }
                                                                            onClick={() => onSourceDialogClick(tool, 'Used Tools')}
                                                                        />
                                                                    ) : null
                                                                })}
                                                            </div>
                                                        )}
                                                        {message.artifacts && (
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    flexWrap: 'wrap',
                                                                    flexDirection: 'column',
                                                                    width: '100%'
                                                                }}
                                                            >
                                                                {message.artifacts.map((item, index) => {
                                                                    return item !== null ? <>{renderArtifacts(item, index)}</> : null
                                                                })}
                                                            </div>
                                                        )}
                                                        <div className={`markdownanswer ${message.type === 'userMessage' ? 'markdownanswer-right' : ''}`}>
                                                            {/* Leads feature removed for autonomous server deployment */}
                                                            <>
                                                                <MemoizedReactMarkdown chatflowid={chatflowid} isFullWidth={isDialog}>
                                                                    {message.message}
                                                                </MemoizedReactMarkdown>
                                                            </>
                                                        </div>
                                                        {message.fileAnnotations && (
                                                            <div
                                                                style={{
                                                                    display: 'block',
                                                                    flexDirection: 'row',
                                                                    width: '100%',
                                                                    marginBottom: '8px'
                                                                }}
                                                            >
                                                                {message.fileAnnotations.map((fileAnnotation, index) => {
                                                                    return (
                                                                        <Button
                                                                            sx={{
                                                                                fontSize: '0.85rem',
                                                                                textTransform: 'none',
                                                                                mb: 1
                                                                            }}
                                                                            key={index}
                                                                            variant='outlined'
                                                                            onClick={() => downloadFile(fileAnnotation)}
                                                                            endIcon={<IconDownload color={theme.palette.primary.main} />}
                                                                        >
                                                                            {fileAnnotation.fileName}
                                                                        </Button>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                        {message.sourceDocuments && (
                                                            <div
                                                                style={{
                                                                    display: 'block',
                                                                    flexDirection: 'row',
                                                                    width: '100%',
                                                                    marginBottom: '8px'
                                                                }}
                                                            >
                                                                {removeDuplicateURL(message).map((source, index) => {
                                                                    const URL =
                                                                        source.metadata && source.metadata.source
                                                                            ? isValidURL(source.metadata.source)
                                                                            : undefined
                                                                    return (
                                                                        <Chip
                                                                            size='small'
                                                                            key={index}
                                                                            label={getLabel(URL, source) || ''}
                                                                            component='a'
                                                                            sx={{ mr: 1, mb: 1 }}
                                                                            variant='outlined'
                                                                            clickable
                                                                            onClick={() =>
                                                                                URL ? onURLClick(source.metadata.source) : onSourceDialogClick(source)
                                                                            }
                                                                        />
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                        {message.action && (
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    flexWrap: 'wrap',
                                                                    flexDirection: 'row',
                                                                    width: '100%',
                                                                    gap: '8px',
                                                                    marginBottom: '8px'
                                                                }}
                                                            >
                                                                {(message.action.elements || []).map((elem, index) => {
                                                                    return (
                                                                        <>
                                                                            {(elem.type === 'approve-button' && elem.label === 'Yes') ||
                                                                                elem.type === 'agentflowv2-approve-button' ? (
                                                                                <Button
                                                                                    sx={{
                                                                                        width: 'max-content',
                                                                                        borderRadius: '20px',
                                                                                        background: customization.isDarkMode ? 'transparent' : 'white'
                                                                                    }}
                                                                                    variant='outlined'
                                                                                    color='success'
                                                                                    key={index}
                                                                                    startIcon={<IconCheck />}
                                                                                    onClick={() => handleActionClick(elem, message.action)}
                                                                                >
                                                                                    {elem.label}
                                                                                </Button>
                                                                            ) : (elem.type === 'reject-button' && elem.label === 'No') ||
                                                                                elem.type === 'agentflowv2-reject-button' ? (
                                                                                <Button
                                                                                    sx={{
                                                                                        width: 'max-content',
                                                                                        borderRadius: '20px',
                                                                                        background: customization.isDarkMode ? 'transparent' : 'white'
                                                                                    }}
                                                                                    variant='outlined'
                                                                                    color='error'
                                                                                    key={index}
                                                                                    startIcon={<IconX />}
                                                                                    onClick={() => handleActionClick(elem, message.action)}
                                                                                >
                                                                                    {elem.label}
                                                                                </Button>
                                                                            ) : (
                                                                                <Button
                                                                                    sx={{ width: 'max-content', borderRadius: '20px', background: 'white' }}
                                                                                    variant='outlined'
                                                                                    key={index}
                                                                                    onClick={() => handleActionClick(elem, message.action)}
                                                                                >
                                                                                    {elem.label}
                                                                                </Button>
                                                                            )}
                                                                        </>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                        {message.type === 'apiMessage' && message.id ? (
                                                            <>
                                                                <Box
                                                                    sx={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'start',
                                                                        gap: 1
                                                                    }}
                                                                >
                                                                    {isTTSEnabled && (
                                                                        <IconButton
                                                                            size='small'
                                                                            onClick={() =>
                                                                                isTTSPlaying[message.id]
                                                                                    ? handleTTSStop(message.id)
                                                                                    : handleTTSClick(message.id, message.message)
                                                                            }
                                                                            disabled={isTTSLoading[message.id]}
                                                                            sx={{
                                                                                backgroundColor: ttsAudio[message.id] ? 'primary.main' : 'transparent',
                                                                                color: ttsAudio[message.id] ? 'white' : 'inherit',
                                                                                '&:hover': {
                                                                                    backgroundColor: ttsAudio[message.id] ? 'primary.dark' : 'action.hover'
                                                                                }
                                                                            }}
                                                                        >
                                                                            {isTTSLoading[message.id] ? (
                                                                                <CircularProgress size={16} />
                                                                            ) : isTTSPlaying[message.id] ? (
                                                                                <IconCircleDot style={{ width: '20px', height: '20px' }} color={'red'} />
                                                                            ) : (
                                                                                <IconVolume
                                                                                    style={{ width: '20px', height: '20px' }}
                                                                                    color={customization.isDarkMode ? 'white' : '#1e88e5'}
                                                                                />
                                                                            )}
                                                                        </IconButton>
                                                                    )}
                                                                    {chatFeedbackStatus && (
                                                                        <>
                                                                            <CopyToClipboardButton
                                                                                onClick={() => copyMessageToClipboard(message.message)}
                                                                            />
                                                                            {!message.feedback ||
                                                                                message.feedback.rating === '' ||
                                                                                message.feedback.rating === 'THUMBS_UP' ? (
                                                                                <ThumbsUpButton
                                                                                    isDisabled={message.feedback && message.feedback.rating === 'THUMBS_UP'}
                                                                                    rating={message.feedback ? message.feedback.rating : ''}
                                                                                    onClick={() => onThumbsUpClick(message.id)}
                                                                                />
                                                                            ) : null}
                                                                            {!message.feedback ||
                                                                                message.feedback.rating === '' ||
                                                                                message.feedback.rating === 'THUMBS_DOWN' ? (
                                                                                <ThumbsDownButton
                                                                                    isDisabled={
                                                                                        message.feedback && message.feedback.rating === 'THUMBS_DOWN'
                                                                                    }
                                                                                    rating={message.feedback ? message.feedback.rating : ''}
                                                                                    onClick={() => onThumbsDownClick(message.id)}
                                                                                />
                                                                            ) : null}
                                                                        </>
                                                                    )}
                                                                </Box>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                    <img src={userPNG} alt='Me' width='30' height='30' className='usericon usericon-right' />
                                                </>
                                            ) : (
                                                <>
                                                    <img src={kodivianPNG} alt='Kodivian' width='30' height='30' className='boticon' />
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            maxWidth: 'calc(100% - 40px)',
                                                            alignItems: 'flex-start',
                                                            textAlign: 'left'
                                                        }}
                                                    >
                                                        {message.fileUploads && message.fileUploads.length > 0 && (
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    flexWrap: 'wrap',
                                                                    flexDirection: 'column',
                                                                    width: '100%',
                                                                    gap: '8px'
                                                                }}
                                                            >
                                                                {message.fileUploads.map((item, index) => {
                                                                    return <>{renderFileUploads(item, index)}</>
                                                                })}
                                                            </div>
                                                        )}
                                                        {message.agentReasoning && message.agentReasoning.length > 0 && (
                                                            <div style={{ display: 'block', flexDirection: 'row', width: '100%' }}>
                                                                {message.agentReasoning.map((agent, index) => (
                                                                    <AgentReasoningCard
                                                                        key={index}
                                                                        agent={agent}
                                                                        index={index}
                                                                        customization={customization}
                                                                        chatflowid={chatflowid}
                                                                        isDialog={isDialog}
                                                                        onSourceDialogClick={onSourceDialogClick}
                                                                        renderArtifacts={renderArtifacts}
                                                                        agentReasoningArtifacts={agentReasoningArtifacts}
                                                                        getAgentIcon={getAgentIcon}
                                                                        removeDuplicateURL={removeDuplicateURL}
                                                                        isValidURL={isValidURL}
                                                                        onURLClick={onURLClick}
                                                                        getLabel={getLabel}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                        {message.agentFlowExecutedData &&
                                                            Array.isArray(message.agentFlowExecutedData) &&
                                                            message.agentFlowExecutedData.length > 0 && (
                                                                <AgentExecutedDataCard
                                                                    status={message.agentFlowEventStatus}
                                                                    execution={message.agentFlowExecutedData}
                                                                    agentflowId={chatflowid}
                                                                    sessionId={chatId}
                                                                />
                                                            )}
                                                        {message.calledTools && (
                                                            <div
                                                                style={{
                                                                    display: 'block',
                                                                    flexDirection: 'row',
                                                                    width: '100%'
                                                                }}
                                                            >
                                                                {message.calledTools.map((tool, index) => {
                                                                    return tool ? (
                                                                        <Chip
                                                                            size='small'
                                                                            key={`called-${index}`}
                                                                            label={tool.tool}
                                                                            component='a'
                                                                            sx={{
                                                                                mr: 1,
                                                                                mt: 1,
                                                                                borderColor: 'primary.main',
                                                                                color: 'primary.main',
                                                                                backgroundColor: 'rgba(25, 118, 210, 0.1)',
                                                                                opacity: 0.9,
                                                                                '&:hover': {
                                                                                    backgroundColor: 'rgba(25, 118, 210, 0.2)',
                                                                                    opacity: 1
                                                                                }
                                                                            }}
                                                                            variant='outlined'
                                                                            clickable
                                                                            icon={<CircularProgress size={15} color='primary' />}
                                                                            onClick={() => onSourceDialogClick(tool, 'Called Tools')}
                                                                        />
                                                                    ) : null
                                                                })}
                                                            </div>
                                                        )}
                                                        {message.usedTools && (
                                                            <div
                                                                style={{
                                                                    display: 'block',
                                                                    flexDirection: 'row',
                                                                    width: '100%'
                                                                }}
                                                            >
                                                                {message.usedTools.map((tool, index) => {
                                                                    return tool ? (
                                                                        <Chip
                                                                            size='small'
                                                                            key={`used-${index}`}
                                                                            label={tool.tool}
                                                                            component='a'
                                                                            sx={{
                                                                                mr: 1,
                                                                                mt: 1,
                                                                                borderColor: tool.error ? 'error.main' : undefined,
                                                                                color: tool.error ? 'error.main' : undefined
                                                                            }}
                                                                            variant='outlined'
                                                                            clickable
                                                                            icon={
                                                                                <IconTool
                                                                                    size={15}
                                                                                    color={tool.error ? theme.palette.error.main : undefined}
                                                                                />
                                                                            }
                                                                            onClick={() => onSourceDialogClick(tool, 'Used Tools')}
                                                                        />
                                                                    ) : null
                                                                })}
                                                            </div>
                                                        )}
                                                        {message.artifacts && (
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    flexWrap: 'wrap',
                                                                    flexDirection: 'column',
                                                                    width: '100%'
                                                                }}
                                                            >
                                                                {message.artifacts.map((item, index) => {
                                                                    return item !== null ? <>{renderArtifacts(item, index)}</> : null
                                                                })}
                                                            </div>
                                                        )}
                                                        <div className={`markdownanswer ${message.type === 'userMessage' ? 'markdownanswer-right' : ''}`}>
                                                            {/* Leads feature removed for autonomous server deployment */}
                                                            <>
                                                                <MemoizedReactMarkdown chatflowid={chatflowid} isFullWidth={isDialog}>
                                                                    {message.message}
                                                                </MemoizedReactMarkdown>
                                                            </>
                                                        </div>
                                                        {message.fileAnnotations && (
                                                            <div
                                                                style={{
                                                                    display: 'block',
                                                                    flexDirection: 'row',
                                                                    width: '100%',
                                                                    marginBottom: '8px'
                                                                }}
                                                            >
                                                                {message.fileAnnotations.map((fileAnnotation, index) => {
                                                                    return (
                                                                        <Button
                                                                            sx={{
                                                                                fontSize: '0.85rem',
                                                                                textTransform: 'none',
                                                                                mb: 1
                                                                            }}
                                                                            key={index}
                                                                            variant='outlined'
                                                                            onClick={() => downloadFile(fileAnnotation)}
                                                                            endIcon={<IconDownload color={theme.palette.primary.main} />}
                                                                        >
                                                                            {fileAnnotation.fileName}
                                                                        </Button>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                        {message.sourceDocuments && (
                                                            <div
                                                                style={{
                                                                    display: 'block',
                                                                    flexDirection: 'row',
                                                                    width: '100%',
                                                                    marginBottom: '8px'
                                                                }}
                                                            >
                                                                {removeDuplicateURL(message).map((source, index) => {
                                                                    const URL =
                                                                        source.metadata && source.metadata.source
                                                                            ? isValidURL(source.metadata.source)
                                                                            : undefined
                                                                    return (
                                                                        <Chip
                                                                            size='small'
                                                                            key={index}
                                                                            label={getLabel(URL, source) || ''}
                                                                            component='a'
                                                                            sx={{ mr: 1, mb: 1 }}
                                                                            variant='outlined'
                                                                            clickable
                                                                            onClick={() =>
                                                                                URL ? onURLClick(source.metadata.source) : onSourceDialogClick(source)
                                                                            }
                                                                        />
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                        {message.action && (
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    flexWrap: 'wrap',
                                                                    flexDirection: 'row',
                                                                    width: '100%',
                                                                    gap: '8px',
                                                                    marginBottom: '8px'
                                                                }}
                                                            >
                                                                {(message.action.elements || []).map((elem, index) => {
                                                                    return (
                                                                        <Button
                                                                            sx={{ width: 'max-content', borderRadius: '20px', background: 'white' }}
                                                                            variant='outlined'
                                                                            key={index}
                                                                            onClick={() => handleActionClick(elem, message.action)}
                                                                        >
                                                                            {elem.label}
                                                                        </Button>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                        {message.type === 'apiMessage' && message.id ? (
                                                            <>
                                                                <Box
                                                                    sx={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'start',
                                                                        gap: 1,
                                                                        mt: 1
                                                                    }}
                                                                >
                                                                    {message.feedback && message.feedback.rating && (
                                                                        <IconButton
                                                                            size='small'
                                                                            onClick={() => onThumbsUpClick(message.id)}
                                                                            sx={{ color: message.feedback.rating === 'THUMBS_UP' ? 'primary.main' : 'inherit' }}
                                                                        >
                                                                            <IconThumbUp size={18} />
                                                                        </IconButton>
                                                                    )}
                                                                    {chatFeedbackStatus && (
                                                                        <>
                                                                            <CopyToClipboardButton
                                                                                onClick={() => copyMessageToClipboard(message.message)}
                                                                            />
                                                                            {!message.feedback ||
                                                                                message.feedback.rating === '' ||
                                                                                message.feedback.rating === 'THUMBS_UP' ? (
                                                                                <ThumbsUpButton
                                                                                    isDisabled={message.feedback && message.feedback.rating === 'THUMBS_UP'}
                                                                                    rating={message.feedback ? message.feedback.rating : ''}
                                                                                    onClick={() => onThumbsUpClick(message.id)}
                                                                                />
                                                                            ) : null}
                                                                            {!message.feedback ||
                                                                                message.feedback.rating === '' ||
                                                                                message.feedback.rating === 'THUMBS_DOWN' ? (
                                                                                <ThumbsDownButton
                                                                                    isDisabled={
                                                                                        message.feedback && message.feedback.rating === 'THUMBS_DOWN'
                                                                                    }
                                                                                    rating={message.feedback ? message.feedback.rating : ''}
                                                                                    onClick={() => onThumbsDownClick(message.id)}
                                                                                />
                                                                            ) : null}
                                                                        </>
                                                                    )}
                                                                </Box>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                </>
                                            )}
                                        </Box>
                                    )
                                })}

                            {/* Starter Prompts */}
                            {messages && messages.length === 1 && starterPrompts.length > 0 && (
                                <Box sx={{ position: 'relative', px: 1, py: 1 }}>
                                    <StarterPromptsCard
                                        sx={{ bottom: previews && previews.length > 0 ? 70 : 0 }}
                                        starterPrompts={starterPrompts || []}
                                        onPromptClick={handlePromptClick}
                                        isGrid={isDialog}
                                    />
                                </Box>
                            )}

                            {/* Follow-up Prompts */}
                            {messages && messages.length > 2 && followUpPromptsStatus && followUpPrompts.length > 0 && (
                                <>
                                    <Divider sx={{ width: '100%', my: 1 }} />
                                    <Box sx={{ display: 'flex', flexDirection: 'column', position: 'relative', pt: 1.5, px: 1 }}>
                                        <Stack sx={{ flexDirection: 'row', alignItems: 'center', px: 1.5, gap: 0.5 }}>
                                            <IconSparkles size={12} />
                                            <Typography sx={{ fontSize: '0.75rem' }} variant='body2'>
                                                Try these prompts
                                            </Typography>
                                        </Stack>
                                        <FollowUpPromptsCard
                                            sx={{ bottom: previews && previews.length > 0 ? 70 : 0 }}
                                            followUpPrompts={followUpPrompts || []}
                                            onPromptClick={handleFollowUpPromptClick}
                                            isGrid={isDialog}
                                        />
                                    </Box>
                                </>
                            )}
                        </Box>

                        {/* Input Area - Fixed at Bottom */}
                        <Box
                            className="input-area-container"
                            sx={{
                                borderTop: `1px solid ${theme.palette.divider}`,
                                backgroundColor: theme.palette.background.paper
                            }}
                        >
                            <Box className='center center-input-wrapper'>
                                {previews && previews.length > 0 && (
                                    <Box sx={{ width: '100%', mb: 1.5, display: 'flex', alignItems: 'center' }}>
                                        {previews.map((item, index) => (
                                            <Fragment key={index}>{previewDisplay(item)}</Fragment>
                                        ))}
                                    </Box>
                                )}
                                {isRecording ? (
                                    <>
                                        {recordingNotSupported ? (
                                            <div className='overlay'>
                                                <div className='browser-not-supporting-audio-recording-box'>
                                                    <Typography variant='body1'>
                                                        To record audio, use modern browsers like Chrome or Firefox that support audio recording.
                                                    </Typography>
                                                    <Button
                                                        variant='contained'
                                                        color='error'
                                                        size='small'
                                                        type='button'
                                                        onClick={() => onRecordingCancelled()}
                                                    >
                                                        Okay
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <Box
                                                sx={{
                                                    width: '100%',
                                                    height: '54px',
                                                    px: 2,
                                                    border: '1px solid',
                                                    borderRadius: 3,
                                                    backgroundColor: customization.isDarkMode ? '#32353b' : '#fafafa',
                                                    borderColor: 'rgba(0, 0, 0, 0.23)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between'
                                                }}
                                            >
                                                <div className='recording-elapsed-time'>
                                                    <span className='red-recording-dot'>
                                                        <IconCircleDot />
                                                    </span>
                                                    <Typography id='elapsed-time'>00:00</Typography>
                                                    {isLoadingRecording && <Typography ml={1.5}>Sending...</Typography>}
                                                </div>
                                                <div className='recording-control-buttons-container'>
                                                    <IconButton onClick={onRecordingCancelled} size='small'>
                                                        <IconX
                                                            color={loading || !chatflowid ? '#9e9e9e' : customization.isDarkMode ? 'white' : '#1e88e5'}
                                                        />
                                                    </IconButton>
                                                    <IconButton onClick={onRecordingStopped} size='small'>
                                                        <IconSend
                                                            color={loading || !chatflowid ? '#9e9e9e' : customization.isDarkMode ? 'white' : '#1e88e5'}
                                                        />
                                                    </IconButton>
                                                </div>
                                            </Box>
                                        )}
                                    </>
                                ) : (
                                    <div className="input-form-wrapper">
                                        <form onSubmit={handleSubmit}>
                                            <OutlinedInput
                                                inputRef={inputRef}
                                                // eslint-disable-next-line
                                                autoFocus
                                                sx={{ width: '100%' }}
                                                disabled={getInputDisabled()}
                                                onKeyDown={handleEnter}
                                                id='userInput'
                                                name='userInput'
                                                placeholder={loading ? 'Waiting for response...' : 'Type your question...'}
                                                value={userInput}
                                                onChange={onChange}
                                                multiline={true}
                                                maxRows={isDialog ? 7 : 2}
                                                startAdornment={
                                                    <>
                                                        {isChatFlowAvailableForImageUploads && !isChatFlowAvailableForFileUploads && (
                                                            <InputAdornment position='start' sx={{ ml: 2 }}>
                                                                <IconButton
                                                                    onClick={handleImageUploadClick}
                                                                    type='button'
                                                                    disabled={getInputDisabled()}
                                                                    edge='start'
                                                                >
                                                                    <IconPhotoPlus
                                                                        color={getInputDisabled() ? '#9e9e9e' : customization.isDarkMode ? 'white' : '#1e88e5'}
                                                                    />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )}
                                                        {!isChatFlowAvailableForImageUploads && isChatFlowAvailableForFileUploads && (
                                                            <InputAdornment position='start' sx={{ ml: 2 }}>
                                                                <IconButton
                                                                    onClick={handleFileUploadClick}
                                                                    type='button'
                                                                    disabled={getInputDisabled()}
                                                                    edge='start'
                                                                >
                                                                    <IconPaperclip
                                                                        color={getInputDisabled() ? '#9e9e9e' : customization.isDarkMode ? 'white' : '#1e88e5'}
                                                                    />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )}
                                                        {isChatFlowAvailableForImageUploads && isChatFlowAvailableForFileUploads && (
                                                            <InputAdornment position='start' sx={{ ml: 2 }}>
                                                                <IconButton
                                                                    onClick={handleImageUploadClick}
                                                                    type='button'
                                                                    disabled={getInputDisabled()}
                                                                    edge='start'
                                                                >
                                                                    <IconPhotoPlus
                                                                        color={getInputDisabled() ? '#9e9e9e' : customization.isDarkMode ? 'white' : '#1e88e5'}
                                                                    />
                                                                </IconButton>
                                                                <IconButton
                                                                    sx={{ ml: 0 }}
                                                                    onClick={handleFileUploadClick}
                                                                    type='button'
                                                                    disabled={getInputDisabled()}
                                                                    edge='start'
                                                                >
                                                                    <IconPaperclip
                                                                        color={getInputDisabled() ? '#9e9e9e' : customization.isDarkMode ? 'white' : '#1e88e5'}
                                                                    />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )}
                                                        {!isChatFlowAvailableForImageUploads && !isChatFlowAvailableForFileUploads && <Box sx={{ pl: 1 }} />}
                                                    </>
                                                }
                                                endAdornment={
                                                    <>
                                                        {isChatFlowAvailableForSpeech && (
                                                            <InputAdornment position='end'>
                                                                <IconButton
                                                                    onClick={() => onMicrophonePressed()}
                                                                    type='button'
                                                                    disabled={getInputDisabled()}
                                                                    edge='end'
                                                                >
                                                                    <IconMicrophone
                                                                        className={'start-recording-button'}
                                                                        color={getInputDisabled() ? '#9e9e9e' : customization.isDarkMode ? 'white' : '#1e88e5'}
                                                                    />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )}
                                                        {!isAgentCanvas && (
                                                            <InputAdornment position='end' sx={{ paddingRight: '15px' }}>
                                                                <IconButton type='submit' disabled={getInputDisabled()} edge='end'>
                                                                    {loading ? (
                                                                        <div>
                                                                            <CircularProgress color='inherit' size={20} />
                                                                        </div>
                                                                    ) : (
                                                                        // Send icon SVG in input field
                                                                        <IconSend
                                                                            color={
                                                                                getInputDisabled() ? '#9e9e9e' : customization.isDarkMode ? 'white' : '#1e88e5'
                                                                            }
                                                                        />
                                                                    )}
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )}
                                                        {isAgentCanvas && (
                                                            <>
                                                                {!loading && (
                                                                    <InputAdornment position='end' sx={{ paddingRight: '15px' }}>
                                                                        <IconButton type='submit' disabled={getInputDisabled()} edge='end'>
                                                                            <IconSend
                                                                                color={
                                                                                    getInputDisabled()
                                                                                        ? '#9e9e9e'
                                                                                        : customization.isDarkMode
                                                                                            ? 'white'
                                                                                            : '#1e88e5'
                                                                                }
                                                                            />
                                                                        </IconButton>
                                                                    </InputAdornment>
                                                                )}
                                                                {loading && (
                                                                    <InputAdornment position='end' sx={{ padding: '15px', mr: 1 }}>
                                                                        <IconButton
                                                                            edge='end'
                                                                            title={isMessageStopping ? 'Stopping...' : 'Stop'}
                                                                            style={{ border: !isMessageStopping ? '2px solid red' : 'none' }}
                                                                            onClick={() => handleAbort()}
                                                                            disabled={isMessageStopping}
                                                                        >
                                                                            {isMessageStopping ? (
                                                                                <div>
                                                                                    <CircularProgress color='error' size={20} />
                                                                                </div>
                                                                            ) : (
                                                                                <IconSquareFilled size={15} color='red' />
                                                                            )}
                                                                        </IconButton>
                                                                    </InputAdornment>
                                                                )}
                                                            </>
                                                        )}
                                                    </>
                                                }
                                            />
                                            {isChatFlowAvailableForImageUploads && (
                                                <input
                                                    style={{ display: 'none' }}
                                                    multiple
                                                    ref={imgUploadRef}
                                                    type='file'
                                                    onChange={handleFileChange}
                                                    accept={imageUploadAllowedTypes || '*'}
                                                />
                                            )}
                                            {isChatFlowAvailableForFileUploads && (
                                                <input
                                                    style={{ display: 'none' }}
                                                    multiple
                                                    ref={fileUploadRef}
                                                    type='file'
                                                    onChange={handleFileChange}
                                                    accept={getFileUploadAllowedTypes()}
                                                />
                                            )}
                                        </form>
                                    </div>
                                )}
                            </Box>
                        </Box>
                    </Box>
                </div>
                <SourceDocDialog show={sourceDialogOpen} dialogProps={sourceDialogProps} onCancel={() => setSourceDialogOpen(false)} />
                <ChatFeedbackContentDialog
                    show={showFeedbackContentDialog}
                    onCancel={() => setShowFeedbackContentDialog(false)}
                    onConfirm={submitFeedbackContent}
                />
                <Dialog
                    maxWidth='md'
                    fullWidth
                    open={openFeedbackDialog}
                    onClose={() => {
                        setOpenFeedbackDialog(false)
                        setPendingActionData(null)
                        setFeedback('')
                    }}
                >
                    <DialogTitle variant='h5'>Provide Feedback</DialogTitle>
                    <DialogContent>
                        <TextField
                            // eslint-disable-next-line
                            autoFocus
                            margin='dense'
                            label='Feedback'
                            fullWidth
                            multiline
                            rows={4}
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleSubmitFeedback}>Cancel</Button>
                        <Button onClick={handleSubmitFeedback} variant='contained'>
                            Submit
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    )
}

ChatMessage.propTypes = {
    open: PropTypes.bool,
    chatflowid: PropTypes.string,
    isAgentCanvas: PropTypes.bool,
    isDialog: PropTypes.bool,
    previews: PropTypes.array,
    setPreviews: PropTypes.func,
    onExpand: PropTypes.func,
    onClose: PropTypes.func
}

export default memo(ChatMessage)
