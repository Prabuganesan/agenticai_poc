import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'

// material-ui
import { useTheme } from '@mui/material/styles'
import { Box, Drawer, useMediaQuery } from '@mui/material'

// third-party
import PerfectScrollbar from 'react-perfect-scrollbar'
import { BrowserView, MobileView } from 'react-device-detect'

// project imports
import MenuList from './MenuList'
import CloudMenuList from '@/layout/MainLayout/Sidebar/CloudMenuList'

// store
import { drawerWidth, headerHeight } from '@/store/constant'

// ==============================|| SIDEBAR DRAWER ||============================== //

const Sidebar = ({ drawerOpen, drawerToggle, window }) => {
    const theme = useTheme()
    const matchUpMd = useMediaQuery(theme.breakpoints.up('md'))
    const isAuthenticated = useSelector((state) => state.auth.isAuthenticated)

    const drawer = (
        <>
            <Box
                sx={{
                    display: { xs: 'block', md: 'none' },
                    height: '80px'
                }}
            >

            </Box>
            <BrowserView>
                <PerfectScrollbar
                    component='div'
                    style={{
                        height: !matchUpMd ? 'calc(100vh - 56px)' : `calc(100vh - ${headerHeight}px)`,
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    <MenuList />
                    <CloudMenuList />
                </PerfectScrollbar>
            </BrowserView>
            <MobileView>
                <Box sx={{ px: 2 }}>
                    <MenuList />
                    <CloudMenuList />
                </Box>
            </MobileView>
        </>
    )

    const container = window !== undefined ? () => window.document.body : undefined

    return (
        <Box
            component='nav'
            sx={{
                flexShrink: { md: 0 },
                width: matchUpMd ? drawerWidth : 'auto'
            }}
            aria-label='mailbox folders'
        >
            {isAuthenticated && (
                <Drawer
                    container={container}
                    variant={matchUpMd ? 'persistent' : 'temporary'}
                    anchor='left'
                    open={drawerOpen}
                    onClose={drawerToggle}
                    sx={{
                        '& .MuiDrawer-paper': {
                            width: drawerWidth,
                            background: theme.palette.mode === 'dark'
                                ? 'rgba(15, 23, 42, 0.85)'
                                : theme.palette.background.default,
                            backdropFilter: theme.palette.mode === 'dark' ? 'blur(20px)' : 'none',
                            color: theme.palette.text.primary,
                            [theme.breakpoints.up('md')]: {
                                top: `${headerHeight}px`
                            },
                            // Gradient border on the right side
                            borderRight: theme.palette.mode === 'dark'
                                ? '1px solid transparent'
                                : '1px solid',
                            borderImage: theme.palette.mode === 'dark'
                                ? 'linear-gradient(180deg, rgba(6, 182, 212, 0.6), rgba(168, 85, 247, 0.4), rgba(236, 72, 153, 0.3)) 1'
                                : 'none',
                            borderColor: theme.palette.mode === 'dark'
                                ? 'transparent'
                                : theme.palette.grey[200],
                            boxShadow: drawerOpen
                                ? theme.palette.mode === 'dark'
                                    ? '4px 0 40px rgba(6, 182, 212, 0.15), 4px 0 80px rgba(168, 85, 247, 0.1)'
                                    : '4px 0 24px rgba(0, 0, 0, 0.08)'
                                : 'none',
                            transition: theme.transitions.create(['box-shadow', 'border-color'], {
                                duration: theme.transitions.duration.standard
                            })
                        }
                    }}
                    ModalProps={{ keepMounted: true }}
                    color='inherit'
                >
                    {drawer}
                </Drawer>
            )}
        </Box>
    )
}

Sidebar.propTypes = {
    drawerOpen: PropTypes.bool,
    drawerToggle: PropTypes.func,
    window: PropTypes.object
}

export default Sidebar
