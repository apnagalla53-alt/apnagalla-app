# EVOLIX Business Insight Engine V1.5

V1.5 adds deterministic, read-only explanations of changes in a retailer's own records. It reuses the existing Assistant request path and the Retail reporting, Counter/Galla, and Phase 5.6 costing services. It does not create a second accounting/profit engine and makes no external LLM calls.

## Request and evidence path

`Retail Assistant → existing normalization/routing/date parsing → tenant/branch context → permission and entitlement checks → AssistantToolRegistry → BusinessInsightService → authoritative reports/counter/posted accounting → structured BusinessInsight → existing response template and card`

`BusinessInsightService` returns the selected and comparison periods, target metric, absolute and percentage change, ranked driver records, suggested follow-up questions, and confidence. The chat card shows the two periods, change, evidence class, explanation, and follow-ups. The Platform Assistant dashboard adds aggregate diagnosis counts, insufficient-data and cost-limited rates, diagnosis P50/P95/P99, errors, and use of four tracked intents. Platform analytics stores no response balances, item names, or financial answer payloads.

All reads use the authenticated company and branch. User-supplied tenant IDs, SQL, tool names, or entity IDs are not accepted. Intent permissions remain the existing report/accounting/purchase permissions and are checked before the tool executes.

## Measures and periods

| Measure | Source and interpretation |
|---|---|
| Net sales, bill count, payment split | Existing Operational Reports and Counter services. Period sales are net of posted returns. Payment splits are original checkout tenders, separate from later collections. |
| Gross profit, COGS, margin, net business profit, coverage | Phase 5.6 `FinancialReportsService.summary` and grouped reports. COGS uses saved sale-time weighted-average snapshots and original-cost return reversals. Unknown costs remain unknown. |
| Expenses | Posted business expenses plus authoritative inventory write-off/variance in the profit bridge. Owner drawings and supplier settlements are excluded from profit expense. |
| Purchases, returns, party settlements | Existing purchase/return reports and posted allocation references. A purchase is not assumed to be a cash payment or profit expense. |
| Item/category/staff/customer views | Existing Phase 5.6 grouped facts. Customer signals omit the system walk-in customer. These are supporting dimensions, not amounts to add to totals. |
| Current stockout signal | Current Inventory projection for an item whose period sales declined. It is classified as correlated. Historical out-of-stock duration and lost sales are unavailable, so no lost-revenue figure is invented. |
| Daily cash drawer | The existing Counter/Galla calculation for one business date. Cash tender and posted cash movements are distinguished from UPI/card/bank. Multi-day analysis labels broader settlements/outlays and does not reconstruct a daily closing drawer. |

Today vs yesterday and custom date ranges use the immediately preceding equal-length business-date period. Week-to-date uses the same weekdays of the prior week. Month-to-date uses the same dates in the prior month and caps the end date at that month's last day. Date boundaries are inclusive and use the tenant timezone.

The engine requires at least three bills in each nonempty side of a comparison; a truly empty period may be compared with a side containing three or more bills. Otherwise a diagnosis is marked `INSUFFICIENT`. A zero comparison base produces a null percentage rather than infinity. Gross margin is unavailable when either period has no known-cost revenue, and the answer is marked `LIMITED` rather than treating missing margin as zero.

## Decomposition and no-double-counting rules

For a sufficiently observed sales comparison, the bill-count and average-bill Shapley terms split the net sales change exactly:

`bill-count contribution + average-bill contribution = current net sales − previous net sales`

The two contributions are shown as direct mathematical drivers. Item, category, customer, staff, return, and current-stockout views are correlated supporting evidence. Those views overlap the same invoice totals and are never added to the two sales contributions.

The primary net-business-profit bridge is:

`net profit change = authoritative gross profit change − business expense/write-off change`

Expense contribution is sign-adjusted: an expense increase reduces profit. COGS, gross margin, discounts, returns, and item/category changes explain components already present in the authoritative gross-profit movement; they are not counted a second time. Supplier payments and owner withdrawals are cash/working-capital movements, not profit expenses.

The cash-vs-profit answer keeps profit, net customer receivable movement, purchases, supplier payable movement, supplier payments, owner withdrawals, and the daily Galla cash calculation as separate facts. Credit purchases are not claimed to be paid in cash. For multi-day periods, return values are not equated to cash refunds without a method-specific posted cash movement.

## Evidence labels and materiality

- **DIRECT** identifies a measured amount or a mathematically valid decomposition of the requested metric. It does not assert an external cause.
- **CORRELATED** identifies a dimension or co-occurring signal that can overlap other results; it is never summed as an independent cause.
- **ESTIMATED** is reserved for a future estimate with a documented method. V1.5 does not estimate lost sales from stockouts.

Driver output filters changes below ₹500 in several detail views. Severity is based on material amount and percentage thresholds; it is a prioritization aid, not a causal confidence score. The response explicitly says that correlated observations do not prove an external cause.

## Permissions, tenant safety, and privacy

The V1.5 intent registry controls tool permissions/features. A user without the required report or accounting permission receives `PERMISSION_DENIED`. Tenant A/B database tests exercise different same-named parties/items and independent sales. No tenant ID is read from a message. Assistant logs retain redacted questions, intent/status/timing, diagnosis driver count, insufficient-data flag, and cost-limited flag only. Platform statistics use aggregates and do not expose tenant financial answers.

## Current limits

- Stockout history/duration, exact lost sales, supplier-rate history, active selling days, and repeat-customer frequency are not available from the current authoritative report APIs; V1.5 does not infer them.
- Customer activity signals are based on identified, non-walk-in customer report groups. They do not assign anonymous walk-in sales to a person.
- Existing financial grouped reports bound each dimension query to the first 50 groups; the Assistant returns at most ten driver records and five detail rows. Large-catalog completeness and query latency need representative production-size measurement.
- The cash drawer is authoritative per day. Multi-day payment-method analysis is not a historical daily-cash reconstruction.
- The Assistant remains read-only. It does not call GPT/OpenAI or other external LLMs, create transactions, or send WhatsApp/voice messages.

## Adding an insight intent

Add a curated intent and clear negative/confusion examples in `backend-typescript/src/assistant/intent-library.ts`; route only safe read questions in the existing router; declare the existing permission/feature; invoke the appropriate authoritative facade in `BusinessInsightService`; preserve the metric definition and evidence/overlap rules; keep user-tenant scope server-derived; add meaningful unit, PostgreSQL E2E, permission/tenant, and headed browser cases; and update the acceptance report. Never duplicate accounting, costing, or inventory postings.

Verification results for this version are recorded in [ASSISTANT_V1_5_REPORT.md](verification/ASSISTANT_V1_5_REPORT.md).
