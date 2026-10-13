# Retail UI, universal units and Split + Udhar verification

Verified locally on **8 October 2026**. The existing Retail facade, POS, Inventory, Purchase, Pricing and Accounting posting architecture remains in use. No new database migration was needed for these changes.

## Changes

- Inventory and Low Stock use compact rectangular summaries. At 390px, ordinary inventory cards measure about **124px**, and purchase-history rows about **73px**. Long names, SKUs and supplier references truncate in summaries; full values remain in accessible labels/titles and expanded detail views. Cards stay inside their grid even with very long identifiers.
- Buy Stock separates Camera/Gallery from the fixed Save Purchase action and reserves scrolling space above the footer. Quick Sale, Udhar, supplier/customer payment and Add Customer use aligned back headers and properly spaced actions. Supplier sheets use an action inside the sheet rather than a page-level fixed button.
- Quick-created items keep the fast name/price flow, with optional universal unit selection. The unit picker searches familiar names such as `piece`, shows names and codes, and supports tenant-owned custom units. Item Details and Edit Line permit base-unit changes before saved records/configuration exist. Backend guards and locks protect historical units after use.
- Kilograms, metres, square/cubic units, pieces, packs and service units remain distinct. Litres/ml use scalar decimal quantity, without requesting length/width/height; dimensional volume uses cubic units. Services support fractional quantities without creating stock. Plan/feature restrictions remain enforced.
- Split payment supports a customer-backed Udhar remainder and promise date. Cash/UPI receipts are posted as received money; the remainder goes to the existing receivable system and Calendar. The QR contains only the UPI portion. Confirmation shows total, money received, individual payments and remaining Udhar accurately.

Price-only goods still do not invent physical stock or COGS. Receiving real stock enables counting through the authoritative Inventory service. Previously saved records retain their original stock/cost semantics.

## Automated evidence

| Check | Result |
|---|---|
| Backend unit tests | **1,294 passed**, 35 files, exit 0 |
| PostgreSQL API E2E | **388 passed**, 19 files, exit 0 |
| Existing headed browser regression | **97 distinct cases passed after targeted repairs/rechecks**, 16 files |
| Additional affected form rechecks | **2 passed**, exit 0; already included in the 97 distinct cases |
| Fresh category browser workflows | **10/10 passed** |
| Independent headed unit workflows | **6/6 passed** |
| Responsive layout combinations | **144/144 passed**, no uncaught page errors |
| Additional customer layouts | **10/10 passed**, including 390×450 |
| Backend `npx tsc --noEmit` / `npm run build` | Both exit 0 |
| Frontend `npx tsc --noEmit` / `npm run build` | Both exit 0 |
| Prisma migration status / validation / standard generation | **31 migrations up to date**, validation and generation exit 0 |

The API E2E suite includes universal items, batch/FEFO, serial/warranty, bundles/modifiers, costing, platform authorization, tenant isolation, Assistant and Retail flows. Six added cases in the existing field/calendar suites verify universal units and partial-credit semantics, including concurrent idempotent checkout, accounting balance, tenant isolation, due dates and QR display without payment posting.

The browser suite covers Retail lifecycle, platform controls, import/report flows, attachments/retries, WhatsApp receipt links, Assistant, accounting reports, stock locations and UI controls. It ran **headed**, using one worker and visible interactions. The initial full run had **93 passed / 4 failed**. After repairs, those four cases passed in a targeted run, exit 0. Two further affected party-form cases passed, exit 0. This is combined verification evidence, not a claim that a second full 97-case run occurred.

Failures and corrections were retained:

1. Weight and length assertions expected the former `Quantity` label. Updated them to the new mode-specific labels; the purchase, bill and return flows passed.
2. The UPI/customer-due case exposed Add Customer's save button intercepting Advanced Details. Fixed the form footer and scroll space; the full QR/customer-due case passed.
3. The unit-sheet assertion expected `Sack` instead of the clearer `Sack (SACK)` label. Updated it; search, Escape, focus return, custom category and short-height checks passed.
4. A separate rerun could not reach the stopped localhost test server. Restarted the environment and reran successfully. Those connection failures were not treated as product passes.
5. A backend fixture relied on the previous accidental alphabetic default unit. Made its intended unit explicit and repeated the complete API suite: 388 passed.
6. Standard Prisma generation initially hit a Windows native-DLL lock while APIs were running. After the services stopped, standard generation passed, followed by fresh builds and server starts.

## Fresh shop category matrix

Each shop was provisioned as a new disposable tenant through the Platform API. The browser created/configured goods, received stock where applicable, billed and verified saved totals/stock.

| Shop | Tested configuration | Saved sale | Stock after sale | Result |
|---|---|---:|---:|---|
| Grocery | 2 boxes × 10 pieces; sell one box | ₹100 | 10 PCS | PASS |
| Clothing | Variant receipt and sale | ₹100 | 1 PCS | PASS |
| Hardware | Receive 10.5 metres; sell 0.5 | ₹50 | 10 MTR | PASS |
| Tiles | Area dimensions, 24 square feet received | ₹600 | 18 SQFT | PASS |
| Produce | 5.5kg received; sell 0.75kg | ₹75 | 4.75 KG | PASS |
| Volume goods | Cubic dimensions, 48 units received | ₹600 | 42 CBM | PASS |
| Electronics | Two serials received; one sold | ₹100 | 1 PCS | PASS |
| Pharmacy | Batch/expiry receipt and allocation | ₹100 | 1 PCS | PASS |
| Services | HOUR service without physical stock | ₹100 | 0 | PASS |
| Gifts | Bundle configured from components | ₹100 | No own bundle stock | PASS |

Separate unit evidence verifies **0.5 HOUR × ₹100 = ₹50**, and a price-only **0.75 LTR × ₹100 = ₹75**, with no invented stock/profit. Custom Carton persists, `piece` returns Pieces (PCS), and historical base-unit changes are rejected through the backend.

## Split-payment proof

The headed browser created a price-only item, changed its unused unit from PCS to PKT, and billed ₹100:

- Cash received: **₹40**.
- UPI received and QR amount: **₹30**.
- Udhar remaining: **₹30**, assigned to a customer.
- Promised payment: **20 October 2026**, visible in Calendar.
- Success summary: **₹70 received / ₹30 due**, rather than claiming the whole bill was received.
- Missing customer blocks the credit checkout. Showing the QR does not submit payment.

## Layout and usability

The independent matrix checked 18 routes at **360×800, 390×844, 412×915 and 1280×900**, in both light and dark themes: Home, Items, Stock, Low Stock, Purchases, Buy Stock, Quick Sale, Udhar, Expenses, Khata, Suppliers, Reports, More, Calendar, Settings, Add Item, Add Expense and Make Bill. Checks included card bounds, long identifiers, horizontal overflow, header collisions, attachment/action spacing, keyboard search, Escape and focus return. Additional Add Customer checks include a short 390×450 viewport.

## Evidence files

Local artifacts are under `output/playwright/retail-polish/`:

- `VERIFICATION_RESULTS.json`: consolidated results and 97 distinct scenario names.
- `headed-initial-results.json`, `headed-final-recheck.json`, `headed-party-recheck.json`: original and corrected browser results.
- `category-results.json`, `customer-layout.json`, `split-browser-proof.json`, `split-proof.json`.
- `audit/AUDIT_SUMMARY.md`, `audit/responsive-audit.json`, keyboard/detail proofs and screenshots.
- Backend test and final Prisma logs, full headed run and targeted recheck logs.
- `split-success-final.png`, `split-upi-30-final.png`, `piece-search-final.png` and compact-card/form screenshots.

Additional independent unit evidence is in `output/playwright/unit-proof/results.json` and its screenshots. Evidence directories are intentionally ignored by Git; preserve them separately when handing off the checkout. Private test credentials and raw CLI credential echoes remain in ignored scratch files and are not part of the report.

## Runtime and limits

The updated development preview is available at **http://localhost:5173** with API **8010**; API readiness and frontend responses returned HTTP 200. Transactional testing used isolated API **8011**, browser **5174** and disposable databases; it did not add fixtures to the owner's development shop.

These results establish local UI/function regression evidence. Browser viewport checks are not physical-device, printer, audible TTS, real WhatsApp delivery, Google OAuth/provider, offsite backup/restore, production staging or Play Store certification. Existing deployment/recovery gates remain in `docs/RELEASE_CHECKLIST.md`. Base units cannot be changed after historical use; use an explicit pack conversion or a new item. Cubic volume and litres remain different input workflows. No deployment or new business phase was started.
