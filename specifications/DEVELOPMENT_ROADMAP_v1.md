# Warehouse SaaS Development Roadmap (Phase by Phase)

## Objective
Deliver the multi-tenant Warehouse Management SaaS incrementally with stable milestones, so business can start early and scale safely.

## Delivery Principles
- Ship usable value every phase.
- Keep tenant isolation and permission checks from day 1.
- Build auditability and data consistency before advanced features.
- Prioritize operational workflow first, then growth features.

## Implementation status (living document)
Legend: **Done** = implemented in repo | **Partial** = started or draft only | **Open** = not started

| Phase | Status | Notes |
|-------|--------|--------|
| Phase 0 | **Partial** | Specs and planning docs exist; formal stakeholder sign-off, ERD asset, and CI baseline still to close. |
| Phase 1 | **Partial** | Tenant + RBAC + IAM UI/API done; `user_warehouse_access`, audit log persistence, and PHPUnit `APP_URL` baseline added—expand automated tests beyond Phase 1 samples. |
| Phase 2 | **Partial** | Master data: warehouses, categories, products, merchants, vehicles + stock by warehouse (`warehouse_stocks`, `stock_movements`, manual ADJUSTMENT). Remaining: automated movement types beyond adjustment, richer stock UX, Phase 3 vouchers/trips. |
| Phase 3–7 | **Open** | Phase 3 started: vouchers schema + draft admin CRUD (see Phase 3 section). Phases 4–7 not started. |

## Phase 0 - Foundation and Planning (1-2 weeks)
## Goals
- Finalize scope and technical standards.
- Set project baseline for team execution.

## Deliverables
- [x] Draft SRS (`specifications/SRS_v1.md`) — **Partial** until formal sign-off.
- [x] Draft DB schema (`specifications/DB_SCHEMA_v1.md`) — **Partial** until formal sign-off.
- [x] Migration sequence notes (`specifications/phase-0/DATA_MODEL_AND_MIGRATION_PLAN_v1.md`).
- [x] Architecture / standards / sign-off checklist (`specifications/phase-0/*`).
- [x] Permission matrix draft (`specifications/PERMISSION_MATRIX_v1.md`).
- [ ] Final SRS + DB schema **stakeholder sign-off**.
- [ ] ERD diagram (visual) as agreed artifact.
- [ ] Coding conventions, branching strategy, **CI baseline** (pipelines, required checks).
- [ ] Environment setup documented (local, staging, production).

## Exit Criteria
- All core entities and workflows approved.
- No open blocker in business rules or role model.

## Phase 1 - Core Platform and Tenant Access (2-3 weeks)
## Goals
- Build multi-tenant architecture and secure access layer.

## Scope
- [x] Authentication: login/logout (admin routes under `/admin`); password reset / change password — **available via Laravel Breeze-style auth** (verify flows against your deployed `routes`).
- [x] Tenant model: `organizations` table; `users.organization_id`; signup creates org + first user.
- [x] Tenant isolation: IAM controllers scope queries by current user’s `organization_id`; cross-tenant IDs return 404 where enforced.
- [x] RBAC: `roles`, `permissions`, `role_permissions`, `user_roles`, `user_permissions`; `PermissionSeeder`; `TenantRoleBootstrapper` (default roles: super_admin, manager, clerk, finance, viewer).
- [x] First signup user receives Super Admin with all permissions (permissions auto-seeded if empty).
- [x] User management: create / edit / deactivate (status) / delete via `UserManagementController` + Inertia **Users** page.
- [x] Role management: create / update / delete custom roles; system roles protected from modification; Inertia **Roles** page with responsive layout and collapsible permission list on small screens.
- [x] Permission enforcement: `permission` route middleware; flash messages shared via `HandleInertiaRequests`.
- [x] Warehouse access scope per user (`user_warehouse_access` + IAM UI: warehouse multi-select and access level on user create/edit).
- [x] Basic audit logging (`audit_logs` table + writes for auth login/logout/register, IAM user/role, warehouse mutations).

## Deliverables
- [x] Working admin IAM for users and roles (Inertia + MUI) under `/admin/iam/*`.
- [x] Permission middleware baseline (`EnsureUserHasPermission`).
- [x] Seeded permissions + default tenant roles on organization creation.

## Exit Criteria
- Cross-tenant access blocked in all tested scenarios.
- Permission matrix works for critical actions.
- **Remaining to close Phase 1:** broader automated coverage (all IAM/tenant edge cases); optional audit log viewer.

## Phase 2 - Master Data and Inventory Base (2-3 weeks)
**Status: Partial** — Master data CRUD (warehouses, categories, products, merchants, vehicles) and stock listing + signed quantity adjustments (`/admin/inventory/stocks`) are in place; voucher-driven movements remain Phase 3.

## Goals
- Enable operational master data and stock foundation.

## Scope
- Warehouse CRUD — **implemented (admin UI + API routes)**.
- Categories and products CRUD — **implemented (admin UI + API routes)**.
- Merchant CRUD — **implemented** (`/admin/master/merchants`).
- Vehicle CRUD — **implemented** (`/admin/master/vehicles`).
- Stock ledger base:
  - `warehouse_stocks` — **implemented**
  - `stock_movements` — **implemented** (manual `ADJUSTMENT` rows from admin)
- Initial inventory adjustments with audit trail — **partial** (adjustment UI + `AuditLogger` + movement row; no dedicated “adjustment document” entity yet).

## Deliverables
- Master data modules ready for daily operation setup.
- Reliable stock balance read model by warehouse and product.

## Exit Criteria
- Stock movement entries are traceable and balanced.
- Master data permissions enforced by role.

## Phase 3 - Voucher and Shipment Operations MVP (3-4 weeks)
**Status: Partial** — `vouchers` / `voucher_items` migrations, models, `VoucherManagementController` (list + create/update/delete **draft only**), Inertia **Vouchers** page (`/admin/operations/vouchers`), `vouchers.view` / `vouchers.manage` routes, `AuditLogger` on writes, tenant isolation test. Wizard **confirm**: finishing the wizard sets status **DRAFT → CONFIRMED** (`voucher.confirm` audit). **Trips MVP**: `trips`, `trip_stops`, `trip_items` tables; **Trips** admin list/create/detail (`trips.view` / `trips.manage`) with vehicle, source warehouse, ordered stops (`trip.create` audit). **Trip cargo**: load **`trip_items`** from **CONFIRMED** voucher lines at the trip source warehouse with partial quantities (cap across non-cancelled trips; merges duplicate lines on the same trip; syncs `voucher_items.loaded_qty`; `trip_item.load` audit). **Voucher detail** page for non-draft vouchers. Remaining: delivery confirmations, voucher lifecycle (LOADING / IN_TRANSIT / …), stock linkage, manifests/print, payment logs UI.

## Goals
- Implement end-to-end intake-to-delivery workflow.

## Scope
- Voucher create/edit/confirm lifecycle. — **partial** (create/edit/delete **draft** in CRUD + wizard; **confirm** via wizard review sets **CONFIRMED**; later statuses not wired yet).
- Voucher item lines with source/destination details. — **implemented** (admin lines + validation scoped to tenant warehouses/products).
- Trip planning with vehicle assignment. — **partial** (create/list/detail trip + vehicle + source warehouse + ordered **trip_stops**; load **`trip_items`** from confirmed lines on detail).
- Multi-stop trip support (`trip_stops`). — **implemented** (ordered stops; warehouse and/or address fields).
- Load to trip (`trip_items`) with partial loading. — **implemented** (confirmed lines from source warehouse; remaining qty across trips; optional drop stop).
- Delivery confirmation with partial/full received quantity.
- Driver manifest/list generation (screen + print layout).
- Voucher/line payment status tracking (UNPAID/PARTIAL/PAID).

## Deliverables
- Real operational workflow from intake to destination confirmation.
- Printable merchant voucher and driver manifest.

## Exit Criteria
- One trip can serve multiple stops.
- Partial load/delivery works without stock inconsistency.
- Workflow status transitions validated.

## Phase 4 - Public Portfolio Page per Organization (1-2 weeks)
**Status: Open** (specified in SRS/DB draft only.)

## Goals
- Give each tenant one public page for business promotion.

## Scope
- `organization_public_pages` management UI.
- Public route by unique slug.
- Publish/unpublish control.
- Editable business profile content:
  - logo, cover, about, services, contacts, address, social links.
- SEO metadata fields.

## Deliverables
- Public-facing portfolio page live for each published tenant.
- Tenant-side content management page with permission checks.

## Exit Criteria
- Public page accessible without login.
- Unpublished pages are not publicly visible.

## Phase 5 - Subscription and Billing (Monthly Plan) (2-3 weeks)
**Status: Open** (specified in SRS/DB draft only.)

## Goals
- Enable SaaS monetization and subscription lifecycle.

## Scope
- Subscription plans management (platform side).
- Organization subscription lifecycle:
  - Trial, Active, Past Due, Suspended, Cancelled/Expired
- Invoice generation per monthly period.
- Manual payment recording (initial billing method).
- Subscription status logs and basic billing audit.
- Access policy hook for inactive/suspended tenants (with grace period support).

## Deliverables
- Billing dashboard for platform admin.
- Tenant subscription status visibility.
- Invoice and payment history records.

## Exit Criteria
- Expired/suspended subscription behavior enforced as defined.
- Invoice and payment records reconcile correctly.

## Phase 6 - Reporting, Hardening, and UAT (2-3 weeks)
**Status: Open**

## Goals
- Make the system reliable for production rollout.

## Scope
- Operational reports:
  - intake by warehouse
  - in-transit shipments
  - delivery completion
  - freight outstanding
  - stock balances
- Billing reports:
  - active/past-due/suspended tenants
  - monthly recurring revenue summary
- Performance tuning for key listing/report queries.
- Security hardening (authorization coverage, rate limiting, input validation).
- UAT with real business scenarios and bug fixes.

## Deliverables
- UAT sign-off.
- Production readiness checklist completion.

## Exit Criteria
- No critical/high-severity open defects.
- Business users can complete core daily workflow independently.

## Phase 7 - Production Launch and Stabilization (1-2 weeks)
**Status: Open**

## Goals
- Launch safely and stabilize post-go-live.

## Scope
- Production deployment and data backup verification.
- Monitoring and alert setup.
- Incident playbook and support channels.
- Hypercare period for rapid bug response.

## Deliverables
- Go-live completion report.
- Post-launch issue log and patch release plan.

## Exit Criteria
- Stable operations during hypercare window.
- Agreed SLA response process active.

## Cross-Phase Quality Gates (Apply to Every Phase)
- Test coverage for new critical flows.
- Permission validation for every new endpoint/page.
- Audit logging for sensitive actions.
- Responsive UI verification (mobile/tablet/desktop).
- Desktop print verification for voucher/manifest outputs.

## Suggested Timeline Summary
- Phase 0: 1-2 weeks
- Phase 1: 2-3 weeks
- Phase 2: 2-3 weeks
- Phase 3: 3-4 weeks
- Phase 4: 1-2 weeks
- Phase 5: 2-3 weeks
- Phase 6: 2-3 weeks
- Phase 7: 1-2 weeks

Estimated total: ~14 to 22 weeks (depending on team size and feedback cycles).

## Recommended Team Structure
- 1 Tech Lead / Architect
- 2-3 Full-stack Developers
- 1 QA Engineer
- 1 Product/Business Reviewer (part-time from operations)

## Immediate Next Step
1. **Close Phase 1 gaps:** extend **automated tests** beyond current Phase 1 samples; add **audit log** review/export if needed for ops.
2. **Continue Phase 2 / bridge to Phase 3:** reserve/release stock rules, movement types from vouchers/trips, and reporting on movements.
3. **Phase 3 next slice:** **`trip_items`** from confirmed vouchers (partial load rules), **`delivery_confirmations`**, driver manifest / print, then voucher ↔ stock movements.
4. Optionally maintain a sprint backlog (user stories + acceptance criteria) aligned to the checklist above.

