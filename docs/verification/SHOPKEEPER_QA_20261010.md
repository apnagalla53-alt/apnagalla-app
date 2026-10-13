# Shopkeeper QA findings and pending-plan access — 10 October 2026

Scope: the supplied targeted shopkeeper QA request and the reported inability to approve a new Smart-plan shop. Working accounting/posting services were not changed. This is a focused verification report, not a whole-product production-readiness declaration.

## Fresh account reproduction

Fresh owner accounts and shops were created in newly migrated disposable PostgreSQL databases. The API test goes through signup, business setup, Smart selection and activation request. Google identity verification is replaced only within that test module; production verification is unchanged. The headed browser uses an explicitly test-only Google identity and a real stored session, then exercises actual onboarding and approval endpoints.

Reproduced cause: activating an organization did not activate its PENDING subscription. Platform controls also required an audit reason but gave no explanation for disabled buttons.

The fix adds **Organizations → Access requests → Pending access requests → Review / grant access**. The detail screen displays Pending access and a Grant access card with the requested plan, duration and access type. Entering a meaningful audit reason enables the button. Approval atomically updates organization/subscription access and advances the owner's setup. The owner can select Check activation status and continue with the existing session.

Temporary/complimentary access creates no payment or revenue. Paid access requires an actual recorded, paid, unrefunded receipt belonging to that shop and selected plan. Invalid durations, tenant credentials, archived shops and duplicate/concurrent approvals are rejected. An audit records the reason and receipt identifier where applicable.

Online payment confirmation remains **NOT CONFIGURED**. No plan is activated merely because the browser selects a plan or claims payment. Manual approval steps and the future verified webhook boundary are documented in [PLATFORM_ACCESS_APPROVAL.md](../PLATFORM_ACCESS_APPROVAL.md).

## Returns Report

Root cause: the UI read `summary.total_returns_value`, while the backend returned `summary.total_returns`. The fallback therefore rendered zero although the listed return was correct.

The backend sums authoritative Prisma Decimal `grand_total` values from the exact posted-return row set, scoped to company, branch and selected dates. UI and export use that same service. Stable ordering includes invoice date and ID. The label is **Total Return Value**, because this aggregates posted return invoice value, including cash refunds and credit adjustments; it is not solely cash refunded.

| Check | Result |
| --- | --- |
| Before | Total Refunded Value ₹0 |
| After, reproduced cash-return case | Total Return Value ₹10 |
| Listed return value | ₹10 |
| Summary reconciles | YES |
| CSV reconciles | YES |
| Partial/multiple cash returns | ₹10 + ₹20 = ₹30 |
| Subsequent Udhar credit return | Total return value ₹50; cash refunds remain ₹30 |
| Empty date range | ₹0 and no rows |
| Foreign company/branch report or export | Rejected |

The Returns CSV button now follows `nextOffset` until all pages succeed, rather than silently exporting only the first 1,000 rows. It saves no file if a later page fails and displays a retryable error. The pagination browser fixture checks 1,002 records, a total of ₹1,007 and a second-page failure. That fixture tests pagination/failure handling; the separate ₹10 browser download and partial/multiple API exports use real database records.

## Photo upload

The shared optional upload state explicitly distinguishes NOT_SELECTED, SELECTED, UPLOADING, UPLOADED and FAILED. Item, expense, purchase and amount-only sale creation retain the saved entity ID, so an upload retry does not recreate the transaction.

| Check | Result |
| --- | --- |
| No selected photo: retry controls visible | NO |
| No selected photo: upload request made | NO |
| Selected photo, failed upload: retry available | YES |
| Retry after simulated failure | Real upload succeeds; one entity created |
| Continue without photo after failed sale upload | Saved bill remains accessible |

The browser deliberately returns HTTP 503 for selected-photo failure cases, then removes that interception for the real upload retry. Empty image URLs do not trigger failure controls. Preview actions also keep readable button widths on narrow screens.

## Expense categories

Fresh shops receive these ten defaults once: Rent, Electricity, Transport, Wages / Salary, Packaging, Repairs & Maintenance, Shop Supplies, Internet / Mobile, Delivery / Freight, Other.

Existing shops with any categories are preserved, including renamed, custom and inactive records. An existing zero-category shop can select **Use default categories**. Initialization shares a company transaction lock with category creation, so concurrent requests do not create duplicates. Each category references a tenant-owned expense ledger; initialization posts no accounting transaction.

| Check | Result |
| --- | --- |
| Duplicate protection | PASS |
| Existing categories preserved | PASS |
| Fresh-shop first use | PASS |
| Required category enforced by backend | PASS |
| Cross-tenant initialization/category use | Rejected |

The form displays **Category \***, **No expense categories yet.**, a visible **Add Category** action and the safe defaults action.

## Sales cash label

Old: **Cash**. New: **Cash Received from Sales**.

Helper: “This is cash received from sales before refunds, expenses, supplier payments and owner withdrawals.” **View Daily Galla** opens the drawer reconciliation screen.

Daily Galla accounting changed: **NO**.

## Amount-only sale

**Amount-only Sale** explains that item stock will not update and exact profit cannot be calculated. The warning has English and Hindi text.

Inventory warning: **PASS**. Unknown profit warning: **PASS**. Unknown cost remains unknown: **PASS**. The ₹120 amount-only sale has null COGS/profit and no stock movement; no estimated or zero cost is assigned.

## Unchanged accounting results

| Value | Expected and observed |
| --- | --- |
| Purchase | ₹926 |
| Gross sales | ₹445 |
| Returns | ₹10 |
| Net sales | ₹435 |
| Cash received from sales | ₹445 |
| Supplier cash payment | ₹400 |
| Business expense | ₹100 |
| Owner cash withdrawal | ₹50 |
| Cash refund | ₹10 |
| Total cash paid out | ₹560 |
| Opening cash | ₹500 |
| Expected drawer cash | ₹385 |
| Saved actual count | ₹175 |
| Difference | −₹210, expected shortage |
| Known COGS | ₹262 |
| Known gross profit | ₹53 |
| Known-cost net business profit | −₹47 |

All posted journals in the reproduction remain balanced. Existing costing/profit and expense suites also pass. No shared accounting/inventory posting implementation was changed for these fixes.

## Builds and automated evidence

| Check | Final result |
| --- | --- |
| Backend `npx tsc --noEmit` | PASS, exit 0 |
| Backend `npm run build` | PASS, exit 0 |
| Frontend `npx tsc --noEmit` | PASS, exit 0 |
| Frontend `npm run build` | PASS, exit 0 |
| `npx prisma validate` | PASS, exit 0 |
| Fresh disposable DB `prisma migrate deploy` | All 34 migrations applied |
| Backend PostgreSQL E2E | 60 passed, 0 failed, exit 0 |
| Headed Chrome focused suite | 14 passed, 0 failed, exit 0 |

Backend suites: `shopkeeper-qa.e2e-spec.ts` (11), `platform-access-approval.e2e-spec.ts` (8), `costing-profit.e2e-spec.ts` (39), `expenses.e2e-spec.ts` (2). A later access-reason-specific run also passed all 8 approval tests; those are not counted again as new tests.

The browser suite covers four no-photo saves, four selected-photo upload/retry cases, skipping a failed photo, real return UI/CSV, multi-page export/failure, empty-category initialization, English/Hindi copy and 360/390/412/1366px reflow, and pending Smart access approval followed by owner entry to Retail.

Earlier browser runs found a duplicate test click on Start fresh and an artificial report burst that reached the existing rate limit. The tests were corrected to use one onboarding handler and load each screen once before resizing. Production rate limits were not lowered. Earlier backend failures were incorrect test expectations for customer lookup and foreign branch rejection; the tests now use the actual list route and expect the required HTTP 403.

Private/generated evidence: `scratchpad/shopkeeper-qa-api.log`, `scratchpad/access-approval-api.log`, `scratchpad/shopkeeper-browser.log`, `scratchpad/shopkeeper-frontend-build.log`, and `output/playwright/shopkeeper-qa/` (screenshots, downloaded CSVs, videos and traces). The earlier pagination-run failure log is preserved as `output/playwright/shopkeeper-pagination-before-rerun.log`.

## QA data and runtime

The supplied cleanup email and “chatgpt test” shop were not found in the available local EVOLIX databases. No existing shop was guessed at or deleted. The user then authorized creating fresh QA accounts and reproducing the problems instead. Each verification runner drops only its own explicitly named disposable database. The final browser run also isolates and removes its own upload directory. Real business tenants are preserved.

Local review app: **http://localhost:5173**. The verified EVOLIX preview API on port 8012 was restarted with the built fixes. The separate school project on port 5175 was not changed.

## Limits and review boundary

Live Google consent/sign-in with a real new account remains owner/provider acceptance; test-only identities do not prove Google's production integration. Automatic gateway activation is not implemented. Real UPI confirmation, GST filing, physical printers, staff permission coverage, backup/restore, imports, offline and notifications were outside this targeted verification. No deployment or new phase was started.

## SHOPKEEPER QA FINDINGS FIXED

All targeted issues pass their focused checks and the specified accounting totals reconcile. Stop for owner review; this declaration does not certify unrelated production features.
