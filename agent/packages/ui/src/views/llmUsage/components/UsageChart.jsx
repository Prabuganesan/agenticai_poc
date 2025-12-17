import { useMemo } from 'react'
import { Card, CardContent, Typography, Box, useTheme } from '@mui/material'
import {
    LineChart,
    Line,
    AreaChart,
    Area,
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

const COLORS = ['#00acc1', '#3f51b5', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', '#ffc107']

const UsageChart = ({ title, data, type = 'line', dataKey, xAxisKey = 'date', height = 300, showLegend = true, formatValue }) => {
    const theme = useTheme()
    const isDarkMode = theme.palette.mode === 'dark'

    const chartData = useMemo(() => {
        if (!data || !Array.isArray(data)) return []
        return data.map(item => ({
            ...item,
            date: item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : item.date
        }))
    }, [data])

    const renderChart = () => {
        switch (type) {
            case 'area':
                return (
                    <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#424242' : '#e0e0e0'} />
                        <XAxis 
                            dataKey={xAxisKey} 
                            stroke={isDarkMode ? '#bdbdbd' : '#757575'}
                            style={{ fontSize: '0.75rem' }}
                        />
                        <YAxis 
                            stroke={isDarkMode ? '#bdbdbd' : '#757575'}
                            style={{ fontSize: '0.75rem' }}
                            tickFormatter={(value) => formatValue ? formatValue(value) : formatNumber(value)}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
                                border: `1px solid ${isDarkMode ? '#424242' : '#e0e0e0'}`,
                                borderRadius: '8px'
                            }}
                            formatter={(value) => formatValue ? formatValue(value) : formatNumber(value)}
                        />
                        {showLegend && <Legend />}
                        <Area
                            type="monotone"
                            dataKey={dataKey}
                            stroke={theme.palette.primary.main}
                            fill={theme.palette.primary.main}
                            fillOpacity={0.3}
                        />
                    </AreaChart>
                )
            case 'bar':
                return (
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#424242' : '#e0e0e0'} />
                        <XAxis 
                            dataKey={xAxisKey} 
                            stroke={isDarkMode ? '#bdbdbd' : '#757575'}
                            style={{ fontSize: '0.75rem' }}
                        />
                        <YAxis 
                            stroke={isDarkMode ? '#bdbdbd' : '#757575'}
                            style={{ fontSize: '0.75rem' }}
                            tickFormatter={(value) => formatValue ? formatValue(value) : formatNumber(value)}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
                                border: `1px solid ${isDarkMode ? '#424242' : '#e0e0e0'}`,
                                borderRadius: '8px'
                            }}
                            formatter={(value) => formatValue ? formatValue(value) : formatNumber(value)}
                        />
                        {showLegend && <Legend />}
                        <Bar dataKey={dataKey} fill={theme.palette.primary.main} radius={[8, 8, 0, 0]} />
                    </BarChart>
                )
            case 'pie':
                return (
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey={dataKey}
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
                        />
                        {showLegend && <Legend />}
                    </PieChart>
                )
            default: // line
                return (
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#424242' : '#e0e0e0'} />
                        <XAxis 
                            dataKey={xAxisKey} 
                            stroke={isDarkMode ? '#bdbdbd' : '#757575'}
                            style={{ fontSize: '0.75rem' }}
                        />
                        <YAxis 
                            stroke={isDarkMode ? '#bdbdbd' : '#757575'}
                            style={{ fontSize: '0.75rem' }}
                            tickFormatter={(value) => formatValue ? formatValue(value) : formatNumber(value)}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
                                border: `1px solid ${isDarkMode ? '#424242' : '#e0e0e0'}`,
                                borderRadius: '8px'
                            }}
                            formatter={(value) => formatValue ? formatValue(value) : formatNumber(value)}
                        />
                        {showLegend && <Legend />}
                        <Line
                            type="monotone"
                            dataKey={dataKey}
                            stroke={theme.palette.primary.main}
                            strokeWidth={2}
                            dot={{ fill: theme.palette.primary.main, r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                )
        }
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

export default UsageChart

