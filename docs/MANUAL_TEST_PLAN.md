# EVOLIX owner acceptance test plan

Run these checks on a disposable shop. Use current local credentials supplied separately; do not put credentials or customer data in screenshots or the PDF. The companion fillable PDF is `output/pdf/EVOLIX_Manual_Test_Guide.pdf`.

Updated 8 October: the blank guide now contains 114 checks on 21 pages. Original check IDs 1-102 remain stable; IDs 103-114 cover the reference stock screens, searchable unit/category sheets, selected CSV export, server stock filters, purchase/payment choices, dates, staff permissions and stock transfer. It includes 349 interactive result/notes fields; all results start blank. Historical execution counts below refer to the earlier 72-check guide, not the expanded blank guide.

Local access: PC `http://localhost:5173/login`; LAN preview uses port 5174 and the current PC address from `ipconfig`. Super Admin uses `/platform/login`. Keep the preview/API running. See [LAN setup](LAN_TESTING.md) if firewall configuration is required. Exact cash reconciliation checks need a fresh shop/day without unrelated transactions.

The 7 October visible execution is recorded in [headed acceptance results](verification/2026-10-07-headed-manual/README.md): 60 headed browser tests passed; two additional CLI checks passed; the 72-check guide has 63 PASS, 6 PARTIAL and 3 BLOCKED results. `output/pdf/EVOLIX_Headed_Test_Results.pdf` is a separate completed execution report; the blank guide remains editable.

The guide covers all main implemented Retail workflows, the nine requested improvements, advanced item modes and Platform controls. A test is PASS only when its stated outcome is observed; unavailable provider/device features are BLOCKED, not PASS. Google, email, backup, physical print/share and Play/native tests require their real configured environments. The WhatsApp assistant is currently a plan.

## Nine requested changes

1. Approved Stitch bottom navigation: Home, Items, Bill, Khata. Open the shop menu for all other modules. Verify the five direct links and six groups, one open group at a time, automatic current-child expansion, visible Logout, and keyboard focus return.
2. New Bill search → no match → Add Item & Bill → price only → saved item and bill line. No fictitious stock count. Stock lists it as not counted. A real Buy Stock purchase starts counting received quantity; old uncounted returns never fabricate stock.
3. Split cash/UPI payment → exact UPI amount QR before confirmation. Completed bill and printed receipt show a reference QR for the recorded UPI amount, with a do-not-pay-again notice. Printed QR respects invoice settings.
4. Settings → Payment voice greeting → enable, language, text, speed, preview. `{shop}` is replaced with the business name. Payment save is independent of audio capability; unpaid Udhar does not play an automatic received-payment greeting.
5. Buy Stock → Search items queries the full catalog by name/SKU/barcode; selection retains variant, unit and receiving details.
6. Add Supplier → Supplier visits → next date + once/weekly/monthly. Monthly day 29-31 clamps in shorter months and resumes its original day in later months.
7. New Bill payment → customer repayment date, or Udhar → Due Date, or unpaid Bill Details → update promise date. Calendar shows unpaid receivables and supplier payables on due dates. Collected/reversed bills disappear. Add and complete dated tasks.
8. Home uses the approved Stitch quick tools, real business summaries and today's Calendar. The shop menu exposes all tools through six collapsible groups; Staff and Stock Locations appear when enabled and authorized. GST Invoices is a direct menu link when entitled. All Settings & Tools remains accessible in Settings & Help. Light theme remains the default.
9. Fillable manual PDF includes steps, expected results, PASS/FAIL/BLOCKED controls and a final defect log.

## Calendar coverage

The 2026 holiday list follows the [IIRS government calendar](https://www.iirs.gov.in/holidaycalender) and [India Post](https://www.indiapost.gov.in/holidays-list), reviewed 7 October 2026. It covers selected major holidays, not every state, religious observance or shop closure. Lunar dates may depend on local moon sighting. Other years show an explicit coverage notice; business events continue to work. Regional/future holiday expansion requires a verified maintained source.

## Stock and finance boundaries

Price-only items are real catalog goods with counting explicitly disabled, not mislabeled services and not a negative-stock bypass for existing tracked items. Sales stay on canonical POS/accounting posting. The first real purchase enables stock counting inside the same inventory transaction. Previously recorded bill lines retain their counting snapshot for returns. Do not infer complete profit or physical valuation when historical stock/cost was never recorded.

## Device acceptance

Test phone widths 360x800, 390x844 and 412x915, plus a laptop. Device TTS requires supported speech synthesis, an installed suitable voice, audible volume and browser playback permission. Automated playback-request tests do not establish audible quality on the user's phone. Use the manual preview/play controls to test this separately.

The 8 October Retail UX report is `verification/RETAIL_UX_MODERNIZATION.md`: 65 distinct headed browser scenarios passed after repairs and targeted reruns. This does not mark all 114 PDF checks PASS; actual device/provider checks remain manual.

## Compact cards, universal units and partial Udhar — 8 October supplement

Latest execution: [Retail polish verification](verification/2026-10-08-retail-polish/README.md). The 97 distinct browser cases passed after targeted rechecks; this count is separate from the 114 blank PDF checks and does not certify device/provider behavior.

- Open Inventory and Low Stock with long names/SKUs. Confirm compact rectangular cards, readable price/quantity/status, working actions and access to full details.
- Open Purchase History and expand an entry. Confirm the compact summary and complete supplier/bill reference. In Buy Stock, scroll to Camera/Gallery and verify Save Purchase does not cover them.
- Open Quick Sale, Udhar and Add Customer on a small screen. Confirm the Back heading and New Bill action remain separate, and the last form field can scroll above the Save action.
- Quick-add a ₹100 item. In Edit Line, search `piece`, choose another unused base unit and save. Create a custom unit and verify its name/code after reload. After billing/stock history, verify that base-unit changes are protected.
- Test 0.75 LTR and 0.5 HOUR without dimension prompts or invented stock. Test metre/area/cubic dimensions separately. Enable supported measured modes in Shop Features first.
- On a ₹100 bill, select Split, enter ₹40 Cash / ₹30 UPI, enable Remaining on Udhar, choose a customer and promise date. Confirm the QR requests ₹30; success shows ₹70 received and ₹30 due; Calendar shows the promise. Attempt credit without a customer and verify checkout is blocked.

## A4 GST invoice supplement - 9 October 2026

- Open Shop menu > GST Invoices. Check first-time setup, invalid GSTIN rejection, reload and saved organization details.
- Configure a correct item GST percentage and HSN/SAC; also test the Custom Rate input. Check a taxed POS quote before completing a sale.
- Use Make New GST Bill, complete payment and choose Prepare A4 GST Invoice. Check the recipient, place of supply, HSN and UQC. Small unregistered walk-in addresses are optional; registered/larger bills require them.
- Search a past bill and preview its A4 invoice. Check the posted total, discounts and local CGST/SGST versus interstate IGST. Tax cannot be added to an untaxed past bill.
- Confirm both declarations and issue. Reload, reprint and select each applicable copy; the invoice number and saved data must stay unchanged.
- Confirm that REQUIRED/UNSURE government electronic reporting blocks issuance; unregistered/composition registrations cannot issue this tax-invoice template.
- Print a one-line and long bill to A4 PDF. Check repeated headings, full totals, signature space and page numbers. Print and sign before real use; statutory electronic reporting remains unconnected.
- Test GST screens at 360/390/412 widths, on a laptop and in Hindi. A4 preview itself can scroll horizontally; the app must not overflow.

Details and limitations: [GST invoices](GST_INVOICES.md). Automated/browser evidence:
[A4 GST verification](verification/GST_A4_VERIFICATION.md).
