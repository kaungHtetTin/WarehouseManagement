<?php

namespace Tests\Feature\Phase3;

use App\Models\Organization;
use App\Models\Voucher;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicVoucherTrackingTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_tracking_page_defaults_to_myanmar_locale(): void
    {
        [$organization, $voucher] = $this->voucher();

        $response = $this->get(route('public.voucher.track', [
            'org' => $organization->code,
            'voucherNo' => $voucher->voucher_no,
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Public/VoucherTracking')
            ->where('i18n.locale', 'my')
            ->where('voucher.voucher_no', $voucher->voucher_no)
            ->where('tracking.code', 'CONFIRMED'));
    }

    public function test_public_tracking_page_accepts_english_locale_override(): void
    {
        [$organization, $voucher] = $this->voucher();

        $response = $this->get(route('public.voucher.track', [
            'org' => $organization->code,
            'voucherNo' => $voucher->voucher_no,
            'locale' => 'en',
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Public/VoucherTracking')
            ->where('i18n.locale', 'en'));
    }

    public function test_public_tracking_page_does_not_expose_draft_vouchers(): void
    {
        [$organization, $voucher] = $this->voucher('DRAFT');

        $response = $this->get(route('public.voucher.track', [
            'org' => $organization->code,
            'voucherNo' => $voucher->voucher_no,
        ]));

        $response->assertNotFound();
    }

    /**
     * @return array{0: Organization, 1: Voucher}
     */
    private function voucher(string $status = 'CONFIRMED'): array
    {
        $organization = Organization::factory()->create();
        $warehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
        ]);

        $voucher = Voucher::query()->create([
            'organization_id' => $organization->id,
            'voucher_no' => 'V-PUBLIC01',
            'voucher_date' => '2026-06-01',
            'source_warehouse_id' => $warehouse->id,
            'merchant_id' => null,
            'status' => $status,
            'payment_status' => 'UNPAID',
            'total_qty' => 1,
            'total_amount' => null,
            'remark' => null,
            'default_to_city' => 'Yangon',
            'default_to_address_line1' => '1 Public Road',
            'default_recipient_name' => 'Public Recipient',
            'default_recipient_phone' => '09123456789',
            'created_by' => null,
        ]);

        return [$organization, $voucher];
    }
}
