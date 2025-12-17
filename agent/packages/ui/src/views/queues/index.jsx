import { useEffect, useState } from 'react'
import { Box, Typography, Paper, Button, CircularProgress } from '@mui/material'
import { IconAlertCircle } from '@tabler/icons-react'
import config from '@/config'

const Queues = () => {
    const [iframeUrl, setIframeUrl] = useState('')
    const [isEnabled, setIsEnabled] = useState(null) // null = loading, true = enabled, false = disabled

    useEffect(() => {
        const baseUrl = config.basename || ''
        const url = `${baseUrl}/admin/queues`
        setIframeUrl(url)

        // Check if the dashboard is accessible
        // We fetch the API endpoint because the main route might return 200 OK (the React app itself) due to SPA routing
        // The BullMQ dashboard API returns JSON, while the React app returns HTML
        fetch(`${url}/api/queues`)
            .then((res) => {
                const contentType = res.headers.get('content-type')
                if (res.status === 200 && contentType && contentType.includes('application/json')) {
                    setIsEnabled(true)
                } else {
                    setIsEnabled(false)
                }
            })
            .catch(() => {
                setIsEnabled(false)
            })
    }, [])

    if (isEnabled === false) {
        return (
            <Box sx={{ p: 3, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 600, borderRadius: 2, border: '1px solid #e0e0e0' }} elevation={0}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                        <IconAlertCircle size={64} color="#f44336" />
                    </Box>
                    <Typography variant="h2" gutterBottom>
                        Queue Mode Not Enabled
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        The BullMQ Dashboard is currently disabled. To access the queue management interface, you need to enable Queue Mode on your server.
                    </Typography>
                    <Box sx={{ textAlign: 'left', bgcolor: '#f5f5f5', p: 3, borderRadius: 2, mb: 3 }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                            How to enable:
                        </Typography>
                        <Typography variant="body2" component="div" sx={{ fontFamily: 'monospace', lineHeight: 1.6 }}>
                            1. Open your <strong>.env</strong> file<br />
                            2. Set <strong>MODE=queue</strong><br />
                            3. Set <strong>ENABLE_BULLMQ_DASHBOARD=true</strong><br />
                            4. Restart the server
                        </Typography>
                    </Box>
                    <Button variant="contained" onClick={() => window.location.reload()}>
                        Refresh Page
                    </Button>
                </Paper>
            </Box>
        )
    }

    return (
        <Box sx={{ height: 'calc(100vh - 88px)', width: '100%', overflow: 'hidden', borderRadius: '12px' }}>
            {isEnabled === null && (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <CircularProgress />
                </Box>
            )}
            {isEnabled === true && (
                <Box sx={{ p: 3, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 600, borderRadius: 2, border: '1px solid #e0e0e0' }} elevation={0}>
                        <Typography variant="h2" gutterBottom>
                            Queue Dashboard Ready
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                            The BullMQ Dashboard is running. Click the button below to open it in a new tab.
                        </Typography>
                        <Button
                            variant="contained"
                            size="large"
                            onClick={() => window.open(iframeUrl, '_blank')}
                        >
                            Open Dashboard ↗
                        </Button>
                    </Paper>
                </Box>
            )}
        </Box>
    )
}

export default Queues
