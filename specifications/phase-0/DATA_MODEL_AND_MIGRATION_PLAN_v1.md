# Data Model and Migration Plan v1

## Purpose
Define implementation sequence for schema rollout with dependency-safe order.

## Decision Baseline
- Tenancy: shared DB with `organization_id` scoping.
- Keys: `bigint` (default for v1 unless changed before migration starts).
- Timestamps on all tables.
- Soft delete on selected master/config tables only.

## Migration Sequence

## Step 1: Tenant and Access Core
Tables:
- `organizations`
- `users`
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- `user_permissions` (optional)
- `user_warehouse_access`

Checks:
- Tenant-scoped unique constraints validated.
- Seed base permissions catalog.

## Step 2: Master Data
Tables:
- `warehouses`
- `categories`
- `products`
- `merchants`
- `vehicles`

Checks:
- Composite unique constraints per organization.
- Seed optional default categories.

## Step 3: Operational Transactions
Tables:
- `vouchers`
- `voucher_items`
- `trips`
- `trip_stops`
- `trip_items`
- `delivery_confirmations`

Checks:
- Status enum definitions aligned with SRS.
- FK integrity for source/destination references.
- Indexes for status/date-heavy queries.

## Step 4: Inventory Ledger
Tables:
- `warehouse_stocks`
- `stock_movements`

Checks:
- Unique stock row key: (`organization_id`, `warehouse_id`, `product_id`).
- Movement references index strategy validated.

## Step 5: Operational Payments and Audit
Tables:
- `voucher_payments`
- `payment_status_logs`
- `audit_logs`

Checks:
- Payment status change trail complete.
- Sensitive audit events defined.

## Step 6: Public Portfolio Feature
Tables:
- `organization_public_pages`

Checks:
- Unique slug constraint.
- Publish/unpublish metadata fields.

## Step 7: SaaS Billing
Tables:
- `subscription_plans`
- `organization_subscriptions`
- `subscription_invoices`
- `subscription_payments`
- `subscription_status_logs`

Checks:
- Billing lifecycle enums finalized.
- Invoice numbering uniqueness validated.
- Subscription enforcement hook defined.

## Enum Catalog (Baseline)

## Voucher Status
- `DRAFT`
- `CONFIRMED`
- `LOADING`
- `IN_TRANSIT`
- `PARTIALLY_DELIVERED`
- `DELIVERED`
- `CLOSED`
- `CANCELLED`

## Trip Status
- `PLANNED`
- `LOADING`
- `DEPARTED`
- `AT_STOP`
- `COMPLETED`
- `CANCELLED`

## Payment Status
- `UNPAID`
- `PARTIAL`
- `PAID`
- `WAIVED`

## Subscription Status
- `TRIAL`
- `ACTIVE`
- `PAST_DUE`
- `SUSPENDED`
- `CANCELLED`
- `EXPIRED`

## Rollback Guidelines
- Roll back in reverse migration order.
- Never hard-delete production transactional history to resolve migration issues.
- Prefer additive/fix-forward migrations after shared-environment deployment.

## Pre-Implementation Sign-off Needed
- Final key type choice (`bigint` or UUID).
- Final enum sets and transition rules.
- Final decision on payment gateway timeline (manual only vs hybrid in v1.x).

