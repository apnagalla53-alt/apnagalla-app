# APNA GALLA BUSINESS-AWARE QUICK BILL IMPLEMENTATION

Verified locally on 16 October 2026. App: http://localhost:5185. API: http://localhost:8025.

This report covers the business-aware Quick Bill brief and its implementation. It supersedes the relevant Quick Bill/personalization gaps in the earlier 30-point audit; it does not claim a new audit of every unrelated feature.

## IMPLEMENTATION STATUS

| Requirement | Result | Evidence / behavior |
|---|---|---|
| Quick Bill new-item candidate | PASS | Name, quantity, suggested unit and selling price, directly inside the bill. |
| Auto-create item on successful bill | PASS | Existing catalog service and POS posting join one database transaction. |
| No Add Item detour | PASS | Eight actual browser sales completed without visiting Add Item. |
| Draft-only before bill save | PASS | Typing, adding a line and quoting leave no catalog records. Failed posting rolls back the item. |
| Idempotent item creation | PASS | Three simultaneous requests with one operation key produce one item, invoice and posting. Lost-response quote/replay recovers the same bill. |
| Unknown stock safe | PASS | Quick-created items have stock tracking disabled, no opening stock and no stock projection/movement. |
| Unknown cost safe | PASS | No purchase price or COGS is invented; existing unknown/partial cost coverage applies. |
| Category moved out of basic flow | PASS | Optional Category is inside Additional Details, not a required first step. |
| Existing configured items preserved | PASS | Unit, variant, batch, serial, modifier, measured quantity, GST and cost paths retain their authoritative services. |
| Amount-only sale | PASS | Remains available from Quick Bill, using the existing amount-sale posting path. |
| Navigation | PASS | Home · Items · + · Khata · AI Assistant, plus the floating assistant. |

New candidate data stays in the tenant-scoped device draft. A stable candidate UUID becomes the catalog SKU identity for that bill operation. The ordinary catalog item ID replaces the draft identity only on successful posting. Repeating a candidate under a different operation key is rejected rather than silently creating a second sale.

Quotes reuse canonical pricing inside a transaction that is deliberately rolled back. This avoids a second pricing calculator and prevents preview-only catalog/audit rows from persisting.

## BUSINESS PRESET UX

Business type comes from shop onboarding and is separate from optional item Category. Existing stable onboarding aliases are normalized into preset families. Presets influence wording, unit order and recommendations; they never grant features.

| Business | Result | Contextual behavior |
|---|---|---|
| Kirana / Grocery | PASS | Packet, piece and box suggestions; buy/sell pack conversion and optional stock enrichment. |
| Pharmacy | PASS | Tablet, strip, box, bottle, tube and sachet suggestions; strip/tablet conversion, independent prices, entitled Batch & Expiry question. |
| Hardware | PASS | Piece, kg, metre, foot and roll suggestions; roll-to-metre configuration, without pharmacy batch prompts. |
| Garments | PASS | Explicit No/Yes sizes-or-colours question; configurable combinations and optional variant prices. |
| Footwear | PASS | Pair prioritized; optional sizes with the merchant's own size system, optional colours. |
| Stationery | PASS | Piece, pack, box, set, dozen and ream suggestions; pack-to-piece configuration. |
| Electronics | PASS | Optional serial/warranty question and model field; existing serial selection and costing remain authoritative. |
| Restaurant | PASS | Cup/plate/piece suggestions and existing optional add-on groups; no new recipe, table or kitchen subsystem. |

Shared unit setup asks how the item is bought and sold and how many base units are inside one pack. Unit-specific price fields appear after multiple units are configured. Existing item options take precedence over preset defaults.

## GARMENTS / FOOTWEAR

| Check | Result |
|---|---|
| Garment size/colour wording | PASS |
| Existing variant engine reused | PASS |
| Footwear size flow | PASS |
| Plan entitlement preserved | PASS |
| Same-price default | PASS |
| Explicit per-variant prices | PASS |

Browser evidence: Cotton Kurta generated M/L × Black/White, four variants, with ₹650 inherited from the item. Sports Shoe saved UK 6, UK 7 and UK 8 without a forced colour or universal size system.

Backend acceptance tests receive three units of one specific variant and sell one, leaving two of that variant. Repeating setup creates no duplicate combinations. Explicitly changing its price to ₹701 changes the canonical next quote; repeating setup without a price preserves ₹701. Saved invoice amounts and stock history stay unchanged.

The contextual editor restores existing size/colour values and saved prices. A final browser check changed an existing UK 6 price to ₹1,399 and restored that value and the different-price editor after reload. Additional Details no longer repeats the primary business-specific question.

## PHARMACY MULTI-UNIT

| Check | Result |
|---|---|
| Buy by Strip | PASS |
| Sell by Tablet | PASS |
| Sell by Strip | PASS |
| 1 Strip = 10 Tablets | PASS |
| Separate Tablet price ₹12 | PASS |
| Separate Strip price ₹110 | PASS |
| Purchase conversion | PASS |
| Sale conversion | PASS |
| Return conversion | PASS |
| Single stock balance | PASS |
| Cost integrity | PASS |

The configured-item acceptance scenario uses these exact results:

| Operation | Amount | Remaining base quantity |
|---|---:|---:|
| Buy 5 strips at ₹80, credit purchase | ₹400 payable | 50 tablets |
| Sell 2 tablets at ₹12 | ₹24 received | 48 tablets |
| Sell 1 strip at ₹110 | ₹110 received | 38 tablets |
| Return 1 tablet from the original sale | ₹12 refunded | 39 tablets |

The remaining known cost is ₹312: 39 tablets at genuine receipt cost ₹8 each. Supplier payable remains ₹400. A strip is a conversion into the same tablet balance, not a separate inventory quantity.

Browser evidence additionally configures a strip of ten on the previously quick-created pharmacy item. Billing displays Tablet ₹12 and Strip ₹110; selecting Strip produces a canonical ₹110 quote.

Related pack tests pass for Hardware (2 rolls × 50 metres − 5 metres = 95 metres), Grocery (2 boxes × 10 packets − 3 packets = 17 packets), and Stationery (2 packs × 10 pieces − 3 pieces = 17 pieces).

## QUICK BILL TEST MATRIX

Every row completed a real password login, searched for an unknown item, added it inline, paid cash, found the saved item in the next search, and checked basic Add Item presentation. Separate fresh backend fixtures verify rollback, posting and concurrency.

| Business Type | Scenario | New Item Without Detour | Correct Unit Suggestions | Item Auto-Created | Unknown Stock Safe | Found Next Bill | Overall |
|---|---|---|---|---|---|---|---|
| Kirana | Local Chips, 2 packets × ₹20 | PASS | PASS | PASS | PASS | PASS | PASS |
| Pharmacy | Crocin New, 2 tablets × ₹12 | PASS | PASS | PASS | PASS | PASS | PASS |
| Hardware | PVC Pipe, 2 metres × ₹80 | PASS | PASS | PASS | PASS | PASS | PASS |
| Garments | Cotton Kurta, 1 piece × ₹650 | PASS | PASS | PASS | PASS | PASS | PASS |
| Footwear | Sports Shoe, 1 pair × ₹1,299 | PASS | PASS | PASS | PASS | PASS | PASS |
| Stationery | Blue Pen, 3 pieces × ₹10 | PASS | PASS | PASS | PASS | PASS | PASS |
| Electronics | USB Charger, 1 piece × ₹499 | PASS | PASS | PASS | PASS | PASS | PASS |
| Restaurant | Masala Tea, 2 cups × ₹20 | PASS | PASS | PASS | PASS | PASS | PASS |

The browser fixtures are separate from the eight empty demo organizations previously handed to the user. No test used the application operator account or those empty user demo shops.

## CROSS-CATEGORY LEAKAGE

| Check | Result | Observation |
|---|---|---|
| Kirana → Pharmacy UI leak | PASS | No primary Batch & Expiry question. |
| Garments → Hardware UI leak | PASS | Sizes/colours question is primary; generic unit configuration remains optional. |
| Hardware → Garment UI leak | PASS | No primary sizes/colours question. |
| Pharmacy → Restaurant UI leak | PASS | No default add-on setup panel. |
| Electronics / Footwear / Stationery / Restaurant | PASS | Expected contextual questions or no irrelevant primary question. |

Explicitly configured options remain accessible even if the shop preset normally does not recommend them. This is intentional; changing a preset must not hide or flatten a real configured item.

## DAILY PARTNER / PROGRESSIVE ENRICHMENT

PASS. Recommendations use distinct posted bills in the current branch over the last 30 days. The minimum repeated-item threshold is **two distinct bills**, not one sale or two units on one bill. Candidate typing and previews never qualify as sales.

The existing ranking and maximum of three recommendations remain. Urgent stock/dues recommendations outrank optional setup. Suggestions explain the actual bill count, offer a relevant existing screen, honor feature access, and can be snoozed/dismissed. Clothing/footwear suggest sizes; pharmacy/hardware/stationery suggest relevant packs; electronics and restaurant offer contextual existing capabilities when applicable. Generic stock enrichment remains available. Variant shortages use actual variant stock projections.

## ACCOUNTING SAFETY

| Area | Result | Verification |
|---|---|---|
| Cash | PASS | Eight first-sale scenarios; balanced vouchers and expected Galla cash. |
| UPI | PASS | ₹100 candidate sale posts ₹100 to bank and does not increase cash. |
| Split payment | PASS | ₹100 sale with ₹30 cash + ₹40 UPI leaves ₹30 customer due. |
| Udhar / Khata | PASS | Inline customer credit and collections retain actual outstanding balances and calendar behavior. |
| Stock | PASS | Unknown items create no stock; configured variant, pack, batch and measured paths pass. |
| COGS | PASS | 39 costing/profit regressions, including serial costs and immutable returns. |
| Galla | PASS | Expected cash changes only by the cash component. |
| Purchases / supplier payable | PASS | Real pack receipt cost and ₹400 pharmacy payable reconcile. |
| Returns | PASS | Original quantity/conversion/cost snapshots and serial/batch allocation paths pass. |
| GST | PASS | 22 GST invoice tests; existing rates and saved documents preserved. |
| Tenant isolation | PASS | Foreign item IDs fail; same item names in separate shops retain separate IDs/prices. |
| Plan enforcement | PASS | Starter cannot enable paid pack, batch, serial, variant or measured candidate features. |

An old FEFO test expected the stock report's physical quantity to omit expired units. The test now separately proves 15 physical units, 11 sellable units, and low-stock evaluation against those 11. No production reporting or accounting formula was changed for that correction.

## BUILDS / TESTS

| Check | Result |
|---|---|
| Frontend production build (`tsc -b && vite build`) | PASS |
| Backend production build (`nest build`) | PASS |
| Backend explicit TypeScript check (`tsc --noEmit`, build config) | PASS |
| Distinct automated tests | **177 passed, 0 failed** |
| Actual browser first-bill scenarios | **8 passed** |
| Mobile layout / WCAG A-AA checks | **24 passed** |
| Mobile nav-label fit / candidate reachability / assistant clearance checks | **8 passed** |

Automated total, without double-counting reruns:

| Suite | Passed |
|---|---:|
| business-quick-bill.e2e-spec.ts | 22 |
| retail-simplicity.e2e-spec.ts | 10 |
| costing-profit.e2e-spec.ts | 39 |
| retail-usability.e2e-spec.ts | 11 |
| universal-item-flow.e2e-spec.ts | 20 |
| gst-invoice.e2e-spec.ts | 22 |
| batch-fefo.e2e-spec.ts | 17 |
| pricing/module_13.spec.ts | 29 |
| auth/business-presets.spec.ts | 4 |
| retail/experience/recommendations.spec.ts | 3 |
| **Total** | **177** |

All database-mutating automated tests were guarded to a dedicated disposable localhost database ending `_test`, using separately provisioned synthetic owners. The operator's account/password and customer data were not changed. No other project's database configuration was changed.

Mobile checks cover 360/430px, light/dark and 100/200% text on Quick Bill, basic Add Item and contextual sizes. The checks caught and fixed dark Browse contrast, nested scrolling in the new candidate, duplicate contextual prompts and navigation/assistant spacing. They are automated browser accessibility/layout checks, not a complete human accessibility certification.

The Quick Bill route remains lazy loaded: approximately 30.78 kB minified / 9.35 kB gzip in this build. The existing main bundle is about 500.31 kB / 156.40 kB gzip and still emits Vite's size advisory. Seven fresh browser searches took approximately 874–889 ms from input to candidate, including debounce and local automation. These are local observations, not a production/network performance guarantee; no before/after benchmark is claimed.

### Evidence

Ignored local evidence is under `output/simplicity/`:

- `quick-business-final-summary.log` and `quick-business-final.private.json` — 22 final acceptance checks.
- `quick-final-regressions-summary.log` — 80 checks, including the earlier 20-test version of the acceptance suite; these are not added twice.
- `quick-final-additional-summary.log` — GST, batch and earlier acceptance rerun, all passing.
- `quick-configured-regressions-summary.log` — 20 universal-item checks.
- `quick-pricing-unit-summary.log` — 36 pricing/preset/recommendation unit checks.
- `quick-eight-browser-scenarios.log` — eight actual UI sale results.
- `quick-layout-final.log` — 24 layout/accessibility cases.
- `quick-mobile-reachability.log` — eight nav/assistant/reachability cases.
- `quick-final-frontend-build.log`, `quick-final-backend-build.log`, `quick-final-backend-typecheck.log`.

Screenshots under `output/playwright/` include business candidate screens, `quick-pharmacy-strip-price.png`, `quick-garments-four-combinations.png`, `quick-footwear-custom-sizes.png`, and `quick-candidate-light-reachable-text200.png` / its dark counterpart. Private fixture files contain only synthetic test credentials and remain ignored; do not commit them.

## FILES CHANGED

The following paths were touched for this implementation; the working tree also contains unrelated earlier changes, which were preserved.

- `backend-typescript/prisma/schema.prisma`
- `backend-typescript/prisma/migrations/20261015140000_item_unit_selling_price/migration.sql`
- `backend-typescript/src/auth/business-presets.ts`
- `backend-typescript/src/auth/business-presets.spec.ts`
- `backend-typescript/src/item-composition/item-composition.controller.ts`
- `backend-typescript/src/item-composition/item-composition.dto.ts`
- `backend-typescript/src/item-composition/item-composition.service.ts`
- `backend-typescript/src/pricing/pricing-engine.service.ts`
- `backend-typescript/src/pricing/pricing.types.ts`
- `backend-typescript/src/retail/billing/billing.controller.ts`
- `backend-typescript/src/retail/billing/billing.module.ts`
- `backend-typescript/src/retail/billing/billing.service.ts`
- `backend-typescript/src/retail/dto/retail-bill.dto.ts`
- `backend-typescript/src/retail/dto/retail-item.dto.ts`
- `backend-typescript/src/retail/retail-catalog.module.ts`
- `backend-typescript/src/retail/retail.module.ts`
- `backend-typescript/src/retail/retail.controller.ts`
- `backend-typescript/src/retail/retail.service.ts`
- `backend-typescript/src/retail/retail-units.ts`
- `backend-typescript/src/retail/experience/retail-experience.service.ts`
- `backend-typescript/test/business-quick-bill.e2e-spec.ts`
- `backend-typescript/test/batch-fefo.e2e-spec.ts`
- `frontend/src/App.tsx`
- `frontend/src/retail/RetailAddItem.tsx`
- `frontend/src/retail/RetailAmountSale.tsx`
- `frontend/src/retail/RetailHome.tsx`
- `frontend/src/retail/RetailItemDetail.tsx`
- `frontend/src/retail/RetailItemUnitsVariants.tsx`
- `frontend/src/retail/billing/QuickBillCandidate.tsx`
- `frontend/src/retail/billing/RetailNewBill.tsx`
- `frontend/src/retail/billing/RetailPayment.tsx`
- `frontend/src/retail/billing/BillTaxSummary.tsx`
- `frontend/src/retail/billing/RetailLineConfigurator.tsx`
- `frontend/src/retail/components/ContextualVariants.tsx`
- `frontend/src/retail/components/ContextualTracking.tsx`
- `frontend/src/retail/components/ItemUnitSetup.tsx`
- `frontend/src/retail/experience/useBusinessPreset.ts`
- `frontend/src/retail/reports/ReportNotificationBell.tsx`
- `frontend/src/retail/retailApi.ts`
- `frontend/src/retail/retailStore.ts`
- `frontend/src/retail/retail-usability.css`
- `frontend/src/retail/assistant/floating-assistant.css`
- `frontend/src/shared/workflowTheme.ts`
- `frontend/src/shared/workflow-theme.css`
- `docs/verification/APNA_GALLA_BUSINESS_QUICK_BILL_20261016.md`

## DATABASE CHANGES

Migration added: **YES**.

`backend-typescript/prisma/migrations/20261015140000_item_unit_selling_price/migration.sql`

Adds nullable `selling_price DECIMAL(15,6)` with a nonnegative constraint to the existing `item_unit_conversions` table. This stores an authoritative optional selling price for each configured pack. Null preserves the existing base-price-times-conversion fallback. Existing conversion factors, invoice snapshots and inventory history are unchanged.

Backward compatible: **YES**, after applying the migration. Prisma Client was regenerated. The migration was applied only to the isolated localhost test database. It has **not** been applied to a live/customer database; apply it through the normal deployment migration process before running the updated backend there.

## KNOWN LIMITATIONS

1. A bill containing new candidates uses **Save device draft**, not the server-held-bill API. It survives local reloads in the same shop/browser but does not synchronize across devices. Existing-item server-held bills retain their existing behavior.
2. New candidates support whole-piece/pack units and entitled weight/length quantities. New area/volume products that require dimensions still use the configured-item path. Existing area/volume items retain their dimension controls and regression coverage.
3. Choosing size, batch or serial tracking intentionally starts configured stock tracking. Stock must then be received in the appropriate variant/batch/serial. Existing physical stock history cannot be casually converted into another tracking structure; existing safety guards reject that change.
4. Size combinations are capped at 100 per setup submission. Existing combinations are retained, and price changes apply only when explicitly supplied. Removing combinations or retroactively splitting old stock is outside this phase.
5. This is local verification against synthetic isolated data. Real Google OAuth, production performance, external payment settlement and physical-device PWA/native installation were not re-certified in this phase. No payment gateway was introduced.
6. The new candidate flow covers item-name entry. The existing unknown-barcode Add & Sell path is unchanged; barcode and shelf work were explicitly outside this brief.

## REMAINING UX GAPS

1. Draft synchronization for new-item candidates across devices is not implemented.
2. Unit quantities remain presented in the existing base-unit reporting format; a derived “4 strips + 7 tablets” stock display is not added. The underlying conversion, sale, return and cost calculations are verified.
3. The main JavaScript bundle size advisory remains; the Quick Bill route is separate and no LLM or new animation library was added for this flow.

## FINAL VERDICT

**APNA GALLA BUSINESS-AWARE QUICK BILL VERIFIED**

All eight business types passed their critical first-sale scenarios. Atomic creation/retry/rollback, honest unknown stock/cost, pharmacy unit pricing, contextual sizes, accounting, tenant isolation and entitlement enforcement passed. The limitations above remain explicit.

At the end of this implementation verification, no Git commit, Git push or deployment had been performed. The owner subsequently authorized GitHub publication; see [the release summary](APNA_GALLA_RELEASE_SUMMARY_20261016.md) for publication scope and the separate migration/deployment steps. Local testing uses the isolated API/frontend environment.
