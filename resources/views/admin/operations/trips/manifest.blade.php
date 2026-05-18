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
            padding: 1rem;
            color: #111;
            background: #fafafa;
            font-size: 13px;
            line-height: 1.45;
        }
        .wrap { max-width: 960px; margin: 0 auto; background: #fff; padding: 1.25rem 1.5rem 2rem; border: 1px solid var(--border); border-radius: 8px; }
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
        section { margin-top: 1.25rem; }
        h2 { font-size: 1rem; margin: 0 0 0.5rem; border-bottom: 2px solid #eee; padding-bottom: 0.25rem; }
        dl.grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 0.65rem 1.25rem;
            margin: 0;
        }
        dl.grid dt { margin: 0; font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
        dl.grid dd { margin: 0.15rem 0 0; font-weight: 600; word-break: break-word; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        th, td { border: 1px solid var(--border); padding: 0.4rem 0.45rem; text-align: left; vertical-align: top; word-break: break-word; }
        th { background: #f4f4f6; font-weight: 700; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.02em; }
        td.num { text-align: right; white-space: nowrap; }
        .muted { color: var(--muted); font-size: 0.85rem; }
        .items-cell { font-size: 0.82rem; line-height: 1.35; }
        .items-cell .muted { font-size: 0.8rem; }
        .cargo-table { table-layout: fixed; }
        .cargo-table th { white-space: nowrap; }
        .cargo-table th.num { text-align: right; }
        .cargo-table tbody tr { page-break-inside: avoid; break-inside: avoid; }
        footer { margin-top: 1.5rem; padding-top: 0.75rem; border-top: 1px solid #eee; font-size: 0.8rem; color: var(--muted); }
        @media print {
            @page { size: A4; margin: 10mm; }
            body { background: #fff; padding: 0; }
            body { font-size: 10px; }
            .wrap { border: none; max-width: 190mm; margin: 0 auto; padding: 0; }
            .screen-actions { display: none !important; }
            .flash { border-color: #ccc; background: #fff; }
            a { color: #000; text-decoration: none; }
            table { font-size: 10px; }
            th { font-size: 9px; }
        }
        table .text-center {
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="wrap">
        <div class="screen-actions">
            <a href="{{ $adminAppUrl }}/operations/trips/{{ $trip->id }}">← Back to trip</a>
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

        <header>
            <h1>Trip slip — {{ $trip->trip_no }}</h1>
            <p class="sub">{{ $trip->organization->name ?? 'Organization' }} · Status {{ $trip->status }}</p>
        </header>

        <section>
            <h2>Trip</h2>
            <dl class="grid">
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
                    <dd>{{ $trip->manifest_printed_at ? $trip->manifest_printed_at->timezone(config('app.timezone'))->format('Y-m-d H:i') : '—' }}</dd>
                </div>
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
                            <col style="width: 8mm;">
                            <col style="width: 18mm;">
                            <col style="width: 14mm;">
                            <col style="width: 14mm;">
                            <col style="width: 60mm;">
                            <col style="width: 46mm;">
                            <col style="width: 30mm;">
                        </colgroup>
                        <thead>
                            <tr>
                                <th class="text-center">No.</th>
                                <th class="num text-center">AMT</th>
                                <th class="text-center">Paid</th>
                                <th class="num text-center">ITEMS</th>
                                <th class="text-center">Items</th>
                                <th class="text-center">DEST.</th>
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
                                        <td class="num text-center">{{ isset($row['total_amount']) ? number_format((float) $row['total_amount'], 0, '.', ',') : '—' }}</td>
                                        <td class="text-center">{{ $row['payment_status'] ?? '—' }}</td>
                                        <td class="num text-center">{{ (int) ($row['total_items_qty'] ?? 0) }}</td>
                                        <td class="items-cell">—</td>
                                        <td style="white-space: pre-wrap;">{{ $row['destination'] ?? '—' }}</td>
                                        <td style="white-space: pre-wrap;">{{ ($row['destination_remark'] ?? null) ?: '—' }}</td>
                                    </tr>
                                @else
                                    @foreach ($items as $j => $it)
                                        <tr>
                                            @if ($j === 0)
                                                <td style="text-align: center" class="num" rowspan="{{ $rowspan }}">{{ $i + 1 }}</td>
                                                <td class="num text-center" rowspan="{{ $rowspan }}">{{ isset($row['total_amount']) ? number_format((float) $row['total_amount'], 0, '.', ',') : '—' }}</td>
                                                <td class="text-center" rowspan="{{ $rowspan }}">{{ $row['payment_status'] ?? '—' }}</td>
                                                <td class="num text-center" rowspan="{{ $rowspan }}">{{ (int) ($row['total_items_qty'] ?? 0) }}</td>
                                            @endif

                                            <td class="items-cell">
                                                <div style="font-weight: 700;">{{ $it['product_name'] ?? '—' }} . <span class="muted">{{ $it['qty'] ?? '—' }}</span></div>
                                            </td>

                                            @if ($j === 0)
                                                <td rowspan="{{ $rowspan }}" style="white-space: pre-wrap;">{{ $row['destination'] ?? '—' }}</td>
                                                <td rowspan="{{ $rowspan }}" style="white-space: pre-wrap;">{{ ($row['destination_remark'] ?? null) ?: '—' }}</td>
                                            @endif
                                        </tr>
                                    @endforeach
                                @endif
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </section>

        <footer>
            Generated {{ now()->timezone(config('app.timezone'))->format('Y-m-d H:i') }}
        </footer>
    </div>
</body>
</html>
