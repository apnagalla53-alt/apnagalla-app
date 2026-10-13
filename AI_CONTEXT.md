HOSTING PREPARATION — 12 October 2026:
Selected web stack Netlify frontend + Render API + Neon PostgreSQL. Beginner guide
docs/NETLIFY_RENDER_NEON.md and inactive deploy/netlify.toml.example,
deploy/render.yaml.example, deploy/neon-roles.sql.example added. TOML/YAML syntax
checked. Keep same-origin /api proxy for Strict cookies; runtime and migration
connections separated; Neon runtime role created through SQL without privileged
neon_superuser membership. Initial staging uses direct TLS DB connections until
pooler/RLS verified. Paid continuous API/private photo storage/offsite recovery,
SMTP, live Google, ingress/client-IP and staging acceptance remain release gates.
No accounts, secrets, DNS, Git push or deployment changed. Templates are examples,
not active root configs; Docker/Neon/provider behavior remains unverified live.

LATEST GOOGLE BUSINESS ONBOARDING — 12 October 2026:
Single mobile profile precedes plans; signed Google name retained, shop blank,
unverified +91 contact with duplicate protection, 59 searchable stable categories,
Other description, optional GPS/manual address, atomic one-time retail defaults.
Backend states persist Profile → Plan → Migration; paid requests remain pending.
Saved Fresh/Import choices wait in ACCESS_PENDING until authorized activation.
Frontend refreshes owner permissions after approval before opening Home/Importer.
Existing preview/commit importer now has Continue to Home after completion.
Full evidence: docs/verification/GOOGLE_BUSINESS_ONBOARDING_20261012.md.
Final 1,302 unit + 136 focused real PostgreSQL HTTP + 7 headed Chrome assertions
pass (1,445, zero failures). Both typechecks/builds pass; 35 migrations unchanged.
Mobile 360/390/412 and desktop 1440, actual CSV opening stock, trial, manual approval,
resume and returning login tested. Google browser identity is test-only; real library
RSA verification separately tested. Live Google consent, geocoding, payments and
voice are not certified/configured. No deployment, existing data change or unrelated
project changes. Disposable previews stopped; do not assume localhost ports running.

LATEST SECURITY REMEDIATION — 12 October 2026:
Independent audit and remediation: docs/verification/SECURITY_AUDIT_20261012.md
and docs/verification/SECURITY_REMEDIATION_20261012.md. Barcode HTML escaped,
browser HttpOnly cookie sessions with signed CSRF, volatile native tokens,
mandatory Platform TOTP/recovery, shared PostgreSQL limits, sanitized image
decode/quota, production secret/role gates and forced business RLS implemented.
Final 1,301 unit + 579 PostgreSQL API/restore + 45 headed browser tests pass
(1,925 total, zero failures). Both clean npm ci/builds, typechecks and Prisma
validate/generate pass; 35 migrations. Full npm audits zero known vulnerabilities.
Local EVOLIX dev and preserved preview databases migrated with business counts
preserved; runtime role evolix_runtime is restricted and owns no tables.
Separate .env.maintenance.local stays outside the API; owner handoff is ignored
Windows DPAPI .operator-access.local.dpapi, shown only via the local owner script.
Known weak credentials and JWTs rotated; sessions revoked. Other projects and
the shared DBA password are untouched per the user's explicit instruction.
That historically leaked shared DBA credential remains valid and blocks release.
Provider OAuth secret revocation, Retail MFA, actual TLS/containers/staging,
offsite recovery, monitoring/provider delivery and signed-device acceptance remain
open. No deployment. Disposable test servers stopped; do not assume app ports live.

PREVIOUS ACCOUNT/PLATFORM AND FULL RETAIL REGRESSION — 9 October 2026:
Master account/onboarding/referral/Platform controls implemented using the existing
architecture. Final 1,294 unit + 508 PostgreSQL API + 97 headed browser tests pass
with zero failures; browser result is one all-green complete invocation. Both
typechecks/builds and Prisma validate/generate/status pass; 34 migrations deployed
to clean disposable databases. Evidence and provider limits:
docs/verification/PLATFORM_CONTROL_PLANE_VERIFICATION.md.
Live Google/SMS/SMTP, offsite recovery, Docker/staging and physical devices remain
blocked/unverified. No deployment. Haidery preview 5175/8012 (tenant 138), dev
5173/8010; disposable test servers 5176/8013 stopped. Stop for review.

PREVIOUS LOCAL RETAIL REGRESSION — 8 October 2026:
Compact Inventory/Low Stock/Purchase cards, corrected entry-form footers/headers,
searchable universal/custom units with safe pre-history editing, scalar litres,
and Split Cash + UPI + customer Udhar/promise-date checkout are verified.
1,294 unit + 388 API E2E passed; 97 distinct headed browser cases passed after
targeted repairs/rechecks; 10 fresh category workflows, 6 unit proofs and 154 layout
combinations passed. Backend/frontend typechecks/builds and standard Prisma
status/validate/generate passed; 31 migrations are current on disposable databases.
Evidence: docs/verification/2026-10-08-retail-polish/README.md.
Local preview uses 5173/8010. Production/provider/device gates remain unresolved
unless separately verified; no deployment or new phase authorized by this work.

PREVIOUS VERIFIED PHASE — 8 October 2026:
Phase 5.6 Universal Costing, COGS and Financial Reporting is verified locally.
Moving weighted-average inventory, immutable sale cost/profit snapshots, original-cost
returns, known-cost coverage, financial reports and deterministic Assistant queries
use the existing Inventory/POS/Purchase/Accounting/Retail architecture.
Evidence: docs/verification/PHASE_5_6_VERIFICATION.md.
1,097 unit + 341 API E2E + 43 headed browser tests passed; builds and 31 migrations pass.
Unknown historical cost and unsupported service direct costs remain explicitly incomplete.
STOP for owner review. No Business Insight, external LLM, next phase or deployment authorized.

PRODUCT:
EVOLIX Retail V1

STRATEGY:
Retail first.
Wholesale/Distributor/Manufacturing later as isolated modules.

STACK:
Backend:
NestJS
TypeScript
Prisma
PostgreSQL

Frontend:
React
Vite
Zustand

ACTIVE PRODUCT:
Retail mobile-first billing application.

ACTIVE CORE:
Auth
Multi-tenancy
Inventory
Accounting
Pricing
POS
Platform

RETAIL MODULES:
Home
Billing
Items
Customer Khata
Suppliers
Purchases
Supplier Khata
Need List

MULTI-TENANCY:
Organization → Company → Branch → Godown.
Never accept arbitrary tenant identity from Retail request bodies.

DESIGN:
White + light green.
Mobile first.
Simple retailer language.
No ERP terminology in normal Retail UI.

IMPORTANT ARCHITECTURE RULE:
Retail UI → Retail Facade → Shared ERP Core.

Never duplicate accounting/inventory logic in Retail.

PROTECTED:
Phase 1 Retail billing/items/customer khata.
Do not alter core behavior without regression testing.

CURRENT DEVELOPMENT:
Retail only.

LATEST REVIEW — 7 OCTOBER 2026:
The owner explicitly requested centred billing navigation, price-only catalog billing,
split UPI receipt QR, configurable payment greetings, searchable receiving,
supplier/repayment Calendar and clearer Home module discovery.
These extend the existing Retail facade and shared posting engines.
Stock counting is explicit: price-only goods invent no stock; real inventory receipts
start counting; historical bill lines preserve their counting snapshot for returns.
Calendar holidays cover selected verified 2026 dates and disclose regional/year limits.
See docs/MANUAL_TEST_PLAN.md and docs/verification/2026-10-07-retail-improvements/README.md.
Production cloud/provider/Android acceptance gates remain open; no deployment authorized.

LATEST REQUESTED ADDITIONS:
Latest owner-requested additions (7 October 2026): first-sign-in migration choice,
reviewed item/party/opening stock/dues imports, Hindi/Hinglish report questions,
opt-in in-app daily summaries, shop portability download with Platform support
follow-up queue, and customer-directed WhatsApp receipt/Udhar chat redirects.
These extend the existing facade/posting engines; no external customer messages,
selective tenant restore, arbitrary import-to-table or live WhatsApp AI is claimed.
Verification: docs/verification/2026-10-07-import-report-rerun/README.md.
539 distinct automated tests pass, with final affected-case rechecks and both builds.
Original manual guide: 65 PASS / 4 PARTIAL / 3 BLOCKED. Production/provider/device
gates remain; do not declare production ready or deploy automatically.

RETAIL DESIGN REVIEW (8 October 2026):
User selected Home, Items, Stock and Expenses for the next design pass.
Light-first Retail refresh implemented, with grouped tools in a top-left hamburger
drawer available on all Retail routes (user's follow-up), loaded stock
counts and keyboard-accessible item rows, grouped item/expense fields and labeled
photo uploads. All advanced item fields and existing facade/core postings remain.
Scoped styles: frontend/src/retail/retail-refresh.css; reusable RetailFormSection.
Verification: docs/verification/2026-10-08-retail-design/README.md.
23 selected existing headed browser cases pass after a category-selector correction;
24 screen/viewport checks pass; 18 accessibility scans report zero violations.
Frontend typecheck/build exit 0. These are scoped rechecks, not additional tests to
add to the earlier 539-test total. Production gates remain unchanged.
Drawer follow-up: four affected existing cases pass after correcting overlapping
sticky headers; six drawer viewport/focus/accessibility checks pass; all 24 screen
layouts rechecked. All 16 original tools moved off Home into the 20-link drawer.
Held Bills now displays the real created_at timestamp. Evidence: the same report.

LAN PREVIEW (8 October 2026):
User requested same-network PC/mobile access. LAN preview on port 5174 uses the
development Vite /api proxy to the existing local API on 8010. Explicit startup
flags expose the preview; production CORS/auth rules were not loosened.
Fixed HTTP-LAN browser UUID/SHA-256 availability through shared browserCrypto.ts;
strong random IDs and identical SHA-256 idempotency fingerprints are retained.
Two existing headed Retail cases pass on the actual HTTP IP origin, frontend
typecheck/build exit 0, two SHA vectors and 1,000 v4 UUID checks pass.
Windows firewall rule creation requires administrator access and was denied;
manual local-subnet-only command and restart steps: docs/LAN_TESTING.md.
Physical second-device connectivity remains unverified. No public deployment.

FUTURE MODULES (not authorized to start):
Wholesale
Distributor
Manufacturing

ASSISTANT V1 — VERIFIED LOCALLY (8 October 2026):
Deterministic in-app read-only Assistant at /retail/assistant, with Home/drawer/More
entry and Platform /platform/assistant administration. 50 registered intents,
511 curated phrases (506 distinct normalized) and 611 reference cases. Zero
external LLM calls; no WhatsApp/voice/business writes. Reuses shared Retail,
Reports, Counter/Galla, Inventory projections, Khata and Entitlement services.
Additive migration 20261008120000_assistant_v1 adds four tables; all 27 migrations
deploy cleanly to a disposable PostgreSQL database. Scoped conversations expire
after 15 idle minutes; redacted query logs have 30-day retention; human-approved
unknown-to-intent mappings are audited. No financial answer cache or log payload.
Final tests: 1,030 unit / 291 PostgreSQL E2E / 6 headed browser passed, zero failed;
775 routing checks include 100 authored held-out and 33 negative questions.
All 50 tools have independent posted-fixture result expectations. Backend and
frontend typecheck/build, Prisma validate/generate/status all exit 0.
Load: 85/85 success at 10/25/50 concurrent. At 50, processing P50/P95/P99 is
192.31/208.85/211.76 ms; P50 misses the 150 ms target. Local bursts do not prove
sustained production capacity. Physical mobile keyboard/provider/Android release
gates remain separate. No deployment. STOP for review; no next phase authorized.
Evidence/complete matrix: docs/verification/ASSISTANT_V1_REPORT.md.
Architecture, metric definitions and limits: docs/ASSISTANT_ARCHITECTURE.md.

### Retail UX modernization — 8 October 2026

The full Retail interaction refresh is ready for review, not deployed. The verification report is `docs/verification/RETAIL_UX_MODERNIZATION.md`: 26 ZIP references plus four stock screenshots, 67 baseline Retail TSX files, 40/40 native select declarations replaced, 27 changed workflow groups and three retained groups. Native sheets, search/pagination, direct payment choices, stock CSV/filter/actions, custom categories, Retail staff/permissions and standard stock transfers use the existing engines.

Final evidence: 292 backend E2E and 1,030 unit tests passed; 65 distinct headed Retail browser scenarios passed after fixes and targeted reruns (not one all-green invocation). Frontend project typecheck/build, backend typecheck/build and Prisma validation/status passed; all 27 local migrations are applied. Mobile 360/390/412, tablet/desktop and both themes passed. The blank manual PDF now has 114 checks on 21 pages.

Do not claim global production/Play readiness from these results. Real provider/native-device/recovery gates remain in the release checklist. Variant/batch/serial location transfer is unsupported by the current transfer DTO and disabled in its sheet. Movement history preview is bounded to the existing API page; the role picker displays up to 100 roles. No deployment or next phase was started.

### EVOLIX Assistant V1.5 — 8 October 2026

Owner-authorized deterministic, read-only business diagnoses now extend the existing
Assistant: 36 insight intents / 96 total, consuming authoritative Phase 5.6 profit,
COGS, cost coverage and existing Retail report/counter/Khata/inventory services.
Period comparisons are fair; direct and correlated evidence are labeled; overlapping
drivers are not added twice. Zero external LLM calls. Historical stockout duration,
repeat-customer frequency, active selling days and exact multi-day Galla remain
unavailable and are disclosed rather than guessed.

Final evidence: 1,294 backend unit / 382 PostgreSQL E2E / 7 headed browser tests passed;
Prisma checks and backend/frontend typechecks and builds passed; all 31 migrations are
up to date on disposable test databases. The 170-request local performance burst had
zero failures; diagnosis processing P50/P95/P99 at concurrency 50 was
540.68/576.86/579.51 ms. This is not a sustained production-capacity guarantee.
Full matrix: docs/verification/ASSISTANT_V1_5_REPORT.md. No WhatsApp, external LLM,
voice or autonomous action phase was started; stop for review and do not deploy.

### A4 GST invoice module — 9 October 2026

Owner-authorized GST Invoices sidebar workflow: saved registered-business setup,
past itemized bill selection or new bill through the existing Retail POS, metadata
confirmation, immutable issue and A4 print/PDF. Company/FY numbering is atomic;
issuance does not repost stock, payment or accounting. Historical tax snapshots,
measured quantities, HSN/SAC/UQC and local/interstate tax splits are preserved.
Item forms support a custom GST percentage alongside common rate choices.

Final scoped regression: 142 PostgreSQL E2E passed, zero failed, including 22 GST
tests. Backend/frontend typechecks and builds, Prisma validate/generate and all
32 migrations passed. Full migration chain tested on a clean disposable DB and
upgrade from the prior 31 migrations. Headed browser new/past-bill flows, Hindi,
360/390/412/desktop layouts and one/four-page A4 exports verified. The broader
costing run found and fixed UTC-date stock/accounting reversals using the existing
Indian business-date helper; reversal-date assertions now pass.

Government reporting provider remains NOT CONFIGURED. Required/uncertain IRN or
statutory dynamic QR applicability blocks issuance. No GST filing, reverse charge,
export/SEZ, cess or statutory GST credit notes are provided by this slice. Local
GSTIN validation is not registration verification. Ready for owner review only;
no deployment or future phase started. Details: docs/GST_INVOICES.md.
Evidence and tested limits: docs/verification/GST_A4_VERIFICATION.md.


## 9 October 2026 — Commercial plans, export separation and subscription UI

Defaults now use Starter ₹75 / Smart ₹120 / Pro ₹210, installed through existing Plan/Feature/Entitlement records. New tenants default to Starter. Runtime shop preferences use CompanyConfiguration.shop_feature_settings, migration 20261009140000_shop_feature_settings (33 migrations total). Shared server entitlement resolution governs advanced item writes, GST, paid financial reports/diagnosis, voice gate, staff/location limits, pricing and CSV/full exports. The old RetailCapabilitySettings bootstrap booleans are not runtime authorization. Legacy DEFAULT assignments are preserved as tenant grants when moved to Starter; canonical operator plan edits are not overwritten on restart.

Backup scope never depends on plan/export grants. Actual production provider/schedule remains NOT CONFIGURED. Real local pg_dump/restore verifies Starter/Smart/Pro customer, item, stock movement and journal records. Manual export tiers: Starter item/stock and retained basic sales; Smart customer/supplier/Khata and operational/GST/profit; Pro safe staff/location/document metadata and complete NDJSON business records. Scheduled/file-archive export is unavailable. Explicit pending account-exit portability/deletion requests permit core-record downloads on any tier, including expiry. No data deletion occurs.

New Subscription and Shop Features screens use API-backed identity/prices/access, a tenant/session-safe shared cache, five grouped sections, owner switches, upgrade prompts, real empty/manual payment history, functional wallet and safe downgrade warning. Voice has Pro-only entitlement but no working channel/provider; API returns VOICE_NOT_CONFIGURED. Online checkout is not integrated; no fake plan/payment changes. Payment thank-you greeting remains a separate core setting.

Verification: 1,294 backend unit tests, 479 API E2E tests, 69 final commercial tests within that suite, 3 real backup/restore tests within it, 175 Playwright CLI headed checks plus 2 final comparison-label checks. All implemented Pro export kinds, Smart advanced export denials, all-tier backup override safety and all-tier expired account-exit portability now have explicit HTTP checks. Both builds and Prisma status/validate/generate/type-checks pass. See docs/SUBSCRIPTION_ENTITLEMENTS.md and docs/verification/SUBSCRIPTION_ENTITLEMENTS_VERIFICATION.md. This is not a whole-product Stitch/prod-ready declaration. Earlier full headed frontend run still has 45 unresolved tests, and live cloud backup/payment/voice plus production deployment remain blocked. Local dev API 8010/web 5173 restored; isolated commercial QA API 8011/web 5174.

## 9 October 2026 — Master account and Platform control plane

The newer supplied master specification extends the existing architecture with
public mobile OTP/Google signup, explicit identity linking, persisted owner/business/
plan/import onboarding, configured one-time trials over Starter/Smart/Pro, owner
referral links and audited Platform campaigns/qualification/manual rewards. Mobile
contact data never acts as a verified identity; provider/account matching cannot
merge accounts by email or name. Paid-plan requests remain PENDING until real
operator-recorded activation; default trial offers are disabled.

Platform controls now include bounded owner/provider/import/referral metadata,
credential reset/temporary password/revocation, scoped role assignment with last-owner
protection, editable display codes, archive/restore and guarded permanent erasure.
Deletion is disabled by default and requires reviewed retention/legal/recovery
policy. Local attachment erasure has a durable manifest, retry cursor and audited
lease; S3 version erasure is blocked until verified provider tooling exists.

Migration 20261009170000_account_control_plane brings the chain to 34. Existing
accounts default to READY. Final backend evidence: 1,294 unit and 508 PostgreSQL
API tests passed, zero failures. Both project typechecks/builds and Prisma
validate/generate/status passed; clean disposable databases deployed all 34
migrations. Backend source maps are excluded, runtime dependency audits report
zero known advisories, and 46,740,935 bytes in 39 generated cache files were removed.

Final full headed frontend regression passed 97/0/0 skipped/0 flaky, exit 0
in one 26.3-minute invocation after initial failures and fixes. The earlier 94/3
full run and 3/0 focused rerun remain preserved separately. Check
docs/verification/PLATFORM_CONTROL_PLANE_VERIFICATION.md and private
output/platform-control/frontend-final.json for actual counts and limits.
Fixes include contrast, centered Bill, retryable report inbox and a staff permission
save that reopened a dismissed dialog. Tests use visible drawer navigation and
report traversal pacing within the unchanged production quota.

Haidery plywood preview uses localhost:5175/API 8012 and its original tenant 138
(EVX-19634672), separately from the disposable acceptance servers on 5176/8013.
Dev remains 5173/8010. Live Google/SMS/SMTP, offsite recovery, Docker/staging and
physical-device acceptance remain unconfigured/unverified. No deployment or
native/offline/WhatsApp/GST-provider phase was started. Stop for review after evidence.

## 10 October 2026 — Local Google OAuth configuration

The owner's real public Web OAuth client ID is now configured only in the ignored
backend environment. No Google client secret was stored. Local capabilities,
database readiness and nonce challenge checks passed; the official Google button
loaded after an initial startup-race 502 and refresh. A real Google account login,
explicit existing-shop connection, consent and production/Android acceptance are
still pending; this is not provider acceptance or a production-ready declaration.

Port 5175 is currently used by the owner's separate school project. EVOLIX Trade
now runs on frontend 5173 with its preserved Haidery preview database API 8012;
LAN frontend is 192.168.31.178:5173 at the time of verification. The school process
was not stopped or changed. Updated setup: docs/GOOGLE_LOGIN_SETUP.md. Evidence:
docs/verification/GOOGLE_LOCAL_SETUP_20261010.md and the private screenshot under
output/platform-control. The owner must replace the client secret exposed in their
console screenshot and complete the Google test-account acceptance.

### 10 October 2026 — Google signup discoverability and local Chrome acceptance

Password login now exposes Create account with Google; unregistered Google login returns GOOGLE_ACCOUNT_NOT_REGISTERED with a signup action. Signup puts Google before optional configured OTP, starts with unchecked consent and leads to existing owner/business/plan/migration onboarding. Existing password accounts still require explicit linking; email matching does not grant access. Native signup uses the same contract. Live signup challenge returned 201 after restarting only the EVOLIX preview API (8012); frontend remains 5173, unrelated school project 5175 preserved. Standalone headed Chrome reached Google's sign-in screen; Codex popup's generic 400 cause remains unconfirmed. Final isolated PostgreSQL auth/onboarding/security regression: 45 passed, 0 failed; headed CLI fixture UI: 7 checks passed, 0 failed, including mobile widths. Initial clean-DB fixture missing identity.admin was made self-contained. Backend and frontend typechecks/builds exit 0. Live new-owner Google signup/consent remains owner acceptance; no full-product production-ready declaration. Evidence: docs/verification/GOOGLE_LOCAL_SETUP_20261010.md.

### 10 October 2026 — Targeted shopkeeper QA and pending Smart access approval

Returns UI now reads the actual total_returns response key and labels posted invoice
value as Total Return Value (cash refunds plus Khata credits). Authoritative Decimal
totals use the same company/branch/date row set as the report and export. Returns CSV
downloads all pages and saves no partial file if a page fails. Optional photo upload
states prevent false failure/retry controls; retries reuse the saved item/expense/
purchase/sale ID. New shops receive ten expense categories; company-locked one-time
initialization preserves existing categories. Sales cash wording links to Daily Galla;
amount-only sale warns in English/Hindi that stock and exact profit are unavailable.

Platform Organizations now has a pending-access filter and audited Grant access form.
Organization activation alone never approved a PENDING subscription. The new approval
atomically activates the chosen plan/duration, advances owner onboarding, blocks tenant
tokens/archived shops/replays and requires a meaningful reason. Complimentary approval
creates no revenue; paid approval requires a real recorded unrefunded shop/plan receipt.
Automatic payment gateway activation remains NOT CONFIGURED. Procedure and future
verified webhook boundary: docs/PLATFORM_ACCESS_APPROVAL.md.

The user replaced ambiguous QA cleanup with permission to create fresh accounts and
reproduce the problems. No existing tenant matched the supplied email/shop name, and
none was deleted. Final evidence: 60 PostgreSQL API E2E and 14 headed Chrome tests pass,
zero failures, exit 0; all 34 migrations deploy on fresh disposable DBs; Prisma validate
and both typechecks/builds pass. The original 445/10/435 sales, 385 expected drawer and
-47 known-cost profit still reconcile. Shared accounting/posting logic was unchanged.
Runners remove only their own disposable DBs; final browser uploads are separately
isolated and removed. Details: docs/verification/SHOPKEEPER_QA_20261010.md.

Review runtime remains localhost:5173 / API 8012 with its preserved preview DB; API
restarted and ready. School project 5175 untouched. Live Google provider acceptance,
gateway, physical hardware and unrelated production features are not certified by
these tests. No deployment or new phase started. Stop for review.

### 10 October 2026 — General Store and Developer QA scenario fixes

Recreated both attached reports in fresh disposable shops, including the older QA
transactions, the ₹1,00,000 / eight-bill grocery scenario and the Developer ₹100 item
minus ₹10 discount, ₹100 tender / ₹10 change, then ₹90 cash return. Original preview
QA records were inspected read-only and preserved. After the Developer return,
gross/returns/net are ₹1,00,090 / ₹460 / ₹99,630; expected and counted drawer remain
₹21,880 with zero difference; known-cost net profit remains ₹15,720.

Returns Report and Bill Details share tenant-scoped posted return/refund history.
Bill details preserve the original posted invoice and add returned/remaining units,
actual refund history and adjusted settlement. Safe server failures have request IDs.
Return success now leaves the form with an in-app confirmation; frontend submission
locks and existing server idempotency/over-return guards prevent duplicate refunds.

Itemized checkout and supplier/customer payments use the optional-photo state machine,
eliminating false retry prompts. Incoming UPI recording requires explicit cashier
confirmation and remains manual; a missing profile produces no receiving QR. Backup
claims distinguish configuration from verified protection; provider, latest archive,
restore, schedule and retention are honestly unconfigured/not reported here.

Read-only report reuse is bounded to ten seconds and keyed by session/shop/query.
Writes and context changes invalidate it; only a short server-directed 429 read retry
is allowed. Partial report failures preserve other available results. Server limits
remain enforced. Purchase CSV follows every page, fails without delivering partial
data and provides a filename and retained download link; account export selection
is locked during preparation. Supplier totals show loading rather than false zero.
Product cost coverage is explicitly separate from ₹120 unknown-cost service revenue.
English/Hindi copy and existing default expense-category fixes are retained.

Focused evidence: 73 PostgreSQL API tests and 36 headed Chrome tests pass, zero failed,
exit 0; all 34 migrations deploy on clean disposable databases; Prisma validation,
backend/frontend typechecks and builds exit 0. API tests include balanced journals,
batch restoration, tenant/branch rejection, three concurrent identical return retries
creating one refund and server rate-limit boundaries. Browser tests include real CSV
downloads, delayed loading, deliberate failure recovery and mobile/desktop reflow.
Details and limitations: docs/verification/GENERAL_STORE_QA_20261010.md.

Review preview remains localhost:5173 / rebuilt API 8012, both HTTP 200 and database
ready; unrelated school project 5175 untouched. Real backup/restore, GST provider and
registration, email/OTP recovery, voice and broader production acceptance remain
unconfigured or unverified. Historical Returns Report 500 did not reproduce in the
inspected current preview; its original root cause is not claimed as established.
No existing data cleanup, live provider transaction, deployment or new phase occurred.
Stop for owner review.

### 10 October 2026 — Busy-day billing, edit/delete and barcode preference

Recreated the user's busy-counter scenario in fresh disposable shops: 7 lines / 12
units / ₹1,998 with ₹2 change, followed by 3 lines / 3 units / ₹819 with ₹181 change.
Constructed equivalent grocery prices are documented because the source report did
not provide the original rates. Baseline 9 bills / ₹99,630 net becomes 11 / ₹1,02,447;
cash increases ₹2,817; expected drawer becomes ₹24,697; supplier/customer dues remain
₹29,954 / ₹11,200. Existing preview businesses and original QA records were preserved.

Items and customer/supplier accounts now expose permission-aware Edit/Delete/Restore.
Delete archives master records; stock, invoices, cost layers and accounting history
remain intact. Pending party balances and active bundle components block removal.
Removed records are excluded from new transaction choices; removed item billing and
stock-purchase buttons are disabled. Need List editing and reversible cancellation
use scoped audited writes. Profile edits cannot rewrite opening dues. Base units are
protected after stock or document history; existing unit conversions remain available.
Item metadata, future prices, photos, GST and HSN can be edited safely.

Packet selection no longer silently becomes PCS when switching to counted selling.
Receipt New Bill opens billing directly. Billing/checkout/receipt distinguish lines
and units. Settings → Billing preferences has a persisted tenant barcode toggle,
OFF by default. Inputs and scan copy are hidden while off; stored barcode data and
existing ERP lookup code are retained. Enabled keyboard Enter adds one unique match;
ambiguous results retain the chooser. No camera/physical scanner support is claimed.

Evidence: 87 PostgreSQL API tests and 45 unique headed Chrome acceptance tests pass,
zero failures, exit 0. A final strengthened 9-test Chrome subset also passes after
the removed-item action guards and saved-Packet inventory assertion. All 34 migrations
deploy on clean disposable PostgreSQL; migrate status/Prisma validation and both
typechecks/builds pass. Earlier Chrome context-close timeouts followed passed workflow
assertions; navigating away before revoking the test session eliminated them in the
full rerun. A failed Need edit photo can be skipped without leaking edit state into
the next new request. Details: docs/verification/BUSY_DAY_QA_20261010.md.

Verified cache allowlist cleanup removed 9,332,935 bytes / 33 generated Vite files and
the empty backend node_modules/.cache directory. Source, dependencies, builds, Git,
uploads, databases, backups and evidence were preserved; Vite regenerates needed cache.
Frontend 5173 is HTTP 200; rebuilt API 8012 reports ready; school project 5175 untouched.
Sustained load, physical scanner and full production readiness were not certified by
this targeted work. No deployment or new phase started. Stop for owner review.

### 12 October 2026 — Independent 20-check security audit

Audit request only; no production business/auth implementation was changed. Details:
docs/verification/SECURITY_AUDIT_20261012.md. Earlier security PASS statements must not
be used as a release approval. Confirmed open findings: barcode label generation
interpolates stored text into unsafe HTML; visible Chrome executes a harmless marker
without CSP, while exact configured Nginx CSP blocks that payload. No deployed-origin
exploit or token exfiltration was attempted. The committed archived database password
matches the current local PostgreSQL configuration; inspected local app connections
are superuser/BYPASSRLS. A known weak Platform password remains in the preserved preview,
and another development password account matches a known weak credential. Values are
redacted; coordinate any rotation across other services sharing the DB account.

Bearer tokens persist in localStorage; no application-enforced MFA exists. Mobile OTP
sign-in is implemented but is not MFA. RLS is absent; length-only JWT validation accepts
repeated-character keys; rate limits are per process and incomplete for expensive
operations. Main API logging is sanitized, but local storage read/save error logging
still includes raw errors/paths. Core attachment scoping/MIME/size/signature controls
and covered SQL/tenant/platform/permission attacks pass; no comprehensive live-server
certification is implied. No payment webhook or arbitrary browser-supplied fetch URL
was found. Current production build artifacts contain no source maps.

Fresh disposable PostgreSQL regression: 83 assertions / 6 suites pass, exit 0, all 34
migrations deploy, backend typecheck passes. Three assertions intentionally confirm
open findings rather than security success. Two stale legacy test assumptions (upload
directory and expense-category cleanup) were corrected, and the complete rerun passed.
Full npm audits find 6 backend packages (3 high / 1 moderate / 2 low) and 3 moderate
frontend packages, all in development/build dependency trees; runtime-only audits
find zero known advisories in either project. No dependency fixes were applied.

The ordinary 5173/8012 preview was offline. No hosted app URL, TLS, live CORS/proxy or
production provider was verified. Existing databases were inspected read-only; only
disposable databases/uploads were removed. No password rotated, access changed,
business data deleted, Git history rewritten or deployment performed. Remediation
and actual deployed-site verification are still required. Stop for owner review.
