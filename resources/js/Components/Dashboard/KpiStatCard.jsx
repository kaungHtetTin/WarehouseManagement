import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

const toneMap = {
    primary: {
        gradient: 'linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(59,130,246,0.08) 100%)',
        iconBg: 'linear-gradient(135deg, #4F46E5, #3B82F6)',
    },
    secondary: {
        gradient: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(168,85,247,0.08) 100%)',
        iconBg: 'linear-gradient(135deg, #7C3AED, #A855F7)',
    },
    success: {
        gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(52,211,153,0.08) 100%)',
        iconBg: 'linear-gradient(135deg, #059669, #10B981)',
    },
    warning: {
        gradient: 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(251,191,36,0.08) 100%)',
        iconBg: 'linear-gradient(135deg, #EA580C, #F97316)',
    },
    danger: {
        gradient: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(248,113,113,0.08) 100%)',
        iconBg: 'linear-gradient(135deg, #DC2626, #EF4444)',
    },
};

export default function KpiStatCard({ title, value, subtitle, trend, trendUp = true, icon, tone = 'primary', href }) {
    const palette = toneMap[tone] ?? toneMap.primary;
    const Wrapper = href ? 'a' : Box;
    const wrapperProps = href ? { href, style: { textDecoration: 'none', color: 'inherit' } } : {};

    return (
        <Card
            component={Wrapper}
            {...wrapperProps}
            sx={{
                height: '100%',
                background: palette.gradient,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': { transform: 'translateY(-3px)' },
            }}
        >
            <CardContent sx={{ p: { xs: 2, sm: 2.25 }, '&:last-child': { pb: { xs: 2, sm: 2.25 } } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {title}
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5, lineHeight: 1.1, fontSize: { xs: '1.65rem', sm: '2rem' } }}>
                            {value}
                        </Typography>
                        {subtitle ? (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                {subtitle}
                            </Typography>
                        ) : null}
                        {trend ? (
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
                                {trendUp ? (
                                    <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                                ) : (
                                    <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                                )}
                                <Typography variant="caption" sx={{ fontWeight: 700, color: trendUp ? 'success.main' : 'error.main' }}>
                                    {trend}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    vs last month
                                </Typography>
                            </Stack>
                        ) : null}
                    </Box>
                    {icon ? (
                        <Box
                            sx={{
                                width: 48,
                                height: 48,
                                borderRadius: 14,
                                display: 'grid',
                                placeItems: 'center',
                                background: palette.iconBg,
                                color: '#fff',
                                flexShrink: 0,
                                boxShadow: '0 8px 20px rgba(79, 70, 229, 0.25)',
                                '& svg': { fontSize: 24 },
                            }}
                        >
                            {icon}
                        </Box>
                    ) : null}
                </Stack>
            </CardContent>
        </Card>
    );
}
