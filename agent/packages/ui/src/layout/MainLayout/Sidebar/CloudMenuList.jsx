import { useSelector } from 'react-redux'

// material-ui
import { Divider, Box, List, ListItemButton, ListItemIcon, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import { useConfig } from '@/store/context/ConfigContext'
import { getAutonomousDocsPath } from '@/store/constant'

// icons
import { IconFileText } from '@tabler/icons-react'

const CloudMenuList = () => {
    const customization = useSelector((state) => state.customization)
    const theme = useTheme()

    const { isCloud } = useConfig()

    return (
        <>
            {isCloud && (
                <Box>
                    <Divider sx={{ height: '1px', borderColor: theme.palette.grey[900] + 25, my: 0 }} />
                    <List sx={{ p: '16px', py: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <a href={getAutonomousDocsPath()} target='_blank' rel='noreferrer' style={{ textDecoration: 'none' }}>
                            <ListItemButton
                                sx={{
                                    borderRadius: `${customization.borderRadius}px`,
                                    alignItems: 'flex-start',
                                    backgroundColor: 'inherit',
                                    py: 1.25,
                                    pl: '24px'
                                }}
                            >
                                <ListItemIcon sx={{ my: 'auto', minWidth: 36 }}>
                                    <IconFileText size='1.3rem' strokeWidth='1.5' />
                                </ListItemIcon>
                                <Typography variant='body1' color='inherit' sx={{ my: 0.5 }}>
                                    Documentation
                                </Typography>
                            </ListItemButton>
                        </a>
                    </List>
                </Box>
            )}
        </>
    )
}

export default CloudMenuList
