# Independent production audit — 6 October 2026

This audit supersedes prior PASS declarations. It inspects the working tree, which contains substantial uncommitted changes. No deployment is authorized. The new Phase 7 request pauses unfinished master completion gates. Daily Galla and UPI are expressly authorized additions.

## CRITICAL

C1. PurchaseController document GET/post/reverse methods pass a bare UUID to unscoped service methods (orders, receipts, invoices, returns). A valid tenant session can target another company's document when PURCHASING is enabled. Fix route and nested reference isolation; exercise real HTTP attacks.

C2. Legacy ERP create routes use `any`/Prisma input with nested spreads. ValidationPipe cannot validate these shapes; nested relation writes may forge tenant ownership. Reject arbitrary Prisma relation envelopes at the HTTP boundary and validate every supported reference.

## HIGH

H1. Retail/POS/attachment routes do not consistently enforce user permissions. PermissionGuard treats every `system_role` as unrestricted. Enforce server-resolved permissions, retaining explicit Owner/Admin authorization only.

H2. Important financial writes lack persisted request idempotency. Disabled buttons and client photo retry protection do not cover network retries or duplicate HTTP requests. Persist request identity, payload fingerprint and response atomically with business posting.

H3. Production startup validates only presence of JWT_SECRET. Weak secrets, development bootstrap accounts, default CORS, ambiguous provider configuration and absent deployment configuration remain possible.

H4. Uploads rely on browser MIME declarations. Validate file signatures, safe storage keys and sizes independently; retain company checks. Local storage is not an object-storage provider.

H5. Production recovery is not configured. Current local pg_dump archives are real; archive-list verification is not a production restore drill. No retention/encryption/off-host provider/RPO/RTO is configured. Fail readiness claims; document external operational release gates.

H6. Product completeness premise is false: serial/warranty work is partially implemented and untested; bundles/modifiers/settings master gates remain pending. More has a Coming Soon wildcard. This is a release blocker, not authorization to add unspecified new modules during hardening.

## MEDIUM

M1. Retail and Platform lists frequently have no bounds. Add bounded pagination preserving current response contracts, with search and limits where suitable.

M2. Health reports process liveness only. Add safe database readiness, request IDs, sanitized structured request logs, security headers and deployment version.

M3. Frontend API clients default to localhost; no timeout or reliable retry identity. Deep-link production serving is undocumented.

M4. Tenant scoped indexes for stock projection, dated sales/purchases and party lookups require review. Global username is intentional for current login contract; item/party code uniqueness must be company scoped.

M5. In-process login throttles work only per instance. A production gateway/shared limiter is required before horizontal scaling. Reset/OTP/email providers are not implemented; do not represent them as enabled.

M6. Basic accessibility and UI parity require fresh browser and visual evidence. Missing module navigation/settings and dark theme must be listed, not marked PASS.

## LOW

L1. Stale tracked archive/scratch files and test output, ad-hoc migration helpers and pricing/sales console logs need removal or explicit development isolation. Test credentials belong only in guarded disposable test workflows.

L2. Root environment example describes the retired Python backend. Replace with Node/PostgreSQL environment separation and secret-free examples.

## Baseline evidence boundary

Before Phase 7: 94 backend E2E tests and 12 Retail browser tests passed. Those results are historical, not this audit's release evidence. Serial migration is the 21st additive migration, applied locally; subsequent code has not been built or tested. Stable Trade API is currently stopped for schema/build safety. Another school application on port 8000 is unrelated and must remain untouched.
