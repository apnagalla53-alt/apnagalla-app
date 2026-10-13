# Import existing shop data

Onboarding offers **Import my existing data** or **Start fresh**, with a durable choice. Owners can revisit Import Data in the shop drawer. Initial migration focuses on items, customers, suppliers, opening stock and opening dues. The existing import engine remains authoritative; inventory and accounting posting rules still apply.

The wizard offers source presets, including Vyapar and Tally, plus generic field mapping. It accepts supported CSV, TSV, XLS, XLSX, ODS, JSON and XML shapes; this does not mean every possible proprietary file or export layout is understood. Review source guides, choose the data kind, map columns, inspect validation and explicitly confirm before writing. Unsupported or ambiguous data must be corrected, not guessed.

Duplicate handling and row fingerprints protect retries. Validation errors are visible per row. Opening stock and dues use the existing posting services, not direct stock projection mutation. Import jobs preserve source preset, file fingerprint, configuration, row results and audit history within the tenant.

Export business data from the previous software using its supported report/export controls. Import a small sample first, reconcile counts and balances, then migrate the remaining data. Keep the source exports and a verified database backup through acceptance. Platform operators can inspect bounded import job summaries; raw private files are not made public.
