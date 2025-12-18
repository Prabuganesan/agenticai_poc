import { useState, useEffect, memo } from 'react'
import PropTypes from 'prop-types'
import {
    Box,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    IconButton,
    Typography,
    Divider,
    Tooltip
} from '@mui/material'
import { useTheme, styled } from '@mui/material/styles'
import {
    IconPlus,
    IconTrash,
    IconX,
    IconCheck,
    IconMenu2
} from '@tabler/icons-react'
import moment from 'moment'
import chatSessionsApi from '@/api/chatSessions'
import useApi from '@/hooks/useApi'
import kodivianPNG from '@/assets/images/kodivian-logo.png'

const StyledDrawer = styled(Drawer)(({ theme, open, isDialog }) => ({
    width: open ? (isDialog ? 200 : 240) : 0,
    flexShrink: 0,
    height: '100%',
    '&.MuiDrawer-root': {
        height: '100%'
    },
    '&.MuiDrawer-docked': {
        height: '100%'
    },
    '& .MuiDrawer-paper': {
        width: isDialog ? 200 : 240,
        boxSizing: 'border-box',
        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.background.default : theme.palette.background.paper,
        borderRight: `1px solid ${theme.palette.divider}`,
        transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen
        }),
        position: 'relative',
        height: '100%',
        zIndex: 1200
    }
}))

const NewChatButton = styled(Box)(({ theme }) => ({
    padding: '10px 12px',
    margin: '6px',
    borderRadius: '8px',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
    fontSize: '0.875rem',
    '&:hover': {
        backgroundColor: theme.palette.primary.dark,
        transform: 'translateY(-1px)'
    }
}))

const ChatListItem = styled(ListItemButton)(({ theme, selected }) => ({
    borderRadius: '6px',
    margin: '2px 6px',
    padding: '8px 10px',
    backgroundColor: selected
        ? theme.palette.mode === 'dark'
            ? theme.palette.action.selected
            : theme.palette.action.selected || 'rgba(25, 118, 210, 0.08)'
        : 'transparent',
    borderLeft: selected ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
    fontWeight: selected ? 600 : 400,
    '&:hover': {
        backgroundColor: selected
            ? (theme.palette.mode === 'dark' ? theme.palette.action.selected : theme.palette.action.selected || 'rgba(25, 118, 210, 0.08)')
            : theme.palette.action.hover
    }
}))

const ChatSidebar = ({
    open = true,
    onClose,
    onToggle,
    chatflowId,
    currentChatId,
    onSelectChat,
    onNewChat,
    isDialog = false,
    sessions = [],
    isLoading = false,
    onRefreshSessions
}) => {
    const theme = useTheme()
    const [deleteConfirmId, setDeleteConfirmId] = useState(null)

    const deleteChatSessionApi = useApi(chatSessionsApi.deleteChatSession)

    // Sessions are now passed as props from parent component
    // Sessions are passed as props, no need to extract from API data

    const handleDelete = async (chatId) => {
        try {
            const wasCurrentChat = chatId === currentChatId
            const currentSessions = sessions || []
            const currentIndex = currentSessions.findIndex(s => s.chatId === chatId)

            await deleteChatSessionApi.request(chatId)
            setDeleteConfirmId(null)

            if (onRefreshSessions) {
                onRefreshSessions()
            }

            if (wasCurrentChat) {
                // Navigate to next/prev chat or create new
                if (currentSessions.length > 1) {
                    let nextChat
                    if (currentIndex === currentSessions.length - 1) {
                        // If last item, go to previous
                        nextChat = currentSessions[currentIndex - 1]
                    } else {
                        // Otherwise go to next (which will take the same index)
                        nextChat = currentSessions[currentIndex + 1]
                    }

                    if (nextChat && onSelectChat) {
                        onSelectChat(nextChat.chatId)
                    }
                } else {
                    // No chats left
                    if (onNewChat) {
                        onNewChat()
                    }
                }
            }
        } catch (error) {
            console.error('Failed to delete chat session:', error)
        }
    }

    // Only show loading state if we have no sessions
    const showLoading = isLoading && sessions.length === 0

    return (
        <>
            <StyledDrawer variant="persistent" anchor="left" open={open} isDialog={isDialog}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        overflow: 'hidden'
                    }}
                >
                    {/* Header */}
                    <Box
                        sx={{
                            p: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            borderBottom: `1px solid ${theme.palette.divider}`
                        }}
                    >
                        <Box
                            component="img"
                            src={kodivianPNG}
                            alt="ARI"
                            sx={{
                                width: '50px',
                                height: '30px',
                                flexShrink: 0,
                                objectFit: 'contain'
                            }}
                        />
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: isDialog ? '0.85rem' : '0.9rem' }}>
                            Chat History
                        </Typography>
                    </Box>

                    {/* New Chat Button */}
                    <Box sx={{ p: 0.5 }}>
                        <NewChatButton onClick={onNewChat}>
                            <IconPlus size={18} />
                            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                                New Chat
                            </Typography>
                        </NewChatButton>
                    </Box>

                    <Divider />

                    {/* Chat List */}
                    <Box
                        className="chat-sidebar-list"
                        sx={{
                            flex: 1,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            minHeight: 0,
                            maxHeight: '100%',
                            position: 'relative',
                            // Ensure scrollbar is visible
                            '&::-webkit-scrollbar': {
                                width: '8px'
                            },
                            '&::-webkit-scrollbar-track': {
                                backgroundColor: theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.05)'
                                    : 'rgba(0, 0, 0, 0.05)',
                                borderRadius: '4px'
                            },
                            '&::-webkit-scrollbar-thumb': {
                                backgroundColor: theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.2)'
                                    : 'rgba(0, 0, 0, 0.2)',
                                borderRadius: '4px',
                                '&:hover': {
                                    backgroundColor: theme.palette.mode === 'dark'
                                        ? 'rgba(255, 255, 255, 0.3)'
                                        : 'rgba(0, 0, 0, 0.3)'
                                }
                            },
                            // Firefox scrollbar
                            scrollbarWidth: 'thin',
                            scrollbarColor: theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05)'
                                : 'rgba(0, 0, 0, 0.2) rgba(0, 0, 0, 0.05)'
                        }}
                    >
                        {showLoading ? (
                            <Box sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                    Loading...
                                </Typography>
                            </Box>
                        ) : sessions.length === 0 ? (
                            <Box sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                    No chat history
                                </Typography>
                            </Box>
                        ) : (
                            <List sx={{ p: 0 }}>
                                {sessions.map((session) => {
                                    const isSelected = session.chatId === currentChatId
                                    const isDeleting = deleteConfirmId === session.chatId

                                    return (
                                        <ListItem
                                            key={session.chatId}
                                            disablePadding
                                            sx={{ mb: 0.5 }}
                                        >
                                            <ChatListItem
                                                selected={isSelected}
                                                onClick={() => !isDeleting && onSelectChat(session.chatId)}
                                                sx={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'flex-start',
                                                    position: 'relative',
                                                    '&:hover .chat-actions': {
                                                        opacity: 1
                                                    }
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: '100%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between'
                                                    }}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontWeight: isSelected ? 600 : 400,
                                                            flex: 1,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            pr: 1
                                                        }}
                                                    >
                                                        {session.title || 'New Chat'}
                                                    </Typography>
                                                    {!isDeleting && (
                                                        <Box
                                                            className="chat-actions"
                                                            sx={{
                                                                display: 'flex',
                                                                gap: 0.5,
                                                                opacity: 0,
                                                                transition: 'opacity 0.2s'
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <Tooltip title="Delete chat">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setDeleteConfirmId(session.chatId)
                                                                    }}
                                                                    color="error"
                                                                    sx={{
                                                                        '&:hover': {
                                                                            backgroundColor: 'error.light',
                                                                            color: 'error.contrastText'
                                                                        }
                                                                    }}
                                                                >
                                                                    <IconTrash size={16} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Box>
                                                    )}
                                                </Box>
                                                {session.preview && (
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{
                                                            mt: 0.5,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            width: '100%'
                                                        }}
                                                    >
                                                        {session.preview}
                                                    </Typography>
                                                )}
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ mt: 0.5 }}
                                                >
                                                    {session.updatedDate || session.createdDate
                                                        ? moment(session.updatedDate || session.createdDate).format('MMM D, h:mm A')
                                                        : 'N/A'}
                                                </Typography>
                                                {isDeleting && (
                                                    <Box
                                                        sx={{
                                                            mt: 1,
                                                            width: '100%',
                                                            display: 'flex',
                                                            gap: 1,
                                                            justifyContent: 'flex-end'
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Typography variant="caption" color="error" sx={{ flex: 1 }}>
                                                            Delete this chat?
                                                        </Typography>
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleDelete(session.chatId)
                                                            }}
                                                            color="error"
                                                        >
                                                            <IconCheck size={16} />
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setDeleteConfirmId(null)
                                                            }}
                                                        >
                                                            <IconX size={16} />
                                                        </IconButton>
                                                    </Box>
                                                )}
                                            </ChatListItem>
                                        </ListItem>
                                    )
                                })}
                            </List>
                        )}
                    </Box>
                </Box>
            </StyledDrawer>
        </>
    )
}

ChatSidebar.propTypes = {
    open: PropTypes.bool,
    onClose: PropTypes.func,
    onToggle: PropTypes.func,
    chatflowId: PropTypes.string.isRequired,
    currentChatId: PropTypes.string,
    onSelectChat: PropTypes.func.isRequired,
    onNewChat: PropTypes.func.isRequired,
    isDialog: PropTypes.bool,
    sessions: PropTypes.array,
    isLoading: PropTypes.bool,
    onRefreshSessions: PropTypes.func
}

export default memo(ChatSidebar)

