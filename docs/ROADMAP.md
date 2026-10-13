# ROADMAP

PHASE 5.6 — VERIFIED LOCALLY — 8 October 2026

Universal moving weighted-average costing, immutable COGS/profit, original-cost returns,
financial reports and coverage remain the authoritative basis for profit answers.
Evidence and Phase 5.6 acceptance criteria: [Phase 5.6 verification](verification/PHASE_5_6_VERIFICATION.md).
Unknown legacy costs remain visible without historical backfill or fabricated profit.
The owner has now explicitly authorized deterministic Business Insight V1.5; it consumes
these services without adding a second profit engine. See [V1.5 verification](verification/ASSISTANT_V1_5_REPORT.md).

The phase labels below are historical. For the current 7 October 2026 implementation,
test evidence and outstanding production gates, read
[PRODUCTION_COMPLETION_REPORT.md](verification/PRODUCTION_COMPLETION_REPORT.md) and
[Retail improvements verification](verification/2026-10-07-retail-improvements/README.md).
The latest owner-authorized Retail usability work does not start another business engine
or authorize deployment. Owner acceptance is in [MANUAL_TEST_PLAN.md](MANUAL_TEST_PLAN.md).

PHASE 1 — VERIFIED
Billing
Items
Customer Khata
Customer payments

PHASE 2 — IN VERIFICATION
Suppliers
Purchases
Supplier Khata
Need List

PHASE 3 — PLANNED
Expenses

PHASE 4 — PLANNED
POS completion/polish

PHASE 5 — PLANNED
Reports

ASSISTANT V1 — VERIFIED LOCALLY — 8 October 2026

In-app deterministic read-only query layer over existing Retail/reporting,
Galla, Khata, stock and subscription facades. 50 intents; 511 curated phrases.
Platform intent library, examples, operational analytics and audited human
unknown-phrase approval are implemented. Additive migration chain: 27/27.
Evidence: [Assistant acceptance report](verification/ASSISTANT_V1_REPORT.md).
Final unit 1,030/1,030; PostgreSQL E2E 291/291; headed browser 6/6; typechecks,
builds and Prisma checks pass. Load 85/85 requests succeed; 50-concurrent
processing P50 is 192.31 ms, above the 150 ms engineering target.
Pilot language/latency/large-data behavior remains to be measured. Wider product
production/provider/Android approval is separate. STOP for review: no WhatsApp,
LLM, voice, write actions, autonomous workflows or deployment started.

## EVOLIX Assistant V1.5 — Business Insight

The authorized V1.5 extension adds deterministic sales, profit, margin, COGS, cash,
expense, purchase, customer/supplier, inventory-signal, return, staff, health and
weekday comparisons. It uses the existing router, permissions, tenant context and
response card. It makes zero external LLM calls. Verification status and any scoped
limitations are recorded in [ASSISTANT_V1_5_REPORT.md](verification/ASSISTANT_V1_5_REPORT.md).
Final local evidence: 1,294 backend unit tests, 382 PostgreSQL E2E tests and 7 headed
Assistant browser tests passed; Prisma and both production builds passed. The
disposable 10/25/50 request bursts succeeded for both simple and diagnosis reads;
diagnosis latency rises to about 541 ms processing P50 at 50 concurrent requests,
so this is not a sustained-load capacity claim. No later Assistant, WhatsApp, voice
or autonomous-action phase is started here.

## Retail UX modernization — review checkpoint (8 October 2026)

Implemented the shared mobile controls and migrated the major Retail workflows; see `verification/RETAIL_UX_MODERNIZATION.md` for screen/dropdown/reference matrices, actual test counts and boundaries. Stock filtering/search/custom categories remain tenant-scoped; inventory/POS/accounting posting engines are preserved. The manual guide has 114 checks. Builds and 292 backend E2E / 1,030 unit / 65 distinct headed browser scenarios passed after repairs and reruns. Stop for review; native/provider/recovery checks and documented volume/transfer boundaries remain separate release gates. No automatic deployment or new business phase.

## Master account and Platform control plane — review checkpoint (9 October 2026)

Public mobile/Google account flows, durable business setup, three-plan request/trial
selection, import/fresh onboarding, referrals and guarded Platform account/tenant
controls use the existing engines. Archive/restore preserves history; permanent
deletion is disabled by default and has retention/legal/recovery gates plus durable
local attachment erasure. See [final acceptance matrix](verification/PLATFORM_CONTROL_PLANE_VERIFICATION.md).

Final local regression: 1,294 unit, 508 PostgreSQL API and 97 complete headed browser
tests passed with zero failures. Both typechecks/builds and all 34 migrations pass.
Live Google/SMS/SMTP, offsite recovery, Docker/staging and physical-device acceptance
remain launch gates. Stop for review; no deployment or next phase started.
