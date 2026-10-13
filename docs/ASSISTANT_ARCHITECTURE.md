# EVOLIX Assistant V1.5

V1.5 is a deterministic, authenticated, **in-app, read-only** query layer. It does not call an LLM, generate SQL from questions, change business records, send WhatsApp messages or provide voice AI. The existing reporting, Phase 5.6 costing, Khata, Counter, Inventory and subscription facades supply its answers. V1.5 adds business-change diagnoses through `BusinessInsightService`; see [BUSINESS_INSIGHT_ENGINE.md](BUSINESS_INSIGHT_ENGINE.md).

## Request pipeline

`Retail chat → authenticated context → normalization → exact/pattern/fuzzy router → business dates → permission/entitlement check → tenant-scoped entities/clarification → registered read tool → authoritative facade → selected fields → deterministic template → chat`

Retail opens `/retail/assistant` from Home, the shop drawer or More. Platform opens `/platform/assistant`. The Retail API is `POST /api/v1/assistant/query` with:

```json
{"message":"Aaj ki sale?","language":"hinglish"}
```

Follow-ups send only the returned `session_id` and `session_version`, with the next message. The API rejects arbitrary company, entity, SQL and tool parameters. AuthGuard supplies organization, membership, company, branch, user and persisted login-session identity. The company supplies its real timezone. Platform JWTs cannot call this endpoint.

Replies contain a status, text, intent/confidence/router, period, selected summary/rows, safe related-page link, generation timestamp, timing breakdown and conversation version. Statuses are SUCCESS, UNKNOWN, AMBIGUOUS, NOT_FOUND, PERMISSION_DENIED and ERROR. A valid empty result is SUCCESS with `result.empty=true`.

## Definitions and shared services

| Questions | Authoritative facade / definition |
|---|---|
| Sales, customer/staff sales | OperationalReportsService.sales, also used by dashboard/Sales Report. Posted invoice value minus posted returns. Staff returns follow the original seller. |
| Cash/UPI/card/bank/credit sales, bill counts | CounterService.salesPayments. Original checkout snapshots; later customer collections never change original credit given. Net sales and original payment allocation are explicitly distinguished. |
| Galla, opening/expected cash, cash received | The same CounterService.galla as the counter screen. Total sales is gross checkout value, with returns/refunds separate. Real cash voucher movement drives drawer cash. |
| UPI received | CounterService.upiReceived, shared by dashboard/Sales Report. Checkout UPI plus separately posted UPI bank receipt lines. |
| Customer/supplier dues and Khata | RetailService reference-allocation balance and statement; company-wide, as existing Khata. Positive due, negative advance. An advance for one party cannot reduce another party's receivable/payable. |
| Party payments | Reporting facade's posted party RECEIPT/PAYMENT lines; excludes checkout receipts/refunds and includes ordinary receipts with null source type. |
| Purchases, expenses, returns | Shared OperationalReportsService summaries used by corresponding reports. Business Expense and Owner Withdrawal remain separate. |
| Top items and item sales | Existing ReportsService net item quantity/value, with item filtering. |
| Stock, low/out of stock | Reporting facade reading Inventory projections, current branch/location/variant, excluding expired lots, services, kits, inactive and uncounted items. It never posts or mutates stock. |
| Batch/expiry | Positive received batch projections; upcoming expiry is today through the next 30 days. |
| New stock | Posted PURCHASE_IN movement quantities, not imported opening balances. No purchase cost is inferred from unpopulated inventory valuation fields; posted purchase invoice amounts belong to the Purchase Report. |
| Need List | Current NEED/ORDERED entries, excluding RECEIVED/CANCELLED. |
| Subscription | Existing EntitlementService subscription summary; persisted effective plan/status/expiry, no fabricated payment status. |

Counter summaries stream voucher/invoice pages; expense totals aggregate in PostgreSQL. Stock and dues stream 200-record pages rather than loading every master. Assistant lists return five rows and use Show more. Catalog/checkout/staff-attribution safety limits are documented below; large scope failure is explicit, never a silently truncated total.

Older invoices with missing checkout snapshots cannot establish original Cash/UPI/Udhar allocation. Counter/payment summaries return a clear error instead of guessing. The source allocation needs reconciliation from original records; V1 does not invent or backfill it.

## Intent library and routing

`src/assistant/intent-library.ts` controls 96 tools (60 original fact/report tools and 36 V1.5 insight intents) and their permissions/features. Date, range and payment filters are query attributes rather than hundreds of duplicate commands.

| Category | Intent codes |
|---|---|
| Sales | SALES_SUMMARY, CASH_SALES, UPI_SALES, CARD_SALES, BANK_SALES, UDHAR_SALES, BILL_COUNT, UDHAR_BILL_COUNT, TOP_SELLING_ITEMS, ITEM_SALES, CUSTOMER_SALES, STAFF_SALES, BILL_LOOKUP |
| Counter | DAILY_GALLA, EXPECTED_CASH, OPENING_CASH, CASH_RECEIVED, UPI_RECEIVED, CUSTOMER_DUE_RECEIVED |
| Customer | CUSTOMER_BALANCE, CUSTOMER_TOTAL_DUE, CUSTOMER_KHATA, CUSTOMER_PAYMENT_RECEIVED, CUSTOMER_OVERDUE |
| Supplier | SUPPLIER_BALANCE, SUPPLIER_TOTAL_DUE, SUPPLIER_KHATA, SUPPLIER_PAYMENT_SUMMARY, SUPPLIER_PURCHASE_SUMMARY |
| Inventory | ITEM_STOCK, LOW_STOCK, OUT_OF_STOCK, STOCK_SUMMARY, EXPIRING_ITEMS, EXPIRED_ITEMS, BATCH_STOCK, LOCATION_STOCK |
| Operations | PURCHASE_SUMMARY, NEW_STOCK_RECEIVED, EXPENSE_SUMMARY, EXPENSE_BY_CATEGORY, OWNER_WITHDRAWAL_SUMMARY, NEED_LIST, URGENT_NEEDS, PENDING_NEEDS, RETURN_SUMMARY, RETURN_COUNT |
| Subscription | SUBSCRIPTION_STATUS, SUBSCRIPTION_EXPIRY, CURRENT_PLAN |
| Business insight V1.5 | WHY_SALES_DOWN, WHY_SALES_UP, COMPARE_SALES, SALES_TREND, WHY_PROFIT_DOWN, WHY_PROFIT_UP, COMPARE_PROFIT, PROFIT_TREND, SALES_VS_PROFIT_EXPLANATION, MARGIN_CHANGE_EXPLANATION, COGS_CHANGE_EXPLANATION, ITEM_PROFIT_DECLINE, ITEM_MARGIN_DECLINE, CATEGORY_PROFIT_DECLINE, CATEGORY_MARGIN_DECLINE, LOW_MARGIN_ITEMS_ANALYSIS, LOSS_MAKING_ITEMS_ANALYSIS, COMPARE_EXPENSES, WHY_EXPENSES_UP, COMPARE_PURCHASES, ITEM_SALES_DECLINE, ITEM_SALES_GROWTH, CATEGORY_SALES_DECLINE, CATEGORY_SALES_GROWTH, STAFF_PERFORMANCE_COMPARE, CUSTOMER_ACTIVITY_CHANGE, CUSTOMER_RECEIVABLE_GROWTH, SUPPLIER_PAYABLE_CHANGE, STOCKOUT_IMPACT, RETURN_IMPACT, CASH_VS_SALES_EXPLANATION, PROFIT_VS_CASH_EXPLANATION, WHERE_MONEY_WENT, BUSINESS_HEALTH_SIGNALS, BUSINESS_PROBLEM_SIGNALS, WEEKDAY_SALES_ANALYSIS |

Normalization uses Unicode NFKC, lowercase, punctuation/whitespace cleanup and conservative query shorthand (`aj`, `sel`, `gla`, `udr`, `expns`, `pymnt`). Entity lookup uses the original normalized text without shorthand substitutions; it does not rewrite stored names.

1. Exact approved normalized alias: confidence 1.
2. Controlled business patterns: score 0.96. Unsupported write requests, SQL/code, secrets and unrelated topics are refused before execution. Additional topic boundaries prevent purchase/return policy or stock-market questions from becoming financial totals.
3. Local pinned Fuse.js search: `1 - score`. Execution requires at least 0.77 and a 0.10 margin over the next different intent; 0.70+ uncertain results ask clarification, lower results are unknown. Scores are matching heuristics, **not calibrated probabilities**. The threshold supports the tested `ajj ki seel ktni h` case without automatic low-confidence execution.
4. No semantic classifier/fallback runs in V1.

There are **656 curated phrases** and two polite wrappers per intent: **848 default routing aliases, 843 distinct after normalization**. Patterns were refined using development failures; this is a bounded regression evaluation, not a blinded production-accuracy claim. Monitor real unknowns and false classifications during the pilot.

## Dates and entities

Dates support aaj/today, kal/yesterday, Hindi आज/कल, current/previous week and month, last N days, ISO, day/month and English named-month date ranges. Weeks start Monday, ranges are inclusive and limited to 366 days. For insight comparisons, week-to-date is aligned to the same weekdays in the prior week; month-to-date is compared to the equivalent dates in the prior month; custom ranges use the preceding equal-length range. `kal` means yesterday for historical read queries. Future write interpretation is not implemented. Invalid dates/ranges produce an understandable error.

Galla drawer/opening values require one day. Current stock, balances, need status and subscription settings cannot be presented as historical reconstructions: explicit past/range questions are rejected. Khata's balance is always current; explicitly requested dates filter its allocation history and the result labels that distinction.

Customer/supplier/item/category searches scope company; staff also scopes organization and membership/company/branch; locations and bills scope current branch. Inactive parties/items/staff are excluded. Names stay as stored. A few documented common Hindi-name search hints allow matching Latin records; this is not universal transliteration. Other names should use the spelling in the shop's records.

One exact/high-confidence entity continues; multiple matches ask a numeric/button choice. A bare name's balance/Khata checks permitted customer, supplier and staff candidates rather than guessing its role. Missing names ask for a name. Variant items ask explicit variant/all-variants selection; an exact configured attribute/SKU can resolve directly. Unknown variants/units never fabricate quantities. A packet is not assumed to equal a piece: the primary unit or a registered positive conversion must match. A location-plus-item question such as `Warehouse mein Maggi kitni hai` resolves both records in the same shop.

## Permissions and tenant safety

Every tool declares existing permissions and an effective entitlement feature. Owner/ADMIN/TENANT_ADMIN behavior follows existing RBAC. Other staff need the declared permission. Typical scopes are reports.read for sales/staff/returns, accounting.read for Counter/Khata/expenses, purchase.read for suppliers/purchases, inventory.read for stock/needs and settings.read for subscription. Feature checks enforce REPORTS, ACCOUNTING, KHATA, PURCHASING, INVENTORY, EXPENSES, BATCH_TRACKING and MULTIPLE_STOCK_LOCATIONS as applicable.

Authorization occurs before record resolution and again at tool execution. Restricted staff receive no financial result. Approved aliases cannot alter permissions, tenant scope or executable mappings. Static, parameterized SQL is used only for predefined operational latency/day aggregates, never generated from questions. No financial-result cache exists; only the global nonfinancial routing library is cached.

## Conversations and logging

Four additive models are introduced by migration `20261008120000_assistant_v1`:

- AssistantIntentConfig: active state for code-controlled intent IDs.
- AssistantExample: approved safe phrases, globally unique normalized alias, language/source/active metadata.
- AssistantConversation: company, branch, user and persisted login-session binding; 15-minute idle expiry and optimistic version updates.
- AssistantQueryLog: sanitized question, detected intent, score, router, status and processing timings; no financial answer payload.

Numeric choices, `uska khata`, date-only follow-ups and `aur dikhao` use server-stored IDs/query state. Every entity is revalidated; client payload cannot supply arbitrary chosen IDs. Another tenant/user/login session cannot reuse a conversation. Concurrent/stale versions return 409; expired or foreign conversations return 404.

JWTs, password/secret assignments, email and phone-like numbers are redacted before durable query logging. Question records are capped at 400 characters. Conversations retain query context, not financial answers. An hourly retention task removes expired conversations and query logs older than 30 days. Platform sees operational counts, not response balances. Test traces can contain login credentials and must remain private/ignored.

## Platform operations and approved learning

Dashboard reports day/week/month questions, recognized/unknown/ambiguous rates, denials/errors, average/P50/P95/P99 latency, top intents, unknowns and daily usage. V1.5 adds aggregate diagnosis totals, insufficient-data/cost-limited counts, error rate, P50/P95/P99 diagnosis latency, and use/error counts for four tracked diagnosis intents. Recognition means an intent or clarification was recognized; it is **not proof that a business answer or semantic classification was correct**. Intent response-success rate is separately labeled. Analytics days use Asia/Kolkata, and the window is 30 days.

Intent Library shows registered permission/feature/entity metadata and active state. Training Examples filter by intent, language, status and DEFAULT/ADMIN_ADDED/UNKNOWN_MAPPED source, with 50-row pagination. Unknown phrases have search and pagination, frequency and latest-occurrence ordering. No automatic training occurs.

### Add a new phrase without redeploying

1. Platform Super Admin → Assistant → Unrecognized Questions.
2. Search/select a logged phrase; choose Map to existing intent.
3. Review the meaning, choose the registered read intent and language, then Approve example.
4. Approval stores an audited alias; the current process reloads immediately, other API replicas within five seconds.
5. Verify it in the shop. Retire an incorrect example or deactivate its intent if necessary. Deactivation also prevents stored follow-up execution.

Training Examples can add a safe phrase directly. Conflicting normalized aliases cannot silently change tools. Never map a phrase to a financial question merely because it looks similar.

### Add a new intent (developer)

Define the intent/entities/permission/entitlement, implement its code-controlled registry branch, reuse or extend the authoritative facade shared with corresponding screens, select safe output fields, add language templates and realistic phrases, add absent-from-reference routing questions/negative tests, add real posting-based E2E and cross-tenant/permission tests, verify the browser, then monitor pilot unknowns/errors.

## Performance, limits and verification

See the V1 baseline in `verification/ASSISTANT_V1_REPORT.md`, and the current V1.5 acceptance matrix in `verification/ASSISTANT_V1_5_REPORT.md`. `verification/ASSISTANT_LOAD_2026-10-08.json` records both simple and diagnosis query classes at 10/25/50 concurrent bursts against a disposable loopback tenant; tokens remain in environment, not command arguments. HTTP measurements include auth and durable session/log writes. Logged processing time ends before query-log persistence; the distinction is reported.

Pilot infrastructure remains NestJS/PostgreSQL, with no Redis, vector database, GPU or Kubernetes requirement. Approximate target: 500 users × 20 questions/day. The current evidence is a small local burst, not a production capacity guarantee. Rate limiting is 180 questions/minute/user, separate from POS; it is process-local under current single-API pilot deployment. Multi-replica deployment needs a shared rate-limit implementation/edge policy.

Limits: 400-character questions, 366-day historical periods, five response rows, 50-row admin pages, 5,000 active/retained aliases, 100 variants examined per item, 10,000 checkout/voucher/catalog/party or staff-source records per scoped summary. Limits fail clearly rather than guessing/truncating totals. Top-item grouped reports retain existing facade behavior; large-report scaling should be measured against representative pilot catalog sizes. There is no claim of full arbitrary-language comprehension, universal name transliteration, offline assistance or historical stock reconstruction.

## Future boundaries (disabled)

Later local semantic classification or an optional LLM fallback may produce a proposed allow-listed intent/entity candidate only; it must still pass this same authorization, registry and authoritative read path. Neither is configured or called now. Future speech-to-text or WhatsApp adapters can invoke this same service; they require separately authorized channel authentication, consent and provider setup. Future writes require preview, explicit confirmation, permissions, authoritative posting, idempotency and audit. **None are enabled in V1.**
