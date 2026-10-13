# Retail UX modernization — pre-change audit

All 26 supplied ZIP screenshots were extracted and inspected individually before implementation. Four additional Inventory, Add Stock, Unit and Category screenshots were subsequently supplied and reviewed individually: 30 references in total. Reference logos/artwork are not used in EVOLIX.

| Reference Screenshot | Reference Screen | Reference Interaction | EVOLIX Equivalent | Gap / Planned Change |
|---|---|---|---|---|
| WhatsApp Image 2026-10-06 at 8.22.40 PM (1).jpeg | Account settings | Categorized tappable rows, theme/device/help/logout | More / settings | Keep categories, improve common row targets |
| WhatsApp Image 2026-10-06 at 8.22.40 PM.jpeg | Home light | Quick cards, date chips, summary carousel, events/UPI | Home | Eight discoverable quick workflows, summary hierarchy |
| WhatsApp Image 2026-10-06 at 8.22.41 PM (1).jpeg | Drawer middle | Large icon rows and deep module discovery | Navigation drawer | Expose all implemented modules |
| WhatsApp Image 2026-10-06 at 8.22.41 PM.jpeg | Account top | Identity, backup, documents, business, plan cards | More | Categorized account cards |
| WhatsApp Image 2026-10-06 at 8.22.42 PM (1).jpeg | Reports summary | Date chips and expandable real totals | Reports | Cards plus common filter sheet |
| WhatsApp Image 2026-10-06 at 8.22.42 PM (2).jpeg | Report discovery | Categorized business/financial cards | Reports | Expose available reports; no fabricated financial pages |
| WhatsApp Image 2026-10-06 at 8.22.42 PM.jpeg | Home dark | Readable dark cards and date selection | Home dark | Elevated neutral theme |
| WhatsApp Image 2026-10-06 at 8.22.43 PM (1).jpeg | Drawer top | Dashboard/Galla/parties/sales/purchases | Navigation drawer | Module groups |
| WhatsApp Image 2026-10-06 at 8.22.43 PM (2).jpeg | Supplier details | Credit choices and optional grouped fields | Supplier form | Sheets and progressive fields |
| WhatsApp Image 2026-10-06 at 8.22.43 PM.jpeg | Reports empty | Clear zero-period summaries | Reports | Real empty/data/error states |
| WhatsApp Image 2026-10-06 at 8.22.44 PM.jpeg | Add supplier | Two supplier types, primary name/phone | Supplier form | Direct choices, optional phone retained |
| WhatsApp Image 2026-10-06 at 8.22.47 PM (1).jpeg | Customer list | Search, due summary, party cards | Khata | Customer/supplier tabs and actions |
| WhatsApp Image 2026-10-06 at 8.22.47 PM.jpeg | Supplier empty | Search/filter, icon, add action | Suppliers | Useful empty and sheet actions |
| WhatsApp Image 2026-10-06 at 8.22.48 PM (1).jpeg | Payment header | Dedicated supplier payment, full/partial | Party payment | Searchable party and direct payment choices |
| WhatsApp Image 2026-10-06 at 8.22.48 PM.jpeg | Supplier payment | Method cards, proof actions, note, CTA | Party payment | Remove redundant native method selector |
| WhatsApp Image 2026-10-06 at 8.22.49 PM (1).jpeg | Add purchase | Supplier/source and cash/credit choices | Purchase form | Workflow tabs, supplier/item sheets |
| WhatsApp Image 2026-10-06 at 8.22.49 PM (2).jpeg | Invoice lower | Dates, direct payment/channel, photos | Make Bill | Keep POS, sheet selectors, clear details |
| WhatsApp Image 2026-10-06 at 8.22.49 PM.jpeg | Purchase lower | Dates, bill number, image, note, CTA | Purchase form | Grouped fields and sticky save |
| WhatsApp Image 2026-10-06 at 8.22.50 PM (1).jpeg | Udhar sale | Customer, amount/date/due, channel, proof | Udhar | Searchable party, direct channels |
| WhatsApp Image 2026-10-06 at 8.22.50 PM.jpeg | Invoice top | Customer/item selection and workflow tabs | Make Bill | Visible quick/udhar/history workflows |
| WhatsApp Image 2026-10-06 at 8.22.51 PM (1).jpeg | Owner expense history | Type switch, summaries/search/filters | Expenses | Filter sheet and card actions |
| WhatsApp Image 2026-10-06 at 8.22.51 PM (2).jpeg | Private Home | Hide financial totals, retain structure | Home | Preserve privacy control |
| WhatsApp Image 2026-10-06 at 8.22.51 PM.jpeg | Quick cash sale | Compact amount, payment buttons, optional customer | Quick Sale | Direct method and customer sheet |
| WhatsApp Image 2026-10-06 at 8.22.52 PM (1).jpeg | Record expense | Category, amount/date, methods, proof | Add Expense | Category sheet and grouped CTA |
| WhatsApp Image 2026-10-06 at 8.22.52 PM.jpeg | Home lower | UPI setup and supplier reminders | Home / Calendar | Real shortcuts without fake reminder counts |
| WhatsApp Image 2026-10-06 at 8.22.53 PM.jpeg | Business expense history | Summary, search/filter, empty state | Expenses | Filter sheet and action cards |

## Full Retail dropdown baseline

Additional reference steering received during implementation:

| Additional Screenshot | Reference Screen | Reference Interaction | EVOLIX Equivalent | Change |
|---|---|---|---|---|
| codex-clipboard-80f6fdcd-4f36-46b6-951c-fd545fb612e8.png | Inventory | Add / Inventory / Low tabs; Manage / Bulk; export, selection, search, filters, stock cards | Items / Stock | Working workflow tabs, selection/export, server catalog filters, stock cards |
| codex-clipboard-1a763c6b-a343-43d4-91c3-2200596d024f.png | Add Stock | Product / Service, name, unit/category, quantity/minimum, prices, description | Add Item | Direct type controls, category/unit sheets, persisted prices/threshold/description; services follow entitlement |
| codex-clipboard-3874869f-1bf0-423e-8572-e4a751fafa4c.png | Unit | Large scrollable unit rows in a sheet | Add Item / line configuration / purchase | Searchable unit sheet, selected state and keyboard control |
| codex-clipboard-840d6d94-95df-4462-834f-3dd383a2494f.png | Category | Search, icons and grouped choices | Add Item | Grouped searchable category sheet with custom category and clear action |

67 Retail TSX screens/components audited; 40 native select declarations in 20 files. A declaration inside a mapped form may produce many runtime controls.

| Screen | Field | Current Control | Planned New Control | Status |
|---|---|---|---|---|
| assistant/RetailAssistant.tsx | labelled inline selector | Native dropdown | SearchableSelectionSheet | PLANNED |
| billing/RetailLineConfigurator.tsx | "line-variant" | Native dropdown | SearchableSelectionSheet | PLANNED |
| billing/RetailLineConfigurator.tsx | "line-unit" | Native dropdown | SearchableSelectionSheet | PLANNED |
| billing/RetailLineConfigurator.tsx | "line-batch" | Native dropdown | SearchableSelectionSheet | PLANNED |
| billing/RetailNewBill.tsx | "invoice-channel" | Native dropdown | SegmentedControl | PLANNED |
| components/PaymentChoices.tsx | {id} | Native dropdown | SearchableSelectionSheet | PLANNED |
| components/PurchaseItemSearch.tsx | {id} | Native dropdown | SearchableSelectionSheet | PLANNED |
| components/SupplierVisitSettings.tsx | "edit-visit-cycle" | Native dropdown | SegmentedControl | PLANNED |
| imports/RetailImport.tsx | labelled inline selector | Native dropdown | SearchableSelectionSheet | PLANNED |
| imports/RetailImport.tsx | labelled inline selector | Native dropdown | SearchableSelectionSheet | PLANNED |
| imports/RetailImport.tsx | labelled inline selector | Native dropdown | SearchableSelectionSheet | PLANNED |
| reports/ReportAssistant.tsx | labelled inline selector | Native dropdown | SearchableSelectionSheet | PLANNED |
| reports/ReportAssistant.tsx | labelled inline selector | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailAddExpense.tsx | "expense-category" | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailAddItem.tsx | "item-kind" | Native dropdown | SegmentedControl | PLANNED |
| RetailAddItem.tsx | "selling-mode" | Native dropdown | SegmentedControl | PLANNED |
| RetailAddItem.tsx | "item-unit" | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailAddItem.tsx | "item-gst" | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailAddPurchase.tsx | "purchase-mode" | Native dropdown | SegmentedControl | PLANNED |
| RetailAddPurchase.tsx | "purchase-supplier" | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailAddPurchase.tsx | {'purchase-variant-' + index} | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailAddPurchase.tsx | {'purchase-unit-' + index} | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailAddPurchase.tsx | "purchase-category" | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailAmountSale.tsx | "amount-sale-customer" | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailAmountSale.tsx | "amount-sale-channel" | Native dropdown | SegmentedControl | PLANNED |
| RetailExpenses.tsx | "expenses-category" | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailItemDetail.tsx | "component-add" | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailNeeds.tsx | "need-filter" | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailNeeds.tsx | {'need-status-'+n.id} | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailNeeds.tsx | "need-source" | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailNeeds.tsx | "need-customer" | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailNeeds.tsx | "need-supplier" | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailNeeds.tsx | "need-priority" | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailPartyForm.tsx | "supplier-visit-cycle" | Native dropdown | SegmentedControl | PLANNED |
| RetailPartyForm.tsx | "supplier-category" | Native dropdown | SearchableSelectionSheet | PLANNED |
| RetailPartyPayment.tsx | "party-payment-party" | Native dropdown | SearchableSelectionSheet | PLANNED |
| settings/RetailDocuments.tsx | "documents-category" | Native dropdown | SearchableSelectionSheet | PLANNED |
| settings/RetailStockLocations.tsx | "location-branch" | Native dropdown | SearchableSelectionSheet | PLANNED |
| settings/RetailVoiceSettings.tsx | "greeting-language" | Native dropdown | SegmentedControl | PLANNED |
| settings/RetailVoiceSettings.tsx | "greeting-speed" | Native dropdown | SearchableSelectionSheet | PLANNED |

Backend engines, validation, tenant context and pricing/posting rules are retained. Missing unsupported reference capabilities are not added as decorative controls.
