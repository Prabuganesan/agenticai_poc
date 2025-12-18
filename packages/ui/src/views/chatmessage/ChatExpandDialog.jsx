import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'

import { Dialog, DialogContent, DialogTitle } from '@mui/material'
import ChatMessage from './ChatMessage'

const ChatExpandDialog = ({ show, dialogProps, isAgentCanvas, onCancel, previews, setPreviews }) => {
    const portalElement = document.getElementById('portal')

    const component = show ? (
        <Dialog
            open={show}
            fullWidth
            maxWidth='md'
            onClose={onCancel}
            aria-labelledby='alert-dialog-title'
            aria-describedby='alert-dialog-description'
            sx={{ overflow: 'visible' }}
        >
            <DialogTitle sx={{ fontSize: '1rem', p: 1.5 }} id='alert-dialog-title'>
                {dialogProps.title}
            </DialogTitle>
            <DialogContent
                className='cloud-dialog-wrapper'
                sx={{ display: 'flex', justifyContent: 'flex-end', flexDirection: 'column', p: 0, height: 'calc(100vh - 120px)' }}
            >
                <ChatMessage
                    isDialog={true}
                    open={dialogProps.open}
                    isAgentCanvas={isAgentCanvas}
                    chatflowid={dialogProps.chatflowid}
                    previews={previews}
                    setPreviews={setPreviews}
                />
            </DialogContent>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

ChatExpandDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    isAgentCanvas: PropTypes.bool,
    onCancel: PropTypes.func,
    previews: PropTypes.array,
    setPreviews: PropTypes.func
}

export default ChatExpandDialog
