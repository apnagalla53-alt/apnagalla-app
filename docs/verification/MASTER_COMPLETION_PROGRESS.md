# Master completion gates — 6 October 2026

The request in attachment b7e66749 is the active scope. The 26 ZIP screenshots are field/workflow references only. Existing uncommitted work is preserved. No core engine replacement is authorized or planned.

## Gate 0 — baseline before implementation

1. Runtime errors: fresh Retail browser lifecycle and responsive suite passed 7/7. Previous stabilization errors and corrections are recorded in `2026-10-06-retail/RETAIL_STABILIZATION_REPORT.md`.
2. Broken routes: Platform navigation includes plans, users, audit, health and settings but App has only dashboard/tenants; `/platform/login` is absent. Retail More still includes unfinished settings destinations.
3. Failed API calls: combined login probes Platform first, generating an expected 401 for Retail. Platform logout is linked but missing on the backend. Retail baseline workflows passed.
4. Authentication/context: Retail uses the shared client and server-resolved company, branch and FY membership. Platform has no persisted session/revocation or effective role check. Hardcoded bootstrap credentials and JWT fallback secrets need removal for new deployments.
5. New Bill: the formerly blank flow was corrected during stabilization (response adapters, API prefix/base, tenant setup and cart/success handling). Fresh browser tests exercise it successfully; no blank-page regression reproduced.
6. Platform state: existing identity/provisioning modules and Prisma models are the extension points. Current provisioning omits shop stock location, FY, payment ledgers/config and subscription. Dashboard asserts service health without querying it. Status changes lack audit records.
7. Baseline: Prisma valid, 16 migrations applied, backend and frontend builds pass, universal-item-flow/batch-fefo E2E 37/37 pass on dedicated disposable test database, Retail browser suite 7/7 pass. Frontend chunk-size warning remains non-fatal.
8. Minimal corrections: separate login routes; persisted scoped sessions; audited and validated Platform actions; complete existing provision transaction; central PlanDefaults → TenantOverrides resolver; real backend dashboard/health responses and operational Platform pages.

Evidence: `frontend/master-gate0-browser.log` and `scratchpad/master-{prisma-validate,migrations,backend-build,frontend-build,gate0-e2e}.log`.

| Gate | Status |
|---|---|
| 0 Localhost baseline | PASS (baseline), auth correction pending |
| 1 Platform control plane | PASS for implemented controls, provider limitations explicit below |
| 2 Retail field/UX coverage | In progress |
| 3 Serial + warranty | Pending |
| 4 Universal capabilities | Pending |
| 5 Tenant settings | Pending |
| 6 Final verification | Pending |

No remaining gate is claimed complete. Final evidence must include clean additive migration, real HTTP and browser flows, mobile layouts and tenant/security checks.

## Gate 1 evidence and limits

Two additive migrations extend existing identity/plan/entitlement models, add internal subscription receipts/refunds and separate Platform expenses, real backup metadata, support windows, announcements and operations settings. Sequential public tenant IDs preserve UUID relationships.

Existing provision/auth modules now provision a usable shop, strip credential fields, persist scoped sessions, enforce device limits, throttle activity/login attempts, revoke access, and audit controls. Effective entitlements resolve plan defaults, tenant overrides and deterministic global rollout. Platform routes are wired, including support records, alerts, actual server/database metrics and real archive creation/verification.

Evidence under `2026-10-06-master/`: Platform browser flow including plan creation/change, actual receipt/refund, tenant provisioning/owner Retail login, feature override/default, expiry/free days, user disable/enable, suspension/reactivation, support start/end, expense, infra/audit; responsive screenshots at 360/390/412/1280. Backend suite: 9 files, 87 tests passed including real archive/restore and security/device limits. Earlier clean database migration applied all 18 migrations, with 83 tests before the additional backup/device tests. Three real backup/restore tests separately passed. A real development database archive was created and verified through the UI (438,304 bytes at capture).

Runtime correction: concurrent build and watch compilation removed `dist/main`, and another local school application occupied port 8000. Trade ERP now uses `http://localhost:8010/api/v1`, configured in ignored local environment files, with a generated persistent JWT secret. The school process was preserved. Verification uses a stable compiled backend; stop/rebuild/restart it after backend changes rather than building concurrently with a watcher. Full Retail lifecycle passed on a stable prior run; full responsive suite is being rechecked on the isolated API.

Explicit unavailable integrations: cloud metrics/PITR, production restore, selective tenant restore, two-factor provider, historical churn/trial-cohort metrics. Local restore requires a pre-created configured database ending `_restore_test`, explicit target confirmation/reason, and a pre-restore safety archive; it cannot overwrite the running ERP database. Provider limits are shown in the UI rather than fabricated.
