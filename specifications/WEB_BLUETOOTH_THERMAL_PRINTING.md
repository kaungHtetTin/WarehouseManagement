# Web Bluetooth Thermal Printing

## Overview

This project now includes direct BLE ESC/POS thermal printing from the browser on the existing voucher print page.

Frontend flow:

1. React voucher print page loads voucher data from Laravel/Inertia.
2. User connects a BLE receipt printer with `navigator.bluetooth.requestDevice()`.
3. React encodes the voucher into ESC/POS bytes with `@point-of-sale/receipt-printer-encoder`.
4. The app writes the bytes directly to the printer's BLE write characteristic.

## Implemented Files

- `resources/js/Pages/Admin/Operations/VoucherPrint.jsx`
- `resources/js/utils/printing/webBluetoothEscPosPrinter.js`
- `resources/js/utils/printing/buildVoucherEscPosReceipt.js`

## Laravel API Example

Laravel does not need to handle printing logic. It only needs to provide authenticated invoice data.

Example API response shape:

```php
Route::middleware('auth:sanctum')->get('/pos/invoices/{voucher}', function (\App\Models\Voucher $voucher) {
    abort_unless($voucher->organization_id === request()->user()->organization_id, 404);

    $voucher->load([
        'merchant:id,name,phone,address',
        'sourceWarehouse:id,city,address',
        'defaultToWarehouse:id,city,address',
        'payments:id,voucher_id,amount,currency,paid_at',
        'items.product:id,name,unit,sku',
        'items.fromWarehouse:id,city,address',
    ]);

    return response()->json([
        'voucher' => $voucher,
        'tracking_url' => route('public.voucher.track', [
            'org' => request()->user()->organization->code,
            'voucherNo' => $voucher->voucher_no,
        ]),
        'template' => [
            'header_title' => request()->user()->organization->name,
            'header_subtitle' => 'Voucher',
            'show_payment_status' => true,
        ],
    ]);
});
```

## Android Chrome Notes

- Web Bluetooth requires `HTTPS` or `localhost`.
- Android Chrome can print directly only to BLE GATT printers.
- Classic Bluetooth SPP printers are not supported by Web Bluetooth.
- First connection requires a user gesture and permission prompt.
- Reconnect can work through `navigator.bluetooth.getDevices()` when the browser supports it and the printer has already been granted permission.

## Error Handling

Typical browser and printer errors handled in the UI:

- user cancels printer picker
- unsupported browser
- non-HTTPS environment
- printer disconnects during print
- unsupported BLE characteristic on selected printer
- reconnect target no longer available

The UI exposes:

- connection state chip
- error alert
- success/error snackbars
- connect / reconnect / disconnect / print actions

## Compatibility Guide

Works best with:

- BLE ESC/POS thermal printers
- Epson BLE ESC/POS models
- XPrinter BLE models
- Rongta BLE models
- GOOJPRT BLE models

Important limitation:

- brand name alone is not enough
- the printer must expose a writable BLE characteristic
- many low-cost thermal printers advertise only classic Bluetooth SPP and will not work in Web Bluetooth

## Production Deployment

Checklist:

1. Serve the app over `HTTPS`.
2. Test on Android Chrome with the target BLE printer model.
3. Keep receipt content small enough for the printer buffer.
4. Use chunked writes to avoid BLE overflow.
5. Save the preferred printer only after a successful connection.
6. Provide a reconnect button for cashier workflow recovery.
7. Keep a browser print fallback for non-BLE environments if needed.

## Unicode Notes

The receipt encoder uses printer codepage mapping with automatic selection, but full Unicode output depends on the printer's firmware and installed code pages. Burmese and other non-Latin scripts may need a model-specific strategy if the target printer cannot render them correctly.
