import PropTypes from 'prop-types'
import { styled, useTheme } from '@mui/material/styles'
import { Box, Card, Stack, Typography, Tooltip } from '@mui/material'
import MoreItemsTooltip from '../tooltip/MoreItemsTooltip'

// styles
const CardWrapper = styled(Card)(({ theme }) => ({
    background: theme.palette.mode === 'dark'
        ? 'rgba(15, 23, 42, 0.6)' // Semi-transparent dark background
        : theme.palette.background.paper,
    backdropFilter: theme.palette.mode === 'dark' ? 'blur(20px)' : 'none',
    color: theme.palette.text.primary,
    overflow: 'visible',
    position: 'relative',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
    borderRadius: '24px', // Larger radius for modern look
    padding: '24px',
    border: 'none',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',

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
        background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #06b6d4, #8b5cf6, #ec4899)' // Cyan -> Purple -> Pink
            : 'linear-gradient(135deg, rgba(37, 99, 235, 0.3), rgba(124, 58, 237, 0.3))',
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        pointerEvents: 'none'
    },

    // Neon Glow Shadow
    boxShadow: theme.palette.mode === 'dark'
        ? '0 0 0 1px rgba(255, 255, 255, 0.05), 0 10px 30px -10px rgba(6, 182, 212, 0.15)'
        : '0 4px 20px rgba(0, 0, 0, 0.05)',

    '&:hover': {
        transform: 'translateY(-6px)',
        boxShadow: theme.palette.mode === 'dark'
            ? '0 0 0 1px rgba(255, 255, 255, 0.1), 0 20px 40px -10px rgba(139, 92, 246, 0.3), 0 0 20px rgba(6, 182, 212, 0.2)' // Intense glow
            : '0 12px 30px rgba(0, 0, 0, 0.1)',
        '&::before': {
            background: theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)' // Brighter gradient on hover
                : 'linear-gradient(135deg, #2563eb, #7c3aed)'
        }
    }
}))

const ItemCard = ({ data, images, icons, onClick, hideStats }) => {
    const theme = useTheme()



    return (
        <CardWrapper onClick={onClick}>
            <Box>
                {/* Header: Icon + Name */}
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                    <Box
                        sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            background: theme.palette.mode === 'dark'
                                ? 'linear-gradient(135deg, #1e293b, #0f172a)'
                                : 'linear-gradient(135deg, #ffffff, #f1f5f9)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: theme.palette.mode === 'dark'
                                ? '1px solid rgba(255,255,255,0.1)'
                                : '1px solid rgba(0,0,0,0.1)',
                            overflow: 'hidden',
                            flexShrink: 0
                        }}
                    >
                        {icons && icons.length > 0 ? (
                            (() => {
                                const Icon = icons[0].icon || icons[0];
                                const color = icons[0].color || theme.palette.text.secondary;
                                return Icon ? <Icon size={28} color={color} /> : null;
                            })()
                        ) : images && images.length > 0 ? (
                            <img src={images[0].imageSrc} alt="icon" style={{ width: 28, height: 28 }} />
                        ) : (
                            <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: theme.palette.primary.main, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                                {data.name?.[0]}
                            </Box>
                        )}
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {data.templateName || data.name}
                    </Typography>
                </Stack>

                {/* Description (Old Card Content) */}
                {data.description && (
                    <Typography
                        variant="body2"
                        sx={{
                            mb: 3,
                            color: theme.palette.text.secondary,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                        }}
                    >
                        {data.description}
                    </Typography>
                )}
            </Box>

            <Box>
                {/* New Stats: Sessions & Messages */}
                {!hideStats && (
                    <Stack direction="row" spacing={4} sx={{ mb: 3 }}>
                        <Box>
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mb: 0.5 }}>
                                Sessions
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {data.sessions || 0}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mb: 0.5 }}>
                                Messages
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {data.messages || 0}
                            </Typography>
                        </Box>
                    </Stack>
                )}

                {/* Footer: Node Details (Icons) */}
                {(images?.length > 0 || icons?.length > 0) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {[
                            ...(images || []).map((img) => ({ type: 'image', src: img.imageSrc, label: img.label })),
                            ...(icons || []).map((ic) => ({ type: 'icon', icon: ic.icon, color: ic.color, label: ic.name }))
                        ]
                            .slice(0, 4) // Show up to 4 items
                            .map((item, index) => (
                                <Tooltip key={index} title={item.label || ''} placement='top'>
                                    {item.type === 'image' ? (
                                        <Box
                                            sx={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: '50%',
                                                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: '1px solid rgba(255,255,255,0.1)'
                                            }}
                                        >
                                            <img
                                                style={{ width: 20, height: 20, objectFit: 'contain' }}
                                                alt=''
                                                src={item.src}
                                            />
                                        </Box>
                                    ) : (
                                        <Box
                                            sx={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: '50%',
                                                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: '1px solid rgba(255,255,255,0.1)'
                                            }}
                                        >
                                            {item.icon ? <item.icon size={20} color={item.color} /> : null}
                                        </Box>
                                    )}
                                </Tooltip>
                            ))}

                        {(images?.length || 0) + (icons?.length || 0) > 4 && (
                            <MoreItemsTooltip
                                images={[
                                    ...(images?.slice(4) || []),
                                    ...(icons?.slice(Math.max(0, 4 - (images?.length || 0))) || []).map((ic) => ({ label: ic.name }))
                                ]}
                            >
                                <Typography sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary, ml: 1 }}>
                                    +{(images?.length || 0) + (icons?.length || 0) - 4}
                                </Typography>
                            </MoreItemsTooltip>
                        )}
                    </Box>
                )}
            </Box>
        </CardWrapper>
    )
}

ItemCard.propTypes = {
    data: PropTypes.object,
    images: PropTypes.array,
    icons: PropTypes.array,
    onClick: PropTypes.func,
    hideStats: PropTypes.bool
}

export default ItemCard
