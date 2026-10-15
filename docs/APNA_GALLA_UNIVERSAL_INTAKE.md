# APNA GALLA ADD ITEMS FASTER V1

Implementation and local verification, 15 October 2026. No Git commit, push, production import, production migration or operator account change.

## Architecture

`/retail/items/add-faster` offers exactly four methods, followed by Add One Item and Add Many Items. Items retains its ordinary Add Item button. Business Presets determine ordering and unit suggestions; they grant no entitlement. The existing Home / Bill / Items / Khata / More navigation and shared light/dark tokens remain in use.

All adapters converge on one pipeline:

Capture → extract → normalize → tenant item matching → saved review → explicit confirmation → existing Retail services.

The existing `RetailImportJob`, `RetailImportRow` and identity/idempotency infrastructure store drafts. Intake uses `preset=UNIVERSAL_INTAKE` with kinds `INTAKE_ITEMS` and `INTAKE_PURCHASE`. No additional schema migration is required. Legacy import endpoints reject these kinds instead of interpreting them as another import type.

Authoritative boundaries:

- `RetailService.createItem` creates minimal items and delegates explicit opening stock to the existing opening-stock service.
- `ItemCompositionService.addConversion` saves reviewed pack conversions.
- `RetailService.createPurchase` delegates the complete supplier purchase to the existing Purchase service and its inventory, tax, payment and accounting engines.
- OCR, spreadsheet parsing, speech parsing and shared-file receipt never post stock, payable, GST, cash, UPI, COGS or vouchers by themselves.

## Adapters

| Method | Actual V1 support | Draft |
| --- | --- | --- |
| Supplier bill photo | Camera file capture or gallery; genuine JPEG, PNG and WebP, up to 5 MB and 20 million decoded pixels | Purchase |
| Excel / CSV | CSV, XLS and XLSX; up to 2,000 rows; selectable sheet through API; UI starts with first sheet | Items, with explicit counted opening stock per row |
| Speak Items | Optional browser SpeechRecognition plus editable typed fallback; deterministic English and Hindi/Hinglish unit/digit grammar | Items |
| WhatsApp | Installed PWA Web Share Target where supported; save-and-upload fallback everywhere the file picker works | Same photo purchase pipeline |

PDF, barcode intake and shelf-photo counting are not implemented or advertised. Existing unrelated barcode features are preserved.

## Draft lifecycle and recovery

Friendly labels cover RECEIVED, PROCESSING, NEEDS_REVIEW, READY, PARTIAL, CONFIRMED, FAILED and CANCELLED. OCR is asynchronous and exposes real processing stages. Review is server saved and can be reopened from intake history or its job URL. A browser reload does not discard saved or unresolved rows.

Supplier selection, invoice date/number/total and payment choices are held in an eight-hour, user/company/branch/financial-year scoped session draft. Voice transcripts use the same scoped recovery. Files awaiting initial upload require reselection, except the temporary PWA handoff. There is no claim of offline posting.

Cancellation, row editing, confirmation, worker publication and timeout recovery lock the job. A cancelled OCR lease cannot recreate its rows. Saved records remain intact. Re-uploading a discarded file starts a fresh job. Processing older than ten minutes becomes a retryable failure when the review is loaded. Retry never posts a purchase.

## Matching and review

Tenant matching checks barcode, SKU, aliases/normalized names and possible fuzzy matches. A possible match requires choosing an existing item or explicitly creating a new item. Name similarity alone never merges products. Confirmation checks matching again under the company lock to handle another user creating the item during review.

Each row retains normalized values, source reference, warnings, match candidates and field provenance. Source values are distinguished from user edits and confirmations. Unchanged reviewed fields receive USER_CONFIRMED; changed or cleared fields receive USER_EDITED.

Needs Your Attention precedes collapsed Ready Items. Summary counts distinguish found, ready, needs review, received/added and kept/skipped. Invalid numbers display a correction request, never `₹null` or a fabricated zero. A row sheet preserves the underlying review and supplier choices.

Spreadsheet users can explicitly skip a bad or advanced row and import the other ready rows. Purchase rows cannot be skipped: the bill is one complete transaction. Unsupported variants, serials, measured dimensions or advanced source fields are retained and directed to the existing configuration/Buy Stock flow; they are not silently discarded.

## Spreadsheet behavior

Familiar unambiguous headings are suggested automatically. Ambiguous headings remain unmapped until the user chooses their meaning. Unmapped columns stay in the draft and need an explicit acknowledgement before being omitted from posting. Mapping changes create another saved review from the retained source rows and cannot rewrite a partially posted job.

One confirmation saves up to 25 ready rows, with row savepoints. A failing row rolls back its own item/opening-stock work and remains editable; other valid rows may save. Imported row identities prevent replay. Existing items are kept, and their prices and stock are not overwritten by this V1 import. Existing stock receipts belong in Buy Stock.

A quantity column does not imply opening stock. A user must select counted opening stock on that row. Blank stock remains unconfigured. Blank cost uses the authoritative unknown-cost path, including the cost state's unknown quantity; it is not booked as a free purchase. New items use the minimum selling price required by the existing item service.

## Supplier bill confirmation

The header supports supplier selection and inline supplier creation, invoice number/date, an editable bill total, and the photo for comparison. The review displays estimated subtotal, GST, total, payment status and supplier due effect. Missing prices/quantities suppress a complete total.

Every OCR row requires explicit checking. Unknown pack conversion requires entering how many selling units belong in the purchase pack; saved conversions are reused. Units are never inferred from item names. Batch/expiry and GST remain governed by current Shop Features and commercial entitlements, rechecked at confirmation.

Before saving, the user acknowledges all rows, total, GST and payment. A bill total is required, using the detected total or the user's correction. Impossible calendar dates are rejected before purchase posting. If the authoritative purchase total differs by more than ₹0.02, the whole transaction rolls back, including newly created items, stock and dues. Discounts and extra charges require the manual purchase form.

Repeated content uploads return the same draft. The same supplier invoice number, including case changes, is rejected even from a different photo. Job and company locking plus the existing persistent idempotency key prevent concurrent confirmation from posting two purchases. A saved job returns its existing purchase ID. The UI offers View Purchases for saved or duplicate bills.

## OCR provider and worker

The API only validates, cleans, privately stores and queues the image. `TesseractOcrProvider` uses local Tesseract.js 6, Apache-2.0 licensed, with Sharp preprocessing. Recognition runs in a separate Node worker, outside HTTP handling and database transactions. No paid AI API is used. Supplier documents are not sent to a generative model.

The V1 layout parser requires clear `name quantity UNIT purchase-rate line-amount [GST%]` rows. It can read explicit invoice number, ISO date and grand total. Other invoice layouts, handwriting, skewed/blurred images and unexplained discounts may need correction or manual entry. This is not a claim of general invoice recognition accuracy. More than 200 extracted purchase rows fails safely rather than truncating a bill.

Recognition initialization is bounded to 60 seconds and recognition to 120 seconds. Failed/empty extraction keeps a failure state with retry, another photo and Enter Purchase Manually. Exceptions do not dump invoice text into logs. Worker leases prevent late or duplicate publication.

Deployment after the user's manual release:

```text
npm ci --include=dev
npx prisma generate
npm run build
npm run intake:worker
```

Run the last command as a separate supervised worker, using the same database, private storage provider and encryption/storage credentials as the API. The worker loads a minimal Nest context and does not bootstrap operator accounts. Set `INTAKE_OCR_ENABLED=true` on API and worker only after provisioning and checking that worker. The API's enabled flag is configuration, not a live worker-health assertion. The existing web start command does not start OCR.

Configuration, also listed in the backend environment example:

```text
INTAKE_OCR_ENABLED=false
INTAKE_OCR_LANGUAGES=eng+hin
INTAKE_OCR_CACHE=.ocr-cache
INTAKE_OCR_LANG_PATH=
```

Pre-provision language models or permit model downloads. Cache paths must be writable. Optional `INTAKE_OCR_LANG_PATH` points at a self-hosted traineddata location. Default model downloads contain no supplier document. The model cache is ignored by Git.

Use shared durable private storage for API and worker on different hosts; ephemeral local storage on a free web instance cannot safely serve a separate worker host. OCR is opt-in and the manual purchase fallback remains available. No paid hosting service was provisioned. Production memory/throughput and Hindi model performance need validation on the chosen host; the single English synthetic bill benchmark is recorded in the verification report, not a capacity guarantee.

## Voice

Browser speech capture is optional and explicitly labelled Experimental. The browser may use its own online speech recognition service; the UI explains this before microphone use. Editable typed entry remains usable when recognition is unsupported or denied. Example: `Maggi 20 packet price 14 rupees`. Common Hindi unit words and Devanagari digits are normalized; arbitrary natural-language lists are not guessed.

The transcript can be corrected before parsing, then the structured row can be corrected before saving. Voice quantities do not create stock unless opening stock is explicitly selected. Native microphone recognition and accent accuracy have not been field tested in this environment.

## WhatsApp/PWA

The manifest registers a multipart POST `/intake-share` image share target. The service worker keeps at most three short-lived handoffs in its dedicated same-origin cache and redirects to the intake preview. A random nonce identifies each handoff. The user must be authenticated and explicitly press Use Photo to upload into the selected shop. No API response, token or password is cached.

Handoffs expire after 30 minutes; expiration is enforced on access and the next cleanup, not by a background OS timer. Logout sends the purge message. Native Web Share Target availability depends on installation, Android/browser support and HTTPS. The local service-worker routing/preview/purge behavior was exercised; native Android WhatsApp sharing has not been tested. An unsupported browser can save the invoice image from WhatsApp and select it from Gallery.

## Privacy, authorization and retention

Job, row, document, matching and confirmation APIs validate company and branch. Supplier and item references must belong to that company. Manual permission checks protect account-prefixed intake routes, including purchase read/write permissions. Current subscription and feature guards remain active. No operator account is used for tests.

Image MIME, decoded contents, dimensions and size are checked; private storage keys are server generated. Spreadsheet workbooks require genuine supported binary containers, expansion limits and row limits. Formulas are rejected in intake workbooks; formula-like CSV item details need plain values. Parsing never evaluates formulas or macros. Existing CSV export formula protection remains intact.

Documents are separate evidence and never automatically become product images. Private photo access is authenticated and no-store. Photos expire after seven days; cancelled photos are also removed by the worker cleanup. Draft source rows are redacted after 90 days. Saved purchase/item records remain; retained job metadata can still prevent duplicate posting. Cleanup skips already redacted jobs so they cannot starve later expired documents.

The worker must run cleanup for physical deletion. Expired photo access is denied even if the cleanup process is offline. Changing storage provider requires a deliberate private-document migration; the worker refuses a mismatched provider.

## Measurements and tests

Optional experience events accept a fixed vocabulary and bounded numeric fields only. No transcript, invoice text, GSTIN, phone, product list, amount, search query or URL is accepted as analytics input. Server audit events also record draft/processing/correction/confirmation/cancellation counts. The scoped 30-day metrics endpoint reports event counts, per-source job outcomes, initial review rows, completion duration, time to first audited item and time to first posted bill. Correction, mapping and abandonment event rates are observations, not recognition-accuracy or causal claims. Support tickets and real duplicate-product quality require field review; no invented rates are supplied.

All mutating automated tests use separately provisioned synthetic owners in a disposable localhost database ending `_test`. They cover controlled voice, genuine Excel/formula rejection, mixed valid/invalid CSV, column choices, explicit opening stock with unknown cost, 501 rows, tenant boundaries, failed OCR, cancellation leases, possible matches, GST, pack uncertainty/feature changes, wrong-total rollback, concurrent confirms and duplicate content/invoice protection. Existing costing, billing, Galla, Khata, assistant, import and onboarding suites were also run.

See [verification report](verification/APNA_GALLA_EXPERIENCE_20261015.md) for exact results and remaining device/human checks. The unassisted 20-row participant test and native Android microphone/WhatsApp checks remain pending; no overall VERIFIED release badge is claimed.
