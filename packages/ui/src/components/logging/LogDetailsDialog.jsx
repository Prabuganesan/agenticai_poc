import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Stack,
    Chip,
    IconButton,
    Paper,
    Divider
} from '@mui/material'
import { IconX, IconCopy } from '@tabler/icons-react'
import { formatTimestamp, formatLogLevel, copyLogToClipboard } from '@/utils/logUtils'
import { useState } from 'react'

const LogDetailsDialog = ({ log, onClose }) => {
    const [copied, setCopied] = useState(false)
    const portalElement = document.getElementById('portal')

    if (!log) return null

    const levelInfo = formatLogLevel(log.level)

    const handleCopy = async () => {
        const success = await copyLogToClipboard(log)
        if (success) {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const component = (
        <Dialog
            open={!!log}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            aria-labelledby="log-details-dialog-title"
        >
            <DialogTitle id="log-details-dialog-title">
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6">Log Details</Typography>
                    <IconButton onClick={onClose} size="small">
                        <IconX />
                    </IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    {/* Basic Info */}
                    <Box>
                        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                            Timestamp
                        </Typography>
                        <Typography variant="body1">
                            {formatTimestamp(log.timestamp)}
                        </Typography>
                    </Box>

                    <Divider />

                    {/* Level */}
                    <Box>
                        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                            Level
                        </Typography>
                        <Chip
                            label={levelInfo.text}
                            sx={{
                                backgroundColor: levelInfo.bgColor,
                                color: levelInfo.color,
                                borderColor: levelInfo.borderColor,
                                borderWidth: 1,
                                borderStyle: 'solid'
                            }}
                        />
                    </Box>

                    <Divider />

                    {/* Message */}
                    <Box>
                        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                            Message
                        </Typography>
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                            {log.message}
                        </Typography>
                    </Box>

                    {/* Module/Group/Service */}
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        {log.module && (
                            <Chip label={`Module: ${log.module}`} size="small" variant="outlined" />
                        )}
                        {log.group && (
                            <Chip label={`Group: ${log.group}`} size="small" variant="outlined" />
                        )}
                        {log.service && (
                            <Chip label={`Service: ${log.service}`} size="small" variant="outlined" />
                        )}
                    </Stack>

                    {/* Context */}
                    {log.context && Object.keys(log.context).length > 0 && (
                        <>
                            <Divider />
                            <Box>
                                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                                    Context
                                </Typography>
                                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                                    <pre style={{ margin: 0, fontSize: '0.875rem', overflow: 'auto' }}>
                                        {JSON.stringify(log.context, null, 2)}
                                    </pre>
                                </Paper>
                            </Box>
                        </>
                    )}

                    {/* Error Details */}
                    {log.error && (
                        <>
                            <Divider />
                            <Box>
                                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                                    Error Details
                                </Typography>
                                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
                                    <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                                        {log.error.stack || log.error.message || JSON.stringify(log.error, null, 2)}
                                    </Typography>
                                </Paper>
                            </Box>
                        </>
                    )}

                    {/* Metadata */}
                    <Divider />
                    <Box>
                        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                            Full Log Entry (JSON)
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', maxHeight: 400, overflow: 'auto' }}>
                            <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                                {JSON.stringify(log, null, 2)}
                            </pre>
                        </Paper>
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button
                    startIcon={<IconCopy />}
                    onClick={handleCopy}
                    variant="outlined"
                >
                    {copied ? 'Copied!' : 'Copy to Clipboard'}
                </Button>
                <Button onClick={onClose} variant="contained">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    )

    return portalElement ? createPortal(component, portalElement) : component
}

LogDetailsDialog.propTypes = {
    log: PropTypes.object,
    onClose: PropTypes.func.isRequired
}

export default LogDetailsDialog

