# Apna Galla — website and software release, 16 October 2026

Destination: `main` in the separate `apnagalla53-alt/apnagalla-app` and `apnagalla53-alt/apnagalla-website` GitHub repositories, as requested by the owner. The original legacy development repository is not the publication destination.

## Website changes

- Primary **Create account & get demo** calls to action replace the old request-access journey, including mobile access.
- Shared signup/sign-in connects to the software account and redirects to `app.apnagalla.in`; returning visitors can resume the API session.
- A three-step explanation covers account creation, shop details and activation. No payment card is required for the demo request.
- Interactive sample billing, stock, customer/supplier Khata and cash/UPI panels share one browser-only sample ledger. Sample receipts, quantities, collections and supplier payments reconcile; samples never create real business data.
- Lightweight reveal/hover motion, keyboard-accessible demo tabs and reduced-motion support. No new animation library was added.

## Software changes

- **Business-aware Quick Bill:** search existing items or type a new name, quantity, unit and price directly in the bill. Successful bill posting creates the minimal item atomically; drafts, previews and failed bills do not create junk catalog items. Amount-only sales remain available.
- **Safe retry and honest data:** repeated payment requests do not duplicate the item, bill or accounting posting. Unknown stock and cost remain unknown, with no fabricated opening stock or margin.
- **Eight business presets:** Kirana, Pharmacy, Hardware, Garments, Footwear, Stationery, Electronics and Restaurant personalize units, wording, relevant questions and recommendations.
- **Simpler Add Item:** essential name/price/unit first; optional Category and secondary fields move into Additional Details. Applicable size, batch/expiry or serial/warranty questions appear contextually.
- **Sizes and colours:** optional garment/footwear combinations use the existing variant engine, default to the item price, support explicit variant prices and retain each variant's stock.
- **Buy/sell units and prices:** shared pack conversion supports strip/tablet, roll/metre, box/packet and pack/piece. Pack prices can differ from the multiplied single-unit price; pharmacy ₹12/tablet and ₹110/strip reconcile against one stock balance.
- **Zero-setup and faster entry:** create items, customers, suppliers and categories in the relevant work flow; retain drafts; bulk/CSV/spreadsheet and reviewed intake drafts reduce repeated forms. Invoice OCR/voice capabilities still depend on their configured worker/browser/provider support.
- **Personalized Home and Daily Partner:** first-work actions for new shops, editable entitled Quick Access for Smart/Pro, recent/frequent billing items, and at most three actionable suggestions from real saved business data, with explanations and snooze/dismiss.
- **Navigation and assistant:** Home · Items · + · Khata · AI Assistant, floating round assistant across screens, one-click home access and supplier shortcuts. Opening assistance preserves the current transaction.
- **Appearance and branding:** approved light/dark design, workflow colours, semantic positive/destructive actions, clearer notifications, mobile touch layouts and enlarged-text fixes. Apna Galla name/logo are used for the software, favicon and installable web-app identity.
- **Staff and usability:** phone-number staff login, minimum eight-character staff passwords without forced character mixtures, show-password controls, persistent staff sessions and existing revocation/security controls. Udhar visibility and notification opt-in behavior were improved.
- **Signup and activation:** saving shop details submits the initial activation request automatically. Platform administrators choose the actual plan and 30/60-day or custom complimentary duration. Eligible campaign codes can activate configured trials automatically; ordinary referrals do not grant access themselves.
- **Accounting and access boundaries:** existing Galla, Khata, supplier payable, stock, costing, tax and returns services are reused. Business presets do not unlock paid capabilities; operator credentials, existing shops and customer data are preserved.

## Verification

- **225 distinct software automated tests passed:** the 177 documented Quick Bill/accounting/configured-item tests plus 48 additional activation, approval, shared-session and universal-intake tests.
- **12 website sample-ledger tests passed.** Website scripts also pass strict TypeScript checking.
- Fresh lockfile installs and production builds pass in the app release checkout. Prisma schema validation passes. The website production build generates all 37 pages.
- Eight real business-type first-bill browser scenarios pass. Mobile layout/accessibility checks pass in 24 combinations; eight additional checks cover navigation labels, candidate reachability and assistant/payment clearance.
- Detailed feature results and honest limitations: [business-aware Quick Bill report](APNA_GALLA_BUSINESS_QUICK_BILL_20261016.md).
- Local fixtures, credentials, operator handoffs, uploads, database backups, generated builds and browser traces are excluded from the release. No automated test used the operator account or the user's eight empty demo shops.

These are local/synthetic-data verification results, not a guarantee of perfection or a new certification of the live deployment.

## Safe Git publication and live rollout

The release commits include `[skip netlify]` and, for the API repository, `[skip render]`. These per-commit markers hold automatic hosting rollout without changing provider account settings. Provider documentation: [Netlify deploy skipping](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/) and [Render deploy skipping](https://render.com/docs/deploys#skipping-an-auto-deploy).

Before manually deploying the backend, confirm/apply these migrations through the authorized migration connection and the existing deployment process:

1. `20261014110000_activation_campaigns` — activation campaigns/redemptions and their access boundaries.
2. `20261015140000_item_unit_selling_price` — optional authoritative selling price on existing unit conversions.

This Git publication does not apply either migration to the live database, alter production credentials or deploy the hosting services. Verify backup/recovery and migration status first, apply existing runtime grants for new tables, deploy the backend and verify readiness, then deploy the software frontend and website. Do not reset a populated database. A later push without the skip markers can trigger automatic deployment again.

Remaining limitations include device-only drafts for new candidates, existing configured-item entry for new area/volume products, optional infrastructure-dependent OCR/voice features, and the main JavaScript bundle size advisory. There is no new payment gateway. Real hosted OAuth and production performance require their own rollout verification.
