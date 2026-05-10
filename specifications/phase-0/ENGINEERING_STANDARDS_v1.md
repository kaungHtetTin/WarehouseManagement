# Engineering Standards v1

## Purpose
Define shared development standards to keep delivery consistent across phases.

## 1) Branching and PR Standards
- Use short-lived feature branches: `feature/<module>-<short-description>`.
- Keep PR scope focused to one module/change intent.
- PR template must include:
  - Problem and objective
  - Scope and out-of-scope
  - DB impact and rollback note
  - Test evidence
- Required checks before merge:
  - Lint pass
  - Test pass
  - Migration review approved

## 2) Code and Module Standards
- Follow service/module boundaries:
  - IAM
  - Warehouse/Inventory
  - Voucher/Trip/Delivery
  - Public Page
  - Billing
- Avoid cross-module tight coupling; expose internal services through clear interfaces.
- Add concise comments only for non-obvious logic.

## 3) API and Validation Standards
- Validate all write requests with explicit rules.
- Return consistent error payloads (validation, authorization, domain errors).
- Enforce tenant scope in all queries and service operations.
- Enforce permission checks in policy/middleware layers, not only UI.

## 4) Database Standards
- Every tenant-owned table contains `organization_id`.
- Add composite indexes for high-frequency filters (`organization_id`, status/date).
- Use foreign keys for referential integrity where operationally safe.
- Treat transactional history tables as append-only.

## 5) Security Standards
- No hardcoded secrets or tokens in source code.
- Use environment variables for credentials and sensitive configs.
- Apply least-privilege permission design.
- Log sensitive admin/payment changes into audit logs.

## 6) Testing Standards
- Unit tests:
  - status transition rules
  - permission decision logic
  - billing state transitions
- Feature tests:
  - auth flows
  - tenant scoping boundaries
  - core CRUD permissions
- Integration tests:
  - voucher -> trip -> delivery -> stock movement consistency
- Minimum expectation: all new critical paths have automated tests.

## 7) UI/UX Standards
- Responsive UI for mobile/tablet/desktop.
- Operational pages prioritize clarity and fast data entry.
- Print layouts designed for desktop only.
- Bilingual support via centralized labels/resources.

## 8) Logging and Observability
- Log domain events with identifiable references (`voucher_no`, `trip_no`, `invoice_no`).
- Keep audit logs for sensitive actions:
  - role/permission changes
  - payment/subscription status changes
  - stock-affecting operations

## 9) Definition of Done (DoD)
A task is done when all are true:
- Business acceptance criteria satisfied.
- Permission and tenant-scope checks implemented.
- Tests added and passing.
- DB migration reviewed (if applicable).
- Documentation updated where behavior/data changed.

