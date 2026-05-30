const INCH_IN_MM = 25.4;

export const PRINT_PAPER_PRESETS = [
    { value: 'A6', label: 'A6 (105 x 148 mm)', type: 'sheet', widthMm: 105, heightMm: 148, marginMm: 8 },
    { value: 'A5', label: 'A5 (148 x 210 mm)', type: 'sheet', widthMm: 148, heightMm: 210, marginMm: 10 },
    { value: 'A4', label: 'A4 (210 x 297 mm)', type: 'sheet', widthMm: 210, heightMm: 297, marginMm: 12 },
    { value: 'A3', label: 'A3 (297 x 420 mm)', type: 'sheet', widthMm: 297, heightMm: 420, marginMm: 14 },
    { value: 'B5', label: 'B5 (176 x 250 mm)', type: 'sheet', widthMm: 176, heightMm: 250, marginMm: 10 },
    { value: 'LETTER', label: 'Letter (216 x 279 mm)', type: 'sheet', widthMm: 216, heightMm: 279, marginMm: 12 },
    { value: 'LEGAL', label: 'Legal (216 x 356 mm)', type: 'sheet', widthMm: 216, heightMm: 356, marginMm: 12 },
    { value: 'ROLL_1IN', label: '1 inch (25.4 mm)', type: 'roll', widthMm: INCH_IN_MM, marginMm: 3 },
    { value: 'ROLL_2IN', label: '2 inches (50.8 mm)', type: 'roll', widthMm: INCH_IN_MM * 2, marginMm: 4 },
    { value: 'ROLL_58MM', label: '58 mm', type: 'roll', widthMm: 58, marginMm: 4 },
    { value: 'ROLL_72MM', label: '72 mm', type: 'roll', widthMm: 72, marginMm: 4 },
    { value: 'ROLL_76MM', label: '76 mm', type: 'roll', widthMm: 76, marginMm: 4 },
    { value: 'ROLL_3IN', label: '3 inches (76.2 mm)', type: 'roll', widthMm: INCH_IN_MM * 3, marginMm: 4 },
    { value: 'ROLL_80MM', label: '80 mm', type: 'roll', widthMm: 80, marginMm: 4 },
    { value: 'ROLL_4IN', label: '4 inches (101.6 mm)', type: 'roll', widthMm: INCH_IN_MM * 4, marginMm: 4 },
];

const PRESET_MAP = new Map(PRINT_PAPER_PRESETS.map((preset) => [preset.value, preset]));
const PAPER_ALIASES = {
    '80': 'ROLL_80MM',
    '80MM': 'ROLL_80MM',
    RECEIPT: 'ROLL_80MM',
    RECEIPT80: 'ROLL_80MM',
    RECEIPT_80: 'ROLL_80MM',
    '76': 'ROLL_76MM',
    '76MM': 'ROLL_76MM',
    '72': 'ROLL_72MM',
    '72MM': 'ROLL_72MM',
    '58': 'ROLL_58MM',
    '58MM': 'ROLL_58MM',
    '4IN': 'ROLL_4IN',
    '4INCH': 'ROLL_4IN',
    '4INCHES': 'ROLL_4IN',
    '3IN': 'ROLL_3IN',
    '3INCH': 'ROLL_3IN',
    '3INCHES': 'ROLL_3IN',
    '2IN': 'ROLL_2IN',
    '2INCH': 'ROLL_2IN',
    '2INCHES': 'ROLL_2IN',
    '1IN': 'ROLL_1IN',
    '1INCH': 'ROLL_1IN',
};

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function roundMm(value) {
    return Math.round(value * 10) / 10;
}

export function normalizePrintPaper(value) {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) {
        return 'A4';
    }

    const normalized = PAPER_ALIASES[raw] || raw;
    return PRESET_MAP.has(normalized) ? normalized : 'A4';
}

export function getPrintPaperPreset(value) {
    return PRESET_MAP.get(normalizePrintPaper(value)) || PRESET_MAP.get('A4');
}

export function getInitialPrintPaper(templatePaperSize = 'A4') {
    if (typeof window !== 'undefined') {
        try {
            const params = new URLSearchParams(window.location.search);
            const fromQuery = params.get('paper');
            if (fromQuery) {
                return normalizePrintPaper(fromQuery);
            }
        } catch {
            return normalizePrintPaper(templatePaperSize);
        }
    }

    return normalizePrintPaper(templatePaperSize);
}

export function getPrintLayout(paperSize) {
    const preset = getPrintPaperPreset(paperSize);

    if (preset.type === 'roll') {
        const widthMm = roundMm(preset.widthMm);
        const compactFont = clamp(Math.round(widthMm / 7), 7, 11);
        const valueFont = clamp(compactFont + 1, 8, 12);
        const keyColumnWidthMm = roundMm(clamp(widthMm * 0.34, 9, 30));
        const qrWidthPx = clamp(Math.round(widthMm * 3), 96, 260);

        return {
            preset,
            isRoll: true,
            pageSize: `${widthMm}mm auto`,
            pageMargin: `${preset.marginMm}mm`,
            sheetWidth: `${widthMm}mm`,
            qrPreviewWidth: qrWidthPx,
            qrImageSize: clamp(Math.round(widthMm * 1.6), 48, 140),
            keyColumnWidth: `${keyColumnWidthMm}mm`,
            keyFontSize: `${compactFont}px`,
            valueFontSize: `${valueFont}px`,
            contentPadding: widthMm <= 30 ? 0.5 : widthMm <= 58 ? 1 : 1.25,
            amountBoxMinWidth: '100%',
            policyFontSize: `${clamp(compactFont, 7, 9)}px`,
        };
    }

    const widthMm = preset.widthMm;
    const narrowSheet = widthMm <= 148;

    return {
        preset,
        isRoll: false,
        pageSize: `${preset.widthMm}mm ${preset.heightMm}mm`,
        pageMargin: `${preset.marginMm}mm`,
        sheetWidth: `${preset.widthMm}mm`,
        qrPreviewWidth: narrowSheet ? 220 : 260,
        qrImageSize: narrowSheet ? 120 : 140,
        keyColumnWidth: narrowSheet ? '32mm' : '38mm',
        keyFontSize: narrowSheet ? '11px' : '12px',
        valueFontSize: narrowSheet ? '11px' : '12px',
        contentPadding: narrowSheet ? 2 : widthMm >= 297 ? 3 : 2.5,
        amountBoxMinWidth: narrowSheet ? '220px' : '260px',
        policyFontSize: narrowSheet ? '8px' : '9px',
    };
}
