import { useMemo } from 'react'
import { Card, CardContent, Typography, Box, useTheme } from '@mui/material'
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts'
import { formatNumber, formatCurrency } from '../utils'

const COLORS = ['#00acc1', '#3f51b5', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', '#ffc107', '#795548', '#607d8b']

const DistributionChart = ({ title, data, type = 'bar', valueKey = 'value', labelKey = 'label', height = 300, formatValue = formatNumber }) => {
    const theme = useTheme()
    const isDarkMode = theme.palette.mode === 'dark'

    const chartData = useMemo(() => {
        if (!data || typeof data !== 'object') return []
        
        return Object.entries(data)
            .map(([key, value]) => {
                let extractedValue = 0
                if (typeof value === 'object' && value !== null) {
                    // Directly access the valueKey property (e.g., 'cost', 'requests', 'tokens')
                    extractedValue = value[valueKey] || 0
                    // Ensure it's a number (handle string decimals from database)
                    if (typeof extractedValue === 'string') {
                        extractedValue = parseFloat(extractedValue) || 0
                    } else {
                        extractedValue = Number(extractedValue) || 0
                    }
                } else {
                    extractedValue = typeof value === 'number' ? value : (parseFloat(value) || 0)
                }
                
                return {
                    [labelKey]: key,
                    [valueKey]: extractedValue
                }
            })
            .sort((a, b) => b[valueKey] - a[valueKey])
            .slice(0, 10) // Top 10 items
    }, [data, valueKey, labelKey])

    const renderChart = () => {
        if (type === 'pie') {
            return (
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ [labelKey]: name, [valueKey]: value, percent }) => 
                            `${name}: ${formatValue(value)} (${(percent * 100).toFixed(0)}%)`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey={valueKey}
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
                            border: `1px solid ${isDarkMode ? '#424242' : '#e0e0e0'}`,
                            borderRadius: '8px'
                        }}
                        formatter={(value) => formatValue(value)}
                    />
                    <Legend />
                </PieChart>
            )
        }

        // Bar chart
        return (
            <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#424242' : '#e0e0e0'} />
                <XAxis 
                    type="number"
                    stroke={isDarkMode ? '#bdbdbd' : '#757575'}
                    style={{ fontSize: '0.75rem' }}
                    tickFormatter={(value) => formatValue(value)}
                />
                <YAxis 
                    type="category"
                    dataKey={labelKey}
                    stroke={isDarkMode ? '#bdbdbd' : '#757575'}
                    style={{ fontSize: '0.75rem' }}
                    width={120}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
                        border: `1px solid ${isDarkMode ? '#424242' : '#e0e0e0'}`,
                        borderRadius: '8px'
                    }}
                    formatter={(value) => formatValue(value)}
                />
                <Bar 
                    dataKey={valueKey} 
                    fill={theme.palette.primary.main} 
                    radius={[0, 8, 8, 0]}
                />
            </BarChart>
        )
    }

    if (chartData.length === 0) {
        return (
            <Card
                sx={{
                    height: '100%',
                    borderRadius: 3,
                    border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    background: isDarkMode 
                        ? 'linear-gradient(145deg, #1e1e1e, #252525)' 
                        : 'linear-gradient(145deg, #ffffff, #f8f9fa)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: height
                }}
            >
                <CardContent>
                    <Typography variant="h6" fontWeight={600} color={isDarkMode ? '#ffffff' : '#212121'}>
                        {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={2}>
                        No data available
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card
            sx={{
                height: '100%',
                borderRadius: 3,
                border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                background: isDarkMode 
                    ? 'linear-gradient(145deg, #1e1e1e, #252525)' 
                    : 'linear-gradient(145deg, #ffffff, #f8f9fa)',
                boxShadow: isDarkMode
                    ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                    : '0 4px 20px rgba(0, 0, 0, 0.08)',
                transition: 'all 0.3s ease',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: isDarkMode
                        ? '0 8px 30px rgba(0, 0, 0, 0.4)'
                        : '0 8px 30px rgba(0, 0, 0, 0.12)'
                }
            }}
        >
            <CardContent>
                <Typography variant="h6" fontWeight={600} mb={2} color={isDarkMode ? '#ffffff' : '#212121'}>
                    {title}
                </Typography>
                <Box sx={{ width: '100%', height }}>
                    <ResponsiveContainer width="100%" height="100%">
                        {renderChart()}
                    </ResponsiveContainer>
                </Box>
            </CardContent>
        </Card>
    )
}

export default DistributionChart

