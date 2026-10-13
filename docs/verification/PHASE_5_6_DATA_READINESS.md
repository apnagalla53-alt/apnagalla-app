# Phase 5.6 data readiness — pre-implementation audit

Audit date: 8 October 2026. The working tree contains extensive uncommitted work from earlier phases; retain it. This audit does not rely on earlier PASS declarations.

| Capability | Current model/service | Cost data exists? | Historical snapshot? | Gap | Action |
|---|---|---|---|---|---|
| Opening stock | OpeningStockService / OpeningStockLine | Rate, default zero in Retail | Quantity/unit only | Missing and zero indistinguishable; floating point valuation | Nullable explicit opening cost; Decimal; audited correction |
| Purchase | PurchaseService / PurchaseInvoiceLine / GRN | Retail normalized rate and taxable value | Entered quantity, conversion, GST | No cost projection; GRN can precede known invoice price | Receipt snapshot; unknown unpriced GRN; single WAC projection |
| Purchase return | PurchaseReturnLine / purchase PostingService | Return rate | Unit snapshots | No acquisition-cost linkage | Link original receipt; never use current item price |
| Sale | PosService and sales PostingService | Movement rate zero | Quantity, pricing, GST, dimensions | No sale-time COGS | Immutable movement and line COGS in same transaction |
| Sale return | SalesReturnLine / POS | Return sales price or zero | Original line, quantities | Original COGS absent | Original movement cost reversal; legacy remains unknown |
| Variant | ItemVariant / stock identity | Master purchase rate | Variant ID | Master cost is not historical cost | Separate company/item/variant pool |
| Multi-unit | ItemUnitConversion | Purchase base rate | Direct-to-base factor | No weighted-average valuation | Use authoritative base quantity and snapped factor |
| Weight | Decimal quantity / selling mode | Receipt rate | Base quantity | No COGS | Preserve configured base unit |
| Length | Decimal quantity / conversion | Receipt rate | Base quantity | No COGS | Same base-quantity engine |
| Area | Purchase/POS dimensions | Effective receipt rate | Dimensions and measured base quantity | No COGS | Cost snapped measured quantity; do not remeasure history |
| Batch | ItemBatch / FEFO allocations | Receipt master rate | Allocations | Physical FEFO confused with cost | Company/item/variant WAC; immutable lot receipt costs |
| Serial | ItemSerial / SerialAllocation | Purchase line rate | Selected serial and warranty | No acquisition/cost snapshot | Receipt movement preserves acquisition; WAC at sale |
| Bundle | ItemCompositionService / bundle_snapshot | Component quantities | Composition | No component costs | Attribute component movements to sold line, snap costs |
| Service | Item SERVICE / POS | No authoritative direct cost | Revenue | Revenue cannot be claimed as profit | Separate service revenue and incomplete direct-cost warning |
| Godown transfer | StockTransferService | None | Physical movements | Value missing | Company-wide pool unchanged by paired transfers |
| Discount | PricingEngineService / POS | Actual taxable value | Pricing trace, line discount | No profit allocation | Use saved net taxable line revenue; deterministic bill allocation if applicable |
| Tax | GST snapshots / Input GST / Output GST | Separately posted | Tax rate, HSN and amounts | No valuation rule | Recoverable Input GST excluded; Output GST excluded from revenue |
| Additional purchase charges | PurchaseInvoice.landed_cost_amount | Field only | No Retail allocation workflow | No authoritative allocation | Reject unsupported landed-cost posting until validated allocation exists |
| Expenses | Expense / accounting PostingService | Actual posted amount | Type and payment | No authoritative profit report | Business expenses only; drawings and supplier settlement excluded |

## Severity and architecture decisions

CRITICAL: historical COGS absent; unknown opening cost fabricated as zero; return valuation not tied to original sale. HIGH: quantity-only inventory projection, purchase expense ledger unsuitable for perpetual inventory, no COGS journal, service profit would be misleading. MEDIUM: no financial report surfaces or deterministic profit tools; cost correction and reconciliation missing.

Use the existing inventory item locks and transaction client. Add one company/item/variant weighted-average pool and immutable cost fields to canonical movements, sale and return lines. Locations and lots remain physical dimensions; company-wide WAC avoids artificial transfer profit. Existing quantities at migration are unknown, and legacy sales remain unknown. Known value in a mixed unknown pool is proportionally depleted; every sale from that pool remains UNKNOWN until its quantity reaches zero or an explicitly audited remaining-stock valuation establishes cost. Do not rewrite old sale snapshots.

Reports use saved sale/return facts and posted business expenses. Revenue-weighted coverage uses absolute revenue from sold product lines, with line-count fallback for zero-revenue sales. Show service revenue separately; absent direct service cost prevents claiming a complete business profit.

No implementation or readiness claim is made by this document. Required database lifecycle, regression and browser evidence must be recorded after implementation.
