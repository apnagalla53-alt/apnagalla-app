# Apna Galla final commercial plans

Final launch configuration: 13 October 2026. Canonical revision: `APNA_GALLA_LAUNCH_PLANS_V2`.

There are exactly three customer-facing plans. Prices are monthly list prices in INR; recorded subscription payments, taxes, discounts and expiry dates remain authoritative for each subscription. This change does not process payments or deploy the application.

| Plan key | Customer-facing name | Monthly price | Positioning | Assigned capability keys |
|---|---|---:|---|---:|
| STARTER | Apna Galla Starter | ₹75 | Run your shop | 16 |
| SMART | Apna Galla Smart | ₹120 | Run it better. Understand your business. — MOST POPULAR | 38 |
| PRO | Apna Galla Pro | ₹210 | Advanced Control | 45 |

Counts include export capabilities. They are entitlement-key counts, not a count of screens. Legacy `ADVANCED_REPORTS` is excluded from all three plans. No fourth commercial plan or price was created.

## Exact entitlement lists

Starter receives these 16 keys:

```text
RETAIL_POS
SALES
KHATA
PURCHASING
EXPENSES
DAILY_GALLA
NEED_LIST
INVENTORY
SERVICES
ACCOUNTING
REPORTS
ASSISTANT_TEXT
BACKUP
EXPORT_ITEMS
EXPORT_STOCK
EXPORT_SALES
```

This includes the existing ordinary billing, Cash/UPI/Udhar/split payment, quick and amount-only sale, held bills, returns/refunds, history/receipts, customer/supplier Khata, purchases, expenses/owner withdrawals, Daily Galla, Need List, basic stock/service items and operational reports. Existing barcode functionality remains subject to the shop's scanner setting. UPI recording remains manually confirmed.

Smart inherits all 16 Starter keys and adds these 22 keys, for 38 total:

```text
ITEM_IMAGES
GST_INVOICES
PROFIT_REPORTING
BUSINESS_INSIGHTS
VARIANTS
MULTI_UNIT
WEIGHT
VOLUME
LENGTH
AREA
BATCH_TRACKING
BUNDLES
MODIFIERS
WASTAGE
STAFF
EXPORT_CUSTOMERS
EXPORT_SUPPLIERS
EXPORT_KHATA
EXPORT_PURCHASES
EXPORT_EXPENSES
EXPORT_GST
EXPORT_PROFIT
```

Smart's first card emphasizes Item Photos, GST Invoices, Profit & COGS, Business Insights, Advanced Inventory, 2 Staff Accounts and Better Reports & Exports. The ₹45 difference from Starter is shown explicitly. Detailed capabilities remain in View all features.

Pro inherits all 38 Smart keys and adds these seven keys, for 45 total:

```text
SERIAL_TRACKING
COMPATIBILITY
ADVANCED_PRICING
ADVANCED_STAFF
EXPORT_STAFF
EXPORT_DOCUMENTS
EXPORT_FULL_BUSINESS
```

Pro serves advanced control for one shop. Compatibility is labelled **Limited model metadata**. Advanced Pricing retains its backend Pro entitlement, but its incomplete Retail screen is **Coming Soon**, without a misleading active-feature toggle. Custom role/permission administration requires `ADVANCED_STAFF`; Smart receives standard staff accounts.

## Final enforced limits

| Limit | Starter | Smart | Pro |
|---|---:|---:|---:|
| Total active users, including owner | 1 | 3 | 6 |
| Additional active staff | 0 | 2 | 5 |
| Active unexpired sessions/devices | 2 | 5 | 10 |
| Businesses | 1 | 1 | 1 |
| Branches | 1 | 1 | 1 |
| Stock locations | 1 | 1 | 1 |

Staff creation and reactivation check both staff and total-user capacity. Device limits are checked when issuing sessions under an organization lock. Existing excess users, sessions, branches and locations are preserved when a limit falls; additional creation/reactivation/session issuance is restricted until capacity is available. Starter staff cannot perform new operational writes without an explicit staff entitlement. Logout/password recovery and historical reads remain available within their existing security policy.

No storage or assistant-query quotas are advertised because they are not currently enforced. A business type recommends optional features and cannot grant a paid capability.

## Features outside the launch plans

| Capability | Starter | Smart | Pro | Customer-facing state |
|---|---|---|---|---|
| Item Photos | No | Yes | Yes | Locked — Smart / Enabled |
| Formal GST invoices | No | Yes | Yes | Locked — Smart / Enabled |
| Profit / COGS and business insights | No | Yes | Yes | Locked — Smart / Enabled |
| Serial / Warranty | No | No | Yes | Locked — Pro / Enabled |
| Multiple stock locations | No | No | No | Future Premium |
| Multiple branches / shops | No | No | No | Future Premium |
| Cross-location transfers | No | No | No | Future Premium |
| Location exports/reports convenience | No | No | No | Future Premium |
| Voice Assistant | No | No | No | Coming Soon; no production provider |
| Scheduled exports | No | No | No | Future Premium; not implemented |

The keys `MULTIPLE_STOCK_LOCATIONS`, `ASSISTANT_VOICE`, `EXPORT_LOCATIONS` and `EXPORT_SCHEDULED` remain in the code/catalog but are assigned to none of the three plans. Voice has no required current upgrade plan; it is not permanently tied to Pro. Voice scaffolding and the separate existing checkout thank-you announcement are retained.

Future packaging reserves multiple branches/godowns, transfers, central/consolidated shop views, location/branch reporting, larger teams/devices and integrations/automation when implemented. This reservation is not an assertion that those future features are implemented. No future plan is selectable.

GST invoices do not imply GST filing, GSTR filing, IRN or government e-Invoice integration. Backup entitlement does not imply an operational backup provider, a verified archive or a successful restore drill.

## Backend enforcement and financial visibility

Effective access continues to combine the plan, explicit tenant override, rollout availability, subscription state, shop toggle and user permission. UI hiding is supplemented by server checks.

- New variant, measured-unit, batch, bundle, modifier, serial, compatibility, price-list, alternate-unit and location operations require their capabilities. Posting a previously saved draft rechecks the associated item requirements.
- Pro receives no ordinary authorization to create another location or branch, or post a cross-location transfer. A second business is blocked by the one-business limit.
- Profit endpoints require `REPORTS` and `PROFIT_REPORTING`, along with the existing user permission checks. Recursive response filtering removes saved COGS/profit/cost snapshots from ordinary Retail, POS, Sales, Billing and Inventory responses when financial visibility is unavailable. Stock-movement cost rates and values are covered; quantities remain visible. Ordinary purchase prices and bill/payment totals needed for operating the shop remain available.
- Insight snapshots contain financial facts even when the question concerns sales or cash. Consequently diagnostic insights require `BUSINESS_INSIGHTS`, `PROFIT_REPORTING` and `REPORTS` before loading or returning that snapshot. Denying Profit also denies those diagnostic snapshots.
- Staff creation/role assignment/custom roles have their separate limit, permission and commercial checks. No new invented permission is added by this restructure.

## Item photos and downgrade safety

Starter cannot upload or newly edit/delete item-photo attachments without an explicit override. Smart and Pro can. Existing attachment content stays tenant-scoped and readable following downgrade; images are not deleted. Other attachment types retain their existing security and module requirements.

Plan changes never delete locations, stock, serials, batches, variants, images, staff, price data, accounting, transfers or historical transaction snapshots. Existing records remain available through safe historical paths. New restricted use is blocked. Return and reversal paths keep their reconciliation behavior rather than treating recovery as new paid configuration.

Operational reports use `REPORTS`; financial reports use `PROFIT_REPORTING`; diagnosis uses `BUSINESS_INSIGHTS`. The unused legacy `ADVANCED_REPORTS` gate is not sold as a separate artificial restriction.

## Imports and portability

Ordinary item/customer/supplier/opening stock/opening balance migration remains available on all three plans according to the existing importer's supported fields and formats. Source rows are checked at preview and again at commit, including the capabilities of an existing item/stock location. Advanced columns are checked even if not mapped, so omitting a mapping cannot bypass the plan.

Examples: Starter measured/variant/batch data requires Smart; Smart serial data requires Pro. If the plan permits a field but the existing importer does not actually import its advanced configuration, the request is rejected with an explanation that the field **will not be silently discarded**. The existing item-configuration/Buy Stock workflow is required for those fields. This change does not promise universal support for every export format.

Starter's convenience exports are Items, Stock and Sales. Smart adds Customers, Suppliers, Khata, Purchases, Expenses, GST and Profit. Pro adds Staff, Document Metadata and Complete Business Records. Document/file archives are not falsely advertised as included in a metadata export; attachment files are downloaded separately.

The existing pending `DATA_PORTABILITY` / account-deletion request exception remains available for account-exit exports. Commercial convenience-export restrictions must not prevent account data retrieval.

## Platform overrides

The Platform tenant screen shows `INHERIT`, `FORCE_ENABLE` and `FORCE_DISABLE`:

| Example | Result |
|---|---|
| Pro + INHERIT + Multiple Locations | No commercial entitlement |
| Pro + FORCE_ENABLE + Multiple Locations | Tenant-only entitlement, subject to rollout/configuration and capacity |
| Starter + FORCE_ENABLE + Item Photos | Photos for that tenant only |
| Smart + FORCE_DISABLE + Profit | Profit and financial diagnostic snapshots denied |

Granting a feature does not change global plan assignments or numeric capacity. To permit a second godown, explicitly grant `MULTIPLE_STOCK_LOCATIONS` **and** increase that tenant's `stock_locations` limit. Branch/business capacity requires its own explicit numeric exception. Clearing the feature restores the plan default; clearing the limit restores the plan capacity. Removing grants retains historical records.

Canonical prices, feature assignments and default limits are fixed in the Platform plan editor and validated by its backend. The operator may change plan availability. Exceptional concessions use tenant feature/limit overrides instead of changing the offer for every customer.

## Safe rollout and recovery

The revision runs once inside the Platform startup transaction, using an advisory lock and persisted revision marker. It updates the three canonical plan definitions, replaces their assignment rows and refreshes feature descriptions. It does not change existing tenant override rows, tenant plan links, subscription payments or business records. The marker records previous plan configuration for operator review. Existing rollout flags and plan availability are preserved.

The previous one-time legacy/default-plan transition remains separate. Legacy/test plans are not shown by the customer subscription and onboarding APIs/screens. This revision does not create another public plan.

Deployment order:

1. Verify a real backup and the usual release checks for the target environment.
2. Run the repository's normal `prisma migrate deploy`; no reset or destructive `db push` is used. This revision itself needs no new schema table.
3. Build/deploy the backend with its production secrets. Startup installs the revision once.
4. Inspect all three persisted definitions, effective tenant exceptions and important historical records before releasing the matching frontend.
5. Deploy the matching frontend; verify onboarding, Subscription, Shop Features and Platform plan/override screens.

Do not remove the marker merely to force a rerun on a live service. Review configuration corrections as a separate, audited revision. A code rollback alone does not reverse changed plan configuration; use the recorded previous definitions, a transaction and a verified backup/configuration recovery procedure. It must not reset or delete customer business data.

On this PC, the revision was applied to the local application database. Counts in 128 business tables matched before/after; explicit tenant entitlements, organization plan links and tenant limit overrides also matched. QA fixture shops were created only in a separate localhost database ending in `_test`.

## Verification, 13 October 2026

| Check | Result |
|---|---|
| Focused unit/parser/intent/insight tests | 1,054 passed, 0 failed, exit 0 |
| Dedicated final-launch API tests | 24 passed, 0 failed, exit 0 |
| Existing commercial entitlement API tests | 67 passed, 0 failed, exit 0 |
| Retail/universal/batch/bundle/costing/import/administration/onboarding regressions | 166 passed, 0 failed, exit 0 |
| Headed Playwright plan acceptance | 5 passed, 0 failed, exit 0 |
| Backend build and explicit TypeScript typecheck | PASS, exit 0 |
| Frontend build and explicit app TypeScript typecheck | PASS, exit 0 |
| Clean disposable migration deploy/status/validate | PASS, 35 migrations; exit 0 |

Dedicated final-launch API groups:

| Group | Passed | Failed |
|---|---:|---:|
| Starter | 7 | 0 |
| Smart | 6 | 0 |
| Pro | 7 | 0 |
| Overrides | 3 | 0 |
| Downgrade safety | 1 | 0 |

The grouped counts refer to the dedicated 24-case suite; the 67 existing entitlement cases and 166 regressions are additional checks. Backend tests include actual photo upload/denial, imports, profit-field redaction, future exclusions, per-tenant grants, preserved historical data, five-staff Pro capacity and real session issuance at the 2/5/10-device limits.

The five headed browser cases cover Subscription and Shop Features at 390×844 for each plan, saved Google-linked onboarding plan selection, and Platform plan/override screens at 1366×900. They check three cards/prices, Smart's badge/value, absent Voice/location promises, no horizontal mobile overflow, direct API requests, and FORCE_ENABLE → INHERIT. Screenshots were visually reviewed. The Google-linked onboarding fixture uses a synthetic verified subject and a real saved account/session; it does **not** claim a live Google OAuth-provider acceptance test.

Sanitized results are in `docs/verification/2026-10-13-launch-plans/results.json`. Private fixture credentials, database settings, browser traces and raw local runner output stay under ignored `output/`.

## Reproducing the checks

Run backend tests only with `NODE_ENV=test` and an explicitly migrated disposable localhost `*_test` database. Existing E2E configuration rejects the normal application database; some suites clear fixture tables. Keep required test secrets in an ignored environment file or process environment and do not print them.

From `backend-typescript`, use these suites:

```text
npx vitest run src/common/launch-plans.spec.ts src/assistant/intent-router.spec.ts src/assistant/business-insight.service.spec.ts src/retail/imports/import-format.spec.ts
npx vitest run --config vitest.config.e2e.ts test/final-launch-plans.e2e-spec.ts test/subscription-entitlements.e2e-spec.ts
npx vitest run --config vitest.config.e2e.ts test/retail-flow.e2e-spec.ts test/universal-item-flow.e2e-spec.ts test/batch-fefo.e2e-spec.ts test/bundle-modifier.e2e-spec.ts test/costing-profit.e2e-spec.ts test/import-report.e2e-spec.ts test/tenant-administration.e2e-spec.ts test/google-business-onboarding.e2e-spec.ts
```

After the backend build, `node scripts/provision-launch-plan-test.cjs <ignored-test-environment-json>` creates fresh disposable shops and a Platform operator. The file argument is optional when the test environment is already supplied. The script requires a local `*_test` database and refuses production. It stores generated credentials only in ignored `output/launch-plans/private-fixtures.json`.

Start a separate backend and frontend pointing to that test database. Set `TEST_BASE_URL` to the test frontend URL and `LAUNCH_PLAN_FIXTURES` to the fixture file's absolute path. From `frontend` run:

```text
npx playwright test tests/launch-plans.spec.ts --config playwright.headed.config.ts --headed
```

This browser suite is explicitly opt-in; ordinary test discovery does not require private credentials. Never point it at customer data. Production payment, voice, backup and hosting-provider readiness require their separate configuration and acceptance checks.

**APNA GALLA LAUNCH PLANS LOCKED** — the backend commercial matrix, Retail plan presentation, onboarding plan selection and Platform defaults match this specification. This is a plan-restructure acceptance statement, not a claim that external production providers are configured.
