import { useState } from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import moment from 'moment'
import { styled } from '@mui/material/styles'
import {
    Box,
    Paper,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    useTheme,
    Checkbox
} from '@mui/material'
import { tableCellClasses } from '@mui/material/TableCell'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import StopCircleIcon from '@mui/icons-material/StopCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { IconLoader, IconCircleXFilled } from '@tabler/icons-react'

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: theme.palette.grey[900] + 25,

    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900]
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        height: 64
    }
}))

const StyledTableRow = styled(TableRow)(() => ({
    // hide last border
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

const getIconFromStatus = (state, theme) => {
    switch (state) {
        case 'FINISHED':
            return CheckCircleIcon
        case 'ERROR':
        case 'TIMEOUT':
            return ErrorIcon
        case 'TERMINATED':
            // eslint-disable-next-line react/display-name
            return (props) => {
                const IconWrapper = (props) => <IconCircleXFilled {...props} color={theme.palette.error.main} />
                IconWrapper.displayName = 'TerminatedIcon'
                return <IconWrapper {...props} />
            }
        case 'STOPPED':
            return StopCircleIcon
        case 'INPROGRESS':
            // eslint-disable-next-line react/display-name
            return (props) => {
                const IconWrapper = (props) => (
                    // eslint-disable-next-line
                    <IconLoader {...props} color={theme.palette.warning.dark} className={`spin-animation ${props.className || ''}`} />
                )
                IconWrapper.displayName = 'InProgressIcon'
                return <IconWrapper {...props} />
            }
    }
}

const getIconColor = (state) => {
    switch (state) {
        case 'FINISHED':
            return 'success.dark'
        case 'ERROR':
        case 'TIMEOUT':
            return 'error.main'
        case 'TERMINATED':
        case 'STOPPED':
            return 'error.main'
        case 'INPROGRESS':
            return 'warning.main'
    }
}

export const ExecutionsListTable = ({ data, isLoading, onExecutionRowClick, onSelectionChange }) => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)

    const localStorageKeyOrder = 'executions_order'
    const localStorageKeyOrderBy = 'executions_orderBy'

    // Default to DESC order by createdDate to match backend ordering (latest first)
    // Backend orders by created_on DESC, so frontend should default to createdDate DESC
    // Only use localStorage if it matches our default (createdDate), otherwise use backend default
    const savedOrderBy = localStorage.getItem(localStorageKeyOrderBy)
    const savedOrder = localStorage.getItem(localStorageKeyOrder)
    
    // If saved orderBy is not 'createdDate', ignore localStorage and use backend default
    // This ensures we always match backend ordering unless user explicitly sorted by createdDate
    const defaultOrderBy = savedOrderBy === 'createdDate' ? savedOrderBy : 'createdDate'
    const defaultOrder = (savedOrderBy === 'createdDate' && savedOrder) ? savedOrder : 'desc'
    
    const [order, setOrder] = useState(defaultOrder)
    const [orderBy, setOrderBy] = useState(defaultOrderBy)
    const [selected, setSelected] = useState([])

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc'
        const newOrder = isAsc ? 'desc' : 'asc'
        setOrder(newOrder)
        setOrderBy(property)
        localStorage.setItem(localStorageKeyOrder, newOrder)
        localStorage.setItem(localStorageKeyOrderBy, property)
    }

    const handleSelectAllClick = (event) => {
        if (event.target.checked) {
            const newSelected = data.map((n) => n.id)
            setSelected(newSelected)
            onSelectionChange && onSelectionChange(newSelected)
        } else {
            setSelected([])
            onSelectionChange && onSelectionChange([])
        }
    }

    const handleClick = (event, id) => {
        event.stopPropagation()
        const selectedIndex = selected.indexOf(id)
        let newSelected = []

        if (selectedIndex === -1) {
            newSelected = newSelected.concat(selected, id)
        } else if (selectedIndex === 0) {
            newSelected = newSelected.concat(selected.slice(1))
        } else if (selectedIndex === selected.length - 1) {
            newSelected = newSelected.concat(selected.slice(0, -1))
        } else if (selectedIndex > 0) {
            newSelected = newSelected.concat(selected.slice(0, selectedIndex), selected.slice(selectedIndex + 1))
        }

        setSelected(newSelected)
        onSelectionChange && onSelectionChange(newSelected)
    }

    const isSelected = (id) => selected.indexOf(id) !== -1

    const sortedData = data
        ? [...data].sort((a, b) => {
            if (orderBy === 'name') {
                return order === 'asc' ? (a.name || '').localeCompare(b.name || '') : (b.name || '').localeCompare(a.name || '')
            } else if (orderBy === 'updatedDate') {
                // Use createdDate as fallback if updatedDate is not available
                const dateA = a.updatedDate || a.createdDate
                const dateB = b.updatedDate || b.createdDate
                return order === 'asc'
                    ? new Date(dateA) - new Date(dateB)
                    : new Date(dateB) - new Date(dateA)
            } else if (orderBy === 'createdDate') {
                return order === 'asc'
                    ? new Date(a.createdDate) - new Date(b.createdDate)
                    : new Date(b.createdDate) - new Date(a.createdDate)
            }
            return 0
        })
        : []

    return (
        <>
            <TableContainer sx={{ border: 1, borderColor: theme.palette.grey[900] + 25, borderRadius: 2 }} component={Paper}>
                <Table sx={{ minWidth: 650 }} size='small' aria-label='a dense table'>
                    <TableHead
                        sx={{
                            backgroundColor: customization.isDarkMode ? theme.palette.common.black : theme.palette.grey[100],
                            height: 56
                        }}
                    >
                        <TableRow>
                            <StyledTableCell padding='checkbox'>
                                <Checkbox
                                    color='primary'
                                    indeterminate={selected.length > 0 && selected.length < data.length}
                                    checked={data.length > 0 && selected.length === data.length}
                                    onChange={handleSelectAllClick}
                                    inputProps={{
                                        'aria-label': 'select all executions'
                                    }}
                                />
                            </StyledTableCell>
                            <StyledTableCell>Status</StyledTableCell>
                            <StyledTableCell>
                                <TableSortLabel
                                    active={orderBy === 'updatedDate'}
                                    direction={order}
                                    onClick={() => handleRequestSort('updatedDate')}
                                >
                                    Last Updated
                                </TableSortLabel>
                            </StyledTableCell>
                            <StyledTableCell component='th' scope='row'>
                                <TableSortLabel active={orderBy === 'name'} direction={order} onClick={() => handleRequestSort('name')}>
                                    Agentflow
                                </TableSortLabel>
                            </StyledTableCell>
                            <StyledTableCell>Session</StyledTableCell>
                            <StyledTableCell>
                                <TableSortLabel
                                    active={orderBy === 'createdDate'}
                                    direction={order}
                                    onClick={() => handleRequestSort('createdDate')}
                                >
                                    Created
                                </TableSortLabel>
                            </StyledTableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <>
                                <StyledTableRow>
                                    <StyledTableCell padding='checkbox'>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                </StyledTableRow>
                                <StyledTableRow>
                                    <StyledTableCell padding='checkbox'>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                </StyledTableRow>
                            </>
                        ) : (
                            <>
                                {sortedData.map((row, index) => {
                                    const isItemSelected = isSelected(row.id)
                                    const labelId = `enhanced-table-checkbox-${index}`

                                    return (
                                        <StyledTableRow
                                            hover
                                            key={index}
                                            sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                                        >
                                            <StyledTableCell padding='checkbox'>
                                                <Checkbox
                                                    color='primary'
                                                    checked={isItemSelected}
                                                    onClick={(event) => handleClick(event, row.id)}
                                                    inputProps={{
                                                        'aria-labelledby': labelId
                                                    }}
                                                />
                                            </StyledTableCell>
                                            <StyledTableCell onClick={() => onExecutionRowClick(row)}>
                                                <Box
                                                    component={getIconFromStatus(row.state, theme)}
                                                    className='labelIcon'
                                                    color={getIconColor(row.state)}
                                                />
                                            </StyledTableCell>
                                            <StyledTableCell onClick={() => onExecutionRowClick(row)}>
                                                {row.updatedDate || row.createdDate
                                                    ? moment(row.updatedDate || row.createdDate).format('MMM D, YYYY h:mm A')
                                                    : 'N/A'}
                                            </StyledTableCell>
                                            <StyledTableCell onClick={() => onExecutionRowClick(row)}>
                                                {row.agentflow?.name}
                                            </StyledTableCell>
                                            <StyledTableCell onClick={() => onExecutionRowClick(row)}>{row.sessionId}</StyledTableCell>
                                            <StyledTableCell onClick={() => onExecutionRowClick(row)}>
                                                {moment(row.createdDate).format('MMM D, YYYY h:mm A')}
                                            </StyledTableCell>
                                        </StyledTableRow>
                                    )
                                })}
                            </>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    )
}

ExecutionsListTable.propTypes = {
    data: PropTypes.array,
    isLoading: PropTypes.bool,
    onExecutionRowClick: PropTypes.func,
    onSelectionChange: PropTypes.func,
    className: PropTypes.string
}

ExecutionsListTable.displayName = 'ExecutionsListTable'
