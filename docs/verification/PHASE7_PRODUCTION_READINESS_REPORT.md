# EVOLIX Phase 7 production readiness report

Historical snapshot. See [PRODUCTION_COMPLETION_REPORT.md](PRODUCTION_COMPLETION_REPORT.md) for subsequent fixes, current verification and remaining release gates.

**Decision: NOT READY FOR CUSTOMER PRODUCTION. No deployment performed.**

Independent audit and hardening completed against the dirty working tree on 6–7 October 2026. Prior PASS declarations were not accepted as proof. The current human Phase 7 request supersedes the unfinished master-completion prompt. Existing Retail architecture was retained. No Wholesale, Distributor engine, Manufacturing, Restaurant KOT or experimental module was added. Daily Galla and UPI were expressly authorized additions.

## CRITICAL ISSUES FOUND

| ID | Finding | Outcome |
|---|---|---|
| C1 | Legacy Purchase reads/post/reverse routes accepted another tenant's bare document UUID | Fixed: company-qualified path/reference authorization before service processing; real HTTP attacks reject foreign documents |
| C2 | Unvalidated nested Prisma relation payloads could forge ownership on legacy create routes | Fixed: recursive reference validation, tenant-context checks and rejection of relation mutation envelopes |

No known critical code exploit from these findings remains open. This does **not** establish zero production blockers: recovery, authentication recovery, product completeness and the complete requested isolation/regression gates remain unresolved.

## HIGH ISSUES FOUND

| ID | Finding | Outcome |
|---|---|---|
| H1 | System-role Boolean bypassed permissions; Retail/POS/upload permissions were inconsistent | Fixed: persisted roles/permissions, explicit tenant-owner roles, inferred module permissions and separate Platform authorization |
| H2 | Financial retries/concurrent writes could duplicate posting or oversell | Fixed on covered financial paths: atomic persisted idempotency, payload conflicts, item/serial/party/document locks; shared PO lock prevents different GRNs over-receiving; UUID receipt numbers avoid timestamp collisions |
| H3 | Weak production configuration/default accounts/origins could start | Fixed: startup validation, distinct JWT secrets, production origins/storage/version checks, no production bootstrap users, private first-admin CLI |
| H4 | MIME declarations/local filesystem handling were insufficient | Fixed local boundary and private S3 adapter prepared: image signatures, size/type/path/entity checks, safe keys and authorized content retrieval; live S3 verification remains open |
| H5 | Production backup/recovery provider and operational policy absent | **Deferred/blocking**: real local archives and restore drill pass; production offsite/PITR/retention/encryption/alerts/RPO/RTO are NOT CONFIGURED or NOT MEASURED |
| H6 | Claimed completed product is incomplete | **Deferred/blocking**: bundle/modifier workflows/tests, parts of serial/location/settings/staff/document UI and reference parity remain incomplete; no new business engine was invented |
| H7, found during browser audit | Upgraded legacy DEFAULT plan lacked core Retail entitlements | Fixed by additive migration 23, with preservation of audited explicit plan edits; fresh-owner browser lifecycle passes |
| H8, found during report audit | Bank transfers appeared as UPI; split payments could also be counted as other receipts | Fixed: immutable payment snapshots distinguish UPI/Card/Bank; split allocation tested against actual posted vouchers |
| H9 | Public-customer password change/recovery and temporary-password expiry are absent | **Deferred/blocking**: login/session security is tested, but no recovery/email/OTP flow is represented as implemented; operator process and provider integration must be completed |
| H10 | Entire regression suite cannot pass with missing legacy modules/APIs | **Deferred/blocking**: CloudSync import failure and three tenant-management browser failures remain visible, without deleting/skipping tests or implementing excluded modules |

Additional hardening: financial-year/account/party ownership checks at journal posting; serial and batch consistency; cash-count response-race fix; stale-session 401 protection; request IDs/sanitized errors/security headers/readiness; bounded lists/search; scoped uniqueness/indexes; formula-safe CSV; no token-bearing frontend error logging; secret-free environment examples and deployment documentation.

## MEDIUM / LOW issues

- M1: pagination/search covers main Retail lists and tenant directory, but some legacy/serial/batch/Platform detail lists are bounded without complete next-page discovery or remain unbounded. Do not advertise full large-data readiness.
- M2: report aggregation and weekly Galla history can read substantial data repeatedly; dashboards still need representative production load/query-plan testing. No comprehensive performance SLO was measured.
- M3: in-process rate limits require shared edge/distributed enforcement for multiple API replicas. Login, uploads and expensive Retail reads are throttled; POS is not indiscriminately throttled.
- M4: localStorage bearer tokens require careful XSS/CSP review; the reverse-proxy CSP template is not a deployed/validated server configuration. Legacy accessibility and duplicate local/global failure messages still need polish.
- M5: migration lock/duration testing with realistic customer scale, object-storage integration, monitoring/alert delivery and account portability beyond report CSV remain unverified.
- M6: nullable stock-dimension uniqueness and legacy variant/barcode policies deserve a historical-data review. Item locking protects normal authoritative posting; existing duplicates were not silently merged.
- L1: known scratch helpers/output were moved to ignored quarantine; a historically committed archived development DB credential was replaced with a placeholder. Git history was not rewritten: rotate it if reused anywhere. Development-only fixtures/helpers remain explicitly isolated.
- L2: frontend bundle is approximately 686 kB and emits a size warning; it builds successfully. Vite/Vitest configuration warnings remain. Git diff whitespace check passes.

## FIXED / DEFERRED

Fixed findings: C1, C2, H1–H4 code boundaries, H7, H8 and the concrete accounting/inventory/browser defects above. H2 is tested for duplicate checkout, unknown outcome retry, last stock, same serial, batch, party payments, purchase retry, duplicate returns and PO over-receipt.

Deferred blockers: H5 production recovery, H6 product/reference completeness, H9 secure owner recovery/change/temporary-password lifecycle, H10 complete regression. Live provider/edge/monitoring and complete attack/load matrices remain release gates. No external credentials, bucket/provider access or incident contacts were available, and no production system was contacted or deployed.

## Actual automated results

| Run | Passed | Failed tests | Failed suites before discovery | Exit code | Evidence |
|---|---:|---:|---:|---:|---|
| Backend E2E, 11 files | 120 | 0 | 0 | 0 | [E2E log](2026-10-07-phase7/phase7-final-e2e.log) |
| Legacy unit/integration, 27 files | 216 | 0 | 1 | 1 | [Legacy log](2026-10-07-phase7/phase7-final-legacy-tests.log) |
| Chromium browser, 31 tests | 28 | 3 | 0 | 1 | [Browser log](2026-10-07-phase7/phase7-final-browser.log) |
| **Aggregate** | **364** | **3** | **1** | **1, release gate FAIL** | 367 discovered tests; the missing suite has zero discovered tests |

Backend file counts: Retail flow 18, Retail field coverage 7, expenses 2, attachments 5, universal items 20, batch/FEFO 17, security 10, Platform control plane 11, local backup/restore 3, production audit 26, application 1. Serial receipt/concurrent sale/return/resale/warranty and serial/batch consistency are real tests within the production-audit suite. **Dedicated bundle/modifier regression: absent, FAIL.**

Legacy failure: `src/intelligence/module_24.spec.ts` imports nonexistent `cloud-sync.service`. Browser failures: tenant user search, tenant session-management screen and legacy organization lifecycle. Their management APIs are missing; visible shells/modals do not prove operational CRUD. All 21 current Retail/Platform acceptance tests pass, alongside seven remaining identity/UI tests. No missing test was silently skipped.

A previous browser run exposed genuine legacy-plan entitlement failures. These were fixed and rerun; the final fresh tenant was created through Super Admin and completed the owner Retail lifecycle. Earlier test counts/failures are historical and are not added to final totals.

## Builds and database

| Check | Result | Evidence |
|---|---|---|
| Backend `npx tsc --noEmit` | PASS, exit 0 | [Typecheck](2026-10-07-phase7/phase7-backend-typecheck.log) |
| Backend `npm run build` | PASS, exit 0 | [Build](2026-10-07-phase7/phase7-backend-build.log) |
| Frontend `npx tsc --noEmit` | PASS, exit 0 | [Typecheck](2026-10-07-phase7/phase7-frontend-typecheck.log) |
| Frontend `npm run build` | PASS, exit 0; bundle warning | [Build](2026-10-07-phase7/phase7-frontend-build.log) |
| New disposable DB, entire 23-migration deploy/status | PASS | [Clean migration](2026-10-07-phase7/phase7-clean-migration-final.log) |
| Prisma validate/generate | PASS | Same log; Windows DLL regeneration required stopping only this task's Trade API, then succeeded |
| Existing development DB 22→23 with records | PASS | [Upgrade log](2026-10-07-phase7/phase7-dev-migration.log) |
| Production dependency audits | PASS, zero reported vulnerabilities in both production dependency trees | [Backend audit](2026-10-07-phase7/phase7-backend-dependency-audit.json), [frontend audit](2026-10-07-phase7/phase7-frontend-dependency-audit.json) |

E2E used `evolix_phase7_clean_20261007_test`; legacy tests used `evolix_master_20261006_test`; restore used the explicitly disposable `evolix_master_restore_test`. Legacy cleanup did not run on the development/customer database. No migration reset, destructive db push or automatic migration rollback was used. A customer-scale staging upgrade remains unverified.

## Tenant isolation coverage and its limits

PASS for exercised attacks: altered signed JWT/platform claims; company/branch/FY header substitution; foreign Purchase order/receipt/invoice reads/post/reverse; foreign items, units, variants, batches, serials, supplier/customer references; nested relation payloads; foreign bill/return/expense/need/Khata/attachment operations; QR and Galla isolation; tenant credentials against Platform GET/POST/PATCH/DELETE; explicit Cashier permission denials. Both tenants are provisioned independently and attacks use real HTTP requests.

The requested full resource × GET/POST/PATCH/DELETE matrix is **not complete**. Staff/tenant device/settings/branch/location administration have missing or unfinished endpoints/workflows. Reports are company scoped and query boundaries are reviewed, but every report/write verb and branch/location variant was not separately attack-tested. Unsupported route 404s are not counted as proof of isolation. Therefore the unrestricted final **TENANT ISOLATION gate is FAIL**, while the exercised implementations pass.

## Uniqueness and integrity policy

Item SKU and party code are company qualified; company code is organization qualified; branch code is company qualified; location code is branch qualified; financial year label is company qualified. Document uniqueness where declared includes company/FY, not every tenant globally. Batch identity includes its company/item. Serial receipt normalizes whitespace/case and enforces company-wide uniqueness; sold/returned/resold history has immutable allocation/warranty snapshots.

Global tenant login username, Platform username, organization identity/code/display number, permission/feature/plan catalog codes and cryptographic session identities are intentional global namespaces under the current login/catalog contract. Variant SKU/barcode and legacy stock-null-dimension data need further historical ambiguity review; no global uniqueness is claimed for ordinary tenant product/customer/supplier codes.

Posted financial transactions use double entry, company-owned accounts and valid branch/FY. Tests reconcile debit/credit, supported source documents, cash movements and nonnegative authoritative stock. Cash-count differences create no journal. UPI display creates no receipt. No profit or stock valuation is fabricated. Manufacturing source that writes projections is not registered in this Retail deployment; it was not expanded or advertised.

## Browser and visual acceptance

Fresh owner: login, add item, stock purchase, customer, cash/UPI/Udhar/split bills, history, original return, customer collection, supplier purchase/payment, expense, Need List and reports pass. Settings/backup/location/staff/documents/master feature completeness remains separate and incomplete.

Platform: login/dashboard, create/open tenant, plan/feature changes, suspend/reactivate, user/activity/usage review, real manual revenue/refunds/expenses, database infrastructure and audit pass. Real backup/restore APIs pass in the disposable automated drill; production provider and browser backup operations are not accepted as configured production recovery.

Retail viewport checks cover 360×800, 390×844, 412×915 and desktop 1280×900 with no horizontal overflow on tested flows. New Home/More/Galla/UPI pages have light and dark captures. Platform checks include 768 tablet, 1280 laptop and 1440 desktop. This is local Chromium evidence, not every device/browser/route or physical-printer certification.

Selected captures: [Galla](2026-10-07-phase7/galla-reconciled.png), [dark Home](2026-10-07-phase7/home-dark-390.png), [UPI setup](2026-10-07-phase7/more-payments-light-390.png), [customer ₹500 QR](2026-10-07-phase7/khata-upi-500.png), [Platform desktop](2026-10-07-phase7/platform-1440.png), [purchase fields](2026-10-07-phase7/retail-purchase-fields-390.png). Trace archives contain disposable bearer credentials and are deliberately not copied into review evidence.

The 26-screen reference comparison is [PHASE7_UI_PARITY.md](PHASE7_UI_PARITY.md). **UI parity FAIL: 26 screens audited; no full-screen parity accepted.** Existing form fields and functional coverage are recorded individually, with professional organization/navigation/settings/report gaps. No calendar, supplier reminder or WhatsApp integration was faked.

## Daily Galla and UPI acceptance

| Required capability | Result / evidence boundary |
|---|---|
| DAILY GALLA | PASS, actual posted cash movements and separate UPI/Udhar |
| Opening Cash | PASS, optional override retained after reload |
| Cash Reconciliation | PASS, matched/short/excess; never posts an accounting difference |
| Galla History | PASS, bounded seven-day history plus custom-date lookup |
| UPI Setup | PASS, save/load one primary business profile |
| UPI ID Validation | PASS, format only; no bank-verification claim |
| Static UPI QR | PASS, proper encoded URI without a forced amount |
| Bill Amount QR | PASS, exact ₹480 payable QR; payment requires separate confirmation |
| Khata Payment QR | PASS, ₹500 collection QR does not automatically reduce ₹1,200 due |
| Invoice QR | PASS, tenant toggle; fully paid invoice uses generic shop QR without Pay Now |
| Share/Print QR | PASS for browser download/copy/share fallback and isolated print action; native device sharing and physical printer remain unverified |
| Tenant Isolation, Galla/UPI | PASS, cross-company header/profile access rejected and summaries isolated |
| No Fake Auto Payment Confirmation | PASS, QR display does not create voucher/receipt |

Expected cash = opening cash + actual cash debits − actual cash credits. Cash sales, old cash collections, supplier cash payments, expenses, owner withdrawals and refunds are independently tested; UPI/card/credit do not add physical cash. India business-day boundaries are tested around UTC midnight. Failed response retry preserves billing identity and returns the original invoice exactly once; full offline POS is not implemented.

## Production metrics and providers

Subscription receipts are manual real database records: net receipt = amount + tax − discount − refund for paid records; pending sums pending charge records. MRR uses the latest paid current billing period per active, non-complimentary organization, excludes tax/refunds and normalizes by actual billed months; ARR = MRR×12. It is neither gateway-confirmed bank revenue nor a list-price forecast. Trial-conversion/churn cohorts are unavailable.

Database size/connections/latency and process/host memory/CPU are measured locally. Cloud CPU/disk/storage/PITR/billing adapters are UNAVAILABLE, not synthetic. Live S3, payment gateway, email/SMS/WhatsApp, uptime/error tracking and backup alerts are NOT CONFIGURED / NOT VERIFIED. Public health returns liveness/version and readiness returns safe DB status; [HTTP headers/readiness](2026-10-07-phase7/health-and-headers.log) are measured. Production HTTPS/HSTS/CSP/edge limits remain deployment-layer staging gates.

## Required final status

| Gate | PASS / FAIL |
|---|---|
| SECURITY | FAIL — production recovery/password lifecycle/edge gates remain |
| TENANT ISOLATION | FAIL — full requested attack matrix incomplete; exercised boundaries pass |
| SUPER ADMIN SECURITY | PASS — tested local persisted platform authorization/audited controls |
| DATABASE MIGRATION | PASS — clean 23-migration chain and existing local upgrade |
| BACKUP | FAIL — production provider/policy NOT CONFIGURED |
| RESTORE DRILL | PASS — real disposable whole-DB recovery only |
| ACCOUNTING | PASS — covered posted flows balanced and supported sources verified |
| INVENTORY | FAIL — covered standard/variant/unit/batch/serial flows pass; full bundle/modifier/location acceptance incomplete |
| SUBSCRIPTIONS | PASS — tested state/expiry/plan controls preserve records |
| ENTITLEMENTS | PASS — covered module/advanced/draft-post checks, overrides/global rollout/permissions |
| RETAIL BROWSER | PASS — tested current core lifecycle; full product/reference completeness FAIL separately |
| SUPER ADMIN BROWSER | PASS — tested controls; production provider acceptance remains FAIL |
| FRESH TENANT | PASS — actual Super Admin-created owner and default structures, then billing lifecycle |
| MOBILE | PASS — specified tested viewport flows; full parity/OS/device certification not claimed |
| BACKEND BUILD | PASS |
| FRONTEND BUILD | PASS |
| AUTOMATED TESTS | FAIL — 364 passed, 3 failed tests, 1 undiscovered failed suite; aggregate exit 1 |
| DEPLOYMENT DOCS | PASS — [production deployment](../PRODUCTION_DEPLOYMENT.md), unexecuted server template clearly identified |
| DISASTER RECOVERY DOC | PASS — [disaster recovery](../DISASTER_RECOVERY.md), actual versus proposed protection distinguished |
| SECURITY DOC | PASS — [security](../SECURITY.md), limits and provider gaps recorded |
| RELEASE CHECKLIST | PASS — [release checklist](../RELEASE_CHECKLIST.md), unchecked operational gates remain |

## Remaining production blockers

1. Configure and rehearse production DB/object backups, encryption/offsite retention, alerts and recovery; measure RPO/RTO and assign incident contacts. Selective tenant restore is unsupported.
2. Complete secure owner password change/recovery and temporary-password expiration with tested session revocation and real delivery/operator policy.
3. Resolve legacy regression scope/APIs and the missing CloudSync suite without hiding failures; deliver/accept missing bundle/modifier/serial/location/settings/staff/document product workflows in a separately approved scope.
4. Complete the requested isolation matrix, representative load/upgrade tests, live storage/monitoring/HTTPS/edge validation and data-portability policy.
5. Close the 26-screen reference/UI parity gaps and review accessibility across all supported routes.

All code remains uncommitted for review, including prior work already present when this phase began. [Final git status](2026-10-07-phase7/git-status-after.log) is evidence of that boundary. Local Trade services run on 8010/5173; the unrelated school service was not stopped. No secrets, bearer traces or database archives are in the review evidence. Stop for review; do not deploy or start another phase automatically.
