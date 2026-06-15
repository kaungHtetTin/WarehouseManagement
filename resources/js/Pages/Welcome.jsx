import { Head, Link } from '@inertiajs/react';
import {
    Box,
    Button,
    Chip,
    Container,
    Divider,
    Paper,
    Stack,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    ArrowForwardOutlined as ArrowForwardIcon,
    AssignmentTurnedInOutlined as VoucherIcon,
    CheckCircleOutlineOutlined as CheckIcon,
    DashboardOutlined as DashboardIcon,
    Inventory2Outlined as InventoryIcon,
    LocalShippingOutlined as TruckIcon,
    PaymentsOutlined as PaymentsIcon,
    QrCode2Outlined as TrackingIcon,
    ShieldOutlined as ShieldIcon,
    StorefrontOutlined as OwnerIcon,
    WarehouseOutlined as WarehouseIcon,
} from '@mui/icons-material';

const HERO_IMAGE = '/images/warehouse-portfolio-hero.jpg';

const textWrapSx = {
    minWidth: 0,
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
};

const buttonSx = {
    minWidth: 0,
    whiteSpace: 'normal',
    textAlign: 'center',
    lineHeight: 1.2,
};

const responsiveButtonSx = {
    ...buttonSx,
    width: { xs: '100%', sm: 'auto' },
};

const ctaButtonSx = {
    ...buttonSx,
    minHeight: 48,
    height: 48,
    px: 2.5,
    width: { xs: '100%', sm: 'auto' },
    minWidth: { sm: 148 },
    alignSelf: 'center',
    flex: '0 0 auto',
};

const chipSx = {
    maxWidth: '100%',
    '& .MuiChip-label': {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
};

const cardSx = {
    minWidth: 0,
    overflow: 'hidden',
};

const features = [
    {
        icon: <VoucherIcon />,
        title: 'Voucher-first operation',
        description: 'Create cargo vouchers, record recipients, calculate fees, print documents, and keep every delivery record searchable.',
    },
    {
        icon: <TruckIcon />,
        title: 'Trip and vehicle control',
        description: 'Assign vehicles, check capacity weight, load vouchers, track dispatch status, and keep trip costs connected to each route.',
    },
    {
        icon: <WarehouseIcon />,
        title: 'Warehouse handover flow',
        description: 'Coordinate source and destination warehouses with dispatch, incoming receipt, fulfillment instructions, and delivery confirmation.',
    },
    {
        icon: <PaymentsIcon />,
        title: 'Payment visibility',
        description: 'Monitor unpaid, partial, paid, and waived vouchers while keeping customer payments and operational costs in one workspace.',
    },
    {
        icon: <TrackingIcon />,
        title: 'Public tracking ready',
        description: 'Customers can check voucher status from a tracking page, reducing phone calls and making your service feel more professional.',
    },
    {
        icon: <ShieldIcon />,
        title: 'Role-based access',
        description: 'Give owners, admins, warehouse staff, dispatch teams, and finance users the right access without exposing everything.',
    },
];

const flow = [
    ['1', 'Create voucher', 'Add merchant, recipient, destination warehouse, items, freight, weight, and extra costs.'],
    ['2', 'Print and confirm', 'Generate a clean voucher document, then move confirmed cargo into the operational queue.'],
    ['3', 'Plan trip', 'Choose vehicle, driver, route destination, and load eligible vouchers with capacity checks.'],
    ['4', 'Dispatch cargo', 'Warehouse teams record loading, destination receipt, delivery, return, or partial delivery.'],
    ['5', 'Collect and review', 'Track payments, costs, outstanding balances, and net income for better owner decisions.'],
];

const ownerBenefits = [
    'Know which vouchers still need payment or delivery action.',
    'Reduce missing paper records with searchable digital history.',
    'Control warehouse, trip, vehicle, product, merchant, and finance data from one admin panel.',
    'Improve customer trust with printed vouchers and online status tracking.',
];

const modules = [
    ['Master Data', 'Warehouses, products, categories, merchants, vehicles, users, and permissions.'],
    ['Voucher Operations', 'Wizard creation, detail editing, printing, cost records, payment status, and deletion control.'],
    ['Trip Management', 'Vehicle selection, loading, manifest printing, route progress, delivery confirmation, and trip costs.'],
    ['Finance', 'Ledger entries, finance categories, reports, trip net income, and voucher payment history.'],
];

const stats = [
    ['5-step', 'operation flow'],
    ['Role-based', 'team access'],
    ['Public', 'voucher tracking'],
    ['Print-ready', 'documents'],
];

const faqs = [
    ['Who is this software for?', 'Warehouse owners, logistics teams, trading companies, and delivery businesses that manage cargo vouchers and trips every day.'],
    ['Can it support multiple warehouse staff?', 'Yes. The system includes role and permission controls so each user can work only in the areas they need.'],
    ['Does it handle delivery and payment together?', 'Yes. Voucher status, delivery progress, payments, additional costs, and trip costs are connected for clearer operations.'],
];

function SectionHeader({ eyebrow, title, description }) {
    return (
        <Stack spacing={1} sx={{ maxWidth: 760, ...textWrapSx }}>
            <Typography variant="overline" sx={{ color: '#1d4ed8', fontWeight: 900, letterSpacing: 0 }}>
                {eyebrow}
            </Typography>
            <Typography component="h2" variant="h3" sx={{ fontSize: { xs: '1.85rem', sm: '2.2rem', md: '2.75rem' }, fontWeight: 950, lineHeight: 1.1, letterSpacing: 0, ...textWrapSx }}>
                {title}
            </Typography>
            {description ? (
                <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.75, maxWidth: 680, ...textWrapSx }}>
                    {description}
                </Typography>
            ) : null}
        </Stack>
    );
}

function FeatureCard({ icon, title, description }) {
    return (
        <Paper
            elevation={0}
            variant="outlined"
            sx={{
                ...cardSx,
                p: 2.5,
                borderRadius: 1,
                borderColor: 'rgba(15,23,42,0.10)',
                bgcolor: '#fff',
                minHeight: 214,
            }}
        >
            <Stack spacing={1.5}>
                <Box
                    sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        color: '#0f766e',
                        bgcolor: '#d9f3ee',
                        '& svg': { fontSize: 24 },
                    }}
                >
                    {icon}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.25, ...textWrapSx }}>
                    {title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, ...textWrapSx }}>
                    {description}
                </Typography>
            </Stack>
        </Paper>
    );
}

export default function Welcome(props) {
    const theme = useTheme();
    const compact = useMediaQuery(theme.breakpoints.down('md'));
    const adminUrl = props.admin_app_url;
    const isLoggedIn = Boolean(props.auth?.user);
    const primaryHref = isLoggedIn ? `${adminUrl}/dashboard` : `${adminUrl}/login`;
    const primaryLabel = isLoggedIn ? 'Open Dashboard' : 'Log In';

    return (
        <>
            <Head title="K2 Warehouse Suite | Warehouse Management Software" />
            <Box sx={{ bgcolor: '#f7f8fb', color: '#111827', minHeight: '100vh' }}>
                <Box
                    component="header"
                    sx={{
                        position: 'absolute',
                        zIndex: 3,
                        top: 0,
                        left: 0,
                        right: 0,
                        color: '#fff',
                    }}
                >
                    <Container maxWidth="xl" sx={{ py: 2 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={{ xs: 1, sm: 2 }} sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flex: '1 1 auto' }}>
                                <Box
                                    component="img"
                                    src="/k2_logo_round.png"
                                    alt="K2 Software Studio"
                                    sx={{ width: { xs: 40, sm: 48 }, height: { xs: 40, sm: 48 }, borderRadius: 1, bgcolor: '#fff', p: 0.5, flexShrink: 0 }}
                                />
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="subtitle1" noWrap sx={{ fontWeight: 950, lineHeight: 1.1 }}>
                                        K2 Warehouse Suite
                                    </Typography>
                                    <Typography variant="caption" noWrap sx={{ display: { xs: 'none', sm: 'block' }, color: 'rgba(255,255,255,0.78)', fontWeight: 700 }}>
                                        Warehouse operations software
                                    </Typography>
                                </Box>
                            </Stack>

                            {!compact ? (
                                <Stack direction="row" spacing={2.25} alignItems="center" component="nav" sx={{ flexShrink: 0 }}>
                                    {[
                                        ['Features', '#features'],
                                        ['Flow', '#flow'],
                                        ['Modules', '#modules'],
                                        ['Contact', '#contact'],
                                    ].map(([label, href]) => (
                                        <Typography
                                            key={label}
                                            component="a"
                                            href={href}
                                            variant="body2"
                                            sx={{ color: 'rgba(255,255,255,0.86)', textDecoration: 'none', fontWeight: 800 }}
                                        >
                                            {label}
                                        </Typography>
                                    ))}
                                </Stack>
                            ) : null}

                            <Stack direction="row" spacing={1} sx={{ flexShrink: 0, minWidth: 0 }}>
                                <Button component={Link} href={primaryHref} variant="contained" color="warning" size="small" sx={{ color: '#111827', fontWeight: 900, ...buttonSx }}>
                                    {primaryLabel}
                                </Button>
                                {!compact && !isLoggedIn && props.canRegister ? (
                                    <Button component={Link} href={`${adminUrl}/register`} variant="outlined" size="small" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.55)', ...buttonSx }}>
                                        Create Account
                                    </Button>
                                ) : null}
                            </Stack>
                        </Stack>
                    </Container>
                </Box>

                <Box
                    sx={{
                        minHeight: { xs: '92vh', md: '88vh' },
                        display: 'flex',
                        alignItems: 'center',
                        position: 'relative',
                        color: '#fff',
                        backgroundImage: `linear-gradient(90deg, rgba(3,7,18,0.88) 0%, rgba(15,23,42,0.74) 42%, rgba(15,23,42,0.22) 100%), url(${HERO_IMAGE})`,
                        backgroundSize: 'cover',
                        backgroundPosition: { xs: '58% center', md: 'center' },
                    }}
                >
                    <Container maxWidth="xl" sx={{ pt: 11, pb: { xs: 6, md: 7 } }}>
                        <Stack spacing={3.25} sx={{ maxWidth: 790, ...textWrapSx }}>
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ maxWidth: '100%' }}>
                                <Chip label="For warehouse owners" sx={{ ...chipSx, bgcolor: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 900 }} />
                                <Chip label="Voucher - Trip - Delivery - Payment" sx={{ ...chipSx, bgcolor: 'rgba(250,204,21,0.92)', color: '#111827', fontWeight: 900 }} />
                            </Stack>
                            <Box>
                                <Typography
                                    component="h1"
                                    variant="h1"
                                    sx={{
                                        fontSize: { xs: '2.35rem', sm: '4rem', lg: '5.4rem' },
                                        lineHeight: 1,
                                        fontWeight: 950,
                                        letterSpacing: 0,
                                        maxWidth: 860,
                                        ...textWrapSx,
                                    }}
                                >
                                    K2 Warehouse Suite
                                </Typography>
                                <Typography
                                    variant="h5"
                                    sx={{
                                        mt: 2,
                                        color: 'rgba(255,255,255,0.84)',
                                        lineHeight: 1.55,
                                        fontWeight: 500,
                                        maxWidth: 680,
                                        ...textWrapSx,
                                    }}
                                >
                                    A complete warehouse management platform for owners who need tighter control over vouchers, vehicle trips, warehouse handovers, customer delivery, and payment collection.
                                </Typography>
                            </Box>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: { xs: '100%', sm: 'auto' }, maxWidth: { xs: 380, sm: 'none' } }}>
                                <Button component={Link} href={primaryHref} variant="contained" color="warning" size="large" endIcon={<ArrowForwardIcon />} sx={{ color: '#111827', fontWeight: 950, px: 2.6, ...responsiveButtonSx }}>
                                    {primaryLabel}
                                </Button>
                                <Button href="#flow" variant="outlined" size="large" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.56)', fontWeight: 900, px: 2.6, ...responsiveButtonSx }}>
                                    See Operation Flow
                                </Button>
                            </Stack>
                        </Stack>
                    </Container>
                </Box>

                <Container maxWidth="xl" sx={{ mt: { xs: -4, md: -5 }, position: 'relative', zIndex: 2 }}>
                    <Paper elevation={0} sx={{ ...cardSx, borderRadius: 1, boxShadow: '0 24px 80px rgba(15,23,42,0.16)' }}>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
                                border: '1px solid rgba(15,23,42,0.08)',
                            }}
                        >
                            {stats.map(([value, label], idx) => (
                                <Box key={label} sx={{ p: { xs: 2, md: 2.5 }, bgcolor: '#fff', borderLeft: idx === 0 ? 0 : { md: '1px solid rgba(15,23,42,0.08)' }, borderTop: idx > 1 ? { xs: '1px solid rgba(15,23,42,0.08)', md: 0 } : 0, ...textWrapSx }}>
                                    <Typography variant="h5" sx={{ fontWeight: 950, color: idx === 1 ? '#0f766e' : idx === 2 ? '#b45309' : '#1d4ed8', ...textWrapSx }}>
                                        {value}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontWeight: 700, ...textWrapSx }}>
                                        {label}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    </Paper>
                </Container>

                <Box component="main">
                    <Container maxWidth="xl" sx={{ py: { xs: 7, md: 10 } }}>
                        <Stack spacing={{ xs: 7, md: 10 }}>
                            <Box>
                                <SectionHeader
                                    eyebrow="Product Overview"
                                    title="Software that follows the real movement of goods."
                                    description="K2 Warehouse Suite is designed around the daily rhythm of a warehouse business: receive cargo information, issue vouchers, load vehicles, confirm handovers, collect payments, and review performance."
                                />
                                <Box
                                    sx={{
                                        mt: 3,
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', lg: '1.05fr 0.95fr' },
                                        gap: 3,
                                        alignItems: 'stretch',
                                    }}
                                >
                                    <Box
                                        sx={{
                                            ...cardSx,
                                            p: { xs: 2.25, md: 3 },
                                            borderRadius: 1,
                                            bgcolor: '#fff',
                                            border: '1px solid rgba(15,23,42,0.10)',
                                        }}
                                    >
                                        <Stack spacing={2.25}>
                                            <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
                                                <OwnerIcon sx={{ color: '#1d4ed8', flexShrink: 0, mt: 0.35 }} />
                                                <Typography variant="h5" sx={{ fontWeight: 950, ...textWrapSx }}>
                                                    Built for owner-level visibility
                                                </Typography>
                                            </Stack>
                                            <Typography color="text.secondary" sx={{ lineHeight: 1.8, ...textWrapSx }}>
                                                Instead of separate notebooks, spreadsheets, chat messages, and printed slips, your team works from one connected system. Owners can see what is pending, what is loaded, what is delivered, what is unpaid, and where operational costs are coming from.
                                            </Typography>
                                            <Divider />
                                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                                                {ownerBenefits.map((item) => (
                                                    <Stack key={item} direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
                                                        <CheckIcon sx={{ color: '#0f766e', mt: 0.2, fontSize: 20, flexShrink: 0 }} />
                                                        <Typography variant="body2" sx={{ lineHeight: 1.65, fontWeight: 700, ...textWrapSx }}>
                                                            {item}
                                                        </Typography>
                                                    </Stack>
                                                ))}
                                            </Box>
                                        </Stack>
                                    </Box>

                                    <Box
                                        sx={{
                                            ...cardSx,
                                            borderRadius: 1,
                                            minHeight: 360,
                                            backgroundImage: `url(${HERO_IMAGE})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            border: '1px solid rgba(15,23,42,0.10)',
                                        }}
                                    />
                                </Box>
                            </Box>

                            <Box id="features">
                                <SectionHeader
                                    eyebrow="Features"
                                    title="Everything your warehouse team needs to move faster."
                                    description="The platform brings core operational work into clear modules while keeping the owner view simple enough for daily decisions."
                                />
                                <Box
                                    sx={{
                                        mt: 3,
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, minmax(0, 1fr))' },
                                        gap: 2,
                                    }}
                                >
                                    {features.map((feature) => (
                                        <FeatureCard key={feature.title} {...feature} />
                                    ))}
                                </Box>
                            </Box>

                            <Box id="flow">
                                <SectionHeader
                                    eyebrow="Operation Flow"
                                    title="From voucher creation to payment review."
                                    description="The system mirrors a normal cargo operation, so staff can follow a predictable flow instead of jumping between disconnected tools."
                                />
                                <Box sx={{ mt: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(5, minmax(0, 1fr))' }, gap: 1.5 }}>
                                    {flow.map(([step, title, description]) => (
                                        <Paper key={step} elevation={0} variant="outlined" sx={{ ...cardSx, p: 2.25, borderRadius: 1, borderColor: 'rgba(15,23,42,0.10)', bgcolor: '#fff' }}>
                                            <Typography variant="h4" sx={{ fontWeight: 950, color: '#f59e0b' }}>
                                                {step}
                                            </Typography>
                                            <Typography variant="h6" sx={{ mt: 1, fontWeight: 900, lineHeight: 1.25, ...textWrapSx }}>
                                                {title}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7, ...textWrapSx }}>
                                                {description}
                                            </Typography>
                                        </Paper>
                                    ))}
                                </Box>
                            </Box>

                            <Box id="modules">
                                <SectionHeader
                                    eyebrow="Software Modules"
                                    title="A practical admin panel for every operational team."
                                    description="Owners get control. Staff get clear screens for their role. Customers get better communication."
                                />
                                <Paper elevation={0} variant="outlined" sx={{ ...cardSx, mt: 3, borderRadius: 1, borderColor: 'rgba(15,23,42,0.10)' }}>
                                    {modules.map(([title, description], idx) => (
                                        <Box key={title}>
                                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ p: { xs: 2, md: 2.5 }, bgcolor: '#fff', minWidth: 0 }}>
                                                <Typography variant="h6" sx={{ width: { md: 240 }, flexShrink: 0, fontWeight: 950, ...textWrapSx }}>
                                                    {title}
                                                </Typography>
                                                <Typography color="text.secondary" sx={{ lineHeight: 1.75, ...textWrapSx }}>
                                                    {description}
                                                </Typography>
                                            </Stack>
                                            {idx < modules.length - 1 ? <Divider /> : null}
                                        </Box>
                                    ))}
                                </Paper>
                            </Box>

                            <Box>
                                <Box
                                    sx={{
                                        ...cardSx,
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', md: '0.9fr 1.1fr' },
                                        gap: 3,
                                        alignItems: 'center',
                                        bgcolor: '#111827',
                                        color: '#fff',
                                        borderRadius: 1,
                                        p: { xs: 2.5, md: 4 },
                                    }}
                                >
                                    <Stack spacing={1.5}>
                                        <Typography variant="overline" sx={{ color: '#fbbf24', fontWeight: 900, letterSpacing: 0 }}>
                                            Business Value
                                        </Typography>
                                        <Typography variant="h3" sx={{ fontSize: { xs: '1.85rem', sm: '2.2rem', md: '2.75rem' }, fontWeight: 950, lineHeight: 1.1, letterSpacing: 0, ...textWrapSx }}>
                                            Less confusion at the counter, on the loading floor, and after delivery.
                                        </Typography>
                                    </Stack>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                                        {[
                                            ['For owners', 'Daily visibility into cargo flow, staff actions, outstanding money, and delivery progress.'],
                                            ['For staff', 'Clear screens for creating vouchers, loading trips, recording receipts, and updating status.'],
                                            ['For finance', 'Payment records, voucher balances, cost tracking, and net income review.'],
                                            ['For customers', 'Cleaner printed documents and a public tracking experience.'],
                                        ].map(([title, description]) => (
                                            <Box key={title} sx={{ ...cardSx, p: 2, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 950, ...textWrapSx }}>
                                                    {title}
                                                </Typography>
                                                <Typography variant="body2" sx={{ mt: 0.75, color: 'rgba(255,255,255,0.72)', lineHeight: 1.7, ...textWrapSx }}>
                                                    {description}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                </Box>
                            </Box>

                            <Box>
                                <SectionHeader
                                    eyebrow="Questions"
                                    title="What warehouse owners usually ask first."
                                />
                                <Box sx={{ mt: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
                                    {faqs.map(([question, answer]) => (
                                        <Paper key={question} elevation={0} variant="outlined" sx={{ ...cardSx, p: 2.25, borderRadius: 1, borderColor: 'rgba(15,23,42,0.10)', bgcolor: '#fff' }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 950, lineHeight: 1.3, ...textWrapSx }}>
                                                {question}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.75, ...textWrapSx }}>
                                                {answer}
                                            </Typography>
                                        </Paper>
                                    ))}
                                </Box>
                            </Box>

                            <Box id="contact">
                                <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2.5, md: 4 }, borderRadius: 1, bgcolor: '#eaf3ff', border: '1px solid rgba(29,78,216,0.18)' }}>
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                                        <Stack spacing={1} sx={{ maxWidth: 720, minWidth: 0 }}>
                                            <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
                                                <DashboardIcon sx={{ color: '#1d4ed8', flexShrink: 0, mt: 0.4 }} />
                                                <Typography variant="h4" sx={{ fontSize: { xs: '1.6rem', sm: '2.125rem' }, fontWeight: 950, letterSpacing: 0, ...textWrapSx }}>
                                                    Ready to run a cleaner warehouse operation?
                                                </Typography>
                                            </Stack>
                                            <Typography color="text.secondary" sx={{ lineHeight: 1.75, ...textWrapSx }}>
                                                Open the system, review the dashboard, and start managing vouchers, trips, warehouses, and payments from one workspace.
                                            </Typography>
                                        </Stack>
                                        <Stack
                                            direction={{ xs: 'column', sm: 'row' }}
                                            spacing={1.25}
                                            sx={{
                                                width: { xs: '100%', md: 'auto' },
                                                flexShrink: 0,
                                                alignItems: { xs: 'stretch', sm: 'center' },
                                                alignSelf: { xs: 'stretch', md: 'center' },
                                            }}
                                        >
                                            <Button component={Link} href={primaryHref} variant="contained" endIcon={<ArrowForwardIcon />} sx={{ fontWeight: 950, ...ctaButtonSx }}>
                                                {primaryLabel}
                                            </Button>
                                            {!isLoggedIn && props.canRegister ? (
                                                <Button component={Link} href={`${adminUrl}/register`} variant="outlined" sx={{ fontWeight: 900, ...ctaButtonSx, minWidth: { sm: 190 } }}>
                                                    Create Account
                                                </Button>
                                            ) : (
                                                <Button component={Link} href={`${adminUrl}/operations/vouchers`} variant="outlined" sx={{ fontWeight: 900, ...ctaButtonSx }}>
                                                    View Vouchers
                                                </Button>
                                            )}
                                        </Stack>
                                    </Stack>
                                </Paper>
                            </Box>
                        </Stack>
                    </Container>
                </Box>

                <Box component="footer" sx={{ bgcolor: '#0b1120', color: '#fff', py: 3 }}>
                    <Container maxWidth="xl">
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)', fontWeight: 700, ...textWrapSx }}>
                                K2 Warehouse Suite - Software portfolio for modern warehouse owners
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.52)', ...textWrapSx }}>
                                Laravel v{props.laravelVersion} / PHP v{props.phpVersion}
                            </Typography>
                        </Stack>
                    </Container>
                </Box>
            </Box>
        </>
    );
}
