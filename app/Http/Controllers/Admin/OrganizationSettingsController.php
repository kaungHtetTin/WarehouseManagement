<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationSettingsController extends Controller
{
    private function defaultVoucherPrintTemplate(Organization $organization): array
    {
        return [
            'paper_size' => 'A4',
            'header_title' => $organization->name,
            'header_subtitle' => 'Voucher',
            'show_logo' => false,
            'logo_url' => null,
            'show_contact' => false,
            'contact_phone' => null,
            'contact_email' => null,
            'contact_address' => null,
            'footer_note' => null,
            'show_payment_status' => true,
            'show_signature_boxes' => true,
        ];
    }

    private function normalizeVoucherPrintTemplate(array $input, array $defaults): array
    {
        $out = $defaults;

        $paper = array_key_exists('paper_size', $input) && is_string($input['paper_size']) ? strtoupper(trim($input['paper_size'])) : $defaults['paper_size'];
        $out['paper_size'] = in_array($paper, ['A4', 'RECEIPT_80'], true) ? $paper : $defaults['paper_size'];

        $out['header_title'] = array_key_exists('header_title', $input) && is_string($input['header_title']) ? trim($input['header_title']) : $defaults['header_title'];
        $out['header_subtitle'] = array_key_exists('header_subtitle', $input) && is_string($input['header_subtitle']) ? trim($input['header_subtitle']) : $defaults['header_subtitle'];
        $out['show_logo'] = array_key_exists('show_logo', $input) ? (bool) $input['show_logo'] : (bool) $defaults['show_logo'];
        $out['logo_url'] = array_key_exists('logo_url', $input) && is_string($input['logo_url']) ? trim($input['logo_url']) : $defaults['logo_url'];
        $out['show_contact'] = array_key_exists('show_contact', $input) ? (bool) $input['show_contact'] : (bool) $defaults['show_contact'];
        $out['contact_phone'] = array_key_exists('contact_phone', $input) && is_string($input['contact_phone']) ? trim($input['contact_phone']) : $defaults['contact_phone'];
        $out['contact_email'] = array_key_exists('contact_email', $input) && is_string($input['contact_email']) ? trim($input['contact_email']) : $defaults['contact_email'];
        $out['contact_address'] = array_key_exists('contact_address', $input) && is_string($input['contact_address']) ? trim($input['contact_address']) : $defaults['contact_address'];
        $out['footer_note'] = array_key_exists('footer_note', $input) && is_string($input['footer_note']) ? trim($input['footer_note']) : $defaults['footer_note'];
        $out['show_payment_status'] = array_key_exists('show_payment_status', $input) ? (bool) $input['show_payment_status'] : (bool) $defaults['show_payment_status'];
        $out['show_signature_boxes'] = array_key_exists('show_signature_boxes', $input) ? (bool) $input['show_signature_boxes'] : (bool) $defaults['show_signature_boxes'];

        if ($out['header_title'] === '') {
            $out['header_title'] = $defaults['header_title'];
        }
        if ($out['header_subtitle'] === '') {
            $out['header_subtitle'] = $defaults['header_subtitle'];
        }
        if ($out['logo_url'] === '') {
            $out['logo_url'] = null;
        }
        if ($out['contact_phone'] === '') {
            $out['contact_phone'] = null;
        }
        if ($out['contact_email'] === '') {
            $out['contact_email'] = null;
        }
        if ($out['contact_address'] === '') {
            $out['contact_address'] = null;
        }
        if ($out['footer_note'] === '') {
            $out['footer_note'] = null;
        }

        return $out;
    }

    public function edit(Request $request): Response
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $organization = Organization::query()
            ->whereKey($organizationId)
            ->firstOrFail();

        $voucherPrintTemplateDefaults = $this->defaultVoucherPrintTemplate($organization);
        $voucherPrintTemplateRaw = is_array($organization->voucher_print_template) ? $organization->voucher_print_template : [];
        $voucherPrintTemplate = $this->normalizeVoucherPrintTemplate($voucherPrintTemplateRaw, $voucherPrintTemplateDefaults);

        return Inertia::render('Admin/System/OrganizationSettings', [
            'organization' => $organization->only(['id', 'name', 'code']),
            'voucherPrintTemplate' => $voucherPrintTemplate,
        ]);
    }

    public function updateVoucherPrintTemplate(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'paper_size' => ['required', 'string', 'max:32', 'in:A4,RECEIPT_80'],
            'header_title' => ['required', 'string', 'max:80'],
            'header_subtitle' => ['nullable', 'string', 'max:120'],
            'show_logo' => ['required', 'boolean'],
            'logo_url' => ['nullable', 'string', 'max:2048'],
            'show_contact' => ['required', 'boolean'],
            'contact_phone' => ['nullable', 'string', 'max:50'],
            'contact_email' => ['nullable', 'string', 'max:50'],
            'contact_address' => ['nullable', 'string', 'max:500'],
            'footer_note' => ['nullable', 'string', 'max:255'],
            'show_payment_status' => ['required', 'boolean'],
            'show_signature_boxes' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($organizationId, $validated, $actor) {
            $organization = Organization::query()
                ->whereKey($organizationId)
                ->lockForUpdate()
                ->firstOrFail();

            $defaults = $this->defaultVoucherPrintTemplate($organization);
            $organization->voucher_print_template = $this->normalizeVoucherPrintTemplate($validated, $defaults);
            $organization->save();

            AuditLogger::record($actor, 'organization.voucher_print_template.update', $organization, [
                'voucher_print_template' => $organization->voucher_print_template,
            ]);
        });

        return Redirect::route('admin.organization-settings.edit')
            ->with('success', 'Voucher print template updated successfully.');
    }

    public function uploadVoucherPrintLogo(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'logo' => ['required', 'file', 'image', 'max:2048'],
        ]);

        $file = $validated['logo'];
        $ext = strtolower($file->getClientOriginalExtension() ?: 'png');
        if (! in_array($ext, ['png', 'jpg', 'jpeg', 'webp'], true)) {
            $ext = 'png';
        }

        $path = "org/{$organizationId}/voucher_logo.{$ext}";
        Storage::disk('public')->putFileAs("org/{$organizationId}", $file, "voucher_logo.{$ext}");
        $url = Storage::disk('public')->url($path);

        DB::transaction(function () use ($organizationId, $actor, $url) {
            $organization = Organization::query()
                ->whereKey($organizationId)
                ->lockForUpdate()
                ->firstOrFail();

            $defaults = $this->defaultVoucherPrintTemplate($organization);
            $current = is_array($organization->voucher_print_template) ? $organization->voucher_print_template : [];
            $next = array_merge($current, ['logo_url' => $url, 'show_logo' => true]);
            $organization->voucher_print_template = $this->normalizeVoucherPrintTemplate($next, $defaults);
            $organization->save();

            AuditLogger::record($actor, 'organization.voucher_print_logo.upload', $organization, [
                'voucher_print_logo_url' => $url,
            ]);
        });

        return Redirect::route('admin.organization-settings.edit')
            ->with('success', 'Voucher print logo uploaded successfully.');
    }
}
