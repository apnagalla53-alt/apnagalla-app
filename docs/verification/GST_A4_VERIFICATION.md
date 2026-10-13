# A4 GST invoice verification — 9 October 2026

The sidebar GST workflow is implemented and ready for owner review on localhost.
This report covers this change and its selected regression suites. It does not
certify the whole application for production, GST filing or Play Store release.
No deployment was performed.

## Before implementation

- Inspected Git status and retained the existing uncommitted work.
- Prisma validation and migration status passed with 31 migrations applied.
- Retail flow and field coverage baseline: 29 passed, zero failed, exit 0.
- No regression was found in those two baseline suites.

Baseline logs: `scratchpad/gst-baseline-prisma.log` and
`scratchpad/gst-baseline-tests.log` (local ignored execution files).

## Migrations and builds

The additive `20261009010000_retail_gst_documents` migration adds immutable
invoice documents and company/financial-year number sequences. Business GST
settings use the existing company configuration, preserving sibling settings.

All 32 migrations deployed and reported up to date on a clean disposable
PostgreSQL database. The new migration also deployed on two existing test
databases and the local development database with the prior 31 migrations.
No reset or data-loss push was used.

Prisma validation and generation passed. Backend and frontend TypeScript checks
and production builds all exited 0. These are local build results, not evidence
of a deployed production environment.

Evidence:

- `output/playwright/gst/migration-evidence.json`
- `scratchpad/gst-prisma-validate.log`, `scratchpad/gst-prisma-generate.log`
- `scratchpad/gst-backend-types.log`, `scratchpad/gst-backend-build.log`
- `scratchpad/gst-frontend-types.log`, `scratchpad/gst-frontend-build.log`

## Automated regression

Final run: **142 passed, zero failed, seven files, exit 0**.

| Suite | Passed | Failed |
| --- | ---: | ---: |
| Retail flow | 19 | 0 |
| Retail field coverage | 10 | 0 |
| Universal item flow | 20 | 0 |
| Batch / expiry / FEFO | 17 | 0 |
| Bundle / modifier | 15 | 0 |
| Costing / profit | 39 | 0 |
| GST invoices | 22 | 0 |
| **Total** | **142** | **0** |

The 22 GST tests exercise real HTTP and PostgreSQL, including:

- GSTIN checksum/state, regular-registration and reporting-provider gates.
- Scoped reads/writes, pagination validation, foreign line IDs, tenant/header
  attacks and read-only staff permissions.
- CGST/SGST, UTGST and IGST; saved historical rates; mixed/custom percentages;
  HSN/SAC/UQC validation; weight, area and alternate selling quantities.
- Conditional recipient addresses, posted-source and financial-year checks,
  rejection of untaxed past bills and amount-only quick sales.
- Confirmation gates, concurrent issuance, idempotent retries, consecutive
  unique numbers, immutable documents and unchanged stock/accounting postings.
- Odd-paise conservation and balanced source journals.

The broader run exposed an existing reversal-date defect: before 05:30 India
time, a stock adjustment reversal could be dated on the previous UTC day.
Inventory and accounting reversals now use the existing Indian business-date
helper. The costing suite checks both reversal dates and passes after the fix.

Machine-readable result: `output/playwright/gst/e2e-results.json`.
Execution log: `scratchpad/gst-final-regression.log`.

## Headed browser acceptance

Tested through the real UI with Playwright CLI in headed mode:

- Sidebar discovery, first-time business setup and saved organization details.
- Past taxed bill preparation, recipient/line metadata, preview, confirmations,
  issue, reload and reprint.
- New GST bill through the existing POS, cash payment, completion action and
  small unregistered walk-in preparation without a compulsory address.
- Search and issuance of a 60-line past bill.
- Goods copy selection: recipient, transporter and supplier labels preserve
  the same issued document number. Service-only copy selection is implemented
  and its supply-kind snapshot is covered by API tests; a separate service-only
  headed browser flow was not recorded.
- Custom 0.25% item tax entry and save through the item form.
- Hindi GST labels and restoration to English.
- Mobile viewports 360×800, 390×844 and 412×915, plus desktop 1440×900:
  no document-level horizontal overflow. The A4 preview intentionally scrolls
  inside its own container on a phone.

The print button was checked by intercepting the browser print call. Actual
PDFs were separately exported with the browser's print engine; a physical
printer and Android native print dialog were not tested.

Some intermediate development runs were interrupted by a backend/HMR restart
or a helper reading the 60-line form before it finished rendering. Targeted
reruns passed after waiting for the final field and restoring the test session.
This is final verification after reruns, not a claim that every exploratory
invocation passed first time.

Browser evidence is in `output/playwright/gst/`, including
`new-bill-browser.log`, `long-bill-browser.log`, `responsive-browser.log`,
`hindi-gst.png`, `custom-tax-mobile.png`, and `final-360.png` through
`final-1440.png`.

## A4 PDF verification

- Deliverable: `output/pdf/EVOLIX_A4_GST_Invoice_Sample.pdf`.
- One A4 page, ₹212.40 total, clearly identified sample business data.
- Internal long-bill fixture: four A4 pages, all 60 lines present, ₹7,080 total.
- Repeated table headings, final totals/signature block and page counters.
- All five rendered pages visually inspected for clipping, overlap and missing
  content. Extracted text confirms all 60 long-bill lines and page counters.

Evidence: `output/playwright/gst/pdf-evidence.json` and rendered
`a4-sample-1.png`, `a4-long-1.png` through `a4-long-4.png`.
The internal long-bill PDF is `a4-multipage-verification.pdf` in that directory.

## Scope and release boundaries

The layout includes the applicable domestic invoice particulars described in
CBIC Rules 46 and 48. A4 is the chosen print layout, not a prescribed government
design or government approval. GSTIN checks are local validation, not GSTN
registration verification. The owner must choose the correct classification,
rate, HSN policy and reporting applicability.

Government IRN/e-invoice reporting, statutory dynamic QR, GSTR filing, exports,
SEZ, cess, reverse charge and GST credit notes are not implemented by this slice.
Required or uncertain electronic reporting blocks issuance. Existing Retail
returns remain available but do not create a statutory GST credit note.
Historical receipt conversion does not backdate the tax invoice or resolve
period reporting obligations. Print/signature and copy requirements remain
the retailer's operational responsibility.

Workflow, source links and limitations: [GST invoices](../GST_INVOICES.md).
Manual review: [Manual test plan](../MANUAL_TEST_PLAN.md).
