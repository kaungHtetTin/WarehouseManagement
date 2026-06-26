<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Trip slip · {{ $trip->trip_no }}</title>
    <style>
        :root {
            --border: #ccd;
            --muted: #555;
        }
        * { box-sizing: border-box; }
        body {
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0.75rem;
            color: #111;
            background: #fafafa;
            font-size: 13px;
            line-height: 1.4;
        }
        .wrap { max-width: 210mm; margin: 0 auto; background: #fff; padding: 1rem 1.25rem 1.5rem; border: 1px solid var(--border); border-radius: 6px; }
        h1 { font-size: 1.35rem; margin: 0 0 0.35rem; }
        .sub { color: var(--muted); font-size: 0.9rem; margin-bottom: 1rem; }
        .screen-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            align-items: center;
            margin-bottom: 1rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #eee;
        }
        .screen-actions a {
            color: #1565c0;
            text-decoration: none;
            font-weight: 600;
        }
        .screen-actions a:hover { text-decoration: underline; }
        .paper-select {
            font-size: 0.875rem;
            font-weight: 600;
            padding: 0.35rem 0.6rem;
            border: 1px solid #1565c0;
            border-radius: 6px;
            background: #fff;
            color: #1565c0;
            cursor: pointer;
        }
        button, .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.45rem 0.85rem;
            font-size: 0.875rem;
            font-weight: 600;
            border-radius: 6px;
            border: 1px solid #1565c0;
            background: #1565c0;
            color: #fff;
            cursor: pointer;
            text-decoration: none;
        }
        button.secondary, .btn.secondary {
            background: #fff;
            color: #1565c0;
        }
        .flash { background: #e8f5e9; border: 1px solid #a5d6a7; color: #1b5e20; padding: 0.6rem 0.75rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.9rem; }
        section { margin-top: 1rem; }
        h2 { font-size: 1rem; margin: 0 0 0.5rem; border-bottom: 2px solid #eee; padding-bottom: 0.25rem; }
        dl.grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 0.65rem 1.25rem;
            margin: 0;
        }
        .trip-grid-dense {
            grid-template-columns: 1fr;
            gap: 0.35rem 0.75rem;
        }
        .trip-grid-dense dt { font-size: 0.7rem; }
        .trip-grid-dense dd { font-size: 0.85rem; }
        dl.grid dt { margin: 0; font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
        dl.grid dd { margin: 0.15rem 0 0; font-weight: 600; word-break: break-word; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        th, td { border: 1px solid var(--border); padding: 0.4rem 0.45rem; text-align: left; vertical-align: top; word-break: break-word; }
        th { background: #f4f4f6; font-weight: 700; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.02em; }
        tfoot td { background: #f8f8fa; font-weight: 700; }
        td.num { text-align: right; white-space: nowrap; }
        .muted { color: var(--muted); font-size: 0.85rem; }
        .items-cell { font-size: 0.82rem; line-height: 1.35; }
        .items-cell .muted { font-size: 0.8rem; }
        .cargo-table { table-layout: auto; width: 100%; }
        .cargo-table th, .cargo-table td { padding: 0.25rem 0.3rem; font-size: inherit; }
        .cargo-table th { white-space: nowrap; }
        .cargo-table th.num { text-align: right; }
        .cargo-table tbody tr { page-break-inside: avoid; break-inside: avoid; }
        .cargo-table .items-cell { word-break: break-word; }
        .cargo-table .dest-cell { word-break: break-word; white-space: pre-wrap; }
        footer { margin-top: 1.5rem; padding-top: 0.75rem; border-top: 1px solid #eee; font-size: 0.8rem; color: var(--muted); }
        table .text-center {
            text-align: center;
        }
        :root {
            --page-width: 210mm;
            --page-margin: 10mm;
            --base-font: 10px;
            --table-font: 10px;
            --th-font: 9px;
        }
        @media print {
            @page { size: var(--page-width) auto; margin: var(--page-margin); }
            body { background: #fff; padding: 0; font-size: var(--base-font); }
            .wrap { border: none; width: var(--page-width); max-width: 100%; margin: 0 auto; padding: 0; }
            .screen-actions { display: none !important; }
            .flash { border-color: #ccc; background: #fff; }
            a { color: #000; text-decoration: none; }
            table { font-size: var(--table-font); }
            th { font-size: var(--th-font); }
        }

        /* Narrow paper overrides (A5 / roll paper) */
        .is-narrow .section { margin-top: 0.45rem; }
        .is-narrow h2 { font-size: 0.8rem; margin-bottom: 0.2rem; }
        .is-narrow .cargo-table th, .is-narrow .cargo-table td { padding: 0.15rem 0.2rem; }
        .is-narrow .cargo-table { font-size: 9px; }

        /* Extra dense for roll paper */
        .is-roll .section { margin-top: 0.35rem; }
        .is-roll h2 { font-size: 0.72rem; margin-bottom: 0.15rem; border-bottom-width: 1px; }
        .is-roll .trip-grid-dense { gap: 0.12rem 0.35rem; }
        .is-roll .trip-grid-dense dt { font-size: 0.6rem; }
        .is-roll .trip-grid-dense dd { font-size: 0.68rem; margin-bottom: 0.08rem; }

        .is-roll .cargo-table { font-size: 9.5px; }
        .is-roll .cargo-table th, .is-roll .cargo-table td { padding: 0.18rem 0.22rem; }

        .is-roll header h1 { font-size: 0.95rem; margin-bottom: 0.15rem; }
        .is-roll .sub { font-size: 0.65rem; margin-bottom: 0.5rem; }
        .is-roll footer { margin-top: 0.6rem; padding-top: 0.4rem; font-size: 0.62rem; }
        .is-roll .wrap { padding: 0.5rem 0.6rem 0.8rem; }

        /* Roll-paper vertical block layout */
        .cargo-blocks { display: none; }
        .is-roll .cargo-table { display: none !important; }
        .is-roll .cargo-blocks { display: block; }
        .cargo-block {
            border: 1px solid var(--border);
            border-radius: 3px;
            padding: 0.3rem 0.4rem;
            margin-bottom: 0.35rem;
            font-size: 12px;
            line-height: 1.25;
        }
        .cargo-block:last-child { margin-bottom: 0; }
        .cargo-block .dest { font-weight: 700; margin-bottom: 0.15rem; }
        .cargo-block .items { color: #333; margin-bottom: 0.2rem; }
        .cargo-block .items .muted { color: #666; }
        .cargo-block .totals {
            display: flex;
            justify-content: space-between;
            gap: 0.5rem;
            font-weight: 600;
            border-top: 1px dashed #ccc;
            padding-top: 0.2rem;
            margin-top: 0.15rem;
        }
        .cargo-block .remark { font-size: 7px; color: #555; margin-top: 0.1rem; }
        .is-3in .cargo-block { padding: 0.25rem 0.3rem; font-size: 10px; }
        .is-3in .cargo-block .totals { flex-wrap: wrap; gap: 0.2rem 0.4rem; }
    </style>
    <script>
        function getPaperConfig(size) {
            switch (size) {
                case 'A5':
                    return { width: '148mm', margin: '8mm', baseFont: '9px', tableFont: '9px', thFont: '8px' };
                case '4IN':
                    return { width: '101.6mm', margin: '4mm', baseFont: '8px', tableFont: '8px', thFont: '7px' };
                case '3IN':
                    return { width: '76.2mm', margin: '3mm', baseFont: '7px', tableFont: '7px', thFont: '6px' };
                default:
                    return { width: '210mm', margin: '10mm', baseFont: '10px', tableFont: '10px', thFont: '9px' };
            }
        }

        let printStyleEl = null;

        function applyPaperSize() {
            const select = document.getElementById('paperSize');
            if (!select) return;
            const size = select.value;
            const cfg = getPaperConfig(size);
            const root = document.documentElement;
            root.style.setProperty('--page-margin', cfg.margin);
            root.style.setProperty('--base-font', cfg.baseFont);
            root.style.setProperty('--table-font', cfg.tableFont);
            root.style.setProperty('--th-font', cfg.thFont);

            // Update @page size via injected style
            if (printStyleEl) printStyleEl.remove();
            printStyleEl = document.createElement('style');
            printStyleEl.textContent = `@media print { @page { size: ${cfg.width} auto; margin: ${cfg.margin}; } }`;
            document.head.appendChild(printStyleEl);

            // Update wrap width
            const wrap = document.querySelector('.wrap');
            if (wrap) wrap.style.maxWidth = cfg.width;

            // Toggle narrow / roll-paper body classes
            const body = document.body;
            body.classList.remove('is-narrow', 'is-roll', 'is-3in');
            if (size === 'A5') body.classList.add('is-narrow');
            if (size === '4IN') body.classList.add('is-narrow', 'is-roll');
            if (size === '3IN') body.classList.add('is-narrow', 'is-roll', 'is-3in');

            // Persist selection
            try { localStorage.setItem('warehouse.printPaperSize.v1', size); } catch (e) {}
        }

        function initPaperSize() {
            const select = document.getElementById('paperSize');
            if (!select) return;

            // Restore from localStorage or URL
            let saved = null;
            try {
                const params = new URLSearchParams(window.location.search);
                saved = params.get('paper') || localStorage.getItem('warehouse.printPaperSize.v1');
            } catch (e) {}

            if (saved && ['A4', 'A5', '4IN', '3IN'].includes(saved)) {
                select.value = saved;
            }
            applyPaperSize();
        }

        document.addEventListener('DOMContentLoaded', initPaperSize);
    </script>
</head>
<body>
    <div class="wrap">
        <div class="screen-actions">
            <a href="{{ $adminAppUrl }}/operations/trips/{{ $trip->id }}">← Back to trip</a>
            <label style="display:inline-flex; align-items:center; gap:0.4rem; font-weight:600; color:#1565c0;">
                Paper:
                <select id="paperSize" class="paper-select" onchange="applyPaperSize()">
                    <option value="A4">A4 (210 × 297 mm)</option>
                    <option value="A5">A5 (148 × 210 mm)</option>
                    <option value="4IN">4 inches (101.6 mm)</option>
                    <option value="3IN">3 inches (76.2 mm)</option>
                </select>
            </label>
            <button type="button" class="secondary" onclick="window.print()">Print</button>
            @if ($canMarkPrinted)
                <form method="post" action="{{ $adminAppUrl }}/operations/trips/{{ $trip->id }}/manifest-printed" style="display:inline;">
                    @csrf
                    <button type="submit">Record manifest printed</button>
                </form>
            @endif
        </div>

        @if (session('success'))
            <div class="flash">{{ session('success') }}</div>
        @endif

        @php
            $tripStatusCode = (string) ($trip->status ?? '');
            $tripStatusKey = 'trips.status.'.strtolower($tripStatusCode);
            $tripStatusLabel = __($tripStatusKey);
            if ($tripStatusLabel === $tripStatusKey) {
                $tripStatusLabel = $tripStatusCode ?: '—';
            }
        @endphp

        <header>
            <h1>Trip slip — {{ $trip->trip_no }}</h1>
            <p class="sub">{{ $trip->organization->name ?? 'Organization' }} · Status {{ $tripStatusLabel }}</p>
        </header>

        <section>
            <h2>Trip</h2>
            <dl class="grid trip-grid-dense">
                <div>
                    <dt>Vehicle</dt>
                    <dd>{{ $trip->vehicle ? $trip->vehicle->vehicle_no.' · '.$trip->vehicle->vehicle_type : '—' }}</dd>
                </div>
                <div>
                    <dt>Destination warehouse</dt>
                    <dd>{{ optional(optional($trip->stops->first())->warehouse)->display_name ?? ($trip->sourceWarehouse->display_name ?? '—') }}</dd>
                </div>
                <div>
                    <dt>Driver</dt>
                    <dd>{{ collect([$trip->driver_name, $trip->driver_phone])->filter()->implode(' · ') ?: '—' }}</dd>
                </div>
                <div>
                    <dt>Manifest printed</dt>
                    <dd>{{ $trip->manifest_printed_at ? $trip->manifest_printed_at->timezone(config('app.timezone'))->format('d-m-Y H:i') : '—' }}</dd>
                </div>
                <div>
                    <dt>Total already paid</dt>
                    <dd>{{ number_format((float) ($totalPaidAmount ?? 0), 0, '.', ',') }}</dd>
                </div>
                <div>
                    <dt>Total labor cost</dt>
                    <dd>{{ number_format((float) ($totalLaborCost ?? 0), 0, '.', ',') }}</dd>
                </div>
                @if (filled($trip->remark))
                    <div>
                        <dt>Remark</dt>
                        <dd style="white-space: pre-wrap;">{{ $trip->remark }}</dd>
                    </div>
                @endif
            </dl>
        </section>

        <section>
            <h2>Cargo</h2>
            @if (count($cargoRows) === 0)
                <p class="muted">Nothing loaded on this trip yet.</p>
            @else
                <div style="overflow-x: auto;">
                    <table class="cargo-table">
                        <colgroup>
                            <col style="width: 6%;">
                            <col style="width: 18%;">
                            <col style="width: 32%;">
                            <col style="width: 9%;">
                            <col style="width: 11%;">
                            <col style="width: 9%;">
                            <col style="width: 15%;">
                        </colgroup>
                        <thead>
                            <tr>
                                <th class="text-center">No.</th>
                                <th class="text-center">DEST.</th>
                                <th class="text-center">Items</th>
                                <th class="num text-center">ITEMS</th>
                                <th class="num text-center">AMT</th>
                                <th class="text-center">Paid</th>
                                <th class="text-center">Remark</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($cargoRows as $i => $row)
                                @php
                                    $items = $row['items'] ?? [];
                                    $rowspan = max(1, count($items));
                                @endphp
                                @if (count($items) === 0)
                                    <tr>
                                        <td class="num text-center">{{ $i + 1 }}</td>
                                        <td style="white-space: pre-wrap;">{{ $row['destination'] ?? '—' }}</td>
                                        <td class="items-cell">—</td>
                                        <td class="num text-center">{{ (int) ($row['total_items_qty'] ?? 0) }}</td>
                                        <td class="num text-center">{{ isset($row['total_amount']) ? number_format((float) $row['total_amount'], 0, '.', ',') : '—' }}</td>
                                        <td class="num text-center">{{ number_format((float) ($row['paid_amount'] ?? 0), 0, '.', ',') }}</td>
                                        <td style="white-space: pre-wrap;">{{ ($row['destination_remark'] ?? null) ?: '—' }}</td>
                                    </tr>
                                @else
                                    @foreach ($items as $j => $it)
                                        <tr>
                                            @if ($j === 0)
                                                <td style="text-align: center" class="num" rowspan="{{ $rowspan }}">{{ $i + 1 }}</td>
                                                <td rowspan="{{ $rowspan }}" style="white-space: pre-wrap;">{{ $row['destination'] ?? '—' }}</td>
                                            @endif
                                            <td class="items-cell">
                                                <div style="font-weight: 700;">{{ $it['product_name'] ?? '—' }} . <span class="muted">{{ $it['qty'] ?? '—' }}</span></div>
                                            </td>
                                            @if ($j === 0)
                                                <td class="num text-center" rowspan="{{ $rowspan }}">{{ (int) ($row['total_items_qty'] ?? 0) }}</td>
                                                <td class="num text-center" rowspan="{{ $rowspan }}">{{ isset($row['total_amount']) ? number_format((float) $row['total_amount'], 0, '.', ',') : '—' }}</td>
                                                <td class="num text-center" rowspan="{{ $rowspan }}">{{ number_format((float) ($row['paid_amount'] ?? 0), 0, '.', ',') }}</td>
                                                <td rowspan="{{ $rowspan }}" style="white-space: pre-wrap;">{{ ($row['destination_remark'] ?? null) ?: '—' }}</td>
                                            @endif
                                        </tr>
                                    @endforeach
                                @endif
                            @endforeach
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="5" class="num text-center">Total labor cost</td>
                                <td class="num text-center">{{ number_format((float) ($totalLaborCost ?? 0), 0, '.', ',') }}</td>
                                <td></td>
                            </tr>
                            <tr>
                                <td colspan="5" class="num text-center">Total already paid</td>
                                <td class="num text-center">{{ number_format((float) ($totalPaidAmount ?? 0), 0, '.', ',') }}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>

                    <!-- Vertical block layout for 4-inch paper -->
                    <div class="cargo-blocks">
                        @foreach ($cargoRows as $i => $row)
                            @php
                                $items = $row['items'] ?? [];
                            @endphp
                            <div class="cargo-block">
                                <div class="dest">{{ $row['destination'] ?? '—' }}</div>

                                @if (count($items) > 0)
                                    <div class="items">
                                        @foreach ($items as $it)
                                            <div>{{ $it['product_name'] ?? '—' }} <span class="muted">. {{ $it['qty'] ?? '—' }}</span></div>
                                        @endforeach
                                    </div>
                                @else
                                    <div class="items"><span class="muted">—</span></div>
                                @endif

                                <div class="totals">
                                    <span>Items: {{ (int) ($row['total_items_qty'] ?? 0) }}</span>
                                    <span>Amt: {{ isset($row['total_amount']) ? number_format((float) $row['total_amount'], 0, '.', ',') : '—' }}</span>
                                    <span>Paid: {{ number_format((float) ($row['paid_amount'] ?? 0), 0, '.', ',') }}</span>
                                </div>

                                @if (!empty($row['destination_remark']))
                                    <div class="remark">{{ $row['destination_remark'] }}</div>
                                @endif
                            </div>
                        @endforeach
                        <div class="cargo-block">
                            <div class="totals">
                                <span>Total labor cost</span>
                                <span>{{ number_format((float) ($totalLaborCost ?? 0), 0, '.', ',') }}</span>
                            </div>
                        </div>
                        <div class="cargo-block">
                            <div class="totals">
                                <span>Total already paid</span>
                                <span>{{ number_format((float) ($totalPaidAmount ?? 0), 0, '.', ',') }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            @endif
        </section>

        <footer>
            Generated {{ now()->timezone(config('app.timezone'))->format('d-m-Y H:i') }}
        </footer>
    </div>
</body>
</html>
