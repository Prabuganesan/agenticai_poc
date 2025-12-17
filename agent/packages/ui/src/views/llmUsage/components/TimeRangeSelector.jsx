import { Box, Button, ButtonGroup, TextField } from '@mui/material'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useState, useEffect } from 'react'

const TimeRangeSelector = ({ value, onChange, onCustomRangeChange, customDateRange = {} }) => {
    const [showCustomPicker, setShowCustomPicker] = useState(value === 'custom')

    const handleRangeChange = (range) => {
        onChange(range)
        if (range === 'custom') {
            setShowCustomPicker(true)
        } else {
            setShowCustomPicker(false)
            // Clear custom dates when switching away from custom
            if (onCustomRangeChange) {
                onCustomRangeChange({})
            }
        }
    }

    // Update showCustomPicker when value changes externally
    useEffect(() => {
        setShowCustomPicker(value === 'custom')
    }, [value])

    return (
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            <ButtonGroup variant="outlined" size="small">
                <Button
                    variant={value === 'today' ? 'contained' : 'outlined'}
                    onClick={() => handleRangeChange('today')}
                >
                    Today
                </Button>
                <Button
                    variant={value === 'week' ? 'contained' : 'outlined'}
                    onClick={() => handleRangeChange('week')}
                >
                    This Week
                </Button>
                <Button
                    variant={value === 'month' ? 'contained' : 'outlined'}
                    onClick={() => handleRangeChange('month')}
                >
                    This Month
                </Button>
                <Button
                    variant={value === 'custom' ? 'contained' : 'outlined'}
                    onClick={() => handleRangeChange('custom')}
                >
                    Custom
                </Button>
            </ButtonGroup>

            {showCustomPicker && (
                <Box display="flex" gap={1} alignItems="center">
                    <DatePicker
                        selected={customDateRange.startDate || null}
                        onChange={(date) => {
                            if (onCustomRangeChange) {
                                onCustomRangeChange({
                                    ...customDateRange,
                                    startDate: date
                                })
                            }
                        }}
                        selectsStart
                        startDate={customDateRange.startDate || null}
                        endDate={customDateRange.endDate || null}
                        customInput={<TextField size="small" label="Start Date" />}
                    />
                    <DatePicker
                        selected={customDateRange.endDate || null}
                        onChange={(date) => {
                            if (onCustomRangeChange) {
                                onCustomRangeChange({
                                    ...customDateRange,
                                    endDate: date
                                })
                            }
                        }}
                        selectsEnd
                        startDate={customDateRange.startDate || null}
                        endDate={customDateRange.endDate || null}
                        minDate={customDateRange.startDate || null}
                        customInput={<TextField size="small" label="End Date" />}
                    />
                </Box>
            )}
        </Box>
    )
}

export default TimeRangeSelector

