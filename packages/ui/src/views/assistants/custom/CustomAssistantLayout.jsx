import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

// material-ui
import { Box, Stack, Skeleton, Typography, Collapse, IconButton } from '@mui/material'
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
import { IconPlus, IconChevronDown, IconChevronRight } from '@tabler/icons-react'

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

    // Section collapse states
    const [myAssistantsOpen, setMyAssistantsOpen] = useState(true)
    const [sharedAssistantsOpen, setSharedAssistantsOpen] = useState(true)

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

    // Section header component
    const SectionHeader = ({ title, count, isOpen, onToggle }) => (
        <Box
            onClick={onToggle}
            sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                py: 1.5,
                px: 2.5,
                mb: 2,
                borderRadius: 1.5,
                backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[50],
                border: `1px solid ${theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[200]}`,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[100],
                    borderColor: theme.palette.mode === 'dark' ? theme.palette.grey[600] : theme.palette.grey[300]
                }
            }}
        >
            <IconButton 
                size="small" 
                sx={{ 
                    mr: 1.5, 
                    p: 0.5,
                    color: theme.palette.text.secondary,
                    '&:hover': {
                        backgroundColor: 'transparent'
                    }
                }}
            >
                {isOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
            </IconButton>
            <Typography 
                variant="h5" 
                sx={{ 
                    fontWeight: 600, 
                    flex: 1,
                    color: theme.palette.text.primary
                }}
            >
                {title}
            </Typography>
            <Box
                sx={{
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    minWidth: '32px',
                    textAlign: 'center'
                }}
            >
                {count}
            </Box>
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
                                {/* My Creation Section */}
                                {(myAssistants.length > 0 || !search) && (
                                    <Box>
                                        <SectionHeader
                                            title="My Creation"
                                            count={myAssistants.length}
                                            isOpen={myAssistantsOpen}
                                            onToggle={() => setMyAssistantsOpen(!myAssistantsOpen)}
                                        />
                                        <Collapse in={myAssistantsOpen}>
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
                                        </Collapse>
                                    </Box>
                                )}

                                {/* Others Creation Section */}
                                {(sharedAssistants.length > 0 || !search) && (
                                    <Box>
                                        <SectionHeader
                                            title="Others Creation"
                                            count={sharedAssistants.length}
                                            isOpen={sharedAssistantsOpen}
                                            onToggle={() => setSharedAssistantsOpen(!sharedAssistantsOpen)}
                                        />
                                        <Collapse in={sharedAssistantsOpen}>
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
                                        </Collapse>
                                    </Box>
                                )}

                                {/* Show message when search has no results */}
                                {search && !hasResults && allData.length > 0 && (
                                    <Box sx={{ textAlign: 'center', py: 4 }}>
                                        <Typography sx={{ color: theme.palette.text.secondary }}>
                                            No results found matching "{search}"
                                        </Typography>
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
