import autonomousLogo from '@/assets/images/Ari-logo.png'

// ==============================|| LOGO ||============================== //

const Logo = () => {

    return (
        <div style={{ alignItems: 'center', display: 'flex', flexDirection: 'row', marginLeft: '10px' }}>
            <img
                style={{ objectFit: 'contain', maxHeight: '70px', maxWidth: '90px' }}
                src={autonomousLogo}
                alt='Autonomous'
            />
        </div>
    )
}

export default Logo
