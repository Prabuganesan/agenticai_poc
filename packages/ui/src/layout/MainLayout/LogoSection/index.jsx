import { Link } from 'react-router-dom'

// material-ui
import { ButtonBase } from '@mui/material'

// project imports
import config from '@/config'
import Logo from '@/ui-component/extended/Logo'
import { Box, Typography } from '@mui/material'

// ==============================|| MAIN LOGO ||============================== //

const LogoSection = () => (
    <ButtonBase disableRipple component={Link} to={config.defaultPath}>
        <Logo />
        <Box sx={{ ml: 1, textAlign: 'left' }}>
            <Typography variant='h3' sx={{ fontWeight: 800 }}>
                {'Autonomous SAB'}
            </Typography>
        </Box>
    </ButtonBase>
)

export default LogoSection
