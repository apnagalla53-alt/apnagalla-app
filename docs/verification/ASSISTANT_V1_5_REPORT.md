# EVOLIX Assistant V1.5 verification report

Verified locally on 8 October 2026. This report covers the authorized deterministic business insight extension over Phase 5.6. It is a review checkpoint for the Assistant, not a production-readiness or deployment approval for the wider ERP.

## Independent audit and outcome

The initial audit is recorded in [ASSISTANT_V1_5_AUDIT.md](ASSISTANT_V1_5_AUDIT.md). Before implementation, the Assistant answered factual totals but had no diagnosis path, period parsing could compare unequal month ranges, overlapping sales/profit dimensions could be misrepresented as independent causes, cost coverage could be overstated, broad report permission could expose owner-only dimensions, and the UI had no structured diagnosis card. These critical/high issues were addressed in the existing request and tool path. All prior working-tree changes were preserved; no cleanup, reset, production migration, or deployment was performed.

V1.5 adds **36 deterministic insight intents** to the existing 60 fact/report intents (96 registered total). `BusinessInsightService` orchestrates existing Financial Reports, Operational Reports, Counter/Galla, Khata, Inventory and Prisma-scoped read models. Phase 5.6 remains the single source of costing and profit facts. No external LLM, GPT/OpenAI call, new profit engine, business write, WhatsApp action, or voice workflow was added.

## Acceptance matrix

`PASS` means the supported behavior has code and regression evidence. `PARTIAL` means the deterministic signal exists but the underlying historical dimension or a dedicated scenario is unavailable; the Assistant discloses the limit and does not invent a value or cause.

### Business insight engine

| Acceptance | Result |
|---|---|
| BusinessInsightService | PASS |
| Existing Assistant integration | PASS |
| Zero external LLM calls | PASS |

### Sales

| Acceptance | Result |
|---|---|
| Why sales down | PASS |
| Why sales up | PASS — isolated PostgreSQL fixture asserts current sales exceed the prior period |
| Sales comparison | PASS — equal-length periods and month-to-date / week-to-date comparisons |
| Sales trend | PASS — routed through the same bounded period facts |
| Bill-count driver | PASS — direct decomposition |
| Average-bill driver | PASS — direct decomposition |
| Customer driver | PARTIAL — identified non-walk-in customers only; repeat-customer frequency is unavailable |
| Item driver | PASS — grouped report signal, labeled as supporting evidence |
| Category driver | PASS — grouped report signal, labeled as supporting evidence |
| Stockout signal | PARTIAL — current stock is correlated with falling item sales; historical stockout duration and lost sales are unavailable |
| Return impact | PASS — posted returns are sourced from the existing reports |
| Staff signal | PASS — existing staff sales dimension |

### Profit

| Acceptance | Result |
|---|---|
| Why profit down | PASS — reconciles to Phase 5.6 gross profit less business expenses/write-offs |
| Why profit up | PARTIAL — intent and analysis path exist; a distinct rising-profit fixture is not present in the final scenario set |
| Profit comparison | PASS |
| Profit trend | PASS |
| Sales versus profit | PASS — costed posted bills demonstrate sales and gross profit rising while net profit falls after higher operating expense |
| Gross margin analysis | PASS — percent-point change; unavailable known-cost revenue is marked limited |
| COGS analysis | PASS — saved sale-time cost snapshots and original-cost return reversals |
| Expense impact | PASS — sign-adjusted direct profit bridge |
| Discount impact | PASS — shown as an explanatory component already reflected in gross profit; not added a second time |
| Return profit impact | PASS — original-cost reversal is preserved; return values are not assumed to be cash refunds |
| Item profit driver | PASS — Phase 5.6 grouped facts |
| Category profit driver | PASS — Phase 5.6 grouped facts |
| Product mix analysis | PARTIAL — grouped item/category changes are correlated supporting views; V1.5 does not assign a separate additive profit amount to overlapping mix changes |
| Low-margin analysis | PASS — authoritative grouped report facts |
| Below-cost analysis | PASS — authoritative grouped report facts |
| Cost coverage | PASS — incomplete legacy/unknown costs remain unknown and limit confidence |

### Cash and other diagnoses

| Acceptance | Result |
|---|---|
| Sales versus cash | PASS — tender receipts and credit remain distinct |
| Profit versus cash | PASS — receivable, purchases, payables, payments and withdrawals remain separate signals |
| Where money went | PASS — measurable working-capital/cash signals, without claiming profit is cash |
| Customer receivable change | PASS — allocation-based movement |
| Supplier payable change | PASS — allocation-based movement |
| Expense diagnosis | PASS |
| Purchase comparison | PASS |
| Business health | PASS |
| Business problem signals | PASS — ranked measurable signals, no external causes |
| Weekday analysis | PASS — grouped posted sales by weekday |

### Integrity and security

| Acceptance | Result |
|---|---|
| Sales report / Assistant parity | PASS — real PostgreSQL E2E compares to the same sales facade |
| COGS parity | PASS — same Phase 5.6 summary |
| Gross-profit parity | PASS — same Phase 5.6 summary |
| Net-profit parity | PASS — same Phase 5.6 summary |
| No double counting | PASS — sales direct contributions sum to the full change; overlapping dimensions stay supporting-only; profit uses the authoritative bridge |
| No fake causality | PASS — direct, correlated and limited/insufficient evidence are separated; no external cause is claimed |
| Evidence classification | PASS |
| Equivalent periods | PASS — same weekdays for WTD, equivalent days for MTD, equal-length preceding ranges otherwise |
| Insufficient data | PASS — fewer than three bills on a nonempty comparison side returns an explicit insufficient diagnosis; zero denominator has no infinite percentage |
| Tenant isolation | PASS — real two-tenant tests use same-name entities and different financial data |
| Permission enforcement | PASS — restricted cashier is denied financial/stock/party diagnosis; feature checks precede entity resolution |
| No cross-tenant financial data | PASS |
| Index and query review | PASS — scoped date queries use existing company/branch/date indexes; queries are grouped/bounded and issued without per-row N+1 reads; no speculative index migration was added |

## Performance

Measured against a fresh disposable tenant on the local Windows NestJS/PostgreSQL stack. The fixture has dated sales on both sides of the month-to-date comparison. The diagnosis mix contains sales and profit comparisons, sales-versus-profit, and business-problem queries. There are 170 requests total: 85 simple and 85 diagnosis requests. No errors occurred. A burst sample is not a production capacity guarantee.

| Query class | Concurrent | Requests / success | Processing P50 / P95 / P99 ms | HTTP P50 / P95 / P99 ms |
|---|---:|---:|---:|---:|
| Simple | 10 | 10 / 10 | 75.55 / 192.53 / 192.53 | 162.18 / 235.55 / 235.55 |
| Simple | 25 | 25 / 25 | 103.74 / 115.83 / 117.45 | 197.95 / 210.66 / 210.77 |
| Simple | 50 | 50 / 50 | 172.64 / 188.81 / 193.46 | 323.39 / 332.10 / 332.73 |
| Diagnosis | 10 | 10 / 10 | 154.70 / 214.02 / 214.02 | 189.27 / 246.53 / 246.53 |
| Diagnosis | 25 | 25 / 25 | 302.97 / 318.97 / 321.51 | 390.04 / 397.47 / 397.83 |
| Diagnosis | 50 | 50 / 50 | 540.68 / 576.86 / 579.51 | 695.89 / 707.38 / 707.70 |

The diagnosis path is measurably heavier than simple fact lookup, especially at 50 concurrent requests. These short local bursts do not establish sustained production capacity or performance on a large tenant. HTTP includes auth, persistence of session/query metadata and local transport. Processing time ends before query-log persistence. Exact scenario data: [ASSISTANT_LOAD_2026-10-08.json](ASSISTANT_LOAD_2026-10-08.json); runner: [verify-assistant-load.cjs](../../scripts/verify-assistant-load.cjs).

## Automated and build evidence

| Verification | Result |
|---|---|
| Assistant routing/math unit suite | 1,026 passed / 0 failed, 2 files; includes 5 direct comparison/decomposition math cases |
| Assistant authenticated PostgreSQL E2E | 129 passed / 0 failed, 1 file |
| Full backend unit suite | 1,294 passed / 0 failed, 35 files, exit 0 |
| Full PostgreSQL E2E suite | 382 passed / 0 failed, 19 files, exit 0 |
| Existing Retail / Universal item / Batch-FeFO / Serial-Warranty / Bundle / Platform / import and costing regressions | PASS — included in the full PostgreSQL E2E run |
| Frontend headed Assistant browser suite | 7 passed / 0 failed, exit 0 |
| Backend TypeScript check and build | PASS |
| Frontend TypeScript check and build | PASS |
| Prisma validate / generate / migration status | PASS |
| PostgreSQL migration chain | 31/31 applied and up to date in disposable test databases |

The headed Chromium run exercised a real fresh-owner tenant, all 17 required diagnosis questions with structured evidence and rendered answers, the factual Assistant flow, Platform intent review/approval, restricted cashier behavior, network retry, theme/focus behavior, 360×800, 390×844, 412×915, and 1366×900 desktop navigation/refresh. All seven tests passed in the final run. Early browser attempts hit a local setup mismatch: the ignored `frontend/.env.local` targets the existing API on port 8010 while the browser suite was scoped to the disposable API on 8011. The final visible run set `VITE_API_URL` only for the test process, left that local file and existing API untouched, and passed 7/7.

Test counts overlap: Assistant subsets are included in the full backend totals. Browser emulation does not prove physical Android keyboard behavior. The current rate limit is process-local; a multi-replica deployment needs shared enforcement or an edge policy.

## Limitations and remaining evidence

- There is no historical stockout event/duration source, so lost-sale revenue is not estimated.
- Active selling days, repeat-customer frequency, and anonymous walk-in identity are not inferred.
- Item/category/staff/customer changes may overlap invoice totals; they are correlated supporting views and cannot be summed as independent profit causes. Existing financial grouped reports are bounded to 50 groups and driver output to 10 records.
- Exact daily Galla is authoritative for a single date. Multi-day explanations do not reconstruct a historical per-day physical drawer.
- A distinct rising-profit outcome has no dedicated fixture; its registered intent executes in real-service registry coverage. Sales-up/profit-down now has its own costed PostgreSQL fixture.
- Performance evidence is a one-time local burst; production-size data, sustained traffic and multi-replica behavior remain unmeasured.
- This feature remains in-app and read-only. WhatsApp, speech, external models, automatic actions and deployment are out of scope and were not started.

The assistant-specific V1.5 implementation and its required business, security, parity, browser, build and regression checks pass. Partial data-source boundaries are disclosed above and in answers; they do not produce fabricated estimates.

# EVOLIX BUSINESS INSIGHT ENGINE VERIFIED

STOP for review. No later Assistant phase, WhatsApp, GPT/LLM, voice AI, autonomous actions, or deployment was started.
