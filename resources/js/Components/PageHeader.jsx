import { Box, Divider, Paper, Stack, Typography } from '@mui/material';

export default function PageHeader({ eyebrow, title, subtitle, actions = null, children = null, sx = [] }) {
    return (
        <Paper
            variant="outlined"
            sx={[
                {
                    p: { xs: 2, md: 2.5 },
                    borderRadius: 1.5,
                    boxShadow: 'none',
                    backgroundImage: 'linear-gradient(180deg, rgba(79,70,229,0.05) 0%, rgba(255,255,255,0) 100%)',
                },
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
        >
            <Stack spacing={children ? 1.5 : 0.75}>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.5}
                    sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' } }}
                >
                    <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                        {eyebrow ? (
                            <Typography variant="overline" sx={{ display: 'block', color: 'primary.main', fontWeight: 800, letterSpacing: '0.08em' }}>
                                {eyebrow}
                            </Typography>
                        ) : null}
                        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                            {title}
                        </Typography>
                        {subtitle ? (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
                                {subtitle}
                            </Typography>
                        ) : null}
                    </Box>
                    {actions ? <Box sx={{ flexShrink: 0, width: { xs: '100%', md: 'auto' } }}>{actions}</Box> : null}
                </Stack>

                {children ? (
                    <>
                        <Divider />
                        {children}
                    </>
                ) : null}
            </Stack>
        </Paper>
    );
}
