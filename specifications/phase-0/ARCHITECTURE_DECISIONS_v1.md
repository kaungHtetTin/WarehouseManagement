# Architecture Decisions v1 (ADR-style)

## Status
Accepted for Phase 0 baseline.

## ADR-001: Multi-tenant Strategy
- **Decision**: Use shared database with row-level tenant isolation via `organization_id`.
- **Why**: Fastest to deliver, simpler operations, acceptable isolation for SaaS at this stage.
- **Rules**:
  - Every tenant-owned table includes `organization_id`.
  - Every repository/query applies tenant scope by default.
  - Cross-tenant access is blocked at policy + query layers.

## ADR-002: Authorization Model
- **Decision**: RBAC (`roles`, `permissions`) with optional warehouse-scoped access (`user_warehouse_access`).
- **Why**: Matches tenant Super Admin delegation model and operational flexibility.
- **Rules**:
  - Permission checks required for every mutating action.
  - Warehouse-specific actions also validate warehouse access.

## ADR-003: Workflow Ledger Strategy
- **Decision**: Preserve immutable movement/event history for traceability.
- **Why**: Required for operational reconciliation and dispute handling.
- **Rules**:
  - `stock_movements`, status logs, and payment logs are append-only.
  - Do not physically delete transactional history.

## ADR-004: Shipment Flow Model
- **Decision**: Separate voucher lines from trip loads and delivery confirmations.
- **Why**: Supports partial loading, multi-stop trips, and partial delivery without data loss.
- **Rules**:
  - `voucher_items` = commercial intent.
  - `trip_items` = loaded operational execution.
  - `delivery_confirmations` = destination receipt evidence.

## ADR-005: Public Portfolio Page
- **Decision**: One public page per organization via dedicated table and unique slug.
- **Why**: Clear tenant branding feature with low complexity.
- **Rules**:
  - Public read without login.
  - Edit/publish only by authorized tenant users.
  - Unpublished pages must be inaccessible publicly.

## ADR-006: Subscription and Billing Baseline
- **Decision**: Monthly subscription lifecycle with manual payment recording in v1.
- **Why**: Allows monetization before payment gateway integration.
- **Rules**:
  - Use plan/subscription/invoice/payment tables.
  - Enforce access policy for non-active subscriptions (with grace period support).

## ADR-007: Internationalization
- **Decision**: Bilingual UI support (Myanmar + English) from early phases.
- **Why**: Business requirement and avoids costly retrofit.
- **Rules**:
  - Language labels externalized.
  - Store locale preferences at organization/user level where needed.

## ADR-008: Print Capability
- **Decision**: Voucher/manifest print optimized for desktop only.
- **Why**: Matches operations and avoids mobile print complexity.
- **Rules**:
  - UI can be responsive on all devices.
  - Print actions and layouts are desktop-targeted.

## ADR-009: Key Type Strategy
- **Decision (proposed default)**: `bigint` auto-increment for v1, with unique business codes for public/reference IDs.
- **Why**: Simpler joins and migration speed for phase delivery.
- **Alternative**: UUID can be adopted later if external exposure needs increase.

## ADR-010: Soft Delete Policy
- **Decision**: Soft delete master/config data; never soft-delete immutable transactional logs.
- **Why**: preserve history and operational references.

