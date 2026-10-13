# Retail subscriptions, shop preferences and data ownership

Implemented 9 October 2026 using the existing Plan, Feature, PlanFeature, TenantEntitlement, TenantSubscription and CompanyConfiguration models. Prices and assignments are stored on the server. The defaults are Starter ₹75/month, Smart ₹120/month and Pro ₹210/month. Platform operators can edit prices, assignments and numeric limits; client code identifies plans by code rather than price.

## Commercial matrix

| Capability | Starter | Smart | Pro |
|---|---|---|---|
| Billing, sales, counted stock, basic units, barcode | Included | Included | Included |
| Customer/supplier Khata, purchases, expenses, owner withdrawals | Included | Included | Included |
| Daily Galla, Need List, services, accounting, basic reports | Included | Included | Included |
| Basic text Ask EVOLIX | Included | Included | Included |
| GST invoice preparation, profit/COGS/margin reports | Locked | Included | Included |
| Business Insights and text diagnosis | Locked | Included | Included |
| Variants, multi-unit, weight, length, area, volume | Locked | Included | Included |
| Batch/expiry/FEFO, bundles, modifiers, item images, wastage | Locked | Included | Included |
| Staff accounts | Locked | Within limits | Within limits |
| Multiple locations/transfers, serials/warranty | Locked | Locked | Included |
| Advanced pricing, compatibility, custom staff roles | Locked | Locked | Included |
| Voice Ask EVOLIX entitlement | Locked | Locked | Included; voice service unavailable |
| Automatic operator data protection | Included | Included | Included |

The voice entitlement is Pro-only. A working speech provider/channel is **not implemented/configured**: Smart requests fail with FEATURE_NOT_ENTITLED; Pro voice requests return VOICE_NOT_CONFIGURED. The UI does not request microphone access or fabricate an answer. The ordinary payment thank-you greeting remains a separate core setting.

## Separate shop preferences

Effective access combines subscription lifecycle, plan assignments or persisted tenant override, global rollout, shop preference and the route/tool's persisted user permission. Global rollout OFF still defeats a grant. Server guards/services enforce the same rules for direct requests, saved drafts and advanced line items. A price/plan label in a browser cannot grant access.

Optional shop preferences live in `CompanyConfiguration.shop_feature_settings`, with an additive JSON migration. Absence means enabled when entitled, preserving existing authorized workflows. Core features and exports have no meaningless shop switches. Toggling is owner/admin-only, transaction-locked, tenant-scoped and audited; concurrent changes preserve other preferences. A locked feature shows a Smart/Pro upgrade link. Disabling restricts future use, without deleting old records.

`RetailCapabilitySettings` remains the existing provisioning compatibility record. Its old bootstrap booleans do not decide runtime commercial access; the shared entitlement service is authoritative. No parallel entitlement model was introduced.

Expiry restricts new writes and paid feature use; core historical reads and account/portability remain available. Suspension restricts normal shop access. Downgrade retains item flags, stock, locations, serials, staff, prices, bills and journals. Existing advanced records may be read and appropriate return/reversal recovery remains available on an active subscription. No subscription action silently deletes or converts them.

## Numeric defaults

| Limit | Starter | Smart | Pro |
|---|---:|---:|---:|
| Extra active staff | 0 | 2 | 10 |
| Total active users | 1 | 3 | 11 |
| Devices | 2 | 5 | 15 |
| Stores | 1 | 1 | 3 |
| Active stock locations | 1 | 1 | 10 |
| Storage allowance, MB | 100 | 500 | 2000 |

Staff, devices and new stores/locations have server limits. Re-enabling staff/locations also checks limits. Storage allowance is configuration metadata; a complete byte-quota enforcement/metering system is not implemented. The platform validates numeric inputs and can override limits for a tenant. Lower limits do not remove historical users/locations.

## Backup is not export

Automatic backup is an operator responsibility for **every paid tier**, including customers, suppliers, transactions, inventory and accounting. The PostgreSQL backup adapter dumps the whole shared database; it never filters tenants by plan, shop toggle or EXPORT_* keys. BACKUP entitlement cannot be removed by a tenant's commercial override. Object/attachment protection must also cover all tiers in the production storage policy.

The real local backup/restore drill now includes fresh Starter, Smart and Pro shops. After restoration it verifies each shop's customer, item, posted stock movement and accounting voucher, alongside operator/organization/migration checks. This proves local whole-database recovery, not live cloud readiness.

Production offsite provider, schedule, alert delivery, object recovery and measured RPO/RTO are **NOT CONFIGURED**. Retail displays Backup not configured. Configured provider settings alone do not establish a recent restorable backup. See DISASTER_RECOVERY.md; installing a plan never installs a backup scheduler.

## Manual export matrix

| Export | Starter | Smart | Pro |
|---|---|---|---|
| Items, stock | Included | Included | Included |
| Basic sales and returns report | Existing basic report export retained | Included | Included |
| Customers, suppliers, selected Khata ledger | Locked | Included | Included |
| Purchases, expenses, issued GST, profit | Locked | Included | Included |
| Staff directory, locations, document metadata | Locked | Locked | Included |
| Complete business records | Locked | Locked | Included |
| Scheduled export | Unavailable | Unavailable | Not implemented |
| Full document/file archive | Unavailable | Unavailable | Not implemented |

`GET /api/v1/retail/account/exports/:kind` validates plan, company scope, report filters and user permission, records an audit and returns bounded pages (maximum 1,000). Retail's Backup & Restore page offers format selection, relevant dates, a searched customer/supplier picker for Khata and explicit next-page downloads. Individual report/item/stock CSV buttons use the same server authorization. CSV escaping neutralizes spreadsheet formulas.

Customers/suppliers export current master details and current allocation-based outstanding balances, including zero-balance parties. Stock is the authoritative current available-stock report, excluding expired stock. Date-based reports use the existing reporting/accounting facades; profit uses saved costs and retains incomplete-cost warnings. Items export unit codes and prices. Complex GST/report snapshots are serialized as JSON cells. No export is advertised as a vendor-specific import file.

Large legacy operational report services still have documented scope guards (for example, 10,000 catalog items in stock reports). CSV responses are paginated, but some report services load the selected report scope before pagination. Realistic large-volume optimization remains a production performance check.

`GET /api/v1/retail/account/export` streams Pro business records as NDJSON, including bills/lines, purchases, payments/allocation/journals, returns, inventory operations, GST, preferences and safe staff directory. The final `complete:true` marker is mandatory before saving. Staff credentials, sessions, password hashes, Google identity secrets and attachment storage paths are excluded. Attachment bytes are retrieved separately with their existing authorized download. This is a live paginated copy, **not a consistent PostgreSQL recovery archive**. GST's composite sequence cursor and nested staff role scopes are handled explicitly.

## Account exit and portability

An owner can record DATA_PORTABILITY or DELETE_ACCOUNT under account settings on any tier, including after expiry. A pending request authorizes the core business-record stream independently of normal Pro convenience access. The request is persisted and the export audited as ACCOUNT_EXIT_PORTABILITY; it does not delete the company. This is explicitly separate from the normal Pro download action. Support receives the existing follow-up queue entry when an owner prepares a business-record download, and the UI explains that support may contact them. No call/message is automatically sent.

This mechanism must not be used to trap customers behind an upgrade. Operators must assign a fulfillment owner and publish retention/deletion policy before launch. Account export is an authenticated download, not a public sharing URL.

## Installation and existing tenants

All 34 migrations were deployed on a clean disposable PostgreSQL database. `20261009140000_shop_feature_settings` adds one JSON preference column; `20261009170000_account_control_plane` adds verified phone identities, durable onboarding, archive controls, referral records and deletion receipts. On startup a transaction/advisory lock installs missing catalog/default plans. Existing canonical plan edits, feature rollout and overrides are preserved on later restarts. A separate one-time export-catalog marker installs initial export assignments.

Legacy DEFAULT tenants are moved to Starter while retaining their old assigned capabilities as explicit tenant grants; existing overrides win. The old DEFAULT record is retained. New tenants default to Starter and receive company, store, stock location, year, ledgers, subscription and owner membership through the existing provisioning service. Review grandfathered grants before any commercial cutover; do not revoke access merely to match a price card.

## Subscription screens and provider truth

Current plan, price, expiry and limits are API-backed. All three cards, Smart Most Popular, comparisons, upgrades, confirmation for downgrade, safe-record messages, Shop Features link, Profile link and wallet/payment history are implemented. The wallet opens real recorded subscription payments or an empty state. Online checkout is **NOT CONFIGURED**, so Continue explains the unavailable service and links to support; it never changes a plan or invents a payment. Real platform plan/payment administration remains available to authorized operators. Payment-provider connected acceptance is blocked until a real integration exists.

English/Hindi, mobile 360×800 / 390×844 / 412×915, light/dark and desktop checks are recorded in `verification/SUBSCRIPTION_ENTITLEMENTS_VERIFICATION.md`. These changes do not certify the incomplete whole-product Stitch migration or a production deployment.

## Account plan selection and trials

Verified new owners select only Starter, Smart or Pro after business provisioning. Paid selection currently records a PENDING activation request; an operator must confirm a real payment and subscription activation. It never imitates online checkout. Trial is a TRIAL subscription on a configured base plan and duration, not a fourth commercial plan. The default policy offers no trial until an operator explicitly configures it. A trial can start once, its expiry is authoritative, and Retail displays the remaining duration. Expiry does not erase data.

Platform can change subscription status, expiry, plan, complimentary access, free days, feature overrides and numeric limits with audit reasons. Feature groups expose plan defaults, tenant exceptions, shop preferences and global rollout separately. Clearing an override restores plan inheritance. Legacy custom plan records are retained for historical assignments but cannot be selected for new normal sales. Referral subscription-day rewards extend eligibility without inventing revenue; details are in REFERRAL_PROGRAM.md.
