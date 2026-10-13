# EVOLIX production completion and release gates — 7 October 2026

**Decision: local software verification is substantially improved; customer production and Play publication remain BLOCKED. No deployment or upload performed.**

Latest visible follow-up: [headed manual acceptance](2026-10-07-headed-manual/README.md) records **60 headed Chromium + 190 backend E2E + 235 unit/integration = 485 passing tests**, with both builds/typechecks passing. The 72-check manual guide has **63 PASS, 6 PARTIAL, 3 BLOCKED** results, including additional headed CLI login and supplier-proof checks. It also records return-form, variant-label, serial-return, receipt-display, network-recovery and same-day ledger fixes. Historical counts below describe earlier runs; the new report is the latest local execution evidence and does not close external release gates. Final E2E evidence uses a fresh database with all 25 migrations; failed fixture diagnostics are documented separately.

This report updates the historical Phase 7 report. The latest human requests authorize Google login, completion of existing Retail controls, publication preparation and a premium minimalist **light** theme. Existing Inventory/POS/Purchase/Pricing/Accounting/Retail facades were preserved. No Wholesale, Manufacturing, Restaurant KOT or additional business engine was started. The WhatsApp voice assistant is an implementation plan, not a connected provider.

## CRITICAL ISSUES FOUND

| Finding | Resolution |
|---|---|
| Foreign Purchase document IDs could reach unscoped read/post/reverse services | Company-qualified authorization and real HTTP attack tests; fixed. |
| Nested Prisma relation envelopes could forge tenant ownership | Recursive reference checks, fixed allowed payloads and server-derived tenant context; tested and fixed. |

No known exploit from these two findings remains open. This is not an exhaustive security certification or a declaration of zero release blockers.

## HIGH ISSUES FOUND

| Finding | Resolution / current gate |
|---|---|
| System-role permission bypass and inconsistent Retail/attachment authorization | Persisted explicit roles/permissions, tenant boundaries and separate Platform authorization; tested. |
| Retry/race could duplicate financial posting or oversell | Persisted transactional idempotency; item, serial, batch, document, party and PO locks. Duplicate/unknown-outcome billing, payments, purchases and returns tested. |
| Weak/default production configuration and bootstrap identities | Required production secret/origin/version/provider validation; no production seed users; protected first-admin CLI. |
| Upload MIME/path boundaries insufficient | Signature/type/size/key/entity authorization, private local and S3 adapters; live provider acceptance remains required. |
| Public owner password recovery/change and temporary-password lifecycle absent | Strong password policy, hashed single-use reset/verification tokens, session revocation, 24-hour temporary passwords, real TLS SMTP abstraction. Actual sending account/delivery NOT CONFIGURED. |
| Missing tenant management APIs and legacy regression import | Real scoped staff/roles/devices/business/branch/location/FY APIs and screens; legacy CloudSync expectations updated to honest unavailable status. Full discovered backend suites now pass. |
| Bundle/modifier workflows were not connected to posting/UI | Existing composition engine integrated with authoritative component inventory, FEFO, pricing/tax, immutable returns and Hold/Resume. Real HTTP and browser acceptance pass. |
| Existing variants/pack units lacked owner configuration | Scoped feature-protected HTTP writes and progressive Item Details controls; duplicate variants and item/variant SKU collisions rejected inside a business; foreign ownership rejected. |
| New catalog creation response depended on the first catalog page | Return the created ID directly with the Retail summary. A 105-item fixture verifies beyond-first-page creation. |
| Piece quantity HTML validation prevented configured items reaching the cart | Correct integer minimum/step; real kit checkout browser test catches and verifies the fix. |
| Owner session screen compared a JWT with a session UUID | Use the server-resolved current-session flag; browser test actually signs the current device out. |
| Production offsite backup/recovery absent | Real encrypted S3 archive implementation, lifecycle checks, authentication/tamper tests and operator scheduler command added. Cloud account/schedule/PITR/alerts and production-like restore are still NOT CONFIGURED/NOT VERIFIED. **Release blocker.** |

## MEDIUM / LOW findings

- Representative production-volume query plans, N+1/load/SLO and migration lock-duration tests are not complete. Main Retail directories are bounded and support pagination/search; several legacy/platform detail views remain bounded without full page discovery, and some aggregate queries process full periods. Do not claim unlimited-scale readiness.
- In-process throttles need the documented shared edge/distributed enforcement for multiple replicas. Production TLS/CORS/CSP/HSTS and actual provider failures require staging verification.
- Tenant-scoped item/barcode/party/document/branch/serial policies are documented in the schema and tested on exercised paths. Google subject and login identities are intentionally global. Variant SKUs are enforced across the Retail item/variant write paths under a company lock; historical imports/legacy paths require conflict review. Nullable stock dimensions and historical duplicate assumptions remain a migration/data review item.
- Browser bearer tokens remain in localStorage; CSP/XSS review is required. Platform MFA is not implemented. Native toolchain, TalkBack, physical printing and device camera/share acceptance are pending.
- Public operator identity, monitored support contact, final retention/commercial policies and manual account-deletion fulfillment must be completed. A pending deletion request never pretends deletion occurred.
- Historical development credentials removed from the working file may remain in Git history; rotate them if ever reused. Ignored scratch files/test credentials/traces/dumps stay outside the deployment artifact. No history rewrite or reset was performed.
- Vite/Vitest configuration warnings and development-tool advisories remain disclosed. Runtime dependency audits reported zero known vulnerabilities; that is not proof of absence of vulnerabilities.

## FIXED

The concrete code/auth/management/composition/browser defects above are fixed. Google sign-in validates official signed tokens, audience/issuer/expiry/verified email and a five-minute single-use server nonce. Explicit password-proved linking uses immutable Google subject; matching email cannot grant access, and Retail Google cannot grant Platform authorization. Native uses Credential Manager rather than WebView OAuth.

Daily Galla uses actual cash ledger movement, opening/count reconciliation and historical/date-scoped views. UPI profiles, static/exact-amount QR, invoice preference, authenticated tenant scoping and manual payment confirmation remain real. Android print/share bridges are source-prepared and intentionally report dialog/chooser opening rather than physical completion.

Business/profile/subscription/features/devices/staff/location/documents/security/help/public policy routes use real APIs or truthful provider states. The light theme uses warm white, white cards, pale sage summaries, subtle borders, readable labels and 48px controls. Large text and explicit optional dark mode remain usable. Dark/neon hero styling is removed from the default experience. Route splitting keeps initial JavaScript at approximately **372 kB** (119 kB gzip), including the latest Retail improvements.

## DEFERRED — required before a paying-customer launch

1. Create actual hosting/PostgreSQL/private storage/backup accounts and secrets; build/validate containers and the exact staging TLS deployment. Configure shared rate limits, monitoring and assigned incident contacts.
2. Verify live S3 attachments and encrypted offsite backup retention, scheduler/alerts, managed PITR, full DB **and attachment** recovery, measured RPO/RTO. Selective shared-DB tenant restore is unsupported.
3. Create Google Cloud OAuth clients/origins/signing fingerprints and a real SMTP domain/provider. Verify web/native Google linking/login/logout and delivered recovery/reset links.
4. Complete the exhaustive requested cross-tenant method/resource matrix and realistic scale/upgrade testing. Existing attack suites pass; every possible route/method combination is not certified by this report.
5. Fill and approve App publishing placeholders, legal/commercial/retention terms and monitored support; assign identity-verified deletion fulfillment and data-portability support.
6. Install Android JDK/SDK, compile/sign the release AAB, test actual devices/Play-installed Google/print/share/camera/accessibility/network flows, complete store assets/screenshots/declarations and Play review requirements.

These are external configuration/operational/acceptance gates, not fabricated PASS results. [SETUP_GUIDE.md](../SETUP_GUIDE.md) provides the beginner sequence; [GOOGLE_LOGIN_SETUP.md](../GOOGLE_LOGIN_SETUP.md) and [PLAY_STORE_PUBLISHING.md](../PLAY_STORE_PUBLISHING.md) provide detailed account/native steps.

## Automated/build evidence

The latest owner-authorized billing/calendar/Home improvements and final sanitized evidence are in [2026-10-07-retail-improvements](2026-10-07-retail-improvements/README.md); earlier light-theme/auth evidence remains under [2026-10-07-phase8](2026-10-07-phase8/README.md). Historical failed runs exposed defects or outdated assertions and are not added to final counts. No discovered test is skipped to obtain PASS. Tests operate on guarded disposable localhost databases, never the user's normal business database.

| Check | Result |
|---|---|
| Backend E2E | 16 files, **189 passed, 0 failed, exit 0** |
| Backend unit/integration | 29 files, **235 passed, 0 failed, exit 0** |
| Chromium full browser | **43 passed, 0 failed, exit 0**, including the default light palette, fresh tenant lifecycle and requested Retail improvements |
| Backend typecheck/build | PASS, both exit 0 |
| Frontend typecheck/build | PASS, both exit 0 |
| Clean PostgreSQL chain | All **25 migrations** deployed; status up to date; validate/generate exit 0 |
| Runtime npm audit | Backend 0, frontend 0 known advisories, both exit 0 |
| Capacitor Android sync | PASS, exit 0; does not compile Java or sign an AAB |
| Android release-input guard | Correctly exits 1 without a real HTTPS API/approved publication configuration |
| Native compilation / Docker build | FAIL / unavailable toolchain; not tested |

E2E covers existing Retail/universal/batch/serial, bundle/modifier, accounting/inventory, Platform, authorization/tenancy, auth lifecycle, publishing/privacy, local backup/restore and production races. The 235 unit/integration tests include nine signed Google-token cases and six S3 encryption/retention/tamper cases using simulated transport. Neither proves a configured cloud provider.

**Final automated total: 467 passed, 0 failed; all three test commands exited 0.** The expected exit 1 of the Android release-input guard is a separate unresolved publication gate, not a passing native build.

## Required production status

PASS below means the explicitly stated local evidence, not a blanket cloud/device certification.

| Gate | Status |
|---|---|
| SECURITY | FAIL for production signoff — exercised code boundaries pass; live recovery/edge/operational gates open |
| TENANT ISOLATION | FAIL for exhaustive signoff — exercised tenant/resource attacks pass; complete matrix still required |
| SUPER ADMIN SECURITY | PASS locally — persisted explicit authority, tenant-token denial and audited controls |
| DATABASE MIGRATION | PASS — clean 25-migration chain; customer-scale upgrade remains a release check |
| BACKUP | FAIL — real local/offsite code, production provider/schedule not configured |
| RESTORE DRILL | PASS locally — actual disposable whole-database recovery; production-like DB/object drill FAIL |
| ACCOUNTING | PASS for tested posting/reversal/payment/Galla flows; journals balanced |
| INVENTORY | PASS for tested standard/variant/unit/measurement/batch/serial/bundle/location posting; no feature-side projection mutations |
| SUBSCRIPTIONS | PASS — tested lifecycle/expiry/downgrade preserve historical data |
| ENTITLEMENTS | PASS — tested backend plan/override/global/user permission and advanced configuration gates |
| RETAIL BROWSER | PASS — real lifecycle, item configuration, payment modes, retries, Galla and error states |
| SUPER ADMIN BROWSER | PASS — real tenant creation and audited controls; laptop/tablet/desktop views exercised |
| FRESH TENANT | PASS — actual Super Admin-created tenant and new owner initialize and complete Retail flows |
| MOBILE | PASS in Chromium at 360×800/390×844/412×915; desktop 1280 also passes; physical native acceptance remains open |
| BACKEND BUILD | PASS |
| FRONTEND BUILD | PASS |
| AUTOMATED TESTS | PASS — 467 passed, 0 failed; E2E/unit/browser commands exit 0 |
| DEPLOYMENT DOCS | PASS — implementation/commands and unverified infrastructure distinguished |
| DISASTER RECOVERY DOC | PASS — actual/proposed RPO/recovery and provider/key/contact gates documented |
| SECURITY DOC | PASS — authorization/auth/secrets/support/privacy/backup and limits documented |
| RELEASE CHECKLIST | PASS document — operational items remain unchecked |
| GOOGLE LOGIN | PASS signed-token/security code tests; FAIL live web/native acceptance until configured |
| PLAY STORE | FAIL release gate — prepared source/pages/listing/icon/graphic; signing/account/publication still required |

## Daily Galla and UPI acceptance

| Requested check | Status |
|---|---|
| DAILY GALLA / Opening Cash / Cash Reconciliation / Galla History | PASS in real API and final complete browser acceptance; no auto-accounting for a count difference |
| UPI Setup / UPI ID Validation / Static QR / Bill Amount QR / Khata Payment QR / Invoice QR | PASS in real API and final complete browser acceptance |
| Share/Print QR | PASS web dialog/capability controls; native physical-device/share/print FAIL until tested |
| Tenant Isolation | PASS exercised Galla/profile/QR/settings boundaries |
| No Fake Auto Payment Confirmation | PASS — showing/scanning QR does not post money |

## UI and AI disposition

[PRODUCTION_UI_REVIEW.md](PRODUCTION_UI_REVIEW.md) updates the reference comparison and records deliberate simplifications versus genuinely unimplemented functionality. No claim of complete competitor parity or market leadership is made. The owner's newest light/minimalist direction governs styling.

Installed official design/browser skills: Figma, Figma implementation and Playwright. No Figma URL was supplied; no fictitious Figma design work is claimed.

[WHATSAPP_VOICE_ASSISTANT.md](../WHATSAPP_VOICE_ASSISTANT.md) describes multilingual Whisper/faster-whisper → Qwen3-4B allowlisted intent → exact authorized tenant reports → Hindi Indic Parler-TTS → signed/deduplicated WhatsApp Cloud API replies. Free model weights do not eliminate compute or WhatsApp costs. No WhatsApp account, live voice worker or external customer messaging exists yet.

All changes remain in the dirty working tree for review, preserving prior user work. No production deployment, Play upload or automatic next phase was performed.
