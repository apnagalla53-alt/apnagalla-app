# APNA GALLA — complete feature, entitlement and restriction audit

Audit date: 13 October 2026. Repository: `D:\evolix-trade-erp`. Public brand requested: **APNA GALLA**. Current source still contains EVOLIX names in plan names, labels, loading messages, storage keys and assistant presentation; this audit does not rename them.

This is a **read-only product inventory for subsequent commercial package design**, not a production certification or a plan redesign. Source, Prisma schema, migration SQL, controller/module registration, services, guards, frontend routes/state, test definitions and a read-only snapshot of the configured local database were inspected. No application startup, HTTP requests, test execution, migration, seed, data cleanup, price change or application edit was performed. Startup and even authenticated GET requests can write seeds, activity and audit data; they were deliberately avoided. Only this report is created.

## 1. How to interpret the findings

An entitlement means a feature can be granted; it does not prove implementation or provider availability. Default plan assignments, current saved assignments, tenant overrides, runtime access, UI visibility and delivery/provider readiness are separate facts. Tests listed below are **existing source tests**, not fresh passing results. No feature is assigned `PRODUCTION_READY` on this evidence alone.

Implementation status vocabulary: `PRODUCTION_READY`, `WORKING_BUT_NEEDS_MORE_TESTING`, `PARTIAL`, `FRONTEND_ONLY`, `BACKEND_ONLY`, `PROVIDER_NOT_CONFIGURED`, `COMING_SOON`, `NOT_IMPLEMENTED`, `LEGACY`, `DEAD_CODE`, `UNKNOWN`. “Exists” in a platform table describes route presence; the separate status column uses this vocabulary.

Unless stated otherwise, “Working” means a concrete connected implementation exists in current code, not that this audit executed the workflow. “Tenant override: yes” means the generic override mechanism supports that registered feature; actual saved overrides are separately enumerated. References are repository-relative source paths. API paths in the endpoint inventory include `/api/v1` exactly once.

### Important conclusions

| Finding | What the architect should understand | Current status/evidence |
|---|---|---|
| Commercial plans | STARTER ₹75/month; SMART ₹120/month; PRO ₹210/month. Defaults grant 16 / 39 / 50 registered features respectively. Saved local named-plan prices and assignments match these defaults. | `common/retail-plan-catalog.ts`, `platform/platform.service.ts`, local read-only Plan/PlanFeature snapshot |
| Text assistant | Active deterministic text implementation, 96 intent definitions and 656 authored example entries; local DB has 843 active default examples after alias expansion/deduplication. No LLM is used. | `WORKING_BUT_NEEDS_MORE_TESTING` |
| Assistant Voice | Pro entitlement exists; UI explains availability; backend rejects VOICE with `VOICE_NOT_CONFIGURED`. No connected speech recognition or assistant audio response provider. | `PROVIDER_NOT_CONFIGURED` |
| Scheduled export | Pro key exists and is assigned, but no scheduled exporter is implemented. Daily in-app summary notifications are a different feature. | `NOT_IMPLEMENTED` |
| Backup versus export | Real PostgreSQL custom-archive and encrypted offsite S3 code exists. Local backup provider is `none`. Tenant downloads are records exports, not restorable backups. | Backup `PROVIDER_NOT_CONFIGURED`; record export `WORKING_BUT_NEEDS_MORE_TESTING` |
| Named gates differ from actual API gates | Daily Galla uses RETAIL_POS + ACCOUNTING; Need uses RETAIL_POS + INVENTORY. ADVANCED_REPORTS is only catalog metadata, not a distinct runtime gate found in active code. | Restriction mismatches documented; unchanged |
| Import restriction gap | Import controller requires RETAIL_POS + owner. Normalized rows call services directly; no per-kind KHATA/PURCHASING/INVENTORY or imported WEIGHT/VOLUME/LENGTH/AREA entitlement check exists in the importer. | `PARTIAL`; Starter import may bypass gates applied to direct item/party requests |
| Staff permission gap | Auto-created STAFF receives `pos.sale.create` but Retail bill POST is inferred as `sales.write`; default staff cannot necessarily use the Retail billing UI. Provisioned permission registry also lacks several keys used by newer APIs. | `PARTIAL`; owners bypass permission checks, masking gaps |
| Numeric limits | Devices, user/staff creation and additional location creation have checks. `storage_mb` and assistant/voice query limit fields do not implement the advertised commercial quota. Company limit is read but not defined in named plans. | Mixed enforcement; see section 5 |
| Financial visibility | Dedicated profit endpoints require PROFIT_REPORTING, but the bill response cost interceptor checks REPORTS + owner/`reports.read`, not PROFIT_REPORTING. | Starter owner may receive cost/profit fields through bill APIs; not equivalent to a paid profit report |
| Financial insight gate gap | Tool registry adds PROFIT_REPORTING for category `financial`, but profit/COGS/margin diagnosis intents are category `insight`. They require BUSINESS_INSIGHTS + their listed module feature and permissions, with no extra PROFIT_REPORTING check. | Default Smart includes both; overrides/different saved assignments can expose financial insight after profit is disabled. |
| Legacy surface | Several ERP sales/purchase/pricing APIs are active without modern Retail screens. Intelligence, manufacturing, field sales, pharmacy and retailer-portal services are not registered in active module providers/controllers. | Separate `BACKEND_ONLY`, `LEGACY` or `DEAD_CODE` entries; not offered as implemented new modules |
| Subscription model | TenantStatus is the sole Prisma enum. Subscription status is a string column, with accepted values defined by DTOs/services; it is not a Prisma SubscriptionStatus enum. Legacy tenants without subscription are a permissive compatibility path. | See exact state distinctions below |

## 2. Application and repository map

| Area | Actual implementation | Boundaries |
|---|---|---|
| Frontend apps | One React 19 / TypeScript / Vite app in `frontend`; React Router, Zustand, Axios, Lucide, i18next, QRCode. | Retail, Platform and tenant master screens share this app; no separately deployed marketing app was found. |
| Retail/Tenant UI | `frontend/src/retail`; mobile-first RetailShell, drawer, bottom Home/Items/Bill/Khata navigation, Stitch styles, error boundary, loading/empty components. | Route shell checks login, non-platform identity and onboarding READY; individual screen/API gates decide capabilities. |
| Platform UI | `frontend/src/admin/platform`, PlatformShell; desktop administrative screens. | Separate persisted platform identity and MFA; no Retail plan is needed to operate Platform. |
| Tenant master administration | `frontend/src/admin/tenant` plus Inventory and Accounting pages under root routes. | Owner/admin or `identity.admin` frontend guard; server tenant administration guard and endpoint permissions still apply. |
| Backend | NestJS app in `backend-typescript`, Express HTTP, Prisma 5.22, PostgreSQL. | 46 active controllers, 397 declared handlers. Handler count is not a count of runtime-expanded URL combinations. |
| Shared libraries | Backend `common` guards, entitlements, dates, currency allocation, pagination, logging, idempotency; frontend shared API/auth/crypto/attachments/mobile controls. | No independent shared package/workspace library. |
| Database | `backend-typescript/prisma/schema.prisma`; 132 Prisma models, 35 migration directories. Local snapshot: 133 public tables including migration bookkeeping. | Shared DB organization → company → branch → godown/FY, plus global Platform and assistant catalog tables. |
| Marketing/public content | `/privacy`, `/terms`, `/support`, `/delete-account`, `/about`; publishing metadata configured by Platform. | Legal/support/publishing pages and placeholders; no standalone campaign/marketing site or public pricing route. |
| Android | Capacitor dependencies, Android project and release/sync scripts. | Packaging support is not evidence of Play Store publication, verified signing or native payment integration. |
| Deployment | Docker/deploy configuration, Netlify/Render/Neon example templates, production environment validation. | Templates exist; no live-provider deployment was verified. |
| Tests | Vitest backend source specs + HTTP e2e specs; Playwright frontend specs. | Full file inventory and static declaration counts in appendix; zero tests executed in this audit. |

Primary execution sources: `backend-typescript/src/app.module.ts`, `src/main.ts`, `src/database/prisma.service.ts`; frontend `src/App.tsx`, `src/shared/api.ts`, `src/shared/store/authStore.ts`, `src/retail/retailApi.ts`, `src/retail/retailStore.ts`.

## 3. Entitlement architecture — exact runtime precedence

Sources: `backend-typescript/src/common/entitlement.service.ts`, `common/guards/feature.guard.ts`, `auth.guard.ts`, `subscription.guard.ts`, `common/retail-plan-catalog.ts`; frontend `retail/subscription/useRetailEntitlements.ts`.

1. Authentication checks signature, persisted active/unlocked user, active session and session expiry; platform identity is rejected by tenant auth. Context headers must resolve to an authorized organization/company/branch/FY. Cookie-authenticated writes require CSRF verification.
2. Resolve organization, saved PlanFeature assignments, saved TenantEntitlement overrides, subscription and optional validated company configuration. Runtime reads **saved assignments**, not the marketing highlights or default minimum-plan label.
3. Subscription display status gives organization SUSPENDED/CANCELLED priority, inactive organization means suspended; missing subscription means NOT_CONFIGURED; date expiry becomes EXPIRED; complimentary maps to COMPLIMENTARY and trial is displayed as TRIAL when applicable.
4. Active access requires active organization outside SUSPENDED/CANCELLED and either **no subscription** (legacy compatibility) or a started, unexpired subscription whose stored status is ACTIVE, TRIAL or COMPLIMENTARY. It does not delete data on expiration.
5. Global rollout is a hard condition: Feature.is_active AND ON; or PERCENTAGE with stable tenant SHA-256 bucket `< rollout_percent`; or BETA with tenant ID in beta_tenants. OFF/unknown mode disables. Tenant enable cannot defeat a global rollout disable.
6. Commercial entitlement is `tenantOverride?.is_enabled ?? savedPlanFeatureMembership`, except **BACKUP is always commercially entitled**. BACKUP still needs active subscription/organization and global rollout; its provider is checked elsewhere.
7. Shop enablement is true for catalog core features. For non-core keys it is `CompanyConfiguration.shop_feature_settings[code] ?? true`. All registered exports are core, even Smart/Pro exports; “core” does not mean Starter entitlement.
8. Final feature flag is `subscription_active && rollout_enabled && plan_entitled && shop_enabled`.
9. FeatureGuard uses handler `RequireFeature` metadata in preference to controller metadata (`getAllAndOverride`, not union). It appends dynamic module, item and new-operation requirements, then requires **all** resulting codes. Generic endpoints with no RequireFeature metadata do not receive a plan check through this guard.
10. Permission checks are independent. Owners/ADMIN/TENANT_ADMIN bypass tenant permission checks but **do not bypass plan, tenant scope, subscription or rollout**. AuthGuard itself enforces explicit metadata and inferred module permissions; absence of PermissionGuard does not mean absence of RBAC.
11. Numeric limits are plan JSON shallow-merged with organization limit_overrides, then enforced only where service code implements a check. Provider configuration is **not** included in EntitlementService's final flag: provider-backed services can still be unavailable while entitled.

For expired subscriptions, eligible GET/HEAD core historical reads may be admitted by AuthGuard/FeatureGuard using core + plan entitlement + rollout. Smart/Pro profit and advanced feature reads can remain blocked. Account lifecycle, security, onboarding and portability paths have separate access rules so pending/expired users can manage the account. Suspended/inactive access is not a general historical-read exception. Recovery return/reversal writes skip the new-item capability additions, but not all ordinary base/module gates.

### Dynamic module gates and permission mapping

| Retail API resource | Feature appended by FeatureGuard | AuthGuard inferred permission family |
|---|---|---|
| items, needs | INVENTORY | inventory.read/write |
| purchases, suppliers | PURCHASING | purchase.read/write |
| customers, khata | KHATA | accounting.read/write |
| expenses, expense-categories | EXPENSES | accounting.read/write |
| reports | REPORTS | reports.read/write |
| galla | ACCOUNTING | accounting.read/write |
| bills / ordinary other Retail resources | Controller/handler-declared feature; frequently RETAIL_POS | sales.read/write; return requires sales.return |
| settings | Screen/controller-specific, or manual service checks | settings.write |

New writes additionally inspect current items and payloads for SERVICES, VARIANTS, BATCH_TRACKING, SERIAL_TRACKING, BUNDLES, WEIGHT, VOLUME, LENGTH, AREA; alternate unit IDs require MULTI_UNIT. Secondary godown use/transfers requires MULTIPLE_STOCK_LOCATIONS. Price list/level and pricing writes require ADVANCED_PRICING. Compatibility payloads and routes require COMPATIBILITY. OUT adjustments whose reason/narration names wastage/damage/expiry require WASTAGE. Saved draft posting reloads its lines before checking capabilities.

Two notable limits of these checks: import rows are normalized after controller inspection and posted through service calls; and modifier detection examines `modifiers` payloads while billing DTO/UI use `modifier_option_ids`. The modifier setup endpoint requires MODIFIERS, but disabling that key is not demonstrably enforced for sale selection of existing option IDs by this guard. These are static restriction gaps, not attack-test results.

The frontend entitlement hook fetches subscription/effective features, caches per user/company/session scope for 60 seconds, refreshes on focus and on explicit mutation. Drawer/card hiding is presentation only; backend gates are authoritative. Business category recommendations never grant plan access.

## 4. Plans, prices and subscription state

| Plan key | Code default name | Monthly INR | Default entitled feature count | Extra staff | Total active users | Devices | Branches | Stock locations | Storage MB |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| STARTER | EVOLIX Starter | 75 | 16 | 0 | 1 | 2 | 1 | 1 | 100 |
| SMART | EVOLIX Smart | 120 | 39 | 2 | 3 | 5 | 1 | 1 | 500 |
| PRO | EVOLIX Pro | 210 | 50 | 10 | 11 | 15 | 3 | 10 | 2000 |

The feature count includes all entitled catalog keys, including exports; it is not the catalog `core` boolean. All current named-plan assignments in the local snapshot match defaultPlanFeatures. Full 50-key matrix appears below.

### Every current pricing definition and display source

| Location | Actual pricing source | Agreement / caveat |
|---|---|---|
| Backend catalog `common/retail-plan-catalog.ts:57` | 75 / 120 / 210 in RETAIL_PLAN_DEFAULTS | Canonical code provisioning defaults. |
| Platform startup `platform/platform.service.ts:26` | Creates missing plans from these defaults; **does not overwrite** existing operator edits | DB can legitimately diverge later. One-time commercial/export revision markers preserve old grants and add export assignments. |
| Local Plan records | STARTER75 / SMART120 / PRO210; DEFAULT0; seven active BROWSER_* plans999 | Named offerings agree. Legacy/test plans must not be interpreted as public commercial packages. All 11 saved plans are enumerated below. |
| Prisma Plan schema and platform-control-plane migration | monthly_price default0; schema numeric-limit fallback differs from commercial defaults | A default column value, not a ₹0 public plan promise. |
| Retail Subscription frontend | API `plan.monthly_price`, no separate hardcoded plan amounts | Backend/DB-driven; highlights are presentation lists only. |
| Google/mobile onboarding frontend | `/auth/account/onboarding` response plans → monthly_price | Backend/DB-driven; only current active named plans selected. |
| Platform plan editor | Stored monthly_price editable through PlanDto | No separate fixed Super Admin price. Manual payment amount/tax/discount is distinct from Plan price. |
| Seed/provisioning | Runtime PlatformService catalog initialization; legacy provisioner may create DEFAULT if absent | No separate canonical `prisma/seed.ts` file. Bootstrap/test scripts are not commercial seed definitions. |
| Public/marketing | Public legal/support/about pages, no dedicated marketing pricing definition found | NOT DEFINED as independent marketing price. |
| Tests | subscription-entitlements specs assert default named prices; platform tests create arbitrary test prices, including Browser999 | Fixtures are test data, not a price disagreement. |

No conflicting hardcoded commercial amount was found in active frontend/backend plan displays. **Brand and promises do disagree:** backend named plans and subscription highlights retain EVOLIX; Pro advertises Voice and scheduled export entitlements despite missing delivery. Onboarding omits Voice from its Pro benefits while its description still says “+ Voice”.

### States: database enums versus service strings

| Model / source | Actual values / behavior |
|---|---|
| Prisma TenantStatus enum | **TRIAL, ACTIVE, SUSPENDED, CANCELLED, ARCHIVED**. Used for organization state. |
| TenantSubscription.status | String, not a Prisma enum; schema default ACTIVE. Provisioning writes PENDING; activation/subscription DTO accepts ACTIVE, TRIAL, COMPLIMENTARY. EXPIRED is derived by resolver dates; SUSPENDED/CANCELLED can come from organization status. Arbitrary saved strings are not validated by a Prisma enum. |
| Resolver presentation | Also NOT_CONFIGURED for absent subscription; expiry derived from dates. Display strings are not new Prisma enum entries. |
| SubscriptionPayment.status | String; manual payment DTO accepts PAID/PENDING/FAILED and records refund_amount separately. No provider-confirmed online charge flow. |
| User onboarding_state | String; OWNER_PROFILE_REQUIRED, BUSINESS_PROFILE_REQUIRED, PLAN_REQUIRED, MIGRATION_OFFERED, ACCESS_PENDING, READY are actual flow states. |

Manual Platform activation records subscription period and plan through tenant actions. Payment records and access activation are explicit administrative operations; choosing a plan does not assert payment success. Gateway checkout capability is false. No signed subscription-payment webhook endpoint exists. No expiration/downgrade path deletes historical bills, stock or journals. Archival/permanent erasure is a separate Platform lifecycle with policy, confirmation, legal hold, dependency and storage cleanup checks.

Defaults from `auth/account-policy.service.ts`: trial_enabled=false, trial_days=null, trial_plan=SMART, permanent_delete_enabled=false, retention_days=null, delete_requires_backup=true. Local DB has no ACCOUNT_POLICY override, so these defaults apply. OPERATIONS defaults maintenance_mode=false, signup_enabled=true, blank banner; no local override was found.

## 5. Numeric limits, throttles and shop settings

| Limit / restriction | Source / actual enforcement | Commercial interpretation |
|---|---|---|
| users | Staff creation counts active users across organization under lock, compares resolved users | Enforced on creation; staff re-enable checks staff limit, not the total users limit in that method. |
| staff | Active users with non-owner roles across organization; create/enable compare resolved staff; STAFF required | Smart2/Pro10 extra staff by defaults; overrides can differ. |
| devices | Auth session creation counts unrevoked, unexpired sessions across org, replacing same device/user session | Defaults2/5/15; a session count, not a hardware fingerprint inventory cap. |
| branches | Branch creation counts active branches in company and creates default location; requires MULTIPLE_STOCK_LOCATIONS | Defaults1/1/3; re-enable method does not repeat creation limit checks. |
| stock_locations | Creation and reactivation count active locations across company; branch creation also checks capacity | Defaults1/1/10; last active location cannot be disabled and remaining stock must be transferred. |
| storage_mb | Stored and merged, but attachment code uses a separate environment quota | **Not enforced as a plan storage quota.** |
| TENANT_UPLOAD_QUOTA_BYTES | Default1,073,741,824; attachment aggregate is **company_id**, despite environment name | Operational photo quota, not tenant-wide commercial storage_mb enforcement. |
| companies | createCompany reads limits.companies; named plans/Platform accepted limit keys do not define it | NOT DEFINED by current commercial defaults; absence leads to no finite cap. |
| assistant_queries / voice_queries | Platform accepts integer override fields; no consumption/quota enforcement found | NOT DEFINED in named plan defaults and not implemented monthly usage metering. |
| General directory page | `common/pagination.ts`: default100, limit1–200, offset0–1,000,000 | Applies only endpoints using page(); not every query/report. |
| Bill/expense paging | DTO/service-specific page/limit; frontend load-more/page controls | Existing paging; report/dashboard internals can still load full selected ranges. |
| Attachments | Max5MiB; JPEG/PNG/WebP only; decode/re-encode and 20 MP pixel check; list default50/max100 | PDF/audio/arbitrary document uploads not supported. |
| Imports | Max5MiB,10,000 rows,200 columns,4,000 chars/cell,header1–50; expanded workbook50MiB/1,000 entries; XML nesting15 | Source format safety bounds, not plan row quotas. Commit25 rows/call, preview pages50, history30. |
| CSV exports | Default500/max1,000 rows/page; selected item IDs max1,000 | Frontend can walk pages; full export chunks500 and is a live records stream. |
| Daily Galla / quick report question |10,000 invoices/vouchers/day cap; refusal rather than truncated financial total; history7 days | Not unlimited history delivery in one request. |
| Calendar | At most1,000 rows per queried event class; month/day selection | Static festival content is not a nationwide unlimited holiday feed. |
| Platform lists | Payments/expenses/audit max500; backups200; deletion jobs100; some plan/feature/dashboard queries unbounded | Large deployments need further paging/performance validation; no claim all lists universally paginated. |
| Assistant text |400 chars/query,180 operations/minute/user; clarification/conversation15min; log retention30days | Rate limits, not paid usage quotas. |
| Report questions |60/minute/user; detailed examples max50 | Separate small query interpreter; no external LLM. |
| Login |20/minute/IP via shared PostgreSQL limiter; account lock after10 failures | Tenant and platform authentication have independent identities and keys. |
| Sensitive auth | Default5/15 min/account; reset IP10/15 min; reset consume20/15 min; change password10/15 min | One-use reset/email tokens20min; password policy below. |
| OTP | request15/15 min/IP; verify30/15 min/IP; max6 challenges/hour/phone; challenge5min,5 attempts,60 sec resend cooldown | Requires configured SMS provider. |
| Other operation rates | Upload30/min, reports120/min, catalog/search300/min, label-print20/min; import-preview20/min; backup/privacy/full-export5/min; report-export20/min | Normal POS flow has no single broad low request cap replacing these service limits. |

ShopFeatureSettings is company-scoped JSON, not a separate global plan source. Catalog **non-core** feature toggles default true when absent; core keys cannot be turned off through the Shop Features API. Owner-only mutations reject unavailable rollout, inactive access, non-entitled or core keys and audit changes. `barcode_scanning_enabled` is an independent billing preference in the same JSON, **false by default**, not one of the 50 commercial feature keys. It hides scanner entry in Retail; barcode storage/ERP APIs remain.

Other real settings: primary UPI profile and show-UPI-QR invoice preference; invoice/header/footer preferences; checkout voice enable/text/language/rate; profile/security and migration choice; daily summary enabled/time/language; local-device appearance light/dark, text size and English/Hindi. Theme/text/language are local presentation preferences, not paid entitlements. The English/Hindi libraries and Devanagari fonts exist; some UI strings remain literal English, so translation completeness is `PARTIAL`.

## 6. Billing / POS capability inventory

Base Retail bill capability uses RETAIL_POS; credit customer operations add KHATA where those customer APIs are used. New item lines append their advanced feature keys. The legacy `/erp/pos` controller uses its own explicit permissions (`pos.sale.create`, shift and return permissions), whereas Retail billing generally infers sales.read/write/return. See endpoint appendix for exact metadata.

| Capability | Actual frontend/backend/database behavior | Restrictions / plan | Status |
|---|---|---|---|
| Create itemized bill | RetailNewBill → quote → RetailPayment → BillingService → PosService; SalesInvoice/lines, vouchers and stock postings | RETAIL_POS all plans; sales.write for non-owner; current branch/open FY and valid item scopes | WORKING_BUT_NEEDS_MORE_TESTING |
| Cash / change | Paid amount tender/change separated; accepted amount recorded in payment_snapshot and receipt vouchers | All plans; backend totals authoritative | WORKING_BUT_NEEDS_MORE_TESTING |
| UPI / Card / Bank | Manual non-cash tender recorded; exact UPI portion QR if primary profile exists | All plans; no bank callback/gateway confirmation | WORKING_BUT_NEEDS_MORE_TESTING |
| Udhar / partial / split | Cash+UPI/non-cash with unpaid remainder; customer required for credit, original credit snapshot retained | All plans base billing; customer credit policy/limit; no anonymous credit | WORKING_BUT_NEEDS_MORE_TESTING |
| Discounts | Line amounts and bill discount allocation; fixed/percentage bill discount logic and currency rounding | All plans base; advanced price lists separately Pro; UI/role capabilities are distinct from plan | WORKING_BUT_NEEDS_MORE_TESTING |
| Taxed ordinary bill | Item TaxClass/HSN rate, server line tax; not itself a government-issued document | All plans base tax calculations; formal GST issuing Smart/Pro | WORKING_BUT_NEEDS_MORE_TESTING |
| Customer / dates / channel / note / photo | Customer-selected cart, due date, COUNTER/PHONE/WHATSAPP/ONLINE/OTHER, saved proof image; Khata New Bill passes customer | All plans; attachments allowed images; financial FY/date checks | WORKING_BUT_NEEDS_MORE_TESTING |
| Quick/amount-only sale | Creates/reuses internal amount-sale service item; records income without physical stock | RETAIL_POS; no itemized GST invoice from amount-only sale | WORKING_BUT_NEEDS_MORE_TESTING |
| Price-only new catalog item | Name/rate/unit saved with inventory_tracking=false; stock purchase later activates tracking | No advanced tracking/opening stock with price-only flag; new unit/mode constraints still apply | WORKING_BUT_NEEDS_MORE_TESTING |
| Hold / resume | Saved held cart includes customer/note/discount; resume by scoped user; new checkout revalidates | All plans; held bill is not a posted invoice/reserved stock | WORKING_BUT_NEEDS_MORE_TESTING |
| History / detail | Paginated bill list, searched invoice/customer, return history, received/due/credit settlement view | All plans historical core read policy; branch/company scoping | WORKING_BUT_NEEDS_MORE_TESTING |
| Receipt / thermal print | Saved bill response/receipt route, print/download through browser/native helpers | Browser printing/device support; no fiscal printer certification | WORKING_BUT_NEEDS_MORE_TESTING |
| Share / WhatsApp | Phone normalization, existing/manual number, wa.me prepared receipt/message; supported browser share | User sends in WhatsApp; no automatic WhatsApp provider or guaranteed file delivery | WORKING_BUT_NEEDS_MORE_TESTING |
| New Bill after receipt | Clears current cart and opens bill route directly; line and unit quantities have distinct fields | Memory cart; no full offline POS store | WORKING_BUT_NEEDS_MORE_TESTING |
| Edit/cancel posted sale | No generic Retail bill edit/delete/cancel endpoint; correction uses returns. Legacy sales invoice reversal API exists | Legacy sales.reverse; reversing issued GST/history needs dedicated policy, not ordinary CRUD | PARTIAL |
| Return / partial return / refund | Retail return linked to original invoice, saved unit/batch/serial and original cost; refund or customer credit and reverse quantities | sales.return; no over-return; original branch/item/line scope; base plan recovery gates | WORKING_BUT_NEEDS_MORE_TESTING |
| Payment reversal | Accounting voucher reversal API exists; no dedicated Retail customer/supplier payment-reversal screen | accounting.write; outstanding/linked invoice handling needs workflow verification | BACKEND_ONLY |
| Barcode lookup/labels | Existing barcode and `/erp/pos/barcode/:sku` lookup; ERP BarcodeLabels screen and print APIs | Retail scanner preference false by default; INVENTORY gates for barcode APIs, not a BARCODE commercial key | WORKING_BUT_NEEDS_MORE_TESTING |
| Whole/decimal quantity | Piece integer rules; measured modes and conversions normalize to base quantity; line configurator supports dimensions | WEIGHT/VOLUME/LENGTH/AREA/MULTI_UNIT Smart/Pro | WORKING_BUT_NEEDS_MORE_TESTING |
| Service sale | SERVICE item has no physical movement; explicit cost can be known, absent cost stays unknown | SERVICES Starter+, does not create a service-specific scheduling business module | WORKING_BUT_NEEDS_MORE_TESTING |
| Stock protection / concurrency | Authoritative InventoryPosting, item/projection locks, serial uniqueness/status, FEFO and recovery allocation | Tracked stock cannot be negative; price-only/service items are explicitly nonphysical | WORKING_BUT_NEEDS_MORE_TESTING |
| Retry/idempotency | Global interceptor covers important POST financial paths; persisted RequestIdempotency, advisory lock, fingerprint mismatch conflict; frontend stable request keys | Production requires Idempotency-Key; missing key may proceed outside production; not every legacy posting/edit route covered | WORKING_BUT_NEEDS_MORE_TESTING |
| Payment thank-you audio | After confirmed paid sale, browser SpeechSynthesis greeting configurable in `/more/voice` | Device voices/capabilities; QR display alone and wholly unpaid sale do not confirm receipt | WORKING_BUT_NEEDS_MORE_TESTING |
| Offline billing | Timeout/error/retry state with confirmed-sale handling and stable request key | No complete offline invoice posting or background sync implementation | NOT_IMPLEMENTED |

Tests present: retail-flow, busy-day-qa, calendar-price-only, general-store-qa, shopkeeper-qa, retail-field-coverage, universal-item-flow, batch-fefo, bundle-modifier, costing-profit and production-readiness backend e2e; frontend manual-acceptance, busy-day-qa, item-configuration, retail-improvements, whatsapp-receipt, partial-rerun, costing-profit and retail-ux specs. Existence is not a new passing claim.

## 7. Customers, suppliers and Khata

| Capability | Actual behavior / database | Gate / limitation | Status |
|---|---|---|---|
| Customer create/edit/search | Party CUSTOMER, name/code/phone/email/address/GSTIN/credit policy and opening due; new bill preselects customer | KHATA + RETAIL_POS; accounting.read/write; code company-scoped | WORKING_BUT_NEEDS_MORE_TESTING |
| Customer archive | DELETE route marks inactive through updateParty; historic references remain | Owner/appropriate accounting.write; cannot edit opening dues through ordinary edit | WORKING_BUT_NEEDS_MORE_TESTING |
| Customer balance/history/statement | BillAllocation NEW_REFERENCE minus AGAINST_REFERENCE, vouchers and saved invoices; chronological same-day order; statement helper pages5 | Company/party type validated; no live ledger value guessed from frontend | WORKING_BUT_NEEDS_MORE_TESTING |
| Customer receive partial/full payment | PostingService locks party, validates payment/FY/branch, allocates oldest outstanding references and updates invoices | CASH/UPI/CARD/BANK; **payment exceeding outstanding is rejected** | WORKING_BUT_NEEDS_MORE_TESTING |
| Advance / overpayment | No Retail advance collection flow; ordinary receive/pay methods reject amount above outstanding | Do not promise general advance support because refund credit can exist | NOT_IMPLEMENTED |
| Promise date/calendar | Bill due date can be updated for posted bill with remaining outstanding; allocation due date linked | Scoped owner/permission; cannot precede bill date | WORKING_BUT_NEEDS_MORE_TESTING |
| Customer WhatsApp | Phone chat/reminder/receipt shortcut; manual number supported | Redirect/share only, customer consents/send initiated by operator | WORKING_BUT_NEEDS_MORE_TESTING |
| Supplier create/edit/search | Party SUPPLIER; regular/distributor **party type label**, nickname/mobile, credit purchase policy/days/max bills/limit/address/email/GSTIN/PAN/state | PURCHASING + RETAIL_POS; purchase.read/write; no distributor ERP business module | WORKING_BUT_NEEDS_MORE_TESTING |
| Supplier archive | Inactive party, keeps purchases/ledgers; scoped type checks | purchase.write; opening due edit blocked | WORKING_BUT_NEEDS_MORE_TESTING |
| Supplier balance/payment/statement | Payable allocations, cash/non-cash vouchers, partial/full payment, linked purchase update | No overpayment/advance; shop's incoming UPI QR is not used to pay suppliers | WORKING_BUT_NEEDS_MORE_TESTING |
| Supplier visit calendar | ONE_TIME/WEEKLY/MONTHLY visit data on Party, upcoming calendar and Home sections | No external calendar provider or automated supplier messaging | WORKING_BUT_NEEDS_MORE_TESTING |
| Export customer/supplier/Khata | CSV report rows and party ledger | EXPORT_CUSTOMERS / EXPORT_SUPPLIERS / EXPORT_KHATA Smart+ plus permissions | WORKING_BUT_NEEDS_MORE_TESTING |
| Assistant party questions | Resolved permitted customer/supplier entities, balances/dues/payment/overdue questions; related insights | ASSISTANT_TEXT + KHATA/PURCHASING; insights BUSINESS_INSIGHTS; profit questions PROFIT_REPORTING | WORKING_BUT_NEEDS_MORE_TESTING |

Sources: `retail/retail.service.ts`, `dto/retail-customer.dto.ts`, `dto/retail-supplier.dto.ts`, `accounting/posting.service.ts`, `accounting/credit.service.ts`, RetailKhata/KhataDetail/PartyForm/PartyPayment/SupplierKhata, calendar controller. Opening due creates an authoritative journal/allocation; ordinary party edit never rewrites it. General Khata timeline fetch is not the same as the bounded statement helper: long party histories still need performance testing.

## 8. Purchases and expenses

| Capability | Actual path / behavior | Gate / limitation | Status |
|---|---|---|---|
| Itemized purchase | RetailAddPurchase → postRetailPurchase, supplier invoice + stock/cost/journal; rate/qty/unit/variant/batch/serial/dimensions/landed cost | PURCHASING + RETAIL_POS plus advanced item feature; supplier/open FY/branch validated | WORKING_BUT_NEEDS_MORE_TESTING |
| Quick purchase | Amount-only purchase allowed without item lines; category REGULAR/GENERAL/ONLINE, supplier required | Supplier liability/expense purchase, no fabricated item stock | WORKING_BUT_NEEDS_MORE_TESTING |
| Cash / Credit / Partial | PAID/CREDIT/PARTIAL, paid_amount and CASH/UPI/CARD/BANK; supplier credit_allowed checked | All plans base purchase; partial must reconcile server invoice total | WORKING_BUT_NEEDS_MORE_TESTING |
| History / bill image | Search/paged PurchaseInvoice history, attachments shown; supplier/date/bill/due/note | Image types only; separate attachment authorization | WORKING_BUT_NEEDS_MORE_TESTING |
| Purchase return/reversal/replacement | Legacy PurchaseController: return draft/post, original quantities, replacement links, invoice/receipt reverse | purchase.create/post/reverse/read; Retail history lacks a complete dedicated return/edit workflow | BACKEND_ONLY |
| Multi-unit/variant/batch/serial purchase | Entered quantity/rate converted to base, tracking receipt data saved | Smart multi-unit/variant/batch; Pro serial; no undocumented synthetic opening tracked stock | WORKING_BUT_NEEDS_MORE_TESTING |
| Need → Purchase | Need stores name and preferred supplier; no linked item ID or full atomic conversion/receipt synchronization endpoint found | An entry status change does not receive stock; purchase is separate | NOT_IMPLEMENTED |
| Expense create/history | BUSINESS_EXPENSE / OWNER_WITHDRAWAL, category/amount/date/method/photo/note; summary/filter/paging | EXPENSES + RETAIL_POS; accounting.read/write | WORKING_BUT_NEEDS_MORE_TESTING |
| Expense categories | Initializes defaults for empty shop; custom category with expense ledger, edit/disable support | Scope validated and serialized; default names listed below | WORKING_BUT_NEEDS_MORE_TESTING |
| Expense edit/cancel | Reverse old voucher and post edited replacement; cancel reverses voucher and retains audit/history | Posted records corrected through reversal, not hard deletion | WORKING_BUT_NEEDS_MORE_TESTING |
| Owner withdrawals/drawings | Debit drawings/equity ledger, credit cash/bank; separate business/owner history totals | Excluded from operating expense/net profit; included in cash out when cash | WORKING_BUT_NEEDS_MORE_TESTING |
| Expense cash/non-cash | Cash uses configured cash ledger, UPI/Card/Bank configured bank ledger | Non-cash requires bank ledger; not a live bank payment | WORKING_BUT_NEEDS_MORE_TESTING |
| Purchase/expense export | Structured CSV reports | Smart EXPORT_PURCHASES/EXPORT_EXPENSES; report/appropriate permission | WORKING_BUT_NEEDS_MORE_TESTING |

Default expense categories: Rent; Electricity; Transport; Wages / Salary; Packaging; Repairs & Maintenance; Shop Supplies; Internet / Mobile; Delivery / Freight; Other. Source `retail/expenses/categories/default-expense-categories.ts`; initialization is idempotent for an empty shop, not an unconditional re-seed of customized categories.

Tests: expenses.e2e, retail-field-coverage.e2e, general-store-qa.e2e, purchase/posting.service.spec, purchase/module_10.spec, costing-profit.e2e, universal-item-flow.e2e; frontend retail-field-coverage/manual-acceptance/general-store-qa/costing-profit. Provider-backed file storage not re-tested here.

## 9. Daily Galla, UPI and calendar

### Actual Daily Galla formula

`Expected drawer = selected opening cash + posted cash-ledger debits for day − posted cash-ledger credits for day`.

Default opening cash is prior cash-ledger net movement; a DailyCashCount optional daily opening override can be used. The actual sources are POSTED Voucher/VoucherLine Cash-in-Hand/Cash/configured cash ledger, not Total Sales. Categorized POS_RECEIPT cash sales, old customer RECEIPT, supplier PAYMENT, POS_REFUND, expenses and owner drawings explain the money movements; other legitimate cash lines reconcile the remainder. UPI/Card/Bank do not increase physical cash. Original payment_snapshot drives checkout tender split and new Udhar. Old bills missing the necessary snapshot are rejected rather than guessed.

Optional actual count computes `difference = actual_cash − expected_cash`; status NOT_COUNTED/MATCHED/SHORT/EXCESS. A shortage/excess **does not post a journal automatically**. Counts/notes, date picker, bill count, credit/new-due collection, money paid out and last 7 days history exist. Base actual endpoint gates are RETAIL_POS + ACCOUNTING, not DAILY_GALLA. Assistant uses ACCOUNTING. Tests: calendar-price-only, costing-profit, retail-flow and production-readiness e2e, frontend retail-improvements/manual-acceptance/partial-rerun. Status `WORKING_BUT_NEEDS_MORE_TESTING`.

### UPI detail

One primary company profile stores UPI ID, payee name, optional mobile and invoice preference. Basic syntax validated; never asserts bank verification. Standard URLSearchParams-built `upi://pay?pa=…&pn=…&cu=INR` with positive exact two-decimal amount when dynamic. Static shop QR, bill UPI portion QR, customer payment amount QR, full screen/copy/download/share/print controls exist through QRCode and device/browser helpers. Supplier payment does not use the receiving shop QR. Fully paid receipts show completed/manual payment context rather than asserting another amount must be paid.

GET UPI profile/QR uses RETAIL_POS + sales.read; profile save settings.write. Provider not needed for static QR. Payment detection/automatic confirmation is `NOT_IMPLEMENTED`; manually confirmed retail recording is `WORKING_BUT_NEEDS_MORE_TESTING`. Super Admin tenant details expose configured status where returned, not a payment secret/access token. No live UPI bank credential provider exists.

### Calendar

Supplier visit cycles, customer receivable dates, purchase payables and owner tasks/done state; month/day filters; optional static festival/holiday list for selected2026 dates with missing-year notice. Festival feed completeness and government holiday verification are `PARTIAL`; no provider-backed full festival calendar. Calendar itself is `WORKING_BUT_NEEDS_MORE_TESTING`. Task CRUD remains scoped and does not auto-post payments. Core calendar routes declare RETAIL_POS with explicit individual sales/purchase/settings permissions; named plan calendar key does not exist.

## 10. Items and universal inventory

Sources: RetailController/RetailService/retail-units.ts, ItemCompositionController/Service, InventoryPostingService, OpeningStockService, adjustment/transfer/batch-expiry/costing/serial-tracking; frontend RetailAddItem/ItemDetail/ItemUnitsVariants/LineConfigurator, InventoryPage/Card/ItemEditSheet/UnitPicker/StockTransferSheet.

| Capability | Backend/database | Frontend | Entitlement / restriction | Tests present | Status |
|---|---|---|---|---|---|
| Create/edit/archive | Item master; DELETE archives; prevent removing an active bundle component; historic facts retained | Add/item detail/action sheets; red destructive action | INVENTORY + RETAIL_POS; inventory.write | retail-flow, busy-day, shopkeeper, universal | WORKING_BUT_NEEDS_MORE_TESTING |
| Units / Piece / Pack / Box | Company Unit, primary unit and conversion factors; normalize unit code; saved selected unit | Searchable preset/custom UnitPicker and base-unit edit | Basic named unit Starter; conversion MULTI_UNIT Smart+; base unit change blocked after stock/sale/recipe usage | busy-day, item-configuration, universal | WORKING_BUT_NEEDS_MORE_TESTING |
| Opening stock | Authoritative OpeningStock movement/journal; explicit known cost or unknown-cost policy | Add standard item; separate receiving for advanced tracked items | No raw opening variant/batch/serial/bundle; open FY/default location required | costing-profit, retail-flow | WORKING_BUT_NEEDS_MORE_TESTING |
| Stock / low stock / adjustments | StockBalanceProjection derived from immutable movements; scoped summary/ledger, adjustment draft/post/reverse | Inventory/Low Stock tabs; master adjustment/movement pages | INVENTORY; physical changes through InventoryPosting; page/filter bounds | inventory specs, security e2e | WORKING_BUT_NEEDS_MORE_TESTING |
| Categories | Saved category text, category chooser/custom category | Picker/filter | No separate CATEGORY paid key | field-coverage, UI specs | WORKING_BUT_NEEDS_MORE_TESTING |
| Brand | No standalone active brand entity/CRUD feature found; attributes/category can carry text | No dedicated brand management page | NOT DEFINED | No dedicated brand suite | NOT_IMPLEMENTED |
| Tax / HSN/SAC | Company TaxClass rates and item HSN/SAC | Item fields; formal invoice workflow separately | Core item tax ≠ GST_INVOICES | gst-invoice/field-coverage | WORKING_BUT_NEEDS_MORE_TESTING |
| Item images | Attachment ITEM_IMAGE, authenticated content and safe storage | Camera/gallery on add/edit/list detail | ITEM_IMAGES Smart+ checked manually in attachment controller; image5MiB/quota | attachments, item-configuration | WORKING_BUT_NEEDS_MORE_TESTING |
| Services | Item item_type SERVICE, no physical projection | Product/Service choices and bill | SERVICES Starter+; service cost may be unknown | universal/costing | WORKING_BUT_NEEDS_MORE_TESTING |
| Variants | ItemVariant SKU/attribute/tax/rate and variant stock/cost | Item configuration and sale/purchase chooser | VARIANTS Smart+; variant company derived through item | universal, bundle-modifier | WORKING_BUT_NEEDS_MORE_TESTING |
| Multi-unit | Item unit conversion with entered/base qty and rate snapshots | Buy/sell unit selection | MULTI_UNIT Smart+; positive valid factors, prevent used conversion rewrites | universal, batch-fefo | WORKING_BUT_NEEDS_MORE_TESTING |
| Weight | WEIGHT and base-unit quantity, decimals | kg/g etc unit selection | WEIGHT Smart+; measured quantity not integer piece | universal | WORKING_BUT_NEEDS_MORE_TESTING |
| Volume | VOLUME and litres/millilitres | Volume presets and line unit | VOLUME Smart+ | universal | WORKING_BUT_NEEDS_MORE_TESTING |
| Length | LENGTH dimensions/entered quantity | Length field and metre/foot presets | LENGTH Smart+ | universal | WORKING_BUT_NEEDS_MORE_TESTING |
| Area / dimensions | Length×width×entered count snapshot; compatible area base units | Dimension configurator | AREA Smart+; positive dimensions; not a manufacturing cutting optimizer | universal/costing | WORKING_BUT_NEEDS_MORE_TESTING |
| Fractional quantity | Decimal quantity/conversion arithmetic | Decimal input and displayed unit | Depends on measured mode/unit, piece integers | universal | WORKING_BUT_NEEDS_MORE_TESTING |
| Flexible attributes | custom_attributes/variant attributes JSON | Advanced item/variant fields; not every arbitrary schema has a dedicated editor | No independent paid key; variants/compatibility checks apply to relevant operations | universal/bundle | PARTIAL |
| Compatibility/models | compatibility_tags/custom attributes with scoped item options | Advanced item/line metadata | COMPATIBILITY Pro; no dedicated standalone compatibility search module | universal | PARTIAL |
| Bundles / sets / kits | ItemBundleComponent consumed as actual components, cycle/self-reference/stock checks, cost sum | Item composition editor and sale config | BUNDLES Smart+; no separate SETS key; set means bundle | bundle-modifier | WORKING_BUT_NEEDS_MORE_TESTING |
| Modifiers / add-ons | ItemModifierGroup/Option selected price delta/cost component effects | Composition and bill line chooser | MODIFIERS Smart+ setup gate; existing sale option-ID gate gap noted above | bundle-modifier | WORKING_BUT_NEEDS_MORE_TESTING |
| Wastage / damage | OUT adjustment, authoritative movement and loss journal | Adjustment form; no separate full wastage module | WASTAGE Smart+ for keyword-classified adjustments; generic OUT can bypass this classification | costing-profit, inventory | PARTIAL |
| Price levels / lists / quantity breaks | PricingController/Engine price lists/items, customer rates, promotions and evaluate | Limited item/customer selection integration; no routed rich Retail price-management suite | ADVANCED_PRICING Pro for new pricing writes; read endpoints may require SALES only | pricing/module_13, sales/pos | BACKEND_ONLY |
| Locations / transfers | Godown, transfer draft/post/reverse; default primary location | Retail locations/transfer sheet and master pages | MULTIPLE_STOCK_LOCATIONS Pro for extra location/new transfer; limit10 defaultPro | tenant-administration, universal, inventory | WORKING_BUT_NEEDS_MORE_TESTING |

No feature service should mutate StockBalanceProjection directly; the current authoritative posting/reversal services own projection changes. Query reads and cached UI estimates are not postings. Company-scoped SKU/barcodes/party codes; serial number intentionally unique across company (not separately per item). Branch/store code scoped under company, location under branch; document constraints include company/branch/FY policies, detailed model constraints in schema appendix. User username and verified Google/phone identity are intentionally global login identities, not tenant-local reusable staff login names.

## 11. Batch / expiry / serial / locations

| Batch/expiry behavior | Actual implementation / limit |
|---|---|
| New/existing batch | ItemBatch receiving details; same company/item/variant identity required, batch metadata consistency checked; actual projection increments on posted receipt, not by editing lot master. |
| Expiry / no expiry | Optional expiry; dated lots precede no-expiry lots in FEFO. Manufacturing/expiry dates validated as receiving facts. |
| Expiring today | Allowed on transaction date; strictly older date is expired and blocked for sale. |
| FEFO / manual / multi-batch | Available positive projection stock, company/item/variant/location scoped, sorted by expiry; one sale can allocate multiple batches; explicit selected batch validated. |
| Returns | Original batch allocations and quantity/cost snapshot restore physical stock, prevent returning more than sold. |
| Multi-unit + variant | Receipt/sale base normalization and selected variant before batch allocation; advanced flags combined. |
| Reconciliation | Stock movement/projection is actual availability. The older GoodsReceiptLine expiring-batches endpoint is received-lot history, not an authoritative current-stock projection. |
| Gate | BATCH_TRACKING + base module, Smart/Pro; historical/recovery exceptions differ from new operations. |

Batch status `WORKING_BUT_NEEDS_MORE_TESTING`; tests `batch-fefo.e2e-spec.ts`, universal-item-flow, costing-profit, production-readiness, inventory/sales specs. No standalone Retail batch route; controls embedded in item, receiving and billing.

Serial/warranty status `WORKING_BUT_NEEDS_MORE_TESTING`: active ItemSerial, invoice-line serial allocations, original warranty snapshot, serial status/location transitions, integer base-unit receipt serial count, company-wide normalized serial uniqueness, same-serial concurrent sale protection and return restoration. UI controls exist in receiving/line config; warranty lookup is a backend endpoint and no dedicated warranty lookup/Serial management route is registered. SERIAL_TRACKING is genuinely Pro by **current catalog and saved plan**, not inferred from old docs. No provider required. Warranty is recorded lookup data, not an insurer/service claim integration. Relevant tests: universal-item-flow, production-readiness, batch/bundle/costing suites and embedded serial scenarios, not a separately named standalone serial test file in the current test directory.

Default stock location is auto-created “Shop Stock” under Main Shop; default unit/FY/ledger/config also created. Additional locations/branches require MULTIPLE_STOCK_LOCATIONS, tenant override can grant/deny, shop toggle can disable new operations. Existing locations/stock are not deleted. Location inventory and report filters use godown_id; transfers do not create profit/double valuation. Location UI is owner/master-admin managed and creation uses GodownsController; current retail screen's enabled check consumes resolved account features. Count limits and reactivation gaps are in section5.

## 12. Need List

| Field / action | Actual support | Status |
|---|---|---|
| Item name | Required free text, quantity optional positive/default1 | WORKING_BUT_NEEDS_MORE_TESTING |
| Linked inventory item | No item_id in current NeedList DTO/service; names do not safely identify a catalog item | NOT_IMPLEMENTED |
| Customer / phone / supplier | Optional scoped customer_id, customer_phone, preferred_supplier_id | WORKING_BUT_NEEDS_MORE_TESTING |
| Needed-by / urgency / notes / expected price | Date, NORMAL/URGENT, note, optional expected price | WORKING_BUT_NEEDS_MORE_TESTING |
| Source | SHOP/CUSTOMER, defaults inferred from selected customer | WORKING_BUT_NEEDS_MORE_TESTING |
| Photo | NEED_PHOTO attachment upload/content, retry after record already saved | WORKING_BUT_NEEDS_MORE_TESTING |
| Voice need | No audio upload/recognition flow | NOT_IMPLEMENTED |
| Status | NEED/ORDERED/RECEIVED/CANCELLED, edit and status change | WORKING_BUT_NEEDS_MORE_TESTING |
| Group by supplier | Preferred supplier label/selection exists; no dedicated grouped supplier-order screen found | PARTIAL |
| WhatsApp/share need | No connected dedicated need-order WhatsApp/share action found in current RetailNeeds screen | NOT_IMPLEMENTED |
| Need → Purchase | No atomic converter/link/received-stock posting; status is administrative text | NOT_IMPLEMENTED |

Actual gate RETAIL_POS + INVENTORY; dedicated NEED_LIST entitlement is catalog-only for this API path. Non-owner inventory.read/write applies. Basic listing uses default page bounds, but frontend getNeeds loads one page without a complete paged Need workflow. Tests cover basic source/status/photos/tenant scope; no test can prove the missing conversion/voice/share feature exists.

## 13. GST — keep invoicing separate from statutory integrations

| Capability | Exact actual support | Gate / dependency | Status |
|---|---|---|---|
| Organization GST profile | GSTIN, legal/trade identity/address/state, invoice series and HSN policy; stored company config | Profile read baseRETAIL_POS; write GST_INVOICES + settings.write | WORKING_BUT_NEEDS_MORE_TESTING |
| Recipient GST/details | Customer GSTIN/address/place of supply and statutory draft fields | Must reconcile saved bill and valid domestic recipient rules | WORKING_BUT_NEEDS_MORE_TESTING |
| Taxed bill | Ordinary saved bill tax; formal document uses snapshot | All plans basic bill; formal Smart+ | WORKING_BUT_NEEDS_MORE_TESTING |
| GST invoice / numbering | Immutable RetailGstInvoice snapshot, one per sale, company/FY locked sequence prefix/FY/6 digits | GST_INVOICES Smart/Pro, sales.write, open FY and statutory fields | WORKING_BUT_NEEDS_MORE_TESTING |
| CGST/SGST/UTGST/IGST | Intrastate half split or interstate IGST, saved tax/amount reconciliation within tolerance | Domestic forward charge; GSTIN/state mismatch rejected | WORKING_BUT_NEEDS_MORE_TESTING |
| HSN/SAC/UQC | Configured4/6/8-digit goods policy; service SAC6; unit code mapping | Not taxpayer registration verification service | WORKING_BUT_NEEDS_MORE_TESTING |
| A4/PDF/print/multipage | GstInvoiceView A4 print CSS/browser save as PDF; copies/long bill layout | Browser/device print capability; no standalone signed server-PDF API | WORKING_BUT_NEEDS_MORE_TESTING |
| GST history / export | Issued records and GST metadata CSV export | EXPORT_GST Smart+; base history read intentionally available separately | WORKING_BUT_NEEDS_MORE_TESTING |
| Government GST return/report filing | Reporting-status UI describes unavailable statutory provider; no filing | No provider configured or government gateway adapter | NOT_IMPLEMENTED |
| IRN / e-invoice | No IRN provider; electronic_reporting other than NOT_REQUIRED rejected | Must not issue misleading document when e-invoice required | NOT_IMPLEMENTED |
| Reverse charge | Rejected in current issuing flow | No statutory processing support | NOT_IMPLEMENTED |
| GST return preparation | No full GSTR-1/GSTR-3B statutory return engine | Issued invoice CSV is not a GST return | NOT_IMPLEMENTED |

Source `retail/gst/gst.controller.ts`, `gst.service.ts`, `gst-rules.ts`; frontend gst components. Already-issued GSTIN/state/series cannot casually change; future item taxes never rewrite issued snapshots. Amount-only sale lacks itemized statutory details and is rejected. Tests: gst-invoice.e2e, retail-field-coverage, frontend item-configuration/manual-acceptance/retail-ux include GST scenarios. No new legal conformity certification is made by this source audit.

## 14. Costing, COGS and financial report definitions

| Capability | Actual source facts / method | Restriction / status |
|---|---|---|
| Purchase/opening cost | Saved actual purchase/entered-unit/base cost, landed costs allocated; missing opening cost explicitly unknown | INVENTORY/PURCHASING posting; WORKING_BUT_NEEDS_MORE_TESTING |
| Moving weighted average | Inventory cost state maintains known value/quantity and unknown quantity separately; company/item/variant pool across locations | WORKING_BUT_NEEDS_MORE_TESTING |
| FIFO costing | No FIFO cost-layer engine found; FEFO allocation is expiry policy, not FIFO financial costing | NOT_IMPLEMENTED |
| Sale COGS snapshot | cost_status, cost_per_base_unit/cogs_total/cost_snapshot saved at posting | Immutable transaction facts; WORKING_BUT_NEEDS_MORE_TESTING |
| Returns COGS | Reverse original sale snapshot cost, not today's replacement rate | Original quantity/serial/batch checks; WORKING_BUT_NEEDS_MORE_TESTING |
| Discounts | Bill discount allocated across lines with currency rounding; net revenue saved excludes tax | Already in revenue; not subtracted a second time; WORKING_BUT_NEEDS_MORE_TESTING |
| Unknown cost / coverage | Missing costs remain unknown; incomplete coverage flagged, no assumed zero profit | Known-cost gross/net labels; WORKING_BUT_NEEDS_MORE_TESTING |
| Service cost | Explicit supplied/service cost supported; absent remains unknown | No arbitrary selling-price-derived margin; WORKING_BUT_NEEDS_MORE_TESTING |
| Variant/batch/multi-unit | Variant cost pool, unit normalization, batch allocation snapshots; serial-specific costs where tracked | Batch selection does not establish a separate FIFO layer; WORKING_BUT_NEEDS_MORE_TESTING |
| Stock valuation | Current stock known value and missing-cost quantities; location filtering with shared cost pool | PROFIT_REPORTING + REPORTS; WORKING_BUT_NEEDS_MORE_TESTING |
| Gross profit | Saved net-of-tax revenue minus saved COGS on known-cost lines; sales returns reverse originals | Smart/Pro dedicated reports; incomplete totals labelled; WORKING_BUT_NEEDS_MORE_TESTING |
| Net business profit / P&L | Gross profit minus posted business expenses and relevant inventory losses/purchase cost variance | Owner drawings/supplier settlements are not profit expenses; WORKING_BUT_NEEDS_MORE_TESTING |
| Item/bill/category/customer/staff profit | Group same authoritative facts, filters and comparable date range | PROFIT_REPORTING + REPORTS + reports.read; WORKING_BUT_NEEDS_MORE_TESTING |
| Missing current cost correction | Audited correction of remaining item/variant stock across company locations | inventory.write + reports.read; never backfills historical sale costs; WORKING_BUT_NEEDS_MORE_TESTING |
| Profit export | Structured financial CSV | EXPORT_PROFIT + PROFIT_REPORTING Smart+; WORKING_BUT_NEEDS_MORE_TESTING |

Sources `inventory/costing.ts`, `cost-snapshots.ts`, `value-journal.ts`, `retail/reports/financial-reports.service.ts`, posting services. Decimal arithmetic is used (high-precision intermediate/persisted cost); browser card calculations are estimates only. Financial fields visibility in bill APIs checks REPORTS and report role, **not** paid PROFIT_REPORTING; this is an actual distinction to resolve during future packaging, not silently assume away.

## 15. Every implemented report family

Common Retail report gate: RETAIL_POS + dynamic REPORTS, reports.read for non-owner; specialized financial reports declare REPORTS + PROFIT_REPORTING. CSV entitlement is independent of being allowed to view a report. Optional filters do not automatically authorize another tenant/company. Owner branch filters and some company-wide operational scopes differ from default current-branch views; this audit does not claim all reporting is strictly current-branch-only.

| Report | UI route | API suffix under `/api/v1` | Data source / export | Gate / tests / status |
|---|---|---|---|---|
| Home/business dashboard | retail/home, retail/reports | retail/reports/dashboard | Posted invoices/returns/purchases/expenses, tender snapshots, due allocations; no separate dashboard CSV | REPORTS; retail-flow/general-store/costing; WORKING_BUT_NEEDS_MORE_TESTING |
| Sales | retail/reports/sales | retail/reports/sales | Posted sales net returns, original tender allocation; EXPORT_SALES | Starter view/export; retail-flow/costing/general-store; WORKING_BUT_NEEDS_MORE_TESTING |
| Top items | Sales/Home sections, no separate route | retail/reports/sales/items | Posted invoice lines | REPORTS, no separate advanced key; retail-flow; WORKING_BUT_NEEDS_MORE_TESTING |
| Purchases | retail/reports/purchases | retail/reports/purchases | Posted PurchaseInvoice totals; EXPORT_PURCHASES | Starter view/Smart export; report/import/general-store; WORKING_BUT_NEEDS_MORE_TESTING |
| Expenses/owner | retail/reports/expenses | retail/reports/expenses | Posted Expense groups; EXPORT_EXPENSES | Starter view/Smart export; expenses/field-coverage; WORKING_BUT_NEEDS_MORE_TESTING |
| Stock | retail/reports/stock | retail/reports/stock | Authoritative projection with unit/variant/location; EXPORT_STOCK | Starter view/export; universal/inventory; WORKING_BUT_NEEDS_MORE_TESTING |
| Low/out stock | retail/stock tabs and report filters | retail/items, retail/reports/stock | Projection threshold, inventory_tracking-aware | INVENTORY/REPORTS; busy-day/universal; WORKING_BUT_NEEDS_MORE_TESTING |
| Customer dues | retail/reports/customers | retail/reports/customers/due | Party allocation outstanding; EXPORT_CUSTOMERS | Starter view/Smart export; retail-flow/general-store; WORKING_BUT_NEEDS_MORE_TESTING |
| Supplier dues | retail/reports/suppliers | retail/reports/suppliers/due | Payables allocation outstanding; EXPORT_SUPPLIERS | Starter view/Smart export; retail-flow/general-store; WORKING_BUT_NEEDS_MORE_TESTING |
| Returns | retail/reports/returns | retail/reports/returns | Posted returns and original invoice links; EXPORT_SALES for returns export | Starter; costing/shopkeeper; WORKING_BUT_NEEDS_MORE_TESTING |
| Daily Galla | retail/galla | retail/galla | Posted cash vouchers/counts, not total sales; no separate Galla export key | ACCOUNTING actual; calendar/costing; WORKING_BUT_NEEDS_MORE_TESTING |
| GST issued history | retail/gst | retail/gst/bills | Issued immutable GST snapshots; EXPORT_GST | Formal write Smart; basic history read; gst-invoice; WORKING_BUT_NEEDS_MORE_TESTING |
| P&L / gross / net | retail/reports/financial/profit, gross, net | retail/reports/financial/summary | Same known-cost financial summary; EXPORT_PROFIT | Smart+; costing-profit; WORKING_BUT_NEEDS_MORE_TESTING |
| Trend | retail/reports/financial/trend | retail/reports/financial/trend | Daily/weekly/monthly saved fact aggregation | Smart+; costing-profit; WORKING_BUT_NEEDS_MORE_TESTING |
| Item / bill / category | retail/reports/financial/items, bills, categories | retail/reports/financial/:group | Financial fact dimensions, searched/paged | Smart+; costing-profit; WORKING_BUT_NEEDS_MORE_TESTING |
| Customer / staff profit | retail/reports/financial/customers, staff | retail/reports/financial/:group | Saved attribution, not productivity/payroll engine | Smart+; costing-profit/insights; WORKING_BUT_NEEDS_MORE_TESTING |
| Margin / low margin / below cost | retail/reports/financial/margin, low-margin, below-cost | retail/reports/financial/:group | Known-cost transaction margins/threshold | Smart+; costing-profit; WORKING_BUT_NEEDS_MORE_TESTING |
| Cost coverage / unknown sales | retail/reports/financial/coverage; unknown-sales reachable kind | financial/coverage, financial/unknown-sales | Missing-cost stock/sales plus correction action | Smart+, correction extra inventory.write; costing-profit; WORKING_BUT_NEEDS_MORE_TESTING |
| Stock valuation | retail/reports/financial/valuation | financial/valuation | Known inventory cost and unknown quantity | Smart+; costing-profit; WORKING_BUT_NEEDS_MORE_TESTING |
| Staff directory export | more/staff/export in backup export area | account/exports/STAFF | Safe directory, no passwords | EXPORT_STAFF Pro; not a full staff attendance report; WORKING_BUT_NEEDS_MORE_TESTING |
| Ledger/trial balance/outstanding | accounting/ledger/:id and master accounts | accounting/ledger/:id, trial-balance, parties/:id/outstanding | Voucher/accounting facts | ACCOUNTING and permissions; source accounting suites; WORKING_BUT_NEEDS_MORE_TESTING |
| Full Balance Sheet / Cash Flow report | No dedicated active Retail screen/backend complete financial statement route found | — | Galla cash movement and trial balance are not a full statement | NOT_IMPLEMENTED |
| Platform SaaS revenue/MRR/ARR/refunds/pending | platform/dashboard, payments/revenue/subscriptions | platform/admin/dashboard, payments | Real SubscriptionPayment and active periods; definitions below | SUPER_ADMIN; platform-control-plane; WORKING_BUT_NEEDS_MORE_TESTING |

The financial screen discovers 14 kinds. `unknown-sales` is additionally handled but is not one of those discovery cards. There is no separate comprehensive Staff Report route beyond staff financial attribution/directory and assistant operational questions. The endpoint appendix distinguishes reusable backend operational helpers from HTTP report endpoints.

Platform metrics: revenue = paid amount + tax − discount − refund; pending uses pending amount + tax − discount; MRR takes latest paid current billing period per active, non-complimentary tenant, excludes tax and allocated refund, divides by billed months; ARR =12×MRR. Expenses come from PlatformExpense. Historical churn/trial cohort conversion are unavailable, not fabricated. Process uptime/memory/CPU time and DB connections/size/latency are real system queries; cloud provider CPU/disk/PITR/billing adapters are UNAVAILABLE. Some metric source queries load all rows and need volume validation.

## 16. Ask Apna Galla and business insights

Active source `assistant/assistant.module.ts`, intent-library, router/NLP/entity resolver/tool registry, AssistantService, BusinessInsightService, response templates and analytics. The older `intelligence` directory is not an imported runtime module despite a leftover TypeScript import in AppModule.

| Area | Actual behavior | Restriction / status |
|---|---|---|
| Text assistant | Exact/alias/pattern/Fuse deterministic routing; no external LLM call or free model dependency | ASSISTANT_TEXT Starter+, RETAIL_POS; WORKING_BUT_NEEDS_MORE_TESTING |
| Catalog |96 registered source intents;656 authored raw examples; local active config96 and expanded/deduplicated examples843 | Configurable active flags/default/custom aliases; counts differ by definition, not fabricated coverage |
| Languages | English, Hindi, Hinglish normalization, templates, dates and synonym matching | Supported examples do not guarantee every natural phrase; WORKING_BUT_NEEDS_MORE_TESTING |
| Business data safety | Read-only business tools, scoped permitted entity resolution and clarification, shared financial/report services | Query/session/log records are still written operationally; no business write/create/edit/delete assistant tool |
| RBAC | intent.permissions checked; module features and business-insight/profit requirements checked | Cannot bypass role or plan through free text; existing test coverage, not new audit penetration test |
| Routing/clarification | Exact/pattern/fuzzy/context/unknown, confidence and alternatives; entity choices, stale session version handling | Ambiguity requests selection instead of guessing; conversation expiry15min |
| Logging | Query intent/status/timing/confidence and sanitized question; retention30days with purge | Financial result bodies not logged as assistant answers; Platform analytics available |
| Rate/usage |180/min/user,400 chars; catalog reload and bounded alias reads | No commercial monthly assistant_queries metering |
| Voice | VOICE channel requires ASSISTANT_VOICE then rejects unavailable provider; microphone/upsell status UI | Pro key granted ≠ working STT/audio; PROVIDER_NOT_CONFIGURED |
| WhatsApp voice assistant | No incoming WhatsApp webhook, media fetch/STT/TTS response/send integration | NOT_IMPLEMENTED |
| LLM write/autonomous SQL | No arbitrary SQL/shell/business writes from assistant | NOT_IMPLEMENTED as a business feature, deliberately absent |

Router thresholds are implementation heuristics (Fuse threshold0.30; sufficiently strong confidence/margin for direct selection, otherwise alternatives/unknown), not an accuracy guarantee. All registered intents, permissions, module keys and raw example counts are in the intent appendix.

### Business Insights

All insight intents additionally require BUSINESS_INSIGHTS (Smart/Pro) and the individual intent's module feature/permissions. The registry adds PROFIT_REPORTING only for category `financial`; financial diagnosis intents are category `insight` and do **not** receive that extra gate. Financial insight therefore can remain accessible if BUSINESS_INSIGHTS is granted while PROFIT_REPORTING is denied; PROFIT_VS_CASH_EXPLANATION even uses ACCOUNTING rather than REPORTS as its module. Default Smart grants both, which masks this distinction. They reuse FinancialReportsService, OperationalReportsService and CounterService directly with the same scope/period and saved facts, bypassing the financial controller's separate gate.

| Insight family | Actual evidence / limitation |
|---|---|
| Sales down/up | Comparable bill count vs average bill value decomposition; items/categories/customers/staff as supporting dimensions. |
| Profit down/up, COGS and margin | Saved known-cost revenue/COGS, business expense/write-off changes, coverage warning; discounts/returns already in facts and not double-counted. |
| Money whereabouts / cash pressure | Checkout cash/UPI/credit separated from old collections, supplier settlements, withdrawals, actual Galla cash; multi-day return value not assumed cash refund. |
| Item/category/customer/staff performance | Dimension changes/ranking and attribution; not proof of cashier causality or a payroll/CRM automation module. |
| Customer behavior / dues | New credit and collections, receivable movement, permitted customer history, sparse samples handled. |
| Stockout impact | Present zero stock with falling period sales marked CORRELATED; historical stockout duration and lost revenue unavailable, no invented sales loss amount. |
| Returns / expenses / purchases | Posted totals and count/category context; purchase value is working capital, not automatically a profit expense. |
| Comparable periods | Equal-length previous range; previous month equivalent days bounded to that month's length; previous-week equivalent selected weekdays. |
| Evidence and confidence | Actual evidence enum **DIRECT / CORRELATED / ESTIMATED**; confidence **HIGH / LIMITED / INSUFFICIENT**. Insufficient sample suppresses unsupported drivers. |
| Output | Delta/% change, up to10 prioritized drivers, severity/supporting facts, links/follow-ups. Overlapping dimensions are not additive causes. |

Status `WORKING_BUT_NEEDS_MORE_TESTING`; intent-router.spec, business-insight.service.spec, assistant.e2e and frontend assistant/costing-profit specs cover these code paths. No causal experimental model or generative analyst exists.

### Separate quick report questions and automatic summaries

ReportAssistantService is a smaller six-intent regex interpreter: PROFIT, UDHAR, RECEIVED, SALES, EXPENSES, SUMMARY. It is **not** the 96-intent assistant. It answers whole-business daily questions; item/bill profit asks user to open Ask. Hindi/English outputs; received stock uses PURCHASE_IN, excludes import opening stock. REPORTS/RETAIL_POS and report permissions apply; non-profit paths use broader report access without individually requiring purchasing/accounting feature keys. This differs from the stricter intent-specific assistant gates.

Daily summary preferences are owner-only enabled/time/language. A60-second backend timer scans100 preference rows/page, skips inactive/locked/non-owner or inactive subscription/report-entitlement accounts, upserts one notification per company/branch/user/day; inbox last 30 and unread/read action. Multi-instance dedup uses DB uniqueness/upsert, not an asserted cross-instance scheduler lock. It is in-app only; browser push/email/SMS/WhatsApp delivery is absent. Snapshot summary may be stale after later edits; notification does not imply full offline or live push. Status `WORKING_BUT_NEEDS_MORE_TESTING`.

## 17. Staff, roles, authentication and onboarding

### Tenant identity and staff

Owners/ADMIN/TENANT_ADMIN are privileged tenant roles. UserRole scopes company/branch; custom roles/permission assignments are tenant-scoped, protected owner roles cannot be assigned to new staff, last active owner is retained. Staff create/disable/enable/unlock/password reset/force logout/session revoke exist; custom role management requires ADVANCED_STAFF Pro, staff creation STAFF Smart+. Safe directory responses never include password hashes. Staff passwords have forced first change and temporary24-hour expiry; no standalone cashier PIN login implementation found. Cashier/salesperson can be custom roles but are not separate automatic universal permissions/plan exceptions.

Default STAFF permission list: sales.read, inventory.read, pos.sale.create, pos.shift.read/open/close. Retail bill creation uses sales.write, causing the documented compatibility gap. Current local permission registry has 23 entries; provisioner creates21 legacy keys but lacks reports.read/write, settings.write, documents.read/write, identity.admin and several newer sales.* keys. Owner bypass means provisioning may appear fine until staff use these routes. No audit edit was made.

Cost/profit visibility uses the financial response interceptor (REPORTS + privileged role or reports.read) for selected bill/sales/pos responses; paid profit screens require PROFIT_REPORTING. There is no separate `profit.read` permission enforced globally. Staff financial attribution report is Smart profit reporting; custom staff permissions are Pro. User/role/session/company/branch/location/FY admin routes are active; all API authorization listed in appendix.

### Authentication methods

| Method / capability | Actual implementation | Provider / restriction | Status |
|---|---|---|---|
| Password tenant login | bcrypt cost12, persisted session and signed token; lock after10 failures |12 chars with upper/lower/digit/symbol, max72UTF8bytes; no weak production bootstrap | WORKING_BUT_NEEDS_MORE_TESTING |
| Google sign-in/signup | Verified Google ID credential with audience/issuer/expiry/email checks and stable subject; new identity can enter onboarding | GOOGLE_CLIENT_ID locally present; actual Google origins/consent/live account flow not revalidated | WORKING_BUT_NEEDS_MORE_TESTING |
| Google account link/unlink | Explicit authenticated security flow; collision and account consistency checks | No unverified email-only takeover; at least usable login method retained | WORKING_BUT_NEEDS_MORE_TESTING |
| Mobile OTP signup/login/link | Twilio abstraction, canonical E164, hashed challenge, terms/referral, cooldown/attempt limit | SMS_PROVIDER none locally | PROVIDER_NOT_CONFIGURED |
| Email verification/reset | One-use hashed tokens20min, SMTP abstraction; generic response, password history and session revocation | EMAIL_PROVIDER none locally; password change with current password still works | PROVIDER_NOT_CONFIGURED |
| Browser session transport | HttpOnly cookie auth, secure production settings, origin/CSRF check; auth store persists cookie marker/user/context/CSRF, not JWT | Cross-site deployment must preserve cookie/browser origin behavior; no localStorage access JWT | WORKING_BUT_NEEDS_MORE_TESTING |
| Refresh tokens | No separate refresh-token model or rotating refresh endpoint found; signed1-day session/token lifetime | Re-login/session flow, not an OAuth refresh-token claim | NOT_IMPLEMENTED |
| Logout/device revoke | Persisted session revoke and subsequent server rejection; list active devices and owner force logout | Scoped session ownership, expiry and organization device limit | WORKING_BUT_NEEDS_MORE_TESTING |
| Tenant MFA | No general retailer TOTP enrollment/second factor flow | Platform MFA is separate | NOT_IMPLEMENTED |
| Platform password + MFA | Separate secret/PlatformUser/Role/Session, SUPER_ADMIN required; encrypted TOTP enrollment/verify challenge | Mandatory production MFA; persisted-role/session checks, CSRF; no automatic production bootstrap passwords | WORKING_BUT_NEEDS_MORE_TESTING |
| Super Admin credential maintenance | Change own password; administrator creation scripts/config validation | Not a Google/mobile Retail account shortcut | WORKING_BUT_NEEDS_MORE_TESTING |

Production environment validation rejects invalid/missing DATABASE_URL, weak/equal JWT secrets, missing32-byte MFA encryption key, disabled platform MFA, non-HTTPS origins, production bootstrap passwords, unsupported providers/config, missing APP_VERSION. It can accept BACKUP_PROVIDER=none, which explicitly means **not configured**, not healthy offsite protection. SMTP/SMS/backup/storage configs validated only for selected provider. No secret values are reproduced here.

### Google business profile onboarding

New Google identity → combined owner/business profile → plan → import/start-fresh migration choice → ACCESS_PENDING until authorized paid/trial/complimentary access → READY. Existing persisted state can resume, returning READY user skips creation. Server locks account during provisioning and prevents duplicate company creation/repeated late profile changes. Owner name/shop name/Indian mobile/business category/address required; city/state/postcode/custom type are supported. Contact phone **is not OTP-verified just because it is entered**, UI says this; actual phone_verified_at is a separate verified fact. Google subject/email is not a business entitlement.

Business category list has 59 presets including custom/other category; recommendations suggest feature keys, never grant them or turn the app into wholesale/manufacturing/KOT. Provisioning creates organization, company, main branch, main godown, PCS, active financial year, owner role, ledger/config defaults and pending subscription. Trial is disabled unless Platform policy enables it and defines duration. Plan-request API records requested plan; no fake payment confirmation. Owner sees migration guidance and can resume saved choice. Tests: google-business-onboarding, account-onboarding-referral, auth-lifecycle, platform-access-approval backend e2e; frontend google-business-onboarding/auth/platform-control-plane.

## 18. Imports, exports, documents, backups and portability

### Real import formats and entity boundaries

Presets: Vyapar (VYAPAR), TallyPrime (TALLY), BUSY, Zoho Books (ZOHO), myBillBook/another-app (MYBILLBOOK) and Generic (GENERIC). No dedicated Marg preset exists. Guidance links/export steps and editable column mapping are provided; these are **not certified full vendor database connectors**. Formats: CSV, TSV, TXT, XLS, XLSX, XLSM, XLSB, ODS, JSON, NDJSON, XML. PDF/images/proprietary backup formats are rejected, not automatically OCR-posted. Workbook sheet/header selection, delimiter attempts, safe headers, XML no entities/doctype, nested metadata retention and explicit unmapped acknowledgment exist.

| Import kind | Supported destination | Explicit boundary |
|---|---|---|
| ITEMS | name, SKU/barcode/unit, selling/purchase/MRP, opening stock, GST/HSN/category/minimum/selling mode/tracking/external ID | Source aliases map normalized DTO; missing selling price invalid; positive opening stock requires explicit cost; advanced tracked opening stock not imported. |
| CUSTOMERS | Party CUSTOMER details/credit policy/opening due | Opening debtor balances posted to ledger; no negative/advance balance silently accepted. |
| SUPPLIERS | Party SUPPLIER contact/credit/GST/PAN/state/nickname/opening due | Tally direct Sundry Creditors adapter, custom groups require explicit mapping. |
| STOCK | Existing SKU/barcode, quantity/unit/cost/location | Names alone unsafe; item must have no stock movement history; opening snapshot not additive on top of stock; variant/batch/serial/bundle/service rejected. |
| Opening dues | Through customer/supplier opening_balance | Not a separate transaction-history importer. |
| Old sales/purchases/payments/journals | No supported import kinds | NOT_IMPLEMENTED; don't claim full historical accounting migration. |

Tally adapter extracts STOCKITEM/LEDGER; direct Sundry Debtors/Creditors filtered; customer opening sign normalized, original source retained. Generic nested JSON/XML structures outside supported adapters need a tabular export; “every format” is not current capability.

Preview persists RetailImportJob/Row without posting masters. Mapping/defaults checked; fingerprint and per-source identity prevent repeated duplicate posting. Each25-row commit call locks row/company and posts a row atomically; already imported/existing identity skipped, failures retained/retryable; the whole file is **not** an all-or-nothing transaction and existing records are not silently updated. Original/unmapped fields retained in audit. History30, row pages50. Owner-only, RETAIL_POS controller gate; **per-kind/module/imported measured-mode entitlement gap** remains as section3 explains. No IMPORT catalog key or paid migration row quota exists. Status `PARTIAL`; parsing/posting tests in import-format.spec/import-report.e2e and frontend import-report-acceptance.

### Exports and data ownership

Structured CSV kinds: ITEMS, STOCK, CUSTOMERS, SUPPLIERS, KHATA, SALES, PURCHASES, EXPENSES, GST, PROFIT, STAFF, LOCATIONS, DOCUMENTS, RETURNS. Each maps a feature key and permission; RETURNS uses EXPORT_SALES, PROFIT also PROFIT_REPORTING. Export feature matrix below is authoritative. Frontend CSV escapes formula-like values; custom filters/selection and pagination exist. Data-view entitlement does not automatically grant export.

Full business NDJSON export streams safe records in500-row chunks; attachment metadata only, no file bytes/storage secrets/user hashes/sessions. Final complete footer allows detecting truncated download. It is a live paginated stream, **not a transaction-consistent PostgreSQL snapshot and not an app-restorable archive**. Normally EXPORT_FULL_BUSINESS Pro + owner; account-exit DATA_PORTABILITY/DELETE_ACCOUNT pending request allows owner portability on any plan. That exception preserves customer data access without subscription lock-in.

Scheduled export is NOT_IMPLEMENTED even though EXPORT_SCHEDULED Pro is assigned. Daily report notification is not a scheduled data export. Downloading tenant backup/export can create RetailBackupRequest for Platform follow-up, rate-limited/idempotent request_key, last 30 status records; it does not create an offsite DB backup or dial a support call.

### Attachments and backup system

Allowed entities/categories: PURCHASE/PURCHASE_BILL; NEED/NEED_PHOTO; SUPPLIER_PAYMENT/SUPPLIER_PAYMENT_PROOF; CUSTOMER_PAYMENT/CUSTOMER_PAYMENT_PROOF; EXPENSE/EXPENSE_BILL or EXPENSE_PROOF; ITEM/ITEM_IMAGE; SALES_INVOICE/SALE_PROOF. Image MIME/magic/decode/re-encode enforced, random storage key and safe original display filename; tenant authenticated content/delete endpoints, entity company scoped; PDF/audio/general arbitrary uploaded documents absent. RetailDocuments is metadata/content browser for these attachments. Local or private S3 storage implementation; current selected local, offsite S3 not established. Role documents.read/write and entity-specific guards remain. Status `WORKING_BUT_NEEDS_MORE_TESTING` locally, production provider integration not audited.

Real backup code uses fixed execFile pg_dump custom archive and pg_restore --list verification; no raw browser shell/SQL. S3BackupStore AES-GCM encryption/integrity and private offsite object storage configuration; retention configuration default30days/bounded7–365 with lifecycle verification, not an internal cron backup scheduler. Production create requires offsite S3; local simulation is not marked production backup. Shared DB archive covers DB, not selective single-tenant restore. Production browser restore is prohibited; only pre-created configured local `*_restore_test` target can be restored, cannot overwrite running DB. Structural verification does not prove successful recovery. PITR and selective tenant restore unavailable. Local BACKUP_PROVIDER=none → NOT_CONFIGURED. No restore drill was run here. Backup/restore overall `PROVIDER_NOT_CONFIGURED`; production restore adapter `NOT_IMPLEMENTED`.

## 19. Platform capability map and provider readiness

PlatformAuthGuard requires signed platform token/cookie, persisted active/unlocked PlatformUser, persisted SUPER_ADMIN role, current session and MFA (when required). It authorizes the platform database scope. There is **no separate per-action platform permission matrix** currently enforced: the broad SUPER_ADMIN guard is the action boundary. A Retail owner cannot get it by modifying tenant role/payload. Every active platform route is listed in the next inventory. Platform support access is explicit scoped session/allowed read kinds and audited; not arbitrary tenant SQL/shell. Platform plan/tenant overrides, limits, activation, user credential/session controls, backup/lifecycle mutations have audit records and validation.

| Provider / external capability | Implemented boundary | Local observed configuration / status |
|---|---|---|
| PostgreSQL | Prisma migrations, guarded request context, forced RLS migration, restricted runtime role deployment setup | Read-only local DB snapshot accessible; not a Neon production verification. WORKING_BUT_NEEDS_MORE_TESTING |
| Google | ID token verification; browser Google Identity/native support code | Client ID present; consent/authorized origins/live verification UNKNOWN in this audit. |
| SMS/OTP | Twilio provider | none; PROVIDER_NOT_CONFIGURED |
| Email | SMTP invitation/reset/verification adapter | none; PROVIDER_NOT_CONFIGURED |
| Payment gateway | Capabilities explicitly false/manual subscription records | No checkout/webhook integration; NOT_IMPLEMENTED |
| UPI | Static URI/QR, manually confirmed payment recording | Does not require bank provider; auto-confirm NOT_IMPLEMENTED |
| Attachments | Local or private S3 | local selected; production S3 credentials/bucket integration not verified |
| Backup | PostgreSQL archive + encrypted S3 option | none selected; PROVIDER_NOT_CONFIGURED |
| STT/TTS assistant | Voice UI/status and backend rejection | No connected provider; PROVIDER_NOT_CONFIGURED |
| Sale greeting TTS | Browser SpeechSynthesis | Device dependent; WORKING_BUT_NEEDS_MORE_TESTING |
| WhatsApp | wa.me redirects / standard browser share | No Cloud API messaging/webhook/voice integration; automatic messaging NOT_IMPLEMENTED |
| Government GST | Unsupported requirement rejected | No IRN/filing provider; NOT_IMPLEMENTED |
| Notifications | Persisted in-app daily summaries | No push/SMS/email delivery integration; WORKING_BUT_NEEDS_MORE_TESTING |
| Monitoring | JSON production HTTP logging/request IDs, real runtime metrics, health + readiness | External error/uptime/cloud alerting adapter not configured/verified; PARTIAL |
| Print/share | Browser APIs, Capacitor helpers | Browser/device capability-dependent; not universal silent printer integration |

Public health endpoints are `/api/v1/health` and `/api/v1/health/ready`, with status/version and SELECT1 readiness; **not root `/health` unless deployment routes it**. No secrets in those payloads. Production logs use safe route/status/duration/version/request ID; body/password/JWT not intentionally logged. CORS/cookie origins and security headers set in main/browser-session; production frontend/API origins validated. Frontend production source map policy is in Vite config. No new security scanning or dependency vulnerability claim is made here.

## 20. Restrictions that need product/security decisions later

This section records current discrepancies, not instructions to change them now.

1. Implemented entitlements exceed delivered Pro capabilities: ASSISTANT_VOICE and EXPORT_SCHEDULED.
2. DAILY_GALLA/NEED_LIST overrides do not directly gate their APIs; ADVANCED_REPORTS has no distinct active gate. BACKUP cannot be commercially denied by tenant override but still needs provider/rollout/access.
3. Imported rows bypass ordinary direct-request module/measured-mode checks; ordinary item/party services do not centrally repeat these entitlement checks.
4. Modifier sale option-ID detection and generic OUT/wastage classification do not fully enforce the separate optional keys for existing data/new operations.
5. Staff default permissions differ between ERP POS and Retail bill facade; missing permission registry entries make custom least-privilege setup incomplete until seeded/configured.
6. Bill cost response visibility is REPORTS-based rather than PROFIT_REPORTING-based. Some advanced pricing reads similarly require only the broader SALES feature.
7. storage_mb, assistant_queries/voice_queries and companies limits are not commercial limits consistently enforced; users and branches reactivation paths differ from creation checks.
8. Saved legacy subscriptions absent means permissive active compatibility access. Trial default is disabled; no implied automatic free trial for new users.
9. Backup, email/SMS, provider-backed metrics and real assistant voice are unconfigured locally; record exports are not backups. Production restore/selective tenant/PITR adapter absent.
10. Some selected-period summaries/Khata histories and Platform queries are unbounded internally, even where visible lists are paged. Catalog test timings are not production load evidence.
11. Complete offline POS, account-wide automatic scheduled exports, GST government filing, historical financial import, dedicated need conversion, full Balance Sheet/Cash Flow and WhatsApp voice assistant are absent.
12. Legacy ERP capabilities and dead files should not be packaged as mature Retail screens; public brand APNA GALLA and current EVOLIX labels remain mixed.
13. Operational report endpoints have a REPORTS gate and report permissions but do not separately require each reported module's KHATA/PURCHASING/INVENTORY key. This differs from the module-specific direct operations and assistant tools. Historical reporting and new-operation restriction policy should be decided explicitly.
14. Financial diagnosis intents are category insight, so BUSINESS_INSIGHTS/module permission checks do not automatically enforce PROFIT_REPORTING. Direct category-financial assistant questions and paid financial report controllers are separately gated. Saved plan edits/overrides must account for this current difference.

No plans, prices, features, gates, roles, data or workflows were changed to address these findings. The following inventories provide the traceable source-of-truth detail.

## 21. Complete 50-key feature and plan inventory

Every key below has a global Feature record, saved PlanFeature memberships and a possible TenantEntitlement override. Shop-toggle column is the actual catalog core/non-core policy. Commercial YES means assigned by default and also matches this local named-plan snapshot; it is **not** implementation certification. Numeric/provider/role requirements are in the second table. Dedicated capability details are in sections6–18.

| Key | Public catalog name / group | Starter | Smart | Pro | Shop toggle | Default source |
|---|---|---|---|---|---|---|
| RETAIL_POS | Retail POS / Daily Business | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| SALES | Sales / Daily Business | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| KHATA | Khata / Daily Business | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| PURCHASING | Purchases / Daily Business | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| EXPENSES | Expenses / Daily Business | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| DAILY_GALLA | Daily Galla / Daily Business | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| NEED_LIST | Need List / Daily Business | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| INVENTORY | Inventory / Inventory | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| SERVICES | Services / Inventory | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| VARIANTS | Variants / Inventory | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| MULTI_UNIT | Multiple Units / Inventory | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| WEIGHT | Weight Selling / Inventory | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| VOLUME | Volume Selling / Inventory | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| LENGTH | Length Selling / Inventory | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| AREA | Area Selling / Inventory | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| BATCH_TRACKING | Batch & Expiry / Inventory | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| BUNDLES | Bundles / Inventory | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| MODIFIERS | Modifiers / Inventory | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| WASTAGE | Stock Wastage / Inventory | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| MULTIPLE_STOCK_LOCATIONS | Stock Locations / Inventory | NO | NO | YES | Yes; default ON | common/retail-plan-catalog.ts |
| SERIAL_TRACKING | Serial & Warranty / Inventory | NO | NO | YES | Yes; default ON | common/retail-plan-catalog.ts |
| COMPATIBILITY | Compatibility / Inventory | NO | NO | YES | Yes; default ON | common/retail-plan-catalog.ts |
| ACCOUNTING | Accounting / Reports & Money | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| REPORTS | Basic Reports / Reports & Money | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| GST_INVOICES | GST Invoices / Reports & Money | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| PROFIT_REPORTING | Profit & COGS / Reports & Money | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| ADVANCED_REPORTS | Advanced Reports / Reports & Money | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| ADVANCED_PRICING | Advanced Pricing / Reports & Money | NO | NO | YES | Yes; default ON | common/retail-plan-catalog.ts |
| ASSISTANT_TEXT | Text Ask EVOLIX / EVOLIX Assistant | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| BUSINESS_INSIGHTS | Business Insights / EVOLIX Assistant | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| ASSISTANT_VOICE | Voice Ask EVOLIX / EVOLIX Assistant | NO | NO | YES | Yes; default ON | common/retail-plan-catalog.ts |
| STAFF | Staff / Team & Data | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| ADVANCED_STAFF | Advanced Staff Controls / Team & Data | NO | NO | YES | Yes; default ON | common/retail-plan-catalog.ts |
| ITEM_IMAGES | Item Images / Team & Data | NO | YES | YES | Yes; default ON | common/retail-plan-catalog.ts |
| BACKUP | Data Backup / Team & Data | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| EXPORT_ITEMS | Item Master Export / Team & Data | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| EXPORT_STOCK | Stock Export / Team & Data | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| EXPORT_SALES | Sales Export / Team & Data | YES | YES | YES | No (core) | common/retail-plan-catalog.ts |
| EXPORT_CUSTOMERS | Customer Export / Team & Data | NO | YES | YES | No (core) | common/retail-plan-catalog.ts |
| EXPORT_SUPPLIERS | Supplier Export / Team & Data | NO | YES | YES | No (core) | common/retail-plan-catalog.ts |
| EXPORT_KHATA | Khata Export / Team & Data | NO | YES | YES | No (core) | common/retail-plan-catalog.ts |
| EXPORT_PURCHASES | Purchase Export / Team & Data | NO | YES | YES | No (core) | common/retail-plan-catalog.ts |
| EXPORT_EXPENSES | Expense Export / Team & Data | NO | YES | YES | No (core) | common/retail-plan-catalog.ts |
| EXPORT_GST | GST Export / Team & Data | NO | YES | YES | No (core) | common/retail-plan-catalog.ts |
| EXPORT_PROFIT | Profit Export / Team & Data | NO | YES | YES | No (core) | common/retail-plan-catalog.ts |
| EXPORT_STAFF | Staff Export / Team & Data | NO | NO | YES | No (core) | common/retail-plan-catalog.ts |
| EXPORT_LOCATIONS | Stock Location Export / Team & Data | NO | NO | YES | No (core) | common/retail-plan-catalog.ts |
| EXPORT_DOCUMENTS | Document Metadata Export / Team & Data | NO | NO | YES | No (core) | common/retail-plan-catalog.ts |
| EXPORT_FULL_BUSINESS | Complete Business Export / Team & Data | NO | NO | YES | No (core) | common/retail-plan-catalog.ts |
| EXPORT_SCHEDULED | Scheduled Export / Team & Data | NO | NO | YES | No (core) | common/retail-plan-catalog.ts |

### Feature implementation, database and test evidence

Working flag: code-connected unless limited by the listed status; test references identify source coverage only. FE=frontend, BE=backend; “embedded” means item/form/config/report components rather than a dedicated route.

| Key | Description / actual frontend | Backend | Database | Existing tests | Working / implementation status |
|---|---|---|---|---|---|
| RETAIL_POS | Retail billing/payment/receipt; FE Yes/embedded | Billing/Pos: Yes | SalesInvoice,PosHeldBill,Voucher,RequestIdempotency | retail-flow, busy-day-qa, production-readiness | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| SALES | Bill history; legacy quotations/orders/challans/invoices; FE Yes/embedded | Sales/Billing: Yes | SalesInvoice,SalesQuotation,SalesOrder,DeliveryChallan,SalesReturn | sales.spec, module_10/11, retail-flow | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| KHATA | Customers and receivable history/payment; FE Yes/embedded | Retail/Accounting: Yes | Party,BillAllocation,Voucher | retail-flow, general-store-qa | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| PURCHASING | Supplier/stock buying/payments; FE Yes/embedded | Retail/Purchase: Yes | Party,PurchaseInvoice,GoodsReceipt,PurchaseReturn | purchase/module_10, retail-flow | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| EXPENSES | Expenses/owner drawings/categories; FE Yes/embedded | Retail Expenses: Yes | Expense,ExpenseCategory,Voucher | expenses, retail-field-coverage | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| DAILY_GALLA | Counter cash/date/count/history; FE Yes/embedded | Counter: Yes | DailyCashCount,Voucher,VoucherLine | calendar-price-only, costing-profit | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| NEED_LIST | Stock/customer requests; FE Yes/embedded | Retail: Yes | NeedList,Attachment | retail-flow, retail-field-coverage | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| INVENTORY | Item catalog/stock/projection/movements; FE Yes/embedded | Retail/Inventory: Yes | Item,Unit,StockMovement,StockBalanceProjection | inventory.spec, universal-item-flow | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| SERVICES | Nonphysical service sales; FE Yes/embedded | Retail/POS: Yes | Item,SalesInvoiceLine | universal-item-flow, costing-profit | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| VARIANTS | Variant configuration/selection; FE Yes/embedded | ItemComposition/Inventory: Yes | ItemVariant,VariantOptionDefinition | universal-item-flow | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| MULTI_UNIT | Unit conversions for sale/receipt; FE Yes/embedded | ItemComposition/Inventory: Yes | ItemUnitConversion,Unit | universal-item-flow, batch-fefo | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| WEIGHT | Measured weight quantity; FE Yes/embedded | Inventory/POS: Yes | Item,Unit,SalesInvoiceLine | universal-item-flow | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| VOLUME | Measured volume quantity; FE Yes/embedded | Inventory/POS: Yes | Item,Unit,SalesInvoiceLine | universal-item-flow | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| LENGTH | Length/dimensions; FE Yes/embedded | Inventory/POS: Yes | Item,Unit,SalesInvoiceLine | universal-item-flow | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| AREA | Area/dimensions; FE Yes/embedded | Inventory/POS: Yes | Item,Unit,SalesInvoiceLine | universal-item-flow, costing-profit | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| BATCH_TRACKING | Batch/expiry/FEFO; FE Yes/embedded | Inventory/Purchase/POS: Yes | ItemBatch,SalesInvoiceLineBatchAllocation | batch-fefo, universal-item-flow | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| BUNDLES | Kit/set components; FE Yes/embedded | ItemComposition/POS: Yes | ItemBundleComponent | bundle-modifier | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| MODIFIERS | Add-ons/choices; FE Yes/embedded | ItemComposition/POS: Yes | ItemModifierGroup,ItemModifierOption | bundle-modifier | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| WASTAGE | Damage/expiry stock loss; FE Yes/embedded | Inventory: Yes | StockAdjustment,StockMovement,Voucher | costing-profit, inventory specs | Limited; PARTIAL |
| MULTIPLE_STOCK_LOCATIONS | Additional locations/transfers; FE Yes/embedded | TenantAdmin/Inventory: Yes | Godown,Branch,StockTransfer | tenant-administration, universal-item-flow | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| SERIAL_TRACKING | Serial and recorded warranty; FE Yes/embedded | Inventory/Purchase/POS: Yes | ItemSerial,SerialAllocation | universal-item-flow, production-readiness | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| COMPATIBILITY | Item model metadata; FE Yes/embedded | Retail/ItemComposition: Yes | Item.compatibility_tags,custom_attributes | universal-item-flow | Limited; PARTIAL |
| ACCOUNTING | Balanced journals/ledgers/cash; FE Yes/embedded | Accounting: Yes | LedgerAccount,Voucher,VoucherLine,BillAllocation | accounting.spec, module_14..17, costing-profit | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| REPORTS | Operational reports; FE Yes/embedded | Retail Reports: Yes | posted document/allocation/projection sources | retail-flow, costing-profit, import-report | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| GST_INVOICES | Issue saved formal GST document; FE Yes/embedded | Retail GST: Yes | RetailGstInvoice,RetailGstSequence | gst-invoice | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| PROFIT_REPORTING | Known-cost profit/margin/valuation; FE Yes/embedded | Financial Reports: Yes | InventoryCostState,SalesInvoiceLine cost snapshots | costing-profit | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| ADVANCED_REPORTS | Catalog promise; shared detailed reports; FE Yes/embedded | Catalog/Reports: Shared reports, no dedicated feature handler | Feature,PlanFeature only dedicated metadata | subscription-entitlements (catalog) | Limited; PARTIAL |
| ADVANCED_PRICING | Lists/customer rates/schemes; FE Limited integrated selection; no dedicated management route | Pricing: Yes | PriceList,CustomerItemPrice,PromotionScheme,PricingTrace | pricing/module_13 | Unavailable/incomplete; BACKEND_ONLY |
| ASSISTANT_TEXT | Deterministic text questions; FE Yes/embedded | Assistant: Yes | AssistantIntentConfig,Example,Conversation,QueryLog | intent-router, assistant.e2e | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| BUSINESS_INSIGHTS | Deterministic diagnosis/evidence; FE Yes/embedded | Assistant: Yes | report facts,AssistantQueryLog | business-insight.service.spec, assistant.e2e | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| ASSISTANT_VOICE | Voice placeholder/channel rejection; FE Status/mic/upgrade only | Assistant: Rejects unconfigured channel | Feature,PlanFeature;channel metadata | assistant (unconfigured rejection) | Unavailable/incomplete; PROVIDER_NOT_CONFIGURED |
| STAFF | Staff directory/actions; FE Yes/embedded | Tenant Administration: Yes | User,Role,Session | tenant-administration | Limited; PARTIAL |
| ADVANCED_STAFF | Custom role/permission controls; FE Yes/embedded | Tenant Administration: Yes | Role,Permission,RolePermission,UserRole | tenant-administration | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| ITEM_IMAGES | Catalog photos; FE Yes/embedded | Attachments/Retail: Yes | Attachment | attachments, item-configuration | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| BACKUP | Backup availability and request/follow-up; FE Yes/embedded | Platform/Retail Account: Yes | PlatformBackup,RetailDataBackupRequest | platform-backup, s3-backup-store | Unavailable/incomplete; PROVIDER_NOT_CONFIGURED |
| EXPORT_ITEMS | Structured CSV ITEMS; FE Yes/embedded | Retail Account/Exports: Yes | Item,Unit,ItemBarcode | subscription-entitlements, import-report, account-publishing | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_STOCK | Structured CSV STOCK; FE Yes/embedded | Retail Account/Exports: Yes | StockBalanceProjection | subscription-entitlements, import-report, account-publishing | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_SALES | Structured CSV SALES; FE Yes/embedded | Retail Account/Exports: Yes | SalesInvoice,SalesReturn | subscription-entitlements, import-report, account-publishing | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_CUSTOMERS | Structured CSV CUSTOMERS; FE Yes/embedded | Retail Account/Exports: Yes | Party,BillAllocation | subscription-entitlements, import-report, account-publishing | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_SUPPLIERS | Structured CSV SUPPLIERS; FE Yes/embedded | Retail Account/Exports: Yes | Party,BillAllocation | subscription-entitlements, import-report, account-publishing | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_KHATA | Structured CSV KHATA; FE Yes/embedded | Retail Account/Exports: Yes | BillAllocation,Voucher | subscription-entitlements, import-report, account-publishing | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_PURCHASES | Structured CSV PURCHASES; FE Yes/embedded | Retail Account/Exports: Yes | PurchaseInvoice | subscription-entitlements, import-report, account-publishing | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_EXPENSES | Structured CSV EXPENSES; FE Yes/embedded | Retail Account/Exports: Yes | Expense | subscription-entitlements, import-report, account-publishing | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_GST | Structured CSV GST; FE Yes/embedded | Retail Account/Exports: Yes | RetailGstInvoice | subscription-entitlements, import-report, account-publishing | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_PROFIT | Structured CSV PROFIT; FE Yes/embedded | Retail Account/Exports: Yes | saved cost report facts | subscription-entitlements, import-report, account-publishing | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_STAFF | Structured CSV STAFF; FE Yes/embedded | Retail Account/Exports: Yes | User,UserRole | subscription-entitlements, import-report, account-publishing | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_LOCATIONS | Structured CSV LOCATIONS; FE Yes/embedded | Retail Account/Exports: Yes | Godown,Branch | subscription-entitlements, import-report, account-publishing | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_DOCUMENTS | Structured CSV DOCUMENTS; FE Yes/embedded | Retail Account/Exports: Yes | Attachment metadata | subscription-entitlements, import-report, account-publishing | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_FULL_BUSINESS | NDJSON records stream; FE Yes/embedded | Retail Account/Exports: Yes | safe business records (not sessions/secrets/files) | subscription-entitlements, import-report, account-publishing | Connected; WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_SCHEDULED | Unavailable scheduled export; FE Unavailable status | Retail Account/Exports: No exporter | Feature,PlanFeature;no exporter job model | subscription-entitlements, import-report, account-publishing | Unavailable/incomplete; NOT_IMPLEMENTED |

### Feature-specific gates and dependencies

“Override supported” is architecture, not an assertion an override currently exists. Core exports have no shop-off toggle; their plan and RBAC checks still apply.

| Key | Runtime feature gate / default minimum | Tenant override supported | Provider required | Permission / role | Numeric or policy limit | Dependencies | Status |
|---|---|---|---|---|---|---|---|
| RETAIL_POS | RETAIL_POS; STARTER minimum | Yes | — | sales.read/write/return | open FY, branch; item advanced gates | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| SALES | SALES; STARTER minimum | Yes | — | sales.* or Retail inferred | open FY / posting/reversal | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| KHATA | KHATA; STARTER minimum | Yes | — | accounting.read/write | payments cannot exceed due | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| PURCHASING | PURCHASING; STARTER minimum | Yes | — | purchase.* | supplier credit/FY; advanced item gates | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| EXPENSES | EXPENSES; STARTER minimum | Yes | — | accounting.read/write | cash/bank ledger | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| DAILY_GALLA | RETAIL_POS + ACCOUNTING (not DAILY_GALLA); STARTER minimum | Yes | — | accounting.read/write | 10k/day,7 day history | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| NEED_LIST | RETAIL_POS + INVENTORY (not NEED_LIST); STARTER minimum | Yes | image storage for photos | inventory.read/write | one-page UI; no converter | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| INVENTORY | INVENTORY; STARTER minimum | Yes | — | inventory.* | directory100/200; posting rules | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| SERVICES | SERVICES; STARTER minimum | Yes | — | inventory.write/sales.write | unknown cost if absent | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| VARIANTS | VARIANTS; SMART minimum | Yes | — | inventory.write; base operation | no raw variant opening stock | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| MULTI_UNIT | MULTI_UNIT; SMART minimum | Yes | — | inventory.write; base operation | positive scoped factors; used conversion protected | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| WEIGHT | WEIGHT; SMART minimum | Yes | — | base operation permission | decimal quantity/compatible unit | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| VOLUME | VOLUME; SMART minimum | Yes | — | base operation permission | decimal quantity/compatible unit | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| LENGTH | LENGTH; SMART minimum | Yes | — | base operation permission | positive dimensions | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| AREA | AREA; SMART minimum | Yes | — | base operation permission | positive measured dimensions | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| BATCH_TRACKING | BATCH_TRACKING; SMART minimum | Yes | — | base operation permission | expiry strictly before transaction date blocked | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| BUNDLES | BUNDLES; SMART minimum | Yes | — | inventory.write; sale permissions | no cycles/self dependency | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| MODIFIERS | MODIFIERS; SMART minimum | Yes | — | inventory.write; sale permissions | setup gated; existing-sale detection gap | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| WASTAGE | WASTAGE; SMART minimum | Yes | — | inventory.adjust | keyword classification gap | base module/scope/subscription/rollout | PARTIAL |
| MULTIPLE_STOCK_LOCATIONS | MULTIPLE_STOCK_LOCATIONS; PRO minimum | Yes | — | owner/identity.admin; inventory.transfer | stock_locations/branches | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| SERIAL_TRACKING | SERIAL_TRACKING; PRO minimum | Yes | — | base operation permission | integer receipt; unique company serial | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| COMPATIBILITY | COMPATIBILITY; PRO minimum | Yes | — | inventory.write; base operation | embedded metadata UI | base module/scope/subscription/rollout | PARTIAL |
| ACCOUNTING | ACCOUNTING; STARTER minimum | Yes | — | accounting.read/write | exact balanced positive journal/open FY | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| REPORTS | REPORTS; STARTER minimum | Yes | — | reports.read/write | range/query-specific bounds | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| GST_INVOICES | GST_INVOICES; SMART minimum | Yes | no government filing provider | sales.read/write,settings.write | domestic forward charge; immutable issue | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| PROFIT_REPORTING | PROFIT_REPORTING; SMART minimum | Yes | — | reports.read; correction inventory.write | coverage/opening correction restrictions | REPORTS, authoritative saved cost data | WORKING_BUT_NEEDS_MORE_TESTING |
| ADVANCED_REPORTS | No separate key enforcement; actual REPORTS/PROFIT_REPORTING; SMART minimum | Yes | — | report permission per actual endpoint | no independent ADVANCED_REPORTS gate | base module/scope/subscription/rollout | PARTIAL |
| ADVANCED_PRICING | ADVANCED_PRICING; PRO minimum | Yes | — | sales/pricing endpoint permissions | write gate; broader SALES reads | base module/scope/subscription/rollout | BACKEND_ONLY |
| ASSISTANT_TEXT | ASSISTANT_TEXT; STARTER minimum | Yes | none; no LLM | intent-specific permissions | 400 chars;180/min;15 min session | RETAIL_POS + ASSISTANT_TEXT + per-intent module/report | WORKING_BUT_NEEDS_MORE_TESTING |
| BUSINESS_INSIGHTS | BUSINESS_INSIGHTS; SMART minimum | Yes | none; no LLM | intent/report permissions | sample/coverage;bounded dimensions | RETAIL_POS + ASSISTANT_TEXT + per-intent module/report | WORKING_BUT_NEEDS_MORE_TESTING |
| ASSISTANT_VOICE | ASSISTANT_VOICE; PRO minimum | Yes | STT/TTS not configured | intent-specific permissions | voice_queries stored but unmetered | RETAIL_POS + ASSISTANT_TEXT + per-intent module/report | PROVIDER_NOT_CONFIGURED |
| STAFF | STAFF; SMART minimum | Yes | email only for invitations | owner/identity.admin | staff/users; default permission gap | base module/scope/subscription/rollout | PARTIAL |
| ADVANCED_STAFF | ADVANCED_STAFF; PRO minimum | Yes | — | owner/identity.admin | protected roles/last owner | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| ITEM_IMAGES | ITEM_IMAGES; SMART minimum | Yes | local/S3 storage | documents.* plus item permission | 5 MiB/20 MP/company quota | base module/scope/subscription/rollout | WORKING_BUT_NEEDS_MORE_TESTING |
| BACKUP | Always plan-entitled by resolver; access/rollout/provider still required; STARTER minimum | Stored yes; commercial deny ignored | pg_dump/pg_restore + encrypted S3 | owner request; SUPER_ADMIN archive | offsite retention; no selective/PITR restore | base module/scope/subscription/rollout | PROVIDER_NOT_CONFIGURED |
| EXPORT_ITEMS | EXPORT_ITEMS; STARTER minimum | Yes | browser download | export-specific permission; full owner | 500/1000page; full500chunk; no file bytes | source read permission; export feature; PROFIT additionally PROFIT_REPORTING | WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_STOCK | EXPORT_STOCK; STARTER minimum | Yes | browser download | export-specific permission; full owner | 500/1000page; full500chunk; no file bytes | source read permission; export feature; PROFIT additionally PROFIT_REPORTING | WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_SALES | EXPORT_SALES; STARTER minimum | Yes | browser download | export-specific permission; full owner | 500/1000page; full500chunk; no file bytes | source read permission; export feature; PROFIT additionally PROFIT_REPORTING | WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_CUSTOMERS | EXPORT_CUSTOMERS; SMART minimum | Yes | browser download | export-specific permission; full owner | 500/1000page; full500chunk; no file bytes | source read permission; export feature; PROFIT additionally PROFIT_REPORTING | WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_SUPPLIERS | EXPORT_SUPPLIERS; SMART minimum | Yes | browser download | export-specific permission; full owner | 500/1000page; full500chunk; no file bytes | source read permission; export feature; PROFIT additionally PROFIT_REPORTING | WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_KHATA | EXPORT_KHATA; SMART minimum | Yes | browser download | export-specific permission; full owner | 500/1000page; full500chunk; no file bytes | source read permission; export feature; PROFIT additionally PROFIT_REPORTING | WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_PURCHASES | EXPORT_PURCHASES; SMART minimum | Yes | browser download | export-specific permission; full owner | 500/1000page; full500chunk; no file bytes | source read permission; export feature; PROFIT additionally PROFIT_REPORTING | WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_EXPENSES | EXPORT_EXPENSES; SMART minimum | Yes | browser download | export-specific permission; full owner | 500/1000page; full500chunk; no file bytes | source read permission; export feature; PROFIT additionally PROFIT_REPORTING | WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_GST | EXPORT_GST; SMART minimum | Yes | browser download | export-specific permission; full owner | 500/1000page; full500chunk; no file bytes | source read permission; export feature; PROFIT additionally PROFIT_REPORTING | WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_PROFIT | EXPORT_PROFIT; SMART minimum | Yes | browser download | export-specific permission; full owner | 500/1000page; full500chunk; no file bytes | source read permission; export feature; PROFIT additionally PROFIT_REPORTING | WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_STAFF | EXPORT_STAFF; PRO minimum | Yes | browser download | export-specific permission; full owner | 500/1000page; full500chunk; no file bytes | source read permission; export feature; PROFIT additionally PROFIT_REPORTING | WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_LOCATIONS | EXPORT_LOCATIONS; PRO minimum | Yes | browser download | export-specific permission; full owner | 500/1000page; full500chunk; no file bytes | source read permission; export feature; PROFIT additionally PROFIT_REPORTING | WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_DOCUMENTS | EXPORT_DOCUMENTS; PRO minimum | Yes | browser download | export-specific permission; full owner | 500/1000page; full500chunk; no file bytes | source read permission; export feature; PROFIT additionally PROFIT_REPORTING | WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_FULL_BUSINESS | EXPORT_FULL_BUSINESS; PRO minimum | Yes | browser download | export-specific permission; full owner | 500/1000page; full500chunk; no file bytes | source read permission; export feature; PROFIT additionally PROFIT_REPORTING | WORKING_BUT_NEEDS_MORE_TESTING |
| EXPORT_SCHEDULED | EXPORT_SCHEDULED; PRO minimum | Yes | missing scheduler | export-specific permission; full owner | 500/1000page; full500chunk; no file bytes | source read permission; export feature; PROFIT additionally PROFIT_REPORTING | NOT_IMPLEMENTED |

### Noncatalog key and toggles

`RETURNS_CLAIMS` is required by active ClaimsController but absent from the 50 catalog keys and current DB Feature records. Named plans do not grant it; claims endpoints are therefore not usable through these plans without creating/configuring the key. It is not the Retail bill-return feature (which uses base billing). Claims capability status LEGACY / BACKEND_ONLY; access gap PARTIAL. `barcode_scanning_enabled`, invoice/UPI/greeting/report notification/local appearance preferences are settings, not additional commercial feature keys. RetailCapabilitySettings legacy flags are not consumed by active entitlement resolution; they remain schema/provisioning artifacts, not a second valid grant source.


## 22. Complete active frontend route inventory

Source `frontend/src/App.tsx`; **122 explicit/expanded route patterns**, including shells, aliases, dynamic sections, public pages and wildcards; index redirects are described separately. Dynamic financial kinds are enumerated in section15. All API suffixes below resolve under `/api/v1` unless a full prefix is shown. Screens also call adapters/components: direct API calls in the page are not the entire workflow.

Every Retail row requires authenticated non-platform user and completed READY onboarding through the shell, before additional listed gates. The shell itself has no universal paid-plan redirect. Backend data can be denied even when route mounts. Every Platform row requires platform frontend guard plus server persisted SUPER_ADMIN/session/MFA. Root master routes add MasterAdminGuard; frontend role hiding never replaces backend checks.


### Public/authentication routes

| Route | Screen / purpose | Feature and current plan gate | Role restriction | Shop toggle | Provider dependency | Backend/API | Implementation status |
|---|---|---|---|---|---|---|---|
| /login | AccountAccess: Google/mobile/password entry | No paid plan | Public | — | Google/SMS (OTP not configured) | GET auth/capabilities; POST auth/google/challenge,login; auth/account/otp/request,verify | PARTIAL |
| /signup | AccountAccess signup: New verified identity + terms/referral | signup_enabled/account policy | Public | — | Google/SMS | auth/google/signup-challenge,signup; auth/account/otp/request,verify | PARTIAL |
| /password-login | Login: Password login with Google alternative | No paid plan | Public | — | Google optional | POST auth/login; POST auth/google/challenge,login | WORKING_BUT_NEEDS_MORE_TESTING |
| /onboarding | Onboarding: Combined business profile/plan/migration/access pending | Saved selected plan, trial policy | Authenticated own account | — | Google identity;manual activation | GET auth/account/onboarding;POST onboarding/profile,plan,migration | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/login | Login platform: Platform password+MFA challenge/enrollment | No Retail plan | SUPER_ADMIN identity after login | — | authenticator app/MFA key | POST platform/auth/login,mfa/verify | WORKING_BUT_NEEDS_MORE_TESTING |
| /forgot-password | ForgotPassword: Request reset link | No paid plan | Public | — | SMTP none | POST auth/password/forgot | PROVIDER_NOT_CONFIGURED |
| /reset-password | ResetPassword: Consume one-use token/set password | No paid plan | valid one-use token | — | SMTP delivery required to obtain link | POST auth/password/reset | PROVIDER_NOT_CONFIGURED |
| /verify-email | VerifyEmail: Verify token-bound recovery email | No paid plan | valid one-use token | — | SMTP none | POST auth/email/verify | PROVIDER_NOT_CONFIGURED |
| /change-password | ChangePassword: Own forced/current password change | No paid plan | Authenticated current user/password | — | — | POST auth/password/change | WORKING_BUT_NEEDS_MORE_TESTING |
| /privacy | PublicPage privacy: Published legal/support/developer information; delete-account request guidance | Public content; authenticated privacy request separate | Public read; owner account request | APP_PUBLISHING metadata | operator legal/support details | GET public/app-information; DELETE_ACCOUNT request POST retail/account/privacy-requests | PARTIAL |
| /terms | PublicPage terms: Published legal/support/developer information; delete-account request guidance | Public content; authenticated privacy request separate | Public read; owner account request | APP_PUBLISHING metadata | operator legal/support details | GET public/app-information; DELETE_ACCOUNT request POST retail/account/privacy-requests | PARTIAL |
| /support | PublicPage support: Published legal/support/developer information; delete-account request guidance | Public content; authenticated privacy request separate | Public read; owner account request | APP_PUBLISHING metadata | operator legal/support details | GET public/app-information; DELETE_ACCOUNT request POST retail/account/privacy-requests | PARTIAL |
| /delete-account | PublicPage delete-account: Published legal/support/developer information; delete-account request guidance | Public content; authenticated privacy request separate | Public read; owner account request | APP_PUBLISHING metadata | operator legal/support details | GET public/app-information; DELETE_ACCOUNT request POST retail/account/privacy-requests | PARTIAL |
| /about | PublicPage about: Published legal/support/developer information; delete-account request guidance | Public content; authenticated privacy request separate | Public read; owner account request | APP_PUBLISHING metadata | operator legal/support details | GET public/app-information; DELETE_ACCOUNT request POST retail/account/privacy-requests | PARTIAL |

### Retail routes

| Route | Screen / purpose | Feature and current plan gate | Role restriction | Shop toggle | Provider dependency | Backend/API | Implementation status |
|---|---|---|---|---|---|---|---|
| /retail | RetailShell: Route shell; index redirects to /retail/home | Login/onboarding or platform guard as applicable | scope shell guard | destination-specific | — | No independent shell endpoint | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/home | RetailHome: Business/tender/due summaries, quick actions, calendar links | UI summaries conditional; API RETAIL_POS+REPORTS; profit REPORTS+PROFIT_REPORTING | reports.read for data | PROFIT_REPORTING for paid card | — | GET retail/reports/dashboard; financial/summary; calendar; report inbox | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/calendar | RetailCalendar: Visits, receivables, payables and tasks | RETAIL_POS; per-action module/permissions | sales/purchase/settings permissions by action | — | static2026 holidays only | GET retail/calendar; POST/PATCH calendar/tasks; PATCH receivables/:id | PARTIAL |
| /retail/gst | RetailGst: Business GST setup and issued invoices | Read RETAIL_POS; save/issue GST_INVOICES Smart+ | sales.read; settings.write/save | GST_INVOICES | government filing absent | GET/PUT retail/gst/profile; GET retail/gst/bills | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/gst/bills/:id | RetailGstBill: Preview/issue/print saved GST invoice | GST_INVOICES Smart+ for preview/issue; history base | sales.read/write | GST_INVOICES | browser print | GET retail/gst/bills/:id; POST :id/preview and :id/issue | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/assistant | RetailAssistant: Ask deterministic questions/clarifications | RETAIL_POS+ASSISTANT_TEXT, module+insight/profit extras | per-intent permissions | BUSINESS_INSIGHTS; advanced module keys | voice unavailable; no LLM | POST assistant/query | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/stock | RetailItems: Items/Inventory/Low Stock tab catalog; import/export/actions | RETAIL_POS+INVENTORY; export-specific keys | inventory.read/write | advanced item flags; barcode preference | images local/S3 | GET retail/items; DELETE/POST retail/items/:id; account/exports/ITEMS or STOCK | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/more/voice | RetailVoiceSettings: Custom sale thank-you greeting | RETAIL_POS; no ASSISTANT_VOICE requirement | sales.read/settings.write | greeting enabled (not commercial Voice) | browser SpeechSynthesis | GET/POST retail/checkout-voice | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/more/import | RetailImport: Migration templates,preview/map/commit/history | RETAIL_POS; no IMPORT key; per-row gate gap | owner only | not an import commercial toggle | no vendor online connector | GET retail/imports/presets and imports; POST preview/:id/commit; GET :id | PARTIAL |
| /retail/more/referrals | RetailReferrals: Owner referral code/history/campaign status | No RequireFeature on owner summary | identity.admin / owner | Platform campaign.enabled | no automatic cash payout | GET retail/referrals | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/galla | RetailGalla: Date/opening/counter reconciliation/history | RETAIL_POS+ACCOUNTING actual (not DAILY_GALLA) | accounting.read/write | core/accounting | — | GET retail/galla,history; POST retail/galla/count | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/more/payments | RetailUpiSettings: Receiving UPI primary profile/shop QR/invoice switch | RETAIL_POS all plans | sales.read/settings.write | show_upi_qr_on_invoice | QR browser; no bank verification | GET/POST retail/payments/upi; GET retail/payments/upi/qr | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/more/security | Security: Login-method and password/account security | Account lifecycle, no paid feature gate | own authenticated user | — | Google configured ID; SMTP/SMS optional | GET auth/security,capabilities; POST auth/google/link,unlink; account/password/create; email/request-verification | PARTIAL |
| /retail/more/settings | RetailSettings: Device appearance/language/barcode/greeting/module links | No paid settings key; module links independently gated | owner for barcode; self appearance | barcode false; local theme/language/text | browser storage | GET/POST retail/account/billing-preferences | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/more/invoice | RetailSettings: Browser print help and UPI invoice switch link; no full template editor | No paid page key; GST formal separately Smart+ | signed-in; UPI settings action permission | UPI invoice preference | browser print, no Bluetooth pairing | Links to bills and payments/upi | PARTIAL |
| /retail/more/devices | RetailDevices: Logged-in device/session revoke | No paid feature key; master owner guard | owner/identity.admin through sessions API | — | — | GET sessions; POST sessions/:id/revoke | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/more/locations | RetailStockLocations: Location list/add; transfer links | Additional operations MULTIPLE_STOCK_LOCATIONS Pro | owner/identity.admin; transfer permission | MULTIPLE_STOCK_LOCATIONS | — | GET/POST godowns; GET branches,retail/account; inventory/transfers | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/more/staff | RetailStaff: Staff directory/edit/archive/access/role management | STAFF Smart+; ADVANCED_STAFF Pro custom roles | owner/identity.admin | STAFF,ADVANCED_STAFF | SMTP only invitations | users/roles/permissions/sessions via StaffManager | PARTIAL |
| /retail/more/documents | RetailDocuments: Attachment metadata/search/view/download | No independent documents read feature; item upload ITEM_IMAGES | documents.read/write; entity ownership | ITEM_IMAGES only photo create | local/S3 authenticated content | GET attachments; GET :id/content; DELETE :id | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/more/help | RetailHelp: Help/support and legal links | No commercial gate | signed-in shell only | — | public support placeholders | GET public/app-information via public pages | PARTIAL |
| /retail/more/cash-bank | Navigate: Redirect to Retail Home/Galla | Parent guard | Parent scope | — | — | No separate endpoint | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/bill | RetailNewBill: Select customer/items/unit/configure and hold/checkout | RETAIL_POS; catalog INVENTORY; line feature gates on writes | sales.write; inventory.read | advanced item keys; barcode preference | QR/payment manual | GET retail/items,:id/options; POST bills/quote,hold; account | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/bills | RetailBillHistory: Search/paged invoice list | RETAIL_POS core historical reads | sales.read | — | — | GET retail/bills | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/bills/:id | RetailBillDetail: Saved lines/payment/return/refund/due/WhatsApp | RETAIL_POS; action permissions | sales.read; sales.return; promise sales.write | invoice QR setting | browser WhatsApp/share | GET retail/bills/:id; PATCH calendar/receivables/:id | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/bills/:id/print | RetailThermalReceipt: Print saved receipt | RETAIL_POS | sales.read | invoice QR preference | browser/native print | GET retail/bills/:id; UPI profile | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/bills/:id/return | RetailReturn: Selected/full/partial original return | RETAIL_POS base recovery; source scope | sales.return | recovery skips new advanced additions | — | GET retail/bills/:id; POST retail/bills/return | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/bills/held | RetailHeldBills: List and resume own held bill | RETAIL_POS | sales.read/write | — | — | GET retail/bills/hold; POST bills/hold/:id/resume | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/payment | RetailPayment: Cash/UPI/Card/Bank/Udhar/split+credit checkout | RETAIL_POS + current item capability checks | sales.write; customer credit policy | item keys; UPI profile | QR not auto-confirmed | POST retail/bills/quote and bills; GET payments/upi/qr | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/sale-complete | RetailSaleComplete: Confirmed receipt/change/new bill/share/voice | RETAIL_POS underlying data | sales.read | greeting/invoice QR | SpeechSynthesis/share/print | GET bill/:id, checkout-voice,payments/upi | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/items | RetailItems: Items/Inventory/Low Stock tab catalog; import/export/actions | RETAIL_POS+INVENTORY; export-specific keys | inventory.read/write | advanced item flags; barcode preference | images local/S3 | GET retail/items; DELETE/POST retail/items/:id; account/exports/ITEMS or STOCK | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/items/add | RetailAddItem: Catalog product/service/photos/opening stock | RETAIL_POS+INVENTORY+selected item flags | inventory.write; upload documents.write | item feature toggles; ITEM_IMAGES | image storage if photo | GET units/categories; POST retail/items; POST attachments | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/items/:id | RetailItemDetail: Details/edit/archive/unit/variant/bundle/modifier setup | RETAIL_POS+INVENTORY; composition specific flags | inventory.read/write | advanced item keys | image storage | GET items/:id/options,composition; POST/DELETE items/:id; PUT bundle/modifiers; POST variants/unit-conversions | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/customers/add | RetailAddCustomer: New customer/contact/credit/opening due | RETAIL_POS+KHATA | accounting.write | core KHATA | — | POST retail/customers | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/khata | RetailKhata: Search customer dues and New Bill/Receive | RETAIL_POS+KHATA | accounting.read | core KHATA | WhatsApp browser | GET retail/customers | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/khata/:id | RetailKhataDetail: Customer history/balance/edit/receive/bill preselect | RETAIL_POS+KHATA | accounting.read/write | core KHATA | WhatsApp and receiving UPI QR | GET customers/:id/khata; PATCH/DELETE customers/:id; payment/UPI | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/receive-payment | RetailReceivePayment: Partial/full customer collection | RETAIL_POS+KHATA | accounting.write | UPI profile/manual confirmation | QR/storage proof | POST customers/:id/payments; POST attachments | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/pay-supplier | RetailPaySupplier: Partial/full supplier payment | RETAIL_POS+PURCHASING | purchase.write | — | proof image storage; no receiving shop QR | POST suppliers/:id/payments; POST attachments | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/quick-sale | RetailAmountSale: Quick cash/noncash or Udhar amount sale | RETAIL_POS; customer lookup KHATA when used | sales.write | — | manual receipt/voice/QR | POST retail/bills/amount-sale; customers lookup | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/udhar | RetailAmountSale: Quick cash/noncash or Udhar amount sale | RETAIL_POS; customer lookup KHATA when used | sales.write | — | manual receipt/voice/QR | POST retail/bills/amount-sale; customers lookup | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/more | RetailMore: Account/tools menu route; drawer is main discovery | Per-destination gates, no independent paid gate | signed-in | per module | — | POST auth/logout; destinations | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/needs | RetailNeeds: Create/edit/status/filter stock requests | RETAIL_POS+INVENTORY (not NEED_LIST) | inventory.read/write | — | photo storage optional | GET/POST needs; PATCH :id; POST :id/status; attachments | PARTIAL |
| /retail/suppliers | RetailSuppliers: Search/add/edit suppliers | RETAIL_POS+PURCHASING | purchase.read/write | core PURCHASING | — | GET/POST suppliers; PATCH/DELETE :id | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/suppliers/:id | RetailSupplierKhata: Supplier balance/statement/pay/visit details | RETAIL_POS+PURCHASING | purchase.read/write | — | share browser | GET suppliers/:id/khata; PATCH :id | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/suppliers/:id/pay | RetailPaySupplier: Partial/full supplier payment | RETAIL_POS+PURCHASING | purchase.write | — | proof image storage; no receiving shop QR | POST suppliers/:id/payments; POST attachments | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/purchases | RetailPurchases: Purchase/create/history/search/payment links | RETAIL_POS+PURCHASING | purchase.read/write | line features separately | image storage | GET retail/purchases | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/purchases/new | RetailAddPurchase: Stock/itemized or quick purchase/cash-credit-partial | RETAIL_POS+PURCHASING+item capabilities | purchase.write | unit/variant/batch/serial/location | photo storage | POST retail/purchases; items/options/supplier; attachments | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/expenses | RetailExpenses: Business/owner history/edit/cancel/search | RETAIL_POS+EXPENSES | accounting.read/write | — | photo storage | GET retail/expenses,summary; PATCH :id; DELETE :id (audited cancellation) | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/expenses/add | RetailAddExpense: Business expense/owner withdrawal/category/photo | RETAIL_POS+EXPENSES | accounting.write | — | photo storage | POST expenses; expense-categories/initialize-defaults; attachments | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/reports | RetailReports: Report cards,period summary,quick questions,notifications | RETAIL_POS+REPORTS; financial extras | reports.read | PROFIT_REPORTING for financial discovery | in-app scheduler only | reports/dashboard; reports/assistant/query,preferences,notifications | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/reports/sales | RetailSalesReport: Filtered/paged sales report | RETAIL_POS+REPORTS; EXPORT_SALES Starter for CSV | reports.read | core REPORTS | browser CSV download | GET retail/reports/sales; account/exports/:kind | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/reports/financial/:kind | RetailFinancialReport: 14 financial kinds plus unknown-sales/filter/cost correction | REPORTS+PROFIT_REPORTING Smart+; EXPORT_PROFIT for CSV | reports.read; correction inventory.write | PROFIT_REPORTING | browser CSV | GET financial/summary,:group,valuation,coverage,filters; POST missing-cost | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/reports/purchases | RetailPurchaseReport: Filtered/paged purchases report | RETAIL_POS+REPORTS; EXPORT_PURCHASES Smart for CSV | reports.read | core REPORTS | browser CSV download | GET retail/reports/purchases; account/exports/:kind | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/reports/expenses | RetailExpenseReport: Filtered/paged expenses report | RETAIL_POS+REPORTS; EXPORT_EXPENSES Smart for CSV | reports.read | core REPORTS | browser CSV download | GET retail/reports/expenses; account/exports/:kind | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/reports/stock | RetailStockReport: Filtered/paged stock report | RETAIL_POS+REPORTS; EXPORT_STOCK Starter for CSV | reports.read | core REPORTS | browser CSV download | GET retail/reports/stock; account/exports/:kind | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/reports/customers | RetailCustomerDueReport: Filtered/paged customers/due report | RETAIL_POS+REPORTS; EXPORT_CUSTOMERS Smart for CSV | reports.read | core REPORTS | browser CSV download | GET retail/reports/customers/due; account/exports/:kind | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/reports/suppliers | RetailSupplierDueReport: Filtered/paged suppliers/due report | RETAIL_POS+REPORTS; EXPORT_SUPPLIERS Smart for CSV | reports.read | core REPORTS | browser CSV download | GET retail/reports/suppliers/due; account/exports/:kind | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/reports/returns | RetailReturnsReport: Filtered/paged returns report | RETAIL_POS+REPORTS; EXPORT_SALES Starter for CSV | reports.read | core REPORTS | browser CSV download | GET retail/reports/returns; account/exports/:kind | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/more/* | div: Not-found view with Home/More link | Parent guard | Parent scope | — | — | No separate endpoint | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/* | div: Not-found view with Home/More link | Parent guard | Parent scope | — | — | No separate endpoint | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/more/business | RetailAccount business: Read business/branch/FY details and location link | Account lifecycle; no paid page gate | Authenticated account; owner changes/exports | — | — | GET retail/account | PARTIAL |
| /retail/more/profile | RetailAccount profile: Own details/security/export links | Account lifecycle; no paid page gate | Authenticated account; owner changes/exports | — | — | GET retail/account | PARTIAL |
| /retail/more/subscription | RetailSubscription: Current status/plans/manual billing history/plan-change guidance | Account lifecycle; no paid page gate | Authenticated account; owner changes/exports | — | gateway unavailable;manual activation | GET retail/account/subscription | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/more/features | RetailShopFeatures: Effective plan+override+rollout features and owner toggles | Current resolved flags; toggle non-core entitled keys only | Authenticated account; owner changes/exports | Non-core defaults ON | — | GET account/subscription,entitlements;POST account/features/:code | WORKING_BUT_NEEDS_MORE_TESTING |
| /retail/more/backup | RetailAccount/BackupStatus/RetailDataExports: Real provider status;CSV/NDJSON/portability requests;support follow-up | BACKUP resolver special; export-specific feature;portability exception | Authenticated account; owner changes/exports | exports core/no off toggle | offsite backup none; records export independent | GET account;exports/:kind;export;POST backup-requests,privacy-requests | PARTIAL |

### Platform routes

| Route | Screen / purpose | Feature and current plan gate | Role restriction | Shop toggle | Provider dependency | Backend/API | Implementation status |
|---|---|---|---|---|---|---|---|
| /platform | PlatformShell: Route shell; index redirects to /platform/dashboard | Login/onboarding or platform guard as applicable | scope shell guard | destination-specific | — | No independent shell endpoint | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/dashboard | PlatformDashboard: SaaS financial/tenant/user/system summary | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | — | /platform/admin/dashboard | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/tenants | PlatformTenants: Find/provision/filter pending tenants | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | SMTP for invitations | /platform/admin/tenants | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/tenants/:id | PlatformTenantDetail: Details/approve access/plan/overrides/limits/users/lifecycle | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | SMTP reset-link optional | /platform/admin/tenants/:id; actions; metadata; users; archive/restore/delete | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/plans | PlatformPlans: Saved prices/features/limits editor | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | — | /platform/admin/plans | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/features | PlatformFeatures: Global on/off/beta/percentage rollout editor | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | — | /platform/admin/features | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/payments | PlatformPayments: Manual payments/revenue/pending/refunds | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | gateway absent | /platform/admin/payments; :id/refund | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/subscriptions | PlatformPayments: Manual payments/revenue/pending/refunds (alias of payments, no separate screen) | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | gateway absent | /platform/admin/payments; :id/refund | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/account-policy | PlatformAccountPolicy: Trial/signup/delete-retention policy | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | — | /platform/admin/account-policy | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/referrals | PlatformReferrals: Campaign/attribution qualification/review rewards | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | no automatic reward payout | /platform/admin/referrals;referral-campaigns;review | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/deletion-jobs | PlatformDeletionJobs: Storage erasure job/retry | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | storage cleanup provider | /platform/admin/deletion-jobs | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/revenue | PlatformPayments: Manual payments/revenue/pending/refunds (alias of payments, no separate screen) | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | gateway absent | /platform/admin/payments; :id/refund | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/expenses | PlatformExpenses: Real SaaS expense records | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | — | /platform/admin/expenses | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/audit | PlatformAudit: Paginated/bounded recorded admin actions | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | — | /platform/admin/audit | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/infrastructure | PlatformInfrastructure: Real DB/process health plus unavailable cloud metrics | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | cloud provider metrics absent | /platform/admin/infrastructure | PARTIAL |
| /platform/database | PlatformInfrastructure: Real DB/process health plus unavailable cloud metrics (alias of infrastructure) | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | cloud provider metrics absent | /platform/admin/infrastructure | PARTIAL |
| /platform/health | PlatformInfrastructure: Real DB/process health plus unavailable cloud metrics (alias of infrastructure) | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | cloud provider metrics absent | /platform/admin/infrastructure | PARTIAL |
| /platform/backups | PlatformBackups: Archive/create/verify/disposable restore status | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | pg tools/encrypted offsite S3 | /platform/admin/backups;verify;restore | PROVIDER_NOT_CONFIGURED |
| /platform/users | PlatformUsers: Tenant/platform user list/actions/password controls | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | SMTP for reset links | /platform/admin/users;tenants/:id/users/:userId/credentials | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/sessions | PlatformSessions: Sessions/device revoke/force logout | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | — | /platform/admin/sessions;tenant actions | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/devices | PlatformSessions: Sessions/device revoke/force logout (alias of sessions) | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | — | /platform/admin/sessions;tenant actions | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/settings | PlatformSettings: Maintenance/banner/signup/announcement policy | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | — | /platform/admin/settings;announcements | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/publishing | PlatformPublishing: Public developer/support/legal/domain/store placeholders | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | operator supplied metadata | /platform/admin/publishing | PARTIAL |
| /platform/support | PlatformSupport: Explicit support access/session scope | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | — | /platform/admin/support;support/:id/records;support_start/end actions | PARTIAL |
| /platform/alerts | PlatformAlerts: Expiry/status/backup follow-up alerts | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | no external alert delivery | /platform/admin/alerts;backup-requests/:id/followup | WORKING_BUT_NEEDS_MORE_TESTING |
| /platform/assistant | PlatformAssistant: Catalog intents/aliases/unknown mapping/analytics | No Retail plan; Platform authorization | persisted SUPER_ADMIN + session/MFA | global/per-tenant controls edited here | no LLM/voice provider | /platform/admin/platform/assistant/* | WORKING_BUT_NEEDS_MORE_TESTING |

### Tenant master and fallback routes

| Route | Screen / purpose | Feature and current plan gate | Role restriction | Shop toggle | Provider dependency | Backend/API | Implementation status |
|---|---|---|---|---|---|---|---|
| / | TenantShell: Route shell; index redirects to /retail/home | Login/onboarding or platform guard as applicable | scope shell guard | destination-specific | — | No independent shell endpoint | WORKING_BUT_NEEDS_MORE_TESTING |
| /users | Users: User directory/actions/password/role/session | STAFF for create; ADVANCED_STAFF for assigned roles | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | users | PARTIAL |
| /roles | Roles: Custom roles and permission assignment | ADVANCED_STAFF Pro new/custom mutations | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | roles; permissions | PARTIAL |
| /sessions | Sessions: Session listing/revoke | No paid key | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | sessions | WORKING_BUT_NEEDS_MORE_TESTING |
| /organizations | Organizations: Own organization metadata | No paid key | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | organizations | WORKING_BUT_NEEDS_MORE_TESTING |
| /companies | Companies: Companies create/edit/status | companies limit read but undefined in named plans | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | companies | WORKING_BUT_NEEDS_MORE_TESTING |
| /branches | Branches: Store create/edit/status | MULTIPLE_STOCK_LOCATIONS new store + numeric branches | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | branches | WORKING_BUT_NEEDS_MORE_TESTING |
| /godowns | Godowns: Location create/edit/status | MULTIPLE_STOCK_LOCATIONS additional location | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | godowns | WORKING_BUT_NEEDS_MORE_TESTING |
| /financial-years | FinancialYears: Company FY create/activate/close | No dedicated paid key; no overlaps/open posting policy | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | financial-years | WORKING_BUT_NEEDS_MORE_TESTING |
| /inventory/stock | StockSummary: Authoritative stock list | INVENTORY | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | inventory/stock | WORKING_BUT_NEEDS_MORE_TESTING |
| /inventory/movements | StockMovements: Stock movement ledger | INVENTORY | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | inventory/movements | WORKING_BUT_NEEDS_MORE_TESTING |
| /inventory/adjustments | StockAdjustments: Adjustment form/draft | INVENTORY, WASTAGE when keyword classified | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | inventory/adjustments | PARTIAL |
| /inventory/transfers | StockTransfers: Transfer form/draft | INVENTORY+MULTIPLE_STOCK_LOCATIONS write | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | inventory/transfers | PARTIAL |
| /inventory/barcodes | BarcodeLabels: Legacy barcode/label UI | INVENTORY backend; current API URL/context drift | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | barcodes/*; purchase/receipts | LEGACY |
| /accounting/accounts | ChartOfAccounts: Chart/account records | ACCOUNTING | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | accounting/accounts | WORKING_BUT_NEEDS_MORE_TESTING |
| /accounting/ledger/:id | Ledger: Selected account ledger/balance | ACCOUNTING | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | accounting/ledger/:id; accounts/:id/balance | WORKING_BUT_NEEDS_MORE_TESTING |
| /accounting/banks | BankAccounts: Bank account listing | ACCOUNTING | frontend master owner/identity.admin; backend explicit module/admin permission | advanced feature when applicable | — | banking/accounts | WORKING_BUT_NEEDS_MORE_TESTING |
| /* | Navigate: Redirect to Retail Home/Galla | Parent guard | Parent scope | — | — | No separate endpoint | WORKING_BUT_NEEDS_MORE_TESTING |

### Route presence and intentionally absent Platform modules

All listed Platform route screens exist, subject to their implementation/provider status. Tenant Detail embeds trials/plan changes/feature overrides/limits/credential and access-approval controls; no separate /platform/trials or /platform/limits route. /platform/subscriptions and /platform/revenue are aliases of payments; /platform/database and /platform/health aliases of infrastructure; /platform/devices aliases sessions. No active /platform/imports route or dedicated Platform data-import manager: NOT_IMPLEMENTED. Tenant imports are Retail owner workflows. No standalone Retail customers list route; Khata presents it. No separate /retail/low-stock route; Stock/Items tabs implement it. No separate dedicated exports route; Backup/Account/report actions expose it. Root wildcard redirects Home; Retail wildcard renders not found. Index /retail and root redirect /retail/home; /platform redirects dashboard.

### Frontend completeness limits

Business/profile sections are primarily read-only summaries/security links, not full profile/business editors; root master and Platform metadata editors exist separately. Printer & Invoice screen offers print guidance and UPI setting navigation, no native Bluetooth pairing/template designer. The old master BarcodeLabels uses full /api/v1 URLs with an API client already based at /api/v1 and reads absent activeCompanyId auth-store property; it is LEGACY and not certified usable. Retail barcode entry has a different, current facade/preference. Cart is in-memory Zustand; persistent auth data holds cookie marker/CSRF/user/context, and pending-write storage holds hashed fingerprints/idempotency keys, not a full offline journal. Missing complete localization and real-provider flows remain PARTIAL.


## 23. Current local database configuration snapshot

Read on the configured local PostgreSQL connection inside a read-only transaction; no server/seed started. This is **local state, not production state**. Tenant numbers/IDs are included for configuration traceability; owner emails, names, phones, passwords, tokens and UPI IDs are deliberately excluded.

### All saved plans (including legacy/test plans)

| Plan key | Name | Active | Monthly INR | Saved feature count | Saved limits |
|---|---|---|---:|---:|---|
| BROWSER_1791302243571 | Browser Retail 1791302243571 | true | 999 | 1 | {"users":5,"devices":5,"branches":1,"storage_mb":100} |
| BROWSER_1791302501639 | Browser Retail 1791302501639 | true | 999 | 1 | {"users":5,"devices":5,"branches":1,"storage_mb":100} |
| BROWSER_1791308027316 | Browser Retail 1791308027316 | true | 999 | 1 | {"users":5,"devices":5,"branches":1,"storage_mb":100} |
| BROWSER_1791352305554 | Browser Retail 1791352305554 | true | 999 | 1 | {"users":5,"devices":5,"branches":1,"storage_mb":100} |
| BROWSER_1791352572354 | Browser Retail 1791352572354 | true | 999 | 1 | {"users":5,"devices":5,"branches":1,"storage_mb":100} |
| BROWSER_1791352992647 | Browser Retail 1791352992647 | true | 999 | 1 | {"users":5,"devices":5,"branches":1,"storage_mb":100} |
| BROWSER_1791353269389 | Browser Retail 1791353269389 | true | 999 | 1 | {"users":5,"devices":5,"branches":1,"storage_mb":100} |
| DEFAULT | Default Plan | true | 0 | 8 | {"users":5,"devices":5,"branches":1,"storage_mb":100} |
| PRO | EVOLIX Pro | true | 210 | 50 | {"staff":10,"users":11,"devices":15,"branches":3,"storage_mb":2000,"stock_locations":10} |
| SMART | EVOLIX Smart | true | 120 | 39 | {"staff":2,"users":3,"devices":5,"branches":1,"storage_mb":500,"stock_locations":1} |
| STARTER | EVOLIX Starter | true | 75 | 16 | {"staff":0,"users":1,"devices":2,"branches":1,"storage_mb":100,"stock_locations":1} |

### Every organization and current overrides

The table exhaustively lists the 21 local organizations. “Feature overrides” means actual TenantEntitlement rows, not inherited plan grants; limits are the saved override JSON. Date fields are stored subscription dates, not new access decisions. No user/business record is changed.

| Tenant number | Organization ID | Org status / active | Assigned plan | Stored subscription | Period | Feature overrides | Limit overrides |
|---|---|---|---|---|---|---|---|
| 1 | c0e7443c-e9f3-40c8-8b8d-f4625976c273 | TRIAL / true | none | none (legacy) | — | RETAIL_POS=true, KHATA=true, PURCHASING=true, EXPENSES=true, REPORTS=true, INVENTORY=true, SALES=true, ACCOUNTING=true | {} |
| 2 | 5518f219-34fb-4010-a2e4-4d0e12d2ec85 | TRIAL / true | none | none (legacy) | — | none | {} |
| 3 | 26b5c7b3-1b32-47d0-a1ba-6464712004f1 | TRIAL / true | none | none (legacy) | — | none | {} |
| 4 | d54587ef-050b-4b0c-b8ee-62703a79f5f9 | TRIAL / true | none | none (legacy) | — | none | {} |
| 5 | da647bd1-0737-4bdf-967a-aa10b29b0144 | TRIAL / true | none | none (legacy) | — | none | {} |
| 6 | 0c72c3db-e59c-4d44-b29c-2882c35bfa4f | TRIAL / true | none | none (legacy) | — | none | {} |
| 7 | cd15e1e8-95d3-4b94-b3cd-e82025e9ccef | ACTIVE / true | STARTER | ACTIVE | 2026-10-06T00:00:00.000Z → 2026-11-05T00:00:00.000Z | none | {"users":5,"devices":5} |
| 8 | 0cb3616e-c873-4aa0-89ad-fc9e23877d58 | ACTIVE / true | STARTER | ACTIVE | 2026-10-06T00:00:00.000Z → 2027-10-06T00:00:00.000Z | none | {"users":5,"devices":5} |
| 9 | 46067c68-7672-4ad6-b7a9-348bd6651972 | ACTIVE / true | STARTER | ACTIVE | 2026-10-06T00:00:00.000Z → 2027-10-06T00:00:00.000Z | none | {"users":5,"devices":5} |
| 10 | d7da04ac-8510-407d-963f-d5a1db77f490 | ACTIVE / true | STARTER | ACTIVE | 2026-10-06T00:00:00.000Z → 2026-11-19T00:00:00.000Z | none | {"users":5,"devices":5} |
| 11 | af58b145-7bff-43fe-8a87-0afd0c4839de | ACTIVE / true | BROWSER_1791302501639 | ACTIVE | 2026-10-06T00:00:00.000Z → 2027-10-06T00:00:00.000Z | none | {"users":5,"devices":5} |
| 12 | 1375748c-1a6e-4ca9-98fd-ef25b2c4682d | ACTIVE / true | BROWSER_1791308027316 | ACTIVE | 2026-10-06T00:00:00.000Z → 2027-10-06T00:00:00.000Z | none | {"users":5,"devices":5} |
| 13 | d292ce0d-4412-4c1e-a4f2-b71c01f1cb3b | ACTIVE / true | STARTER | ACTIVE | 2026-10-06T00:00:00.000Z → 2026-11-05T00:00:00.000Z | none | {"users":5,"devices":5} |
| 14 | cbd808e5-97db-462a-9298-94735642b9fe | ACTIVE / true | BROWSER_1791352305554 | ACTIVE | 2026-10-07T00:00:00.000Z → 2027-10-06T00:00:00.000Z | none | {"users":5,"devices":5} |
| 15 | 45f8db96-72f7-4c13-9167-34d66f2b50b2 | ACTIVE / true | STARTER | ACTIVE | 2026-10-07T00:00:00.000Z → 2026-11-06T00:00:00.000Z | none | {"users":5,"devices":5} |
| 16 | a7682722-00c7-4363-81b0-c5d415206a3f | ACTIVE / true | BROWSER_1791352572354 | ACTIVE | 2026-10-07T00:00:00.000Z → 2027-10-06T00:00:00.000Z | none | {"users":5,"devices":5} |
| 17 | cca0b57f-a967-4065-8f7d-121a1f9f7054 | ACTIVE / true | STARTER | ACTIVE | 2026-10-07T00:00:00.000Z → 2026-11-06T00:00:00.000Z | none | {"users":5,"devices":5} |
| 18 | 98b6b206-4be4-4e31-823e-ec235139e01a | ACTIVE / true | BROWSER_1791352992647 | ACTIVE | 2026-10-07T00:00:00.000Z → 2027-10-06T00:00:00.000Z | none | {"users":5,"devices":5} |
| 19 | ce72fadb-4a69-41a1-b371-38dcdc65d79c | ACTIVE / true | STARTER | ACTIVE | 2026-10-07T00:00:00.000Z → 2026-11-06T00:00:00.000Z | none | {"users":5,"devices":5} |
| 20 | 5b9fd301-9462-4902-a5c4-840b3cda256a | ACTIVE / true | BROWSER_1791353269389 | ACTIVE | 2026-10-07T00:00:00.000Z → 2027-10-06T00:00:00.000Z | none | {"users":5,"devices":5} |
| 21 | 778c59f2-3758-41ff-9bc4-d8036f21591b | ACTIVE / true | STARTER | ACTIVE | 2026-10-07T00:00:00.000Z → 2026-11-06T00:00:00.000Z | none | {"users":5,"devices":5} |

### All 50 global flags

| Key | Active | Rollout mode | Percent | Beta tenant IDs |
|---|---|---|---:|---|
| ACCOUNTING | true | ON | 100 | [] |
| ADVANCED_PRICING | true | ON | 100 | [] |
| ADVANCED_REPORTS | true | ON | 100 | [] |
| ADVANCED_STAFF | true | ON | 100 | [] |
| AREA | true | ON | 100 | [] |
| ASSISTANT_TEXT | true | ON | 100 | [] |
| ASSISTANT_VOICE | true | ON | 100 | [] |
| BACKUP | true | ON | 100 | [] |
| BATCH_TRACKING | true | ON | 100 | [] |
| BUNDLES | true | ON | 100 | [] |
| BUSINESS_INSIGHTS | true | ON | 100 | [] |
| COMPATIBILITY | true | ON | 100 | [] |
| DAILY_GALLA | true | ON | 100 | [] |
| EXPENSES | true | ON | 100 | [] |
| EXPORT_CUSTOMERS | true | ON | 100 | [] |
| EXPORT_DOCUMENTS | true | ON | 100 | [] |
| EXPORT_EXPENSES | true | ON | 100 | [] |
| EXPORT_FULL_BUSINESS | true | ON | 100 | [] |
| EXPORT_GST | true | ON | 100 | [] |
| EXPORT_ITEMS | true | ON | 100 | [] |
| EXPORT_KHATA | true | ON | 100 | [] |
| EXPORT_LOCATIONS | true | ON | 100 | [] |
| EXPORT_PROFIT | true | ON | 100 | [] |
| EXPORT_PURCHASES | true | ON | 100 | [] |
| EXPORT_SALES | true | ON | 100 | [] |
| EXPORT_SCHEDULED | true | ON | 100 | [] |
| EXPORT_STAFF | true | ON | 100 | [] |
| EXPORT_STOCK | true | ON | 100 | [] |
| EXPORT_SUPPLIERS | true | ON | 100 | [] |
| GST_INVOICES | true | ON | 100 | [] |
| INVENTORY | true | ON | 100 | [] |
| ITEM_IMAGES | true | ON | 100 | [] |
| KHATA | true | ON | 100 | [] |
| LENGTH | true | ON | 100 | [] |
| MODIFIERS | true | ON | 100 | [] |
| MULTI_UNIT | true | ON | 100 | [] |
| MULTIPLE_STOCK_LOCATIONS | true | ON | 100 | [] |
| NEED_LIST | true | ON | 100 | [] |
| PROFIT_REPORTING | true | ON | 100 | [] |
| PURCHASING | true | ON | 100 | [] |
| REPORTS | true | ON | 100 | [] |
| RETAIL_POS | true | ON | 100 | [] |
| SALES | true | ON | 100 | [] |
| SERIAL_TRACKING | true | ON | 100 | [] |
| SERVICES | true | ON | 100 | [] |
| STAFF | true | ON | 100 | [] |
| VARIANTS | true | ON | 100 | [] |
| VOLUME | true | ON | 100 | [] |
| WASTAGE | true | ON | 100 | [] |
| WEIGHT | true | ON | 100 | [] |

### Shop and legacy capability settings

Observed17 company configurations have empty shop_feature_settings objects. Therefore absent non-core toggles defaultON; barcode scanning defaultsOFF. The snapshot inspects configured boolean flags only and does not expose payment details.16 RetailCapabilitySettings rows are legacy: one company has variants/multi-unit/weight/batch/services/bundles booleans true and other flags false; remaining rows defaultsfalse. Current resolver/active feature access uses catalog/PlanFeature/TenantEntitlement/company JSON, **not those legacy booleans**.

| Company ID | Organization ID | Explicit shop settings | UPI configured | Invoice flags | Greeting flags |
|---|---|---|---|---|---|
| e2b45f45-9add-4182-aacf-3193a370e149 | 0c72c3db-e59c-4d44-b29c-2882c35bfa4f | {} | false | {} | {} |
| 46da4d5e-863d-43ac-8c5f-152588ab6648 | cd15e1e8-95d3-4b94-b3cd-e82025e9ccef | {} | false | {} | {} |
| 318ddb77-b474-4bc5-a306-ff63fa7af14f | 0cb3616e-c873-4aa0-89ad-fc9e23877d58 | {} | false | {} | {} |
| 1e9859a8-275f-4a6d-9a1f-057cdc32a7c7 | 46067c68-7672-4ad6-b7a9-348bd6651972 | {} | false | {} | {} |
| 043e7018-ba39-408c-a4ed-d7bbdd4f02c6 | d7da04ac-8510-407d-963f-d5a1db77f490 | {} | false | {} | {} |
| 47412fcf-6561-4c09-ba7a-5d14a112cd23 | af58b145-7bff-43fe-8a87-0afd0c4839de | {} | false | {} | {} |
| 8b537f2b-7c87-4bfc-9096-2938b7486e72 | 1375748c-1a6e-4ca9-98fd-ef25b2c4682d | {} | false | {} | {} |
| 24377dfd-188d-48d9-aa89-0b9fa35ec1a7 | d292ce0d-4412-4c1e-a4f2-b71c01f1cb3b | {} | false | {} | {} |
| 607e356e-2475-4c8b-a59b-95aca7242e23 | cbd808e5-97db-462a-9298-94735642b9fe | {} | false | {} | {} |
| eaccdf30-024a-41fd-a76e-cbd11d2f12e3 | 45f8db96-72f7-4c13-9167-34d66f2b50b2 | {} | false | {} | {} |
| 9f7b711b-9c0f-4ba8-abe9-4d5c12d37020 | a7682722-00c7-4363-81b0-c5d415206a3f | {} | false | {} | {} |
| ca395b2d-e6f3-4514-806c-865b9466d42d | cca0b57f-a967-4065-8f7d-121a1f9f7054 | {} | false | {} | {} |
| 24f2ecce-32da-4082-98f4-1c0a55ab9cee | 98b6b206-4be4-4e31-823e-ec235139e01a | {} | false | {} | {} |
| 4891f559-fd59-46c5-9ddc-22e0401920dd | ce72fadb-4a69-41a1-b371-38dcdc65d79c | {} | false | {} | {} |
| d0fcff96-b692-45b6-ab9c-03935adb427b | 5b9fd301-9462-4902-a5c4-840b3cda256a | {} | false | {} | {} |
| 07b2184a-3b9d-4c04-b2b0-58b6b328cde5 | c0e7443c-e9f3-40c8-8b8d-f4625976c273 | {} | true | {} | {} |
| fc05cb69-9446-4d73-9fec-61a12a41f92d | 778c59f2-3758-41ff-9bc4-d8036f21591b | {} | false | {} | {} |

### Stored permissions and role grants

Permission registry codes: accounting.read, accounting.write, inventory.adjust, inventory.read, inventory.transfer, inventory.write, pos.return.create, pos.sale.create, pos.shift.close, pos.shift.open, pos.shift.read, purchase.create, purchase.post, purchase.read, purchase.reverse, purchase.write, retail.backup, retail.discount, retail.export, retail.settings, retail.staff, sales.read, sales.write. These 23 values are the observed registry, not the union of all codes required by controllers.16 role rows (same name may appear under different organizations):

| Role | Organization ID | System | Explicit grants |
|---|---|---|---|
| ADMIN | c0e7443c-e9f3-40c8-8b8d-f4625976c273 | true | none |
| TENANT_ADMIN | cd15e1e8-95d3-4b94-b3cd-e82025e9ccef | false | sales.read, sales.write, purchase.read, purchase.create, purchase.post, purchase.reverse, inventory.read, inventory.adjust, inventory.transfer, accounting.read, accounting.write, pos.sale.create, pos.return.create, pos.shift.read, pos.shift.open, pos.shift.close, retail.settings, retail.staff, retail.backup, retail.export, retail.discount |
| TENANT_ADMIN | 0cb3616e-c873-4aa0-89ad-fc9e23877d58 | false | sales.read, sales.write, purchase.read, purchase.create, purchase.post, purchase.reverse, inventory.read, inventory.adjust, inventory.transfer, accounting.read, accounting.write, pos.sale.create, pos.return.create, pos.shift.read, pos.shift.open, pos.shift.close, retail.settings, retail.staff, retail.backup, retail.export, retail.discount |
| TENANT_ADMIN | 46067c68-7672-4ad6-b7a9-348bd6651972 | false | sales.read, sales.write, purchase.read, purchase.create, purchase.post, purchase.reverse, inventory.read, inventory.adjust, inventory.transfer, accounting.read, accounting.write, pos.sale.create, pos.return.create, pos.shift.read, pos.shift.open, pos.shift.close, retail.settings, retail.staff, retail.backup, retail.export, retail.discount |
| TENANT_ADMIN | d7da04ac-8510-407d-963f-d5a1db77f490 | false | sales.read, sales.write, purchase.read, purchase.create, purchase.post, purchase.reverse, inventory.read, inventory.adjust, inventory.transfer, accounting.read, accounting.write, pos.sale.create, pos.return.create, pos.shift.read, pos.shift.open, pos.shift.close, retail.settings, retail.staff, retail.backup, retail.export, retail.discount |
| TENANT_ADMIN | af58b145-7bff-43fe-8a87-0afd0c4839de | false | sales.read, sales.write, purchase.read, purchase.create, purchase.post, purchase.reverse, inventory.read, inventory.adjust, inventory.transfer, accounting.read, accounting.write, pos.sale.create, pos.return.create, pos.shift.read, pos.shift.open, pos.shift.close, retail.settings, retail.staff, retail.backup, retail.export, retail.discount |
| TENANT_ADMIN | 1375748c-1a6e-4ca9-98fd-ef25b2c4682d | false | sales.read, sales.write, purchase.read, purchase.create, purchase.post, purchase.reverse, inventory.read, inventory.adjust, inventory.transfer, accounting.read, accounting.write, pos.sale.create, pos.return.create, pos.shift.read, pos.shift.open, pos.shift.close, retail.settings, retail.staff, retail.backup, retail.export, retail.discount |
| TENANT_ADMIN | d292ce0d-4412-4c1e-a4f2-b71c01f1cb3b | false | sales.read, sales.write, purchase.read, purchase.create, purchase.post, purchase.reverse, inventory.read, inventory.adjust, inventory.transfer, accounting.read, accounting.write, pos.sale.create, pos.return.create, pos.shift.read, pos.shift.open, pos.shift.close, retail.settings, retail.staff, retail.backup, retail.export, retail.discount |
| TENANT_ADMIN | cbd808e5-97db-462a-9298-94735642b9fe | false | sales.read, sales.write, purchase.read, purchase.create, purchase.post, purchase.reverse, inventory.read, inventory.adjust, inventory.transfer, accounting.read, accounting.write, pos.sale.create, pos.return.create, pos.shift.read, pos.shift.open, pos.shift.close, retail.settings, retail.staff, retail.backup, retail.export, retail.discount |
| TENANT_ADMIN | 45f8db96-72f7-4c13-9167-34d66f2b50b2 | false | sales.read, sales.write, purchase.read, purchase.create, purchase.post, purchase.reverse, inventory.read, inventory.adjust, inventory.transfer, accounting.read, accounting.write, pos.sale.create, pos.return.create, pos.shift.read, pos.shift.open, pos.shift.close, retail.settings, retail.staff, retail.backup, retail.export, retail.discount |
| TENANT_ADMIN | a7682722-00c7-4363-81b0-c5d415206a3f | false | sales.read, sales.write, purchase.read, purchase.create, purchase.post, purchase.reverse, inventory.read, inventory.adjust, inventory.transfer, accounting.read, accounting.write, pos.sale.create, pos.return.create, pos.shift.read, pos.shift.open, pos.shift.close, retail.settings, retail.staff, retail.backup, retail.export, retail.discount |
| TENANT_ADMIN | cca0b57f-a967-4065-8f7d-121a1f9f7054 | false | sales.read, sales.write, purchase.read, purchase.create, purchase.post, purchase.reverse, inventory.read, inventory.adjust, inventory.transfer, accounting.read, accounting.write, pos.sale.create, pos.return.create, pos.shift.read, pos.shift.open, pos.shift.close, retail.settings, retail.staff, retail.backup, retail.export, retail.discount |
| TENANT_ADMIN | 98b6b206-4be4-4e31-823e-ec235139e01a | false | sales.read, sales.write, purchase.read, purchase.create, purchase.post, purchase.reverse, inventory.read, inventory.adjust, inventory.transfer, accounting.read, accounting.write, pos.sale.create, pos.return.create, pos.shift.read, pos.shift.open, pos.shift.close, retail.settings, retail.staff, retail.backup, retail.export, retail.discount |
| TENANT_ADMIN | ce72fadb-4a69-41a1-b371-38dcdc65d79c | false | sales.read, sales.write, purchase.read, purchase.create, purchase.post, purchase.reverse, inventory.read, inventory.adjust, inventory.transfer, accounting.read, accounting.write, pos.sale.create, pos.return.create, pos.shift.read, pos.shift.open, pos.shift.close, retail.settings, retail.staff, retail.backup, retail.export, retail.discount |
| TENANT_ADMIN | 5b9fd301-9462-4902-a5c4-840b3cda256a | false | sales.read, sales.write, purchase.read, purchase.create, purchase.post, purchase.reverse, inventory.read, inventory.adjust, inventory.transfer, accounting.read, accounting.write, pos.sale.create, pos.return.create, pos.shift.read, pos.shift.open, pos.shift.close, retail.settings, retail.staff, retail.backup, retail.export, retail.discount |
| TENANT_ADMIN | 778c59f2-3758-41ff-9bc4-d8036f21591b | false | sales.read, sales.write, purchase.read, purchase.create, purchase.post, purchase.reverse, inventory.read, inventory.adjust, inventory.transfer, accounting.read, accounting.write, pos.sale.create, pos.return.create, pos.shift.read, pos.shift.open, pos.shift.close, retail.settings, retail.staff, retail.backup, retail.export, retail.discount |

### Persisted Platform settings

- RETAIL_COMMERCIAL_PLANS_V1: one-time commercial/export revision marker; not a trial/signup policy override.
- RETAIL_EXPORT_ENTITLEMENTS_V1: one-time commercial/export revision marker; not a trial/signup policy override.

No ACCOUNT_POLICY or OPERATIONS entry observed. Code defaults in section4 apply. Local providers: google_client_id_present=true; sms="none"; email="none"; storage="local"; backup="none"; platform_mfa_required=true. Only configuration/status metadata was retained, never secret values. Active intent configs96 and 843 expanded default example records: English478/Hindi111/Hinglish254. Migration bookkeeping lists35 finished rows; no migration deployment/validation was run in this audit.

## 24. Active backend controller inventory

Module reachability was traced from actual AppModule @Module imports, not just TypeScript imports. **46 active controllers /397 handler declarations**. Test column names related existing suites, not an assertion every handler has an individual test. Tests not executed. Exact metadata and paths follow.

| Controller | Prefix under `/api/v1` | Handlers | Registered module | Tenant scope | Auth/role guard | Declared feature gate + service rules | Existing relevant test sources |
|---|---|---:|---|---|---|---|---|
| AccountingController | /api/v1/accounting | 10 | AccountingModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard | ACCOUNTING; FeatureGuard supplements in section3 when present | accounting.spec; module_14..17; costing-profit; retail-flow |
| BankingController | /api/v1/banking | 5 | AccountingModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard | ACCOUNTING; FeatureGuard supplements in section3 when present | accounting.spec; module_14..17; costing-profit; retail-flow |
| AppController | /api/v1 | 1 | AppModule | Public; no tenant data | — | —; FeatureGuard supplements in section3 when present | app.controller.spec; app.e2e |
| AssistantController | /api/v1/assistant | 1 | AssistantModule | Authenticated org/company; branch/document as applicable | AuthGuard, FeatureGuard | RETAIL_POS, ASSISTANT_TEXT; FeatureGuard supplements in section3 when present | intent-router; business-insight; assistant.e2e; assistant browser |
| PlatformAssistantController | /api/v1/platform/assistant | 8 | AssistantModule | Platform/global or explicit tenant target; platform guard | PlatformAuthGuard | —; SUPER_ADMIN boundary; no Retail plan | intent-router; business-insight; assistant.e2e; assistant browser |
| AttachmentsController | /api/v1/attachments | 4 | AttachmentsModule | Authenticated org/company; branch/document as applicable | AuthGuard | —; Manual ITEM_IMAGES/entity/module checks | attachments.e2e; production-readiness; security-remediation |
| AccountController | /api/v1/auth/account | 12 | AuthModule | Mixed public identity/account session; validated lifecycle | — | —; Identity/onboarding/provider policy | auth-lifecycle; google-business-onboarding; account-onboarding-referral; security-remediation; auth browser |
| AuthController | /api/v1/auth | 17 | AuthModule | Mixed public identity/account session; validated lifecycle | — | —; Identity/onboarding/provider policy | auth-lifecycle; google-business-onboarding; account-onboarding-referral; security-remediation; auth browser |
| PlatformPasswordController | /api/v1/platform/auth/password | 1 | AuthModule | Platform/global or explicit tenant target; platform guard | — | —; SUPER_ADMIN boundary; no Retail plan | auth-lifecycle; google-business-onboarding; account-onboarding-referral; security-remediation; auth browser |
| BarcodeController | /api/v1/barcodes | 15 | BarcodeModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard | INVENTORY; FeatureGuard supplements in section3 when present | module_12; pos/barcode; busy-day-qa |
| ClaimsController | /api/v1/claims | 6 | ClaimsModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard | RETURNS_CLAIMS; FeatureGuard supplements in section3 when present | inventory/module_21 and related legacy tests; no dedicated claims e2e |
| HealthController | /api/v1/health | 2 | HealthModule | Public; no tenant data | — | —; FeatureGuard supplements in section3 when present | production-readiness |
| InventoryController | /api/v1/inventory | 11 | InventoryModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard | INVENTORY; FeatureGuard supplements in section3 when present | inventory.spec; module_06/21/25; batch-fefo; universal-item-flow; costing-profit |
| ItemCompositionController | /api/v1/retail/items/:id | 5 | ItemCompositionModule | Authenticated org/company; branch/document as applicable | AuthGuard, FeatureGuard, PermissionGuard | INVENTORY; FeatureGuard supplements in section3 when present | bundle-modifier; universal-item-flow |
| PlatformAuthController | /api/v1/platform/auth | 3 | PlatformAuthModule | Platform/global or explicit tenant target; platform guard | — | —; SUPER_ADMIN boundary; no Retail plan | auth-lifecycle; control-plane-security; security-remediation; totp |
| ControlPlaneController | /api/v1/platform/admin | 20 | PlatformModule | Platform/global or explicit tenant target; platform guard | PlatformAuthGuard | —; SUPER_ADMIN boundary; no Retail plan | platform-control-plane; platform-access-approval; platform-backup; control-plane-security; account-publishing |
| OwnerReferralController | /api/v1/retail/referrals | 1 | PlatformModule | Authenticated org/company; branch/document as applicable | AuthGuard, PermissionGuard | —; FeatureGuard supplements in section3 when present | platform-control-plane; platform-access-approval; platform-backup; control-plane-security; account-publishing |
| PublicAppController | /api/v1/public | 1 | PlatformModule | Public publishing metadata | — | —; FeatureGuard supplements in section3 when present | platform-control-plane; platform-access-approval; platform-backup; control-plane-security; account-publishing |
| PlatformPublishingController | /api/v1/platform/admin/publishing | 3 | PlatformModule | Platform/global or explicit tenant target; platform guard | PlatformAuthGuard | —; SUPER_ADMIN boundary; no Retail plan | platform-control-plane; platform-access-approval; platform-backup; control-plane-security; account-publishing |
| PlatformAdminController | /api/v1/platform/admin | 33 | PlatformModule | Platform/global or explicit tenant target; platform guard | PlatformAuthGuard | —; SUPER_ADMIN boundary; no Retail plan | platform-control-plane; platform-access-approval; platform-backup; control-plane-security; account-publishing |
| PosController | /api/v1/erp/pos | 9 | PosModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard | RETAIL_POS; FeatureGuard supplements in section3 when present | pos.spec; bill-discount; barcode; retail-flow; busy-day-qa; universal-item-flow |
| PricingController | /api/v1/pricing | 20 | PricingModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard | SALES; FeatureGuard supplements in section3 when present | pricing/module_13; sales specs |
| PurchaseController | /api/v1/purchase | 23 | PurchaseModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard | PURCHASING; FeatureGuard supplements in section3 when present | purchase/module_10; posting.service.spec; universal-item-flow; costing-profit |
| RetailAccountController | /api/v1/retail/account | 13 | RetailModule | Authenticated org/company; branch/document as applicable | AuthGuard | —; Manual owner/export/provider checks | retail-flow; retail-field-coverage; calendar-price-only; import-report; gst-invoice; subscription-entitlements |
| RetailExportController | /api/v1/retail/account/exports | 1 | RetailModule | Authenticated org/company; branch/document as applicable | AuthGuard | —; Per-kind feature/permission manual checks | retail-flow; retail-field-coverage; calendar-price-only; import-report; gst-invoice; subscription-entitlements |
| BillingController | /api/v1/retail/bills | 9 | BillingModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard | RETAIL_POS; FeatureGuard supplements in section3 when present | retail-flow; busy-day-qa; shopkeeper-qa; general-store-qa; costing-profit |
| RetailCalendarController | /api/v1/retail | 7 | RetailModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard | RETAIL_POS; FeatureGuard supplements in section3 when present | retail-flow; retail-field-coverage; calendar-price-only; import-report; gst-invoice; subscription-entitlements |
| CounterController | /api/v1/retail | 6 | RetailModule | Authenticated org/company; branch/document as applicable | AuthGuard, FeatureGuard | RETAIL_POS; FeatureGuard supplements in section3 when present | retail-flow; retail-field-coverage; calendar-price-only; import-report; gst-invoice; subscription-entitlements |
| ExpenseCategoriesController | /api/v1/retail/expense-categories | 4 | ExpensesModule | Authenticated org/company; branch/document as applicable | AuthGuard, FeatureGuard | EXPENSES; FeatureGuard supplements in section3 when present | expenses; retail-field-coverage; general-store-qa |
| ExpensesController | /api/v1/retail/expenses | 6 | ExpensesModule | Authenticated org/company; branch/document as applicable | AuthGuard, FeatureGuard | EXPENSES; FeatureGuard supplements in section3 when present | expenses; retail-field-coverage; general-store-qa |
| RetailGstController | /api/v1/retail/gst | 6 | RetailModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard | RETAIL_POS; FeatureGuard supplements in section3 when present | retail-flow; retail-field-coverage; calendar-price-only; import-report; gst-invoice; subscription-entitlements |
| RetailImportController | /api/v1/retail/imports | 5 | RetailModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard | RETAIL_POS; FeatureGuard supplements in section3 when present | retail-flow; retail-field-coverage; calendar-price-only; import-report; gst-invoice; subscription-entitlements |
| FinancialReportsController | /api/v1/retail/reports/financial | 6 | ReportsModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard | REPORTS, PROFIT_REPORTING; FeatureGuard supplements in section3 when present | costing-profit; import-report; assistant; retail-flow |
| ReportAssistantController | /api/v1/retail/reports/assistant | 5 | ReportsModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard | RETAIL_POS; FeatureGuard supplements in section3 when present | costing-profit; import-report; assistant; retail-flow |
| ReportsController | /api/v1/retail/reports | 9 | ReportsModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard | RETAIL_POS; FeatureGuard supplements in section3 when present | costing-profit; import-report; assistant; retail-flow |
| RetailController | /api/v1/retail | 26 | RetailModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard | RETAIL_POS; FeatureGuard supplements in section3 when present | retail-flow; retail-field-coverage; calendar-price-only; import-report; gst-invoice; subscription-entitlements |
| SalesController | /api/v1/sales | 26 | SalesModule | Authenticated org/company; branch/document as applicable | AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard | SALES; FeatureGuard supplements in section3 when present | sales.spec; module_10/11/18..22; retail-flow |
| UsersController | /api/v1/users | 13 | TenantAdministrationModule | Authenticated org/company; branch/document as applicable | AuthGuard, TenantAdministrationGuard | —; Owner guard + STAFF/ADVANCED_STAFF/location limits in service | tenant-administration; control-plane-security; platform-control-plane browser |
| RolesController | /api/v1/roles | 8 | TenantAdministrationModule | Authenticated org/company; branch/document as applicable | AuthGuard, TenantAdministrationGuard | —; Owner guard + STAFF/ADVANCED_STAFF/location limits in service | tenant-administration; control-plane-security; platform-control-plane browser |
| PermissionsController | /api/v1/permissions | 1 | TenantAdministrationModule | Authenticated org/company; branch/document as applicable | AuthGuard, TenantAdministrationGuard | —; Owner guard + STAFF/ADVANCED_STAFF/location limits in service | tenant-administration; control-plane-security; platform-control-plane browser |
| SessionsController | /api/v1/sessions | 2 | TenantAdministrationModule | Authenticated org/company; branch/document as applicable | AuthGuard | —; Owner guard + STAFF/ADVANCED_STAFF/location limits in service | tenant-administration; control-plane-security; platform-control-plane browser |
| OrganizationsController | /api/v1/organizations | 7 | TenantAdministrationModule | Authenticated org/company; branch/document as applicable | AuthGuard, TenantAdministrationGuard | —; Owner guard + STAFF/ADVANCED_STAFF/location limits in service | tenant-administration; control-plane-security; platform-control-plane browser |
| CompaniesController | /api/v1/companies | 7 | TenantAdministrationModule | Authenticated org/company; branch/document as applicable | AuthGuard, TenantAdministrationGuard | —; Owner guard + STAFF/ADVANCED_STAFF/location limits in service | tenant-administration; control-plane-security; platform-control-plane browser |
| BranchesController | /api/v1/branches | 7 | TenantAdministrationModule | Authenticated org/company; branch/document as applicable | AuthGuard, TenantAdministrationGuard | —; Owner guard + STAFF/ADVANCED_STAFF/location limits in service | tenant-administration; control-plane-security; platform-control-plane browser |
| GodownsController | /api/v1/godowns | 7 | TenantAdministrationModule | Authenticated org/company; branch/document as applicable | AuthGuard, TenantAdministrationGuard | —; Owner guard + STAFF/ADVANCED_STAFF/location limits in service | tenant-administration; control-plane-security; platform-control-plane browser |
| FinancialYearsController | /api/v1/financial-years | 5 | TenantAdministrationModule | Authenticated org/company; branch/document as applicable | AuthGuard, TenantAdministrationGuard | —; Owner guard + STAFF/ADVANCED_STAFF/location limits in service | tenant-administration; control-plane-security; platform-control-plane browser |

### Controller and module not active

IntelligenceController (`/api/v1/intelligence`,1 handler) belongs to IntelligenceModule, which is not in AppModule @Module imports. Public routing status DEAD_CODE; old tests exist. Manufacturing and sales dispatch/field-sales/pharmacy/retailer-portal helpers are not active module providers and have no active routes. Old accounting GST/report helper classes are similarly not registered; active Retail GST/financial reports are separate. These files/schema models do not establish live manufacturing/wholesale/distributor/KOT modules.

## 25. Complete active API endpoint appendix

F: handler RequireFeature if present, otherwise class. P: handler RequirePermissions if present, otherwise class. These are declared metadata, not a claim checks are absent when dash appears. D supplements: R=Retail dynamic features/inferred module permissions (section3); T=tenant admin owner/service checks; A=attachment checks; X=export/account manual checks; L=identity/onboarding lifecycle; S=platform SUPER_ADMIN; H=public health/information. Exact paths/verbs and controller line references reproduced from AST. Main prefix applied once. No requests executed.

| Method | Full path | Handler | F: declared features | P: explicit permissions | D | Source |
|---|---|---|---|---|---|---|
| GET | /api/v1/accounting/accounts | AccountingController.getChartOfAccounts | ACCOUNTING | accounting.read | R / base module permissions | backend-typescript/src/accounting/accounting.controller.ts:21 |
| POST | /api/v1/accounting/accounts | AccountingController.createAccount | ACCOUNTING | accounting.write | R / base module permissions | backend-typescript/src/accounting/accounting.controller.ts:29 |
| GET | /api/v1/accounting/accounts/:id/balance | AccountingController.getAccountBalance | ACCOUNTING | accounting.read | R / base module permissions | backend-typescript/src/accounting/accounting.controller.ts:38 |
| GET | /api/v1/accounting/ledger/:id | AccountingController.getLedger | ACCOUNTING | accounting.read | R / base module permissions | backend-typescript/src/accounting/accounting.controller.ts:46 |
| GET | /api/v1/accounting/trial-balance | AccountingController.getTrialBalance | ACCOUNTING | accounting.read | R / base module permissions | backend-typescript/src/accounting/accounting.controller.ts:59 |
| POST | /api/v1/accounting/vouchers | AccountingController.createVoucher | ACCOUNTING | accounting.write | R / base module permissions | backend-typescript/src/accounting/accounting.controller.ts:67 |
| POST | /api/v1/accounting/vouchers/:id/reverse | AccountingController.reverseVoucher | ACCOUNTING | accounting.write | R / base module permissions | backend-typescript/src/accounting/accounting.controller.ts:87 |
| GET | /api/v1/accounting/parties/:id/outstanding | AccountingController.getPartyOutstanding | ACCOUNTING | accounting.read | R / base module permissions | backend-typescript/src/accounting/accounting.controller.ts:96 |
| GET | /api/v1/accounting/parties/:id/ageing | AccountingController.getPartyAgeing | ACCOUNTING | accounting.read | R / base module permissions | backend-typescript/src/accounting/accounting.controller.ts:105 |
| GET | /api/v1/accounting/parties/:id/credit-status | AccountingController.getPartyCreditStatus | ACCOUNTING | accounting.read | R / base module permissions | backend-typescript/src/accounting/accounting.controller.ts:113 |
| GET | /api/v1/banking/accounts | BankingController.getBankAccounts | ACCOUNTING | accounting.read | R / base module permissions | backend-typescript/src/accounting/banking.controller.ts:15 |
| POST | /api/v1/banking/accounts | BankingController.createBankAccount | ACCOUNTING | accounting.write | R / base module permissions | backend-typescript/src/accounting/banking.controller.ts:23 |
| POST | /api/v1/banking/cheques/register | BankingController.registerCheque | ACCOUNTING | accounting.write | R / base module permissions | backend-typescript/src/accounting/banking.controller.ts:32 |
| POST | /api/v1/banking/cheques/:id/clear | BankingController.clearCheque | ACCOUNTING | accounting.write | R / base module permissions | backend-typescript/src/accounting/banking.controller.ts:46 |
| POST | /api/v1/banking/cheques/:id/bounce | BankingController.bounceCheque | ACCOUNTING | accounting.write | R / base module permissions | backend-typescript/src/accounting/banking.controller.ts:55 |
| GET | /api/v1 | AppController.getHello | — | — | H | backend-typescript/src/app.controller.ts:8 |
| POST | /api/v1/assistant/query | AssistantController.ask | RETAIL_POS, ASSISTANT_TEXT | — | R / base module permissions | backend-typescript/src/assistant/assistant.controller.ts:19 |
| GET | /api/v1/platform/assistant/analytics | PlatformAssistantController.stats | — | — | S | backend-typescript/src/assistant/assistant.controller.ts:25 |
| GET | /api/v1/platform/assistant/intents | PlatformAssistantController.intents | — | — | S | backend-typescript/src/assistant/assistant.controller.ts:26 |
| GET | /api/v1/platform/assistant/examples | PlatformAssistantController.examples | — | — | S | backend-typescript/src/assistant/assistant.controller.ts:27 |
| POST | /api/v1/platform/assistant/examples | PlatformAssistantController.add | — | — | S | backend-typescript/src/assistant/assistant.controller.ts:28 |
| POST | /api/v1/platform/assistant/unknown/map | PlatformAssistantController.map | — | — | S | backend-typescript/src/assistant/assistant.controller.ts:29 |
| GET | /api/v1/platform/assistant/unknown | PlatformAssistantController.unknown | — | — | S | backend-typescript/src/assistant/assistant.controller.ts:30 |
| PATCH | /api/v1/platform/assistant/intents/:code | PlatformAssistantController.active | — | — | S | backend-typescript/src/assistant/assistant.controller.ts:31 |
| POST | /api/v1/platform/assistant/examples/:id/retire | PlatformAssistantController.retire | — | — | S | backend-typescript/src/assistant/assistant.controller.ts:32 |
| GET | /api/v1/attachments | AttachmentsController.list | — | — | A | backend-typescript/src/attachments/attachments.controller.ts:12 |
| POST | /api/v1/attachments | AttachmentsController.upload | — | — | A | backend-typescript/src/attachments/attachments.controller.ts:15 |
| GET | /api/v1/attachments/:id/content | AttachmentsController.getContent | — | — | A | backend-typescript/src/attachments/attachments.controller.ts:57 |
| DELETE | /api/v1/attachments/:id | AttachmentsController.deleteAttachment | — | — | A | backend-typescript/src/attachments/attachments.controller.ts:69 |
| POST | /api/v1/auth/account/password/create | AccountController.createPassword | — | — | L | backend-typescript/src/auth/account.controller.ts:47 |
| POST | /api/v1/auth/account/otp/request | AccountController.request | — | — | L | backend-typescript/src/auth/account.controller.ts:59 |
| POST | /api/v1/auth/account/otp/verify | AccountController.verify | — | — | L | backend-typescript/src/auth/account.controller.ts:61 |
| POST | /api/v1/auth/account/mobile/request-link | AccountController.requestLink | — | — | L | backend-typescript/src/auth/account.controller.ts:63 |
| POST | /api/v1/auth/account/mobile/verify-link | AccountController.verifyLink | — | — | L | backend-typescript/src/auth/account.controller.ts:65 |
| GET | /api/v1/auth/account/onboarding | AccountController.state | — | — | L | backend-typescript/src/auth/account.controller.ts:67 |
| POST | /api/v1/auth/account/onboarding/owner | AccountController.owner | — | — | L | backend-typescript/src/auth/account.controller.ts:69 |
| POST | /api/v1/auth/account/onboarding/business | AccountController.business | — | — | L | backend-typescript/src/auth/account.controller.ts:71 |
| POST | /api/v1/auth/account/onboarding/profile | AccountController.profile | — | — | L | backend-typescript/src/auth/account.controller.ts:73 |
| POST | /api/v1/auth/account/onboarding/plan | AccountController.plan | — | — | L | backend-typescript/src/auth/account.controller.ts:75 |
| POST | /api/v1/auth/account/onboarding/migration | AccountController.migration | — | — | L | backend-typescript/src/auth/account.controller.ts:77 |
| POST | /api/v1/auth/account/logout | AccountController.logout | — | — | L | backend-typescript/src/auth/account.controller.ts:79 |
| GET | /api/v1/auth/capabilities | AuthController.capabilities | — | — | L | backend-typescript/src/auth/auth.controller.ts:60 |
| POST | /api/v1/auth/browser-session | AuthController.browserSession | — | — | L | backend-typescript/src/auth/auth.controller.ts:62 |
| GET | /api/v1/auth/security | AuthController.security | — | — | L | backend-typescript/src/auth/auth.controller.ts:68 |
| POST | /api/v1/auth/login | AuthController.login | — | — | L | backend-typescript/src/auth/auth.controller.ts:75 |
| POST | /api/v1/auth/google/challenge | AuthController.googleChallenge | — | — | L | backend-typescript/src/auth/auth.controller.ts:81 |
| POST | /api/v1/auth/google/signup-challenge | AuthController.googleSignupChallenge | — | — | L | backend-typescript/src/auth/auth.controller.ts:84 |
| POST | /api/v1/auth/google/signup | AuthController.googleSignup | — | — | L | backend-typescript/src/auth/auth.controller.ts:87 |
| POST | /api/v1/auth/google/link-challenge | AuthController.googleLinkChallenge | — | — | L | backend-typescript/src/auth/auth.controller.ts:90 |
| POST | /api/v1/auth/google/login | AuthController.googleLogin | — | — | L | backend-typescript/src/auth/auth.controller.ts:93 |
| POST | /api/v1/auth/google/link | AuthController.googleLink | — | — | L | backend-typescript/src/auth/auth.controller.ts:98 |
| POST | /api/v1/auth/google/unlink | AuthController.googleUnlink | — | — | L | backend-typescript/src/auth/auth.controller.ts:101 |
| POST | /api/v1/auth/password/forgot | AuthController.forgotPassword | — | — | L | backend-typescript/src/auth/auth.controller.ts:104 |
| POST | /api/v1/auth/password/reset | AuthController.resetPassword | — | — | L | backend-typescript/src/auth/auth.controller.ts:107 |
| POST | /api/v1/auth/password/change | AuthController.changePassword | — | — | L | backend-typescript/src/auth/auth.controller.ts:110 |
| POST | /api/v1/auth/email/request-verification | AuthController.requestEmailVerification | — | — | L | backend-typescript/src/auth/auth.controller.ts:113 |
| POST | /api/v1/auth/email/verify | AuthController.verifyEmail | — | — | L | backend-typescript/src/auth/auth.controller.ts:116 |
| POST | /api/v1/auth/logout | AuthController.logout | — | — | L | backend-typescript/src/auth/auth.controller.ts:119 |
| POST | /api/v1/platform/auth/password/change | PlatformPasswordController.change | — | — | S | backend-typescript/src/auth/auth.controller.ts:129 |
| POST | /api/v1/barcodes/assign | BarcodeController.assignBarcode | INVENTORY | barcode.create | R / base module permissions | backend-typescript/src/barcode/barcode.controller.ts:25 |
| GET | /api/v1/barcodes/item/:itemId | BarcodeController.getBarcodesByItem | INVENTORY | barcode.read | R / base module permissions | backend-typescript/src/barcode/barcode.controller.ts:31 |
| GET | /api/v1/barcodes/lookup/:barcode | BarcodeController.lookupBarcode | INVENTORY | barcode.read | R / base module permissions | backend-typescript/src/barcode/barcode.controller.ts:37 |
| POST | /api/v1/barcodes/generate | BarcodeController.generateBarcode | INVENTORY | barcode.create | R / base module permissions | backend-typescript/src/barcode/barcode.controller.ts:43 |
| PATCH | /api/v1/barcodes/:id/primary | BarcodeController.setPrimaryBarcode | INVENTORY | barcode.update | R / base module permissions | backend-typescript/src/barcode/barcode.controller.ts:49 |
| PATCH | /api/v1/barcodes/:id/deactivate | BarcodeController.deactivateBarcode | INVENTORY | barcode.update | R / base module permissions | backend-typescript/src/barcode/barcode.controller.ts:55 |
| DELETE | /api/v1/barcodes/:id | BarcodeController.deleteBarcode | INVENTORY | barcode.delete | R / base module permissions | backend-typescript/src/barcode/barcode.controller.ts:61 |
| POST | /api/v1/barcodes/labels/product | BarcodeController.generateProductLabel | INVENTORY | label.print | R / base module permissions | backend-typescript/src/barcode/barcode.controller.ts:69 |
| POST | /api/v1/barcodes/labels/inward | BarcodeController.generateInwardLabels | INVENTORY | label.print | R / base module permissions | backend-typescript/src/barcode/barcode.controller.ts:75 |
| POST | /api/v1/barcodes/labels/print-job | BarcodeController.recordPrintJob | INVENTORY | label.print | R / base module permissions | backend-typescript/src/barcode/barcode.controller.ts:81 |
| POST | /api/v1/barcodes/templates | BarcodeController.createTemplate | INVENTORY | barcode.create | R / base module permissions | backend-typescript/src/barcode/barcode.controller.ts:89 |
| GET | /api/v1/barcodes/templates | BarcodeController.getTemplates | INVENTORY | barcode.read | R / base module permissions | backend-typescript/src/barcode/barcode.controller.ts:95 |
| GET | /api/v1/barcodes/templates/:id | BarcodeController.getTemplateById | INVENTORY | barcode.read | R / base module permissions | backend-typescript/src/barcode/barcode.controller.ts:101 |
| PATCH | /api/v1/barcodes/templates/:id | BarcodeController.updateTemplate | INVENTORY | barcode.update | R / base module permissions | backend-typescript/src/barcode/barcode.controller.ts:107 |
| DELETE | /api/v1/barcodes/templates/:id | BarcodeController.deleteTemplate | INVENTORY | barcode.delete | R / base module permissions | backend-typescript/src/barcode/barcode.controller.ts:113 |
| POST | /api/v1/claims/reasons | ClaimsController.createReturnReason | RETURNS_CLAIMS | — | R / base module permissions | backend-typescript/src/claims/claims.controller.ts:16 |
| GET | /api/v1/claims/reasons | ClaimsController.getReturnReasons | RETURNS_CLAIMS | — | R / base module permissions | backend-typescript/src/claims/claims.controller.ts:21 |
| POST | /api/v1/claims | ClaimsController.createClaim | RETURNS_CLAIMS | — | R / base module permissions | backend-typescript/src/claims/claims.controller.ts:28 |
| GET | /api/v1/claims | ClaimsController.getClaims | RETURNS_CLAIMS | — | R / base module permissions | backend-typescript/src/claims/claims.controller.ts:33 |
| GET | /api/v1/claims/:id | ClaimsController.getClaimById | RETURNS_CLAIMS | — | R / base module permissions | backend-typescript/src/claims/claims.controller.ts:38 |
| PATCH | /api/v1/claims/:id/status | ClaimsController.updateClaimStatus | RETURNS_CLAIMS | — | R / base module permissions | backend-typescript/src/claims/claims.controller.ts:43 |
| GET | /api/v1/health | HealthController.check | — | — | H | backend-typescript/src/health/health.controller.ts:7 |
| GET | /api/v1/health/ready | HealthController.ready | — | — | H | backend-typescript/src/health/health.controller.ts:11 |
| GET | /api/v1/inventory/stock | InventoryController.getStockSummary | INVENTORY | inventory.read | R / base module permissions | backend-typescript/src/inventory/inventory.controller.ts:27 |
| GET | /api/v1/inventory/movements | InventoryController.getStockLedger | INVENTORY | inventory.read | R / base module permissions | backend-typescript/src/inventory/inventory.controller.ts:55 |
| POST | /api/v1/inventory/adjustments | InventoryController.postAdjustment | INVENTORY | inventory.adjust | R / base module permissions | backend-typescript/src/inventory/inventory.controller.ts:78 |
| POST | /api/v1/inventory/transfers | InventoryController.postTransfer | INVENTORY | inventory.transfer | R / base module permissions | backend-typescript/src/inventory/inventory.controller.ts:108 |
| POST | /api/v1/inventory/adjustments/:id/reverse | InventoryController.reverseAdjustment | INVENTORY | inventory.adjust | R / base module permissions | backend-typescript/src/inventory/inventory.controller.ts:138 |
| POST | /api/v1/inventory/transfers/:id/reverse | InventoryController.reverseTransfer | INVENTORY | inventory.transfer | R / base module permissions | backend-typescript/src/inventory/inventory.controller.ts:145 |
| GET | /api/v1/inventory/opening-stocks | InventoryController.getOpeningStocks | INVENTORY | inventory.read | R / base module permissions | backend-typescript/src/inventory/inventory.controller.ts:152 |
| POST | /api/v1/inventory/opening-stocks | InventoryController.postOpeningStock | INVENTORY | inventory.adjust | R / base module permissions | backend-typescript/src/inventory/inventory.controller.ts:158 |
| GET | /api/v1/inventory/stock-counts | InventoryController.getStockCounts | INVENTORY | inventory.read | R / base module permissions | backend-typescript/src/inventory/inventory.controller.ts:174 |
| POST | /api/v1/inventory/stock-counts | InventoryController.createStockCount | INVENTORY | inventory.adjust | R / base module permissions | backend-typescript/src/inventory/inventory.controller.ts:180 |
| POST | /api/v1/inventory/stock-counts/:id/post | InventoryController.postStockCount | INVENTORY | inventory.adjust | R / base module permissions | backend-typescript/src/inventory/inventory.controller.ts:197 |
| GET | /api/v1/retail/items/:id/composition | ItemCompositionController.get | INVENTORY | inventory.read | R / base module permissions | backend-typescript/src/item-composition/item-composition.controller.ts:11 |
| PUT | /api/v1/retail/items/:id/bundle | ItemCompositionController.bundle | INVENTORY, BUNDLES | inventory.write | R / base module permissions | backend-typescript/src/item-composition/item-composition.controller.ts:13 |
| PUT | /api/v1/retail/items/:id/modifiers | ItemCompositionController.modifiers | INVENTORY, MODIFIERS | inventory.write | R / base module permissions | backend-typescript/src/item-composition/item-composition.controller.ts:15 |
| POST | /api/v1/retail/items/:id/variants | ItemCompositionController.variant | INVENTORY, VARIANTS | inventory.write | R / base module permissions | backend-typescript/src/item-composition/item-composition.controller.ts:17 |
| POST | /api/v1/retail/items/:id/unit-conversions | ItemCompositionController.conversion | INVENTORY, MULTI_UNIT | inventory.write | R / base module permissions | backend-typescript/src/item-composition/item-composition.controller.ts:19 |
| POST | /api/v1/platform/auth/login | PlatformAuthController.login | — | — | S | backend-typescript/src/platform/auth/platform-auth.controller.ts:20 |
| POST | /api/v1/platform/auth/mfa/verify | PlatformAuthController.verifyMfa | — | — | S | backend-typescript/src/platform/auth/platform-auth.controller.ts:25 |
| POST | /api/v1/platform/auth/logout | PlatformAuthController.logout | — | — | S | backend-typescript/src/platform/auth/platform-auth.controller.ts:28 |
| GET | /api/v1/platform/admin/tenants/:id/users/:userId/deletion-preview | ControlPlaneController.userPreview | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:60 |
| POST | /api/v1/platform/admin/tenants/:id/users/:userId/delete | ControlPlaneController.userDelete | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:61 |
| GET | /api/v1/platform/admin/tenants/:id/roles | ControlPlaneController.roles | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:62 |
| PATCH | /api/v1/platform/admin/tenants/:id/users/:userId | ControlPlaneController.editUser | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:63 |
| POST | /api/v1/platform/admin/tenants/:id/users/:userId/role | ControlPlaneController.role | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:71 |
| PATCH | /api/v1/platform/admin/tenants/:id/metadata | ControlPlaneController.metadata | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:80 |
| POST | /api/v1/platform/admin/tenants/:id/users/:userId/credentials | ControlPlaneController.credentialsAction | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:88 |
| GET | /api/v1/platform/admin/tenants/:id/deletion-preview | ControlPlaneController.preview | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:89 |
| POST | /api/v1/platform/admin/tenants/:id/archive | ControlPlaneController.archive | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:90 |
| POST | /api/v1/platform/admin/tenants/:id/restore | ControlPlaneController.restore | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:91 |
| POST | /api/v1/platform/admin/tenants/:id/permanent-delete | ControlPlaneController.purge | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:92 |
| GET | /api/v1/platform/admin/deletion-jobs | ControlPlaneController.deletionJobs | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:93 |
| POST | /api/v1/platform/admin/deletion-jobs/:id/retry | ControlPlaneController.retryDeletion | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:94 |
| GET | /api/v1/platform/admin/account-policy | ControlPlaneController.getPolicy | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:95 |
| POST | /api/v1/platform/admin/account-policy | ControlPlaneController.savePolicy | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:96 |
| GET | /api/v1/platform/admin/referrals | ControlPlaneController.list | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:97 |
| GET | /api/v1/platform/admin/referral-campaigns | ControlPlaneController.campaigns | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:98 |
| POST | /api/v1/platform/admin/referral-campaigns | ControlPlaneController.create | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:99 |
| PATCH | /api/v1/platform/admin/referral-campaigns/:id | ControlPlaneController.update | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:100 |
| POST | /api/v1/platform/admin/referrals/:id/review | ControlPlaneController.review | — | — | S | backend-typescript/src/platform/control-plane.controller.ts:101 |
| GET | /api/v1/retail/referrals | OwnerReferralController.get | — | identity.admin | R / base module permissions | backend-typescript/src/platform/control-plane.controller.ts:108 |
| GET | /api/v1/public/app-information | PublicAppController.information | — | — | H | backend-typescript/src/platform/publishing.controller.ts:26 |
| GET | /api/v1/platform/admin/publishing | PlatformPublishingController.get | — | — | S | backend-typescript/src/platform/publishing.controller.ts:39 |
| POST | /api/v1/platform/admin/publishing | PlatformPublishingController.save | — | — | S | backend-typescript/src/platform/publishing.controller.ts:41 |
| GET | /api/v1/platform/admin/publishing/privacy-requests | PlatformPublishingController.requests | — | — | S | backend-typescript/src/platform/publishing.controller.ts:50 |
| POST | /api/v1/platform/admin/tenants | PlatformAdminController.provisionTenant | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:19 |
| POST | /api/v1/platform/admin/tenants/:id/invite | PlatformAdminController.inviteOwner | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:24 |
| GET | /api/v1/platform/admin/tenants | PlatformAdminController.listTenants | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:36 |
| GET | /api/v1/platform/admin/tenants/:id | PlatformAdminController.getTenant | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:41 |
| PATCH | /api/v1/platform/admin/tenants/:id/status | PlatformAdminController.updateTenantStatus | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:46 |
| POST | /api/v1/platform/admin/tenants/:id/actions | PlatformAdminController.action | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:54 |
| GET | /api/v1/platform/admin/dashboard | PlatformAdminController.dashboard | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:56 |
| GET | /api/v1/platform/admin/backups | PlatformAdminController.backups | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:57 |
| POST | /api/v1/platform/admin/backups | PlatformAdminController.createBackup | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:58 |
| POST | /api/v1/platform/admin/backups/:id/verify | PlatformAdminController.verifyBackup | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:59 |
| POST | /api/v1/platform/admin/backups/:id/restore | PlatformAdminController.restoreBackup | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:60 |
| GET | /api/v1/platform/admin/plans | PlatformAdminController.plans | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:61 |
| POST | /api/v1/platform/admin/plans | PlatformAdminController.createPlan | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:62 |
| PATCH | /api/v1/platform/admin/plans/:id | PlatformAdminController.updatePlan | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:63 |
| GET | /api/v1/platform/admin/features | PlatformAdminController.features | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:64 |
| POST | /api/v1/platform/admin/features | PlatformAdminController.saveFeature | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:65 |
| GET | /api/v1/platform/admin/payments | PlatformAdminController.payments | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:66 |
| POST | /api/v1/platform/admin/payments | PlatformAdminController.recordPayment | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:67 |
| POST | /api/v1/platform/admin/payments/:id/refund | PlatformAdminController.refundPayment | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:68 |
| GET | /api/v1/platform/admin/expenses | PlatformAdminController.expenses | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:69 |
| POST | /api/v1/platform/admin/expenses | PlatformAdminController.recordExpense | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:70 |
| GET | /api/v1/platform/admin/users | PlatformAdminController.users | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:71 |
| GET | /api/v1/platform/admin/sessions | PlatformAdminController.sessions | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:72 |
| GET | /api/v1/platform/admin/support | PlatformAdminController.support | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:73 |
| GET | /api/v1/platform/admin/support/:id/records | PlatformAdminController.supportRecords | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:74 |
| GET | /api/v1/platform/admin/alerts | PlatformAdminController.alerts | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:75 |
| POST | /api/v1/platform/admin/backup-requests/:id/followup | PlatformAdminController.followup | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:76 |
| GET | /api/v1/platform/admin/audit | PlatformAdminController.audit | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:77 |
| GET | /api/v1/platform/admin/infrastructure | PlatformAdminController.infrastructure | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:78 |
| GET | /api/v1/platform/admin/settings | PlatformAdminController.settings | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:79 |
| POST | /api/v1/platform/admin/settings | PlatformAdminController.saveSettings | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:80 |
| GET | /api/v1/platform/admin/announcements | PlatformAdminController.announcements | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:81 |
| POST | /api/v1/platform/admin/announcements | PlatformAdminController.createAnnouncement | — | — | S | backend-typescript/src/platform/tenants/platform-admin.controller.ts:82 |
| POST | /api/v1/erp/pos/sale | PosController.postPosSale | RETAIL_POS | pos.sale.create | R / base module permissions | backend-typescript/src/pos/pos.controller.ts:21 |
| GET | /api/v1/erp/pos/barcode/:sku | PosController.lookupItemByBarcode | RETAIL_POS | pos.sale.create | R / base module permissions | backend-typescript/src/pos/pos.controller.ts:28 |
| POST | /api/v1/erp/pos/return | PosController.postPosReturn | RETAIL_POS | pos.return.create | R / base module permissions | backend-typescript/src/pos/pos.controller.ts:35 |
| GET | /api/v1/erp/pos/shift/current/:branchId | PosController.getCurrentShift | RETAIL_POS | pos.shift.read | R / base module permissions | backend-typescript/src/pos/pos.controller.ts:42 |
| POST | /api/v1/erp/pos/shift/open | PosController.openShift | RETAIL_POS | pos.shift.open | R / base module permissions | backend-typescript/src/pos/pos.controller.ts:49 |
| PATCH | /api/v1/erp/pos/shift/close/:shiftId | PosController.closeShift | RETAIL_POS | pos.shift.close | R / base module permissions | backend-typescript/src/pos/pos.controller.ts:56 |
| GET | /api/v1/erp/pos/held-bills/:branchId | PosController.getHeldBills | RETAIL_POS | pos.sale.create | R / base module permissions | backend-typescript/src/pos/pos.controller.ts:63 |
| POST | /api/v1/erp/pos/held-bills | PosController.holdBill | RETAIL_POS | pos.sale.create | R / base module permissions | backend-typescript/src/pos/pos.controller.ts:70 |
| POST | /api/v1/erp/pos/held-bills/:id/resume | PosController.resumeBill | RETAIL_POS | pos.sale.create | R / base module permissions | backend-typescript/src/pos/pos.controller.ts:77 |
| POST | /api/v1/pricing/price-lists | PricingController.createPriceList | SALES | pricing.price_list.manage | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:36 |
| GET | /api/v1/pricing/price-lists | PricingController.getPriceLists | SALES | pricing.price_list.read | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:42 |
| GET | /api/v1/pricing/price-lists/:id | PricingController.getPriceListById | SALES | pricing.price_list.read | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:48 |
| PATCH | /api/v1/pricing/price-lists/:id | PricingController.updatePriceList | SALES | pricing.price_list.manage | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:54 |
| DELETE | /api/v1/pricing/price-lists/:id | PricingController.deletePriceList | SALES | pricing.price_list.manage | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:60 |
| POST | /api/v1/pricing/price-lists/:id/items | PricingController.addPriceListItem | SALES | pricing.price_list.manage | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:68 |
| PATCH | /api/v1/pricing/price-lists/:id/items/:itemId | PricingController.updatePriceListItem | SALES | pricing.price_list.manage | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:78 |
| DELETE | /api/v1/pricing/price-lists/:id/items/:itemId | PricingController.deletePriceListItem | SALES | pricing.price_list.manage | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:89 |
| POST | /api/v1/pricing/customer-rates | PricingController.createCustomerRate | SALES | pricing.price_list.manage | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:101 |
| GET | /api/v1/pricing/customer-rates | PricingController.getCustomerRates | SALES | pricing.price_list.read | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:107 |
| PATCH | /api/v1/pricing/customer-rates/:id | PricingController.updateCustomerRate | SALES | pricing.price_list.manage | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:113 |
| DELETE | /api/v1/pricing/customer-rates/:id | PricingController.deleteCustomerRate | SALES | pricing.price_list.manage | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:119 |
| POST | /api/v1/pricing/schemes | PricingController.createPromotionScheme | SALES | pricing.scheme.manage | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:127 |
| GET | /api/v1/pricing/schemes | PricingController.getPromotionSchemes | SALES | pricing.scheme.read | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:133 |
| GET | /api/v1/pricing/schemes/:id | PricingController.getPromotionSchemeById | SALES | pricing.scheme.read | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:143 |
| PATCH | /api/v1/pricing/schemes/:id | PricingController.updatePromotionScheme | SALES | pricing.scheme.manage | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:149 |
| DELETE | /api/v1/pricing/schemes/:id | PricingController.deletePromotionScheme | SALES | pricing.scheme.manage | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:159 |
| POST | /api/v1/pricing/evaluate | PricingController.evaluatePricingPreview | SALES | pricing.price_list.read | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:167 |
| GET | /api/v1/pricing/explain/:itemId | PricingController.explainPricing | SALES | pricing.price_list.read | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:173 |
| GET | /api/v1/pricing/traces/:documentType/:documentId | PricingController.getPricingTraces | SALES | pricing.price_list.read | R / base module permissions | backend-typescript/src/pricing/pricing.controller.ts:195 |
| GET | /api/v1/purchase/dashboard | PurchaseController.getDashboard | PURCHASING | purchase.read | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:21 |
| POST | /api/v1/purchase/orders | PurchaseController.createPurchaseOrder | PURCHASING | purchase.create | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:28 |
| GET | /api/v1/purchase/orders | PurchaseController.getPurchaseOrders | PURCHASING | purchase.read | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:53 |
| GET | /api/v1/purchase/orders/:id | PurchaseController.getPurchaseOrderById | PURCHASING | purchase.read | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:59 |
| POST | /api/v1/purchase/orders/:id/convert | PurchaseController.convertPurchaseOrder | PURCHASING | purchase.create | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:66 |
| POST | /api/v1/purchase/receipts | PurchaseController.createGoodsReceipt | PURCHASING | purchase.create | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:73 |
| GET | /api/v1/purchase/receipts | PurchaseController.getGoodsReceipts | PURCHASING | purchase.read | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:79 |
| GET | /api/v1/purchase/receipts/:id | PurchaseController.getGoodsReceiptById | PURCHASING | purchase.read | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:85 |
| POST | /api/v1/purchase/receipts/:id/post | PurchaseController.postGoodsReceipt | PURCHASING | purchase.post | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:91 |
| POST | /api/v1/purchase/receipts/:id/reverse | PurchaseController.reverseGoodsReceipt | PURCHASING | purchase.reverse | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:97 |
| POST | /api/v1/purchase/receipts/:id/convert | PurchaseController.convertGoodsReceipt | PURCHASING | purchase.create | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:103 |
| POST | /api/v1/purchase/invoices | PurchaseController.createPurchaseInvoice | PURCHASING | purchase.create | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:110 |
| GET | /api/v1/purchase/invoices | PurchaseController.getPurchaseInvoices | PURCHASING | purchase.read | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:116 |
| GET | /api/v1/purchase/invoices/:id | PurchaseController.getPurchaseInvoiceById | PURCHASING | purchase.read | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:122 |
| POST | /api/v1/purchase/invoices/:id/post | PurchaseController.postPurchaseInvoice | PURCHASING | purchase.post | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:128 |
| POST | /api/v1/purchase/invoices/:id/reverse | PurchaseController.reversePurchaseInvoice | PURCHASING | purchase.reverse | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:134 |
| GET | /api/v1/purchase/invoices/:id/match | PurchaseController.check3WayMatch | PURCHASING | purchase.read | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:140 |
| POST | /api/v1/purchase/returns | PurchaseController.createPurchaseReturn | PURCHASING | purchase.create | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:147 |
| GET | /api/v1/purchase/returns | PurchaseController.getPurchaseReturns | PURCHASING | purchase.read | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:153 |
| GET | /api/v1/purchase/returns/:id | PurchaseController.getPurchaseReturnById | PURCHASING | purchase.read | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:159 |
| POST | /api/v1/purchase/returns/:id/post | PurchaseController.postPurchaseReturn | PURCHASING | purchase.post | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:165 |
| POST | /api/v1/purchase/returns/:id/reverse | PurchaseController.reversePurchaseReturn | PURCHASING | purchase.reverse | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:171 |
| POST | /api/v1/purchase/returns/:id/replace | PurchaseController.replaceReturn | PURCHASING | purchase.create | R / base module permissions | backend-typescript/src/purchase/purchase.controller.ts:177 |
| GET | /api/v1/retail/account/entitlements | RetailAccountController.entitlementsForShop | — | — | X | backend-typescript/src/retail/account/account.controller.ts:30 |
| GET | /api/v1/retail/account/billing-preferences | RetailAccountController.billingPreferences | — | — | X | backend-typescript/src/retail/account/account.controller.ts:32 |
| POST | /api/v1/retail/account/billing-preferences | RetailAccountController.saveBillingPreferences | — | — | X | backend-typescript/src/retail/account/account.controller.ts:37 |
| POST | /api/v1/retail/account/features/:code | RetailAccountController.toggleFeature | — | — | X | backend-typescript/src/retail/account/account.controller.ts:49 |
| GET | /api/v1/retail/account/subscription | RetailAccountController.subscription | — | — | X | backend-typescript/src/retail/account/account.controller.ts:68 |
| GET | /api/v1/retail/account/migration | RetailAccountController.migration | — | — | X | backend-typescript/src/retail/account/account.controller.ts:80 |
| POST | /api/v1/retail/account/migration | RetailAccountController.chooseMigration | — | — | X | backend-typescript/src/retail/account/account.controller.ts:85 |
| GET | /api/v1/retail/account/backup-requests | RetailAccountController.backupRequests | — | — | X | backend-typescript/src/retail/account/account.controller.ts:91 |
| POST | /api/v1/retail/account/backup-requests | RetailAccountController.backupRequest | — | — | X | backend-typescript/src/retail/account/account.controller.ts:96 |
| GET | /api/v1/retail/account | RetailAccountController.summary | — | — | X | backend-typescript/src/retail/account/account.controller.ts:110 |
| GET | /api/v1/retail/account/privacy-requests | RetailAccountController.requests | — | — | X | backend-typescript/src/retail/account/account.controller.ts:128 |
| POST | /api/v1/retail/account/privacy-requests | RetailAccountController.request | — | — | X | backend-typescript/src/retail/account/account.controller.ts:132 |
| GET | /api/v1/retail/account/export | RetailAccountController.export | — | — | X | backend-typescript/src/retail/account/account.controller.ts:145 |
| GET | /api/v1/retail/account/exports/:kind | RetailExportController.export | — | — | X | backend-typescript/src/retail/account/export.controller.ts:31 |
| GET | /api/v1/retail/bills | BillingController.getBills | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/billing/billing.controller.ts:16 |
| GET | /api/v1/retail/bills/hold | BillingController.getHeldBills | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/billing/billing.controller.ts:22 |
| GET | /api/v1/retail/bills/:id | BillingController.getBillDetail | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/billing/billing.controller.ts:28 |
| POST | /api/v1/retail/bills | BillingController.createBill | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/billing/billing.controller.ts:34 |
| POST | /api/v1/retail/bills/amount-sale | BillingController.createAmountSale | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/billing/billing.controller.ts:40 |
| POST | /api/v1/retail/bills/quote | BillingController.quoteBill | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/billing/billing.controller.ts:45 |
| POST | /api/v1/retail/bills/hold | BillingController.holdBill | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/billing/billing.controller.ts:50 |
| POST | /api/v1/retail/bills/hold/:id/resume | BillingController.resumeBill | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/billing/billing.controller.ts:56 |
| POST | /api/v1/retail/bills/return | BillingController.postReturn | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/billing/billing.controller.ts:62 |
| GET | /api/v1/retail/calendar | RetailCalendarController.calendar | RETAIL_POS | accounting.read | R / base module permissions | backend-typescript/src/retail/calendar/calendar.controller.ts:44 |
| POST | /api/v1/retail/calendar/tasks | RetailCalendarController.createTask | RETAIL_POS | sales.write | R / base module permissions | backend-typescript/src/retail/calendar/calendar.controller.ts:70 |
| PATCH | /api/v1/retail/calendar/tasks/:id | RetailCalendarController.completeTask | RETAIL_POS | sales.write | R / base module permissions | backend-typescript/src/retail/calendar/calendar.controller.ts:75 |
| PATCH | /api/v1/retail/calendar/suppliers/:id | RetailCalendarController.visit | RETAIL_POS | purchase.write | R / base module permissions | backend-typescript/src/retail/calendar/calendar.controller.ts:80 |
| PATCH | /api/v1/retail/calendar/receivables/:id | RetailCalendarController.promise | RETAIL_POS | sales.write | R / base module permissions | backend-typescript/src/retail/calendar/calendar.controller.ts:85 |
| GET | /api/v1/retail/checkout-voice | RetailCalendarController.voice | RETAIL_POS | sales.read | R / base module permissions | backend-typescript/src/retail/calendar/calendar.controller.ts:98 |
| POST | /api/v1/retail/checkout-voice | RetailCalendarController.saveVoice | RETAIL_POS | settings.write | R / base module permissions | backend-typescript/src/retail/calendar/calendar.controller.ts:103 |
| GET | /api/v1/retail/payments/upi | CounterController.upi | RETAIL_POS | sales.read | R / base module permissions | backend-typescript/src/retail/counter/counter.controller.ts:10 |
| POST | /api/v1/retail/payments/upi | CounterController.save | RETAIL_POS | settings.write | R / base module permissions | backend-typescript/src/retail/counter/counter.controller.ts:12 |
| GET | /api/v1/retail/payments/upi/qr | CounterController.qr | RETAIL_POS | sales.read | R / base module permissions | backend-typescript/src/retail/counter/counter.controller.ts:14 |
| GET | /api/v1/retail/galla | CounterController.galla | RETAIL_POS | accounting.read | R / base module permissions | backend-typescript/src/retail/counter/counter.controller.ts:16 |
| POST | /api/v1/retail/galla/count | CounterController.count | RETAIL_POS | accounting.write | R / base module permissions | backend-typescript/src/retail/counter/counter.controller.ts:18 |
| GET | /api/v1/retail/galla/history | CounterController.history | RETAIL_POS | accounting.read | R / base module permissions | backend-typescript/src/retail/counter/counter.controller.ts:20 |
| POST | /api/v1/retail/expense-categories/initialize-defaults | ExpenseCategoriesController.initializeDefaults | EXPENSES | accounting.write | R / base module permissions | backend-typescript/src/retail/expenses/categories/expense-categories.controller.ts:14 |
| POST | /api/v1/retail/expense-categories | ExpenseCategoriesController.create | EXPENSES | — | R / base module permissions | backend-typescript/src/retail/expenses/categories/expense-categories.controller.ts:21 |
| GET | /api/v1/retail/expense-categories | ExpenseCategoriesController.findAll | EXPENSES | — | R / base module permissions | backend-typescript/src/retail/expenses/categories/expense-categories.controller.ts:31 |
| PATCH | /api/v1/retail/expense-categories/:id | ExpenseCategoriesController.update | EXPENSES | — | R / base module permissions | backend-typescript/src/retail/expenses/categories/expense-categories.controller.ts:36 |
| POST | /api/v1/retail/expenses | ExpensesController.create | EXPENSES | — | R / base module permissions | backend-typescript/src/retail/expenses/expenses.controller.ts:13 |
| GET | /api/v1/retail/expenses | ExpensesController.findAll | EXPENSES | — | R / base module permissions | backend-typescript/src/retail/expenses/expenses.controller.ts:31 |
| GET | /api/v1/retail/expenses/summary | ExpensesController.getSummary | EXPENSES | — | R / base module permissions | backend-typescript/src/retail/expenses/expenses.controller.ts:36 |
| GET | /api/v1/retail/expenses/:id | ExpensesController.findOne | EXPENSES | — | R / base module permissions | backend-typescript/src/retail/expenses/expenses.controller.ts:41 |
| PATCH | /api/v1/retail/expenses/:id | ExpensesController.update | EXPENSES | — | R / base module permissions | backend-typescript/src/retail/expenses/expenses.controller.ts:46 |
| DELETE | /api/v1/retail/expenses/:id | ExpensesController.remove | EXPENSES | — | R / base module permissions | backend-typescript/src/retail/expenses/expenses.controller.ts:63 |
| GET | /api/v1/retail/gst/profile | RetailGstController.profile | RETAIL_POS | sales.read | R / base module permissions | backend-typescript/src/retail/gst/gst.controller.ts:13 |
| PUT | /api/v1/retail/gst/profile | RetailGstController.saveProfile | RETAIL_POS, GST_INVOICES | settings.write | R / base module permissions | backend-typescript/src/retail/gst/gst.controller.ts:15 |
| GET | /api/v1/retail/gst/bills | RetailGstController.bills | RETAIL_POS | sales.read | R / base module permissions | backend-typescript/src/retail/gst/gst.controller.ts:18 |
| GET | /api/v1/retail/gst/bills/:id | RetailGstController.draft | RETAIL_POS | sales.read | R / base module permissions | backend-typescript/src/retail/gst/gst.controller.ts:20 |
| POST | /api/v1/retail/gst/bills/:id/preview | RetailGstController.preview | RETAIL_POS, GST_INVOICES | sales.read | R / base module permissions | backend-typescript/src/retail/gst/gst.controller.ts:22 |
| POST | /api/v1/retail/gst/bills/:id/issue | RetailGstController.issue | RETAIL_POS, GST_INVOICES | sales.write | R / base module permissions | backend-typescript/src/retail/gst/gst.controller.ts:25 |
| GET | /api/v1/retail/imports/presets | RetailImportController.presets | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/imports/import.controller.ts:15 |
| GET | /api/v1/retail/imports | RetailImportController.history | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/imports/import.controller.ts:16 |
| POST | /api/v1/retail/imports/preview | RetailImportController.preview | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/imports/import.controller.ts:17 |
| GET | /api/v1/retail/imports/:id | RetailImportController.job | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/imports/import.controller.ts:20 |
| POST | /api/v1/retail/imports/:id/commit | RetailImportController.commit | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/imports/import.controller.ts:21 |
| GET | /api/v1/retail/reports/financial/filters | FinancialReportsController.filters | REPORTS, PROFIT_REPORTING | reports.read | R / base module permissions | backend-typescript/src/retail/reports/financial-reports.controller.ts:39 |
| GET | /api/v1/retail/reports/financial/summary | FinancialReportsController.summary | REPORTS, PROFIT_REPORTING | reports.read | R / base module permissions | backend-typescript/src/retail/reports/financial-reports.controller.ts:40 |
| GET | /api/v1/retail/reports/financial/valuation | FinancialReportsController.valuation | REPORTS, PROFIT_REPORTING | reports.read | R / base module permissions | backend-typescript/src/retail/reports/financial-reports.controller.ts:41 |
| GET | /api/v1/retail/reports/financial/coverage | FinancialReportsController.coverage | REPORTS, PROFIT_REPORTING | reports.read | R / base module permissions | backend-typescript/src/retail/reports/financial-reports.controller.ts:42 |
| POST | /api/v1/retail/reports/financial/missing-cost | FinancialReportsController.correct | REPORTS, PROFIT_REPORTING | reports.read, inventory.write | R / base module permissions | backend-typescript/src/retail/reports/financial-reports.controller.ts:43 |
| GET | /api/v1/retail/reports/financial/:group | FinancialReportsController.grouped | REPORTS, PROFIT_REPORTING | reports.read | R / base module permissions | backend-typescript/src/retail/reports/financial-reports.controller.ts:45 |
| POST | /api/v1/retail/reports/assistant/query | ReportAssistantController.query | RETAIL_POS | reports.read | R / base module permissions | backend-typescript/src/retail/reports/report-assistant.controller.ts:15 |
| GET | /api/v1/retail/reports/assistant/preference | ReportAssistantController.preference | RETAIL_POS | reports.read | R / base module permissions | backend-typescript/src/retail/reports/report-assistant.controller.ts:16 |
| POST | /api/v1/retail/reports/assistant/preference | ReportAssistantController.save | RETAIL_POS | reports.read | R / base module permissions | backend-typescript/src/retail/reports/report-assistant.controller.ts:17 |
| GET | /api/v1/retail/reports/assistant/notifications | ReportAssistantController.inbox | RETAIL_POS | reports.read | R / base module permissions | backend-typescript/src/retail/reports/report-assistant.controller.ts:18 |
| POST | /api/v1/retail/reports/assistant/notifications/:id/read | ReportAssistantController.read | RETAIL_POS | reports.read | R / base module permissions | backend-typescript/src/retail/reports/report-assistant.controller.ts:19 |
| GET | /api/v1/retail/reports/dashboard | ReportsController.getDashboard | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/reports/reports.controller.ts:14 |
| GET | /api/v1/retail/reports/sales | ReportsController.getSalesReport | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/reports/reports.controller.ts:20 |
| GET | /api/v1/retail/reports/sales/items | ReportsController.getTopItemsReport | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/reports/reports.controller.ts:26 |
| GET | /api/v1/retail/reports/purchases | ReportsController.getPurchaseReport | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/reports/reports.controller.ts:32 |
| GET | /api/v1/retail/reports/expenses | ReportsController.getExpenseReport | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/reports/reports.controller.ts:38 |
| GET | /api/v1/retail/reports/stock | ReportsController.getStockReport | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/reports/reports.controller.ts:44 |
| GET | /api/v1/retail/reports/customers/due | ReportsController.getCustomerDueReport | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/reports/reports.controller.ts:50 |
| GET | /api/v1/retail/reports/suppliers/due | ReportsController.getSupplierDueReport | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/reports/reports.controller.ts:56 |
| GET | /api/v1/retail/reports/returns | ReportsController.getReturnsReport | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/reports/reports.controller.ts:62 |
| GET | /api/v1/retail/units | RetailController.getUnits | RETAIL_POS, INVENTORY | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:42 |
| GET | /api/v1/retail/items | RetailController.getItems | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:48 |
| POST | /api/v1/retail/items | RetailController.createItem | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:58 |
| GET | /api/v1/retail/item-categories | RetailController.getItemCategories | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:71 |
| GET | /api/v1/retail/items/:id/options | RetailController.getItemOptions | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:84 |
| POST | /api/v1/retail/items/:id | RetailController.updateItem | RETAIL_POS | inventory.write | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:93 |
| DELETE | /api/v1/retail/items/:id | RetailController.removeItem | RETAIL_POS | inventory.write | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:103 |
| PATCH | /api/v1/retail/customers/:id | RetailController.updateCustomer | RETAIL_POS | accounting.write | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:109 |
| DELETE | /api/v1/retail/customers/:id | RetailController.removeCustomer | RETAIL_POS | accounting.write | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:114 |
| PATCH | /api/v1/retail/suppliers/:id | RetailController.updateSupplier | RETAIL_POS | purchase.write | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:119 |
| DELETE | /api/v1/retail/suppliers/:id | RetailController.removeSupplier | RETAIL_POS | purchase.write | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:124 |
| GET | /api/v1/retail/warranty | RetailController.lookupWarranty | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:131 |
| GET | /api/v1/retail/customers | RetailController.getCustomers | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:136 |
| POST | /api/v1/retail/customers | RetailController.createCustomer | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:146 |
| GET | /api/v1/retail/customers/:id/khata | RetailController.getCustomerKhata | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:157 |
| POST | /api/v1/retail/customers/:id/payments | RetailController.receivePayment | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:163 |
| GET | /api/v1/retail/suppliers | RetailController.getSuppliers | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:183 |
| POST | /api/v1/retail/suppliers | RetailController.createSupplier | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:193 |
| GET | /api/v1/retail/suppliers/:id/khata | RetailController.getSupplierKhata | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:203 |
| POST | /api/v1/retail/suppliers/:id/payments | RetailController.paySupplier | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:209 |
| GET | /api/v1/retail/purchases | RetailController.getPurchases | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:229 |
| POST | /api/v1/retail/purchases | RetailController.createPurchase | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:235 |
| GET | /api/v1/retail/needs | RetailController.getNeeds | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:250 |
| POST | /api/v1/retail/needs | RetailController.createNeed | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:256 |
| POST | /api/v1/retail/needs/:id/status | RetailController.updateNeedStatus | RETAIL_POS | — | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:262 |
| PATCH | /api/v1/retail/needs/:id | RetailController.updateNeed | RETAIL_POS | inventory.write | R / base module permissions | backend-typescript/src/retail/retail.controller.ts:272 |
| GET | /api/v1/sales/dashboard | SalesController.getDashboard | SALES | sales.read | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:31 |
| POST | /api/v1/sales/quotations | SalesController.createQuotation | SALES | sales.create | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:61 |
| GET | /api/v1/sales/quotations | SalesController.getQuotations | SALES | sales.read | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:67 |
| GET | /api/v1/sales/quotations/:id | SalesController.getQuotation | SALES | sales.read | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:73 |
| POST | /api/v1/sales/quotations/:id/status | SalesController.updateQuotationStatus | SALES | sales.post | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:79 |
| POST | /api/v1/sales/quotations/:id/convert | SalesController.convertQuotation | SALES | sales.create | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:85 |
| POST | /api/v1/sales/orders | SalesController.createOrder | SALES | sales.create | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:93 |
| GET | /api/v1/sales/orders | SalesController.getOrders | SALES | sales.read | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:99 |
| GET | /api/v1/sales/orders/:id | SalesController.getOrder | SALES | sales.read | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:105 |
| POST | /api/v1/sales/orders/:id/confirm | SalesController.confirmOrder | SALES | sales.post | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:111 |
| POST | /api/v1/sales/orders/:id/convert | SalesController.convertOrder | SALES | sales.create | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:117 |
| POST | /api/v1/sales/challans | SalesController.createChallan | SALES | sales.create | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:125 |
| GET | /api/v1/sales/challans | SalesController.getChallans | SALES | sales.read | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:131 |
| GET | /api/v1/sales/challans/:id | SalesController.getChallan | SALES | sales.read | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:137 |
| POST | /api/v1/sales/challans/:id/post | SalesController.postChallan | SALES | sales.post | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:143 |
| POST | /api/v1/sales/challans/:id/convert | SalesController.convertChallan | SALES | sales.create | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:149 |
| POST | /api/v1/sales/invoices | SalesController.createInvoice | SALES | sales.create | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:157 |
| GET | /api/v1/sales/invoices | SalesController.getInvoices | SALES | sales.read | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:163 |
| GET | /api/v1/sales/invoices/:id | SalesController.getInvoice | SALES | sales.read | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:169 |
| POST | /api/v1/sales/invoices/:id/post | SalesController.postInvoice | SALES | sales.post | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:175 |
| POST | /api/v1/sales/invoices/:id/reverse | SalesController.reverseInvoice | SALES | sales.reverse | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:181 |
| POST | /api/v1/sales/returns | SalesController.createReturn | SALES | sales.return | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:189 |
| GET | /api/v1/sales/returns | SalesController.getReturns | SALES | sales.read | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:195 |
| GET | /api/v1/sales/returns/:id | SalesController.getReturn | SALES | sales.read | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:201 |
| POST | /api/v1/sales/returns/:id/post | SalesController.postReturn | SALES | sales.post | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:207 |
| POST | /api/v1/sales/returns/:id/replace | SalesController.replaceReturn | SALES | sales.create | R / base module permissions | backend-typescript/src/sales/sales.controller.ts:213 |
| GET | /api/v1/users | UsersController.list | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:10 |
| GET | /api/v1/users/:id | UsersController.get | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:11 |
| POST | /api/v1/users | UsersController.create | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:12 |
| PATCH | /api/v1/users/:id | UsersController.update | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:13 |
| DELETE | /api/v1/users/:id | UsersController.archive | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:15 |
| PATCH | /api/v1/users/:id/disable | UsersController.disable | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:16 |
| PATCH | /api/v1/users/:id/enable | UsersController.enable | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:17 |
| PATCH | /api/v1/users/:id/unlock | UsersController.unlock | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:18 |
| PATCH | /api/v1/users/:id/reset-password | UsersController.password | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:19 |
| POST | /api/v1/users/:id/roles | UsersController.role | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:20 |
| DELETE | /api/v1/users/:id/roles/:roleId | UsersController.removeRole | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:21 |
| GET | /api/v1/users/:id/sessions | UsersController.sessions | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:22 |
| POST | /api/v1/users/:id/sessions/revoke-all | UsersController.revoke | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:23 |
| GET | /api/v1/roles | RolesController.list | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:29 |
| GET | /api/v1/roles/:id | RolesController.get | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:30 |
| POST | /api/v1/roles | RolesController.create | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:31 |
| PATCH | /api/v1/roles/:id | RolesController.update | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:32 |
| DELETE | /api/v1/roles/:id | RolesController.remove | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:33 |
| GET | /api/v1/roles/:id/users | RolesController.users | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:34 |
| POST | /api/v1/roles/:id/permissions | RolesController.permission | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:35 |
| DELETE | /api/v1/roles/:id/permissions/:code | RolesController.removePermission | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:36 |
| GET | /api/v1/permissions | PermissionsController.list | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:42 |
| GET | /api/v1/sessions | SessionsController.list | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:48 |
| POST | /api/v1/sessions/:id/revoke | SessionsController.revoke | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:49 |
| GET | /api/v1/organizations | OrganizationsController.list | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:55 |
| GET | /api/v1/organizations/:id | OrganizationsController.get | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:56 |
| PATCH | /api/v1/organizations/:id | OrganizationsController.update | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:57 |
| POST | /api/v1/organizations | OrganizationsController.create | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:58 |
| PATCH | /api/v1/organizations/:id/disable | OrganizationsController.disable | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:59 |
| PATCH | /api/v1/organizations/:id/enable | OrganizationsController.enable | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:60 |
| DELETE | /api/v1/organizations/:id | OrganizationsController.delete | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:61 |
| GET | /api/v1/companies | CompaniesController.list | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:67 |
| GET | /api/v1/companies/:id | CompaniesController.get | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:68 |
| POST | /api/v1/companies | CompaniesController.create | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:69 |
| PATCH | /api/v1/companies/:id | CompaniesController.update | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:70 |
| PATCH | /api/v1/companies/:id/disable | CompaniesController.disable | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:71 |
| PATCH | /api/v1/companies/:id/enable | CompaniesController.enable | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:72 |
| DELETE | /api/v1/companies/:id | CompaniesController.archive | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:73 |
| GET | /api/v1/branches | BranchesController.list | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:79 |
| GET | /api/v1/branches/:id | BranchesController.get | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:80 |
| POST | /api/v1/branches | BranchesController.create | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:81 |
| PATCH | /api/v1/branches/:id | BranchesController.update | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:82 |
| PATCH | /api/v1/branches/:id/disable | BranchesController.disable | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:83 |
| PATCH | /api/v1/branches/:id/enable | BranchesController.enable | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:84 |
| DELETE | /api/v1/branches/:id | BranchesController.archive | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:85 |
| GET | /api/v1/godowns | GodownsController.list | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:91 |
| GET | /api/v1/godowns/:id | GodownsController.get | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:92 |
| POST | /api/v1/godowns | GodownsController.create | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:93 |
| PATCH | /api/v1/godowns/:id | GodownsController.update | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:94 |
| PATCH | /api/v1/godowns/:id/disable | GodownsController.disable | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:95 |
| PATCH | /api/v1/godowns/:id/enable | GodownsController.enable | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:96 |
| DELETE | /api/v1/godowns/:id | GodownsController.archive | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:97 |
| GET | /api/v1/financial-years | FinancialYearsController.list | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:103 |
| GET | /api/v1/financial-years/:id | FinancialYearsController.get | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:104 |
| POST | /api/v1/financial-years | FinancialYearsController.create | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:105 |
| PATCH | /api/v1/financial-years/:id/activate | FinancialYearsController.activate | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:106 |
| PATCH | /api/v1/financial-years/:id/close | FinancialYearsController.close | — | — | T | backend-typescript/src/tenant-administration/tenant-administration.controller.ts:107 |

### Extra active ERP backend capabilities without complete Retail screens

Purchase orders/receipts/invoices and conversions/returns/replacements; sales quotations/orders/challans/invoices and conversions/returns/replacements; POS shifts; opening/count/adjustment/transfer posting/reversal; chart/ledger/outstanding/credit/vouchers/reversal/trial balance; barcode templates/product/inward labels; price lists/customer rates/promotions/traces; bank accounts/cheques; reconciliation schema only; claims/events. Actual endpoints are above. Modern Retail frontend absent/incomplete for these full flows: BACKEND_ONLY or LEGACY. Claims has missing RETURNS_CLAIMS grant. No online subscription-payment webhook or incoming WhatsApp assistant webhook endpoint.

## 26. All 96 registered deterministic assistant intents

Counts below are authored source examples per intent. Runtime aliases create additional examples; local active expanded/deduplicated total 843 is separate. Every tool additionally requires ASSISTANT_TEXT and current access; insight category adds BUSINESS_INSIGHTS, financial category adds PROFIT_REPORTING. Entity lookup is scoped and permission-aware. Active flags/examples are operator configurable; source registration does not force active UI after operator changes.

| Intent key | Public/internal name | Category | Module feature | Required permissions | Entity | Source example entries |
|---|---|---|---|---|---|---|
| PROFIT_SUMMARY | Profit summary | financial | REPORTS | reports.read | — | 6 |
| TOP_PROFIT_ITEMS | Most profitable items | financial | REPORTS | reports.read | — | 3 |
| GROSS_PROFIT | Gross profit | financial | REPORTS | reports.read | — | 3 |
| NET_PROFIT | Net business profit | financial | REPORTS | reports.read | — | 3 |
| GROSS_MARGIN | Gross margin | financial | REPORTS | reports.read | — | 3 |
| ITEM_PROFIT | Item profit | financial | REPORTS | reports.read | item | 4 |
| BILL_PROFIT | Bill profit | financial | REPORTS | reports.read | bill | 3 |
| CATEGORY_PROFIT | Category profit | financial | REPORTS | reports.read | — | 3 |
| LOW_MARGIN_ITEMS | Low margin items | financial | REPORTS | reports.read | — | 3 |
| BELOW_COST_SALES | Below cost sales | financial | REPORTS | reports.read | — | 3 |
| SALES_SUMMARY | Sales summary | sales | REPORTS | reports.read | — | 12 |
| CASH_SALES | Cash sales | sales | REPORTS | reports.read | — | 11 |
| UPI_SALES | UPI sales | sales | REPORTS | reports.read | — | 11 |
| CARD_SALES | Card sales | sales | REPORTS | reports.read | — | 10 |
| BANK_SALES | Bank sales | sales | REPORTS | reports.read | — | 10 |
| UDHAR_SALES | Credit given at billing | sales | REPORTS | reports.read | — | 10 |
| BILL_COUNT | Bill count | sales | REPORTS | reports.read | — | 10 |
| UDHAR_BILL_COUNT | Credit bill count | sales | REPORTS | reports.read | — | 10 |
| TOP_SELLING_ITEMS | Top selling items | sales | REPORTS | reports.read | — | 10 |
| ITEM_SALES | Sales for an item | sales | REPORTS | reports.read | item | 10 |
| CUSTOMER_SALES | Customer purchases from shop | sales | REPORTS | reports.read | customer | 10 |
| STAFF_SALES | Staff sales | sales | REPORTS | reports.read | staff | 10 |
| BILL_LOOKUP | Find a bill | sales | RETAIL_POS | sales.read | bill | 10 |
| DAILY_GALLA | Daily Galla | galla | ACCOUNTING | accounting.read | — | 11 |
| EXPECTED_CASH | Expected counter cash | galla | ACCOUNTING | accounting.read | — | 10 |
| OPENING_CASH | Opening cash | galla | ACCOUNTING | accounting.read | — | 10 |
| CASH_RECEIVED | Actual cash received | galla | ACCOUNTING | accounting.read | — | 10 |
| UPI_RECEIVED | UPI received including collections | galla | ACCOUNTING | accounting.read | — | 10 |
| CUSTOMER_DUE_RECEIVED | Old customer dues received | galla | ACCOUNTING | accounting.read | — | 10 |
| CUSTOMER_BALANCE | Customer balance | customer | KHATA | accounting.read | customer | 11 |
| CUSTOMER_TOTAL_DUE | All customer dues | customer | KHATA | accounting.read | — | 10 |
| CUSTOMER_KHATA | Customer Khata | customer | KHATA | accounting.read | customer | 10 |
| CUSTOMER_PAYMENT_RECEIVED | Payments from a customer | customer | KHATA | accounting.read | customer | 10 |
| CUSTOMER_OVERDUE | Overdue customer bills | customer | KHATA | accounting.read | — | 10 |
| SUPPLIER_BALANCE | Supplier balance | supplier | PURCHASING | purchase.read | supplier | 10 |
| SUPPLIER_TOTAL_DUE | All supplier dues | supplier | PURCHASING | purchase.read | — | 10 |
| SUPPLIER_KHATA | Supplier Khata | supplier | PURCHASING | purchase.read | supplier | 10 |
| SUPPLIER_PAYMENT_SUMMARY | Supplier payments | supplier | PURCHASING | purchase.read | — | 10 |
| SUPPLIER_PURCHASE_SUMMARY | Purchases from a supplier | purchase | PURCHASING | purchase.read | supplier | 10 |
| ITEM_STOCK | Item stock | inventory | INVENTORY | inventory.read | item | 10 |
| LOW_STOCK | Low stock | inventory | INVENTORY | inventory.read | — | 11 |
| OUT_OF_STOCK | Out of stock | inventory | INVENTORY | inventory.read | — | 10 |
| STOCK_SUMMARY | Stock overview | inventory | INVENTORY | inventory.read | — | 10 |
| EXPIRING_ITEMS | Soon expiring stock | inventory | BATCH_TRACKING | inventory.read | — | 10 |
| EXPIRED_ITEMS | Expired stock | inventory | BATCH_TRACKING | inventory.read | — | 10 |
| BATCH_STOCK | Item batch stock | inventory | BATCH_TRACKING | inventory.read | item | 10 |
| LOCATION_STOCK | Location stock | inventory | MULTIPLE_STOCK_LOCATIONS | inventory.read | location | 10 |
| PURCHASE_SUMMARY | Purchase summary | purchase | PURCHASING | purchase.read | — | 11 |
| NEW_STOCK_RECEIVED | New stock received | purchase | PURCHASING | purchase.read | — | 10 |
| EXPENSE_SUMMARY | Business expenses | expense | EXPENSES | accounting.read | — | 11 |
| EXPENSE_BY_CATEGORY | Expense category | expense | EXPENSES | accounting.read | category | 10 |
| OWNER_WITHDRAWAL_SUMMARY | Owner withdrawals | expense | EXPENSES | accounting.read | — | 10 |
| NEED_LIST | Need List | needs | INVENTORY | inventory.read | — | 11 |
| URGENT_NEEDS | Urgent needs | needs | INVENTORY | inventory.read | — | 10 |
| PENDING_NEEDS | Pending needs | needs | INVENTORY | inventory.read | — | 10 |
| RETURN_SUMMARY | Return amount | returns | REPORTS | reports.read | — | 11 |
| RETURN_COUNT | Return count | returns | REPORTS | reports.read | — | 10 |
| SUBSCRIPTION_STATUS | Subscription status | subscription | RETAIL_POS | settings.read | — | 10 |
| SUBSCRIPTION_EXPIRY | Subscription expiry | subscription | RETAIL_POS | settings.read | — | 10 |
| CURRENT_PLAN | Current plan | subscription | RETAIL_POS | settings.read | — | 10 |
| WHY_SALES_DOWN | Why sales changed | insight | REPORTS | reports.read | — | 5 |
| WHY_SALES_UP | Why sales increased | insight | REPORTS | reports.read | — | 4 |
| COMPARE_SALES | Compare sales periods | insight | REPORTS | reports.read | — | 4 |
| SALES_TREND | Sales trend | insight | REPORTS | reports.read | — | 4 |
| WHY_PROFIT_DOWN | Why profit changed | insight | REPORTS | reports.read | — | 4 |
| WHY_PROFIT_UP | Why profit increased | insight | REPORTS | reports.read | — | 3 |
| COMPARE_PROFIT | Compare profit periods | insight | REPORTS | reports.read | — | 3 |
| PROFIT_TREND | Profit trend | insight | REPORTS | reports.read | — | 3 |
| SALES_VS_PROFIT_EXPLANATION | Sales rose but profit fell | insight | REPORTS | reports.read | — | 3 |
| MARGIN_CHANGE_EXPLANATION | Margin change explanation | insight | REPORTS | reports.read | — | 3 |
| COGS_CHANGE_EXPLANATION | Cost change explanation | insight | REPORTS | reports.read | — | 3 |
| ITEM_PROFIT_DECLINE | Item profit changes | insight | REPORTS | reports.read | — | 3 |
| ITEM_MARGIN_DECLINE | Item margin changes | insight | REPORTS | reports.read | — | 3 |
| CATEGORY_PROFIT_DECLINE | Category profit changes | insight | REPORTS | reports.read | — | 3 |
| CATEGORY_MARGIN_DECLINE | Category margin changes | insight | REPORTS | reports.read | — | 2 |
| LOW_MARGIN_ITEMS_ANALYSIS | Low margin item analysis | insight | REPORTS | reports.read | — | 3 |
| LOSS_MAKING_ITEMS_ANALYSIS | Loss making item analysis | insight | REPORTS | reports.read | — | 3 |
| COMPARE_EXPENSES | Compare expenses | insight | EXPENSES | accounting.read | — | 3 |
| WHY_EXPENSES_UP | Why expenses increased | insight | EXPENSES | accounting.read | — | 3 |
| COMPARE_PURCHASES | Compare purchases | insight | PURCHASING | purchase.read | — | 3 |
| ITEM_SALES_DECLINE | Declining item sales | insight | REPORTS | reports.read | — | 3 |
| ITEM_SALES_GROWTH | Growing item sales | insight | REPORTS | reports.read | — | 3 |
| CATEGORY_SALES_DECLINE | Declining category sales | insight | REPORTS | reports.read | — | 2 |
| CATEGORY_SALES_GROWTH | Growing category sales | insight | REPORTS | reports.read | — | 2 |
| STAFF_PERFORMANCE_COMPARE | Compare staff performance | insight | REPORTS | reports.read | — | 3 |
| CUSTOMER_ACTIVITY_CHANGE | Customer activity changes | insight | REPORTS | reports.read | — | 2 |
| CUSTOMER_RECEIVABLE_GROWTH | Customer receivable changes | insight | KHATA | accounting.read | — | 3 |
| SUPPLIER_PAYABLE_CHANGE | Supplier payable changes | insight | PURCHASING | purchase.read | — | 3 |
| STOCKOUT_IMPACT | Stock availability signals | insight | INVENTORY | inventory.read,reports.read | — | 3 |
| RETURN_IMPACT | Return impact analysis | insight | REPORTS | reports.read | — | 3 |
| CASH_VS_SALES_EXPLANATION | Cash versus sales | insight | ACCOUNTING | accounting.read | — | 3 |
| PROFIT_VS_CASH_EXPLANATION | Profit versus cash | insight | ACCOUNTING | accounting.read | — | 3 |
| WHERE_MONEY_WENT | Where money went | insight | ACCOUNTING | accounting.read | — | 3 |
| BUSINESS_HEALTH_SIGNALS | Business health summary | insight | REPORTS | reports.read,accounting.read | — | 3 |
| BUSINESS_PROBLEM_SIGNALS | Business problem signals | insight | REPORTS | reports.read,accounting.read | — | 4 |
| WEEKDAY_SALES_ANALYSIS | Sales by weekday | insight | REPORTS | reports.read | — | 3 |

Category counts: financial=10, sales=13, galla=6, customer=5, supplier=4, purchase=3, inventory=8, expense=3, needs=3, returns=2, subscription=3, insight=36. Source `assistant/intent-library.ts`; response/tool support and extra gates from `tool-registry.service.ts`, `business-insight.service.ts`, `assistant.service.ts`.

## 27. Complete relevant automated test source inventory

**No tests were executed in this read-only audit. Tests Passed: NOT RUN; Tests Failed: NOT RUN; Exit code: NOT RUN.** No previous PASS result is used as verification. The static inventory finds86 spec files:36 backend source specs,30 backend HTTP e2e specs,20 frontend Playwright specs. These contain832 directly recognizable it/test declarations (281/436/115 respectively), including parameterized declarations. Actual runtime case count is different where loops, each, dynamic generated cases or project configurations expand the suite. Absence of a statically counted `.skip` does not prove no runtime/provider skips. Some backend source specs require DB setup and are integration tests, not pure unit tests.

| Spec file | Static it/test declarations | Explicit skip/todo/fixme declarations | Parameterized declarations counted | Evidence / execution |
|---|---:|---:|---:|---|
| backend-typescript/src/accounting/accounting.spec.ts | 23 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/accounting/module_14.spec.ts | 9 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/accounting/module_15.spec.ts | 4 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/accounting/module_16.spec.ts | 4 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/accounting/module_17.spec.ts | 3 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/app.controller.spec.ts | 1 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/assistant/business-insight.service.spec.ts | 5 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/assistant/intent-router.spec.ts | 16 | 0 | 7 | Existing assertions only; NOT RUN |
| backend-typescript/src/auth/google-identity.spec.ts | 6 | 0 | 1 | Existing assertions only; NOT RUN |
| backend-typescript/src/barcode/module_12.spec.ts | 33 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/common/currency-allocation.spec.ts | 2 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/intelligence/intelligence.service.spec.ts | 5 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/intelligence/module_24.spec.ts | 3 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/inventory/costing.spec.ts | 7 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/inventory/inventory.spec.ts | 22 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/inventory/module_06.spec.ts | 6 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/inventory/module_21.spec.ts | 3 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/inventory/module_25.spec.ts | 2 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/platform/auth/totp.spec.ts | 2 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/platform/platform.spec.ts | 6 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/platform/s3-backup-store.spec.ts | 6 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/pos/barcode.spec.ts | 5 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/pos/bill-discount.spec.ts | 4 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/pos/pos.spec.ts | 8 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/pricing/module_13.spec.ts | 32 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/purchase/module_10.spec.ts | 1 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/purchase/posting.service.spec.ts | 5 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/retail/imports/import-format.spec.ts | 13 | 0 | 2 | Existing assertions only; NOT RUN |
| backend-typescript/src/sales/module_10.spec.ts | 5 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/sales/module_11.spec.ts | 10 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/sales/module_11_extended.spec.ts | 8 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/sales/module_18.spec.ts | 3 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/sales/module_19.spec.ts | 2 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/sales/module_20.spec.ts | 3 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/sales/module_22.spec.ts | 4 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/src/sales/sales.spec.ts | 10 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/account-onboarding-referral.e2e-spec.ts | 16 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/account-publishing.e2e-spec.ts | 8 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/app.e2e-spec.ts | 1 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/assistant.e2e-spec.ts | 34 | 0 | 1 | Existing assertions only; NOT RUN |
| backend-typescript/test/attachments.e2e-spec.ts | 5 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/auth-lifecycle.e2e-spec.ts | 14 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/batch-fefo.e2e-spec.ts | 17 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/bundle-modifier.e2e-spec.ts | 15 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/busy-day-qa.e2e-spec.ts | 14 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/calendar-price-only.e2e-spec.ts | 17 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/control-plane-security.e2e-spec.ts | 15 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/costing-profit.e2e-spec.ts | 35 | 0 | 1 | Existing assertions only; NOT RUN |
| backend-typescript/test/expenses.e2e-spec.ts | 2 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/general-store-qa.e2e-spec.ts | 13 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/google-business-onboarding.e2e-spec.ts | 14 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/gst-invoice.e2e-spec.ts | 22 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/import-report.e2e-spec.ts | 23 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/platform-access-approval.e2e-spec.ts | 8 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/platform-backup.e2e-spec.ts | 3 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/platform-control-plane.e2e-spec.ts | 11 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/production-readiness.e2e-spec.ts | 23 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/retail-field-coverage.e2e-spec.ts | 10 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/retail-flow.e2e-spec.ts | 19 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/security-audit-20261012.e2e-spec.ts | 8 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/security-remediation.e2e-spec.ts | 15 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/security.e2e-spec.ts | 10 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/shopkeeper-qa.e2e-spec.ts | 11 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/subscription-entitlements.e2e-spec.ts | 20 | 0 | 7 | Existing assertions only; NOT RUN |
| backend-typescript/test/tenant-administration.e2e-spec.ts | 13 | 0 | 0 | Existing assertions only; NOT RUN |
| backend-typescript/test/universal-item-flow.e2e-spec.ts | 20 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/app-publishing.spec.ts | 5 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/assistant.spec.ts | 5 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/auth.spec.ts | 9 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/busy-day-qa.spec.ts | 9 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/costing-profit.spec.ts | 5 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/general-store-qa.spec.ts | 20 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/google-business-onboarding.spec.ts | 4 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/import-report-acceptance.spec.ts | 3 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/item-configuration.spec.ts | 1 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/manual-acceptance.spec.ts | 15 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/module_02.spec.ts | 1 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/partial-rerun.spec.ts | 3 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/platform-control-plane.spec.ts | 1 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/production-readiness.spec.ts | 5 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/retail-field-coverage.spec.ts | 2 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/retail-improvements.spec.ts | 4 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/retail-smoke.spec.ts | 4 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/retail-ux.spec.ts | 8 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/shopkeeper-qa.spec.ts | 8 | 0 | 0 | Existing assertions only; NOT RUN |
| frontend/tests/whatsapp-receipt.spec.ts | 3 | 0 | 0 | Existing assertions only; NOT RUN |

Supporting test helpers: backend security-fixture.setup, Vitest configs/globals, general-store and busy-day scenario fixtures; frontend fixtures/mobile-controls helpers and playwright.config. Dataset/auth/tenant setup hooks can mutate DB, which is why suites were not executed here. `src/assistant/held-out.ts` is additional utterance evidence/dataset, not a separate86th+ test runner result. Production/provider flows require dedicated real integration verification later. Browser visual/mobile/accessibility success is UNKNOWN in this audit, not inferred from a screenshot/spec file.

### Major coverage relationships and missing proof

Billing/payment/idempotency/concurrency: retail-flow, production-readiness, busy-day/general-store/shopkeeper plus pos specs. Tenant isolation/permission/row security: security, control-plane-security, production-readiness, security-audit-20261012, security-remediation and tenant-administration. Universal/batch/bundle/serial: universal-item-flow, batch-fefo, bundle-modifier and inventory/pos legacy specs. Accounting/costing: accounting/module14–17, currency allocation, costing/financial/browser specs. GST: gst-invoice and item/configuration/field coverage. Entitlements/plans: subscription-entitlements and access approval. Google/onboarding: google-identity, google-business-onboarding, account-onboarding-referral/auth-lifecycle. Imports: import-format/import-report/browser import-report-acceptance. Backup: platform-backup and S3BackupStore with mocked S3 unit data; this is not an offsite recovery drill. Assistant: intent-router, business-insight, assistant e2e/browser. Publishing/public content: account-publishing/app-publishing. WhatsApp: browser redirect specs, not Cloud API delivery. These do not supply fresh actual test counts/pass/fail for this audit.

## 28. Complete Prisma model / support inventory

132 models. “Direct scope fields” means columns present on the model; no direct column means parent relations/global control data/legacy, not automatic public access. Guards, relation scoping and row policies must still be considered. Unique constraints shown are schema @@unique declarations, not all migration-added expression indexes or field-level @unique constraints. Important intentional global identity and company serial uniqueness discussed above. Source line references use schema.prisma. All models below are storage evidence; a model alone does not mean a working frontend module.

| Model | SQL table | Direct scope fields | Composite @@unique declarations | Schema line |
|---|---|---|---|---:|
| AssistantIntentConfig | assistant_intent_configs | Parent relation/global/legacy; see service | — | 6 |
| AssistantExample | assistant_examples | Parent relation/global/legacy; see service | — | 13 |
| AssistantConversation | assistant_conversations | company_id,branch_id | — | 27 |
| AssistantQueryLog | assistant_query_logs | company_id,branch_id | — | 46 |
| User | users | organization_id | — | 76 |
| AuthToken | auth_tokens | Parent relation/global/legacy; see service | — | 145 |
| PrivacyRequest | privacy_requests | organization_id,company_id | — | 160 |
| Role | roles | organization_id | [organization_id, name], name: "uix_roles_org_name" | 175 |
| Permission | permissions | Parent relation/global/legacy; see service | — | 189 |
| UserRole | user_roles | company_id,branch_id | — | 202 |
| RolePermission | role_permissions | Parent relation/global/legacy; see service | — | 215 |
| Session | sessions | Parent relation/global/legacy; see service | — | 227 |
| PasswordHistory | password_history | Parent relation/global/legacy; see service | — | 243 |
| PlatformUser | platform_users | Parent relation/global/legacy; see service | — | 256 |
| PlatformMfaChallenge | platform_mfa_challenges | Parent relation/global/legacy; see service | — | 283 |
| SecurityRateWindow | security_rate_windows | Parent relation/global/legacy; see service | — | 301 |
| PlatformRole | platform_roles | Parent relation/global/legacy; see service | — | 309 |
| PlatformPermission | platform_permissions | Parent relation/global/legacy; see service | — | 321 |
| PlatformUserRole | platform_user_roles | Parent relation/global/legacy; see service | — | 334 |
| PlatformRolePermission | platform_role_permissions | Parent relation/global/legacy; see service | — | 345 |
| PlatformSession | platform_sessions | Parent relation/global/legacy; see service | — | 356 |
| PlatformAuditLog | platform_audit_logs | Parent relation/global/legacy; see service | — | 372 |
| Plan | plans | Parent relation/global/legacy; see service | — | 390 |
| Feature | features | Parent relation/global/legacy; see service | — | 407 |
| PlanFeature | plan_features | Parent relation/global/legacy; see service | — | 425 |
| TenantEntitlement | tenant_entitlements | organization_id | [organization_id, feature_id], name: "uix_tenant_entitlements" | 436 |
| OwnerInvitation | owner_invitations | organization_id | — | 451 |
| TenantSubscription | tenant_subscriptions | organization_id | — | 466 |
| SubscriptionPayment | subscription_payments | organization_id | — | 478 |
| PlatformExpense | platform_expenses | Parent relation/global/legacy; see service | — | 498 |
| PlatformBackup | platform_backups | Parent relation/global/legacy; see service | — | 511 |
| PlatformSupportSession | platform_support_sessions | organization_id | — | 525 |
| PlatformAnnouncement | platform_announcements | Parent relation/global/legacy; see service | — | 537 |
| PlatformSetting | platform_settings | Parent relation/global/legacy; see service | — | 550 |
| MobileOtpChallenge | mobile_otp_challenges | Parent relation/global/legacy; see service | — | 567 |
| ReferralCampaign | referral_campaigns | Parent relation/global/legacy; see service | — | 584 |
| ReferralCode | referral_codes | organization_id | — | 603 |
| ReferralAttribution | referral_attributions | Parent relation/global/legacy; see service | — | 618 |
| ReferralReward | referral_rewards | Parent relation/global/legacy; see service | — | 642 |
| TenantDeletionJob | tenant_deletion_jobs | organization_id | — | 657 |
| Organization | organizations | Parent relation/global/legacy; see service | — | 671 |
| Company | companies | organization_id | [organization_id, code], name: "uix_companies_org_code" | 715 |
| CompanyConfiguration | company_configurations | company_id | — | 804 |
| RequestIdempotency | request_idempotency | company_id | [company_id,key] | 826 |
| DailyCashCount | daily_cash_counts | company_id,branch_id | [company_id,branch_id,date] | 838 |
| Branch | branches | company_id | [company_id, code], name: "uix_branches_company_code" | 852 |
| Godown | godowns | branch_id | [branch_id, code], name: "uix_godowns_branch_code" | 912 |
| FinancialYear | financial_years | company_id | [company_id, label], name: "uix_fy_company_label" | 946 |
| Party | parties | company_id | [company_id,code], map:"uix_parties_company_code" | 978 |
| CreditOverride | credit_overrides | company_id | — | 1044 |
| Unit | units | company_id | — | 1069 |
| TaxClass | tax_classes | company_id | — | 1113 |
| Item | items | company_id | [company_id,sku], map:"uix_items_company_sku" | 1130 |
| PurchaseOrder | purchase_orders | company_id,branch_id | — | 1203 |
| PurchaseOrderLine | purchase_order_lines | Parent relation/global/legacy; see service | — | 1226 |
| GoodsReceipt | goods_receipts | company_id,branch_id | — | 1264 |
| GoodsReceiptLine | goods_receipt_lines | Parent relation/global/legacy; see service | — | 1288 |
| PurchaseInvoice | purchase_invoices | company_id,branch_id | — | 1327 |
| PurchaseInvoiceLine | purchase_invoice_lines | Parent relation/global/legacy; see service | — | 1369 |
| PurchaseReturn | purchase_returns | company_id,branch_id | — | 1415 |
| PurchaseReturnLine | purchase_return_lines | Parent relation/global/legacy; see service | — | 1449 |
| StockMovement | stock_movements | company_id,branch_id | [company_id, source_document_type, source_document_id, source_line_id, movement_type], name: "uix_stock_movement_source" | 1486 |
| StockBalanceProjection | stock_balance_projection | company_id,branch_id | — | 1526 |
| LedgerAccount | ledger_accounts | company_id,branch_id | — | 1552 |
| Voucher | vouchers | company_id,branch_id | [company_id, voucher_type, source_document_type, source_document_id], name: "uix_voucher_source" | 1585 |
| VoucherLine | voucher_lines | Parent relation/global/legacy; see service | — | 1624 |
| BillAllocation | bill_allocations | company_id | — | 1642 |
| AuditLog | audit_logs | company_id,branch_id | — | 1661 |
| SalesQuotation | sales_quotations | company_id,branch_id | — | 1684 |
| SalesQuotationLine | sales_quotation_lines | Parent relation/global/legacy; see service | — | 1710 |
| SalesOrder | sales_orders | company_id,branch_id | — | 1747 |
| SalesOrderLine | sales_order_lines | Parent relation/global/legacy; see service | — | 1775 |
| DeliveryChallan | delivery_challans | company_id,branch_id | — | 1816 |
| DeliveryChallanLine | delivery_challan_lines | Parent relation/global/legacy; see service | — | 1841 |
| SalesInvoice | sales_invoices | company_id,branch_id | — | 1879 |
| SalesInvoiceLine | sales_invoice_lines | Parent relation/global/legacy; see service | — | 1925 |
| RetailGstInvoice | retail_gst_invoices | company_id,branch_id | [company_id,financial_year,document_number] | 1983 |
| RetailGstSequence | retail_gst_sequences | company_id | — | 2001 |
| RetailCalendarTask | retail_calendar_tasks | company_id,branch_id | — | 2010 |
| SalesInvoiceLineBatchAllocation | sales_invoice_line_batch_allocations | Parent relation/global/legacy; see service | — | 2025 |
| SalesReturn | sales_returns | company_id,branch_id | — | 2038 |
| SalesReturnLine | sales_return_lines | Parent relation/global/legacy; see service | — | 2072 |
| SalesReturnLineBatchAllocation | sales_return_line_batch_allocations | Parent relation/global/legacy; see service | — | 2116 |
| PosShift | pos_shifts | company_id,branch_id | — | 2129 |
| PosHeldBill | pos_held_bills | company_id,branch_id | — | 2150 |
| PosHeldBillLine | pos_held_bill_lines | Parent relation/global/legacy; see service | — | 2167 |
| alembic_version | alembic_version | Parent relation/global/legacy; see service | — | 2196 |
| security_audit_logs | security_audit_logs | Parent relation/global/legacy; see service | — | 2202 |
| StockAdjustment | stock_adjustments | company_id,branch_id | [company_id, document_number] | 2208 |
| StockAdjustmentLine | stock_adjustment_lines | Parent relation/global/legacy; see service | — | 2233 |
| StockTransfer | stock_transfers | company_id,branch_id | [company_id, document_number] | 2251 |
| StockTransferLine | stock_transfer_lines | Parent relation/global/legacy; see service | — | 2279 |
| OpeningStock | opening_stocks | company_id,branch_id | [company_id, document_number] | 2293 |
| OpeningStockLine | opening_stock_lines | Parent relation/global/legacy; see service | — | 2317 |
| StockCount | stock_counts | company_id,branch_id | [company_id, document_number] | 2334 |
| StockCountLine | stock_count_lines | Parent relation/global/legacy; see service | — | 2361 |
| ReturnReason | return_reasons | company_id | [company_id, code] | 2379 |
| Claim | claims | company_id,branch_id | [company_id, document_number] | 2398 |
| ClaimLine | claim_lines | Parent relation/global/legacy; see service | — | 2448 |
| ClaimEvent | claim_events | Parent relation/global/legacy; see service | — | 2465 |
| ItemBarcode | item_barcodes | company_id | [company_id, barcode], name: "uix_item_barcode_company_barcode" | 2484 |
| LabelTemplate | label_templates | company_id | — | 2504 |
| PriceList | price_lists | company_id,branch_id | [company_id, code] | 2527 |
| PriceListItem | price_list_items | Parent relation/global/legacy; see service | [price_list_id, item_id, min_qty] | 2554 |
| CustomerItemPrice | customer_item_prices | company_id | [party_id, item_id, min_qty] | 2576 |
| PromotionScheme | promotion_schemes | company_id,branch_id | [company_id, code] | 2601 |
| PricingTrace | pricing_traces | company_id | — | 2639 |
| BankAccount | bank_accounts | company_id,branch_id | — | 2676 |
| Cheque | cheques | company_id,branch_id | — | 2698 |
| BankReconciliation | bank_reconciliations | company_id | — | 2735 |
| NeedList | need_lists | organization_id,company_id,branch_id | — | 2754 |
| Attachment | attachments | organization_id,company_id,branch_id | — | 2785 |
| ExpenseCategory | expense_categories | organization_id,company_id | [company_id, name] | 2819 |
| Expense | expenses | organization_id,company_id,branch_id | — | 2842 |
| RetailCapabilitySettings | retail_capability_settings | company_id | — | 2878 |
| ItemVariant | item_variants | Parent relation/global/legacy; see service | — | 2900 |
| ItemUnitConversion | item_unit_conversions | Parent relation/global/legacy; see service | [item_id, from_unit_id, to_unit_id], name: "uix_item_unit_conversion" | 2930 |
| ItemBatch | item_batches | company_id | [item_id, batch_number], name: "uix_item_batch_number" | 2945 |
| ItemSerial | item_serials | company_id | [item_id, serial_number], name: "uix_item_serial_number"; [company_id, serial_number], name: "uix_company_serial_number", map: "uix_company_serial_number" | 2979 |
| ItemBundleComponent | item_bundle_components | Parent relation/global/legacy; see service | — | 3008 |
| ItemModifierGroup | item_modifier_groups | Parent relation/global/legacy; see service | — | 3020 |
| ItemModifierOption | item_modifier_options | Parent relation/global/legacy; see service | — | 3033 |
| VariantOptionDefinition | variant_option_definitions | company_id | [company_id, name], name: "uix_variant_option_name" | 3044 |
| SerialAllocation | serial_allocations | company_id | — | 3056 |
| RetailImportJob | retail_import_jobs | company_id,branch_id | [company_id,branch_id,fingerprint] | 3075 |
| RetailImportRow | retail_import_rows | Parent relation/global/legacy; see service | [job_id,number] | 3098 |
| RetailImportIdentity | retail_import_identities | company_id | [company_id,kind,source_key] | 3112 |
| RetailMigrationChoice | retail_migration_choices | company_id | [company_id,user_id] | 3123 |
| RetailReportPreference | retail_report_preferences | company_id,branch_id | [company_id,branch_id,user_id] | 3134 |
| RetailReportNotification | retail_report_notifications | company_id,branch_id | [company_id,branch_id,user_id,day] | 3150 |
| RetailDataBackupRequest | retail_data_backup_requests | company_id | [company_id,user_id,request_key] | 3166 |
| InventoryCostState | inventory_cost_states | company_id | [company_id,item_id,variant_key] | 3182 |

Models without mature dedicated Retail UI: legacy quotation/order/challan, claim events/reasons, price-list/customer-price/promotions/traces, cheques and reconciliation schema, stock counts and older alembic/security logs. Registered current ERP endpoints are listed above. No standalone manufacturing production module/controller/model workflow is registered by InventoryModule; old service files/tests should not be offered as current production features.

## 29. Migrations, environment and read-only verification scope

35 migration directories /35 finished bookkeeping records observed. This is **not** a clean-disposable-db migration deploy/status/validate/generate PASS: none was run, because this task is inventory only. Root `migrations/pending.sql` is a helper file outside timestamped migration directories, not an extra deployable migration chain step. No reset/db-push/destructive SQL occurred.

| Migration directory | Local bookkeeping |
|---|---|
| 0_baseline | Finished row observed; not deployed/retested by this audit |
| 20260928000000_phase2_platform_foundation | Finished row observed; not deployed/retested by this audit |
| 20260928_company_configurations | Finished row observed; not deployed/retested by this audit |
| 20260928_feature_entitlements | Finished row observed; not deployed/retested by this audit |
| 20260928_retail_pos | Finished row observed; not deployed/retested by this audit |
| 20260930123000_claims_replacement | Finished row observed; not deployed/retested by this audit |
| 20260930_add_quotation_rel | Finished row observed; not deployed/retested by this audit |
| 20261001120000_module_12_barcode_labels | Finished row observed; not deployed/retested by this audit |
| 20261001130000_module_13_pricing_schemes | Finished row observed; not deployed/retested by this audit |
| 20261002120000_add_dc_free_qty | Finished row observed; not deployed/retested by this audit |
| 20261005063134_retail_phase_2 | Finished row observed; not deployed/retested by this audit |
| 20261005075537_attachments | Finished row observed; not deployed/retested by this audit |
| 20261005093028_init_expense | Finished row observed; not deployed/retested by this audit |
| 20261005230000_phase_5_5_universal_items | Finished row observed; not deployed/retested by this audit |
| 20261006073612_phase_5_5_batch_fefo | Finished row observed; not deployed/retested by this audit |
| 20261006150000_restore_batch_tenant_column | Finished row observed; not deployed/retested by this audit |
| 20261006162000_platform_control_plane | Finished row observed; not deployed/retested by this audit |
| 20261006163000_tenant_display_number | Finished row observed; not deployed/retested by this audit |
| 20261006170000_retail_field_coverage | Finished row observed; not deployed/retested by this audit |
| 20261006173000_bill_return_snapshots | Finished row observed; not deployed/retested by this audit |
| 20261006182000_serial_warranty | Finished row observed; not deployed/retested by this audit |
| 20261006190000_production_hardening | Finished row observed; not deployed/retested by this audit |
| 20261007060000_default_retail_entitlements | Finished row observed; not deployed/retested by this audit |
| 20261007120000_account_security_privacy | Finished row observed; not deployed/retested by this audit |
| 20261007170000_retail_calendar_price_only | Finished row observed; not deployed/retested by this audit |
| 20261007200000_retail_import_reports_backup | Finished row observed; not deployed/retested by this audit |
| 20261008120000_assistant_v1 | Finished row observed; not deployed/retested by this audit |
| 20261008160000_universal_costing | Finished row observed; not deployed/retested by this audit |
| 20261008161000_cost_state_relations | Finished row observed; not deployed/retested by this audit |
| 20261008162000_receipt_cost_snapshots | Finished row observed; not deployed/retested by this audit |
| 20261008165000_held_bill_discount | Finished row observed; not deployed/retested by this audit |
| 20261009010000_retail_gst_documents | Finished row observed; not deployed/retested by this audit |
| 20261009140000_shop_feature_settings | Finished row observed; not deployed/retested by this audit |
| 20261009170000_account_control_plane | Finished row observed; not deployed/retested by this audit |
| 20261012090000_security_remediation | Finished row observed; not deployed/retested by this audit |

The security remediation migration adds forced PostgreSQL row policies and role/context handling; active Prisma request context supplies tenant/platform/system scope under transactions. RLS is an additional boundary alongside service/guard ownership checks, not a plan entitlement engine. Deployed Neon/runtime role coverage and SQL owner/bypass grants are UNKNOWN here; source migration existence alone is not a production security PASS.

### Configuration keys and provider boundaries

Mandatory production keys/conditions: DATABASE_URL; distinct strong JWT_SECRET and PLATFORM_JWT_SECRET; MFA_ENCRYPTION_KEY; HTTPS FRONTEND_ORIGIN/API_ORIGIN; APP_VERSION; valid STORAGE_PROVIDER with persistent UPLOAD_DIR if local; explicit BACKUP_PROVIDER (none is allowed but unavailable); no bootstrap passwords, no disabled mandatory MFA, safe TRUSTED_PROXY_CIDRS. Provider keys include S3_BUCKET/S3_REGION/endpoint/KMS; backup S3 bucket/region/encryption/retention/prefix/endpoint/tool paths/restore-test target; SMTP host/port/from/public URL/TLS/credentials; Google client ID; Twilio account/token/from or messaging service. Secrets are deployment configuration, not public plan metadata. No .env values are included.

Statically observed `process.env` / `import.meta.env` names (not every ConfigService key): ANDROID_APP_ENABLED, APP_VERSION, BACKUP_DIRECTORY, BACKUP_ENCRYPTION_KEY, BACKUP_PROVIDER, BACKUP_RESTORE_DATABASE, BACKUP_RETENTION_DAYS, BACKUP_S3_BUCKET, BACKUP_S3_ENDPOINT, BACKUP_S3_KMS_KEY_ID, BACKUP_S3_PREFIX, BACKUP_S3_REGION, DATABASE_URL, DEV, EMAIL_FROM, EMAIL_PROVIDER, FRONTEND_ORIGIN, GOOGLE_CLIENT_ID, JWT_SECRET, MFA_ENCRYPTION_KEY, NODE_ENV, PLATFORM_BOOTSTRAP_PASSWORD, PLATFORM_JWT_SECRET, PLATFORM_MFA_REQUIRED, PUBLIC_APP_URL, REPORT_SCHEDULER_ENABLED, S3_BUCKET, S3_ENDPOINT, S3_FORCE_PATH_STYLE, S3_KMS_KEY_ID, S3_REGION, SMS_PROVIDER, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_SECURE, SMTP_USER, STORAGE_PROVIDER, TENANT_BOOTSTRAP_PASSWORD, TENANT_UPLOAD_QUOTA_BYTES, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, TWILIO_MESSAGING_SERVICE_SID, VITE_API_BASE_URL, VITE_API_URL. Dynamic/validated extras include PORT, API_ORIGIN, UPLOAD_DIR, TRUSTED_PROXY_CIDRS, SMTP_REQUIRE_TLS, AWS credential chain and PG_DUMP_PATH/PG_RESTORE_PATH. Frontend Google public client identity is obtained from backend capabilities; no Google client secret belongs in frontend. Vite default build does not explicitly enable public source maps. Legacy shared/lib/api.ts is separate from the active shared/api.ts client and should not be mistaken for current cookie/idempotency transport.

### Public app/publishing boundaries

Platform Publishing stores legal/developer/contact/domain/package/policy fields with clearly unfilled placeholders. Public brand direction APNA GALLA and developer Evolix Studio are not proof those operator/legal values have been completed. Account deletion is an authenticated request/controlled erasure process, not an anonymous wipe URL. Store privacy/data safety screenshots/review/test signing/content verification were not performed here; packaging/support pages are PARTIAL preparation, not published app acceptance.

## 30. Audit completion and safe interpretation

This document inventories code and local configuration; it does not assert production readiness, passing browser tests, successful payments, configured offsite backup, restored data, enabled voice provider or government filing. It preserves every current commercial default, saved override and workflow. Another architect can now redesign packages using the 50-key matrix plus actual API/role/provider/limit behavior, rather than relying on labels or old completion reports.

Application source hash verification is recorded below after final document completeness checks. Report-only change; pre-existing Git changes remain untouched.

**Read-only verification:** the 567 application/schema/migration/test/deployment/package/config files hashed before and after the audit have the identical aggregate SHA-256 `980b629b1e04a3502d2f746fe0611fa580ca2016bcee907dc5fe555f6d188b30`. Hash manifest algorithm: lexicographically sort repository path strings; hash each file's bytes; hash JSON array of `[path,file_sha256]`. The report itself is excluded. Branch observed `main`; pre-existing working-tree edits/untracked files were preserved. Runtime/test/browser/provider verification remains NOT RUN or UNKNOWN as stated above. Only this master audit document was authored.



