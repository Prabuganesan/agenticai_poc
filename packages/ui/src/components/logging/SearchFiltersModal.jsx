import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Stack,
    Box,
    IconButton,
    Typography
} from '@mui/material'
import { IconX } from '@tabler/icons-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

const SearchFiltersModal = ({ open, filters, onClose, onApply, onClear, filterOptions }) => {
    const portalElement = document.getElementById('portal')
    const [localFilters, setLocalFilters] = useState(filters)

    useEffect(() => {
        if (open) {
            setLocalFilters(filters)
        }
    }, [open, filters])

    const handleChange = (field, value) => {
        setLocalFilters(prev => ({ ...prev, [field]: value }))
    }

    const handleApply = () => {
        onApply(localFilters)
    }

    const handleClear = () => {
        const clearedFilters = {
            orgId: filters.orgId,
            page: 1,
            limit: 50,
            level: '',
            module: '',
            group: '',
            userId: '',
            dateFrom: '',
            dateTo: '',
            search: ''
        }
        setLocalFilters(clearedFilters)
        onClear()
    }

    const component = (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            aria-labelledby="filters-dialog-title"
        >
            <DialogTitle id="filters-dialog-title">
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6">Search Filters</Typography>
                    <IconButton onClick={onClose} size="small">
                        <IconX />
                    </IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={3}>
                    {/* Search */}
                    <TextField
                        label="Search"
                        value={localFilters.search || ''}
                        onChange={(e) => handleChange('search', e.target.value)}
                        placeholder="Search in messages and context..."
                        fullWidth
                    />

                    {/* Level */}
                    <FormControl fullWidth>
                        <InputLabel>Level</InputLabel>
                        <Select
                            value={localFilters.level || ''}
                            onChange={(e) => handleChange('level', e.target.value)}
                            label="Level"
                        >
                            <MenuItem value="">All Levels</MenuItem>
                            {filterOptions?.levels?.map((level) => (
                                <MenuItem key={level.level} value={level.level}>
                                    {level.level} ({level.count})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Module */}
                    <FormControl fullWidth>
                        <InputLabel>Module</InputLabel>
                        <Select
                            value={localFilters.module || ''}
                            onChange={(e) => handleChange('module', e.target.value)}
                            label="Module"
                        >
                            <MenuItem value="">All Modules</MenuItem>
                            {filterOptions?.modules?.map((module) => (
                                <MenuItem key={module.module} value={module.module}>
                                    {module.module} ({module.count})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Service */}
                    <FormControl fullWidth>
                        <InputLabel>Service</InputLabel>
                        <Select
                            value={localFilters.service || ''}
                            onChange={(e) => handleChange('service', e.target.value)}
                            label="Service"
                        >
                            <MenuItem value="">All Services</MenuItem>
                            {filterOptions?.services?.map((service) => (
                                <MenuItem key={service.service} value={service.service}>
                                    {service.service} ({service.count})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* User ID */}
                    <TextField
                        label="User ID"
                        value={localFilters.userId || ''}
                        onChange={(e) => handleChange('userId', e.target.value)}
                        placeholder="Filter by user ID..."
                        fullWidth
                    />

                    {/* Date From */}
                    <Box>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                            Date From
                        </Typography>
                        <DatePicker
                            selected={localFilters.dateFrom ? new Date(localFilters.dateFrom) : null}
                            onChange={(date) => handleChange('dateFrom', date ? date.toISOString() : '')}
                            showTimeSelect
                            timeFormat="HH:mm"
                            timeIntervals={15}
                            dateFormat="yyyy-MM-dd HH:mm"
                            placeholderText="Select start date"
                            className="date-picker-input"
                            style={{ width: '100%', padding: '8px' }}
                        />
                    </Box>

                    {/* Date To */}
                    <Box>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                            Date To
                        </Typography>
                        <DatePicker
                            selected={localFilters.dateTo ? new Date(localFilters.dateTo) : null}
                            onChange={(date) => handleChange('dateTo', date ? date.toISOString() : '')}
                            showTimeSelect
                            timeFormat="HH:mm"
                            timeIntervals={15}
                            dateFormat="yyyy-MM-dd HH:mm"
                            placeholderText="Select end date"
                            minDate={localFilters.dateFrom ? new Date(localFilters.dateFrom) : null}
                            className="date-picker-input"
                            style={{ width: '100%', padding: '8px' }}
                        />
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClear} color="error">
                    Clear All
                </Button>
                <Box flexGrow={1} />
                <Button onClick={onClose} variant="outlined">
                    Cancel
                </Button>
                <Button onClick={handleApply} variant="contained">
                    Apply Filters
                </Button>
            </DialogActions>
        </Dialog>
    )

    return portalElement ? createPortal(component, portalElement) : component
}

SearchFiltersModal.propTypes = {
    open: PropTypes.bool.isRequired,
    filters: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
    onApply: PropTypes.func.isRequired,
    onClear: PropTypes.func.isRequired,
    filterOptions: PropTypes.object
}

export default SearchFiltersModal

