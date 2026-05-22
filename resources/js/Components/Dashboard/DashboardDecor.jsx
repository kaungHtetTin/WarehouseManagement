import { Box } from '@mui/material';

export default function DashboardDecor({ dark = false }) {
    return (
        <Box
            aria-hidden
            sx={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 0,
                overflow: 'hidden',
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    top: -120,
                    right: -80,
                    width: 420,
                    height: 420,
                    borderRadius: '50%',
                    background: dark
                        ? 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 70%)',
                    filter: 'blur(2px)',
                }}
            />
            <Box
                sx={{
                    position: 'absolute',
                    bottom: -100,
                    left: -60,
                    width: 360,
                    height: 360,
                    borderRadius: '50%',
                    background: dark
                        ? 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(168,85,247,0.14) 0%, transparent 70%)',
                }}
            />
            <Box
                sx={{
                    position: 'absolute',
                    top: '40%',
                    left: '35%',
                    width: 200,
                    height: 200,
                    borderRadius: 24,
                    transform: 'rotate(25deg)',
                    opacity: dark ? 0.06 : 0.08,
                    background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                }}
            />
        </Box>
    );
}
