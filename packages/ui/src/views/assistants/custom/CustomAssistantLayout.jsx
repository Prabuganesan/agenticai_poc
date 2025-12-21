import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

// material-ui
import { Box, Stack, Skeleton, Typography, Tabs, Tab, Chip } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import MainCard from '@/ui-component/cards/MainCard'
import ItemCard from '@/ui-component/cards/ItemCard'
import { baseURL, gridSpacing } from '@/store/constant'
import AssistantEmptySVG from '@/assets/images/assistant_empty.svg'
import AddCustomAssistantDialog from './AddCustomAssistantDialog'
import ErrorBoundary from '@/ErrorBoundary'
import { StyledPermissionButton } from '@/ui-component/button/RBACButtons'

// API
import assistantsApi from '@/api/assistants'

// Hooks
import useApi from '@/hooks/useApi'

// icons
import { IconPlus } from '@tabler/icons-react'

// ==============================|| CustomAssistantLayout ||============================== //

const CustomAssistantLayout = () => {
    const navigate = useNavigate()
    const theme = useTheme()
    const currentUser = useSelector((state) => state.auth.user)

    const getAllAssistantsApi = useApi(assistantsApi.getAllAssistants)

    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showDialog, setShowDialog] = useState(false)
    const [dialogProps, setDialogProps] = useState({})

    // Tab state - 0 = My Creations (default), 1 = Others Creations
    const [activeTab, setActiveTab] = useState(0)

    const [search, setSearch] = useState('')
    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }

    const addNew = () => {
        const dialogProp = {
            title: 'Add New Custom Assistant',
            type: 'ADD',
            cancelButtonName: 'Cancel',
            confirmButtonName: 'Add'
        }
        setDialogProps(dialogProp)
        setShowDialog(true)
    }

    const onConfirm = (assistantId) => {
        setShowDialog(false)
        navigate(`/assistants/custom/${assistantId}`)
    }

    function filterAssistants(data) {
        const parsedData = JSON.parse(data.details)
        return parsedData && parsedData.name && parsedData.name.toLowerCase().indexOf(search.toLowerCase()) > -1
    }

    // Split assistants into my creation and others creation
    const getMyAssistants = (data) => {
        if (!data || !currentUser) return []
        const currentUserId = Number(currentUser.id)
        const myAssistants = data.filter((assistant) => Number(assistant.created_by) === currentUserId)
        return search ? myAssistants.filter(filterAssistants) : myAssistants
    }

    const getSharedAssistants = (data) => {
        if (!data || !currentUser) return []
        const currentUserId = Number(currentUser.id)
        const sharedAssistants = data.filter((assistant) => Number(assistant.created_by) !== currentUserId)
        return search ? sharedAssistants.filter(filterAssistants) : sharedAssistants
    }

    const getImages = (details) => {
        const images = []
        if (details && details.chatModel && details.chatModel.name) {
            images.push({
                imageSrc: `${baseURL}/api/v1/node-icon/${details.chatModel.name}`
            })
        }
        return images
    }

    useEffect(() => {
        getAllAssistantsApi.request('CUSTOM')

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        setLoading(getAllAssistantsApi.loading)
    }, [getAllAssistantsApi.loading])

    useEffect(() => {
        if (getAllAssistantsApi.error) {
            setError(getAllAssistantsApi.error)
        }
    }, [getAllAssistantsApi.error])

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

    // Get filtered and split data
    const allData = getAllAssistantsApi.data || []
    const myAssistants = getMyAssistants(allData)
    const sharedAssistants = getSharedAssistants(allData)
    const hasResults = myAssistants.length > 0 || sharedAssistants.length > 0

    return (
        <>
            <MainCard>
                {error ? (
                    <ErrorBoundary error={error} />
                ) : (
                    <Stack flexDirection='column' sx={{ gap: 3 }}>
                        <ViewHeader
                            isBackButton={true}
                            onSearchChange={onSearchChange}
                            search={true}
                            searchPlaceholder='Search Assistants'
                            title='Custom Assistant'
                            description='Create custom assistants with your choice of LLMs'
                            onBack={() => navigate(-1)}
                        >
                            <StyledPermissionButton
                                permissionId={'assistants:create'}
                                variant='contained'
                                sx={{ borderRadius: 2, height: 40 }}
                                onClick={addNew}
                                startIcon={<IconPlus />}
                            >
                                Add
                            </StyledPermissionButton>
                        </ViewHeader>
                        {isLoading ? (
                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                <Skeleton variant='rounded' height={160} />
                                <Skeleton variant='rounded' height={160} />
                                <Skeleton variant='rounded' height={160} />
                            </Box>
                        ) : (
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
                                        <Tab label={<TabLabel label="My Creations" count={myAssistants.length} />} />
                                        <Tab label={<TabLabel label="Others Creations" count={sharedAssistants.length} />} />
                                    </Tabs>
                                </Box>

                                {/* My Creations Tab Content */}
                                {activeTab === 0 && (
                                    <Box>
                                        {myAssistants.length > 0 ? (
                                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                                {myAssistants.map((data, index) => (
                                                    <ItemCard
                                                        key={data.id || index}
                                                        data={{
                                                            name: JSON.parse(data.details)?.name,
                                                            description: JSON.parse(data.details)?.instruction
                                                        }}
                                                        images={getImages(JSON.parse(data.details))}
                                                        onClick={() => navigate('/assistants/custom/' + data.id)}
                                                    />
                                                ))}
                                            </Box>
                                        ) : (
                                            <Typography
                                                sx={{
                                                    color: theme.palette.text.secondary,
                                                    pl: 2,
                                                    pb: 2,
                                                    fontStyle: 'italic'
                                                }}
                                            >
                                                {search ? 'No matching assistants found in your creations' : 'No assistants created by you yet'}
                                            </Typography>
                                        )}
                                    </Box>
                                )}

                                {/* Others Creations Tab Content */}
                                {activeTab === 1 && (
                                    <Box>
                                        {sharedAssistants.length > 0 ? (
                                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                                {sharedAssistants.map((data, index) => (
                                                    <ItemCard
                                                        key={data.id || index}
                                                        data={{
                                                            name: JSON.parse(data.details)?.name,
                                                            description: JSON.parse(data.details)?.instruction
                                                        }}
                                                        images={getImages(JSON.parse(data.details))}
                                                        onClick={() => navigate('/assistants/custom/' + data.id)}
                                                    />
                                                ))}
                                            </Box>
                                        ) : (
                                            <Typography
                                                sx={{
                                                    color: theme.palette.text.secondary,
                                                    pl: 2,
                                                    pb: 2,
                                                    fontStyle: 'italic'
                                                }}
                                            >
                                                {search ? 'No matching shared assistants found' : 'No shared assistants available'}
                                            </Typography>
                                        )}
                                    </Box>
                                )}
                            </>
                        )}
                        {!isLoading && (!getAllAssistantsApi.data || getAllAssistantsApi.data.length === 0) && (
                            <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                <Box sx={{ p: 2, height: 'auto' }}>
                                    <img
                                        style={{ objectFit: 'cover', height: '20vh', width: 'auto' }}
                                        src={AssistantEmptySVG}
                                        alt='AssistantEmptySVG'
                                    />
                                </Box>
                                <div>No Custom Assistants Added Yet</div>
                            </Stack>
                        )}
                    </Stack>
                )}
            </MainCard>
            <AddCustomAssistantDialog
                show={showDialog}
                dialogProps={dialogProps}
                onCancel={() => setShowDialog(false)}
                onConfirm={onConfirm}
                setError={setError}
            ></AddCustomAssistantDialog>
        </>
    )
}

export default CustomAssistantLayout
