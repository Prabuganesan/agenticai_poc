import { useState } from 'react'
import { Box, Tabs, Tab } from '@mui/material'
import MainCard from '@/ui-component/cards/MainCard'
import Overview from './Overview'
import Transactions from './Transactions'

const LlmUsage = () => {
    const [tabValue, setTabValue] = useState(0)

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue)
    }

    return (
        <MainCard>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={tabValue} onChange={handleTabChange}>
                    <Tab label="Overview" />
                    <Tab label="Transactions" />
                </Tabs>
            </Box>

            <Box>
                {tabValue === 0 && <Overview />}
                {tabValue === 1 && <Transactions />}
            </Box>
        </MainCard>
    )
}

export default LlmUsage

