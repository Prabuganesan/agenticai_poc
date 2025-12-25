import { useEffect, useState, useMemo } from 'react'
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    IconButton,
    Tooltip,
    Collapse,
    Grid
} from '@mui/material'
import useApi from '@/hooks/useApi'
import llmUsageApi from '@/api/llmUsage'
import AuthUtils from '@/utils/authUtils'
import TimeRangeSelector from './components/TimeRangeSelector'
import FilterBar from './components/FilterBar'
import TablePagination from '@/ui-component/pagination/TablePagination'
import { formatNumber, formatCurrency, formatDate, formatDuration, getTimeRange, dateToISO } from './utils'
import { IconChevronDown, IconChevronUp, IconCopy } from '@tabler/icons-react'

const Transactions = () => {
    // Get orgId from kodivianStore (encrypted, in-memory) - this is the source of truth
    const orgId = useMemo(() => {
        const orgIdValue = AuthUtils.getOrgIdFromStore()
        console.log('[LLM Usage Transactions] orgId from kodivianStore:', orgIdValue)
        return orgIdValue
    }, [])

    const [timeRange, setTimeRange] = useState('month')
    const [customDateRange, setCustomDateRange] = useState({})
    const [filters, setFilters] = useState({})
    const [page, setPage] = useState(1)
    const [limit] = useState(50)
    const [expandedRows, setExpandedRows] = useState(new Set())
    const [providers, setProviders] = useState([])
    const [models, setModels] = useState([])
    const [features, setFeatures] = useState([])

    const { startDate, endDate } = getTimeRange(timeRange, customDateRange.startDate, customDateRange.endDate)

    const queryUsageApi = useApi(llmUsageApi.queryUsage)
    const getFiltersApi = useApi(llmUsageApi.getFilters)

    // Debug: Log when component mounts and orgId changes
    useEffect(() => {
        console.log('[LLM Usage Transactions] Component mounted/updated. orgId:', orgId)
    }, [orgId])

    useEffect(() => {
        console.log('[LLM Usage Transactions] useEffect triggered. orgId:', orgId, 'timeRange:', timeRange, 'page:', page)
        if (orgId) {
            console.log('[LLM Usage Transactions] orgId exists, calling loadTransactions...')
            loadTransactions()
            loadFilters()
        } else {
            console.warn('[LLM Usage Transactions] orgId is missing, cannot load transactions')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgId, timeRange, customDateRange.startDate, customDateRange.endDate, filters.provider, filters.model, filters.feature, filters.success, page])

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

    const loadTransactions = async () => {
        if (!orgId) {
            console.warn('[LLM Usage Transactions] No orgId found in kodivianStore')
            return
        }

        console.log('[LLM Usage Transactions] Loading transactions with orgId:', orgId, 'filters:', filters)
        try {
            const queryFilters = {
                orgId,
                startDate: dateToISO(startDate),
                endDate: dateToISO(endDate),
                page,
                limit,
                ...filters
            }
            console.log('[LLM Usage Transactions] Requesting transactions with filters:', queryFilters)
            await queryUsageApi.request(queryFilters)
            console.log('[LLM Usage Transactions] Transactions loaded:', queryUsageApi.data)
        } catch (error) {
            console.error('Error loading transactions:', error)
        }
    }

    const toggleRow = (id) => {
        const newExpanded = new Set(expandedRows)
        if (newExpanded.has(id)) {
            newExpanded.delete(id)
        } else {
            newExpanded.add(id)
        }
        setExpandedRows(newExpanded)
    }

    const transactions = queryUsageApi.data?.data || []
    const total = queryUsageApi.data?.total || 0
    const loading = queryUsageApi.loading

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
                <Typography variant="h4" fontWeight={600}>
                    LLM Transactions
                </Typography>
                <TimeRangeSelector
                    value={timeRange}
                    onChange={setTimeRange}
                    onCustomRangeChange={setCustomDateRange}
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
                    <Typography>Loading transactions...</Typography>
                </Box>
            ) : (
                <>
                    <TableContainer component={Paper} sx={{ mt: 2 }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell width={50}></TableCell>
                                    <TableCell>Date/Time</TableCell>
                                    <TableCell>Request ID</TableCell>
                                    <TableCell>Feature</TableCell>
                                    <TableCell>Provider</TableCell>
                                    <TableCell>Model</TableCell>
                                    <TableCell align="right">Prompt Tokens</TableCell>
                                    <TableCell align="right">Completion Tokens</TableCell>
                                    <TableCell align="right">Total Tokens</TableCell>
                                    <TableCell align="right">Cost</TableCell>
                                    <TableCell align="right">Time</TableCell>
                                    <TableCell>Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {transactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                                            <Typography color="text.secondary">No transactions found</Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    transactions.map((transaction) => (
                                        <>
                                            <TableRow
                                                key={transaction.id}
                                                hover
                                                sx={{ cursor: 'pointer' }}
                                                onClick={() => toggleRow(transaction.id)}
                                            >
                                                <TableCell>
                                                    <IconButton size="small">
                                                        {expandedRows.has(transaction.id) ? (
                                                            <IconChevronUp size={18} />
                                                        ) : (
                                                            <IconChevronDown size={18} />
                                                        )}
                                                    </IconButton>
                                                </TableCell>
                                                <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                                                <TableCell>
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                            {transaction.requestId?.substring(0, 8)}...
                                                        </Typography>
                                                        <Tooltip title="Copy Request ID">
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    navigator.clipboard.writeText(transaction.requestId)
                                                                }}
                                                            >
                                                                <IconCopy size={14} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip label={transaction.feature} size="small" />
                                                </TableCell>
                                                <TableCell>{transaction.provider}</TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">{transaction.model}</Typography>
                                                </TableCell>
                                                <TableCell align="right">{formatNumber(transaction.promptTokens)}</TableCell>
                                                <TableCell align="right">{formatNumber(transaction.completionTokens)}</TableCell>
                                                <TableCell align="right">{formatNumber(transaction.totalTokens)}</TableCell>
                                                <TableCell align="right">{formatCurrency(transaction.cost)}</TableCell>
                                                <TableCell align="right">{formatDuration(transaction.processingTimeMs)}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={transaction.success ? 'Success' : 'Failed'}
                                                        color={transaction.success ? 'success' : 'error'}
                                                        size="small"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell colSpan={12} sx={{ py: 0 }}>
                                                    <Collapse in={expandedRows.has(transaction.id)} timeout="auto" unmountOnExit>
                                                        <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                                                            <Grid container spacing={2}>
                                                                <Grid item xs={12} md={6}>
                                                                    <Typography variant="subtitle2" gutterBottom>
                                                                        Details
                                                                    </Typography>
                                                                    <Typography variant="body2">
                                                                        <strong>Execution ID:</strong> {transaction.executionId || '-'}
                                                                    </Typography>
                                                                    <Typography variant="body2">
                                                                        <strong>Chatflow ID:</strong> {transaction.chatflowId || '-'}
                                                                    </Typography>
                                                                    <Typography variant="body2">
                                                                        <strong>Node:</strong> {transaction.nodeName || '-'} ({transaction.nodeType || '-'})
                                                                    </Typography>
                                                                    <Typography variant="body2">
                                                                        <strong>Location:</strong> {transaction.location || '-'}
                                                                    </Typography>
                                                                </Grid>
                                                                <Grid item xs={12} md={6}>
                                                                    {transaction.errorMessage && (
                                                                        <Typography variant="subtitle2" gutterBottom color="error">
                                                                            Error
                                                                        </Typography>
                                                                    )}
                                                                    {transaction.errorMessage && (
                                                                        <Typography variant="body2" color="error">
                                                                            {transaction.errorMessage}
                                                                        </Typography>
                                                                    )}
                                                                    {transaction.metadata && (
                                                                        <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                                                                            Metadata
                                                                        </Typography>
                                                                    )}
                                                                    {transaction.metadata && (
                                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                                            {JSON.stringify(transaction.metadata, null, 2)}
                                                                        </Typography>
                                                                    )}
                                                                </Grid>
                                                            </Grid>
                                                        </Box>
                                                    </Collapse>
                                                </TableCell>
                                            </TableRow>
                                        </>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <TablePagination
                        totalItems={total}
                        itemsPerPage={limit}
                        currentPage={page}
                        onPageChange={setPage}
                    />
                </>
            )}
        </Box>
    )
}

export default Transactions

