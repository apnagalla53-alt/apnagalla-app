# Subscription, Shop Features, backup and export verification

Verified 9 October 2026. This report covers the commercial plan matrix, company preferences, related server enforcement, subscription screens, manual exports and account-exit portability. It does **not** certify the entire Retail UI migration or a production deployment.

## Findings and corrections

| Severity | Finding | Result |
|---|---|---|
| High | Plan assignments, optional shop preferences and runtime access were not consistently separated across paid operations. | Shared server entitlement resolution now combines lifecycle, assignments/overrides, global rollout, company preference and existing user permissions. Advanced writes, paid reports, GST, assistant tools and export routes enforce it. |
| High | A complete owner download did not enforce the new tier-specific export contract. Backup and owner download language was ambiguous. | Separate EXPORT_* keys, audited bounded report exports, Pro complete-record export and all-tier account-exit portability. Backup coverage remains independent of export keys. |
| High | Staff/location access required commercial limits and re-enable checks. | Limits checked on the server; default internal structures retained. |
| High | Downgrade could leave advanced data without clear access/recovery rules. | New paid uses are restricted; physical/financial history remains intact and appropriate return/reversal recovery is retained. Tested with existing serials, locations, bills and journals. |
| Medium | Subscription/Shop Features screens lacked complete comparisons, upgrade explanations, grouped switches and wallet feedback. | API-backed cards, comparisons, current state, safe downgrade confirmation, real payment history and clear unavailable-provider screens. |
| Critical release gate | Production offsite backup, scheduling, alerts, object recovery and measured recovery targets are not configured. | **Still blocked.** Local whole-database recovery was tested; it is not evidence of live customer protection. |

The existing inventory, pricing, POS, purchase and accounting engines remain authoritative. These changes add commercial checks and UI around them; they do not rebuild the Retail core. Existing canonical platform plan edits are preserved after initial installation. Grandfathered DEFAULT capabilities are retained as explicit tenant grants, so existing shops can differ from the new default matrix.

## Actual execution evidence

| Check | Passed | Failed | Pending | Exit code | Evidence |
|---|---:|---:|---:|---:|---|
| Backend unit tests, 35 files | 1,294 | 0 | 0 | 0 | [Unit JSON](../../output/playwright/stitch/subscription-unit.json) |
| Full API E2E, 21 files | 479 | 0 | 0 | 0 | [E2E JSON](../../output/playwright/stitch/subscription-full-e2e-final.json) |
| Final commercial E2E rerun, 1 file | 69 | 0 | 0 | 0 | [Commercial JSON](../../output/playwright/stitch/subscription-commercial-final.json) |
| Real backup/restore tests, 1 file | 3 | 0 | 0 | 0 | [Restore JSON](../../output/playwright/stitch/subscription-backup-restore.json) |
| Playwright CLI headed browser checks | 175 | 0 | — | 0 | [Headed checks](../../output/playwright/stitch/subscription/headed-results.json) |
| Final comparison-label browser recheck | 2 | 0 | — | 0 | [Final labels](../../output/playwright/stitch/subscription/final-comparison-checks.json) |

The commercial tests and restore tests are **included in** the full E2E suite. Do not add the reruns to the full-suite total. Vitest's nested suite counters are not source-file counts.

The full suite includes Retail flow, universal item/serial workflows, batch/FEFO, bundle/modifier, GST, costing/profit, assistant, authentication, security, platform administration, attachments, imports, tenant administration and publishing/account tests. Test fixtures explicitly select the plan needed for the behavior under test. An earlier paid image-upload fixture failed because it lacked the new image entitlement; the fixture was corrected and the final complete suite passed.

| Schema/build check | Result |
|---|---|
| Clean disposable PostgreSQL migration deploy, entire 33-migration chain | PASS |
| `prisma migrate status` | PASS; 33 migrations, up to date |
| `prisma validate` | PASS; exit 0 |
| `prisma generate` | PASS; exit 0 |
| Backend `tsc --noEmit` / `npm run build` | PASS / PASS; exit 0 |
| Frontend `tsc --noEmit` / `npm run build` | PASS / PASS; exit 0 |

[Schema/type-check results](../../output/playwright/stitch/subscription-build-checks.json), [migration status](../../output/playwright/stitch/migration-status.log), [validation](../../output/playwright/stitch/prisma-validate.log), [generation](../../output/playwright/stitch/prisma-generate.log). The final frontend build includes the provider-truth comparison labels. Vite reports a roughly 533 kB main JavaScript chunk warning; production performance review remains advisable.

No migration reset or data-loss push was used. The new migration adds `CompanyConfiguration.shop_feature_settings`. API tests use `evolix_subscription_20261009_test`; unit tests use the existing disposable `evolix_import_20261007_test`; restoration targets `evolix_master_restore_test`. Customer/development data was not the restore target.

## Plan and security acceptance

| Required behavior | Result | Evidence/qualification |
|---|---|---|
| Starter ₹75, Smart ₹120, Pro ₹210 | PASS | Persisted server catalog and HTTP checks for all three prices/limits. Prices remain platform-editable. |
| Starter core billing, stock, Khata, purchases, expenses, Galla and basic reports/text assistant | PASS | Core plan assignments and Retail regression; fresh Starter billing posts a balanced journal. |
| Starter advanced inventory/GST/profit/diagnosis blocked | PASS | Direct requests fail before paid entity access; item flags and weight/length/area/volume modes tested. |
| Smart GST, profit, diagnosis and advanced item capabilities | PASS | HTTP commercial checks plus GST/costing/universal/batch/bundle regression. |
| Smart voice, serials, locations and advanced pricing restricted to Pro | PASS | Direct denials; no frontend-only access decision. |
| Pro serial/warranty, locations, pricing, compatibility and advanced staff entitlement | PASS | Commercial checks and existing universal/tenant-administration regression. |
| Pro voice-only entitlement | PASS | Starter/Smart deny; Pro reaches the unavailable-service boundary. |
| Working voice assistant | **FAIL / NOT IMPLEMENTED** | Pro returns `VOICE_NOT_CONFIGURED`; no speech channel/provider is configured. |
| Separate shop preferences, immediate new-use restriction | PASS | Owner-only company JSON preferences, concurrent update preservation and audit. |
| Core/export/backup meaningless switches rejected | PASS | Core preference mutation fails; backup has no commercial off switch. |
| Platform tenant grants and global rollout OFF | PASS | Persisted grant works; rollout OFF still defeats it. |
| Direct API/payload/token bypass blocked | PASS | Advanced writes, paid exports, forged company settings and platform access checks. |
| Tenant isolation and existing permission integration | PASS in tested scope | Cross-company/foreign IDs rejected; safe staff directory excludes credentials and foreign membership. |
| Smart staff cap and platform-configured location cap | PASS | Two extra staff allowed, third rejected; configured two-location cap rejects a third. |
| Expiry and renewal | PASS | New writes/paid use blocked, core historical reads and owner exit copy retained; renewal restores eligible access. |
| Downgrade preserves stock/history/accounting | PASS | Record counts and physical/financial state retained; serial/location history survives. |
| Storage byte quota | **NOT IMPLEMENTED** | Numeric allowance is metadata; metering/enforcement must not be claimed. |

The commercial file has 69 passing tests covering plan identity, entitlement rules, staff/location limits, preferences, overrides, downgrade, exports, tenant boundaries and expiry. Every implemented Pro report-export kind is exercised directly, Smart's Pro-only export denials are checked, and all three tiers retain exit download after expiry. A commercial BACKUP denial override is tested on each tier and cannot remove protection scope. These domains overlap within tests; they are not separate additive test totals.

## Manual export acceptance

BLOCKED below means the expected plan denial passed, not a broken authorized workflow.

| Export | Starter | Smart | Pro |
|---|---|---|---|
| Items | PASS | PASS | PASS |
| Stock | PASS | PASS | PASS |
| Existing basic sales/returns report | PASS; retained core report | PASS | PASS |
| Customers | BLOCKED as required | PASS | PASS |
| Suppliers | BLOCKED as required | PASS | PASS |
| Selected customer/supplier Khata | BLOCKED as required | PASS | PASS |
| Purchases | BLOCKED as required | PASS | PASS |
| Expenses | BLOCKED as required | PASS | PASS |
| Issued GST invoices | BLOCKED as required | PASS | PASS |
| Profit reports | BLOCKED as required | PASS | PASS |
| Safe staff directory | BLOCKED as required | BLOCKED as required | PASS |
| Stock locations | BLOCKED as required | BLOCKED as required | PASS |
| Document metadata | BLOCKED as required | BLOCKED as required | PASS; metadata only |
| Complete business-record NDJSON | BLOCKED as required | BLOCKED as required | PASS |
| Scheduled export | Unavailable | Unavailable | **NOT IMPLEMENTED** |
| Full attachment/file archive | Unavailable | Unavailable | **NOT IMPLEMENTED** |
| Recorded owner account-exit portability | PASS | PASS | PASS |

Server export routes check tenant, persisted permission, entitlement and report filters; they audit the action. Responses are bounded to at most 1,000 rows, and CSV clients neutralize spreadsheet formulas. Foreign selected IDs are rejected. Date-based reports use the existing facades. Customer/supplier lists include zero-balance masters and current allocation-derived outstanding values.

Complete-record downloads contain bills/lines, purchases, payments, returns, inventory operations, accounting records, GST and safe staff membership. Password hashes, sessions, tokens and attachment storage paths are excluded. The stream must contain its final completion marker before it is saved. It is a live paginated data copy, not a consistent recovery snapshot or vendor-specific import file.

Normal Pro downloads and all-tier account-exit downloads have separate UI actions. A pending owner DATA_PORTABILITY/DELETE_ACCOUNT request authorizes exit download without upgrading. The request does not delete the tenant. Owner download preparation creates the existing support follow-up queue entry and explains that support may contact them; no call or external message is automatically sent.

## Backup acceptance

| Check | Result |
|---|---|
| All paid tiers included in operator data protection scope | PASS |
| No plan/export filter on the full PostgreSQL archive | PASS |
| BACKUP cannot be removed by a commercial tenant override | PASS |
| Real local PostgreSQL archive and restore | PASS |
| Fresh Starter, Smart and Pro records recovered | PASS |
| Production offsite provider/schedule/alerts | **NOT CONFIGURED** |
| Production attachment/object recovery | **NOT VERIFIED** |
| Measured production RPO/RTO | **NOT MEASURED** |
| Shared-database selective tenant restore | **NOT IMPLEMENTED** |

The real `pg_dump`/`pg_restore` drill checks restored customer, item, posted stock movement and accounting voucher records for every paid tier, plus the marker, organization, operator and migration records. The UI reports backup configuration truth. Having a paid subscription does not configure a scheduler, provider or recent verified archive. All paid tiers must receive the same full protection when production infrastructure is activated.

## Subscription and Shop Features UI acceptance

| Requirement | Result |
|---|---|
| API-backed current plan/status/price/expiry/limits card | PASS |
| Starter, Smart and Pro cards | PASS |
| Smart Most Popular and current-plan highlighting | PASS |
| Grouped full plan comparison | PASS |
| Starter → Smart and Smart → Pro upgrade preview | PASS; live paid checkout unavailable |
| Pro → Smart downgrade warning and explicit confirmation | PASS |
| Records-safe messaging and preserved live plan after unavailable checkout | PASS |
| Wallet icon visible feedback and real recorded payment/empty history | PASS; dead click **NO** |
| Provider-not-connected state/support link | PASS |
| Provider-connected online payment flow | **BLOCKED; not integrated/configured** |
| Manage Shop Features/Profile links | PASS |
| Voice Pro-only display and unavailable-service explanation | PASS |
| GST Smart+ and export plan display | PASS |
| Shop Features grouped search/detail/included/available/locked states | PASS |
| Owner optional switches and locked Smart/Pro upgrade CTA | PASS |
| Separate Data Backup, Data Export and account-exit copy | PASS |
| 360×800, 390×844, 412×915 | PASS for reviewed subscription/features/backup screens |
| English and Hindi | PASS for reviewed screens |
| Light and dark | PASS for reviewed screens |
| Desktop three-column plans | PASS at 1366 px |
| Subscription network error/retry | PASS; retry restores real API-backed plan |

The headed CLI run used fresh test shops with all three plans. It covered all three mobile widths in English/Hindi light mode, dark checks across widths for Smart/Pro plus Starter at 390 px, desktop plan layout, enabled and denied CSV/full downloads, switch persistence, downgrade confirmation and a network-abort/retry. There was no document horizontal overflow in the checked viewports, and measured primary actions were at least 43 px high.

Representative screenshots: [Starter English](../../output/playwright/stitch/subscription/starter-en-plans-390.png), [Starter Hindi](../../output/playwright/stitch/subscription/starter-hi-plans-390.png), [Pro final card](../../output/playwright/stitch/subscription/final-pro-subscription-390.png). See the [headed check list](../../output/playwright/stitch/subscription/headed-results.json) for exact coverage; do not extrapolate it to every Retail route.

## Remaining release work

- Configure and rehearse production offsite database and attachment protection, scheduling, alert delivery, retention and recovery; publish measured RPO/RTO and assign operators.
- Integrate and verify a real online subscription payment provider before offering successful online upgrades. Manual authorized platform records remain available.
- Implement/configure the Pro voice channel before advertising usable Voice Ask EVOLIX. Text and the separate checkout thank-you greeting remain available.
- Scheduled exports, attachment archives and storage byte quotas are not implemented and are labeled accordingly.
- Review large report scopes: some existing facades load selected report data before CSV pagination, and stock reporting has a 10,000-item guard. Validate realistic volumes and frontend bundle performance before launch.
- Finish whole-product visual and browser acceptance. The earlier broad frontend run has 45 unresolved tests; this scope does not establish that those failures were fixed or certify the full Stitch route matrix.
- Assign account-exit fulfillment/deletion ownership and publish retention/support policies before launch.

Local development is running at `http://localhost:5173` with API port 8010. Isolated commercial QA uses web 5174/API 8011. Both APIs' `/api/v1/health` and `/api/v1/health/ready` returned HTTP 200 after restart; both frontends served HTTP 200. Readiness is `/health/ready`, not `/ready`.

Implementation and scope are described in [SUBSCRIPTION_ENTITLEMENTS.md](../SUBSCRIPTION_ENTITLEMENTS.md) and [DISASTER_RECOVERY.md](../DISASTER_RECOVERY.md). No deployment was performed. The plan/export enforcement and reviewed screens passed; production readiness and functioning voice/payment services are not declared complete.
