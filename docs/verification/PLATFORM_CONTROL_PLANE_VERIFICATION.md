# Platform control plane, account and onboarding acceptance — 9 October 2026

Status: implementation and local verification are recorded below; **production release remains blocked**. Do not interpret a local provider stub, manual payment record or local restore as proof of a live integration. No deployment was performed.

The active scope is the supplied master platform specification. The existing Retail, POS, inventory, accounting, session, provisioning, entitlement and import services were reused. No new wholesale, manufacturing, restaurant, native, offline, WhatsApp assistant or statutory GST-provider phase was started.

## Independent baseline and final backend evidence

| Run | Passed | Failed | Exit |
|---|---:|---:|---:|
| Independent backend unit baseline | 1,294 | 0 | 0 |
| Independent PostgreSQL API baseline | 479 | 0 | 0 |
| Final backend unit regression | 1,294 | 0 | 0 |
| Final PostgreSQL API regression | 508 | 0 | 0 |

Final API counts include the following suites. They overlap acceptance categories; do not add a category count to the 508 total.

| Suite | Passed / failed |
|---|---:|
| Account, onboarding, referral and lifecycle | 16 / 0 |
| Identity security and durable attachment erasure | 13 / 0 |
| Existing auth lifecycle | 14 / 0 |
| Existing account/publishing | 8 / 0 |
| Platform control plane | 11 / 0 |
| Subscription / entitlements | 69 / 0 |
| Tenant administration | 19 / 0 |
| Security | 10 / 0 |
| Production readiness | 26 / 0 |
| Import and report | 23 / 0 |
| Real local database backup / restore | 3 / 0 |
| Universal item flow | 20 / 0 |
| Batch / FEFO | 17 / 0 |
| Bundle / modifier | 15 / 0 |
| Costing / profit | 39 / 0 |
| GST document engine | 22 / 0 |
| Deterministic Assistant and diagnoses | 129 / 0 |
| Retail flow | 19 / 0 |
| Retail field coverage | 10 / 0 |
| Calendar / price-only billing | 17 / 0 |
| Attachments | 5 / 0 |
| Expenses | 2 / 0 |
| Application API smoke | 1 / 0 |

Private local raw results are in `output/platform-control/unit-final.json` and `e2e-final.json`. Tests ran against guarded localhost disposable databases ending `_test`. The restore test used a separate restore target. No tests cleared the Haidery shop database.

Fresh production-dependency audits (`npm audit --omit=dev --json`) completed for both projects with **zero reported critical/high/moderate/low advisories, exit 0**. This is a registry result at verification time, not proof that vulnerabilities cannot exist. Raw results: `backend-audit-final.json` and `frontend-audit-final.json` in the same private evidence directory.

## Authentication acceptance

PASS below means the implementation was exercised at the stated boundary. FAIL rows are unmet production acceptance requirements, not hidden by an overall PASS.

| Requirement | Status | Evidence / limit |
|---|---|---|
| Mobile signup | FAIL for live delivery | OTP flow and persisted signup passed HTTP and headed browser with a private test SMS sink. No live SMS account. |
| OTP verification, expiry, retry and resend | PASS at test boundary | Protected stored hash, five failed attempts, expiry, cooldown, consume once, unavailable transport, canonical number reuse. Live delivery remains unverified. |
| Google signup | FAIL for live consent | Subject/nonce duplicate handling and explicit linking pass isolated provider-boundary tests. Google Cloud client and live consent are not configured. |
| Mobile sign-in | FAIL for live delivery | Existing verified identity reused in HTTP/visible browser tests; no live SMS. |
| Google sign-in | FAIL for live consent | Existing verifier uses official token verification; no live account acceptance. |
| Existing password sign-in | PASS | Existing tenant and separate platform flows, revoked sessions and forced reset checks. |
| Duplicate identity protection | PASS | No name/email/legacy-contact takeover; repeat canonical verified mobile or Google subject reuses the account. |
| Account linking | PASS at test boundary | Explicit reauthentication and verified provider proof; no implicit merge. |
| Onboarding resume | PASS | Refresh after business setup returned to saved plan stage in the headed browser. |
| Privacy / Terms consent | PASS for implemented flow | Required before signup. Public legal/contact placeholders still require owner review before publishing. |

The normal preview at localhost:5175/signup displays both unconfigured providers explicitly. It cannot send a fake verification code. The disposable SMS sink was confined to localhost:8013 and ignored test helpers.

## Onboarding and referrals

| Requirement | Status | Evidence / limit |
|---|---|---|
| Owner name and shop name | PASS | Both fresh public accounts completed the persisted steps. |
| Business type and search | PASS | Twenty-four supported types, distinct icons and suggestion-only optional capabilities. |
| Address and optional location | PASS for form / persistence | Address saved through existing provisioning; optional GPS requires browser permission. Physical mobile GPS accuracy was not measured. |
| Starter / Smart / Pro selection | PASS | Three canonical plan codes; unpaid request stays PENDING. No fake checkout. |
| Configured trial / demo | PASS | Seven-day Smart trial exercised in browser; once-only HTTP tests. Trial is status over a base plan. Default is disabled. |
| Migration choice / Start Fresh | PASS | First public tenant chose IMPORT; referred second tenant chose FRESH and reached Home. |
| Import engine | PASS for supported formats | Existing map/validate/preview/confirm engine and authoritative stock/dues posting; arbitrary proprietary files are not claimed supported. |
| Referral code and URL | PASS | Owner code, opaque URL and signup retention exercised. |
| Referral persistence / signup attribution | PASS | Second public signup retained first owner's referral; Platform displayed the attribution. |
| Conversion and reward logic | PASS | Actual non-refunded paid receipt required for paid conversion, duplicate reward protection and continuous active-day policy. Automatic checkout/payout remains unavailable. |
| Self-referral / unauthorized staff access | PASS | Server-side rejection and owner-only custom-role test. This is not a claim of a complete fraud-detection system. |
| Admin referral dashboard / campaigns | PASS | Real attribution displayed; disabled tracking campaign created through visible UI. |

## Platform and data acceptance

| Requirement | Status | Evidence / limit |
|---|---|---|
| Create usable tenant | PASS | Fresh shops provisioned through Platform, with company, branch, stock location, financial year, ledgers and membership. |
| Edit display code / profile | PASS | Server-controlled immutable UUID; scoped, audited editable metadata. |
| Suspend / reactivate | PASS | API lifecycle checks; headed regression evidence reported separately below. |
| Archive / restore | PASS | Visible archive/restore plus HTTP tests preserved business rows and original access status. |
| Permanent tenant deletion | PASS for local provider boundary | Default refusal, retention, hold, typed confirmation, scoped serializable purge, second tenant preserved, durable local file erasure/retry. S3 version erasure deliberately blocked. |
| Plan change / trial / extension | PASS | Real effective-plan controls and historical preservation. |
| Feature and limit overrides | PASS | Override, reset/inheritance and backend guards. Visible Retail POS disable/reset also passed. |
| User list / phone / email | PASS | Safe contact fields and verification state; no token/provider subject/password hash exposed. |
| Password exposure | NO | Existing passwords cannot be retrieved. |
| Password reset | PASS at service boundary; FAIL for live email | Verified-email provider boundary, one-use invalidation, strong temporary hash/expiry/forced change. Live SMTP missing. |
| Session / device revocation | PASS | Persisted tenant/platform sessions, explicit revoke, reset/disable/archive invalidation. |
| Support | PASS | Time-limited audited read-only review; no arbitrary browser SQL, shell or unrestricted impersonation. |
| Audit | PASS | Reasons and actor/context for privileged controls; sensitive auth values omitted. |
| Starter ₹75 / Smart ₹120 / Pro ₹210 | PASS | Canonical catalog and 69 commercial tests. No fourth Demo plan. |
| Voice Pro / GST Smart+ / Profit Smart+ | PASS for entitlement boundary | Backend enforcement and upgrade presentation. Voice channel itself is NOT CONFIGURED. |
| Full manual export Pro | PASS | Entitled kinds and account-exit portability checks. Export is distinct from backup. |
| Internal backup all plans | PASS for authorization / local drill | Plan/export overrides cannot disable backup scope. Production offsite backup still unconfigured. |
| Tenant isolation / session isolation | PASS in automated coverage | Two-tenant ID attacks across existing modules, new role/contact/referral/lifecycle guards. |
| Cross-tenant export / password leakage | PASS in automated coverage | Scoped download, identity serialization and credential action checks. |
| Downgrade / archive preserves data | PASS | No destructive downgrade; archive retains rows and restore does not extend expiry. |
| Safe delete | PASS for disposable local tenants | Verified scoped removal and file retry; customer deletion must retain documented shared archive/audit history. |

## Headed browser evidence

All framework browser runs use `--headed`, one worker, retained screenshots/video/trace. Playwright CLI was also used to operate the new public signup and platform controls visibly.

- Public signup → owner → plywood business → resume → configured trial → IMPORT → Home → item → real cash invoice, with stock changing from 5 to 4.
- Referred public signup → grocery business → configured trial → FRESH → Home.
- Platform archive/restore, owner-session revocation, feature disable/reset, referral attribution and campaign creation.
- Retail Home/referrals/import/subscription at 360, 390, 412 and 1366px: **16 / 16** CLI layout checks.
- Platform dashboard/tenants/account policy/referrals/erasure jobs at tablet 768px, laptop 1366px and desktop 1920px: **15 / 15** CLI layout checks.

The first full existing browser regression was **55 passed / 42 failed / 0 skipped, exit 1**. The first focused rerun was **20 passed / 22 failed, exit 1**. These results were preserved; previous PASS declarations were not trusted.

Fixes during reruns included real text-contrast and centered Bill-button defects, a report inbox that showed endless loading after an error, and a completed staff permission save that reopened a dismissed dialog. Existing test navigation was aligned to the requested collapsible drawer, optional form details and focused forms that hide bottom navigation. The assistant test now matches its response to the submitted question rather than capturing an earlier request. Report traversal was paced while keeping the real production quota. The scheduled report test uses the actual scheduler explicitly enabled in the disposable test server.

The next complete run produced **94 passed / 3 failed / 0 skipped, exit 1**. All three failures then passed a focused rerun (**3 passed / 0 failed, exit 0**) after the corrections above. That focused result is not a replacement for the final full run.

**Final complete headed regression: 97 passed / 0 failed / 0 skipped / 0 flaky, exit 0.** The single-worker run took 26.3 minutes and began at 2026-10-09 14:35:45 UTC. Raw results are `output/platform-control/frontend-final.json`, `frontend-final.log` and `frontend-exit.json`. This is a complete all-green invocation after the fixes, not a sum of focused reruns.

| Browser file | Passed / failed |
|---|---:|
| app-publishing | 5 / 0 |
| assistant | 7 / 0 |
| auth | 9 / 0 |
| costing-profit | 7 / 0 |
| import-report-acceptance | 5 / 0 |
| item-configuration | 1 / 0 |
| manual-acceptance | 17 / 0 |
| module_02 | 1 / 0 |
| partial-rerun | 3 / 0 |
| platform-control-plane | 1 / 0 |
| production-readiness | 8 / 0 |
| retail-field-coverage | 5 / 0 |
| retail-improvements | 6 / 0 |
| retail-smoke | 7 / 0 |
| retail-ux | 12 / 0 |
| whatsapp-receipt | 3 / 0 |

Coverage includes the actual Retail lifecycle, services, variants/pack units,
weight/length/area, FEFO/expiry, serial/warranty, split/credit payment, returns,
Galla, purchase/supplier payment, expenses, imports, scheduled in-app reports,
subscription transitions, staff permissions/revocation, exact UPI QR, recovery
after failed/lost responses, light/dark screen sweeps and WhatsApp destination
previews. Browser speech requests and receipt redirects do not prove audible
output or delivery on a physical phone. Cart preservation is verified within
the active SPA flow and retry; full offline billing is not provided.

## Build, migration and storage

Prisma validate, generate and migration status: PASS. Thirty-four migrations deployed to a clean disposable PostgreSQL database and the restore target. Prisma generate first hit Windows DLL locking; after stopping the identified API process it completed successfully. No reset or data-loss push was used.

Backend/frontend `npx tsc --noEmit` and `npm run build`: PASS, exit 0. Source maps excluded from backend dist; frontend entry 470.27 kB / 147.73 kB gzip. See [disk audit](DISK_USAGE_AUDIT.md) for exact before/after sizes, 44.58 MiB of actual cache removal and artifact exclusions.

Docker builds, real devices and deployed infrastructure remain unverified. Headed emulated viewports do not prove a physical phone acceptance.

## Storage acceptance matrix

| Requirement | Status | Evidence / limit |
|---|---|---|
| Disk audit | PASS | Before/after byte counts and zero scan errors in the separate disk report. |
| .gitignore | PASS for reviewed rules | Environment files, generated test output, caches and signing material excluded; existing tracked changes preserved. |
| Build ignore | PASS for reviewed rules | Root/backend/frontend Docker ignore rules reviewed, including attachment source exceptions. |
| Cache cleanup | PASS | Exactly 46,740,935 bytes in 39 generated files removed with checked containment. |
| Host node_modules excluded | PASS for build configuration; FAIL for image verification | Images install their own lockfile dependencies; backend runtime still needs production dependencies. Docker unavailable. |
| Raw Stitch references excluded | PASS for build configuration; FAIL for image verification | Ignore rules exclude reference assets. Final image contents not measured. |
| Test artifacts excluded | PASS for build configuration; FAIL for image verification | Private recordings, dumps and ignored helper output excluded from build context. |
| Production bundle audited | PASS for local emitted files | Backend source maps absent; frontend bytes/chunks/gzip measured. This does not verify the container or deployed server. |

The final-provider declaration also requires live auth delivery, recovery and deployment evidence. Safe local deletion and an isolated database restore do not satisfy these external gates.

## Issue disposition

| Severity | Finding | Disposition |
|---|---|---|
| CRITICAL launch gate | No verified offsite database/attachment recovery or measured provider restore | DEFERRED: requires configured provider, retention and staging drill. Local 3/3 restore tests do not close it. |
| HIGH launch gate | New public mobile/Google auth and email recovery lack live provider acceptance | DEFERRED: implementation is tested at provider boundaries; real accounts, origins and delivery/consent tests required. |
| HIGH launch gate | Deployment containers, TLS/staging, representative migration and physical devices unverified | DEFERRED: Docker/tooling and staging/device evidence required; no deployment performed. |
| HIGH scope gap | No durable public signup/onboarding or referral controls | FIXED in the existing architecture, with provider limits disclosed above. |
| HIGH scope gap | Missing guarded archive/delete, scoped role and credential controls | FIXED with audit, retention/legal/recovery gates and local storage retries. Object-store version erasure remains blocked. |
| MEDIUM | Report fetch error kept showing loading | FIXED; error/no-spinner/retry browser assertions pass. |
| MEDIUM | Staff permission save reopened a dismissed sheet | FIXED; stale save completion preserves closed/current dialog state, final staff workflow passes. |
| MEDIUM | Bill centering and contrast defects | FIXED; geometry/accessibility and light/dark sweeps pass. |
| MEDIUM | Backend context ignored only named environment files, not all variants/uploads | FIXED in .dockerignore; actual image construction remains unverified. |

Final local runtime checks returned HTTP 200 for Haidery web/readiness (5175/8012)
and development web/readiness (5173/8010). Haidery tenant 138 was verified against
its original database. Disposable browser frontend/API 5176/8013 were stopped and
confirmed unreachable after acceptance; customer preview servers were preserved.
Raw runtime evidence: `output/platform-control/final-local-runtime.json`.

## Remaining release blockers

1. Configure and verify live SMS signup/sign-in and Google OAuth signup/sign-in/linking on staging.
2. Configure verified email recovery delivery and review public legal/support/business placeholders.
3. Provision HTTPS hosting, secrets, provider IAM/storage, external monitoring and shared rate limiting before multiple replicas.
4. Verify encrypted offsite backups, attachment recovery, retention and a real production-provider restore drill with measured RPO/RTO. Local database drill is not offsite production readiness.
5. Build and smoke-test deployment containers and migrate representative historical data in staging with lock/duration measurements.
6. Complete physical-device acceptance. The whole-Retail headed regression has passed locally. Online subscription payments and automatic referral payouts are unconfigured and must remain labelled as manual/unavailable.

The final all-provider VERIFIED declaration is deliberately withheld. Stop for review; do not deploy automatically.
