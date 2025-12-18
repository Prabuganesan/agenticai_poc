import PropTypes from 'prop-types'
import {
    Box,
    Stack,
    Typography,
    Card,
    CardContent,
    Chip,
    List,
    ListItemButton,
    ListItemText,
    Collapse,
    Divider,
    Tabs,
    Tab,
    IconButton,
    Grid
} from '@mui/material'
import { styled } from '@mui/material/styles'
import { 
    IconChevronDown, 
    IconChevronUp, 
    IconChevronLeft, 
    IconFileText, 
    IconAlertCircle, 
    IconClock, 
    IconTrendingUp,
    IconSettings,
    IconHierarchy,
    IconTool,
    IconFiles,
    IconWorld,
    IconBug,
    IconInfoCircle,
    IconAlertTriangle
} from '@tabler/icons-react'
import { formatLogLevel } from '@/utils/logUtils'

const StyledCard = styled(Card)(({ theme }) => ({
    marginBottom: theme.spacing(2),
    backgroundColor: theme.palette.background.paper
}))

const StatCard = styled(Card)(({ theme, color, gradient }) => {
    const gradientColors = {
        blue: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
        red: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
        green: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
        orange: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
    }
    
    return {
        background: gradient ? gradientColors[gradient] || color : color || theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        padding: theme.spacing(2),
        textAlign: 'center',
        borderRadius: theme.shape.borderRadius * 1.5,
        boxShadow: theme.shadows[2],
        transition: 'all 0.3s ease',
        cursor: 'default',
        '&:hover': {
            boxShadow: theme.shadows[4],
            transform: 'translateY(-2px)'
        }
    }
})

const NavigationDrawer = ({
    expanded,
    onToggle,
    stats,
    activeCategory,
    onCategoryChange,
    selectedGroup,
    selectedModule,
    onSelectGroup,
    onSelectModule,
    expandedGroups,
    onToggleGroup,
    logGroups,
    onQuickAction,
    currentLevel
}) => {
    const groupNames = {
        system: 'System',
        workflows: 'Workflows',
        services: 'Services',
        storage: 'Storage',
        infrastructure: 'Infrastructure'
    }

    const groupIcons = {
        system: IconSettings,
        workflows: IconHierarchy,
        services: IconTool,
        storage: IconFiles,
        infrastructure: IconWorld
    }

    const quickActionIcons = {
        error: IconAlertCircle,
        warn: IconAlertTriangle,
        debug: IconBug,
        info: IconInfoCircle,
        '': IconFileText
    }

    const levelColors = {
        error: '#f44336',
        warn: '#ff9800',
        info: '#2196f3',
        debug: '#9c27b0',
        verbose: '#607d8b'
    }

    const quickActions = [
        { level: 'error', label: 'Error Logs', color: levelColors.error },
        { level: 'warn', label: 'Warning Logs', color: levelColors.warn },
        { level: 'debug', label: 'Debug Logs', color: levelColors.debug },
        { level: 'info', label: 'Info Logs', color: levelColors.info },
        { level: '', label: 'All Logs', color: '#4caf50' }
    ]

    return (
        <Box
            sx={{
                width: expanded ? 320 : 0,
                height: '100%',
                backgroundColor: 'background.paper',
                borderRight: '1px solid',
                borderColor: 'divider',
                overflow: 'auto',
                transition: 'width 0.3s'
            }}
        >
            {expanded && (
                <Box p={2}>
                    {/* Collapse Button */}
                    <Box display="flex" justifyContent="flex-end" mb={2}>
                        <IconButton size="small" onClick={onToggle}>
                            <IconChevronLeft />
                        </IconButton>
                    </Box>

                    {/* Statistics Section */}
                    {stats && (
                        <Box mb={3}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                                Statistics
                            </Typography>
                            <Grid container spacing={1.5}>
                                <Grid item xs={6}>
                                    <StatCard gradient="blue">
                                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={0.5}>
                                            <IconFileText size={20} />
                                        </Stack>
                                        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                                            {stats.totalLogs.toLocaleString()}
                                        </Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.7rem' }}>
                                            Total Logs
                                        </Typography>
                                    </StatCard>
                                </Grid>
                                <Grid item xs={6}>
                                    <StatCard gradient="red">
                                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={0.5}>
                                            <IconAlertCircle size={20} />
                                        </Stack>
                                        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                                            {stats.errorRate.toFixed(1)}%
                                        </Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.7rem' }}>
                                            Error Rate
                                        </Typography>
                                    </StatCard>
                                </Grid>
                                <Grid item xs={6}>
                                    <StatCard gradient="green">
                                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={0.5}>
                                            <IconClock size={20} />
                                        </Stack>
                                        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                                            {stats.recentActivity.lastHour.toLocaleString()}
                                        </Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.7rem' }}>
                                            Last Hour
                                        </Typography>
                                    </StatCard>
                                </Grid>
                                <Grid item xs={6}>
                                    <StatCard gradient="orange">
                                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={0.5}>
                                            <IconTrendingUp size={20} />
                                        </Stack>
                                        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                                            {stats.averageLogsPerMinute.toFixed(1)}
                                        </Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.7rem' }}>
                                            Logs/Min
                                        </Typography>
                                    </StatCard>
                                </Grid>
                            </Grid>
                        </Box>
                    )}

                    <Divider sx={{ my: 2 }} />

                    {/* Category Switcher */}
                    <Tabs
                        value={activeCategory}
                        onChange={(e, value) => onCategoryChange(value)}
                        variant="fullWidth"
                        sx={{ mb: 2 }}
                    >
                        <Tab label="Groups & Modules" value="groups" />
                        <Tab label="Quick Actions" value="actions" />
                    </Tabs>

                    {/* Groups Section */}
                    {activeCategory === 'groups' && (
                        <Box>
                            {/* All Groups */}
                            <ListItemButton
                                selected={selectedGroup === '' && selectedModule === ''}
                                onClick={() => {
                                    onSelectGroup('')
                                    onSelectModule('', '')
                                }}
                                sx={{
                                    borderRadius: 1,
                                    mb: 0.5,
                                    '&.Mui-selected': {
                                        backgroundColor: 'primary.main',
                                        color: 'primary.contrastText',
                                        '&:hover': {
                                            backgroundColor: 'primary.dark'
                                        },
                                        '& .MuiListItemText-primary': {
                                            fontWeight: 600
                                        }
                                    },
                                    '&:hover': {
                                        backgroundColor: 'action.hover'
                                    }
                                }}
                            >
                                <ListItemText 
                                    primary="All Groups"
                                    primaryTypographyProps={{
                                        sx: { fontWeight: selectedGroup === '' && selectedModule === '' ? 600 : 400 }
                                    }}
                                />
                            </ListItemButton>

                            {/* Loading State */}
                            {!logGroups && (
                                <Box p={2} textAlign="center">
                                    <Typography variant="body2" color="textSecondary">
                                        Loading groups...
                                    </Typography>
                                </Box>
                            )}

                            {/* Individual Groups */}
                            {logGroups && Object.keys(logGroups).length === 0 && (
                                <Box p={2} textAlign="center">
                                    <Typography variant="body2" color="textSecondary">
                                        No groups available
                                    </Typography>
                                </Box>
                            )}

                            {logGroups && Object.entries(logGroups).map(([groupName, groupData]) => {
                                const isExpanded = expandedGroups.has(groupName)
                                const modules = groupData.modules || {}
                                const GroupIcon = groupIcons[groupName] || IconFileText

                                return (
                                    <Box key={groupName}>
                                        <ListItemButton
                                            selected={selectedGroup === groupName && selectedModule === ''}
                                            onClick={() => {
                                                onToggleGroup(groupName)
                                                onSelectGroup(groupName)
                                                onSelectModule('', groupName)
                                            }}
                                            sx={{
                                                borderRadius: 1,
                                                mb: 0.5,
                                                '&.Mui-selected': {
                                                    backgroundColor: 'primary.main',
                                                    color: 'primary.contrastText',
                                                    '&:hover': {
                                                        backgroundColor: 'primary.dark'
                                                    },
                                                    '& .MuiListItemText-primary': {
                                                        fontWeight: 600
                                                    }
                                                },
                                                '&:hover': {
                                                    backgroundColor: 'action.hover'
                                                }
                                            }}
                                        >
                                            <GroupIcon size={18} style={{ marginRight: 8 }} />
                                            <ListItemText 
                                                primary={groupNames[groupName] || groupName}
                                                primaryTypographyProps={{
                                                    sx: { fontWeight: selectedGroup === groupName && selectedModule === '' ? 600 : 400 }
                                                }}
                                            />
                                            {isExpanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
                                        </ListItemButton>
                                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                            <List component="div" disablePadding>
                                                {Object.entries(modules).map(([moduleName, moduleData]) => (
                                                    <ListItemButton
                                                        key={moduleName}
                                                        selected={selectedModule === moduleName}
                                                        sx={{ 
                                                            pl: 4,
                                                            borderRadius: 1,
                                                            mb: 0.5,
                                                            '&.Mui-selected': {
                                                                backgroundColor: 'primary.light',
                                                                color: 'primary.contrastText',
                                                                '&:hover': {
                                                                    backgroundColor: 'primary.main'
                                                                }
                                                            },
                                                            '&:hover': {
                                                                backgroundColor: 'action.hover'
                                                            }
                                                        }}
                                                        onClick={() => onSelectModule(moduleName, groupName)}
                                                    >
                                                        <ListItemText
                                                            primary={
                                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                                    <Typography 
                                                                        variant="body2"
                                                                        sx={{ 
                                                                            fontWeight: selectedModule === moduleName ? 600 : 400 
                                                                        }}
                                                                    >
                                                                        {moduleName}
                                                                    </Typography>
                                                                    {moduleData.count > 0 && (
                                                                        <Chip
                                                                            label={moduleData.count}
                                                                            size="small"
                                                                            variant="outlined"
                                                                            sx={{ 
                                                                                height: '20px',
                                                                                fontSize: '0.65rem',
                                                                                fontWeight: 600
                                                                            }}
                                                                        />
                                                                    )}
                                                                    {moduleData.enabled ? (
                                                                        <Chip 
                                                                            label="✓" 
                                                                            size="small" 
                                                                            color="success"
                                                                            sx={{ height: '20px', minWidth: '24px' }}
                                                                        />
                                                                    ) : (
                                                                        <Chip 
                                                                            label="✗" 
                                                                            size="small" 
                                                                            color="error"
                                                                            sx={{ height: '20px', minWidth: '24px' }}
                                                                        />
                                                                    )}
                                                                </Stack>
                                                            }
                                                        />
                                                    </ListItemButton>
                                                ))}
                                            </List>
                                        </Collapse>
                                    </Box>
                                )
                            })}
                        </Box>
                    )}

                    {/* Quick Actions Section */}
                    {activeCategory === 'actions' && (
                        <List>
                            {quickActions.map((action) => {
                                const ActionIcon = quickActionIcons[action.level] || IconFileText
                                return (
                                    <ListItemButton
                                        key={action.level}
                                        selected={currentLevel === action.level}
                                        onClick={() => onQuickAction(action.level)}
                                        sx={{
                                            borderLeft: `4px solid ${action.color}`,
                                            borderRadius: 1,
                                            mb: 0.5,
                                            '&.Mui-selected': {
                                                backgroundColor: `${action.color}15`,
                                                '&:hover': {
                                                    backgroundColor: `${action.color}25`
                                                },
                                                '& .MuiListItemText-primary': {
                                                    fontWeight: 600
                                                }
                                            },
                                            '&:hover': {
                                                backgroundColor: `${action.color}10`
                                            }
                                        }}
                                    >
                                        <ActionIcon size={18} style={{ marginRight: 8, color: action.color }} />
                                        <ListItemText 
                                            primary={action.label}
                                            primaryTypographyProps={{
                                                sx: { fontWeight: currentLevel === action.level ? 600 : 400 }
                                            }}
                                        />
                                    </ListItemButton>
                                )
                            })}
                        </List>
                    )}
                </Box>
            )}
        </Box>
    )
}

NavigationDrawer.propTypes = {
    expanded: PropTypes.bool.isRequired,
    onToggle: PropTypes.func.isRequired,
    stats: PropTypes.object,
    activeCategory: PropTypes.oneOf(['groups', 'actions']).isRequired,
    onCategoryChange: PropTypes.func.isRequired,
    selectedGroup: PropTypes.string,
    selectedModule: PropTypes.string,
    onSelectGroup: PropTypes.func.isRequired,
    onSelectModule: PropTypes.func.isRequired,
    expandedGroups: PropTypes.instanceOf(Set).isRequired,
    onToggleGroup: PropTypes.func.isRequired,
    logGroups: PropTypes.object,
    onQuickAction: PropTypes.func.isRequired,
    currentLevel: PropTypes.string
}

export default NavigationDrawer

