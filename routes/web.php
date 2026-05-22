<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Admin\CategoryManagementController;
use App\Http\Controllers\Admin\MerchantManagementController;
use App\Http\Controllers\Admin\ProductManagementController;
use App\Http\Controllers\Admin\VehicleManagementController;
use App\Http\Controllers\Admin\TripManagementController;
use App\Http\Controllers\Admin\VoucherManagementController;
use App\Http\Controllers\Admin\VoucherWizardController;
use App\Http\Controllers\Admin\VoucherAdditionalCostCategoryController;
use App\Http\Controllers\Admin\FinanceCategoryController;
use App\Http\Controllers\Admin\FinanceLedgerController;
use App\Http\Controllers\Admin\TripCostCategoryController;
use App\Http\Controllers\Admin\RoleManagementController;
use App\Http\Controllers\Admin\UserManagementController;
use App\Http\Controllers\Admin\WarehouseManagementController;
use App\Http\Controllers\Admin\WarehouseFulfillmentController;
use App\Http\Controllers\Admin\OrganizationPublicPageController;
use App\Http\Controllers\Admin\OrganizationSettingsController;
use App\Http\Controllers\PublicOrganizationPageController;
use App\Http\Controllers\PublicVoucherTrackingController;
use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::post('/locale', function (Request $request) {
    $supported = array_keys((array) config('app.supported_locales', ['en' => 'English']));
    $fallback = (string) config('app.fallback_locale', 'en');

    $locale = (string) $request->input('locale', $fallback);
    if (! in_array($locale, $supported, true)) {
        $locale = $fallback;
    }

    $request->session()->put('locale', $locale);
    Cookie::queue(cookie()->forever('locale', $locale));
    App::setLocale($locale);

    return back();
})->name('locale.set');

Route::prefix('admin')->name('admin.')->group(function () {
    Route::middleware('guest')->group(function () {
        Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
        Route::post('/login', [AuthenticatedSessionController::class, 'store']);
        Route::get('/register', [RegisteredUserController::class, 'create'])->name('register');
        Route::post('/register', [RegisteredUserController::class, 'store']);
    });

    Route::middleware('auth')->group(function () {
        Route::get('/dashboard', function () {
            return Inertia::render('Dashboard');
        })->name('dashboard');

        Route::get('/', function () {
            return Inertia::render('Dashboard');
        })->name('home');

        Route::get('/ui-showcase', function () {
            return Inertia::render('UiShowcase');
        })->name('ui-showcase');

        Route::get('/system/organization-settings', [OrganizationSettingsController::class, 'edit'])
            ->middleware('permission:public_page.manage')
            ->name('organization-settings.edit');
        Route::patch('/system/organization-settings', [OrganizationSettingsController::class, 'update'])
            ->middleware('permission:public_page.manage')
            ->name('organization-settings.update');
        Route::patch('/system/organization-settings/voucher-print-template', [OrganizationSettingsController::class, 'updateVoucherPrintTemplate'])
            ->middleware('permission:public_page.manage')
            ->name('organization-settings.voucher-print-template');
        Route::post('/system/organization-settings/voucher-print-logo', [OrganizationSettingsController::class, 'uploadVoucherPrintLogo'])
            ->middleware('permission:public_page.manage')
            ->name('organization-settings.voucher-print-logo');
        Route::post('/system/organization-settings/logo', [OrganizationSettingsController::class, 'uploadLogo'])
            ->middleware('permission:public_page.manage')
            ->name('organization-settings.logo');
        Route::post('/system/organization-settings/cover', [OrganizationSettingsController::class, 'uploadCover'])
            ->middleware('permission:public_page.manage')
            ->name('organization-settings.cover');
        Route::post('/system/organization-settings/gallery', [OrganizationSettingsController::class, 'uploadGallery'])
            ->middleware('permission:public_page.manage')
            ->name('organization-settings.gallery');

        Route::get('/system/public-page', [OrganizationPublicPageController::class, 'edit'])
            ->middleware('permission:public_page.manage')
            ->name('public-page.edit');
        Route::patch('/system/public-page', [OrganizationPublicPageController::class, 'update'])
            ->middleware('permission:public_page.manage')
            ->name('public-page.update');

        Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');

        Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
        Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
        Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

        Route::prefix('iam')->name('iam.')->group(function () {
            Route::get('/users', [UserManagementController::class, 'index'])
                ->middleware('permission:users.manage')
                ->name('users.index');
            Route::post('/users', [UserManagementController::class, 'store'])
                ->middleware('permission:users.manage')
                ->name('users.store');
            Route::patch('/users/{user}', [UserManagementController::class, 'update'])
                ->middleware('permission:users.manage')
                ->name('users.update');
            Route::delete('/users/{user}', [UserManagementController::class, 'destroy'])
                ->middleware('permission:users.manage')
                ->name('users.destroy');

            Route::get('/roles', [RoleManagementController::class, 'index'])
                ->middleware('permission:roles.manage')
                ->name('roles.index');
            Route::post('/roles', [RoleManagementController::class, 'store'])
                ->middleware('permission:roles.manage')
                ->name('roles.store');
            Route::patch('/roles/{role}', [RoleManagementController::class, 'update'])
                ->middleware('permission:roles.manage')
                ->name('roles.update');
            Route::delete('/roles/{role}', [RoleManagementController::class, 'destroy'])
                ->middleware('permission:roles.manage')
                ->name('roles.destroy');
        });

        Route::prefix('finance')->name('finance.')->group(function () {
            Route::get('/reports', [FinanceLedgerController::class, 'reports'])
                ->middleware('permission:finance.view')
                ->name('reports.index');
            Route::get('/ledger', [FinanceLedgerController::class, 'index'])
                ->middleware('permission:finance.view')
                ->name('ledger.index');
            Route::post('/entries', [FinanceLedgerController::class, 'store'])
                ->middleware('permission:finance.manage')
                ->name('entries.store');
            Route::patch('/entries/{entry}', [FinanceLedgerController::class, 'update'])
                ->middleware('permission:finance.manage')
                ->name('entries.update');
            Route::delete('/entries/{entry}', [FinanceLedgerController::class, 'destroy'])
                ->middleware('permission:finance.manage')
                ->name('entries.destroy');

            Route::get('/categories', [FinanceCategoryController::class, 'index'])
                ->middleware('permission:finance.manage')
                ->name('categories.index');
            Route::post('/categories', [FinanceCategoryController::class, 'store'])
                ->middleware('permission:finance.manage')
                ->name('categories.store');
            Route::patch('/categories/{category}', [FinanceCategoryController::class, 'update'])
                ->middleware('permission:finance.manage')
                ->name('categories.update');
            Route::delete('/categories/{category}', [FinanceCategoryController::class, 'destroy'])
                ->middleware('permission:finance.manage')
                ->name('categories.destroy');
        });

        Route::get('/master/warehouses', [WarehouseManagementController::class, 'index'])
            ->middleware('permission:warehouses.view')
            ->name('warehouses.index');
        Route::post('/master/warehouses', [WarehouseManagementController::class, 'store'])
            ->middleware('permission:warehouses.manage')
            ->name('warehouses.store');
        Route::patch('/master/warehouses/{warehouse}', [WarehouseManagementController::class, 'update'])
            ->middleware('permission:warehouses.manage')
            ->name('warehouses.update');
        Route::delete('/master/warehouses/{warehouse}', [WarehouseManagementController::class, 'destroy'])
            ->middleware('permission:warehouses.manage')
            ->name('warehouses.destroy');

        Route::get('/master/voucher-additional-cost-categories', [VoucherAdditionalCostCategoryController::class, 'index'])
            ->middleware('permission:vouchers.manage')
            ->name('voucher-additional-cost-categories.index');
        Route::post('/master/voucher-additional-cost-categories', [VoucherAdditionalCostCategoryController::class, 'store'])
            ->middleware('permission:vouchers.manage')
            ->name('voucher-additional-cost-categories.store');
        Route::patch('/master/voucher-additional-cost-categories/{category}', [VoucherAdditionalCostCategoryController::class, 'update'])
            ->middleware('permission:vouchers.manage')
            ->name('voucher-additional-cost-categories.update');
        Route::delete('/master/voucher-additional-cost-categories/{category}', [VoucherAdditionalCostCategoryController::class, 'destroy'])
            ->middleware('permission:vouchers.manage')
            ->name('voucher-additional-cost-categories.destroy');

        Route::get('/master/trip-cost-categories', [TripCostCategoryController::class, 'index'])
            ->middleware('permission:trips.manage')
            ->name('trip-cost-categories.index');
        Route::post('/master/trip-cost-categories', [TripCostCategoryController::class, 'store'])
            ->middleware('permission:trips.manage')
            ->name('trip-cost-categories.store');
        Route::patch('/master/trip-cost-categories/{category}', [TripCostCategoryController::class, 'update'])
            ->middleware('permission:trips.manage')
            ->name('trip-cost-categories.update');
        Route::delete('/master/trip-cost-categories/{category}', [TripCostCategoryController::class, 'destroy'])
            ->middleware('permission:trips.manage')
            ->name('trip-cost-categories.destroy');

        Route::get('/master/categories', [CategoryManagementController::class, 'index'])
            ->middleware('permission:inventory.view')
            ->name('categories.index');
        Route::post('/master/categories', [CategoryManagementController::class, 'store'])
            ->middleware('permission:inventory.manage')
            ->name('categories.store');
        Route::patch('/master/categories/{category}', [CategoryManagementController::class, 'update'])
            ->middleware('permission:inventory.manage')
            ->name('categories.update');
        Route::delete('/master/categories/{category}', [CategoryManagementController::class, 'destroy'])
            ->middleware('permission:inventory.manage')
            ->name('categories.destroy');

        Route::get('/master/products', [ProductManagementController::class, 'index'])
            ->middleware('permission:inventory.view')
            ->name('products.index');
        Route::post('/master/products', [ProductManagementController::class, 'store'])
            ->middleware('permission:inventory.manage')
            ->name('products.store');
        Route::patch('/master/products/{product}', [ProductManagementController::class, 'update'])
            ->middleware('permission:inventory.manage')
            ->name('products.update');
        Route::delete('/master/products/{product}', [ProductManagementController::class, 'destroy'])
            ->middleware('permission:inventory.manage')
            ->name('products.destroy');

        Route::get('/master/merchants', [MerchantManagementController::class, 'index'])
            ->middleware('permission:inventory.view')
            ->name('merchants.index');
        Route::post('/master/merchants', [MerchantManagementController::class, 'store'])
            ->middleware('permission:inventory.manage')
            ->name('merchants.store');
        Route::patch('/master/merchants/{merchant}', [MerchantManagementController::class, 'update'])
            ->middleware('permission:inventory.manage')
            ->name('merchants.update');
        Route::delete('/master/merchants/{merchant}', [MerchantManagementController::class, 'destroy'])
            ->middleware('permission:inventory.manage')
            ->name('merchants.destroy');

        Route::get('/master/vehicles', [VehicleManagementController::class, 'index'])
            ->middleware('permission:inventory.view')
            ->name('vehicles.index');
        Route::post('/master/vehicles', [VehicleManagementController::class, 'store'])
            ->middleware('permission:inventory.manage')
            ->name('vehicles.store');
        Route::patch('/master/vehicles/{vehicle}', [VehicleManagementController::class, 'update'])
            ->middleware('permission:inventory.manage')
            ->name('vehicles.update');
        Route::delete('/master/vehicles/{vehicle}', [VehicleManagementController::class, 'destroy'])
            ->middleware('permission:inventory.manage')
            ->name('vehicles.destroy');

        Route::get('/operations/trips', [TripManagementController::class, 'index'])
            ->middleware('permission:trips.view')
            ->name('trips.index');
        Route::get('/operations/trips/create', [TripManagementController::class, 'create'])
            ->middleware('permission:trips.manage')
            ->name('trips.create');
        Route::get('/operations/trips/wizard/vehicle-search', [TripManagementController::class, 'vehicleSearch'])
            ->middleware('permission:trips.manage')
            ->name('trips.wizard.vehicle-search');
        Route::post('/operations/trips', [TripManagementController::class, 'store'])
            ->middleware('permission:trips.manage')
            ->name('trips.store');
        Route::get('/operations/trips/{trip}', [TripManagementController::class, 'show'])
            ->middleware('permission:trips.view')
            ->name('trips.show');
        Route::delete('/operations/trips/{trip}', [TripManagementController::class, 'destroy'])
            ->middleware('permission:trips.manage')
            ->name('trips.destroy');
        Route::get('/operations/trips/{trip}/manifest', [TripManagementController::class, 'manifest'])
            ->middleware('permission:trips.view')
            ->name('trips.manifest');
        Route::post('/operations/trips/{trip}/manifest-printed', [TripManagementController::class, 'markManifestPrinted'])
            ->middleware('permission:trips.manage')
            ->name('trips.manifest-printed');
        Route::patch('/operations/trips/{trip}/status', [TripManagementController::class, 'updateStatus'])
            ->middleware('permission:trips.manage')
            ->name('trips.status.update');
        Route::put('/operations/trips/{trip}/stops', [TripManagementController::class, 'syncStops'])
            ->middleware('permission:trips.manage')
            ->name('trips.stops.sync');
        Route::post('/operations/trips/{trip}/items', [TripManagementController::class, 'storeItem'])
            ->middleware('permission:trips.manage')
            ->name('trips.items.store');
        Route::post('/operations/trips/{trip}/vouchers/load', [TripManagementController::class, 'storeVoucherLoad'])
            ->middleware('permission:trips.manage')
            ->name('trips.vouchers.load');
        Route::post('/operations/trips/{trip}/vouchers/load-batch', [TripManagementController::class, 'storeVoucherLoadBatch'])
            ->middleware('permission:trips.manage')
            ->name('trips.vouchers.load-batch');
        Route::patch('/operations/trips/{trip}/items/{tripItem}', [TripManagementController::class, 'updateItem'])
            ->middleware('permission:trips.manage')
            ->name('trips.items.update');
        Route::delete('/operations/trips/{trip}/items/{tripItem}', [TripManagementController::class, 'destroyItem'])
            ->middleware('permission:trips.manage')
            ->name('trips.items.destroy');
        Route::patch('/operations/trips/{trip}/vouchers/{voucher}/stop', [TripManagementController::class, 'updateVoucherStop'])
            ->middleware('permission:trips.manage')
            ->name('trips.vouchers.stop.update');
        Route::delete('/operations/trips/{trip}/vouchers/{voucher}', [TripManagementController::class, 'destroyVoucher'])
            ->middleware('permission:trips.manage')
            ->name('trips.vouchers.destroy');
        Route::post('/operations/trips/{trip}/vouchers/{voucher}/delivery-confirmations', [TripManagementController::class, 'storeVoucherDeliveryConfirmations'])
            ->middleware('permission:trips.manage')
            ->name('trips.vouchers.delivery-confirmations.store');
        Route::post('/operations/trips/{trip}/items/{tripItem}/delivery-confirmations', [TripManagementController::class, 'storeDeliveryConfirmation'])
            ->middleware('permission:trips.manage')
            ->name('trips.items.delivery-confirmations.store');
        Route::post('/operations/trips/{trip}/items/{tripItem}/destination-receipts', [TripManagementController::class, 'storeDestinationReceipt'])
            ->middleware('permission:trips.manage')
            ->name('trips.items.destination-receipts.store');
        Route::post('/operations/trips/{trip}/delivery-confirmations', [TripManagementController::class, 'storeTripDeliveryConfirmations'])
            ->middleware('permission:trips.manage')
            ->name('trips.delivery-confirmations.store');
        Route::post('/operations/trips/{trip}/cost-entries', [TripManagementController::class, 'storeCostEntry'])
            ->middleware('permission:trips.manage')
            ->name('trips.cost-entries.store');
        Route::patch('/operations/trips/{trip}/cost-entries/{costEntry}', [TripManagementController::class, 'updateCostEntry'])
            ->middleware('permission:trips.manage')
            ->name('trips.cost-entries.update');
        Route::delete('/operations/trips/{trip}/cost-entries/{costEntry}', [TripManagementController::class, 'destroyCostEntry'])
            ->middleware('permission:trips.manage')
            ->name('trips.cost-entries.destroy');
        Route::post('/operations/trips/{trip}/net-income-ledger', [TripManagementController::class, 'storeNetIncomeLedgerEntry'])
            ->middleware(['permission:trips.view', 'permission:finance.manage'])
            ->name('trips.net-income-ledger.store');
        Route::get('/operations/fulfillment/inbox', [WarehouseFulfillmentController::class, 'index'])
            ->middleware('permission:trips.manage')
            ->name('fulfillment.inbox');
        Route::get('/operations/fulfillment/incoming', [WarehouseFulfillmentController::class, 'incoming'])
            ->middleware('permission:trips.manage')
            ->name('fulfillment.incoming');
        Route::post('/operations/fulfillment/instructions/{instruction}/dispatch', [WarehouseFulfillmentController::class, 'dispatchInstruction'])
            ->middleware('permission:trips.manage')
            ->name('fulfillment.instructions.dispatch');
        Route::post('/operations/fulfillment/warehouses/{warehouse}/vouchers/{voucher}/dispatch', [WarehouseFulfillmentController::class, 'dispatchVoucher'])
            ->middleware('permission:trips.manage')
            ->name('fulfillment.vouchers.dispatch');
        Route::post('/operations/fulfillment/vouchers/{voucher}/payments', [WarehouseFulfillmentController::class, 'storeVoucherPayment'])
            ->middleware(['permission:trips.manage', 'permission:payments.manage'])
            ->name('fulfillment.vouchers.payments.store');
        Route::post('/operations/fulfillment/vouchers/{voucher}/payment-waive', [WarehouseFulfillmentController::class, 'setVoucherWaived'])
            ->middleware(['permission:trips.manage', 'permission:payments.manage'])
            ->name('fulfillment.vouchers.payment-waive');

        Route::middleware(['permission:vouchers.manage', 'permission:inventory.manage'])->group(function () {
            Route::get('/operations/vouchers/create', [VoucherWizardController::class, 'create'])->name('vouchers.wizard.create');
            Route::get('/operations/vouchers/{voucher}/edit', [VoucherWizardController::class, 'edit'])->name('vouchers.wizard.edit');
            Route::get('/operations/vouchers/wizard/merchant-matches', [VoucherWizardController::class, 'merchantMatches'])->name('vouchers.wizard.merchant-matches');
            Route::get('/operations/vouchers/wizard/product-search', [VoucherWizardController::class, 'productSearch'])->name('vouchers.wizard.product-search');
            Route::post('/operations/vouchers/wizard/step1', [VoucherWizardController::class, 'storeStep1'])->name('vouchers.wizard.step1');
            Route::patch('/operations/vouchers/{voucher}/wizard/step1', [VoucherWizardController::class, 'updateStep1'])->name('vouchers.wizard.step1-update');
            Route::post('/operations/vouchers/{voucher}/wizard/lines', [VoucherWizardController::class, 'storeLine'])->name('vouchers.wizard.lines.store');
            Route::delete('/operations/vouchers/{voucher}/wizard/lines/{voucherItem}', [VoucherWizardController::class, 'destroyLine'])->name('vouchers.wizard.lines.destroy');
            Route::post('/operations/vouchers/{voucher}/wizard/finish', [VoucherWizardController::class, 'finish'])->name('vouchers.wizard.finish');
        });

        Route::get('/operations/vouchers', [VoucherManagementController::class, 'index'])
            ->middleware('permission:vouchers.view')
            ->name('vouchers.index');
        Route::get('/operations/vouchers/{voucher}', [VoucherManagementController::class, 'show'])
            ->middleware('permission:vouchers.view')
            ->name('vouchers.show');
        Route::get('/operations/vouchers/{voucher}/print', [VoucherManagementController::class, 'print'])
            ->middleware('permission:vouchers.view|vouchers.manage')
            ->name('vouchers.print');
        Route::post('/operations/vouchers/{voucher}/payments', [VoucherManagementController::class, 'storePayment'])
            ->middleware('permission:payments.manage')
            ->name('vouchers.payments.store');
        Route::post('/operations/vouchers/{voucher}/mark-paid', [VoucherManagementController::class, 'markPaid'])
            ->middleware('permission:payments.manage')
            ->name('vouchers.mark-paid');
        Route::post('/operations/vouchers/{voucher}/payment-waive', [VoucherManagementController::class, 'setWaived'])
            ->middleware('permission:payments.manage')
            ->name('vouchers.payment-waive');
        Route::patch('/operations/vouchers/{voucher}/items/{voucherItem}', [VoucherManagementController::class, 'updateItem'])
            ->middleware('permission:vouchers.manage')
            ->name('vouchers.items.update');
        Route::post('/operations/vouchers', [VoucherManagementController::class, 'store'])
            ->middleware('permission:vouchers.manage')
            ->name('vouchers.store');
        Route::patch('/operations/vouchers/{voucher}', [VoucherManagementController::class, 'update'])
            ->middleware('permission:vouchers.manage')
            ->name('vouchers.update');
        Route::delete('/operations/vouchers/{voucher}', [VoucherManagementController::class, 'destroy'])
            ->middleware('permission:vouchers.manage')
            ->name('vouchers.destroy');
    });
});

Route::get('/p/{slug}', [PublicOrganizationPageController::class, 'show'])->name('public-page.show');
Route::get('/track/{org}/{voucherNo}', [PublicVoucherTrackingController::class, 'show'])
    ->where(['org' => '[A-Za-z0-9_-]+', 'voucherNo' => '[A-Za-z0-9_-]+' ])
    ->name('public.voucher.track');

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => true,
        'canRegister' => true,
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});
