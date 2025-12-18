import PropTypes from 'prop-types'
import { Box, CircularProgress, Typography } from '@mui/material'
import LogCard from './LogCard'

const LogsList = ({ logs, loading, onViewLog, onFilterByModule, onFilterByUser }) => {
    if (loading) {
        return (
            <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight={300} gap={2}>
                <CircularProgress size={48} />
                <Typography variant="body1" color="textSecondary">
                    Loading logs...
                </Typography>
            </Box>
        )
    }

    if (!logs || logs.length === 0) {
        return (
            <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight={300} gap={2}>
                <Typography variant="h6" color="textSecondary" sx={{ fontWeight: 500 }}>
                    No logs found
                </Typography>
                <Typography variant="body2" color="textSecondary">
                    Try adjusting your filters to see more results.
                </Typography>
            </Box>
        )
    }

    return (
        <Box sx={{ py: 1 }}>
            {logs.map((log, index) => (
                <LogCard
                    key={index}
                    log={log}
                    onView={onViewLog}
                    onFilterByModule={onFilterByModule}
                    onFilterByUser={onFilterByUser}
                />
            ))}
        </Box>
    )
}

LogsList.propTypes = {
    logs: PropTypes.array.isRequired,
    loading: PropTypes.bool,
    onViewLog: PropTypes.func.isRequired,
    onFilterByModule: PropTypes.func,
    onFilterByUser: PropTypes.func
}

export default LogsList

