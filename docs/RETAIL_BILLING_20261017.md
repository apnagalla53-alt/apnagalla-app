# Retail billing update — 17 October 2026

Quick Bill starts with an optional customer name. Leaving it blank uses the internal walk-in customer; that internal record is excluded from customer search. Newly typed names are saved only when the bill posts successfully.

Item-name search replaces the separate search bar. Quantity, price, unit dropdown and GST percentage remain together. GST and bill discount start at zero. Discounts support either rupees or percentage in one control. Explicit invoice GST does not change the item's saved tax rate; existing GST registration and plan checks remain enforced.

Added lines have compact controls and an EDIT action. A summary table lists item, quantity, price and amount. The payment screen groups the payable amount, discount, methods and complete server-calculated summary.

The calculator supports close/minimize and retains its expression and history within the same bill. Each new bill starts fresh. More opens bill details, item photo and service charge. Named service-charge presets can be saved, reused, auto-applied and removed per bill. Charges are non-stock service lines; positive GST requires a six-digit SAC.

Amount-only Sale is a separate Home shortcut rather than an anonymous line mixed into an itemized bill. Reports identify amount-only sales and service-charge totals without inventing purchase costs or stock quantities.

Home, reports and Daily Galla group UPI receipts by their saved receiving-account metadata, separating checkout payments from later Udhar collections. Editing a receiving profile does not reassign historical receipts. Older payments without receiving metadata stay under Account not recorded. These totals describe receipts; refunds remain separately reported.

Udhar WhatsApp drafts identify the individual bill, total, paid amount and remaining bill balance. Invoice PNG/PDF preparation supports device file sharing and downloads. The shopkeeper selects the recipient and sends the message. Existing print and GST invoice workflows remain available; ordinary receipt downloads do not bypass electronic-reporting requirements. Long image exports direct the user to Print invoice for a complete PDF.

Navigation search respects permissions and plans and accepts related terms such as UPI, QR, GST and khata.

## Migration and release order

Apply `20261017140000_receipt_receiving_snapshot` with the migration role before starting the new API. It adds only a nullable JSONB column to vouchers; existing customer records and operator credentials are preserved. Runtime database credentials do not need schema-owner rights. Verify the API release before publishing the matching frontend.

## Verification

The reviewed implementation passed both production builds, 68 frontend unit tests, 6 focused backend helper tests and 9 isolated API acceptance tests. Browser journeys checked billing, calculator reset/history, service-charge preferences, payment, account reports, navigation search and invoice downloads at mobile and laptop sizes. Tests used separately provisioned synthetic users in a disposable localhost `_test` database.
