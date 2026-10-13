# A4 GST invoices

Open **Shop menu > GST Invoices**. Complete the registered business details once,
then choose a past itemized bill or **Make New GST Bill**. The new-bill action uses
the existing Retail POS, payment, inventory and accounting services.

## Business setup

Save the legal name, optional trade name, registered address, GSTIN, state, contact
details, invoice prefix and authorised signatory. Confirm regular registration,
the applicable HSN digit policy and whether IRN / statutory dynamic QR reporting
is required. An uncertain or required reporting declaration blocks issuance:
the government reporting provider is **NOT CONFIGURED**.

GSTIN validation checks its syntax, checksum and state prefix. It does not verify
registration status with GSTN. Default HSN policy is six digits; four digits can
be selected after confirming eligibility. Services require a six-digit SAC.
HSN inputs allow four, six or eight digits. UQC choices use the NIC code list;
custom selling units must be mapped to the appropriate UQC when preparing a bill.

Configure each item's applicable GST rate and HSN/SAC in Items before billing.
The form offers common percentages, including 40%, and a custom percentage.
These choices do not classify goods or automatically determine a legal rate.
Historical percentages remain available; no existing item or past sale is
automatically reclassified when rates change.

## Preparing and issuing

1. Search a past bill by sale reference or customer, or complete a new itemized
   bill through the existing POS. Its success screen offers **Prepare A4 GST Invoice**.
2. Check recipient details, delivery address and actual place of supply. Recipient
   GSTIN is optional for unregistered customers. Addresses are required for a
   registered recipient and, conservatively, bills whose total is at least
   Rs. 50,000. A small unregistered walk-in bill can leave an unknown address blank.
   Provide recipient particulars when the customer requests them.
3. Check descriptions, HSN/SAC and UQC. The measured/alternate-unit quantity,
   taxable amount, rate, discounts and tax are taken from saved sale facts.
4. Preview the A4 document. Verify the details and confirm that no GST invoice
   has already been issued for this sale outside EVOLIX.
5. Issue the invoice. Print and sign it. Reopen it to reprint or save a PDF.
   Select the recipient, transporter or supplier copy as applicable.

For goods the print labels are Original for Recipient, Duplicate for Transporter
and Triplicate for Supplier. Service-only documents offer Original for Recipient
and Duplicate for Supplier. Selecting a copy does not issue another invoice.

## Invoice particulars and storage

The template contains supplier name/address/GSTIN, recipient and delivery
particulars, invoice number/date, place of supply, reverse-charge indication,
description, HSN/SAC, quantity/UQC, net rate, taxable value, GST rate and tax
amounts, HSN/rate summaries, total, amount in words and a signature space.
CGST plus SGST/UTGST applies to a local place of supply; an interstate place uses
IGST. Saved tax is allocated in paise, with any odd paise assigned to CGST and
the remainder to the local component, preserving the original total exactly.
This is an allocation of the existing posted tax, not a replacement tax engine.

Invoices use an A4 portrait layout with 10 mm print margins. Long item tables
repeat their headings and retain whole rows across pages. Chromium supports the
page-number margin boxes; print capabilities can differ on native devices.

One immutable document is stored per source sale in `retail_gst_invoices`.
Business/recipient/line facts are captured at issuance. Later item, party or
business edits do not alter it. Paid and outstanding amounts are labelled
**at issue**; the original bill/Khata remains authoritative for later payments.
GST documents and their sequences are included in the existing account data export.

Numbering is company-wide across branches, consecutive within the Indian
April-March financial year, and no longer than 16 characters. A four-character
maximum prefix produces `ABCD/2627/000001`. Advisory locking and a transaction
protect concurrent issuance; retries return the same document. Invalid issuance
does not consume a number. There is no invoice deletion/renumbering API.
GSTIN, state and series become locked after the first issued invoice.

Issue date is the current Indian business date; the source sale date is separately
displayed. An open financial year covering the issue date is required. Converting
an older receipt does not backdate the new invoice or complete statutory tax-period
reporting. Confirm the lawful invoicing timing and tax treatment of historical
sales before issuing their document. Issuance never reposts inventory, payment,
accounting or the original sale.

Read operations require `sales.read`, issuance requires `sales.write`, and profile
changes require `settings.write`. APIs enforce subscription, Retail entitlement,
company membership and branch scope. A tenant cannot select or issue another
tenant's sale, even by sending foreign IDs or ownership fields.

## Current boundary

This is a domestic forward-charge template for itemized, already taxed Retail
sales. It does not add tax retrospectively to an untaxed receipt. Amount-only
quick sales and bills without historical tax snapshots are rejected. All-zero-tax
bills use their applicable receipt/bill-of-supply workflow.

Government IRN registration, signed IRP QR codes, statutory dynamic QR reporting,
GST return filing, e-way bills, export/SEZ endorsements, reverse-charge invoices,
cess and GST credit/debit notes are not implemented by this module. A normal UPI
QR is not a substitute for an IRP signed QR. Existing returns remain in the
authoritative Retail return/accounting flow; they do not create a statutory GST
credit note. Reprints preserve the originally issued invoice.

The template is not a government approval or a certification of a business's
tax compliance. Confirm legal applicability, classification, reporting and
signature/copy requirements before real issuance. Production provider and release
gates in the main release checklist remain separate from this module's tests.

## Primary sources reviewed on 9 October 2026

- [CBIC Rule 46: tax invoice particulars](https://taxinformation.cbic.gov.in/content-page/explore-rules/1000136/1000001)
- [CBIC Rule 48: invoice copies and electronic reporting](https://taxinformation.cbic.gov.in/content-page/explore-rules/1000139/1000001)
- [NIC domestic state codes](https://docs.ewaybillgst.gov.in/apidocs/state-code.html)
- [NIC master/UQC codes](https://docs.ewaybillgst.gov.in/apidocs/master-codes-list.html)
- [Government HSN digit requirement explanation](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=1708713&lang=2&reg=48)
- [Government GST rate reform announcement](https://www.pib.gov.in/PressNoteDetails.aspx?ModuleId=3&NoteId=155151&lang=1&reg=3)

A4 is the chosen print layout; these rules prescribe invoice particulars rather
than a government-branded A4 design.
