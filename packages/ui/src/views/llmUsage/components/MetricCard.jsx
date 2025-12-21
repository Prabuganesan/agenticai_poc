import { Box, Card, CardContent, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

const MetricCard = ({ title, value, subtitle, icon, color = 'primary' }) => {
    const theme = useTheme()
    const isDarkMode = theme.palette.mode === 'dark'

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

                // Original Dark mode support (fallback override)
                '.MuiPalette-mode-dark &': {
                    background: 'rgba(15, 23, 42, 0.6)',
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

