export const DEFAULT_THERMAL_PAPER_WIDTH = 80;
export const STANDARD_THERMAL_PAPER_WIDTHS = [58, 72, 76, 80];
const THERMAL_PAPER_STORAGE_KEY = 'warehouse.printPaperWidth.v1';
const LEGACY_THERMAL_PAPER_STORAGE_KEY = 'warehouse.bluetoothPrinterPaperWidth.v1';

export function normalizeThermalPaperWidth(value) {
    const width = Math.round(Number(value));
    return STANDARD_THERMAL_PAPER_WIDTHS.includes(width) ? width : DEFAULT_THERMAL_PAPER_WIDTH;
}

export function loadThermalPaperWidth() {
    if (typeof window === 'undefined') {
        return DEFAULT_THERMAL_PAPER_WIDTH;
    }

    try {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get('thermal_width');
        if (fromQuery) {
            return normalizeThermalPaperWidth(fromQuery);
        }
    } catch {
        return DEFAULT_THERMAL_PAPER_WIDTH;
    }

    try {
        const saved = window.localStorage.getItem(THERMAL_PAPER_STORAGE_KEY);
        if (saved != null) {
            return normalizeThermalPaperWidth(saved);
        }

        return normalizeThermalPaperWidth(window.localStorage.getItem(LEGACY_THERMAL_PAPER_STORAGE_KEY));
    } catch {
        return DEFAULT_THERMAL_PAPER_WIDTH;
    }
}

export function saveThermalPaperWidth(width) {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(THERMAL_PAPER_STORAGE_KEY, String(normalizeThermalPaperWidth(width)));
    } catch {
        return;
    }
}

export function getThermalPaperLayout(width) {
    const normalizedWidth = normalizeThermalPaperWidth(width);

    switch (normalizedWidth) {
        case 58:
            return {
                paperWidth: 58,
                columns: 32,
                itemNameWidth: 14,
                qtyWidth: 8,
                amountWidth: 10,
                qrCodeSize: 5,
                qrPreviewWidth: 220,
                qrImageSize: 120,
                keyColumnWidth: 96,
                keyFontSize: '11px',
                valueFontSize: '12px',
                titleFontSize: '17px',
                metaFontSize: '11px',
                sectionTitleFontSize: '13px',
                tableFontSize: '12px',
                policyFontSize: '9px',
                contentSpacing: 0.35,
                headerSpacing: 0.75,
                headerInnerSpacing: 0.5,
                kvColumnGap: '5px',
                tableCellPaddingX: 0.35,
                tableCellPaddingY: 0.1,
                pageMargin: '4mm',
            };
        case 72:
            return {
                paperWidth: 72,
                columns: 42,
                itemNameWidth: 18,
                qtyWidth: 8,
                amountWidth: 12,
                qrCodeSize: 6,
                qrPreviewWidth: 236,
                qrImageSize: 128,
                keyColumnWidth: 104,
                keyFontSize: '12px',
                valueFontSize: '12px',
                titleFontSize: '17px',
                metaFontSize: '12px',
                sectionTitleFontSize: '13px',
                tableFontSize: '12px',
                policyFontSize: '9px',
                contentSpacing: 0.4,
                headerSpacing: 0.9,
                headerInnerSpacing: 0.65,
                kvColumnGap: '6px',
                tableCellPaddingX: 0.4,
                tableCellPaddingY: 0.1,
                pageMargin: '4mm',
            };
        case 76:
            return {
                paperWidth: 76,
                columns: 46,
                itemNameWidth: 20,
                qtyWidth: 8,
                amountWidth: 13,
                qrCodeSize: 6,
                qrPreviewWidth: 248,
                qrImageSize: 136,
                keyColumnWidth: 110,
                keyFontSize: '12px',
                valueFontSize: '13px',
                titleFontSize: '17px',
                metaFontSize: '12px',
                sectionTitleFontSize: '14px',
                tableFontSize: '13px',
                policyFontSize: '10px',
                contentSpacing: 0.45,
                headerSpacing: 1,
                headerInnerSpacing: 0.75,
                kvColumnGap: '6px',
                tableCellPaddingX: 0.45,
                tableCellPaddingY: 0.1,
                pageMargin: '4mm',
            };
        default:
            return {
                paperWidth: 80,
                columns: 48,
                itemNameWidth: 22,
                qtyWidth: 8,
                amountWidth: 14,
                qrCodeSize: 7,
                qrPreviewWidth: 260,
                qrImageSize: 140,
                keyColumnWidth: 110,
                keyFontSize: '12px',
                valueFontSize: '13px',
                titleFontSize: '17px',
                metaFontSize: '12px',
                sectionTitleFontSize: '14px',
                tableFontSize: '13px',
                policyFontSize: '10px',
                contentSpacing: 0.45,
                headerSpacing: 1,
                headerInnerSpacing: 0.75,
                kvColumnGap: '6px',
                tableCellPaddingX: 0.45,
                tableCellPaddingY: 0.1,
                pageMargin: '4mm',
            };
    }
}
