EVOLIX Retail localhost stabilization — 6 October 2026

EVOLIX RETAIL LOCALHOST USER FLOW VERIFIED

The latest user request replaced Slice E with stabilization of the existing Retail application. Slice E, Slice F and Phase 6 were not started. The existing POS, Accounting, Pricing, Inventory and Purchase engines were preserved. Backend changes address routing, tenant context, migration drift and defects in the existing Retail facade/report integration.

The workspace was already substantially dirty when work began, including the Universal Items and Batch/FEFO changes, schema changes and E2E tests. Those changes were retained. No commit, reset, merge or deployment was performed.

The application remains running for review:

| Setting | Verified value |
| --- | --- |
| Backend | http://localhost:8000/api/v1 |
| Health | GET /api/v1/health → 200, status ok |
| Frontend | http://localhost:5173 |
| Database | PostgreSQL, 127.0.0.1:5432, evolix_trade_dev |
| Backend script | npm run start:dev |
| Frontend script | npm run dev |
| NODE_ENV | Unset; local development/watch scripts are running |
| Backend regression database | evolix_stabilization_test_20261006 on the same local PostgreSQL server |

The following results cover actual localhost browser interactions, the Playwright Chromium lifecycle, route/viewport checks and read-only database verification. PASS applies to the basic Retail flows requested in this sprint.

| Acceptance check | Result | Evidence |
| --- | --- | --- |
| BACKEND STARTS | PASS | Actual development script and successful health response |
| FRONTEND STARTS | PASS | Actual Vite script, browser loads localhost:5173 |
| LOGIN | PASS | Tenant login persists token and organization/company/branch/year context |
| HOME | PASS | Real server summary, shop name, navigation and all six shortcuts |
| ITEM LIST | PASS | Actual persisted items and stock |
| ADD ITEM | PASS | Name/price alone works; separate ₹100 item with opening stock 10 works |
| ITEM DETAIL | PASS | Name, ₹100 price and current PCS stock; basic item has no broken advanced sections |
| NEW BILL PAGE | PASS | Search, customer selector, cart, total and payment action render |
| ITEM SEARCH IN BILL | PASS | Real matching items; no-match search shows message and Add Item action |
| ADD ITEM TO CART | PASS | Quantity 1, rate ₹100, total ₹100 |
| CASH SALE | PASS | Real invoice; ₹200 received shows ₹100 change |
| UPI SALE | PASS | Real invoice and debit to the configured bank ledger |
| UDHAR SALE | PASS | Missing customer opens a clear selection sheet; selected customer sale succeeds |
| SPLIT SALE | PASS | ₹40 Cash + ₹60 UPI, both amounts persist in accounting |
| SALE COMPLETE | PASS | Server invoice id/number, amount and payment mode; failed sale cannot fabricate success |
| BILL HISTORY | PASS | New invoice appears and opens |
| BILL DETAIL | PASS | Item, quantity, rate, amount, paid/due and actual receipt payment lines |
| RETURN | PASS | Basic 1-unit cash return and refund; stock restored |
| KHATA | PASS | New customer and ₹100 Udhar due appear |
| RECEIVE CUSTOMER PAYMENT | PASS | ₹100 receipt settles that customer's bill to zero |
| PURCHASE | PASS | Credit purchase of 5 units at ₹60, persisted lines, ₹300 accounting allocation and stock increase |
| SUPPLIER | PASS | Supplier created, shown and selectable in purchase |
| NEED LIST | PASS | Test Missing Item quantity 2 is persisted and visible |
| EXPENSE | PASS | Tea ₹50 Cash is persisted and shown |
| REPORTS | PASS | Sales, Purchases, Expenses, Stock, Customer Due, Supplier Due and Returns render |
| MORE PAGE | PASS | Every menu link checked; unfinished Cash & Bank, Settings and Backup show Coming Soon |
| BOTTOM NAVIGATION | PASS | Home, Bill, Items, Khata and More remain usable at mobile and desktop widths |
| NO BLANK RETAIL ROUTES | PASS | Active routes render content/loading/empty/setup/error; empty payment/success state redirects safely |
| LOADING STATES | PASS | Async lists/details/reports and form option lookups have loading states; slow Items request exercised |
| EMPTY STATES | PASS | Empty Items response and no-match bill search exercised; lists provide useful empty content/actions |
| ERROR STATES | PASS | API 500/retry, missing setup and render-error boundary exercised; failed sale preserves its cart |
| MOBILE 360px | PASS | 360×800, no horizontal overflow, Cash payment action above bottom nav |
| MOBILE 390px | PASS | 390×844, full transaction lifecycle and payment/navigation visibility |
| MOBILE 412px | PASS | 412×915, no horizontal overflow, Cash payment action above bottom nav |
| DESKTOP 1280px | PASS | 1280×900, active navigation and usable bill/payment |
| BACKEND BUILD | PASS | npm run build, exit 0 |
| FRONTEND BUILD | PASS | npm run build, exit 0 |
| CURRENT E2E REGRESSION | PASS | 7 backend files / 73 tests; 7 Retail Playwright tests |
| PRISMA VALIDATION | PASS | Schema valid |
| MIGRATIONS | PASS | 16 migrations; local database schema up to date |

Browser/runtime errors and their disposition:

| Finding during diagnosis | Root cause and resolution |
| --- | --- |
| Empty/fake-zero screens and incorrect API responses | Retail used its own unauthenticated relative Axios client, sometimes hitting Vite HTML. All active Retail calls use the shared authenticated client and the correct localhost backend. Direct facade responses are adapted centrally to the existing UI envelope. |
| Retail endpoint 404s | The global api/v1 prefix was added to controllers already declaring api/v1. Those controllers are excluded from the extra global prefix. |
| Missing tenant context/setup | Login did not supply company/branch/year context, and the local default admin had no membership/default setup. Login now returns the existing membership context. A guarded localhost setup script restores the existing default shop configuration; missing context renders Complete Shop Setup. |
| False Add Item and sale success | Add Item simulated saving; Payment caught errors and generated a fake invoice. Both now wait for confirmed server writes, display failures, and retain unsaved form/cart state. |
| Success route bounced back to New Bill | Clearing the cart in Payment triggered its empty-cart redirect during success navigation. The confirmed success screen clears the cart after mounting. |
| Bill Detail API failure | Prisma queries referenced nonexistent sales_invoice_line and nested voucher relations. Detail now reads the real lines relation and scoped POS_RECEIPT vouchers. |
| Customer/Supplier Due report API failures | Queries selected nonexistent Party.phone. They now use existing schema fields and return a nullable display phone. |
| Held Bills request failure | The :id controller route shadowed the static hold route, and the UI assumed an envelope. Routing/order and response adaptation are corrected. Resume also refuses to overwrite a live cart and loads items before consuming the held bill. |
| Cash Return failed after the return posted | Refund reused the SALES_RETURN accounting source, colliding with the return voucher. The existing cash refund uses a distinct POS_REFUND source and the UI prevents concurrent submission. |
| Purchase did not perform the requested stock workflow | The UI exposed only quick total entry, while existing facade lines mutated projections and were not persisted. The existing itemized capability is exposed; facade lines persist and delegate movements to InventoryPostingService. |
| UPI/split integration mismatch | UPI is mapped to the existing BANK tender in the facade; split sends the actual ₹40/₹60 values. Udhar sends no immediate receipts. |
| Unstyled forms, obscured actions and missing desktop nav | Phase 2 classes lacked styles, sticky actions overlapped the bottom nav, and desktop CSS hid the only navigation. Scoped styling and footer/nav spacing now support all checked widths. |
| Home displayed a negative Customer Due | Aggregating credits across customers reduced the due figure. Home now uses the existing customer/supplier due report totals. |
| Fresh migration/test failure | Existing Slice D ItemBatch.company_id was in the schema but absent from its migration chain. A backfill migration restores that existing field, index and FK. It adds no new feature. |

Final runtime audit: the successful real lifecycle asserts zero uncaught page errors and zero unexpected failed HTTP requests. The final manual cash sale produced no error/warning entries during that interaction. No remaining broken active Retail routes, CORS failures, JSON parsing errors or null/undefined rendering errors were observed in the successful flow.

One expected 401 remains during tenant sign-in because the existing Login screen probes platform login before tenant login. It is not a failed tenant login. Negative tests deliberately inject a 500 and malformed response to prove recovery; their errors are intentional. Earlier diagnostic errors remain in the old browser/server logs and are distinguished from the final successful run.

Migration evidence: the initial local database had existing tables but no Prisma migration history. The full chain was deployed to a separate test database; the missing batch tenant column caused 17 failures in the first 37 Universal/Batch tests. After the corrective migration, all current backend suites pass. The local database-to-schema diff was empty before recording its existing migration history. No local data reset was used. The E2E config now refuses the application database because legacy suites clear entire tables.

The final read-only database check asserts four ₹100 posted sales, Cash receipts ₹140, Bank receipts ₹160, the ₹40/₹60 split, zero remaining Udhar due, one ₹100 return and cash refund, purchase quantity 5/rate 60/total 300 with a real accounting allocation, stock projection and movement sum both 12, Tea ₹50 Cash, Need quantity 2, and balanced related vouchers. Exact invoice numbers and counts are saved in database-evidence.json.

Files changed or added by this stabilization sprint are listed below. Other modified files shown by git status belong to the pre-existing work and are not attributed to this sprint.

| Area | Files (relative to D:/evolix-trade-erp) |
| --- | --- |
| Runtime/auth | backend-typescript/src/main.ts; backend-typescript/src/auth/auth.service.ts; frontend/src/pages/Login.tsx; frontend/src/shared/api.ts; frontend/src/shared/store/authStore.ts |
| Retail facade | backend-typescript/src/retail/billing/billing.controller.ts; backend-typescript/src/retail/billing/billing.service.ts; backend-typescript/src/retail/retail.service.ts; backend-typescript/src/retail/reports/reports.service.ts |
| Migration/local setup | backend-typescript/prisma/migrations/20261006150000_restore_batch_tenant_column/migration.sql; backend-typescript/scripts/setup-local-retail.cjs; backend-typescript/scripts/verify-local-retail.cjs |
| App/routes/state | frontend/src/App.tsx; frontend/src/retail/RetailShell.tsx; frontend/src/retail/RetailErrorBoundary.tsx; frontend/src/retail/retailApi.ts; frontend/src/retail/retailStore.ts; frontend/src/retail/retail.css |
| Retail screens | frontend/src/retail/RetailHome.tsx; RetailItems.tsx; RetailAddItem.tsx; RetailItemDetail.tsx; RetailAddCustomer.tsx; RetailKhata.tsx; RetailReceivePayment.tsx; RetailMore.tsx; RetailAddPurchase.tsx; RetailPaySupplier.tsx; RetailNeeds.tsx; RetailAddExpense.tsx (all under frontend/src/retail) |
| Billing screens | RetailNewBill.tsx; RetailPayment.tsx; RetailSaleComplete.tsx; RetailBillHistory.tsx; RetailBillDetail.tsx; RetailReturn.tsx; RetailHeldBills.tsx; RetailThermalReceipt.tsx (all under frontend/src/retail/billing) |
| Verification/config | frontend/tests/retail-smoke.spec.ts; frontend/package.json; backend-typescript/vitest.config.e2e.ts; .gitignore; docs/verification/2026-10-06-retail/* |

Saved evidence in this directory:

- backend-build.txt and frontend-build.txt: actual build output.
- backend-e2e.txt: final 7 files / 73 tests, exit 0, including Universal Items and Batch/FEFO.
- browser-e2e.txt: final 7 Playwright tests, exit 0, with full lifecycle, Home/More links, viewport payment checks, failure recovery and held-cart protection.
- prisma-validate.txt and migration-status.txt: valid schema and current local migrations.
- database-evidence.json: read-only accounting/stock/persistence assertions.
- cash-sale-complete.png: confirmed real cash invoice.
- mobile-360.png, mobile-390.png, mobile-412.png, desktop-1280.png: bill search/empty state and navigation.
- payment-360.png, payment-390.png, payment-412.png, payment-1280.png: cash received/change and visible payment action above navigation.

Reproduction: run the existing backend/frontend development scripts, then `npm run test:retail` from frontend. Run `node scripts/verify-local-retail.cjs` from backend-typescript after the lifecycle. Backend regressions require DATABASE_URL explicitly set to the dedicated localhost test database, then `npm run test:e2e`; the current E2E suites must not run against evolix_trade_dev. The setup repair, if needed on this same development database, is `node scripts/setup-local-retail.cjs` and does not replace the existing password.

Verification limits: basic Retail flows are checked, including a real localhost purchase and refund; advanced serial/batch returns and warranty remain outside this sprint. The print template was opened manually; physical printing and sending a native share to an external recipient were not exercised. Existing attachment/photo workflows and paid/partial purchase variants were not part of the requested basic smoke scenario. Vite reports a non-failing bundle-size warning (~601 kB); Vitest reports existing config/module and tsconfig-paths notices. Test products, customers, suppliers, expenses, needs and one held recovery bill remain in the local development database for review.

Stop point: frontend stabilization completed. Review this report and the running localhost application before resuming any new feature work.
