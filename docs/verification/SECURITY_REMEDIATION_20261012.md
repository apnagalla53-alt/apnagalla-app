# Security remediation — 12 October 2026

Result: application hardening implemented; **production approval remains withheld**. No deployment occurred. The original findings are preserved in [the independent audit](SECURITY_AUDIT_20261012.md). This report distinguishes code fixes, local operational changes and external work.

## What changed and why

| Finding | Resolution | Consequence without protection |
|---|---|---|
| Stored barcode-label HTML injection | Escape every dynamic field, sandbox preview frames, forbid scripts in printable HTML | Malicious item names could execute scripts in label previews/printing |
| Browser-readable persisted login tokens | HttpOnly cookies, Secure in production, SameSite=Strict; old storage version cleared; native bearer tokens held only in memory | Injected scripts could steal persisted bearer credentials |
| Cookie request forgery | HMAC session-bound CSRF header, exact production origin checks and logout cookie clearing | An attacker could trick a signed-in browser into making unauthorized writes |
| Missing Platform second factor | Mandatory TOTP, AES-GCM encrypted secrets, five-minute challenges, replay counters, five-attempt limits and eight hashed single-use recovery codes | A stolen administrator password alone could control tenants and subscriptions |
| Authentication races | Lock rows for failed-password counters and session issuance; recheck account/password/MFA state; password recovery invalidates pending MFA challenges | Concurrent failures could avoid lockout, or an old verified password/factor could create a session after recovery |
| Privileged API database account / absent RLS | Dedicated restricted runtime role, separate migration owner, forced company/child RLS and request-scoped transactions | A missed tenant predicate could expose another shop; compromised runtime credentials would have excessive database powers |
| Per-process limits and uncovered expensive reads | Atomic shared PostgreSQL rate windows, catalog/label/upload/report/auth limits and trusted ingress handling | Attackers could spread requests across replicas, brute-force login or exhaust the database |
| Predictable production keys | Reject short/repeated/placeholder JWT keys, require independent Platform/tenant keys and a random MFA encryption key | Weak signing keys could allow forged sessions |
| Incomplete photo validation / storage exhaustion | Full decode and re-encode, pixel/frame limits, normalized names, 5 MiB limit and locked tenant quota | Corrupt or appended content could be stored; repeated uploads could consume storage/resources |
| Sensitive storage errors | Allowlisted event/error codes; no raw storage path/error dumps | Internal paths and sensitive provider details could leak into logs |
| Vulnerable development dependency chains | Remove unused deployment CLI, patch source-map dependency, patch Android CLI's UUID dependency; keep lockfiles | Compromised build tooling could affect developer/CI machines or release artifacts |

HttpOnly cookies reduce token theft; they do not make injected same-origin scripts harmless. RLS protects against omitted predicates; the API's tenant/branch/permission checks remain mandatory. Runtime credentials still belong to trusted server code and must be protected. See [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) and [PostgreSQL RLS rules](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

## Local database and credential changes

Only `evolix_trade_dev` and the preserved EVOLIX preview database `evolix_phase8_browser_20261007_test` were changed. Pre-change custom archives were retained privately. Both received migration 35, covering 90 forced-RLS business/child tables. Item, invoice, purchase and user counts were preserved. No customer business records were deleted.

The API uses `evolix_runtime`: no superuser, BYPASSRLS, database/role creation, table ownership or schema CREATE. A plain unscoped query sees no business rows; a DDL attempt was denied. Migration credentials are stored separately in ignored `.env.maintenance.local`, never sourced by the API. The local migration role has disposable-test creation privileges; production migration jobs should use a separate owner without these local test powers.

Two known weak Platform accounts and one known weak tenant account were rotated to independently generated strong credentials; their sessions were revoked. Tenant temporary access requires a password change. Local JWT keys were rotated independently and MFA encryption was configured. The access handoff is Windows-user-bound DPAPI encrypted, excluded from Git and container build context. The owner can run [show-local-operator-access.ps1](../../scripts/show-local-operator-access.ps1) privately; do not share its output. Platform sign-in now requires an authenticator.

## The original 20 checks

| Check | Current disposition |
|---|---|
| SQL injection | No exploitable finding in reviewed routes; SQL-shaped search regression and parameterized-query review retained |
| XSS | Confirmed barcode HTML issue fixed and regression tested |
| CSRF | Signed cookie-session CSRF protection and origin rejection tested |
| File upload | Full image sanitization, limits, tenant quota and entity isolation implemented/tested; live provider/malware operations still need staging |
| IDOR / object authorization | Application ownership/nested-reference checks retained; foreign access and restricted-role RLS tests pass |
| Rate limiting | Shared database quotas and concurrent-store enforcement tested; ingress configuration still needs staging |
| JWT secrets | Production validator strengthened and independent local keys rotated |
| Exposed secrets | EVOLIX runtime isolated; shared DBA credential remains unresolved as explained below |
| Password hashing | Bcrypt cost 12 for new/reset/provisioned passwords; known weak local credentials replaced; legacy cost-10 hashes are not plaintext |
| MFA | Mandatory Platform MFA verified; optional Retail owner/staff MFA remains unimplemented |
| CORS | Exact production frontend origin, explicit native exception and bounded development LAN origins |
| LocalStorage auth tokens | Removed; storage migration, browser cookie and volatile native token behavior implemented |
| Client-only permissions | Backend permissions, memberships, Platform role and entitlements remain enforced |
| Row security | Forced business/child policies and restricted runtime role; identity/audit exclusions documented |
| Webhook signatures | No online-payment webhook endpoint exists. Future integration must verify signatures and deduplicate events |
| SSRF | No untrusted user-controlled outbound URL found; provider endpoints remain trusted deployment configuration |
| Source maps | Zero frontend/backend production source-map files in the verified builds |
| Default credentials | Known weak active local accounts replaced; production bootstrap passwords remain forbidden |
| Sensitive logs | Sanitized request/storage events; tokens/passwords/raw SQL omitted |
| Dependencies | Final full audits: backend 0, frontend 0 known vulnerabilities; repeat in CI |

## Verification

| Verification | Actual result |
|---|---|
| Full backend unit regression | 1,301 passed / 0 failed, 36 files, exit 0 |
| Full API regression | 576 passed / 0 failed, 28 files, exit 0 |
| Real PostgreSQL backup/restore drill | 3 passed / 0 failed, 1 file, exit 0 |
| Headed Chromium regression under restricted runtime | 45 passed / 0 failed, 3 files, exit 0 |
| Clean migration deploy | All 35 migrations applied on fresh disposable source/restore databases |
| Migration status / Prisma validation / generation | Up to date / valid / generated, exit 0 |
| Backend / frontend TypeScript and production builds | Both exit 0 after clean npm ci |
| Full dependency audits | Backend 0 / frontend 0 known vulnerabilities; both npm ci exit 0 |
| Production source maps | Frontend 0 / backend 0 files |
| Runtime least privilege | No privileged flags, 0 owned tables, DDL denied, 0 unscoped business rows visible |
| Private credential handoff | 3 encrypted profiles, all new passwords matched stored hashes; no secrets printed |

Final automated total: **1,925 passed, 0 failed**, counted once (1,301 + 576 + 3 + 45). Targeted reruns and the independent manual CLI check are not added again. The full final backend invocation exited 0. Private evidence is in scratchpad/security-full-20261012.log, scratchpad/shopkeeper-browser.log, the ignored security-verification directories and output/playwright/shopkeeper-qa. Expected failure-path tests intentionally produce sanitized 400/401/403/429/503 logs; these are not failed assertions. Vitest configuration warnings and concurrent Supertest server listener warnings are test-harness diagnostics, not a proven runtime leak.

Earlier runs caught the deferred-query scope bug and onboarding scope issue, both corrected; one stale ledger-count test and one binary floating-point test helper were corrected to assert required accounts and exact decimal balances. An initial Windows generator file-lock failure was resolved after database consumers stopped; Prisma generation was rerun successfully. No failed/partial run is substituted for the final all-green run. Provider calls remain test boundaries where stated.

The dedicated security suite uses a genuine NOSUPERUSER/NOBYPASSRLS database login. It tests an unguarded HTTP handler, deliberately omitted tenant predicates, foreign updates/inserts/child references, cookie/CSRF writes, corrupt/appended images, per-tenant quotas, shared concurrent rate windows, mandatory MFA, replay/recovery/lockout and operator recovery. Feature-only fixtures may disable MFA solely under NODE_ENV=test; development/production cannot use that bypass.

The headed browser regression uses the actual restricted runtime role on fresh disposable databases. A separate visible Playwright CLI check verified authenticator enrollment, eight recovery codes, dashboard entry and cookie-only persistent browser state. Its screenshot shows only the dashboard; private QR/recovery material is not published.

Backup verification is a real local whole-database archive and restore using RLS-compatible INSERT output and a separate disposable target. It does not establish offsite storage, selective tenant restore, production RPO/RTO or attachment recovery.

## Remaining work and actual risks

1. **Shared PostgreSQL administrator credential — unresolved release blocker.** The old administrator password remains valid and exists in Git history. The user explicitly instructed: “Keep other projects untouched; isolate EVOLIX first.” No other project's configuration or the shared password was changed. Isolation does not revoke that superuser credential; if reachable, its holder can still read/change EVOLIX and the other databases. Coordinate its rotation and separately authorize history/remote-secret cleanup.
2. Revoke the Google OAuth client secret previously shared in screenshots through Google Cloud. EVOLIX's ID-token flow does not need that secret and no Google client secret is configured in the app; local code edits cannot revoke a provider credential.
3. Production HTTPS/ingress/CSP/trusted IP forwarding and container execution require staging verification. Docker/nginx are unavailable locally. Do not treat template review as a tested deployment.
4. Configure and verify private object storage, offsite backup schedules/alerts, real recovery, SMTP/SMS as applicable and monitoring. Without those, provider failures may leave missing recovery, undelivered reset messages or undetected outages.
5. Retail owner/staff MFA is not implemented. Password-only shop accounts have less protection against stolen credentials than Platform accounts. Decide the Retail MFA policy before a wider rollout.

No claim of zero production blockers, external penetration testing or automatic payment integration is made.

## Reproducing checks

`node scripts/verify-security.cjs` creates and drops only its generated localhost `_test` database, applies migrations/status/validation and runs the dedicated security/Platform suites and TOTP vectors. Use the operator-only maintenance connection, never the customer database or API runtime role. Private logs stay in ignored scratchpad; results and limits belong in this report. Full financial/retail regression and actual staging acceptance remain additional gates.

For lost Platform MFA access, verify the operator's identity, then run `node scripts/platform-mfa-reset.cjs "exact username" "documented recovery reason"` in the backend directory. It requires migration-owner credentials via an isolated operator-job `EVOLIX_MAINTENANCE_DATABASE_URL` or local `.env.maintenance.local`, revokes sessions/challenges and records audit. No secret is passed as a command argument. Password recovery remains the separate interactive operator procedure.
