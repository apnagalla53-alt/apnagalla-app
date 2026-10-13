# EVOLIX IN-APP ASSISTANT V1 VERIFIED

Verified locally on 8 October 2026. This report verifies the requested deterministic **in-app, read-only Assistant V1**. It is not deployment approval for the wider ERP or an assertion that unconfigured production providers/Android release gates have passed.

## Implementation and baseline

The existing Retail core was retained. New Assistant routes expose a code-controlled query layer over the shared Retail, Reports, Counter/Galla, Inventory projections, Khata and Entitlement facades. Normal supported questions make **zero external LLM calls and consume zero GPT tokens**. No WhatsApp, speech pipeline, business writes or autonomous workflow was added.

The repository was already extensively modified by earlier work; unrelated changes were preserved. Initial migration status and backend typecheck passed, and the existing import/report database baseline passed **23/23**. Final regression passed all **18 PostgreSQL E2E files / 291 tests** and **31 unit files / 1,030 tests**. No existing regression remains in these executed suites.

Problems corrected during verification included SQL-null exclusion of ordinary party collections, shared payment/credit definitions, staff return attribution, unsafe historical-current-stock assumptions, conservative Hindi/entity/unit handling, missing legacy checkout snapshot refusal, a Platform tab-switch render error, an obscured chat composer, and receipt costs inferred from unpopulated stock valuation. New-stock answers now show actual receipt quantities; posted purchase invoices supply purchase amounts. The existing report query uses that same receipt reader.

Browser fixture reruns also corrected privacy-redacted random moderation phrases, persistent learned test aliases and a test started before the rebuilt local API was ready. Final results below supersede those failed/interrupted development runs; failures were not relabeled as passes.

## Real business evidence

Fixtures provision fresh tenants and post real purchases, bills, collections, supplier payments, expenses, withdrawal, returns and opening cash through existing HTTP/posting services. The 50 registered tools each have an independent posted-fixture result expectation, not merely an HTTP-success assertion.

| Fact | Proven result |
|---|---|
| Original checkout sales | ₹470 across 6 bills: Cash ₹140, UPI ₹80, Card ₹30, Bank ₹20, Credit ₹200 |
| Posted return / net Sales Report | ₹20 / ₹450 |
| Original credit given | ₹200, 1 credit bill, 1 recorded customer; later collection does not rewrite original credit |
| Old customer collection / supplier payment | Cash ₹50 / Cash ₹15 |
| Business expense / owner withdrawal | Cash ₹10 / Cash ₹5 |
| Daily Galla | Gross checkout sales ₹470; cash received ₹190; opening ₹200; expected drawer ₹340 |
| Drawer calculation | ₹200 + ₹140 + ₹50 − ₹15 − ₹10 − ₹5 − ₹20 = ₹340; UPI/card/bank excluded |
| Customer / supplier Khata | Ramesh ₹150 due / Mohan ₹85 payable; second supplier ₹10 |
| Purchase receipts | 10 + 1 Maggi received; 2 sold, 1 returned; current stock 10 |
| Posted purchase amounts | ₹110 across 2 purchases; Raj Traders purchase ₹10 |
| Variants and units | Red 4 / Blue 7; configured 10 PACKET = 2 BOX; unconfigured conversion refused |
| Received batches | Upcoming 3 / expired 2; sellable stock excludes the expired lot |
| Need List | 7 pending / 1 urgent; Show more returns remaining 2 |
| Tenant B | Same-name Maggi 99 and sales ₹999; no leakage into Tenant A |
| Read-only integrity | Unsupported write/SQL requests post no vouchers; balances remain double-entry balanced and chat adds no stock movements |

Galla intentionally displays original gross checkout sales with returns/refunds separate, while the Sales Report displays net sales. Both Assistant paths match their corresponding authoritative screen definitions. Historical stock/balances are refused rather than silently returning current figures.

The headed fresh-owner browser flow checks the 15 required questions plus new-stock receipt quantities and the number of people receiving credit, with actual displayed results, empty/unknown states, numeric clarification, Show more, Platform approval and learned exact routing. A separate fresh cashier exercises real permission denial and an authorized empty stock answer. Desktop refresh/related report navigation and network-disconnect retry pass.

## ASSISTANT CORE

| Check | Result |
|---|---|
| Assistant Module | PASS |
| In-App Chat | PASS |
| Ask EVOLIX Home Entry | PASS |
| Text Normalization | PASS |
| Exact Routing | PASS |
| Pattern Routing | PASS |
| Fuzzy Routing | PASS |
| Confidence Scoring | PASS |
| Date Parsing | PASS |
| Entity Extraction | PASS |
| Entity Resolution | PASS |
| Entity Disambiguation | PASS |
| Conversation State | PASS |
| Follow-Up Context | PASS |
| Tool Registry | PASS |
| Response Templates | PASS |

## BUSINESS TOOLS

| Check | Result |
|---|---|
| Sales | PASS |
| Cash Sales | PASS |
| UPI Sales | PASS |
| Udhar Sales | PASS |
| Bill Count | PASS |
| Top Items | PASS |
| Daily Galla | PASS |
| Customer Balance | PASS |
| Customer Khata | PASS |
| Supplier Balance | PASS |
| Supplier Khata | PASS |
| Item Stock | PASS |
| Low Stock | PASS |
| Expiry | PASS |
| Purchases | PASS |
| Expenses | PASS |
| Owner Withdrawal | PASS |
| Need List | PASS |
| Staff Sales | PASS |
| Returns | PASS |
| Subscription | PASS |

## TRAINING / RECOGNITION

| Measure | Actual result |
|---|---|
| Meaningful intents | 50 |
| Initial curated example phrases | 511; 506 distinct normalized phrases before polite wrappers |
| Total reference cases / distinct routing aliases | 611 / 606 |
| Held-out test questions | 100; none are exact normalized reference aliases |
| Routing Correct | 100 |
| Routing Incorrect | 0 |
| Accuracy | 100% on this authored held-out regression set; ≥95% target achieved on this set |
| False Positives | 0 tool selections across 33 unsupported/write/SQL/irrelevant negative questions |
| Unknown | 0 supported held-out questions; all 33 unsupported negatives refused |
| Routing suite | 775 passed / 0 failed, including references, held-out, confusion, typo, date, entity and redaction checks |

These held-out cases were authored separately from the runtime aliases. Routing was refined during development using regression failures; this is not a blinded production-user evaluation and does not promise 100% accuracy on arbitrary Hindi/Hinglish. Confidence is a heuristic score, not a probability. Fuse selection requires ≥0.77 with a ≥0.10 different-intent margin; weaker/ambiguous matches do not silently execute. Pilot recognition metrics and response-success metrics are separately defined.

## PLATFORM SUPER ADMIN

| Check | Result |
|---|---|
| Assistant Dashboard | PASS |
| Intent Library | PASS |
| Training Examples | PASS |
| Unrecognized Questions | PASS |
| Map Unknown → Intent | PASS |
| Analytics | PASS |

## SECURITY

| Check | Result |
|---|---|
| Tenant Isolation | PASS |
| Permission Enforcement | PASS |
| No Arbitrary SQL | PASS |
| No External LLM Calls | PASS |
| No Cross-Tenant Cache | PASS |

Security evidence covers company/branch/financial-year tampering, arbitrary entity/tool/SQL payloads, tenant-vs-Platform tokens, owner/manager/cashier permission boundaries, feature denial before entity lookup, foreign user/tenant/login conversations, stale versions and expired context. Entities are always resolved/revalidated against the authenticated shop. Only semantic routing aliases are shared across tenants; financial answers are not cached.

Queries are redacted and capped before durable logs; financial answer payloads are not stored. Query logs have 30-day retention and context has 15-minute idle expiry. Platform analytics exposes operational usage, not tenant financial answers. Human mapping can only choose registered read intents, is audited, and does not automatically train or grant permissions.

## PERFORMANCE

Measured at **2026-10-08 07:31:51 UTC / 13:01:51 Asia/Kolkata**, against the rebuilt local Windows NestJS/PostgreSQL API, using a fresh disposable tenant after the other tests completed. Four real questions: Sales, Galla, Maggi stock, Ramesh balance. Each concurrency scenario is one burst.

| Concurrent / requests | Success / errors | Processing P50 / P95 / P99 ms | HTTP P50 / P95 / P99 ms | Throughput requests/s | Result |
|---|---|---|---|---|---|
| 10 / 10 | 10 / 0 | 73.95 / 85.74 / 85.74 | 136.02 / 151.38 / 151.38 | 59.12 | PASS |
| 25 / 25 | 25 / 0 | 96.40 / 110.19 / 114.18 | 182.90 / 200.08 / 200.22 | 123.90 | PASS |
| 50 / 50 | 50 / 0 | 192.31 / 208.85 / 211.76 | 335.49 / 342.82 / 342.96 | 144.58 | PASS |

**85/85 requests succeeded, zero errors, exit 0.** For the 50-concurrent scenario: P50 **192.31 ms**, P95 **208.85 ms**, P99 **211.76 ms** processing. The P50 <150 ms engineering target is missed at 50 concurrent; P95 <400 ms and P99 <1,000 ms targets are met. No latency guarantee is claimed.

HTTP includes authentication, local transport and durable session/log writes. Logged processing ends before the query-log write; it is not full HTTP latency. These small local bursts do not prove sustained capacity for 500 paying users or a large production database. Next review should use real pilot distributions/catalog sizes and sustained arrival rates before scaling. No Redis, GPU, vector DB or Kubernetes was added.

Machine results: [ASSISTANT_LOAD_2026-10-08.json](ASSISTANT_LOAD_2026-10-08.json). Runner: [verify-assistant-load.cjs](../../scripts/verify-assistant-load.cjs).

## BROWSER

| Check | Result |
|---|---|
| Assistant Opens | PASS |
| Known Question | PASS |
| Unknown Question | PASS |
| Ambiguous Question | PASS |
| Clarification | PASS |
| Permission Denied | PASS |
| Empty Result | PASS |
| Mobile | PASS |
| Dark Mode | PASS |

Six Chromium tests ran **headed**, one worker, no retries; **6 passed / 0 failed / exit 0**. Mobile sizes: 360×800, 390×844, 412×915. Desktop: 1366×900. Checked light/dark readability, no horizontal overflow, visible/focusable input, chips/clarification, refresh/deep link, related report navigation and aborted-network retry. Real hardware soft-keyboard behavior remains a pilot device check; desktop browser emulation is not a physical-device claim.

Local visual artifacts:
- [Light 360](../../output/playwright/headed-regression/assistant-assistant-light--8ca0e-d-safe-network-recovery-360-chromium/assistant-light-360.png)
- [Dark 390](../../output/playwright/headed-regression/assistant-assistant-light--c9a1f-d-safe-network-recovery-390-chromium/assistant-dark-390.png)
- [Platform phrase approval](../../output/playwright/headed-regression/assistant-fresh-owner-all--d2129-and-Platform-human-approval-chromium/assistant-platform-approval.png)
- [Desktop](../../output/playwright/headed-regression/assistant-desktop-assistan-95263-d-related-report-navigation-chromium/assistant-desktop.png)

Trace/video/login artifacts are local and ignored; do not publish them because they may contain credentials or tenant information.

## BUILD

| Check | Result |
|---|---|
| Prisma Validate | PASS |
| Prisma Generate | PASS |
| Migration Status | PASS |
| Clean Migration Deploy | PASS |
| Backend Typecheck | PASS |
| Backend Build | PASS |
| Frontend Typecheck | PASS |
| Frontend Build | PASS |

All eight build/migration checks exited **0**. All **27 migrations** deployed successfully to a clean disposable PostgreSQL database `evolix_assistant_clean_20261008_test`; status reports up to date. Browser and unit disposable databases also have the additive Assistant migration. Prisma 5.22.0 validates/generates successfully. No production reset or destructive db push was used. Backend and frontend TypeScript checks and production builds passed.

Migration `20261008120000_assistant_v1` adds four tables (catalog config, approved examples, scoped conversations and query logs) and scoped indexes/foreign keys. It does not replace or drop business tables.

## TESTING

| Check | Final result |
|---|---|
| Intent Routing Tests | 775 passed / 0 failed |
| Held-Out Routing Tests | 100 passed / 0 failed; included in routing suite |
| Business Tool E2E | 78 passed / 0 failed; 50 tools plus 28 data/security/context cases |
| Tenant Isolation | PASS |
| Permission Tests | PASS |
| Browser Assistant | PASS: 6 passed / 0 failed |
| Full backend unit regression | 1,030 passed / 0 failed; 31 files; exit 0 |
| Full PostgreSQL E2E regression | 291 passed / 0 failed; 18 files; exit 0 |
| Backend E2E coverage retained | Retail, Universal, Batch/FEFO, Serial/Warranty, Bundle/Modifier, inventory, accounting, purchase, expenses, attachments, security, import/reports and Platform suites |
| Concurrent real-query load | 85 succeeded / 0 failed; exit 0 |

Subset counts overlap the full suites and must not be added to them. The full E2E run started at 12:57:43 local and completed in 119.01 seconds; the final unit run started at 12:57:02 and completed in 43.60 seconds. Expected negative-test 503 logging does not indicate an E2E failure.

## Reproduce safely

Set ignored environment variables/secrets for dedicated disposable databases and API fixtures. Some legacy suites clear entire tables; never point automated tests at production, live Retail, or the ordinary application database. The E2E configuration enforces a local database whose name includes `_test`.

Backend, in `backend-typescript`:
```powershell
npx prisma migrate deploy
npx prisma migrate status
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run build
npx vitest run src/assistant
npx vitest run
npx vitest run --config vitest.config.e2e.ts test/assistant.e2e-spec.ts
npx vitest run --config vitest.config.e2e.ts
```

Frontend, in `frontend`, with ready disposable API on 8010 and Vite on 5173, and fixture login credentials in environment:
```powershell
npx tsc --noEmit
npm run build
npx playwright test --config playwright.headed.config.ts --headed tests/assistant.spec.ts
```

Load runner: supply `ASSISTANT_LOAD_TOKEN`, `ASSISTANT_LOAD_COMPANY`, `ASSISTANT_LOAD_BRANCH`, `ASSISTANT_LOAD_FY` and optional `ASSISTANT_LOAD_REPORT` in environment, then `node scripts/verify-assistant-load.cjs`. Use a disposable tenant containing the four fixture query records; never put access tokens in arguments/logs.

## Review limits and stop

- Real pilot phrases remain the next evidence source. Recognition percentage is not answer correctness.
- At 50 concurrent requests the processing P50 target is missed; measure sustained traffic and DB round trips before broad rollout.
- Current single-API rate limits are process-local. Multiple replicas require an edge/shared enforcement policy.
- The bounded scope is 400-character questions, 366-day historical queries, five chat rows, 50-row admin pages, 5,000 catalog aliases, 100 item variants and explicit 10,000-record summary limits. Oversized summaries fail clearly; no partial financial totals are presented.
- Existing top-item grouped/detail report behavior needs representative large-data measurement; this verification uses realistic posted flows, not a production-scale catalog.
- Current-state stock/balances/needs/settings cannot reconstruct history; missing original checkout allocations require reconciliation.
- Hindi name matching is conservative and finite; unknown names are not invented. Some shared metric labels remain English while response templates support Hindi/Hinglish/English.
- Wider deployment/provider/backup/Google/Android gates in the release checklist remain separate. Nothing was deployed.

Architecture and extension instructions: [ASSISTANT_ARCHITECTURE.md](../ASSISTANT_ARCHITECTURE.md). Security, deployment and release checklist documents were updated. **STOP for review. No next-phase WhatsApp, LLM, voice, write or autonomous implementation is authorized by this verification.**

