import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSelector } from 'react-redux'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'
import { gridSpacing } from '@/store/constant'

// material-ui
import {
    Box,
    Stack,
    Grid,
    Button,
    IconButton,
    Typography,
    CircularProgress,
    Chip,
    Card,
    CardContent,
    CardHeader,
    Tooltip,
    Pagination
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

// icons
import {
    IconFilter,
    IconRefresh,
    IconDownload,
    IconMenu2
} from '@tabler/icons-react'

// API & Hooks
import useApi from '@/hooks/useApi'
import logsApi from '@/api/log'
import { useError } from '@/store/context/ErrorContext'
import AuthUtils from '@/utils/authUtils'

// Components
import LogDetailsDialog from '@/components/logging/LogDetailsDialog'
import SearchFiltersModal from '@/components/logging/SearchFiltersModal'
import NavigationDrawer from '@/components/logging/NavigationDrawer'
import LogsList from '@/components/logging/LogsList'

import LogsEmptySVG from '@/assets/images/logs_empty.svg'

const LogsDashboard = () => {
    const theme = useTheme()
    const { error } = useError()
    
    // Get orgId from autonomousStore (encrypted, in-memory) - single source of truth
    const orgId = useMemo(() => {
        return AuthUtils.getOrgIdFromStore()
    }, [])

    useEffect(() => {
        console.log('[LogsDashboard] Component mounted. orgId:', orgId)
    }, [orgId])

    // State management
    const [drawerExpanded, setDrawerExpanded] = useState(true)
    const [activeCategory, setActiveCategory] = useState('groups') // 'groups' or 'actions'
    const [selectedGroup, setSelectedGroup] = useState('')
    const [selectedModule, setSelectedModule] = useState('')
    const [expandedGroups, setExpandedGroups] = useState(new Set(['system', 'workflows', 'services', 'storage', 'infrastructure']))
    const [selectedLog, setSelectedLog] = useState(null)
    const [showFilters, setShowFilters] = useState(false)
    const [currentLevel, setCurrentLevel] = useState('')

    // Filter state
    const [filters, setFilters] = useState({
        orgId: orgId || undefined,
        page: 1,
        limit: 50,
        level: '',
        module: '',
        group: '',
        userId: '',
        dateFrom: '',
        dateTo: '',
        search: ''
    })

    // Data state
    const [logs, setLogs] = useState([])
    const [stats, setStats] = useState(null)
    const [filterOptions, setFilterOptions] = useState(null)
    const [logGroups, setLogGroups] = useState(null)
    const [total, setTotal] = useState(0)
    const [hasMore, setHasMore] = useState(false)

    // API hooks
    const queryLogsApi = useApi(logsApi.queryLogs)
    const getStatsApi = useApi(logsApi.getLogStats)
    const getFiltersApi = useApi(logsApi.getAllFilters)
    const getGroupsApi = useApi(logsApi.getLogGroups)

    // Sync orgId in filters when Redux orgId changes
    useEffect(() => {
        console.log('[LogsDashboard] orgId changed:', orgId)
        if (orgId) {
            setFilters(prev => ({ ...prev, orgId }))
        }
    }, [orgId])

    // Load initial data - always try to load, even if orgId is undefined (for system logs)
    useEffect(() => {
        console.log('[LogsDashboard] Loading initial data. orgId:', orgId)
        loadStats()
        loadFilterOptions()
        loadLogGroups()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgId])

    // Load logs when filters change - always try to load
    useEffect(() => {
        console.log('[LogsDashboard] Filters changed:', filters)
        loadLogs()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters])

    const loadLogs = useCallback(async () => {
        try {
            console.log('[LogsDashboard] Loading logs with filters:', JSON.stringify(filters, null, 2))
            const result = await queryLogsApi.request(filters)
            console.log('[LogsDashboard] Received result:', result)
            console.log('[LogsDashboard] Result data:', result?.data)
            if (result?.data) {
                const logsCount = result.data.logs?.length || 0
                const totalCount = result.data.total || 0
                console.log(`[LogsDashboard] Setting logs: ${logsCount} logs, total: ${totalCount}`)
                setLogs(result.data.logs || [])
                setTotal(totalCount)
                setHasMore(result.data.hasMore || false)
            } else {
                console.warn('[LogsDashboard] No data in result:', result)
                setLogs([])
                setTotal(0)
                setHasMore(false)
            }
        } catch (err) {
            console.error('[LogsDashboard] Error loading logs:', err)
            console.error('[LogsDashboard] Error details:', err?.response?.data || err?.message || err)
            setLogs([])
            setTotal(0)
            setHasMore(false)
        }
    }, [filters, queryLogsApi])

    const loadStats = useCallback(async () => {
        try {
            console.log('[LogsDashboard] Loading stats. orgId:', orgId)
            const result = await getStatsApi.request(orgId)
            console.log('[LogsDashboard] Stats result:', result)
            if (result?.data?.stats) {
                console.log('[LogsDashboard] Setting stats:', result.data.stats)
                setStats(result.data.stats)
            } else {
                console.warn('[LogsDashboard] No stats in result:', result)
            }
        } catch (err) {
            console.error('[LogsDashboard] Error loading stats:', err)
            console.error('[LogsDashboard] Stats error details:', err?.response?.data || err?.message || err)
        }
    }, [orgId, getStatsApi])

    const loadFilterOptions = useCallback(async () => {
        try {
            console.log('[LogsDashboard] Loading filter options. orgId:', orgId)
            const result = await getFiltersApi.request(orgId)
            console.log('[LogsDashboard] Filter options result:', result)
            if (result?.data) {
                console.log('[LogsDashboard] Setting filter options:', result.data)
                setFilterOptions(result.data)
            } else {
                console.warn('[LogsDashboard] No filter options in result:', result)
            }
        } catch (err) {
            console.error('[LogsDashboard] Error loading filter options:', err)
            console.error('[LogsDashboard] Filter options error details:', err?.response?.data || err?.message || err)
        }
    }, [orgId, getFiltersApi])

    const loadLogGroups = useCallback(async () => {
        try {
            console.log('[LogsDashboard] Loading log groups. orgId:', orgId)
            const result = await getGroupsApi.request(orgId)
            console.log('[LogsDashboard] Log groups result:', result)
            if (result?.data?.groups) {
                console.log('[LogsDashboard] Setting log groups:', result.data.groups)
                setLogGroups(result.data.groups)
            } else {
                console.warn('[LogsDashboard] No log groups in result:', result)
                console.warn('[LogsDashboard] Result data:', result?.data)
            }
        } catch (err) {
            console.error('[LogsDashboard] Error loading log groups:', err)
            console.error('[LogsDashboard] Log groups error details:', err?.response?.data || err?.message || err)
        }
    }, [orgId, getGroupsApi])

    // Handlers
    const handleToggleDrawer = () => {
        setDrawerExpanded(!drawerExpanded)
    }

    const handleCategoryChange = (category) => {
        setActiveCategory(category)
    }

    const handleSelectGroup = (group) => {
        setSelectedGroup(group)
        setSelectedModule('')
        setFilters(prev => ({ ...prev, group, module: '', orgId: orgId, page: 1 }))
    }

    const handleSelectModule = (module, group) => {
        setSelectedModule(module)
        setSelectedGroup(group)
        setFilters(prev => ({ ...prev, module, group, orgId: orgId, page: 1 }))
    }

    const handleToggleGroup = (group) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev)
            if (newSet.has(group)) {
                newSet.delete(group)
            } else {
                newSet.add(group)
            }
            return newSet
        })
    }

    const handleQuickAction = (level) => {
        setCurrentLevel(level)
        setFilters(prev => ({ ...prev, level, orgId: orgId, page: 1 }))
    }

    const handleViewLog = (log) => {
        setSelectedLog(log)
    }

    const handleCloseLogDetails = () => {
        setSelectedLog(null)
    }

    const handleShowFilters = () => {
        setShowFilters(true)
    }

    const handleCloseFilters = () => {
        setShowFilters(false)
    }

    const handleApplyFilters = (newFilters) => {
        // Always preserve orgId from Redux state (user's current org)
        setFilters(prev => ({ ...prev, ...newFilters, orgId: orgId, page: 1 }))
        setShowFilters(false)
    }

    const handleClearFilters = () => {
        setFilters({
            orgId: orgId,
            page: 1,
            limit: 50,
            level: '',
            module: '',
            group: '',
            userId: '',
            dateFrom: '',
            dateTo: '',
            search: ''
        })
        setSelectedGroup('')
        setSelectedModule('')
        setCurrentLevel('')
    }

    const handlePageChange = (event, page) => {
        setFilters(prev => ({ ...prev, page }))
    }

    const handleRefresh = () => {
        // Get fresh orgId from store on refresh to ensure we use latest value
        const currentOrgId = AuthUtils.getOrgIdFromStore()
        loadLogs()
        loadStats()
        loadLogGroups()
        // Also refresh filter options to ensure consistency
        loadFilterOptions()
    }

    const handleFilterByModule = (module) => {
        setFilters(prev => ({ ...prev, module, page: 1 }))
    }

    const handleFilterByUser = (userId) => {
        setFilters(prev => ({ ...prev, userId, page: 1 }))
    }

    // Calculate pagination info
    const paginationInfo = useMemo(() => {
        const start = (filters.page - 1) * filters.limit + 1
        const end = Math.min(start + filters.limit - 1, total)
        return { start, end, total }
    }, [filters.page, filters.limit, total])

    if (error) {
        return <ErrorBoundary error={error} />
    }

    return (
        <MainCard>
            <Grid container spacing={3}>
                {/* Header */}
                <Grid item xs={12}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                        <Typography variant="h4" sx={{ fontWeight: 600 }}>
                            Application Logs
                        </Typography>
                        <Stack direction="row" spacing={1.5}>
                            <Tooltip title="Refresh">
                                <IconButton 
                                    onClick={handleRefresh} 
                                    disabled={queryLogsApi.loading}
                                    sx={{
                                        '&:hover': {
                                            backgroundColor: 'action.hover'
                                        }
                                    }}
                                >
                                    <IconRefresh />
                                </IconButton>
                            </Tooltip>
                            <Button
                                variant="contained"
                                startIcon={<IconFilter />}
                                onClick={handleShowFilters}
                                sx={{
                                    textTransform: 'none',
                                    fontWeight: 500,
                                    boxShadow: 2,
                                    '&:hover': {
                                        boxShadow: 4
                                    }
                                }}
                            >
                                Filters
                            </Button>
                            <Tooltip title={drawerExpanded ? "Hide Navigation" : "Show Navigation"}>
                                <IconButton 
                                    onClick={handleToggleDrawer}
                                    sx={{
                                        '&:hover': {
                                            backgroundColor: 'action.hover'
                                        }
                                    }}
                                >
                                    <IconMenu2 />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    </Stack>
                </Grid>

                {/* Main Content */}
                <Grid item xs={12}>
                    <Grid container spacing={gridSpacing}>
                        {/* Navigation Drawer */}
                        {drawerExpanded && (
                            <Grid item xs={12} md={3}>
                                <NavigationDrawer
                                    expanded={drawerExpanded}
                                    onToggle={handleToggleDrawer}
                                    stats={stats}
                                    activeCategory={activeCategory}
                                    onCategoryChange={handleCategoryChange}
                                    selectedGroup={selectedGroup}
                                    selectedModule={selectedModule}
                                    onSelectGroup={handleSelectGroup}
                                    onSelectModule={handleSelectModule}
                                    expandedGroups={expandedGroups}
                                    onToggleGroup={handleToggleGroup}
                                    logGroups={logGroups}
                                    onQuickAction={handleQuickAction}
                                    currentLevel={currentLevel}
                                />
                            </Grid>
                        )}

                        {/* Logs List */}
                        <Grid item xs={12} md={drawerExpanded ? 9 : 12}>
                            <Card sx={{ boxShadow: 3 }}>
                                <CardHeader
                                    title={
                                        <Stack direction="row" alignItems="center" spacing={2}>
                                            <Typography variant="h5" sx={{ fontWeight: 600 }}>
                                                Logs
                                            </Typography>
                                            {total > 0 && (
                                                <Chip
                                                    label={`${paginationInfo.start}-${paginationInfo.end} of ${paginationInfo.total}`}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                    sx={{ fontWeight: 500 }}
                                                />
                                            )}
                                        </Stack>
                                    }
                                    action={
                                        <Button
                                            variant="outlined"
                                            startIcon={<IconDownload />}
                                            size="small"
                                            sx={{
                                                textTransform: 'none',
                                                fontWeight: 500
                                            }}
                                        >
                                            Export
                                        </Button>
                                    }
                                />
                                <CardContent>
                                    {queryLogsApi.loading ? (
                                        <Box 
                                            display="flex" 
                                            flexDirection="column"
                                            justifyContent="center" 
                                            alignItems="center" 
                                            minHeight={300}
                                            gap={2}
                                        >
                                            <CircularProgress size={48} />
                                            <Typography variant="body1" color="textSecondary">
                                                Loading logs...
                                            </Typography>
                                        </Box>
                                    ) : logs.length === 0 ? (
                                        <Box 
                                            display="flex" 
                                            flexDirection="column" 
                                            alignItems="center" 
                                            justifyContent="center" 
                                            minHeight={300}
                                            gap={2}
                                        >
                                            <img
                                                src={LogsEmptySVG}
                                                alt="No logs"
                                                style={{ height: '25vh', width: 'auto', opacity: 0.7 }}
                                            />
                                            <Typography variant="h5" color="textSecondary" sx={{ fontWeight: 500 }}>
                                                No logs found
                                            </Typography>
                                            <Typography variant="body2" color="textSecondary" sx={{ maxWidth: 400, textAlign: 'center' }}>
                                                Try adjusting your filters or check back later for new log entries.
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <>
                                            <LogsList
                                                logs={logs}
                                                loading={queryLogsApi.loading}
                                                onViewLog={handleViewLog}
                                                onFilterByModule={handleFilterByModule}
                                                onFilterByUser={handleFilterByUser}
                                            />
                                            {total > filters.limit && (
                                                <Box 
                                                    display="flex" 
                                                    flexDirection="column"
                                                    alignItems="center"
                                                    justifyContent="center" 
                                                    mt={4}
                                                    gap={2}
                                                >
                                                    <Pagination
                                                        count={Math.ceil(total / filters.limit)}
                                                        page={filters.page}
                                                        onChange={handlePageChange}
                                                        color="primary"
                                                        showFirstButton
                                                        showLastButton
                                                        size="large"
                                                        sx={{
                                                            '& .MuiPaginationItem-root': {
                                                                fontSize: '0.9rem'
                                                            }
                                                        }}
                                                    />
                                                    <Typography variant="body2" color="textSecondary">
                                                        Showing {paginationInfo.start}-{paginationInfo.end} of {paginationInfo.total} logs
                                                    </Typography>
                                                </Box>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>

            {/* Search Filters Modal */}
            <SearchFiltersModal
                open={showFilters}
                filters={filters}
                onClose={handleCloseFilters}
                onApply={handleApplyFilters}
                onClear={handleClearFilters}
                filterOptions={filterOptions}
            />

            {/* Log Details Dialog */}
            <LogDetailsDialog
                log={selectedLog}
                onClose={handleCloseLogDetails}
            />
        </MainCard>
    )
}

export default LogsDashboard
