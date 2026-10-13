# Retail improvements acceptance — 7 October 2026

The nine latest owner requests extend the existing Retail facade and authoritative Inventory, POS, Purchase, Pricing and Accounting services. The Retail core was preserved. No production deployment, Play upload or automatic next phase was performed. This local acceptance does not close the external release gates in [PRODUCTION_COMPLETION_REPORT.md](../PRODUCTION_COMPLETION_REPORT.md).

## Implemented behavior

| Request | Result |
|---|---|
| Centre Bill plus icon and label | Home / Items / **Bill** / Khata / More; geometric centre verified at 360, 390 and 412 pixels. |
| Bill unknown goods without stock setup | New Bill search → Add Item & Bill asks only price, using the searched name; persists a real catalog item with stock counting explicitly disabled. Subsequent bills work. Stock and Item Details show that stock is not counted. |
| Stock directory | Stock offers Add Item, Inventory, Low Stock, Buy Stock, search, load more and out-of-stock filtering. Counts identify loaded results. Alerts respect configured thresholds and exclude services, bundles and uncounted goods. |
| Split payment QR | The payment screen generates the exact UPI portion. Saved bill and printed receipt retain that amount as a reference QR with an explicit do-not-pay-again notice. Printed QR respects the invoice setting. Displaying a QR never confirms payment. |
| Custom thank-you voice | Settings → Payment voice greeting: enable, English/Hindi, editable text, `{shop}`, speed and preview. Plays after successful received-money saves, once per saved operation in the tab; unpaid Udhar does not announce payment. Manual replay is available on completion. |
| Search Buy Stock | Each receiving line searches the full catalog by name/SKU/barcode and retains the selected item. Existing unit/variant/batch/serial receiving controls remain. |
| Supplier schedule | Add Supplier and Supplier Account support next date and once/weekly/monthly repeats. Day 29–31 clamps to shorter months and returns to the original day in later months. |
| Customer promise/calendar | Credit billing, amount-only Udhar and unpaid Bill Details support due/promise dates. Calendar displays supplier visits, unpaid receivables/payables, tasks/meetings and selected verified 2026 holidays. Paid/reversed bills stop appearing as dues. |
| Cleaner Home and discovery | Four primary actions, Customer Paid Me, Daily Galla, real summaries, Today's Calendar and a shop-tool directory. Settings and More retain account controls. Premium light theme remains the default. |
| Owner manual | The 14-page fillable manual contains 72 checks, expected outcomes, PASS/FAIL/BLOCKED choices and a multiline defect log. All pages rendered and visually reviewed; 223 unique field/widget values and appearances validated. |

## Inventory safety

An uncounted item is a real ordinary good, not a service or an unlimited-stock override for a previously counted item. Advanced tracking and composition require real inventory setup. A real receipt/count changes the counting flag under the authoritative Inventory item lock and posts the real quantity. Existing item stock cannot be switched off through Retail updates. Each bill line stores whether physical stock was counted at sale time. Returning a historically uncounted sale after counting begins does not fabricate a stock return. Physical movements remain in the shared Inventory engine; accounting remains in the existing posting engine. Incomplete stock/cost history is not represented as complete profit or valuation.

The additive migration `20261007170000_retail_calendar_price_only` defaults existing items and historical bill lines to counted, adds supplier scheduling/company voice settings and indexed company/branch calendar tasks. Service returns still follow the existing service exception. All 25 migrations were deployed on a clean disposable PostgreSQL database and status is up to date. The normal development database is also up to date; no reset or destructive schema push was used.

## Evidence

| Verification | Actual result |
|---|---|
| Complete backend E2E | 16 files, 189 passed, 0 failed, exit 0 |
| Complete backend unit/integration | 29 files, 235 passed, 0 failed, exit 0 |
| Complete Chromium browser | 43 passed, 0 failed, exit 0 |
| Backend typecheck/build | Both exit 0 |
| Frontend typecheck/build | Both exit 0 |
| Prisma validation/generation | Both exit 0; generated client used by the compiled API and regression tests |
| Clean migration deploy/status | All 25 applied, exit 0; up to date |
| Development migration status | All 25 applied, exit 0; up to date |
| Local availability | Frontend HTTP 200; API readiness `ready` on port 8010 |
| PDF structure and visual review | 14 pages; 72 checks; 216 default-off result boxes plus 7 text fields; appearances and values consistent |

**Final automated total: 467 passed, 0 failed.** All three complete regression commands exited 0. The backend source did not change after its complete runs. The full browser suite uses the corrected stock text and updated smoke checks. A subsequent visual-only change places the stock badge below long item names; all six relevant browser tests passed again (exit 0), and final frontend typecheck/build passed after that edit. These repeated six checks are not added to the 467 distinct tests.

The new HTTP file adds 13 cases for uncounted sales/receipts/returns, rejection of unsafe stock-mode changes, monthly/weekly dates, valid dates, tasks, dues, per-company greeting settings and cross-tenant failures. Existing universal, FEFO, serial, composition, accounting, concurrency/idempotency, platform, authorization, subscriptions, backup and auth suites remain included.

Six new real-browser tests cover inline price-only billing, centred navigation, exact split QR, recorded receipt QR, greeting playback requests, saved catalog discovery, supplier and repayment calendar, task completion, catalog search and mobile layouts. Existing full browser coverage exercises fresh Super Admin-created shops, real Retail workflows, retries, reports, devices, public pages and platform controls.

The first full browser run had **39 passes and 4 failures** because legacy smoke tests still expected the renamed `+ Add Item` button. Those assertions now open `+ Add Item & Bill`, verify its price dialog and dismiss it before continuing billing. No test was skipped or weakened. Earlier development failures exposed a real asynchronous task-checkbox UI issue and a reused task-title fixture; both were corrected. Repeated runs are not added together to inflate final counts.

Sanitized logs and representative screenshots accompany this report. Credential files, login traces, database archives and API access logs remain ignored and are not release artifacts.

## Practical limits and review

- Voice playback requests are automated-tested; actual audible Hindi/English quality, device volume and browser autoplay still need a phone check. Unsupported audio cannot invalidate a saved payment. This is a device greeting, separate from the planned WhatsApp voice assistant.
- Holidays are selected 2026 national/major dates verified from [India Post](https://www.indiapost.gov.in/holidays-list) and [IIRS](https://www.iirs.gov.in/holidaycalender). Regional/lunar differences and unsupported years are explicitly disclosed. The reference screenshot's October 7 observance was not treated as an authoritative date.
- Calendar queries are bounded to 1,000 records per category/month and warn on truncation. Stock filters/counts describe loaded search results; search queries the full catalog.
- Retail split checkout currently requires Cash + UPI to equal the complete bill total; the manual checks this validation. Customer credit/promise dates use the dedicated Udhar flow. Partial-credit split completion is not claimed.
- The manual deliberately marks unavailable cloud/provider/device acceptance as BLOCKED. Production offsite recovery, OAuth/SMTP accounts, full attack matrix/scale checks, signed Android and actual-device printing/sharing remain external release gates. This report does not declare production candidate readiness.

Use [MANUAL_TEST_PLAN.md](../../MANUAL_TEST_PLAN.md) and the companion fillable guide in `output/pdf/EVOLIX_Manual_Test_Guide.pdf` on a disposable test shop. Local app: `http://localhost:5173/login`. Current local test credentials are supplied separately and are never embedded in the PDF.
