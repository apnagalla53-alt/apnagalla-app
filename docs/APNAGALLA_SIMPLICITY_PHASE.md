# APNA GALLA SIMPLICITY PHASE

Local implementation, 15 October 2026. No commit/push or production database changes. The application operator account and existing customer data remain untouched. All mutating checks used separately provisioned owners on a disposable localhost `_test` database.

## Implemented

- Item billing is primary. Quick Bill remains an amount-only secondary action. Locked navigation follows the latest brief: Home / Bill / Items / Khata / More.
- Central Business Presets cover the existing business catalog through shared families, recommending units, categories, prompts, quick actions, suggestion priority and intake ordering. Existing explicit settings and current entitlements win.
- A first item bill can begin without inventory setup. Add & Sell creates a minimal untracked item inline and keeps entered quantity. Inline customer creation keeps the payment screen and records real Udhar through the existing billing engine.
- Buy Stock keeps quantity/cost while creating an item or supplier inline. Pack conversion is explicit. Parent forms stay mounted; bill/purchase/Add Many drafts survive reasonable interruption within the scoped eight-hour session window. Files require reselection where the browser cannot retain them.
- Add Item starts with name, selling price, recommended category/unit choices and optional counted stock. Purchase cost, tax, MRP and advanced tracking stay progressively disclosed. Blank cost/stock is not fabricated as zero. Add Many supports 50 simple items with per-row feedback and authoritative atomic creation.
- Home uses actual activity: NEW has no sales/purchases; LEARNING has activity below 20 posted sales; ACTIVE starts at 20 posted sales. New shops see optional Getting Started and useful first actions. Active shops see today's recorded summary, at most three deterministic suggestions and Ask Apna Galla.
- Suggestions use saved held bills, cash count mismatch, expiry, fast-selling low stock, real party dues, buying needs and unknown-cost facts. They include Why and an action. Ordinary suggestions can be snoozed for seven days; unresolved critical risks remain. Suggestions do not assert unsupported causes or fake overdue dates.
- Ask Apna Galla keeps the existing scoped tool/report engine, structured result cards, evidence/ranked drivers and follow-ups. Insufficient-history answers remain explicit. Expired batches are excluded at the assistant's sellable-stock query boundary, while ALL stock reports keep their original meaning.
- Shared light/dark tokens, semantic workflow banners, readable disabled controls, inline sheets, adaptive Home cards and a compact storefront header reuse the same component tree.
- Fixed-vocabulary, numeric-only optional events and scoped 30-day metrics do not collect names, queries, documents, phone numbers or raw transcripts. Time to first item comes from the actual item-creation audit; time to first bill comes from the posted invoice.

## Accounting and authorization

Creation, opening stock, purchase posting, bill posting, Khata, inventory value and COGS still use the authoritative Retail/Inventory/Accounting services. Idempotency, transaction rollback, company/branch boundaries, permissions, current subscription and Shop Feature checks remain active. Business Presets do not enable paid or disabled features. No historical stock/cost backfill was performed.

## Verification

See [combined verification](verification/APNA_GALLA_EXPERIENCE_20261015.md). Across focused runs, 240 distinct backend tests and seven unit tests passed, with zero unresolved failures. The final changed intake/simplicity suites passed 24/24; a supplementary matching test checked Hindi vowel marks and conflicting SKU/barcode matches. Builds and TypeScript checks passed.

Actual browser flows covered first cash bill, inline customer/payment presentation, supplier/item purchase creation, retained quantities/cost, draft reload, sell/buy pack conversion, Home states and assistant data. The light/dark/mobile/100–200% text matrix passed 32/32 scoped accessibility/layout checks, followed by category search/selected-state checks.

Local warm Vite navigation including network-idle wait: Home 1,704 ms; Bill 1,189 ms. Five authenticated synthetic-catalog search requests: 74, 61, 60, 64, 59 ms (median 61 ms). These are local desktop measurements, not cold mobile/network benchmarks. The production initial JS remains about 500 kB minified / 156 kB gzip, with an existing chunk-size warning. No new heavy animation dependency or browser OCR library was added.

Unassisted shopkeeper testing, native mobile keyboard behavior and production-device/network timing remain field checks. No overall ZERO-SETUP EXPERIENCE VERIFIED claim is made from scripted local tests alone.
