import { Box, FormControl, InputLabel, MenuItem, Select, TextField, Button, IconButton, Tooltip } from '@mui/material'
import { useState, useEffect } from 'react'
import { IconX } from '@tabler/icons-react'

const FilterBar = ({ filters, onFilterChange, providers = [], models = [], features = [] }) => {
    const [localFilters, setLocalFilters] = useState(filters || {})

    useEffect(() => {
        setLocalFilters(filters || {})
    }, [filters])

    const handleChange = (key, value) => {
        const newFilters = { ...localFilters, [key]: value || undefined }
        setLocalFilters(newFilters)
        onFilterChange(newFilters)
    }

    const handleClear = () => {
        setLocalFilters({})
        onFilterChange({})
    }

    const hasFilters = Object.keys(localFilters).some(key => localFilters[key] !== undefined && localFilters[key] !== '')

    return (
        <Box
            display="flex"
            gap={2}
            flexWrap="wrap"
            alignItems="center"
            sx={{
                p: 2,
                bgcolor: 'background.paper',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: 1
            }}
        >
            <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Provider</InputLabel>
                <Select
                    value={localFilters.provider || ''}
                    label="Provider"
                    onChange={(e) => handleChange('provider', e.target.value)}
                >
                    <MenuItem value="">All Providers</MenuItem>
                    {providers.map((provider) => (
                        <MenuItem key={provider} value={provider}>
                            {provider}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Model</InputLabel>
                <Select
                    value={localFilters.model || ''}
                    label="Model"
                    onChange={(e) => handleChange('model', e.target.value)}
                >
                    <MenuItem value="">All Models</MenuItem>
                    {models.map((model) => (
                        <MenuItem key={model} value={model}>
                            {model}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Feature</InputLabel>
                <Select
                    value={localFilters.feature || ''}
                    label="Feature"
                    onChange={(e) => handleChange('feature', e.target.value)}
                >
                    <MenuItem value="">All Features</MenuItem>
                    {features.map((feature) => (
                        <MenuItem key={feature} value={feature}>
                            {feature}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                    value={localFilters.success === undefined ? '' : localFilters.success ? 'true' : 'false'}
                    label="Status"
                    onChange={(e) => {
                        const val = e.target.value
                        handleChange('success', val === '' ? undefined : val === 'true')
                    }}
                >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="true">Success</MenuItem>
                    <MenuItem value="false">Failed</MenuItem>
                </Select>
            </FormControl>

            <TextField
                size="small"
                label="Request ID"
                value={localFilters.requestId || ''}
                onChange={(e) => handleChange('requestId', e.target.value)}
                sx={{ minWidth: 200 }}
            />

            {hasFilters && (
                <Tooltip title="Clear all filters">
                    <IconButton onClick={handleClear} size="small" color="error">
                        <IconX />
                    </IconButton>
                </Tooltip>
            )}
        </Box>
    )
}

export default FilterBar

