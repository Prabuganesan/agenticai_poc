import { useEffect, useState, useMemo } from 'react'
import { Box, Grid, Typography } from '@mui/material'
import useApi from '@/hooks/useApi'
import llmUsageApi from '@/api/llmUsage'
import AuthUtils from '@/utils/authUtils'
import MetricCard from './components/MetricCard'
import TimeRangeSelector from './components/TimeRangeSelector'
import FilterBar from './components/FilterBar'
import UsageChart from './components/UsageChart'
import DistributionChart from './components/DistributionChart'
import { formatNumber, formatCurrency, getTimeRange, dateToISO } from './utils'

const Overview = () => {
    // Get orgId from kodivianStore (encrypted, in-memory) - this is the source of truth
    const orgId = useMemo(() => {
        const orgIdValue = AuthUtils.getOrgIdFromStore()
        console.log('[LLM Usage Overview] orgId from kodivianStore:', orgIdValue)
        return orgIdValue
    }, [])

    const [timeRange, setTimeRange] = useState('month')
    const [customDateRange, setCustomDateRange] = useState({})
    const [filters, setFilters] = useState({})
    const [providers, setProviders] = useState([])
    const [models, setModels] = useState([])
    const [features, setFeatures] = useState([])

    const { startDate, endDate } = getTimeRange(timeRange, customDateRange.startDate, customDateRange.endDate)

    const getStatsApi = useApi(llmUsageApi.getStats)
    const getFiltersApi = useApi(llmUsageApi.getFilters)
    const getTimeSeriesApi = useApi(llmUsageApi.getTimeSeries)

    // Debug: Log when component mounts and orgId changes
    useEffect(() => {
        console.log('[LLM Usage Overview] Component mounted/updated. orgId:', orgId)
    }, [orgId])

    useEffect(() => {
        console.log('[LLM Usage Overview] useEffect triggered. orgId:', orgId, 'timeRange:', timeRange)
        if (orgId) {
            console.log('[LLM Usage Overview] orgId exists, calling loadStats...')
            loadStats()
            loadFilters()
            loadTimeSeries()
        } else {
            console.warn('[LLM Usage Overview] orgId is missing, cannot load stats')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgId, timeRange, customDateRange.startDate, customDateRange.endDate, filters.provider, filters.model, filters.feature])

    const loadFilters = async () => {
        if (!orgId) return
        try {
            const response = await getFiltersApi.request({ orgId })
            if (response && response.data) {
                setProviders(response.data.providers || [])
                setModels(response.data.models || [])
                setFeatures(response.data.features || [])
            }
        } catch (error) {
            console.error('Error loading filters:', error)
        }
    }

    const loadStats = async () => {
        if (!orgId) {
            console.warn('[LLM Usage Overview] No orgId found in kodivianStore')
            return
        }

        console.log('[LLM Usage Overview] Loading stats with orgId:', orgId, 'filters:', filters)
        try {
            const statsFilters = {
                orgId,
                startDate: dateToISO(startDate),
                endDate: dateToISO(endDate),
                ...filters
            }
            console.log('[LLM Usage Overview] Requesting stats with filters:', statsFilters)
            await getStatsApi.request(statsFilters)
            console.log('[LLM Usage Overview] Stats loaded:', getStatsApi.data)
        } catch (error) {
            console.error('Error loading stats:', error)
        }
    }

    const loadTimeSeries = async () => {
        if (!orgId) return
        try {
            const timeSeriesFilters = {
                orgId,
                startDate: dateToISO(startDate),
                endDate: dateToISO(endDate),
                ...filters
            }
            await getTimeSeriesApi.request(timeSeriesFilters)
        } catch (error) {
            console.error('Error loading time-series data:', error)
        }
    }

    const stats = getStatsApi.data || {}
    const timeSeriesData = getTimeSeriesApi.data || []
    const loading = getStatsApi.loading || getTimeSeriesApi.loading

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
                <Typography variant="h4" fontWeight={600}>
                    LLM Usage Overview
                </Typography>
                <TimeRangeSelector
                    value={timeRange}
                    onChange={setTimeRange}
                    onCustomRangeChange={setCustomDateRange}
                    customDateRange={customDateRange}
                />
            </Box>

            <FilterBar
                filters={filters}
                onFilterChange={setFilters}
                providers={providers}
                models={models}
                features={features}
            />

            {loading ? (
                <Box p={4} textAlign="center">
                    <Typography>Loading statistics...</Typography>
                </Box>
            ) : (
                <Grid container spacing={3} sx={{ mt: 1 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <MetricCard
                            title="Total Requests"
                            value={formatNumber(stats.totalRequests || 0)}
                            subtitle="API calls made"
                            icon="📊"
                            color="primary"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <MetricCard
                            title="Total Tokens"
                            value={formatNumber(stats.totalTokens || 0)}
                            subtitle={`${formatNumber(stats.totalPromptTokens || 0)} prompt + ${formatNumber(stats.totalCompletionTokens || 0)} completion`}
                            icon="🪙"
                            color="info"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <MetricCard
                            title="Total Cost"
                            value={formatCurrency(stats.totalCost || 0)}
                            subtitle="Estimated cost"
                            icon="💰"
                            color="success"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <MetricCard
                            title="Success Rate"
                            value={`${(stats.successRate || 0).toFixed(1)}%`}
                            subtitle={`Avg: ${(stats.averageProcessingTime || 0).toFixed(0)}ms`}
                            icon="✅"
                            color="warning"
                        />
                    </Grid>

                    {/* Time Series Charts */}
                    <Grid container spacing={3} sx={{ mt: 2 }}>
                        <Grid item xs={12} md={6}>
                            <UsageChart
                                title="Requests Over Time"
                                data={timeSeriesData}
                                type="area"
                                dataKey="requests"
                                height={300}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <UsageChart
                                title="Cost Over Time"
                                data={timeSeriesData}
                                type="area"
                                dataKey="cost"
                                height={300}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <UsageChart
                                title="Tokens Over Time"
                                data={timeSeriesData}
                                type="line"
                                dataKey="tokens"
                                height={300}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <UsageChart
                                title="Token Breakdown Over Time"
                                data={timeSeriesData}
                                type="line"
                                dataKey="promptTokens"
                                height={300}
                                showLegend={true}
                            />
                        </Grid>
                    </Grid>

                    {/* Distribution Charts */}
                    <Grid container spacing={3} sx={{ mt: 2 }}>
                        <Grid item xs={12} md={4}>
                            <DistributionChart
                                title="Requests by Provider"
                                data={stats.byProvider || {}}
                                type="bar"
                                valueKey="requests"
                                labelKey="provider"
                                height={300}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <DistributionChart
                                title="Cost by Provider"
                                data={stats.byProvider || {}}
                                type="pie"
                                valueKey="cost"
                                labelKey="provider"
                                height={300}
                                formatValue={formatCurrency}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <DistributionChart
                                title="Requests by Feature"
                                data={stats.byFeature || {}}
                                type="bar"
                                valueKey="requests"
                                labelKey="feature"
                                height={300}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <DistributionChart
                                title="Top Models by Requests"
                                data={stats.byModel || {}}
                                type="bar"
                                valueKey="requests"
                                labelKey="model"
                                height={300}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <DistributionChart
                                title="Top Models by Cost"
                                data={stats.byModel || {}}
                                type="bar"
                                valueKey="cost"
                                labelKey="model"
                                height={300}
                                formatValue={formatCurrency}
                            />
                        </Grid>
                    </Grid>
                </Grid>
            )}
        </Box>
    )
}

export default Overview

