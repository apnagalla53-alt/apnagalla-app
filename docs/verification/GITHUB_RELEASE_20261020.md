# GitHub release preparation — 20 October 2026

This change set contains the previously reviewed multi-business selection, footwear brand/variant entry, automobile service billing, and responsive first-tap bill/Udhaar fixes. Only the explicit feature manifests were copied into the verified apnagalla53-alt/apnagalla-app publication checkout. Each existing file's original baseline matched that checkout; unrelated local edits, credentials, database dumps, recordings, caches and video projects are excluded.

The implementation reports in this commit document the local verification performed before this Git publication request. Their statements that the feature had not yet been committed/pushed refer to that earlier verification point.

## Production rollout order

This Git push does not migrate the live database. The release commit deliberately uses [skip netlify] and [skip render] so the schema-dependent frontend cannot be published before the backend. Render's checked-in configuration also disables automatic deployment.

1. Apply migration `20261020100000_business_activities_brands` using the established direct migration-role procedure. Preserve existing accounts, records and transactions; do not reset the database.
2. Apply the established runtime-role grants for the new `item_brands` table and verify company-scoped access.
3. Deploy this backend revision and check readiness and existing-tenant compatibility.
4. Deploy this frontend revision and check onboarding, normal billing, Khata and service/footwear flows.

Rollback application revisions if needed while retaining the additive columns/table and saved brand metadata. This push alone is not evidence that production is updated or that Android/Play Store publication has occurred.

## Publication-checkout verification

- Prisma client generation and backend production build.
- Frontend unit suite and production build.
- Focused backend unit regressions and multi-business/local-billing e2e regressions.
- Database-mutating tests are restricted to the dedicated disposable localhost database ending `_test`, with synthetic tenant owners. Operator access is preserved.

The local check reports are retained under `output/push-20261020/`; output artifacts are not committed.

Final publication-checkout result: **175 tests passed, 0 failed** (87 frontend unit, 59 backend unit, 29 backend acceptance). Both production builds and Prisma generation passed. The first acceptance attempt could not write its synthetic fixture output in the clean checkout; after creating that ignored test-only directory, all 29 acceptance tests passed without changing application code.
