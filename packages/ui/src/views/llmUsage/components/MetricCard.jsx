import { Box, Card, CardContent, Typography } from '@mui/material'

const MetricCard = ({ title, value, subtitle, icon, color = 'primary' }) => {
    return (
        <Card
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 4,
                border: '1px solid',
                borderColor: 'divider',
                background: 'linear-gradient(145deg, #ffffff, #f0f0f0)',
                boxShadow: '5px 5px 10px #d1d1d1, -5px -5px 10px #ffffff',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '8px 8px 16px #d1d1d1, -8px -8px 16px #ffffff',
                },
                // Dark mode support (if applicable in the theme, this is a safe fallback)
                '.MuiPalette-mode-dark &': {
                    background: 'linear-gradient(145deg, #1e1e1e, #252525)',
                    boxShadow: '5px 5px 10px #0b0b0b, -5px -5px 10px #393939',
                    '&:hover': {
                        boxShadow: '8px 8px 16px #0b0b0b, -8px -8px 16px #393939',
                    }
                }
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    top: -20,
                    right: -20,
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: (theme) => `linear-gradient(135deg, ${theme.palette[color].light}20, ${theme.palette[color].main}20)`,
                    zIndex: 0
                }}
            />

            <CardContent sx={{ flexGrow: 1, p: 3, position: 'relative', zIndex: 1 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="body1" color="text.secondary" fontWeight={600}>
                        {title}
                    </Typography>
                    {icon && (
                        <Box
                            sx={{
                                color: `${color}.main`,
                                fontSize: '1.75rem',
                                p: 1,
                                borderRadius: 2,
                                background: (theme) => `${theme.palette[color].light}15`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.05), inset -2px -2px 4px rgba(255,255,255,0.5)'
                            }}
                        >
                            {icon}
                        </Box>
                    )}
                </Box>
                <Typography variant="h3" fontWeight={700} color={`${color}.main`} sx={{ mb: 0.5 }}>
                    {value}
                </Typography>
                {subtitle && (
                    <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.8 }}>
                        {subtitle}
                    </Typography>
                )}
            </CardContent>
        </Card>
    )
}

export default MetricCard

