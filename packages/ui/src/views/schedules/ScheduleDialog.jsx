import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { createPortal } from 'react-dom'
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
    Stack,
    FormHelperText
} from '@mui/material'
import { DateTimePicker } from '@mui/x-date-pickers'
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment'
import { LocalizationProvider } from '@mui/x-date-pickers'
import moment from 'moment'
import chatflowsApi from '@/api/chatflows'
import schedulesApi from '@/api/schedules'

const ScheduleDialog = ({ show, dialogProps, onCancel, onConfirm, setError }) => {
    const portalElement = document.getElementById('portal')

    const [name, setName] = useState('')
    const [chatflowId, setChatflowId] = useState('')
    const [scheduleType, setScheduleType] = useState('cron') // cron, interval, once
    const [cronExpression, setCronExpression] = useState('')
    const [interval, setInterval] = useState('')
    const [startDate, setStartDate] = useState(moment())
    const [chatflows, setChatflows] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (show) {
            // Reset form
            setName('')
            setChatflowId('')
            setScheduleType('cron')
            setCronExpression('')
            setInterval('')
            setStartDate(moment())

            // If editing, populate form
            if (dialogProps.type === 'EDIT' && dialogProps.data) {
                const data = dialogProps.data
                setName(data.name)
                setChatflowId(data.chatflowId) // Note: backend stores targetId, but UI uses chatflowId state
                setScheduleType(data.scheduleType)
                setCronExpression(data.cronExpression || '')
                setInterval(data.intervalMs || '') // Use intervalMs
                setStartDate(data.nextRunAt ? moment(data.nextRunAt) : moment())
            }

            // Fetch available chatflows
            const fetchChatflows = async () => {
                try {
                    const [chatflowsResponse, agentflowsResponse] = await Promise.all([
                        chatflowsApi.getAllChatflows(),
                        chatflowsApi.getAllAgentflows('MULTIAGENT')
                    ])
                    const allFlows = [
                        ...(chatflowsResponse.data || []),
                        ...(agentflowsResponse.data || [])
                    ]

                    // Deduplicate by ID/GUID
                    const uniqueFlows = Array.from(new Map(allFlows.map(item => [item.guid || item.id, item])).values())

                    setChatflows(uniqueFlows)
                } catch (error) {
                    console.error('Failed to fetch chatflows:', error)
                    // Don't crash the dialog, just undefined flows
                }
            }
            fetchChatflows()
        }
    }, [show, dialogProps, setError])

    const handleSave = async () => {
        if (!name) {
            alert('Name is required')
            return
        }
        if (!chatflowId) {
            alert('Chatflow is required')
            return
        }
        if (scheduleType === 'cron' && !cronExpression) {
            alert('Cron expression is required')
            return
        }
        if (scheduleType === 'interval' && !interval) {
            alert('Interval is required')
            return
        }

        setLoading(true)
        try {
            const payload = {
                name,
                chatflowId,
                scheduleType,
                cronExpression: scheduleType === 'cron' ? cronExpression : undefined,
                interval: scheduleType === 'interval' ? parseInt(interval) : undefined,
                startDate: startDate.toDate()
            }

            if (dialogProps.type === 'ADD') {
                await schedulesApi.createSchedule(payload)
            } else if (dialogProps.type === 'EDIT') {
                await schedulesApi.updateSchedule(dialogProps.data.guid, payload)
            }

            onConfirm()
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message
            alert(`Error: ${errorMsg}`)
        } finally {
            setLoading(false)
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
                {dialogProps.title || (dialogProps.type === 'ADD' ? 'Add Schedule' : 'Edit Schedule')}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ p: 2 }}>
                    <Stack spacing={3}>
                        <TextField
                            fullWidth
                            label='Name'
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />

                        <FormControl fullWidth>
                            <InputLabel id='chatflow-select-label'>Chatflow / Agentflow</InputLabel>
                            <Select
                                labelId='chatflow-select-label'
                                value={chatflowId}
                                label='Chatflow / Agentflow'
                                onChange={(e) => setChatflowId(e.target.value)}
                            >
                                {chatflows.map((flow) => (
                                    <MenuItem key={flow.guid || flow.id} value={flow.guid || flow.id}>
                                        {flow.name} ({flow.type === 'AGENTFLOW' ? 'Agent' : 'Chatflow'})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth>
                            <InputLabel id='type-select-label'>Type</InputLabel>
                            <Select
                                labelId='type-select-label'
                                value={scheduleType}
                                label='Type'
                                onChange={(e) => setScheduleType(e.target.value)}
                            >
                                <MenuItem value='cron'>Cron (Recurring)</MenuItem>
                                <MenuItem value='interval'>Interval (Recurring)</MenuItem>
                                <MenuItem value='one-time'>One-time</MenuItem>
                            </Select>
                        </FormControl>

                        {scheduleType === 'cron' && (
                            <TextField
                                fullWidth
                                label='Cron Expression'
                                placeholder='* * * * *'
                                helperText='e.g. 0 0 * * * (Daily at midnight)'
                                value={cronExpression}
                                onChange={(e) => setCronExpression(e.target.value)}
                            />
                        )}

                        {scheduleType === 'interval' && (
                            <TextField
                                fullWidth
                                type='number'
                                label='Interval (ms)'
                                helperText='e.g. 3600000 (1 hour)'
                                value={interval}
                                onChange={(e) => setInterval(e.target.value)}
                            />
                        )}

                        <LocalizationProvider dateAdapter={AdapterMoment}>
                            <DateTimePicker
                                label='Start Date / Execution Time'
                                value={startDate}
                                onChange={(newValue) => setStartDate(newValue)}
                                slotProps={{ textField: { fullWidth: true } }}
                            />
                        </LocalizationProvider>

                    </Stack>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSave} variant='contained' disabled={loading}>
                    {dialogProps.confirmButtonName || 'Save'}
                </Button>
            </DialogActions>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

ScheduleDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func,
    setError: PropTypes.func
}

export default ScheduleDialog
