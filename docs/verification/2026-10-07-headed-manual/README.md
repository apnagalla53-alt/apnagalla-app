# EVOLIX headed acceptance - 7 October 2026

Playwright CLI **0.1.22** was installed globally. An interactive CLI browser walkthrough used `open --headed`; the complete existing and added regression scenarios ran through `@playwright/test --headed`, with one worker and 250 ms slow motion. These are separate tooling paths; the 60 count is the test runner result, not 60 CLI commands.

## Final evidence

| Check | Actual final result |
|---|---|
| Full visible Chromium suite | **60 passed, 0 failed; exit 0** |
| Post-ledger visible recheck | **11 passed, 0 failed; exit 0**; already included in the 60 distinct cases |
| Backend E2E | 190 passed / 16 files; exit 0 |
| Backend unit/integration | 235 passed / 29 files; exit 0 |
| Backend typecheck and production build | Both exit 0 |
| Frontend typecheck and production build | Both exit 0 |
| Prisma validate / migration status | Exit 0; 25 migrations, up to date; no schema changes or reset |
| API readiness / frontend | `ready` / HTTP 200 at localhost 8010 / 5173 |

**485 distinct automated tests passed.** Repeated diagnostic and targeted runs are not added to that count. The 72 manual-guide checks are broader than automated test cases: **63 PASS, 6 PARTIAL, 3 BLOCKED**. PASS evidence can combine real browser actions and real API assertions; each row identifies scope. PARTIAL and BLOCKED are not production release passes. Two additional headed CLI checks verified Enter-key login and interrupted supplier-payment proof recovery.

## Issues found and corrected during visible testing

- Return quantity could reset during asynchronous duplicate development loads. Ignore stale loads and capture the numeric value before a React state updater.
- A variant without an SKU appeared blank in Buy Stock. Render its saved attributes.
- Bill details/receipts showed base quantity instead of the customer's pack unit and omitted saved serial/warranty information. Render persisted entered-unit, variant and warranty data.
- Serial returns had no original-serial selection. Select eligible original serials; the authoritative POS service validates and restores them.
- Failed item search left an invisible dropdown backdrop blocking recovery. Remove that backdrop for an error and provide Retry Search.
- Missing/rejecting device speech is handled without undoing a saved payment. Added label associations for low-stock and inline customer fields.
- Same-day Khata entries were sorted by document text, which could put payment before purchase and misstate running balances. Sort by business date and posting creation instead; a real database regression deliberately reverses document-text order and verifies 50 then 40. The visible supplier ledger confirmed that sequence.

The initial 43-case headed run had 39 passes and four Bill-centre assertion failures. Windows' visible scrollbar occupied viewport space; assertions now measure the actual navigation bar and check button, icon and label. Supplemental diagnostic failures also included incorrect fixture labels/roles, premature serial-control inspection and ambiguous alert/badge locators. These were corrected without skipping tests or using forced clicks. Real workflow fixes were verified in the final complete run.

## Environment and privacy

Browser writes used the disposable `evolix_phase8_browser_20261007_test` database. Final backend E2E used a new `evolix_headed_e2e_20261007_test` database after deploying all 25 migrations; unit/integration used a separate guarded database. Restore targeted only `evolix_master_restore_test`. Existing dirty work was preserved. No production deployment, real customer messaging or Play upload occurred.

Diagnostic E2E repeats on the unit-test database failed setup because older fixture cleanup did not cover purchase orders/returns and matched unrelated claim users by username prefix. Security cleanup now scopes its own organization; purchase-order cleanup was updated. Legacy fixture cleanup still requires separate clean E2E and unit databases. The final fresh-database run is the release evidence; failed diagnostic runs were not counted as passes. Prisma generate initially encountered the Windows live-engine file lock; stopping the local API and rerunning generate succeeded, then the API was restarted.

The 60-case complete run preceded the final same-day ledger correction. That correction passed a new database regression, the full 190-case backend E2E, a headed CLI ledger inspection, and an 11-case headed recheck of supplier/customer/Khata/Galla/calendar workflows. The first targeted recheck had 4 passes and 7 login failures: stale sessions from local API restarts correctly reached the real device limit. Only the named disposable owner's stale sessions were revoked; the final targeted run passed all 11. Device-limit enforcement was preserved.

Credential files and raw CLI sessions, Playwright traces/videos and request logs remain ignored because they can contain authentication data. The disposable platform password was rotated and its sessions revoked; the ignored local credential file contains its updated value. Included results/logs/screenshots are sanitized test evidence.

## Manual-guide execution matrix

| # | Guide check | Result | Evidence / remaining work |
|---|---|---|---|
| 01 | Local access | **PASS** | Headed login, light theme, navigation, module routes, periods, logout and denied access. |
| 02 | Centred Bill button | **PASS** | Headed login, light theme, navigation, module routes, periods, logout and denied access. |
| 03 | Home discovery | **PASS** | Headed login, light theme, navigation, module routes, periods, logout and denied access. |
| 04 | Summary dates and privacy | **PASS** | Headed login, light theme, navigation, module routes, periods, logout and denied access. |
| 05 | Refresh and keyboard | **PASS** | Headed CLI password-field Enter submitted login successfully; browser tests also exercised Tab focus and deep-link refresh. |
| 06 | Logout and denied access | **PASS** | Headed login, light theme, navigation, module routes, periods, logout and denied access. |
| 07 | Save an unknown item while billing | **PASS** | Fresh-shop real purchase, original uncounted return, counted sale, oversell rejection and stock filters. |
| 08 | Find it again | **PASS** | Fresh-shop real purchase, original uncounted return, counted sale, oversell rejection and stock filters. |
| 09 | Start actual counting | **PASS** | Fresh-shop real purchase, original uncounted return, counted sale, oversell rejection and stock filters. |
| 10 | Return an older uncounted sale | **PASS** | Fresh-shop real purchase, original uncounted return, counted sale, oversell rejection and stock filters. |
| 11 | Respect counted stock | **PASS** | Fresh-shop real purchase, original uncounted return, counted sale, oversell rejection and stock filters. |
| 12 | Inventory and alerts | **PASS** | Fresh-shop real purchase, original uncounted return, counted sale, oversell rejection and stock filters. |
| 13 | Cash and change | **PASS** | Real cash/UPI/Udhar/split posting, exact QR amount and reference-only paid receipt. |
| 14 | UPI setup | **PASS** | Real cash/UPI/Udhar/split posting, exact QR amount and reference-only paid receipt. |
| 15 | Half cash, half UPI | **PASS** | Real cash/UPI/Udhar/split posting, exact QR amount and reference-only paid receipt. |
| 16 | Split on the saved invoice | **PASS** | Real cash/UPI/Udhar/split posting, exact QR amount and reference-only paid receipt. |
| 17 | Udhar and promise date | **PASS** | Real cash/UPI/Udhar/split posting, exact QR amount and reference-only paid receipt. |
| 18 | Split amount validation | **PASS** | Real cash/UPI/Udhar/split posting, exact QR amount and reference-only paid receipt. |
| 19 | Quantity, price and discount | **PASS** | Real edited quote, inline customer, held cart, lost-response replay, photo-only retry and bounded original returns. |
| 20 | Customer selection | **PASS** | Real edited quote, inline customer, held cart, lost-response replay, photo-only retry and bounded original returns. |
| 21 | Hold and resume | **PASS** | Real edited quote, inline customer, held cart, lost-response replay, photo-only retry and bounded original returns. |
| 22 | Retry after lost response | **PASS** | Real edited quote, inline customer, held cart, lost-response replay, photo-only retry and bounded original returns. |
| 23 | Attachment retry | **PASS** | Real edited quote, inline customer, held cart, lost-response replay, photo-only retry and bounded original returns. |
| 24 | Return and cancellation limits | **PASS** | Real edited quote, inline customer, held cart, lost-response replay, photo-only retry and bounded original returns. |
| 25 | Basic item and opening stock | **PASS** | Real catalog/purchase/POS/return flows for services, packs, variants, measurements, FEFO and serials. Kit/extras UI and original snapshot return API tests also passed. |
| 26 | Service | **PASS** | Real catalog/purchase/POS/return flows for services, packs, variants, measurements, FEFO and serials. Kit/extras UI and original snapshot return API tests also passed. |
| 27 | Variant and pack unit | **PASS** | Real catalog/purchase/POS/return flows for services, packs, variants, measurements, FEFO and serials. Kit/extras UI and original snapshot return API tests also passed. |
| 28 | Weight, length and area | **PASS** | Real catalog/purchase/POS/return flows for services, packs, variants, measurements, FEFO and serials. Kit/extras UI and original snapshot return API tests also passed. |
| 29 | Batch, expiry and FEFO | **PASS** | Real catalog/purchase/POS/return flows for services, packs, variants, measurements, FEFO and serials. Kit/extras UI and original snapshot return API tests also passed. |
| 30 | Serial, warranty, kit and extras | **PASS** | Real catalog/purchase/POS/return flows for services, packs, variants, measurements, FEFO and serials. Kit/extras UI and original snapshot return API tests also passed. |
| 31 | Supplier details | **PASS** | Expanded suppliers, full catalog search, itemized/amount purchases, three payment states and duplicate supplier bill rejection. |
| 32 | Monthly supplier visit | **PASS** | Expanded suppliers, full catalog search, itemized/amount purchases, three payment states and duplicate supplier bill rejection. |
| 33 | Search Buy Stock items | **PASS** | Expanded suppliers, full catalog search, itemized/amount purchases, three payment states and duplicate supplier bill rejection. |
| 34 | Itemized receiving | **PASS** | Expanded suppliers, full catalog search, itemized/amount purchases, three payment states and duplicate supplier bill rejection. |
| 35 | Credit, paid and partial purchase | **PASS** | Expanded suppliers, full catalog search, itemized/amount purchases, three payment states and duplicate supplier bill rejection. |
| 36 | Pay supplier | **PASS** | Four supplier methods passed. Headed CLI interrupted a proof upload with HTTP 503, retried only the photo, and confirmed one payment of 10 with remaining due 40 from a credit purchase of 50. The saved proof was visible. |
| 37 | Calendar navigation | **PASS** | Saved weekly/monthly visits, month-end clamping, moved/collected receivables, payables, persisted tasks and verified holiday coverage. |
| 38 | Weekly supplier schedule | **PASS** | Saved weekly/monthly visits, month-end clamping, moved/collected receivables, payables, persisted tasks and verified holiday coverage. |
| 39 | Promised customer repayment | **PASS** | Saved weekly/monthly visits, month-end clamping, moved/collected receivables, payables, persisted tasks and verified holiday coverage. |
| 40 | Collected and supplier dues | **PASS** | Saved weekly/monthly visits, month-end clamping, moved/collected receivables, payables, persisted tasks and verified holiday coverage. |
| 41 | Task and meeting | **PASS** | Saved weekly/monthly visits, month-end clamping, moved/collected receivables, payables, persisted tasks and verified holiday coverage. |
| 42 | Holiday accuracy and coverage | **PASS** | Saved weekly/monthly visits, month-end clamping, moved/collected receivables, payables, persisted tasks and verified holiday coverage. |
| 43 | Enable and customize | **PASS** | Persisted per-shop voice settings, real speech requests, received-money triggers, disabled/unavailable handling and foreign company rejection. |
| 44 | Preview and device volume | **PARTIAL** | Real English/Hindi speech requests were made. A person must still confirm audible pronunciation, volume and installed Hindi voices on the target phone. |
| 45 | Confirmed billing greeting | **PASS** | Persisted per-shop voice settings, real speech requests, received-money triggers, disabled/unavailable handling and foreign company rejection. |
| 46 | Customer collection | **PASS** | Persisted per-shop voice settings, real speech requests, received-money triggers, disabled/unavailable handling and foreign company rejection. |
| 47 | Disabled, blocked or offline voice | **PASS** | Persisted per-shop voice settings, real speech requests, received-money triggers, disabled/unavailable handling and foreign company rejection. |
| 48 | Tenant voice privacy | **PASS** | Persisted per-shop voice settings, real speech requests, received-money triggers, disabled/unavailable handling and foreign company rejection. |
| 49 | Opening cash and method totals | **PASS** | Exact drawer: 2000 + 500 + 100 - 150 - 50 - 100 - 80 = 2220; UPI 300 and Udhar 200 separate. Short 20 persisted; Galla/Khata/expense tests passed. |
| 50 | Actual cash movement | **PASS** | Exact drawer: 2000 + 500 + 100 - 150 - 50 - 100 - 80 = 2220; UPI 300 and Udhar 200 separate. Short 20 persisted; Galla/Khata/expense tests passed. |
| 51 | Cash count reconciliation | **PASS** | Exact drawer: 2000 + 500 + 100 - 150 - 50 - 100 - 80 = 2220; UPI 300 and Udhar 200 separate. Short 20 persisted; Galla/Khata/expense tests passed. |
| 52 | Galla history and date | **PASS** | Exact drawer: 2000 + 500 + 100 - 150 - 50 - 100 - 80 = 2220; UPI 300 and Udhar 200 separate. Short 20 persisted; Galla/Khata/expense tests passed. |
| 53 | Business expense versus owner money | **PASS** | Exact drawer: 2000 + 500 + 100 - 150 - 50 - 100 - 80 = 2220; UPI 300 and Udhar 200 separate. Short 20 persisted; Galla/Khata/expense tests passed. |
| 54 | Customer due QR | **PASS** | Exact drawer: 2000 + 500 + 100 - 150 - 50 - 100 - 80 = 2220; UPI 300 and Udhar 200 separate. Short 20 persisted; Galla/Khata/expense tests passed. |
| 55 | Reports directory | **PASS** | Reports/CSV, real private image preview/download, file/tenant security API tests, actual staff/password/revocation and account export/deletion-request browser flows. |
| 56 | CSV export | **PARTIAL** | CSV download bytes, quoting and formula neutralization passed. Opening that CSV in a desktop spreadsheet was not performed. |
| 57 | Document security | **PASS** | Reports/CSV, real private image preview/download, file/tenant security API tests, actual staff/password/revocation and account export/deletion-request browser flows. |
| 58 | Business, profile and print settings | **PARTIAL** | Business/profile/display/invoice settings and print controls passed. A physical printer/service must still be tested. |
| 59 | Staff and logged-in devices | **PASS** | Reports/CSV, real private image preview/download, file/tenant security API tests, actual staff/password/revocation and account export/deletion-request browser flows. |
| 60 | Portability and deletion request | **PASS** | Reports/CSV, real private image preview/download, file/tenant security API tests, actual staff/password/revocation and account export/deletion-request browser flows. |
| 61 | Separate Platform login | **PASS** | Real Super Admin tenant creation and audit controls plus explicit isolation, entitlement and subscription API regression. |
| 62 | Brand-new shop | **PASS** | Real Super Admin tenant creation and audit controls plus explicit isolation, entitlement and subscription API regression. |
| 63 | Plan, overrides and lifecycle | **PARTIAL** | Plan, override, suspension/reactivation and free days passed in the browser; expiry/trial/complimentary rules passed in API tests. Every state was not separately inspected in a Retail browser. |
| 64 | Audit, sessions and support | **PASS** | Real Super Admin tenant creation and audit controls plus explicit isolation, entitlement and subscription API regression. |
| 65 | Metrics and providers | **PASS** | Real Super Admin tenant creation and audit controls plus explicit isolation, entitlement and subscription API regression. |
| 66 | Two-shop attack check | **PASS** | Real Super Admin tenant creation and audit controls plus explicit isolation, entitlement and subscription API regression. |
| 67 | Public publishing details | **PARTIAL** | Public pages and draft publishing settings passed. Legal operator/support/package/retention details still require reviewed real values. |
| 68 | Google and recovery email | **BLOCKED** | Live Google OAuth and SMTP are not configured. Signed-token/recovery security tests passed; real provider login and delivered email remain blocked. |
| 69 | Real backup and restore | **BLOCKED** | Local whole-database backup/restore tests passed. Production private offsite storage, scheduler/alerts, attachment recovery and measured production RPO/RTO remain blocked. |
| 70 | Signed Android app | **BLOCKED** | No signed Android release or physical Play-test phone was tested. Native Google/camera/share/printer/TalkBack acceptance remains blocked. |
| 71 | Slow or disconnected network | **PASS** | Public publishing and failure/retry layouts tested; external release gates are explicitly separated. |
| 72 | Accessibility and release decision | **PARTIAL** | 360/390/412px, larger text, desktop layouts, focus and labels were exercised. A complete contrast/screen-reader/keyboard audit remains open. |

## Repeat the visible run

From `frontend`, set `RETAIL_USERNAME`, `RETAIL_PASSWORD`, `PLATFORM_USERNAME` and `PLATFORM_PASSWORD` from your ignored local test credential file, then run:

```powershell
npx playwright test --config=playwright.headed.config.ts --headed --workers=1
```

The opt-in config keeps ordinary CI defaults unchanged. Its JSON report and private traces are under `output/playwright/`. The original blank fillable guide remains in `output/pdf/EVOLIX_Manual_Test_Guide.pdf`; this operation creates a separate execution report.

Production remains gated by the PARTIAL/BLOCKED items and the operational release checklist. A local all-green browser run is not a signed Android, live Google/SMTP, physical printer, audible Hindi or production backup acceptance. See `docs/verification/PRODUCTION_COMPLETION_REPORT.md` and `docs/RELEASE_CHECKLIST.md`.
