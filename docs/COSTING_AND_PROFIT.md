# Costing and profit — Phase 5.6

Implementation date: 8 October 2026. Verification results and the complete acceptance matrix are in [PHASE_5_6_VERIFICATION.md](verification/PHASE_5_6_VERIFICATION.md). The initial independent audit is [PHASE_5_6_DATA_READINESS.md](verification/PHASE_5_6_DATA_READINESS.md).

## Authoritative posting

`InventoryPostingService` owns physical stock and inventory value. Its existing tenant-scoped item locks serialize receipts, sales, adjustments and reversals. One transaction posts the physical movement, weighted-average pool, saved document cost facts and accounting voucher. Feature services do not update `StockBalanceProjection` directly.

`InventoryCostState` has one pool per company, item and variant. Locations, batches and serials remain physical tracking dimensions. Cost is **moving weighted average**, with no FIFO/LIFO selector:

```
Average cost = known inventory value / base quantity, when all quantity has known cost
Receipt value = acquired base quantity × acquisition cost per base unit
New value = old value + receipt value
New average = new value / new base quantity
Sale COGS = physically issued base quantity × average immediately before issue
```

The base unit is configured on the item. A box of 300 tablets costing ₹1,500 adds 300 tablets at ₹5 each. A 15-tablet strip uses 15 × ₹5 = ₹75 COGS. Cartons, hardware boxes, kg, metres and measured area use the same engine. Purchase and sale documents retain the entered quantity, entered unit, factor and measured base quantity; later conversion changes do not remeasure history. Free issued units have COGS even when their revenue is zero.

## Opening stock, legacy data and uncertainty

Opening stock accepts an explicit purchase cost, including an intentional zero for free acquisition. Leaving it blank or choosing Skip records **unknown cost**, not zero-cost profit. Item master selling price, MRP and current purchase price never establish legacy acquisition cost.

The additive migration does not backfill historical invoices or value existing stock. On the first authoritative movement, existing physical quantity becomes an unknown pool. If known receipts mix with unknown stock, the known value and unknown quantity deplete proportionally; the entire sale remains cost-unknown. Reports expose its revenue and exclude its profit.

Cost Coverage offers an audited correction for the **remaining** unknown quantity. It requires report and inventory-write permission, a non-negative cost per base unit and a reason. The item lock protects the update, an audit records before/after values, and a value-only journal debits inventory and credits correction equity. It applies across the company's locations for the selected item/variant. A retry after correction is rejected. Earlier sale/return snapshots remain unchanged.

## Purchases and returns

Itemized Retail purchases acquire stock at net purchase value after purchase discount. Recoverable Input GST is posted separately and excluded from inventory cost. Explicit landed charges allocate across positive stock-line net values by a deterministic largest-remainder rule; allocations sum to the exact charge. A service/quick amount-only purchase does not acquire stock or create COGS.

Priced GRNs snapshot acquisition cost and accrue inventory against goods-received clearing. The linked supplier invoice clears that saved receipt value; a verified price difference posts to `PURCHASE_COST_VARIANCE`, rather than changing old sale margins. An **unpriced** legacy GRN remains unknown. Posting its later invoice does not silently reconstruct historical COGS; its clearing balance needs explicit reconciliation. Do not treat that stock as fully valued until its remaining cost has been established.

Purchase returns remove the linked original receipt's acquisition value. Supplier credit differences are explicit reconciliation entries; unknown receipt differences remain clearing entries rather than fabricated profit. Reversal restores the saved quantity/value and supplier bill allocation. Ambiguous original purchase lines are rejected.

## Sale and return facts

Sale lines retain `cost_status`, `cogs_total`, `cost_per_base_unit`, `net_revenue`, `gross_profit` and component movement references. A COGS journal debits COGS and credits inventory in the sale transaction. Delivery challans first reclassify issued value to dispatched inventory; their invoices recognize that original dispatch COGS without issuing stock twice.

Returns use the original sale's movements and original discounted taxable revenue. They reverse original COGS, even if another purchase has changed today's average. Multiple partial monetary refunds reconcile to the original saved amount; the final return absorbs any paisa rounding remainder. A return from an unknown-cost sale remains unknown.

Document reversals compensate the original saved movements and journal; they do not recompute cost from today's master price. A reversal that would create negative quantity or inventory value is rejected for review.

## Universal item rules

| Item capability | Cost treatment |
|---|---|
| Piece / alternate unit | Saved base quantity at company/item WAC |
| Weight / length / area | Decimal measured base quantity; original dimension/factor snapshot |
| Variants | Separate item/variant pools |
| Batch / expiry / FEFO | FEFO chooses physical lots; WAC determines COGS independently |
| Serial / warranty | Receipt movement keeps exact serial acquisition value; sale uses WAC; return reverses its saved sale COGS |
| Bundle | Sum actual component movement values; return uses original composition |
| Service | Revenue shown separately; direct cost/profit unknown because no authoritative direct-cost model exists |
| Price-only modifier | No invented extra cost; affected line marked incomplete |
| Stock location transfer | Paired physical/value movements; company pool and profit unchanged |
| Damage / expiry / wastage | Authoritative stock OUT; actual known value posts to inventory-loss expense |
| Personal stock consumption | Authoritative stock OUT; value posts to owner drawings, excluded from operating expenses |

Retail receiving, opening stock, billing and imports choose the earliest active stock location deterministically when no location is explicitly specified. Fresh tenants create Shop Stock first. Adding another location cannot arbitrarily redirect the default workflow.

## Tax, discounts and rounding

Net revenue excludes Output GST. Input GST is excluded from stock value when treated as recoverable by the existing purchase flow. Non-recoverable tax is not automatically inferred; it must be included in an explicit acquisition/landed-cost input under the business's configured tax treatment.

Line discounts use the saved pricing result. Bill discounts allocate exact paise over eligible line taxable values, before proportionate tax calculation. The quote and posted bill use the same allocation. Holding/resuming retains the bill discount. Returns use those saved discounted values.

Quantity and unit factors persist at six decimal places. Cost/value snapshots persist at twelve decimal places, with 40-digit Decimal intermediate arithmetic and half-up rounding. Customer bill amounts/tax allocations round to two decimal places. Existing accounting lines retain six decimals. Reconciliation allows a maximum ₹0.00001 ledger/value difference for storage rounding. Display rounds to two decimals; it is never the source of historical COGS. Bill round-off stays in its accounting ledger and is not invented as item margin.

## Reports and Assistant

[FINANCIAL_REPORTS.md](FINANCIAL_REPORTS.md) defines the totals. Home, the financial reports and deterministic Hindi/Hinglish/English Assistant invoke `FinancialReportsService`; none calculate profit from current purchase-price fields. Assistant item/bill answers preserve entity/date scope in their related report links.

Profit pages include P&L, gross/net summaries, item/bill/category/customer/staff grouping, daily/weekly/monthly trend, margin, configurable low-margin, below-cost sale lines, cost coverage and current stock valuation. Dates, searches and bounded 50-row pages use actual saved data. The trend chart shows actual reported periods; it does not invent missing dates. Current item/category/staff labels are presentation/grouping metadata; financial amounts remain immutable.

Profit is a **known-cost subtotal** when costs are incomplete. Services, unknown legacy sales and price-only extras are disclosed, not reported as zero-cost profit. Item/customer/staff/bill filters do not allocate whole-business expenses arbitrarily; their business-expense/net-business-profit fields are unavailable. Walk-in is explicitly the walk-in party, not an invented named customer.

## Reconciliation and security

Check every item/variant pool against physical projections across locations. Value reconciles as opening value + purchases + returns + audited additions − purchase returns − issued COGS − write-offs ± saved reversals. Transfers cancel. Compare the resulting known inventory value with the inventory-asset ledger, including original reversed vouchers and their compensations. Compare known physical sale/return value with COGS journals, accounting separately for unbilled dispatches.

For mixed unknown pools, accounting posts the **known value portion** removed. Fully known-line reports exclude the entire unknown sale, so reported COGS can be lower than the journal by that disclosed partial value. Neither number claims to be complete; remaining unknown costs and service costs require review. This distinction is essential when reconciling incomplete books.

Financial APIs require subscription, REPORTS entitlement and `reports.read`. Every ID filter is validated inside the authenticated company; branch scope is enforced. Corrections additionally require `inventory.write`. Retail, POS and legacy sales API responses strip private cost fields for users without financial-report access. No request can select another tenant's cost state.

## Operational limits

- This phase verifies the costing engine; it does not certify deployment, provider setup or production backups.
- No automatic historical cost reconstruction, service labor-cost model, manufacturing recipe costing, FIFO/LIFO, LLM or WhatsApp integration was added.
- Unpriced legacy GRNs, opening corrections and their clearing/equity accounts require accountant review; a current correction never repairs old unknown sale profit.
- Unknown cost is conservative across the entire company/item/variant pool, including locations holding different receipts.
- Stock count posting supports ordinary base-unit items. Tracked/variant counts require their physical tracking details and are rejected by that generic flow.
- CSV export is explicitly the current bounded report page. Larger exports use successive pages; this phase does not claim a full accounting-system export.
- The test tenants and databases are disposable. Test credentials must not be deployed or used as production accounts.

Apply migrations with `npx prisma migrate deploy`, then `migrate status`, `validate` and `generate`. Take a verified backup before a real deployment and use the existing production release checklist. No deployment is authorized by completion of this phase.
