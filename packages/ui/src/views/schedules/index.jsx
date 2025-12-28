import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import moment from 'moment'
import {
    Button,
    Box,
    Chip,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Typography,
    useTheme,
    Switch
} from '@mui/material'
import { styled } from '@mui/material/styles'
import { tableCellClasses } from '@mui/material/TableCell'
import {
    IconTrash,
    IconEdit,
    IconPlus,
    IconPlayerPause,
    IconPlayerPlay,
    IconClock
} from '@tabler/icons-react'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'
import TablePagination, { DEFAULT_ITEMS_PER_PAGE } from '@/ui-component/pagination/TablePagination'

// API
import schedulesApi from '@/api/schedules'

// Hooks
import useApi from '@/hooks/useApi'
import useConfirm from '@/hooks/useConfirm'

// utils
import useNotifier from '@/utils/useNotifier'

// Components
import ScheduleDialog from './ScheduleDialog'
import { useError } from '@/store/context/ErrorContext'

// Styles
const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: theme.palette.grey[900] + 25,
    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900]
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        height: 64
    }
}))

const StyledTableRow = styled(TableRow)(() => ({
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

const Schedules = () => {


    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    const { error, setError } = useError()
    useNotifier()

    // State
    const [isLoading, setLoading] = useState(true)
    const [schedules, setSchedules] = useState([])
    const [showDialog, setShowDialog] = useState(false)
    const [dialogProps, setDialogProps] = useState({})
    const [search, setSearch] = useState('')

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [pageLimit, setPageLimit] = useState(DEFAULT_ITEMS_PER_PAGE)
    const [total, setTotal] = useState(0)

    // API
    const getAllSchedules = useApi(schedulesApi.getAllSchedules)
    const { confirm } = useConfirm()

    const onChange = (page, limit) => {
        setCurrentPage(page)
        setPageLimit(limit)
        refresh(page, limit)
    }

    const refresh = (page, limit) => {
        getAllSchedules.request(page || currentPage, limit || pageLimit)
    }

    useEffect(() => {
        refresh(currentPage, pageLimit)
    }, [])

    // Auto-refresh every 1 minute
    useEffect(() => {
        const intervalId = setInterval(() => {
            refresh(currentPage, pageLimit)
        }, 60000)

        return () => clearInterval(intervalId)
    }, [currentPage, pageLimit])

    useEffect(() => {
        setLoading(getAllSchedules.loading)
    }, [getAllSchedules.loading])

    useEffect(() => {
        if (getAllSchedules.data) {
            setSchedules(getAllSchedules.data.data || [])
            setTotal(getAllSchedules.data.total || 0)
        }
    }, [getAllSchedules.data])

    const onSearchChange = (event) => setSearch(event.target.value)

    function filterSchedules(data) {
        return data.name && data.name.toLowerCase().indexOf(search.toLowerCase()) > -1
    }

    const addNew = () => {
        setDialogProps({
            type: 'ADD',
            title: 'Create New Schedule',
            confirmButtonName: 'Create'
        })
        setShowDialog(true)
    }

    const edit = (schedule) => {
        setDialogProps({
            type: 'EDIT',
            title: 'Edit Schedule',
            confirmButtonName: 'Save',
            data: schedule
        })
        setShowDialog(true)
    }

    const deleteSchedule = async (schedule) => {
        const isConfirmed = await confirm({
            title: 'Delete Schedule',
            description: `Are you sure you want to delete "${schedule.name}"?`,
            confirmButtonName: 'Delete',
            cancelButtonName: 'Cancel'
        })

        if (isConfirmed) {
            try {
                await schedulesApi.deleteSchedule(schedule.guid)
                refresh()
            } catch (error) {
                setError(error)
            }
        }
    }

    const toggleStatus = async (schedule) => {
        try {
            const newStatus = schedule.status === 'active' ? 'paused' : 'active'
            await schedulesApi.updateSchedule(schedule.guid, { status: newStatus })
            refresh()
        } catch (error) {
            setError(error)
        }
    }

    const onConfirm = () => {
        setShowDialog(false)
        refresh()
    }

    return (
        <>
            <MainCard>
                {error ? (
                    <ErrorBoundary error={error} />
                ) : (
                    <Stack flexDirection='column' sx={{ gap: 3 }}>
                        <ViewHeader
                            onSearchChange={onSearchChange}
                            search={true}
                            searchPlaceholder='Search Schedules'
                            title='Schedules'
                            description='Manage automation schedules for your agents'
                        >
                            <Button
                                variant='contained'
                                sx={{ borderRadius: 2, height: '100%' }}
                                onClick={addNew}
                                startIcon={<IconPlus />}
                            >
                                Create Schedule
                            </Button>
                        </ViewHeader>

                        {!isLoading && schedules.length === 0 ? (
                            <Stack sx={{ alignItems: 'center', justifyContent: 'center', p: 3 }}>
                                <Box sx={{ p: 2 }}>
                                    <IconClock size={64} color={theme.palette.grey[400]} />
                                </Box>
                                <Typography variant="h4" color="textSecondary">No Schedules Yet</Typography>
                            </Stack>
                        ) : (
                            <>
                                <TableContainer component={Paper} sx={{ border: 1, borderColor: theme.palette.grey[900] + 25, borderRadius: 2 }}>
                                    <Table sx={{ minWidth: 650 }}>
                                        <TableHead sx={{ bgcolor: customization.isDarkMode ? theme.palette.common.black : theme.palette.grey[100] }}>
                                            <TableRow>
                                                <StyledTableCell>Name</StyledTableCell>
                                                <StyledTableCell>Type</StyledTableCell>
                                                <StyledTableCell>Timezone</StyledTableCell>
                                                <StyledTableCell>Schedule</StyledTableCell>
                                                <StyledTableCell>Next Run</StyledTableCell>
                                                <StyledTableCell>Status</StyledTableCell>
                                                <StyledTableCell align="right">Actions</StyledTableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {isLoading ? (
                                                <StyledTableRow>
                                                    <StyledTableCell colSpan={6}>
                                                        <Skeleton animation="wave" />
                                                    </StyledTableCell>
                                                </StyledTableRow>
                                            ) : (
                                                schedules.filter(filterSchedules).map((schedule) => (
                                                    <StyledTableRow key={schedule.guid}>
                                                        <StyledTableCell>
                                                            <Typography variant="subtitle1" fontWeight="bold">
                                                                {schedule.name}
                                                            </Typography>
                                                        </StyledTableCell>
                                                        <StyledTableCell>
                                                            <Chip
                                                                label={schedule.scheduleType.toUpperCase()}
                                                                size="small"
                                                                color={schedule.scheduleType === 'cron' ? 'primary' : 'secondary'}
                                                                variant="outlined"
                                                            />
                                                        </StyledTableCell>
                                                        <StyledTableCell>
                                                            {schedule.timezone || 'UTC'}
                                                        </StyledTableCell>
                                                        <StyledTableCell>
                                                            {schedule.scheduleType.toLowerCase() === 'cron' ? schedule.cronExpression : `${schedule.intervalMs || 0}ms`}
                                                        </StyledTableCell>
                                                        <StyledTableCell>
                                                            {['completed', 'failed'].includes(schedule.status) ? (
                                                                <Typography variant="body2" color="textSecondary">-</Typography>
                                                            ) : (
                                                                <Stack>
                                                                    <Typography variant="body2">
                                                                        {schedule.nextRunAt ? moment(schedule.nextRunAt).fromNow() : 'N/A'}
                                                                    </Typography>
                                                                    {schedule.nextRunAt && (
                                                                        <Typography variant="caption" color="textSecondary">
                                                                            {moment(schedule.nextRunAt).format('MMM Do, h:mm:ss a')}
                                                                        </Typography>
                                                                    )}
                                                                </Stack>
                                                            )}
                                                        </StyledTableCell>
                                                        <StyledTableCell>
                                                            <Chip
                                                                label={schedule.status}
                                                                color={schedule.status === 'active' ? 'success' : schedule.status === 'failed' ? 'error' : 'default'}
                                                                size="small"
                                                            />
                                                        </StyledTableCell>
                                                        <StyledTableCell align="right">
                                                            <IconButton
                                                                onClick={() => toggleStatus(schedule)}
                                                                title={schedule.status === 'active' ? 'Pause' : 'Resume'}
                                                                disabled={['completed', 'failed'].includes(schedule.status)}
                                                            >
                                                                {schedule.status === 'active' ? <IconPlayerPause /> : <IconPlayerPlay />}
                                                            </IconButton>
                                                            <IconButton color="primary" onClick={() => edit(schedule)} disabled={['completed', 'failed'].includes(schedule.status)}>
                                                                <IconEdit />
                                                            </IconButton>
                                                            <IconButton color="error" onClick={() => deleteSchedule(schedule)}>
                                                                <IconTrash />
                                                            </IconButton>
                                                        </StyledTableCell>
                                                    </StyledTableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                                <TablePagination currentPage={currentPage} limit={pageLimit} total={total} onChange={onChange} />
                            </>
                        )}
                    </Stack>
                )}
            </MainCard>

            <ScheduleDialog
                show={showDialog}
                dialogProps={dialogProps}
                onCancel={() => setShowDialog(false)}
                onConfirm={onConfirm}
                setError={setError}
            />
            <ConfirmDialog />
        </>
    )
}

export default Schedules
