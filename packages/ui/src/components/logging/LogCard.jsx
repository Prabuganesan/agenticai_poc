import { useState } from 'react'
import PropTypes from 'prop-types'
import {
    Card,
    CardContent,
    CardHeader,
    Typography,
    Chip,
    IconButton,
    Box,
    Stack,
    Collapse,
    Tooltip
} from '@mui/material'
import { styled } from '@mui/material/styles'
import { IconEye, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { formatTimestamp, getRelativeTime, formatLogLevel, truncateMessage } from '@/utils/logUtils'

const StyledCard = styled(Card)(({ theme, level }) => {
    const levelInfo = formatLogLevel(level)
    const levelBgColors = {
        error: 'rgba(244, 67, 54, 0.05)',
        warn: 'rgba(255, 152, 0, 0.05)',
        info: 'rgba(33, 150, 243, 0.05)',
        debug: 'rgba(156, 39, 176, 0.05)',
        verbose: 'rgba(96, 125, 139, 0.05)'
    }
    
    return {
        borderLeft: `4px solid ${levelInfo.borderColor}`,
        marginBottom: theme.spacing(2),
        backgroundColor: levelBgColors[level] || theme.palette.background.paper,
        boxShadow: theme.shadows[2],
        transition: 'all 0.3s ease',
        '&:hover': {
            boxShadow: theme.shadows[6],
            transform: 'translateY(-2px)',
            borderLeftWidth: '6px'
        }
    }
})

const LogCard = ({ log, onView, onFilterByModule, onFilterByUser }) => {
    const [expanded, setExpanded] = useState(false)
    const levelInfo = formatLogLevel(log.level)

    const handleView = () => {
        if (onView) onView(log)
    }

    const handleModuleClick = (e) => {
        e.stopPropagation()
        if (onFilterByModule && log.module) {
            onFilterByModule(log.module)
        }
    }

    const handleUserClick = (e) => {
        e.stopPropagation()
        if (onFilterByUser && log.userId) {
            onFilterByUser(log.userId)
        }
    }

    return (
        <StyledCard level={log.level}>
            <CardHeader
                title={
                    <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                        <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 500 }}>
                            {formatTimestamp(log.timestamp)}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.75rem' }}>
                            ({getRelativeTime(log.timestamp)})
                        </Typography>
                        <Chip
                            label={levelInfo.text}
                            size="small"
                            sx={{
                                backgroundColor: levelInfo.bgColor,
                                color: levelInfo.color,
                                borderColor: levelInfo.borderColor,
                                borderWidth: 1,
                                borderStyle: 'solid',
                                fontWeight: 600,
                                fontSize: '0.7rem',
                                height: '22px'
                            }}
                        />
                        <Box flexGrow={1} />
                        <Tooltip title="View Details">
                            <IconButton 
                                size="small" 
                                onClick={handleView}
                                sx={{
                                    '&:hover': {
                                        backgroundColor: 'action.hover'
                                    }
                                }}
                            >
                                <IconEye size={18} />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                }
            />
            <CardContent>
                <Typography variant="body1" sx={{ mb: 1.5, fontWeight: 400, lineHeight: 1.6 }}>
                    {truncateMessage(log.message, 200)}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                    {log.module && (
                        <Chip
                            label={`Module: ${log.module}`}
                            size="small"
                            variant="outlined"
                            onClick={handleModuleClick}
                            sx={{ 
                                cursor: 'pointer',
                                borderRadius: '12px',
                                '&:hover': {
                                    backgroundColor: 'action.hover'
                                }
                            }}
                        />
                    )}
                    {log.service && (
                        <Chip
                            label={`Service: ${log.service}`}
                            size="small"
                            variant="outlined"
                            sx={{ borderRadius: '12px' }}
                        />
                    )}
                    {log.userId && (
                        <Chip
                            label={`User: ${log.userId}`}
                            size="small"
                            variant="outlined"
                            onClick={handleUserClick}
                            sx={{ 
                                cursor: 'pointer',
                                borderRadius: '12px',
                                '&:hover': {
                                    backgroundColor: 'action.hover'
                                }
                            }}
                        />
                    )}
                    {log.orgId && (
                        <Chip
                            label={`Org: ${log.orgId}`}
                            size="small"
                            variant="outlined"
                            sx={{ borderRadius: '12px' }}
                        />
                    )}
                </Stack>
                {log.sourceFile && (
                    <>
                        <Box mt={1}>
                            <IconButton
                                size="small"
                                onClick={() => setExpanded(!expanded)}
                            >
                                {expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                            </IconButton>
                            <Typography variant="caption" color="textSecondary" component="span" ml={1}>
                                Additional Info
                            </Typography>
                        </Box>
                        <Collapse in={expanded}>
                            <Box mt={1} p={1} bgcolor="background.default" borderRadius={1}>
                                <Typography variant="caption" color="textSecondary">
                                    Source: {log.sourceFile}
                                </Typography>
                            </Box>
                        </Collapse>
                    </>
                )}
            </CardContent>
        </StyledCard>
    )
}

LogCard.propTypes = {
    log: PropTypes.object.isRequired,
    onView: PropTypes.func,
    onFilterByModule: PropTypes.func,
    onFilterByUser: PropTypes.func
}

export default LogCard

