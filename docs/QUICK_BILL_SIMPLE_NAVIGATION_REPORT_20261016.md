# APNA GALLA QUICK BILL + SIMPLE NAVIGATION IMPLEMENTATION

Verified locally on 16 October 2026. No Git staging, commit, push or deployment was performed. The regular app is available at **http://localhost:5185/retail/quick-sale**. Existing operator credentials and customer records were preserved.

Browser writes used eight synthetic shops and a separate restricted cashier on `127.0.0.1:5187`, backed by a disposable localhost database ending in `_test`. API tests used another fresh disposable `_test` database. No real shop was used for a test sale, purchase, item creation or cleanup.

## QUICK BILL

| Check | Result | Evidence |
|---|---|---|
| Search | PASS | Existing catalog search retained; saved items found on the next bill in all eight browser journeys. |
| Browse | PASS | Integrated into the search bar; the separate green Browse block is removed. |
| Quick manual item | PASS | Visible compact card, with no full Add Item form. |
| Name + Qty + Unit + Rate | PASS | Tested with packets, tablets, metres, pieces, pairs and glasses. |
| No Add Item detour | PASS | Each browser journey entered a new name and completed a cash sale directly. |
| Auto-create item on bill save | PASS | Existing transactional candidate resolution reused; correct unit and selling price stored. |
| Draft-only before save | PASS | Eight API quote/abandonment checks leave no catalog record. Partial manual entry also survives navigation away and back. |
| Unknown stock safe | PASS | New quick items have tracking disabled and no invented opening stock or stock movement. |
| Unknown cost safe | PASS | Invoice cost status remains unknown; no selling-price-derived purchase cost. |
| Amount-only | PASS | Secondary amount disclosure hands off to the existing amount-sale flow. |
| ₹50 / ₹100 / ₹200 / ₹500 shortcuts | PASS | Browser clicks totalled ₹850 and correctly prefilled the amount-sale page. |
| More Settings | PASS | Collapsed by default; customer, tax/discount and bill details/photo remain available. |
| Sticky total/pay | PASS | Visible at phone width with the correct line count, quantity and amount. |
| Existing configured items | PASS | Catalog selection retains unit, variant, batch, serial, GST and modifier configuration through the existing line configurator. An exact manual-name match shows the existing price/unit and selects that record. |
| Edit/remove lines | PASS | Quantity controls and explicit red remove actions retained; draft candidates can be edited. |
| Receipt after payment | PASS | Fixed an observed redirect race: clearing the shared draft can no longer override the saved receipt destination. Retested successfully through the browser. |

## ADD ITEM

| Check | Result | Evidence |
|---|---|---|
| Category removed from primary basic flow | PASS | Category remains optional inside More Details. Verified in the rendered basic form. |
| Basic fields simplified | PASS | Name, selling price and selling unit first; recommendation banner removed. Stock counting remains optional. |
| BusinessPreset contextual questions | PASS | Existing contextual sizes/colours, batch/expiry, serial/warranty and pack setup preserved. Optional pack setup is collapsed except for Pharmacy. |

## BUSINESS PERSONALIZATION

| Business | Result | Evidence |
|---|---|---|
| Kirana | PASS | Packet quick sale, catalog reuse and Box → Packet stock conversion. Bag/sack also included in unit recommendations. |
| Pharmacy | PASS | Tablet quick sale; independently priced Tablet/Strip purchase, sales and return verified. |
| Hardware | PASS | Metre quick sale; Roll → Metre purchase and sale quantities verified. |
| Garments | PASS | Piece quick sale without category/size/colour setup; contextual variant engine verified separately. |
| Footwear | PASS | Pair quick sale; contextual size variants and stock verified separately. |
| Stationery | PASS | Piece quick sale and Pack → Piece conversion. |
| Electronics | PASS | Piece quick sale; supported serial/warranty/model settings remain optional and entitled. |
| Restaurant | PASS | Glass quick sale and existing modifier pricing; no new restaurant subsystem. |

All **59 existing onboarding business-type codes** were exercised through their own synthetic organization, first cash bill, catalog lookup and idempotent replay. Preset metadata is also checked for every stable code. The eight representative browser journeys below exercise the main retail families.

## PHARMACY

| Check | Result |
|---|---|
| Buy by Strip | PASS |
| Sell by Tablet | PASS |
| Sell by Strip | PASS |
| Conversion | PASS — 1 Strip = 10 Tablets |
| Tablet price | PASS — ₹12 |
| Strip price | PASS — ₹110, independent of 10 × ₹12 |
| Purchase | PASS — 5 Strips at ₹80 = ₹400; 50 tablet-equivalent units |
| Sale | PASS — 2 Tablets = ₹24; 1 Strip = ₹110 |
| Return | PASS — 1 Tablet returned at ₹12 |
| Stock integrity | PASS — final quantity 39 tablet-equivalent units |
| Cost integrity | PASS — final known inventory value ₹312; supplier payable ₹400 |

These checks use the existing unit conversion, posting, weighted-average cost and return services.

## GARMENTS / FOOTWEAR

| Check | Result |
|---|---|
| Simple contextual wording | PASS — sizes/colours for garments, sizes for footwear |
| Existing variant engine reused | PASS |
| Size handling | PASS |
| Colour handling | PASS — optional for footwear |
| One shared price by default | PASS — individual overrides are optional |

## NAVIGATION

| Check | Result |
|---|---|
| Old nested ERP-style groups removed | PASS — no daily-work accordions rendered |
| Flat/direct menu | PASS — one icon and label per destination |
| Quick Bill direct | PASS |
| Daily Galla direct | PASS |
| Bills direct | PASS — Bills / Sales |
| Purchases direct | PASS — Purchases / Buy Stock |
| Inventory direct | PASS — one catalog destination |
| Khata direct | PASS |
| Suppliers direct | PASS |
| Expenses direct | PASS |
| Reports direct | PASS |
| My Business | PASS — business information, plan/features and eligible GST profile links |
| Settings & Help | PASS — filtered secondary tools and device/account preferences |
| Duplicate destinations removed | PASS — 13 unique owner drawer destinations |
| Detailed Bill and GST retained | PASS — available from Bills / Sales, subject to access |
| Existing bottom navigation | PASS — Home · Items · + · Khata · Quick Actions for owners; unauthorized destinations hidden for staff |
| Personal quick access | PASS — existing Smart/Pro customization retained on Home and in Settings & Help |

The drawer header contains the product and shop name, without plan badges or financial statistics. Its list scrolls independently and Log Out remains reachable.

## ROLE / ENTITLEMENT

| Check | Result | Evidence |
|---|---|---|
| Owner navigation | PASS | All 13 entitled daily/account destinations visible. |
| Staff navigation | PASS | Sales-only cashier sees Home, Quick Bill, Bills / Sales, My Business and Settings & Help. |
| Unauthorized items hidden | PASS | Reports, Staff, inventory, purchases, suppliers, Khata and Galla hidden from the restricted cashier; bottom bar and new settings links also filtered. |
| Plan entitlements preserved | PASS | Starter API checks still reject restricted pack pricing, variants, batches, serials and measured candidates. |

A sales-only staff member without inventory-read permission uses the existing amount-only sale flow. Item billing continues to require catalog access. Backend permission and feature guards were not weakened.

## QUICK BILL MATRIX

| Business Type | New Item Direct | Suggested Units | Item Auto-Saved | Stock Safe | Found Next Bill | Overall |
|---|---|---|---|---|---|---|
| Kirana | PASS | Packet | PASS | PASS | PASS | PASS |
| Pharmacy | PASS | Tablets | PASS | PASS | PASS | PASS |
| Hardware | PASS | Metres | PASS | PASS | PASS | PASS |
| Garments | PASS | Pieces | PASS | PASS | PASS | PASS |
| Footwear | PASS | Pair | PASS | PASS | PASS | PASS |
| Stationery | PASS | Pieces | PASS | PASS | PASS | PASS |
| Electronics | PASS | Pieces | PASS | PASS | PASS | PASS |
| Restaurant | PASS | Glass | PASS | PASS | PASS | PASS |

Each row includes an actual browser sale and receipt, followed by search on the next Quick Bill. Read-only database checks confirmed correct units/prices, no fabricated stock/cost state, and balanced cash journals. One grocery item was sold again using its saved catalog record; it remained one item.

## ACCOUNTING REGRESSION

| Check | Result |
|---|---|
| Cash | PASS |
| UPI | PASS — receiving-profile snapshots and manual receipt confirmation |
| Udhar | PASS |
| Khata | PASS |
| Galla | PASS |
| Stock | PASS |
| COGS | PASS — real costs preserved; unknown costs remain unknown |
| Returns | PASS |
| GST | PASS — validation and existing document restrictions |
| Purchases | PASS |
| Supplier payable | PASS |
| Tenant isolation | PASS |
| Idempotency | PASS — concurrent/repeated bill requests preserve one item/bill/payment posting |
| Failed bill rollback | PASS — no orphan catalog candidate |

## UI

| Check | Result | Evidence |
|---|---|---|
| Approved Apna Galla theme preserved | PASS | Existing tokens/components; no new design system or dependency. |
| Light Mode | PASS | Quick Bill and owner drawer visually checked. |
| Dark Mode | PASS | Quick Bill and owner/restricted-staff drawers visually checked. |
| Mobile | PASS | 390 × 844 browser viewport; no horizontal overflow; scrolling/footer/logout checked. |
| Desktop | PASS | 1283 × 865 browser viewport; no horizontal overflow. |
| Hindi | PASS | New Quick Bill labels, actions, search and optional-settings text checked at phone width. |
| No dense ERP forms | PASS | Manual entry is visible; category/secondary settings remain collapsed or contextual. |

Visual evidence: [Quick Bill light](qa/quick-bill-20261016/quick-bill-light.jpg), [Quick Bill dark](qa/quick-bill-20261016/quick-bill-dark.jpg), [flat drawer](qa/quick-bill-20261016/flat-drawer.jpg).

## ORIGINAL BULK / SEARCH FIXES

- PostgreSQL identified the reported bulk failure at 19:32:41 as a numeric overflow in `opening_stock_lines.quantity` (`DECIMAL(15,6)`). Both bulk UI and item DTOs now reject oversized quantities/prices with readable validation; no silent truncation or accounting-schema rewrite.
- Browser check: entering stock `1,000,000,000` shows a clear error and keeps both entered rows. Correcting it to `5` saves the two filled rows while skipping two completely blank rows. Unknown opening cost remains unknown.
- Removed the highlighted import/explanation/paste block above the bulk rows. Import remains available under Settings & Help.
- Fixed shared search-icon padding. Khata input text begins after 46px of padding, beyond the icon's 20px width; checked at phone width.
- Payment methods wait for the authoritative quote before becoming interactive, avoiding taps during the initial layout/total update.

## BUILDS / TESTS

| Check | Result |
|---|---|
| Frontend build | PASS |
| Backend build | PASS |
| Typecheck | PASS — frontend TypeScript project build and backend Nest build |
| Frontend unit tests | 51 passed, 0 failed |
| Backend focused unit tests | 17 passed, 0 failed |
| HTTP integration tests | 95 passed, 0 failed |
| Focused automated total | **163 passed, 0 failed** across the distinct suites above |
| Representative browser journeys | Eight business types passed; additional role/theme/draft/bulk checks passed |

The all-types test fixtures use setup-only synthetic sessions for the extra business types so a burst of fixture logins does not trigger the real abuse limiter. Business operations still pass the normal HTTP authentication, membership, feature and permission guards. Production rate limits were not changed.

## FILES CHANGED

Backend:

- `backend-typescript/src/retail/dto/retail-item.dto.ts`
- `backend-typescript/src/auth/business-presets.ts`
- `backend-typescript/test/retail-simplicity.e2e-spec.ts`
- `backend-typescript/test/business-quick-bill.e2e-spec.ts`

Frontend:

- `frontend/src/retail/billing/QuickBillCandidate.tsx`
- `frontend/src/retail/billing/RetailNewBill.tsx`
- `frontend/src/retail/billing/RetailPayment.tsx`
- `frontend/src/retail/billing/RetailThermalReceipt.tsx`
- `frontend/src/retail/billing/RetailBillHistory.tsx`
- `frontend/src/retail/components/retailNavigation.ts`
- `frontend/src/retail/components/RetailNavigationDrawer.tsx`
- `frontend/src/retail/RetailMore.tsx`
- `frontend/src/retail/RetailShell.tsx`
- `frontend/src/retail/RetailHome.tsx`
- `frontend/src/retail/RetailAmountSale.tsx`
- `frontend/src/retail/RetailAddItem.tsx`
- `frontend/src/retail/RetailKhata.tsx`
- `frontend/src/retail/experience/BulkItemEditor.tsx`
- `frontend/src/retail/experience/bulkRows.ts`
- `frontend/src/retail/experience/workflowDraft.ts`
- `frontend/src/retail/settings/RetailAccount.tsx`
- `frontend/src/retail/settings/RetailSettings.tsx`
- `frontend/src/retail/imports/MigrationWelcome.tsx`
- `frontend/src/retail/design/stitch-billing.css`
- `frontend/src/retail/design/stitch-system.css`
- `frontend/src/i18n/hi.json`
- `frontend/tests/unit/approvedUx.test.ts`
- `frontend/tests/unit/simpleNavigation.test.ts`

This report and the three review images are also in the project. Private test credentials, environment files and raw logs remain in ignored `output/` files. Unrelated pre-existing working-tree changes were preserved.

## MIGRATIONS

Migration added: **NO**.

The regular local database was missing the already-existing `20261015140000_item_unit_selling_price` migration. It was applied locally using the existing migration connection. It adds one nullable selling-price column and its nonnegative constraint, preserving existing conversion factors and documents. Schema inspection now finds no missing columns or pending migrations.

Backward compatible: **YES**. No production migration or deployment was performed.

## KNOWN LIMITATIONS

1. Mobile checks use a browser viewport. Actual Android keyboard, camera, OS share and physical printer behavior were not exercised in this run.
2. Complex measured items requiring dimensions and configured variants/batches/serials continue through the existing configured-item workflow. Quick entry does not create a parallel tracking engine or unlock a restricted plan feature.
3. No payment gateway or bank verification was added. UPI regression checks concern the existing recorded-payment and receiving-profile behavior.

## FINAL VERDICT

**APNA GALLA QUICK BILL + SIMPLE NAVIGATION VERIFIED**

The compact zero-setup entry flow and flat daily drawer are implemented and locally verified. Ready for the owner's localhost review; nothing was pushed.
