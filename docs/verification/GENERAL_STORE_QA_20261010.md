# General Store and Developer QA verification — 10 October 2026

This is a targeted verification of the owner's two QA reports. It is not a full-product production certification. No deployment was performed.

## Reports and environment

- General Store report: attachment `3cd72dd0-5a25-4bf6-8b4f-15c19d5a806c/Pasted text.txt`.
- Developer report: attachment `d23833f6-7fb6-437b-bf5f-a9112e99c388/Pasted text.txt`; the earlier `1ce577a2-023d-477c-b949-5476fe890ed3` upload contains the same report.
- User authorization: create fresh shops and reproduce the reported scenarios; preserve existing records.
- Local preview: frontend `http://localhost:5173`, API port 8012. The rebuilt API and frontend both returned HTTP 200; database readiness returned `ready`.
- Browser verification: visible Chrome, one worker, isolated ports 5177/8024, fresh disposable PostgreSQL database and isolated attachment directory.
- API verification: fresh disposable PostgreSQL database, actual Retail HTTP routes, inventory/accounting posting and journal assertions.

The repository already contained extensive modified and untracked work. Existing changes were preserved. The separate school project on port 5175 was not changed. No real payment, external message or provider transaction was sent.

## Findings, fixes and evidence

| Priority / finding | Result | Verification |
| --- | --- | --- |
| P1: dedicated Returns Report previously failed while Sales included returns | Posted return reads now share a tenant-scoped history query with actual refund vouchers. Errors expose a safe request ID and a retry action. | Fresh ₹370 scenario loads real rows and matching CSV; date/tenant/branch checks pass. A deliberately injected server failure gives a safe reference and recovers. The historical 500 did not reproduce on the inspected local data; its original root cause remains unconfirmed. |
| P1: successful ₹90 return left an enabled stale form and JavaScript alert | Success leaves the form, displays an in-app confirmation from the server response and links to the updated bill. Input and submission are locked during posting; fully returned items cannot be submitted again. | ₹100 item minus ₹10 discount, ₹100 cash tender and ₹10 change, followed by ₹90 refund. Two rapid browser clicks send one POST. Three concurrent requests with one idempotency key create one return/refund; a new over-return request fails. |
| P1: backup claimed automatic protection despite no provider | Removed unconditional protection claims. Provider configuration is distinguished from successful backup and restore verification. Last successful backup, restore test, schedule and retention are honestly `Not reported` until supplied by the operator. | Unconfigured screen says cloud backup is not active. A configured-provider fixture also does not claim verified protection. **A real production backup and restore drill were not performed.** |
| P2: original bill hid returns and refunds | Bill Details preserves the original posted invoice and adds return status, returned/remaining quantity, linked return history, actual refund method/date and adjusted settlement. | ₹30,350 original bill, ₹360 refund, ₹29,990 net/retained settlement, 1 returned rice bag and 29 remaining. Credit returns show Khata adjustment without a fabricated cash refund. Reflow checked at 360/390/412/1366px. |
| P2: manual UPI recording confused with initiating/confirming payment | Incoming UPI flows explicitly require the cashier to confirm receipt in their own UPI/bank app. Unconfigured receiving profiles offer setup guidance and no QR. Changing split UPI amount clears confirmation. | Itemized, amount-only, split and customer receipt flows checked. Supplier payment uses no shop incoming QR. Backend still records legitimate manually received UPI separately from physical cash. No bank confirmation is claimed. |
| P2: saved payments/sales showed false photo retry | Supplier/customer payments and itemized checkout use the existing optional-photo state machine. Retry controls appear only after a selected upload fails; retry reuses the saved transaction. | No-photo saves never flash retry controls. Injected attachment failure followed by success creates one transaction. Existing item, expense, purchase and quick-sale checks also pass. |
| P2: rapid report navigation caused 429 | Identical in-flight reads are shared and common responses reused for 10 seconds. Cache keys include session/shop/query; successful writes and context changes invalidate them. One read retry is allowed only for server backoff of at most two seconds. Other successful report content survives a partial failure. | 80 simultaneous identical reads produce one request; a real financial write forces a new read. Rapid report navigation reuses its summary without 429. Injected short/long 429 and partial report failure recover correctly. Existing server limits remain enforced, spare another tenant/POS and expose actual `Retry-After`. |
| P2: purchase CSV had unclear or missing delivery | Purchase export prepares all pages before requesting a download. UI shows filename/record count, honest browser-request wording and a retained Download again link. Failed pages produce no partial file. Account exports lock selection while preparing a file. | Real browser download event, filename and ₹80,354 contents verified; second link works. Pagination, header-only empty export and second-page failure tested. Account item CSV download also verified. |
| P3: 100% cost coverage looked like all costs were known | Headline now says **Product cost coverage**. Unknown service revenue is returned separately and the incomplete-profit warning remains. | 100% product coverage plus ₹120 service revenue with unknown direct cost is visible; known-cost net profit remains ₹15,720. No costs or profit were invented. |
| P3: supplier overview briefly displayed zero | Pending balances show a loading state rather than final-looking zero. Errors show unavailable state. | Delayed real response stays in loading state, then displays ₹29,954 due and two suppliers. |
| P3: expense category setup had no starter path | Earlier targeted fixes are retained: ten default categories for new shops and safe initialization/custom creation for empty existing shops. | Default/category tests and headed empty-picker flow pass again. |

## Recreated shop and reconciliation

The shared fixture recreates the older `QA DEMO` transactions and the General Store `QA 1L` case in a new test company. It creates eight new grocery products, customer and supplier, the ₹79,178 eleven-line credit purchase, ₹30,000 cash and ₹20,000 UPI supplier payments, four new sales, ₹5,000 customer collection, ₹360 rice return, ₹4,000 rent and ₹2,000 owner withdrawal. Batch/expiry receiving and restoration use the authoritative inventory posting system.

| Measure | General Store stage | After Developer ₹90 sale and ₹90 return |
| --- | ---: | ---: |
| Bills | 8 | 9 |
| Gross sales | ₹1,00,000 | ₹1,00,090 |
| Return invoice value | ₹370, 2 returns | ₹460, 3 returns |
| Net sales | ₹99,630 | ₹99,630 |
| Purchases | ₹80,354 | ₹80,354 |
| Supplier due | ₹29,954 | ₹29,954 |
| New customer due | ₹11,200 | ₹11,200 |
| Expected drawer / actual count / difference | ₹21,880 / ₹21,880 / ₹0 | ₹21,880 / ₹21,880 / ₹0 |
| Known-cost COGS | ₹79,690 | ₹79,690 |
| Known-cost gross profit | ₹19,820 | ₹19,820 |
| Business expenses | ₹4,100 | ₹4,100 |
| Known-cost net business profit | ₹15,720 | ₹15,720 |
| Service revenue with unknown direct cost | ₹120 | ₹120 |

At the General Store stage, cash received is ₹58,300, cash paid out ₹36,920, opening cash ₹500, UPI sales ₹30,500, original Udhar sales ₹16,315, old due cash collections ₹5,115 and owner withdrawals ₹2,050. UPI does not inflate the physical drawer.

Stock has 11 items, nine out of stock and ten low stock, with one returned rice bag and 17 biscuits remaining. Rice restoration uses the original batch. The separate Developer screw item returns to three units at ₹60 cost, stock value ₹180. All posted journals checked by the API suite are balanced. Shared accounting/inventory posting logic was not changed for these fixes.

## Automated evidence

| Check | Result |
| --- | --- |
| PostgreSQL API E2E | 73 passed, 0 failed, exit 0 |
| Headed Chrome targeted suites | 36 passed, 0 failed, exit 0 |
| Backend `npx tsc --noEmit` and `npm run build` | Both exit 0 |
| Frontend `npx tsc --noEmit` and `npm run build` | Both exit 0 |
| Prisma validation | Exit 0 |
| Migration chain on fresh disposable DBs | All 34 migrations deploy successfully; no new migration required |

API suites: `general-store-qa.e2e-spec.ts` (13), `shopkeeper-qa.e2e-spec.ts` (11), `platform-access-approval.e2e-spec.ts` (8), `costing-profit.e2e-spec.ts` (39) and `expenses.e2e-spec.ts` (2). Browser suites: `general-store-qa.spec.ts` (22) and `shopkeeper-qa.spec.ts` (14). Counts refer to final focused runs, without counting repeated runs twice.

The pre-change focused backend baseline passed all 60 existing tests. Those same suites remain passing alongside the 13 new scenario tests; no baseline regression was found within this coverage.

The rate-limit guard was exercised in the compiled backend. The browser used Vite and the test environment, not an externally deployed production stack. Production proxy limits, replicas and real customer traffic remain deployment acceptance. Several deliberately intercepted 500/503/429 requests test recovery; session revocation at fixture teardown can also log 401 on destination-page reads. They are not unexplained failures of the asserted foreground flows.

Earlier browser runs had fixture assertion failures: a request counter included a differently filtered Home request, and a dropdown check used a label locator rather than its observed combobox role. Both assertions were corrected to identify the intended controls/requests. Final assertions still require one request for 80 identical reads, a second request after a financial write and locked export selection during preparation. Initial fixture corrections used the schema's `itemBatch`, the supported per-litre item mode and the controller's foreign-bill 404 response.

Generated local evidence:

- `scratchpad/general-store-qa-api.log`
- `scratchpad/shopkeeper-browser.log`
- `scratchpad/general-store-frontend-build.log`
- `output/playwright/shopkeeper-qa/` — screenshots, CSVs, video/trace where configured
- `backend-typescript/test/fixtures/general-store-scenario.cjs` — reusable scenario

Screenshots include `returns-370.png`, `bill-return-settlement.png`, `discounted-full-return.png`, `manual-upi-confirmation.png`, `backup-not-configured.png`, `supplier-loading.png` and `product-service-cost-coverage.png` inside the corresponding browser test artifact folders. Generated private fixture credentials are ignored and are not release credentials.

## Existing data and cleanup boundary

A read-only inspection located the original reported invoice in the preserved local preview database. Its current return queries succeeded, and the additional Developer ₹90 return explains the current ₹460 total. Existing QA data was not reset to the earlier ₹370 stage or deleted. Each verification runner removes only its own validated disposable database and isolated upload directory.

The final changes pass scoped whitespace checking. Three pre-existing whitespace warnings elsewhere in the dirty working tree were left outside this targeted change.

## Configuration and acceptance still required

- **Production backup: NOT CONFIGURED. Restore drill: NOT RUN.** The UI fix does not create a backup provider, successful archive, verified retention or selective tenant restore. Follow [DISASTER_RECOVERY.md](../DISASTER_RECOVERY.md) and [PRODUCTION_DEPLOYMENT.md](../PRODUCTION_DEPLOYMENT.md) with the chosen provider and an isolated restore target.
- **UPI receiving profile:** the reported shop has none. Configure the real shop UPI ID/payee before relying on receiving QR. Payment recording remains manually confirmed; no gateway/bank callback was added.
- **GST:** the reported shop lacks its real registration/address/signatory and provider configuration where required. GST compliance, sequencing, electronic reporting and live invoice acceptance were not certified by these tests.
- **Email/OTP recovery and voice:** operator providers remain unconfigured. No secrets or fake success responses were added.
- Every report/filter permutation, import commit/reversal, staff permissions, physical printer/scanner/Bluetooth, WhatsApp delivery, full offline operation and multi-device conflict handling were not part of this focused run.
- General Store suggestions for broader new features were not automatically implemented as bug fixes.

Both reports' targeted UI, report, download and transaction-state fixes have focused passing evidence. Review these changes before any release; provider configuration and broader production acceptance remain outstanding.
