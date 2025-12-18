import { memo, useState, useRef, useEffect } from 'react'
import PropTypes from 'prop-types'

import { ClickAwayListener, Paper, Box } from '@mui/material'
import { IconMessage } from '@tabler/icons-react'

// project import
import { StyledFab } from '@/ui-component/button/StyledFab'
import MainCard from '@/ui-component/cards/MainCard'
import Transitions from '@/ui-component/extended/Transitions'
import ChatMessage from './ChatMessage'
import ChatExpandDialog from './ChatExpandDialog'
import './ChatMessage.css'

const ChatPopUp = ({ chatflowid, isAgentCanvas, onOpenChange }) => {
    const [open, setOpen] = useState(false)
    const [showExpandDialog, setShowExpandDialog] = useState(false)
    const [expandDialogProps, setExpandDialogProps] = useState({})
    const [previews, setPreviews] = useState([])

    const prevOpen = useRef(open)
    const anchorRef = useRef(null)

    const handleClose = () => {
        setOpen(false)
        if (onOpenChange) onOpenChange(false)
    }

    const handleOpen = () => {
        setOpen(true)
        if (onOpenChange) onOpenChange(true)
    }

    const expandChat = () => {
        // Close the popup when expanding
        setOpen(false)
        if (onOpenChange) onOpenChange(false)

        const props = {
            open: true,
            chatflowid: chatflowid
        }
        setExpandDialogProps(props)
        setShowExpandDialog(true)
    }

    useEffect(() => {
        if (prevOpen.current === true && open === false) {
            if (anchorRef.current) {
                anchorRef.current.focus()
            }
            if (onOpenChange) onOpenChange(false)
        }
        prevOpen.current = open

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, chatflowid])

    return (
        <>
            {!open && (
                <StyledFab
                    sx={{ position: 'absolute', right: 20, top: 20 }}
                    ref={anchorRef}
                    size='small'
                    color='secondary'
                    aria-label='chat'
                    title='Open Chat'
                    onClick={handleOpen}
                >
                    <IconMessage />
                </StyledFab>
            )}
            {open && (
                <Box className='chat-popup-root'>
                    <Transitions in={open} type='grow' direction='left'>
                        <Paper
                            elevation={16}
                            sx={{
                                width: '100%',
                                height: '100%',
                                maxHeight: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                borderRadius: 2,
                                boxSizing: 'border-box'
                            }}
                        >
                            <ClickAwayListener onClickAway={handleClose}>
                                <MainCard
                                    border={false}
                                    className='cloud-wrapper'
                                    elevation={0}
                                    content={false}
                                    boxShadow={false}
                                    sx={{
                                        width: '100% !important',
                                        height: '100% !important',
                                        minWidth: '100% !important',
                                        maxWidth: '100% !important',
                                        minHeight: 0, // Don't force minimum height
                                        maxHeight: '100% !important',
                                        display: 'flex !important',
                                        flexDirection: 'column !important',
                                        overflow: 'hidden !important',
                                        position: 'relative !important',
                                        margin: 0,
                                        padding: 0,
                                        boxSizing: 'border-box !important'
                                    }}
                                >
                                    <ChatMessage
                                        isAgentCanvas={isAgentCanvas}
                                        chatflowid={chatflowid}
                                        open={open}
                                        previews={previews}
                                        setPreviews={setPreviews}
                                        isDialog={false}
                                        onExpand={expandChat}
                                        onClose={handleClose}
                                    />
                                </MainCard>
                            </ClickAwayListener>
                        </Paper>
                    </Transitions>
                </Box>
            )}
            <ChatExpandDialog
                show={showExpandDialog}
                dialogProps={expandDialogProps}
                isAgentCanvas={isAgentCanvas}
                onCancel={() => setShowExpandDialog(false)}
                previews={previews}
                setPreviews={setPreviews}
            ></ChatExpandDialog>
        </>
    )
}

ChatPopUp.propTypes = {
    chatflowid: PropTypes.string,
    isAgentCanvas: PropTypes.bool,
    onOpenChange: PropTypes.func
}

export default memo(ChatPopUp)
