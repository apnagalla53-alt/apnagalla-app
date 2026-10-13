# Financial report definitions

All monetary facts are Decimal values from posted sale/return snapshots. Date selection uses the stored business date in Asia/Kolkata. Both date boundaries are inclusive; normal queries span at most one year. A specific bill may show its longer saved history.

| Measure | Definition |
|---|---|
| Net Sales | Posted saved taxable sale revenue minus posted taxable returns, excluding Output GST. Includes service/unknown revenue, clearly disclosed. |
| Known-cost revenue | Net revenue from fully known-cost product lines only. |
| COGS shown in profit reports | Saved COGS of fully known-cost product lines minus original COGS of their returns. Never today's item master price. |
| Gross Profit | Known-cost revenue minus its saved COGS. Incomplete business books display this as a known-cost subtotal. |
| Gross Margin | Gross Profit ÷ known-cost revenue × 100. Unavailable when the denominator is zero. |
| Business Expenses | Posted business Expense records plus signed inventory-loss/purchase-price-variance journal amounts in the selected period/branch. Excludes owner withdrawals and supplier settlements. |
| Net Business Profit | Known-cost Gross Profit minus Business Expenses. Still incomplete if unknown/service costs exist. Unavailable for item/bill/customer/staff/category filters because expenses are not arbitrarily allocated. |
| Owner Withdrawal | Equity/cash movement. Excluded from business expenses and profit calculation. |
| Supplier Payment | Cash/bank reduction and supplier-liability settlement. Excluded from operating expenses and COGS. |
| Purchases | Stock acquisition increases inventory value; quick non-stock purchase does not automatically become a P&L expense. Record actual operating expenditure through Expenses. |
| Service Revenue | Net taxable service revenue minus returns, separately shown; absent direct cost means service profit is unknown. |
| Cost Coverage | 100 × original product sale revenue with known cost ÷ all original product sale revenue, using absolute revenue. Zero-revenue periods use product-line counts. Services are excluded from this denominator; their costs can still make overall profit incomplete. Returns do not erase original coverage gaps. |
| Current Stock Valuation | Current physical base quantity × company/item/variant WAC, only when all pool quantity is known. Mixed/legacy quantity shows Unknown, with the known portion and unknown quantity available explicitly. Includes expired stock until physically written off. |
| Low Margin | Aggregated known-cost item margin below the chosen threshold, default 10%. Unknown lines remain visibly incomplete. |
| Below Cost | Actual posted sale lines with saved taxable revenue below saved COGS. A later profitable bill cannot hide an earlier loss. |
| Item/Category/Customer/Staff Profit | Saved known-cost amounts grouped by the associated item/current category/recorded party/original invoice seller. Anonymous walk-in is labeled as such. Staff attribution does not include salary or claim employee net profitability. |
| Bill Profit | Original bill plus its posted returns in the selected dates; saved original bill facts remain unchanged. |
| Profit Trend | Daily, Monday-based weekly or monthly grouping of actual recorded sales/returns. Responsive chart shows Net Sales and known-cost Gross Profit; no fabricated missing periods. Net business profit is shown in the period summary where whole-business expenses can be attributed. |

Filters validate company ownership of item, variant, branch, location, customer, bill and staff IDs. Lists use 50-row pages and bounded search. Current valuation supports item, variant, category, branch and location; customer/staff filters are not offered for physical inventory.

CSV downloads contain the **current page**, named accordingly, and protect spreadsheet cells from formula injection. Stock costs and private profit facts require backend report authorization, even if UI elements are hidden.

The COGS **accounting journal** includes known portions of mixed unknown pools, while profit reports exclude those entire unknown lines. Reconcile that disclosed difference before treating a report as a complete P&L. See [COSTING_AND_PROFIT.md](COSTING_AND_PROFIT.md) for the full posting and uncertainty policy.
