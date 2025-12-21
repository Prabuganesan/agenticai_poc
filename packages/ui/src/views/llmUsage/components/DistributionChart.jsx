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
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    overflow: 'visible',
                    borderRadius: '24px',
                    border: 'none',
                    background: isDarkMode
                        ? 'rgba(15, 23, 42, 0.6)'
                        : theme.palette.background.paper,
                    backdropFilter: isDarkMode ? 'blur(20px)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',

                    // Gradient Border
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: '24px',
                        padding: '1.5px',
                        background: isDarkMode
                            ? 'linear-gradient(135deg, #06b6d4, #8b5cf6, #ec4899)'
                            : 'linear-gradient(135deg, rgba(37, 99, 235, 0.3), rgba(124, 58, 237, 0.3))',
                        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        WebkitMaskComposite: 'xor',
                        maskComposite: 'exclude',
                        pointerEvents: 'none'
                    },

                    // Neon Glow Shadow
                    boxShadow: isDarkMode
                        ? '0 0 0 1px rgba(255, 255, 255, 0.05), 0 10px 30px -10px rgba(6, 182, 212, 0.15)'
                        : '0 4px 20px rgba(0, 0, 0, 0.05)',

                    '&:hover': {
                        transform: 'translateY(-6px)',
                        boxShadow: isDarkMode
                            ? '0 0 0 1px rgba(255, 255, 255, 0.1), 0 20px 40px -10px rgba(139, 92, 246, 0.3), 0 0 20px rgba(6, 182, 212, 0.2)'
                            : '0 12px 30px rgba(0, 0, 0, 0.1)',
                        '&::before': {
                            background: isDarkMode
                                ? 'linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)'
                                : 'linear-gradient(135deg, #2563eb, #7c3aed)'
                        }
                    },
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
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'visible',
                borderRadius: '24px',
                border: 'none',
                background: isDarkMode
                    ? 'rgba(15, 23, 42, 0.6)'
                    : theme.palette.background.paper,
                backdropFilter: isDarkMode ? 'blur(20px)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',

                // Gradient Border
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: '24px',
                    padding: '1.5px',
                    background: isDarkMode
                        ? 'linear-gradient(135deg, #06b6d4, #8b5cf6, #ec4899)'
                        : 'linear-gradient(135deg, rgba(37, 99, 235, 0.3), rgba(124, 58, 237, 0.3))',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                    pointerEvents: 'none'
                },

                // Neon Glow Shadow
                boxShadow: isDarkMode
                    ? '0 0 0 1px rgba(255, 255, 255, 0.05), 0 10px 30px -10px rgba(6, 182, 212, 0.15)'
                    : '0 4px 20px rgba(0, 0, 0, 0.05)',

                '&:hover': {
                    transform: 'translateY(-6px)',
                    boxShadow: isDarkMode
                        ? '0 0 0 1px rgba(255, 255, 255, 0.1), 0 20px 40px -10px rgba(139, 92, 246, 0.3), 0 0 20px rgba(6, 182, 212, 0.2)'
                        : '0 12px 30px rgba(0, 0, 0, 0.1)',
                    '&::before': {
                        background: isDarkMode
                            ? 'linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)'
                            : 'linear-gradient(135deg, #2563eb, #7c3aed)'
                    }
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

