# EVOLIX Phase 5.6 verification

Verified: 8 October 2026. Backend, database, build and headed browser acceptance completed successfully.

Scope: authoritative costing, immutable COGS, original-cost returns, financial reports and deterministic Assistant profit tools. Existing Retail architecture retained. No deployment or next-phase work.

## Independent audit and fixes

The pre-change [data-readiness matrix](PHASE_5_6_DATA_READINESS.md) found absent historical COGS, zero/default opening-cost ambiguity, quantity-only inventory, wrong return cost sources and purchases treated as an operating-expense ledger. These critical/high financial-integrity gaps were fixed through the existing Inventory/POS/Purchase/Accounting transaction path.

Initial universal-item-flow and FEFO baseline: **37 passed, 0 failed**. Final regression retained those assertions. Old receipt/batch fixture lookups were scoped to their newly created tenant, replacing global cleanup and preventing earlier test data from being selected. This changed isolation of fixtures, not business acceptance expectations.

Additional issues fixed during verification:

- Partial-return paisa rounding could exceed the original discounted bill total across three returns; final refund uses the exact saved remainder.
- A legacy numeric inventory ledger code could belong to a supplier; cost journals now select a dedicated inventory asset account instead of posting to that party.
- Unordered default-location queries could change their choice after adding a second location; opening/receiving/billing/import choose the earliest active location consistently.
- Promotional FEFO movements lacked cost-line attribution; free-item COGS and physical per-unit cost are now saved correctly.
- Purchase-return reversal now restores supplier bill allocation, as well as quantity, inventory value and accounting.
- Supplier invoice price variance clears priced GRN accrual explicitly; delivery-linked invoice COGS recognizes the original dispatch without double stock issue.
- Private cost fields are stripped for restricted users in Retail, POS and legacy sales responses.
- Missing-cost correction uses the Indian business date, including the final day of a financial year; its equity journal uses the correct credit balance convention. A headed correction test was repeated against the final compiled API.

## Mandatory lifecycle proof — actual database

Disposable database: `evolix_costing_20261008_test`. Tenant: `cost-a-c0ed5305-8819-498c-a4fc-83457d082869`. This was provisioned by the real tenant provisioning service, with real HTTP login and Retail posting endpoints. No production database was reset or pushed.

| Action | Quantity after action | Inventory value | Average / saved cost | Revenue / profit |
|---|---:|---:|---:|---:|
| Purchase 100 @ ₹10 | 100 | ₹1,000 | ₹10 | — |
| Purchase 100 @ ₹12 | 200 | ₹2,200 | ₹11 | — |
| Sell 10 @ ₹15 | 190 | ₹2,090 | Saved COGS ₹110 | Net sales ₹150; gross profit ₹40 |
| Purchase another 100 @ ₹20 | 290 | ₹4,090 | Current average ₹14.103448275862 | Original sale COGS stays ₹110; original profit stays ₹40 |
| Return 4 original units | 294 | ₹4,134 | Original COGS restored ₹44 | Revenue reversed ₹60; profit reversed ₹16 |
| Final position | **294** | **₹4,134** | Current average **₹14.061224489796** | Net sales **₹90**, COGS **₹66**, gross profit **₹24**, margin **26.67%**, coverage **100%** |

Item-specific operating expenses/net business profit are deliberately unavailable: the engine does not assign the entire shop's expenses to this item.

## Universal tenant demonstration

The same real tenant includes all required universal items, opening stock, differently priced purchases, alternate-unit sales, measured sales, discounted bills, partial/full returns, business expense, owner withdrawal and supplier payment.

| Item | Actual receipt/sale | Final stock | Current average | Known inventory value |
|---|---|---:|---:|---:|
| Pharmacy | 10 boxes × 300 tablets at ₹1,500/box; strip of 15 at ₹105; later 2 strips + 3 tablets | 2,952 TAB | ₹5 | ₹14,760 |
| Grocery | 5 cartons/crates × 24 pieces at ₹480; sale 3 pieces | 117 PCS | ₹20 | ₹2,340 |
| Hardware | 10 boxes × 100 pieces at ₹1,000; sale 27 pieces | 973 PCS | ₹10 | ₹9,730 |
| Weight | 10 kg at ₹600; sale 0.25 kg at ₹800/kg | 9.75 KG | ₹600 | ₹5,850 |
| Length | 90-metre roll at ₹2,700; sale 12.5 metres at ₹50/m | 77.5 M | ₹30 | ₹2,325 |
| Area | 10 sheets × 8×4 sq ft at ₹10/sq ft; sale 2×3 sq ft | 314 SQFT | ₹10 | ₹3,140 |

The larger test tenant also includes variant pools, batches/FEFO, serial receipts/warranty, bundles, service revenue, free promotions, transfer, stock count loss, zero-cost acquisition and unknown-cost opening stock. These are actual posted records, not mock report inputs.

Whole-tenant summary on 8 October:

| Measure | Actual result |
|---|---:|
| Net Sales, excluding Output GST | ₹2,886 |
| Known-cost net revenue | ₹2,756 |
| Reported fully known-line COGS | ₹1,834 |
| Gross Profit, known-cost subtotal | ₹922 |
| Gross Margin on known-cost revenue | 33.45% |
| Business Expenses | ₹40 |
| Net Business Profit, known-cost subtotal | ₹882 |
| Service revenue without direct cost | ₹100 |
| Product cost coverage | 99.06% |
| Complete profit? | **No — 2 incomplete lines are disclosed** |

₹40 expenses comprise ₹10 business expense, ₹10 remaining stock-count loss and ₹20 verified purchase invoice price variance. Owner withdrawal and supplier payment do not reduce profit. Unknown historical product revenue and service direct costs remain excluded from profit; current missing-cost correction does not rewrite that history.

Reconciliation: **33 item/variant pools**, **₹50,767 known inventory value**, **₹50,767 inventory asset ledger**, **₹0 difference**. Every pool matches physical quantity and saved movement value plus audited correction. **145 posted vouchers balanced; 0 unbalanced**. COGS journal and physical net issued value both equal **₹1,846**; report COGS is ₹1,834 because the **₹12 known portion of an unknown-cost sale** is journaled but excluded from whole-line profit. This disclosed difference is tested and must not be hidden.

Machine-readable evidence: [costing-proof.json](../../output/phase56/costing-proof.json).

## Acceptance matrix

All Phase 5.6 criterion rows below have direct core/report/mobile evidence. The full selected headed Retail regression also passed, with no skipped, flaky or failed cases.

| Area | Criterion | Result | Evidence |
|---|---|---|---|
| Costing core | Moving Weighted Average | PASS | ₹2,200/200; concurrent 100@10 + 100@12 receipts |
| Costing core | Base Unit Cost | PASS | Canonical base quantities; pharmacy/carton/roll conversion |
| Costing core | Opening Stock Cost | PASS | Explicit known cost, intentional zero, unknown omission |
| Costing core | Unknown Cost Handling | PASS | Mixed pool excludes profit; audited remaining correction |
| Costing core | Cost Coverage | PASS | 0%, 100%, 90.91% browser and 99.06% universal demo |
| Costing core | Purchase Cost Normalization | PASS | Discount, landed charges, recoverable GST separation |
| Costing core | Purchase Return | PASS | Original acquisition value and exact reversal/allocation |
| Costing core | Sale-Time COGS Snapshot | PASS | Saved ₹110 independent of later purchase |
| Costing core | Historical Immutability | PASS | Old sale remains ₹110/₹40 after new cost and correction |
| Costing core | Sale Return Original COGS | PASS | Original 4-unit COGS ₹44; three paisa refunds reconcile |
| Universal Retail | Piece | PASS | Basic lifecycle and free-acquisition sale |
| Universal Retail | Multi-Unit | PASS | Base/alternate receipt and sale DB tests |
| Universal Retail | Pharmacy Box/Strip/Tablet | PASS | 300-tab box, 15-tab strip; ₹75 strip COGS |
| Universal Retail | Grocery Carton/Piece | PASS | 24-piece carton; 3-piece COGS ₹60 |
| Universal Retail | Hardware Box/Piece | PASS | 100-piece box; 27-piece COGS ₹270 |
| Universal Retail | Weight | PASS | 0.25kg COGS ₹150 |
| Universal Retail | Length | PASS | 12.5m COGS ₹375 |
| Universal Retail | Area | PASS | 6 sq ft COGS ₹60 with saved dimensions |
| Universal Retail | Variant | PASS | Red ₹10 and blue ₹20 separate pools |
| Universal Retail | Batch | PASS | Early lot selected; ₹15 WAC independent of ₹10 lot cost |
| Universal Retail | Serial | PASS | Exact ₹100/₹200 receipts; ₹150 sale COGS and original return |
| Universal Retail | Bundle | PASS | ₹20 component cost and original-composition return |
| Universal Retail | Service | PASS | Revenue separate; unknown direct cost never fabricated |
| Universal Retail | Stock Location Transfer | PASS | Company quantity/value/journal/profit unchanged |
| Profit | Net Sales | PASS | Saved discounted taxable amounts, returns, no Output GST |
| Profit | COGS | PASS | Saved known line facts and journal reconciliation |
| Profit | Gross Profit | PASS | ₹150−₹110=₹40; returned net ₹24 |
| Profit | Gross Margin | PASS | Item final ₹24/₹90=26.67% |
| Profit | Business Expenses | PASS | Expense/write-off/variance, without drawings/payments |
| Profit | Net Business Profit | PASS | Browser ₹24−₹10=₹14; universal known subtotal ₹882 |
| Profit | Owner Withdrawal Exclusion | PASS | ₹50 withdrawal leaves business profit unchanged |
| Profit | Supplier Payment Exclusion | PASS | ₹20 settlement leaves operating profit unchanged |
| Profit | Returns | PASS | Proportional original revenue/COGS; final paisa remainder |
| Profit | Discount | PASS | Line/bill discount; GST quote/post; held/resumed discount |
| Profit | Tax Treatment | PASS | Input GST excluded from acquired value; Output GST from revenue |
| Reports | Profit & Loss | PASS | Real browser loaded/empty/error/retry and saved report totals |
| Reports | Item Profit | PASS | Searchable item selection, scoped ₹24, CSV |
| Reports | Bill Profit | PASS | Original saved bill section and returned bill grouping |
| Reports | Category Profit | PASS | Tenant-scoped saved facts grouped by current category |
| Reports | Customer Profit | PASS | Recorded party grouping; explicit Walk-in attribution |
| Reports | Staff Profit | PASS | Original seller grouping, without fabricated salary profitability |
| Reports | Profit Trend | PASS | Daily/weekly/monthly responsive chart and real period rows |
| Reports | Low Margin | PASS | Configurable threshold and actual saved margin query |
| Reports | Below Cost | PASS | Actual loss sale lines and ₹−1.06 browser discounted bill |
| Reports | Cost Coverage | PASS | Remaining-stock correction and unchanged unknown historical sale |
| Reports | Stock Valuation | PASS | Pool/physical/location queries and ₹50,767 ledger match |
| Assistant | Profit Summary | PASS | Home/P&L/Hindi response exact ₹24/₹14 parity |
| Assistant | Item Profit | PASS | Hindi Lifecycle ₹24 profit, ₹66 COGS, 26.67% margin |
| Assistant | Loss-Making Item | PASS | Browser Loss ₹−15 from the same report query |
| Assistant | Report/Assistant Parity | PASS | Saved JSON response comparisons; scoped related-report links |
| Security | Tenant Isolation | PASS | Tenant B IDs rejected against A stock/bill/branch filters |
| Security | Permission Enforcement | PASS | Restricted cashier report/correction 403; private costs stripped |
| Security | No Cross-Tenant Cost | PASS | B correction rejected and A pool unchanged |
| Integrity | Inventory Qty Reconciliation | PASS | Every one of 33 pools matches physical projections |
| Integrity | Inventory Value Reconciliation | PASS | ₹50,767 pool vs asset ledger; movement/audit totals equal |
| Integrity | COGS Reconciliation | PASS | ₹1,846 journal/issued cost; ₹12 unknown-line portion disclosed |
| Integrity | Return Reconciliation | PASS | ₹44 original restoration and exact full partial refund |
| Integrity | No Historical Recalculation | PASS | Migration and audited correction preserve old facts |
| Integrity | Concurrency | PASS | Concurrent same-item receipts, last stock and same serial |
| Integrity | Idempotency | PASS | Duplicate canonical source, stock-count/return reversal retries; existing API retry suite |
| UI | Reports Mobile 360 | PASS | Headed 360×800 route/overflow checks |
| UI | Reports Mobile 390 | PASS | Headed 390×844 route/overflow checks |
| UI | Reports Mobile 412 | PASS | Headed 412×915 route/overflow checks |
| UI | Light Mode | PASS | All 14 report pages, screenshots and live chart |
| UI | Dark Mode | PASS | All 14 report pages and inspected P&L/valuation screenshots |
| UI | No Dropdown-Heavy Report UX | PASS | Date chips, segmented intervals, filter/selection sheets |
| Build | Prisma Validate | PASS | Disposable/full chain validation exit 0 |
| Build | Prisma Generate | PASS | Prisma Client 5.22.0 generated; exit 0 |
| Build | Migration Deploy | PASS | Clean 31-migration chain; 27→31 upgrade with legacy stock retained |
| Build | Backend Build | PASS | TypeScript --noEmit and Nest build exit 0 |
| Build | Frontend Build | PASS | TypeScript --noEmit and tsc−b/Vite build exit 0 |

## Automated counts

| Suite | Passed | Failed | Exit code |
|---|---:|---:|---:|
| Backend unit, 34 files | 1,097 | 0 | 0 |
| Full DB/API E2E, 19 files | 341 | 0 | 0 |
| Phase 5.6 DB/API subset | 39 | 0 | 0 |
| Existing DB/API regression, excluding Phase 5.6 subset | 302 | 0 | 0 |
| Universal + batch baseline subset | 37 | 0 | 0 |
| Phase 5.6 cost/discount/allocation unit subset | 13 | 0 | 0 |
| Financial headed browser subset | 7 | 0 | 0 |
| Full selected headed Retail/Assistant/manual browser regression, 5 files | 43 | 0 | 0 |
| Final compiled API: repeated headed missing-cost correction case | 1 | 0 | 0 |

Subsets overlap their full suites and must not be added again. The repeated final correction case is already one of the 43 browser cases. Unique full-suite total: **1,481 passed, 0 failed**. All 39 Phase 5.6 DB cases pass. Full E2E also covers existing production/auth/platform/tenant/import/attachment/UPI/Galla/bundle/serial regression.

The requested thematic counts below overlap; they are coverage classifications of actual passing cases, not additional tests.

| Requested category | Passed | Failed | Classification |
|---|---:|---:|---|
| Costing Unit Tests | 13 | 0 | 7 costing, 4 bill discount, 2 currency allocation |
| Costing DB E2E | 39 | 0 | Real PostgreSQL and HTTP posting/report/security cases |
| Universal Retail Cost Tests | 12 | 0 | Piece, 5 alternate-unit cases, area, variant/FEFO, serial, bundle, service, location transfer |
| Profit Report Tests | 8 | 0 | Grouping, unknown cost, zero acquisition, service, supplier settlement, business expense, date validation, Assistant parity |
| Return Tests | 7 | 0 | Original partial return, paisa partial returns, purchase return/reversal, GRN reversal, serial return, bundle return, wastage reversal |
| Tenant Tests | 2 | 0 | Cross-tenant IDs/correction, restricted cashier reports and private cost visibility |
| Existing Retail Regression | 302 | 0 | All existing API E2E cases, excluding the 39 new costing cases |

Archived evidence: [unit log](../../output/phase56/unit.log), [API E2E log](../../output/phase56/e2e.log), [43-test headed browser log](../../output/phase56/browser.log), [43-test browser JSON](../../output/phase56/browser-results.json), [final correction repeat](../../output/phase56/final-correction-browser.log), [clean migration chain](../../output/phase56/migration.log), and [development migration status](../../output/phase56/development-migration.log).

Headed acceptance includes all 14 financial report routes in light/dark at 360×800, 390×844 and 412×915, plus existing Retail routes at mobile, tablet and desktop sizes. Functional cases use real purchase, bill, return, payment and correction screens. API timeout/error paths show retry states; Hindi Assistant values agree with Home and P&L.

Final API logs: `scratchpad/costing-unit-complete.log`, `costing-e2e-complete.log`. Build logs: `costing-backend-tsc-complete.log`, `costing-backend-build-complete.log`, `costing-frontend-tsc-complete.log`, `costing-frontend-build-complete.log`. Migration logs: `costing-clean-chain-final.log`, `costing-migrate-final.log`, `costing-generate-final.log`. These were executed, not inferred from earlier PASS statements.

The generated Windows Prisma DLL was initially locked by the local test API. That API was stopped, generation completed with exit 0, then the final build was restarted for headed acceptance. Clean deployment and migration status were tested independently on newly created disposable PostgreSQL databases. The confirmed local `evolix_trade_dev` database also received the additive migrations and passes status/validation with all 31 migrations applied. No `migrate reset` or `db push --accept-data-loss` was used.

## Scope limits / stop

The implementation's intentional limits are in [COSTING_AND_PROFIT.md](../COSTING_AND_PROFIT.md): conservative unknown costs, unpriced legacy GRN reconciliation, no service/modifier direct-cost model, current-page CSV and no fabricated complete profit. They are visible product states, not hidden PASS bypasses.

This phase does not authorize production deployment or certify external backup/payment/email/Google providers. No additional business modules, Business Insight, LLM, WhatsApp or FIFO/LIFO were started. Work is stopped for owner review.

**EVOLIX PHASE 5.6 — UNIVERSAL COSTING, COGS & PROFIT VERIFIED**
