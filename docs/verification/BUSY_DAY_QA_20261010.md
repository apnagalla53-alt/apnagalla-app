# Busy-day billing and record actions — 10 October 2026

Targeted fixes for the owner's Busy-Day Billing Speed Report and edit/delete request. This report does not certify production throughput or a physical barcode scanner.

## Implemented behavior

| Finding / request | Change | Evidence |
| --- | --- | --- |
| Inventory had no visible general edit/delete controls | Item Details and inventory actions expose editing and deletion. Edit includes name, sale/purchase price, MRP, SKU, category, minimum level, description, photo, GST rate and HSN/SAC. | Real headed browser save and API verification. |
| Deletion must preserve business history | Delete archives the master record. Restore is available; Items has a **Show removed items** filter. Stock, cost layers, invoices and journal history are retained. An active bundle's component cannot be removed. Removed items have disabled Make Bill and Buy Stock actions. | Stock projections before/after archive and restore are identical; historical invoices remain readable; inactive items cannot be sold. The final browser rerun checks disabled removed-item actions and re-enabled billing after restore. |
| Other records needed appropriate actions | Customer and supplier accounts have edit/delete/restore. Pending balances block deletion. Need List supports editing and existing reversible cancellation. Existing posted expenses retain cancellation/reversal, and bills retain returns. | Profile/ledger-name updates, opening-due edit rejection, account archive/restore and Need List scenarios pass. Posted financial documents are not hard-deleted. |
| Removed customer could still appear in bill selection | New-bill and Udhar customer choices exclude removed records; removed account billing/payment buttons are disabled. | A fresh removed customer is absent after the real chooser has loaded. |
| Packet could revert to PCS | Selecting a counted unit now resets a measured selling mode correctly. Selecting Pieces preserves the chosen counted unit rather than forcing PCS. | UI creates a Packet item after switching Weight → Packet → Pieces, and stock/billing display PKT after saving. |
| New Bill returned to Home | Clear the completed receipt after the bill route mounts, retaining a valid receipt during navigation. | Two cash bills posted consecutively through the receipt's New Bill button, without a Home detour. |
| Different meanings of Items | Billing and payment distinguish product lines and summed units; receipt shows both. | Seven lines/twelve units and three lines/three units. |
| Barcode should be optional and initially hidden | Tenant Settings → Billing preferences → Barcode scanning. Missing preference defaults OFF. Barcode inputs and search/scan copy appear only when enabled. Existing barcode data and ERP code are preserved. | Default OFF, persisted toggle, isolation, disabling without data loss, enabled keyboard Enter adds one unique match. Multiple name matches retain the chooser. Camera scanning is not implemented or claimed. |
| Retry/permission safety | Master writes require server permissions and tenant scoping, produce scoped audit records, and lock submission. Photo retry reuses the saved item. Base unit is protected after stock/documents exist. | Cashier and cross-tenant writes fail; existing photo/idempotency/costing regressions pass. |

Price/tax updates apply to future transactions. Existing invoice monetary values and stock receipt costs remain authoritative. For an item with history, use existing unit conversions rather than reinterpreting its base stock unit. No migrations were added; barcode preference uses the existing tenant configuration JSON.

## Recreated scenario

Each run provisions fresh disposable shops. The supplied report gives totals but not the six original item prices; these are constructed equivalent groceries, not a claim to reproduce unknown source rows.

| Line | Base unit | Rate | First bill quantity |
| --- | --- | ---: | ---: |
| Rice 5kg Pack | PKT | ₹399 | 2 |
| Oil Bottle | LTR, counted whole bottles | ₹240 | 1 |
| Toor Dal 1kg Pack | PKT | ₹180 | 2 |
| Tea Pack | PKT | ₹140 | 1 |
| Sugar Pack | PKT | ₹55 | 2 |
| Atta Pack | PKT | ₹150 | 2 |
| Existing synthetic Biscuit | PCS | ₹25 | 2 |

- First: **7 lines / 12 units / ₹1,998**, ₹2,000 tender, **₹2 change**.
- Second: rice + dal + oil, **3 lines / 3 units / ₹819**, ₹1,000 tender, **₹181 change**.
- The new shop recreates the prior General Store fixture and one fully returned ₹90 baseline bill: **9 bills, ₹99,630 net sales** before the busy-counter sales.
- After: **11 bills, ₹1,02,447 net sales**. Actual cash movement increases **₹2,817**; expected drawer rises **₹21,880 → ₹24,697**. An earlier actual cash count is not silently overwritten.
- Supplier dues remain **₹29,954**; the tested customer remains **₹11,200** due. The new cash bills introduce no customer/supplier debt.
- The Packet setup and editable master records use additional isolated synthetic records. They do not alter the baseline reconciliation.

All stock and financial fixture mutations use actual Retail routes and existing posting services. No real money or external messages are sent. Existing business tenants and original QA records were preserved. Disposable databases and their isolated uploads are removed by the runners.

## Verification

| Check | Result |
| --- | --- |
| PostgreSQL focused regression | 87 unique tests passed: General Store 13, Shopkeeper 11, Platform access approval 8, Costing/profit 39, Expenses 2, Busy-day/master actions 14. Full run exit 0. |
| Final strengthened supplier/GST API assertions | 14/14 busy-day tests passed, exit 0. |
| Headed Chrome acceptance | 45 unique tests passed: Busy-day/master actions 9, General Store 22, Shopkeeper/platform approval 14; zero failed, exit 0. A subsequent fresh-shop run passed all 9 busy-day tests after the final inactive-item button guards and inventory screenshot assertions, exit 0. |
| Migration chain | All 34 migrations deployed to clean disposable PostgreSQL; migrate status up to date; Prisma validation passed. |
| Backend typecheck and production build | Passed, exit 0. |
| Frontend typecheck and production build | Passed, exit 0. |
| Responsive targeted pages | 360, 390, 412 and 1366px; billing, stock and Settings fit without horizontal document overflow. |
| Preserved localhost preview | Frontend HTTP 200 on 5173; rebuilt API on 8012 reports ready. Separate project on 5175 untouched. |

New automated sources: `backend-typescript/test/busy-day-qa.e2e-spec.ts`, `backend-typescript/test/fixtures/busy-day-scenario.cjs`, `frontend/tests/busy-day-qa.spec.ts`.

Runs deliberately test failed uploads, unavailable report responses, rate-limit backoff and rejected removal. Those failures are expected assertions, not a claim that production errors are ignored.

Earlier iterations exposed account restore status omission and delayed barcode-toggle state, both corrected. Two runs timed out during Chrome context teardown after the item or purchase workflow assertions had passed. The saved trace showed successful purchase save, photo retry and single-create assertions, followed by a context-close timeout. Test cleanup now navigates away from the app before revoking its session, preventing background reads from triggering a logout redirect during recorded-context shutdown. The complete 45-test headed rerun and final 9-test subset both passed; those earlier failures remain recorded in `scratchpad/busy-browser-before-cleanup-fix.log`. No unresolved regression remains in these focused suites.

Evidence logs: `scratchpad/general-store-qa-api.log` (87 API tests), `scratchpad/busy-browser-full-45.log` (complete 45-test Chrome run), `scratchpad/shopkeeper-browser.log` (final 9-test subset), and `scratchpad/busy-frontend-build.log` (latest frontend build). Browser screenshots/videos/traces are in `output/playwright/shopkeeper-qa` and `output/playwright/busy-day-final`. The Packet inventory screenshot now waits for the saved row and its **Stock: 4 PKT** label before capture.

## Cache cleanup

Removed **9,332,935 bytes (33 generated files, approximately 9.3 MB)** from `frontend/node_modules/.vite`, and the empty `backend-typescript/node_modules/.cache` directory. The local frontend was stopped only after checking its saved PID and Vite command, then restarted on port 5173. The cleanup log is `scratchpad/busy-cache-cleanup.log`.

The allowlist checks resolved absolute workspace paths and refuses reparse points. It covers only `frontend/node_modules/.vite` and `backend-typescript/node_modules/.cache`. Source, dependency installations, builds, Git state, uploads, databases, backups, documents and test evidence are retained. Vite recreates required cache entries on subsequent use. Removing build caches does not establish a billing speed improvement or production load capacity.

## Limits

No physical scanner, sustained hundreds-of-bills/concurrent-staff load test, production network profile, production backup/restore or full-product production certification was performed in this targeted fix. Existing accounting/concurrency/costing checks remain in the regression; they do not turn browser interaction timing into a human cashier speed guarantee. No deployment or new phase was started.

Stop for owner review.
