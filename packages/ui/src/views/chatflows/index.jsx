import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

// material-ui
import { Box, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography, Tabs, Tab, Chip } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ItemCard from '@/ui-component/cards/ItemCard'
import { gridSpacing } from '@/store/constant'
import WorkflowEmptySVG from '@/assets/images/workflow_empty.svg'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import { FlowListTable } from '@/ui-component/table/FlowListTable'
import { StyledPermissionButton } from '@/ui-component/button/RBACButtons'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'
import TablePagination, { DEFAULT_ITEMS_PER_PAGE } from '@/ui-component/pagination/TablePagination'

// API
import chatflowsApi from '@/api/chatflows'

// Hooks
import useApi from '@/hooks/useApi'

// const
import { baseURL } from '@/store/constant'
import { useError } from '@/store/context/ErrorContext'

// icons
import { IconPlus, IconLayoutGrid, IconList } from '@tabler/icons-react'

// ==============================|| CHATFLOWS ||============================== //

const Chatflows = () => {
    const navigate = useNavigate()
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    const currentUser = useSelector((state) => state.auth.user)

    const [isLoading, setLoading] = useState(true)
    const [images, setImages] = useState({})
    const [search, setSearch] = useState('')
    const { error, setError } = useError()

    const getAllChatflowsApi = useApi(chatflowsApi.getAllChatflows)
    const [view, setView] = useState(localStorage.getItem('flowDisplayStyle') || 'card')

    // Tab state - 0 = My Creations (default), 1 = Others Creations
    const [activeTab, setActiveTab] = useState(0)

    /* Table Pagination */
    const [currentPage, setCurrentPage] = useState(1)
    const [pageLimit, setPageLimit] = useState(DEFAULT_ITEMS_PER_PAGE)
    const [total, setTotal] = useState(0)

    const onChange = (page, pageLimit) => {
        setCurrentPage(page)
        setPageLimit(pageLimit)
        applyFilters(page, pageLimit)
    }

    const applyFilters = (page, limit) => {
        const params = {
            page: page || currentPage,
            limit: limit || pageLimit
        }
        getAllChatflowsApi.request(params)
    }

    const handleChange = (event, nextView) => {
        if (nextView === null) return
        localStorage.setItem('flowDisplayStyle', nextView)
        setView(nextView)
    }

    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }

    function filterFlows(data) {
        if (!data) return false
        const searchLower = search.toLowerCase()
        return (
            (data.name && data.name.toLowerCase().indexOf(searchLower) > -1) ||
            (data.category && data.category.toLowerCase().indexOf(searchLower) > -1) ||
            (data.id && data.id.toLowerCase().indexOf(searchLower) > -1)
        )
    }

    // Split flows into my creation and others creation
    const getMyAgents = (data) => {
        if (!data || !currentUser) return []
        const currentUserId = Number(currentUser.id)
        const myFlows = data.filter((flow) => Number(flow.created_by) === currentUserId)
        return search ? myFlows.filter(filterFlows) : myFlows
    }

    const getSharedAgents = (data) => {
        if (!data || !currentUser) return []
        const currentUserId = Number(currentUser.id)
        const sharedFlows = data.filter((flow) => Number(flow.created_by) !== currentUserId)
        return search ? sharedFlows.filter(filterFlows) : sharedFlows
    }

    const addNew = () => {
        navigate('/canvas')
    }

    const goToCanvas = (selectedChatflow) => {
        navigate(`/canvas/${selectedChatflow.id}`)
    }

    useEffect(() => {
        applyFilters(currentPage, pageLimit)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        setLoading(getAllChatflowsApi.loading)
    }, [getAllChatflowsApi.loading])

    useEffect(() => {
        if (getAllChatflowsApi.data) {
            try {
                // Handle both response formats: array or {data: [], total: number}
                const responseData = getAllChatflowsApi.data
                const chatflows = Array.isArray(responseData) ? responseData : (responseData?.data || [])
                const total = Array.isArray(responseData) ? responseData.length : (responseData?.total || 0)
                setTotal(total || 0)
                const images = {}
                if (chatflows && Array.isArray(chatflows)) {
                    for (let i = 0; i < chatflows.length; i += 1) {
                        const flowDataStr = chatflows[i].flowData
                        const flowData = JSON.parse(flowDataStr)
                        const nodes = flowData.nodes || []
                        images[chatflows[i].id] = []
                        for (let j = 0; j < nodes.length; j += 1) {
                            if (nodes[j].data.name === 'stickyNote' || nodes[j].data.name === 'stickyNoteAgentflow') continue
                            const imageSrc = `${baseURL}/api/v1/node-icon/${nodes[j].data.name}`
                            if (!images[chatflows[i].id].some((img) => img.imageSrc === imageSrc)) {
                                images[chatflows[i].id].push({
                                    imageSrc,
                                    label: nodes[j].data.label
                                })
                            }
                        }
                    }
                }
                setImages(images)
            } catch (e) {
                console.error(e)
            }
        }
    }, [getAllChatflowsApi.data])

    // Tab label with count badge
    const TabLabel = ({ label, count }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span>{label}</span>
            <Chip
                label={count}
                size="small"
                sx={{
                    height: 20,
                    minWidth: 28,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText
                }}
            />
        </Box>
    )

    // Get filtered and split data - handle both response formats
    // Support: array, {data: []}, or {data: [], total: number}
    const responseData = getAllChatflowsApi.data
    const allData = Array.isArray(responseData)
        ? responseData
        : (responseData?.data && Array.isArray(responseData.data) ? responseData.data : [])
    const myAgents = getMyAgents(allData)
    const sharedAgents = getSharedAgents(allData)
    const hasResults = myAgents.length > 0 || sharedAgents.length > 0

    return (
        <MainCard>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader
                        onSearchChange={onSearchChange}
                        search={true}
                        searchPlaceholder='Search Name or Category'
                        title='Agent'
                        description='Build intelligent single-agent automations and conversational workflows'
                    >
                        <ToggleButtonGroup
                            sx={{ borderRadius: 2, maxHeight: 40 }}
                            value={view}
                            color='primary'
                            disabled={total === 0}
                            exclusive
                            onChange={handleChange}
                        >
                            <ToggleButton
                                sx={{
                                    borderColor: theme.palette.grey[900] + 25,
                                    borderRadius: 2,
                                    color: customization.isDarkMode ? 'white' : 'inherit'
                                }}
                                variant='contained'
                                value='card'
                                title='Card View'
                            >
                                <IconLayoutGrid />
                            </ToggleButton>
                            <ToggleButton
                                sx={{
                                    borderColor: theme.palette.grey[900] + 25,
                                    borderRadius: 2,
                                    color: customization.isDarkMode ? 'white' : 'inherit'
                                }}
                                variant='contained'
                                value='list'
                                title='List View'
                            >
                                <IconList />
                            </ToggleButton>
                        </ToggleButtonGroup>
                        <StyledPermissionButton
                            permissionId={'chatflows:create'}
                            variant='contained'
                            onClick={addNew}
                            startIcon={<IconPlus />}
                            sx={{ borderRadius: 2, height: 40 }}
                        >
                            Add New
                        </StyledPermissionButton>
                    </ViewHeader>

                    {isLoading && (
                        <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                            <Skeleton variant='rounded' height={160} />
                            <Skeleton variant='rounded' height={160} />
                            <Skeleton variant='rounded' height={160} />
                        </Box>
                    )}
                    {!isLoading && total > 0 && (
                        <>
                            {/* Tab Navigation */}
                            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                                <Tabs
                                    value={activeTab}
                                    onChange={(e, newValue) => setActiveTab(newValue)}
                                    sx={{
                                        minHeight: 48,
                                        '& .MuiTabs-indicator': {
                                            height: 3,
                                            borderRadius: '3px 3px 0 0',
                                            backgroundColor: theme.palette.primary.main
                                        },
                                        '& .MuiTab-root': {
                                            textTransform: 'none',
                                            fontWeight: 600,
                                            fontSize: '0.95rem',
                                            minHeight: 48,
                                            px: 3
                                        }
                                    }}
                                >
                                    <Tab label={<TabLabel label="My Creations" count={myAgents.length} />} />
                                    <Tab label={<TabLabel label="Others Creations" count={sharedAgents.length} />} />
                                </Tabs>
                            </Box>

                            {/* My Creations Tab Content */}
                            {activeTab === 0 && (
                                <Box>
                                    {myAgents.length > 0 ? (
                                        !view || view === 'card' ? (
                                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                                {myAgents.map((data, index) => (
                                                    <ItemCard
                                                        key={data.id || index}
                                                        onClick={() => goToCanvas(data)}
                                                        data={data}
                                                        images={images[data.id]}
                                                    />
                                                ))}
                                            </Box>
                                        ) : (
                                            <FlowListTable
                                                data={myAgents}
                                                images={images}
                                                isLoading={isLoading}
                                                filterFunction={() => true}
                                                updateFlowsApi={getAllChatflowsApi}
                                                setError={setError}
                                                currentPage={currentPage}
                                                pageLimit={pageLimit}
                                            />
                                        )
                                    ) : (
                                        <Typography
                                            sx={{
                                                color: theme.palette.text.secondary,
                                                pl: 2,
                                                pb: 2,
                                                fontStyle: 'italic'
                                            }}
                                        >
                                            {search ? 'No matching agents found in your creations' : 'No agents created by you yet'}
                                        </Typography>
                                    )}
                                </Box>
                            )}

                            {/* Others Creations Tab Content */}
                            {activeTab === 1 && (
                                <Box>
                                    {sharedAgents.length > 0 ? (
                                        !view || view === 'card' ? (
                                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                                {sharedAgents.map((data, index) => (
                                                    <ItemCard
                                                        key={data.id || index}
                                                        onClick={() => goToCanvas(data)}
                                                        data={data}
                                                        images={images[data.id]}
                                                    />
                                                ))}
                                            </Box>
                                        ) : (
                                            <FlowListTable
                                                data={sharedAgents}
                                                images={images}
                                                isLoading={isLoading}
                                                filterFunction={() => true}
                                                updateFlowsApi={getAllChatflowsApi}
                                                setError={setError}
                                                currentPage={currentPage}
                                                pageLimit={pageLimit}
                                            />
                                        )
                                    ) : (
                                        <Typography
                                            sx={{
                                                color: theme.palette.text.secondary,
                                                pl: 2,
                                                pb: 2,
                                                fontStyle: 'italic'
                                            }}
                                        >
                                            {search ? 'No matching shared agents found' : 'No shared agents available'}
                                        </Typography>
                                    )}
                                </Box>
                            )}

                            {/* Pagination and Page Size Controls */}
                            <TablePagination currentPage={currentPage} limit={pageLimit} total={total} onChange={onChange} />
                        </>
                    )}
                    {!isLoading && total === 0 && (
                        <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                            <Box sx={{ p: 2, height: 'auto' }}>
                                <img
                                    style={{ objectFit: 'cover', height: '25vh', width: 'auto' }}
                                    src={WorkflowEmptySVG}
                                    alt='WorkflowEmptySVG'
                                />
                            </Box>
                            <div>No Agents Yet</div>
                        </Stack>
                    )}
                </Stack>
            )}
            <ConfirmDialog />
        </MainCard>
    )
}

export default Chatflows
