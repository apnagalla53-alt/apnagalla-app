# Retail UX release — 16 October 2026

The release includes the approved account, billing, UPI/GST, transaction recovery, bulk-item and simple-navigation changes described in `../APPROVED_RETAIL_UX_20261016.md` and `../QUICK_BILL_SIMPLE_NAVIGATION_REPORT_20261016.md`.

Fresh checks on the publication checkout passed: 95 API regressions against a disposable localhost `_test` database, 17 backend unit tests, 51 frontend unit tests, and both production builds. The earlier eight business-type browser journeys are documented in the Quick Bill report; physical phone keyboards, camera, sharing dialogs and printing still require device review. No production shop or financial transaction was created for acceptance tests.

Production migration inspection found all 37 migrations applied, with no pending, failed or checksum-mismatched migrations. This release adds no migration. Local operator identity, password hash and MFA material were verified unchanged.

Generated Vite/Prisma caches and previous build output were removed from explicit workspace-contained paths before rebuilding. No customer data, credentials, browser storage or draft recovery was cleared. Dependency and Playwright browser directories remain local and excluded from the publication repository.

Netlify page responses revalidate; content-hashed assets keep long-lived immutable caching. Release markers are generated from the actual build commit and served without browser caching. The notification/share service worker does not cache pages, JavaScript or API responses, so no destructive browser-storage purge is needed. Netlify invalidates changed static content on atomic publication: https://docs.netlify.com/build/caching/caching-overview/.

Rollout order: publish verified source, deploy the API from that source, verify readiness/version, then publish the matching frontend. The website is independently verified and deployable. Hosting status must be checked after publication; a successful Git push alone does not establish a successful deployment. Free-service cold starts remain a hosting limitation, and no paid hosting upgrade is included.
