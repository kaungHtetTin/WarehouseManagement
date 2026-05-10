# Warehouse Management System (SaaS)

## Database Schema v1 (Draft)

This schema is designed for multi-tenant SaaS with role/permission control and shipment workflow.

## 1) Core Design Principles
- Every tenant-owned table includes `organization_id`.
- Use `id` as bigint/uuid primary key (project choice).
- Use `created_at`, `updated_at`, optional `deleted_at` for soft delete.
- Add proper foreign keys and composite indexes.
- Store immutable operational history (stock movements, payment logs, status logs).

## 2) Logical ER Overview
- One `organization` has many:
  - users, roles, warehouses, vehicles, merchants, products, vouchers, trips
  - subscriptions, invoices, payments
- One `warehouse` has many:
  - stock records, trip stops (as destination), voucher lines (source/destination references)
- One `voucher` has many `voucher_items`.
- One `trip` has many `trip_stops` and many `trip_items` (loaded lines).
- Delivery and payment can be partial at line level.
- One `organization` has one `organization_public_pages` record (public profile/portfolio).

## 3) Tables

## 3.1 Multi-tenant and Access Control

### `organizations`
- `id` (PK)
- `name`
- `code` (unique)
- `status` (ACTIVE/INACTIVE)
- `default_locale` (en/mm)
- `billing_status` (TRIAL/ACTIVE/PAST_DUE/SUSPENDED/CANCELLED, nullable cache field)
- `current_subscription_id` (nullable FK -> organization_subscriptions.id)
- timestamps

### `organization_public_pages`
- `id` (PK)
- `organization_id` (FK -> organizations.id, unique)
- `slug` (unique)
- `business_display_name`
- `tagline` (nullable)
- `about` (text nullable)
- `services` (json nullable)
- `phone` (nullable)
- `email` (nullable)
- `address` (nullable)
- `city` (nullable)
- `logo_url` (nullable)
- `cover_url` (nullable)
- `social_links` (json nullable)
- `seo_title` (nullable)
- `seo_description` (nullable)
- `published_at` (nullable)
- `is_published` (bool default false)
- `updated_by` (nullable FK -> users.id)
- timestamps

### `users`
- `id` (PK)
- `organization_id` (FK -> organizations.id, nullable for platform admin if needed)
- `name`
- `email` (unique per organization, or global unique by policy)
- `phone` (nullable)
- `password_hash`
- `is_platform_admin` (bool, default false)
- `status` (ACTIVE/INACTIVE)
- `last_login_at` (nullable)
- timestamps, soft delete

### `roles`
- `id` (PK)
- `organization_id` (FK)
- `name`
- `code`
- `is_system_role` (bool)
- timestamps
- unique: (`organization_id`, `code`)

### `permissions`
- `id` (PK)
- `code` (unique) e.g. `voucher.create`, `payment.update`
- `name`
- `module`
- timestamps

### `role_permissions`
- `role_id` (FK)
- `permission_id` (FK)
- PK: (`role_id`, `permission_id`)

### `user_roles`
- `user_id` (FK)
- `role_id` (FK)
- PK: (`user_id`, `role_id`)

### `user_permissions` (optional direct overrides)
- `user_id` (FK)
- `permission_id` (FK)
- `effect` (ALLOW/DENY)
- PK: (`user_id`, `permission_id`)

### `user_warehouse_access`
- `user_id` (FK)
- `warehouse_id` (FK)
- `access_level` (VIEW/OPERATE/MANAGE)
- PK: (`user_id`, `warehouse_id`)

## 3.2 Master Data

### `warehouses`
- `id` (PK)
- `organization_id` (FK)
- `code`
- `name`
- `city`
- `address` (nullable)
- `phone` (nullable)
- `is_main` (bool)
- `status` (ACTIVE/INACTIVE)
- timestamps, soft delete
- unique: (`organization_id`, `code`)

### `categories`
- `id` (PK)
- `organization_id` (FK)
- `name`
- `code` (nullable)
- `parent_id` (nullable FK -> categories.id)
- timestamps
- unique: (`organization_id`, `name`)

### `products`
- `id` (PK)
- `organization_id` (FK)
- `category_id` (FK -> categories.id, nullable)
- `sku` (nullable)
- `name`
- `unit` (piece, bag, kg, etc.)
- `default_weight` (decimal nullable)
- `status` (ACTIVE/INACTIVE)
- timestamps, soft delete
- index: (`organization_id`, `name`)

### `merchants`
- `id` (PK)
- `organization_id` (FK)
- `name`
- `phone` (nullable)
- `nrc_or_id` (nullable)
- `address` (nullable)
- timestamps

### `vehicles`
- `id` (PK)
- `organization_id` (FK)
- `warehouse_id` (nullable FK -> warehouses.id)
- `vehicle_no` (registration)
- `vehicle_type` (truck/van/etc.)
- `capacity_weight` (decimal nullable)
- `capacity_volume` (decimal nullable)
- `status` (ACTIVE/MAINTENANCE/INACTIVE)
- timestamps, soft delete
- unique: (`organization_id`, `vehicle_no`)

## 3.3 Inventory

### `warehouse_stocks`
- `id` (PK)
- `organization_id` (FK)
- `warehouse_id` (FK)
- `product_id` (FK)
- `qty_on_hand` (decimal)
- `qty_reserved` (decimal default 0)
- `qty_available` (generated or maintained)
- `updated_at`
- unique: (`organization_id`, `warehouse_id`, `product_id`)

### `stock_movements`
- `id` (PK)
- `organization_id` (FK)
- `movement_no` (unique per org)
- `movement_type` (INTAKE/LOAD/TRANSFER_OUT/TRANSFER_IN/DELIVERY/ADJUSTMENT)
- `warehouse_id` (FK)
- `product_id` (FK)
- `qty` (decimal; signed or store direction separately)
- `unit`
- `ref_type` (VOUCHER/TRIP/ADJUSTMENT)
- `ref_id`
- `note` (nullable)
- `created_by` (FK -> users.id)
- `created_at`
- indexes: (`organization_id`, `warehouse_id`, `product_id`, `created_at`)

## 3.4 Voucher and Shipment

### `vouchers`
- `id` (PK)
- `organization_id` (FK)
- `voucher_no` (unique per org)
- `voucher_date`
- `source_warehouse_id` (FK -> warehouses.id)
- `merchant_id` (FK -> merchants.id)
- `status` (DRAFT/CONFIRMED/LOADING/IN_TRANSIT/PARTIALLY_DELIVERED/DELIVERED/CLOSED/CANCELLED)
- `payment_status` (UNPAID/PARTIAL/PAID/WAIVED)
- `total_qty` (decimal)
- `total_amount` (decimal nullable)
- `remark` (nullable)
- `created_by` (FK -> users.id)
- timestamps
- index: (`organization_id`, `voucher_date`)

### `voucher_items`
- `id` (PK)
- `organization_id` (FK)
- `voucher_id` (FK -> vouchers.id)
- `line_no`
- `product_id` (FK -> products.id)
- `description` (nullable)
- `from_warehouse_id` (FK -> warehouses.id)
- `to_warehouse_id` (FK -> warehouses.id, nullable for non-warehouse stop)
- `to_city` (nullable)
- `qty` (decimal)
- `loaded_qty` (decimal default 0)
- `delivered_qty` (decimal default 0)
- `unit`
- `freight_rate` (decimal nullable)
- `freight_amount` (decimal nullable)
- `payment_status` (UNPAID/PARTIAL/PAID/WAIVED)
- `is_fragile` (bool default false)
- timestamps
- index: (`organization_id`, `voucher_id`)

### `trips`
- `id` (PK)
- `organization_id` (FK)
- `trip_no` (unique per org)
- `vehicle_id` (FK -> vehicles.id)
- `driver_name` (nullable)
- `driver_phone` (nullable)
- `source_warehouse_id` (FK -> warehouses.id)
- `departed_at` (nullable)
- `arrived_at` (nullable)
- `status` (PLANNED/LOADING/DEPARTED/AT_STOP/COMPLETED/CANCELLED)
- `manifest_printed_at` (nullable)
- `created_by` (FK -> users.id)
- timestamps

### `trip_stops`
- `id` (PK)
- `organization_id` (FK)
- `trip_id` (FK -> trips.id)
- `stop_order` (int)
- `warehouse_id` (nullable FK -> warehouses.id)
- `location_name` (nullable if warehouse set)
- `city` (nullable)
- `address` (nullable)
- `arrival_time` (nullable)
- `departure_time` (nullable)
- `status` (PENDING/ARRIVED/COMPLETED/SKIPPED)
- timestamps
- unique: (`trip_id`, `stop_order`)

### `trip_items`
- `id` (PK)
- `organization_id` (FK)
- `trip_id` (FK -> trips.id)
- `voucher_item_id` (FK -> voucher_items.id)
- `trip_stop_id` (nullable FK -> trip_stops.id)
- `loaded_qty` (decimal)
- `delivered_qty` (decimal default 0)
- `status` (LOADED/IN_TRANSIT/PARTIALLY_DELIVERED/DELIVERED/RETURNED)
- timestamps

### `delivery_confirmations`
- `id` (PK)
- `organization_id` (FK)
- `trip_item_id` (FK -> trip_items.id)
- `received_qty` (decimal)
- `received_by_user_id` (FK -> users.id, nullable)
- `received_by_name` (nullable)
- `received_at`
- `note` (nullable)
- `delivery_status` (FULL/PARTIAL/REJECTED)
- timestamps

## 3.5 Payments and Financial Tracking

### `voucher_payments`
- `id` (PK)
- `organization_id` (FK)
- `voucher_id` (FK -> vouchers.id)
- `voucher_item_id` (nullable FK -> voucher_items.id)
- `amount` (decimal)
- `currency` (default MMK)
- `payment_method` (CASH/TRANSFER/OTHER)
- `paid_at`
- `reference_no` (nullable)
- `received_by` (FK -> users.id)
- `note` (nullable)
- timestamps
- index: (`organization_id`, `voucher_id`, `paid_at`)

### `payment_status_logs`
- `id` (PK)
- `organization_id` (FK)
- `entity_type` (VOUCHER/VOUCHER_ITEM)
- `entity_id`
- `old_status`
- `new_status`
- `changed_by` (FK -> users.id)
- `changed_at`
- `reason` (nullable)

## 3.6 Audit and System Logs

### `audit_logs`
- `id` (PK)
- `organization_id` (nullable FK)
- `actor_user_id` (nullable FK -> users.id)
- `module`
- `action`
- `entity_type`
- `entity_id`
- `before_data` (json nullable)
- `after_data` (json nullable)
- `ip_address` (nullable)
- `user_agent` (nullable)
- `created_at`
- index: (`organization_id`, `module`, `created_at`)

## 3.7 Subscription and Billing (SaaS)

### `subscription_plans`
- `id` (PK)
- `code` (unique)
- `name`
- `description` (nullable)
- `price_monthly` (decimal)
- `currency` (default MMK)
- `max_users` (nullable)
- `max_warehouses` (nullable)
- `feature_flags` (json nullable)
- `is_active` (bool default true)
- timestamps

### `organization_subscriptions`
- `id` (PK)
- `organization_id` (FK -> organizations.id)
- `plan_id` (FK -> subscription_plans.id)
- `status` (TRIAL/ACTIVE/PAST_DUE/SUSPENDED/CANCELLED/EXPIRED)
- `billing_cycle` (MONTHLY)
- `start_date`
- `end_date` (nullable)
- `trial_end_date` (nullable)
- `grace_end_date` (nullable)
- `cancelled_at` (nullable)
- `auto_renew` (bool default true)
- `seats_limit` (nullable, override)
- `warehouses_limit` (nullable, override)
- `created_by` (nullable FK -> users.id)
- timestamps
- index: (`organization_id`, `status`)

### `subscription_invoices`
- `id` (PK)
- `organization_id` (FK -> organizations.id)
- `subscription_id` (FK -> organization_subscriptions.id)
- `invoice_no` (unique)
- `period_start`
- `period_end`
- `subtotal` (decimal)
- `discount_amount` (decimal default 0)
- `tax_amount` (decimal default 0)
- `total_amount` (decimal)
- `currency` (default MMK)
- `status` (DRAFT/ISSUED/PAID/VOID/OVERDUE)
- `issued_at` (nullable)
- `due_date` (nullable)
- `paid_at` (nullable)
- `notes` (nullable)
- timestamps
- index: (`organization_id`, `status`, `due_date`)

### `subscription_payments`
- `id` (PK)
- `organization_id` (FK -> organizations.id)
- `invoice_id` (FK -> subscription_invoices.id)
- `amount` (decimal)
- `currency` (default MMK)
- `payment_method` (CASH/TRANSFER/CARD/OTHER)
- `payment_ref` (nullable)
- `paid_at`
- `received_by` (nullable FK -> users.id)
- `note` (nullable)
- timestamps

### `subscription_status_logs`
- `id` (PK)
- `organization_id` (FK -> organizations.id)
- `subscription_id` (FK -> organization_subscriptions.id)
- `old_status`
- `new_status`
- `reason` (nullable)
- `changed_by` (nullable FK -> users.id)
- `changed_at`

## 4) Recommended Index Strategy
- All tenant tables: index `organization_id`.
- Workflow-heavy tables:
  - `vouchers`: (`organization_id`, `status`), (`organization_id`, `voucher_date`)
  - `voucher_items`: (`organization_id`, `payment_status`)
  - `trips`: (`organization_id`, `status`)
  - `trip_items`: (`organization_id`, `status`)
  - `warehouse_stocks`: unique composite on org+warehouse+product
- Public/billing tables:
  - `organization_public_pages`: unique `slug`, index (`organization_id`, `is_published`)
  - `organization_subscriptions`: (`organization_id`, `status`)
  - `subscription_invoices`: (`organization_id`, `status`, `due_date`)

## 5) Suggested Constraints
- Prevent cross-tenant FK mismatches (application-level validation + scoped queries).
- `delivered_qty <= loaded_qty <= qty` across related item records.
- Status transitions should follow allowed state machine rules.
- Payment totals should not exceed chargeable freight amount (unless override permission).

## 6) Migration Order (High Level)
1. organizations, users
2. roles, permissions, pivots
3. warehouses, categories, products, merchants, vehicles
4. vouchers, voucher_items
5. trips, trip_stops, trip_items
6. stock tables
7. operational payments, logs, audit
8. organization_public_pages
9. subscription_plans, organization_subscriptions, subscription_invoices, subscription_payments, subscription_status_logs

## 7) Phase-1 Minimal Tables (if reducing scope)
- organizations, users, roles, permissions
- warehouses, categories, products, merchants, vehicles
- vouchers, voucher_items
- trips, trip_stops, trip_items
- warehouse_stocks, stock_movements
- voucher_payments, audit_logs
- (If SaaS billing starts in phase 1) organization_public_pages, subscription_plans, organization_subscriptions, subscription_invoices

