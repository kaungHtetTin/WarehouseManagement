# Warehouse SaaS Permission Matrix v1

## Purpose
Define default role permissions for each organization (tenant) so access control is consistent and scalable.

## Scope
- Tenant-level roles only (not platform owner roles).
- Applies to Phase 1 and can be extended in later phases.
- Final enforcement is permission-code based, not hardcoded role names.

## Core Roles (Tenant)
- `super_admin`: Organization owner / full control
- `manager`: Operational manager
- `clerk`: Daily operation data entry user
- `finance`: Payment and billing focused user
- `viewer`: Read-only user

## Permission Catalog (v1)

## IAM
- `users.manage`
- `roles.manage`

## Warehouse
- `warehouses.view`
- `warehouses.manage`

## Inventory
- `inventory.view`
- `inventory.manage`

## Voucher / Shipment
- `vouchers.view`
- `vouchers.manage`

## Payment
- `payments.manage`

## Billing (SaaS subscription)
- `billing.view`
- `billing.manage`

## Public Profile
- `public_page.manage`

## Matrix (Recommended Defaults)

| Permission | Super Admin | Manager | Clerk | Finance | Viewer |
|---|---|---|---|---|---|
| users.manage | Yes | No | No | No | No |
| roles.manage | Yes | No | No | No | No |
| warehouses.view | Yes | Yes | Yes | Yes | Yes |
| warehouses.manage | Yes | Yes | No | No | No |
| inventory.view | Yes | Yes | Yes | Yes | Yes |
| inventory.manage | Yes | Yes | Yes | No | No |
| vouchers.view | Yes | Yes | Yes | Yes | Yes |
| vouchers.manage | Yes | Yes | Yes | No | No |
| payments.manage | Yes | Yes | No | Yes | No |
| billing.view | Yes | No | No | Yes | No |
| billing.manage | Yes | No | No | Yes | No |
| public_page.manage | Yes | Yes | No | No | No |

## Role Intent

## Super Admin
- Full tenant control.
- Can create users/roles and assign permissions.
- Owns security and organization-wide settings.

## Manager
- Runs warehouse operations and team workflow.
- Can manage operational modules without IAM full control.

## Clerk
- Executes day-to-day data entry and workflow tasks.
- No permission to change IAM or financial/billing configuration.

## Finance
- Manages payment updates and subscription/billing visibility.
- No operational master-data ownership by default.

## Viewer
- Read-only access for monitoring/reporting.
- No create/edit/delete actions.

## Recommended Rules
- First signup user must always receive `super_admin`.
- Never rely on role name in code checks; rely on permission codes.
- Support per-user overrides only when absolutely necessary.
- For branch-specific control, combine with `user_warehouse_access`.

## Assignment Policy (Suggested)
- New tenant bootstrap:
  1. Create `super_admin` role
  2. Assign all permissions to `super_admin`
  3. Assign role to signup user
- Optional seed default roles (`manager`, `clerk`, `finance`, `viewer`) with matrix defaults.

## Future Extension
- Add granular read permissions (e.g. `payments.view`, `billing.export`).
- Add module-level approval permissions (e.g. `vouchers.approve`).
- Add action audit permissions (e.g. `audit.view`).

