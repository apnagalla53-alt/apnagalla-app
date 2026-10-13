# Bringing an existing shop to EVOLIX

On an owner's first sign-in, choose **Import your data** or **Start fresh**. The choice is stored for that owner and business. Start fresh dismisses the guide; it never deletes records. Imports remain available under **More → Import your data**.

## Supported first migration

Import items, customers, suppliers, opening stock and opening customer/supplier dues. Historical bills, purchase vouchers, payment history and foreign accounting charts are not imported by this first migration. Do not treat an old software's full backup as an EVOLIX restore file.

| Format | Scope |
| --- | --- |
| CSV, TSV, TXT | Named tabular columns; comma, semicolon, tab or pipe separators; UTF-8 or UTF-16LE |
| XLS, XLSX, XLSM, XLSB, ODS | Select a worksheet and header row; macros are not executed |
| JSON, NDJSON | Flat records; JSON array or `rows`/`data`/master arrays |
| Tally XML/JSON masters | Stock items and ledgers directly under Sundry Debtors/Creditors; signed opening dues converted explicitly |
| PDF, photos, DAT, encrypted/proprietary backups | Unsupported for automatic posting; obtain a structured export |

Limits: 5 MiB upload, 10,000 records, 200 columns, 4,000 characters per value, header rows 1–50. Workbook archive expansion is bounded. XML document types/entities, ambiguous headers and unsafe object keys are rejected. Tally custom ledger groups need a tabular export or a separately verified adapter.

## Export from the previous app

Select a preset to see its guide: Vyapar, Tally, BUSY, Zoho Books, myBillBook or Other. Presets suggest aliases; they are not a guarantee that every version/vendor export is identical. Always review the actual columns.

- Vyapar: export item/party lists or their detailed reports as Excel/CSV. See the [official Excel inventory guidance](https://vyaparapp.in/free/inventory-management-software/excel).
- Tally: export stock-item and party-ledger masters. See [Export Data](https://help.tallysolutions.com/export-data/) and [sample XML](https://help.tallysolutions.com/sample-xml/). Voucher XML is outside this migration's scope.
- BUSY: use a structured item/party report export; see [official export guidance](https://busy.in/faqs/data-conversion/voucher-import-export/42/).
- Zoho Books: export the appropriate module as CSV/XLS; see [official module export instructions](https://www.zoho.com/ca/books/help/import-export/export.html).
- Other apps: use their documented item/customer/supplier export and map the fields in EVOLIX. Do not rename a proprietary backup to `.csv`.

Menus depend on the installed app version. Keep the source backup, export totals and cutover date until reconciliation is complete.

## Safe procedure

1. Pick one cutover date inside the selected open financial year. Stop entering opening transactions in both systems at that point.
2. Import items first. Map name, stable SKU/barcode/external ID, selling price and unit. Stock is optional; ordinary price-only items can start without counted stock.
3. If importing stock, supply its actual purchase cost, unit and intended location. EVOLIX does not substitute selling price for cost. Existing stock history prevents another opening-stock snapshot.
4. Import customers and suppliers with stable codes/IDs where possible. Opening customer dues post receivables; supplier dues post payables. Negative advances are rejected rather than silently reversing their meaning.
5. Preview. Correct mappings, defaults and invalid rows. Defaults apply only when no source column is selected. Revalidate changes before confirming.
6. Acknowledge unmapped columns explicitly. They remain in the source audit; they do not silently enter arbitrary live tables.
7. Confirm valid rows. Each row is a transaction through the Retail facade, authoritative inventory posting and double-entry accounting. A failed row rolls back its master/stock/accounting changes.
8. Compare imported counts, stock quantities/cost and receivable/payable totals against the source. Keep error rows and retry after correction.

Preview writes staging records only. Commits process 25 rows per call. Repeated commits skip existing source identities and matching SKU/party codes; they do not overwrite masters or duplicate opening balances. Files, mapping, sheet, header row and cutover date determine the review fingerprint. Use stable source identifiers: changing a source identifier can represent a different record.

Batch/expiry/serial/variant/bundle stock needs the existing receiving workflow and its required tracking details. This generic opening migration rejects incomplete advanced stock rather than fabricating batches or serials. Item and party migration is create-only; it is not an arbitrary update/import-to-any-table facility.

Owners can inspect paginated rows and the latest 30 jobs. Staff cannot access migration endpoints. All jobs, source identities, stock locations and commits are tenant scoped.

## Shop records copy and support follow-up

**Shop menu → Backup & Restore** separates Data Backup, plan-based Data Export, Pro Complete Business Export and Account exit & data portability. Starter includes item/stock exports plus the existing basic sales report export. Smart adds customer/supplier/Khata and business reports. Pro adds staff/location/document metadata and complete business records. All paid tiers have the same operator backup protection policy; provider/scheduling must actually be configured. An owner requesting account-exit portability can obtain core records on any plan without upgrading.

The complete tenant-scoped NDJSON copy includes inventory movements, invoices, accounting, configuration and migration history. Credentials and sessions are excluded; attachment storage paths are removed. Attachment bytes must be downloaded through authorized attachment screens. CSV downloads are explicit pages with a next-page action. See [Subscription entitlements](SUBSCRIPTION_ENTITLEMENTS.md) for implemented formats and limitations.

The UI creates an idempotent backup-request record before export. Platform Admin sees the business and requesting owner's contact details in **Alerts → Shop backup requests · follow-up queue** and can mark a follow-up completed. No call, WhatsApp or email is sent automatically. The owner sees that support was notified. `EXPORT_PREPARED` means the server prepared the stream, not that a file was saved on the user's device.

The export is live and paginated, not a consistent database snapshot or a complete disaster-recovery archive. The browser saves it only if its final `complete:true` marker is present. It cannot be restored using the opening-data importer. Operator backups and whole-database recovery remain separate; see [Disaster Recovery](DISASTER_RECOVERY.md). Shared-database selective tenant restore is not implemented.
