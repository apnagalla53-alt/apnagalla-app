# Multi-business, footwear and automobile service implementation

## Architecture inspection before implementation

- Organization.business_type is an optional string used by onboarding, provisioning and the central auth/business-types and business-presets catalog. AUTOMOTIVE is the existing repair key; today it aliases AUTO_PARTS. It must be retained, with legacy repair spellings resolved centrally. Existing users must not repeat onboarding.
- Onboarding creates the business through TenantProvisioningService in an atomic operation and stores a resumable profile in User.onboarding_data. AccountSessionGuard, owner membership and state checks protect it.
- Retail account subscription and Daily Partner read the central preset. Primary defaults are strongest; category/item configuration takes precedence. Additional activities can add suggestions but cannot enable paid capabilities.
- RetailAddItem and InlineEntitySheet already preserve local form drafts. Category is optional text on Item and is listed from saved items. It is not a Brand registry. There is no existing first-class Brand. A company-scoped registry and nullable Item reference are needed for reusable, unambiguous inline Brand selection without overloading Category.
- ItemVariant and ItemCompositionService.setupVariants already provide tenant-scoped combinations, inherited selling prices, explicit variant prices and stock through ordinary purchases and POS. VARIANTS is checked by feature guards. Contextual size UI exists but currently requires visiting the saved item; the new footwear entry must collect sizes/colours before save and call that same service atomically.
- Universal units are tenant scoped with shared named suggestions. SERVICE items already exist and POS explicitly excludes them from physical stock. Quick Bill candidates are transient until a successful shared RetailBillingService transaction; quotes roll back all transient rows. The candidate DTO currently accepts only piece/weight/length, so service candidates need an explicit validated kind with the existing SERVICE model.
- Quick Bill and detailed Bill share RetailNewBill and BillStore. Shared RetailPayment quotes/saves through the existing server pricing and POS, handles Cash/UPI/Udhar/split, receiving accounts, retry/idempotency and bill discount. The service workspace will compose these components on one page rather than introduce payment/tax engines.
- POS posts inventory and shared accounting; purchases, returns, COGS, customer/supplier Khata and Daily Galla remain authoritative. No service-workspace code may write stock or fabricate cost. Brand must not influence posting.
- AuthGuard, PermissionGuard, FeatureGuard, subscription entitlements and company-scoped Prisma/RLS protect existing APIs. New brand writes must require inventory.write; service billing retains sales permissions and Retail POS access. No tenant IDs or operator accounts belong in feature logic/tests.

## Additive schema implemented

Retain business_type as primary; add additional_business_types default [] on Organization. Add company-scoped ItemBrand and nullable Item.brand_id. Existing items, stock, invoices and ledger data remain unchanged. Rollback should revert app code while retaining additive schema and saved metadata; do not drop populated brand data or rewrite history.

## Verification scope

All automated mutations use the existing dedicated disposable localhost database ending `_test` and synthetic owners. No production accounts, migrations, hosting changes or Git publication are authorized by this request. Backups of current source are local under output/multi-business-20261020/before; unrelated work is preserved.

## Completed validation

237 automated tests pass (100 backend acceptance/regression, 59 backend unit and 78 frontend unit). Both production builds and backend typechecking pass. Real local browser flows save multiple activities with one primary, brand/size/colour item creation and shared service payment at ₹1,870. Screenshots cover mobile/laptop and light/dark; primary selection styling was repaired after visual review. See [strict implementation report](verification/MULTI_BUSINESS_IMPLEMENTATION_20261020.md) for every PASS field, the migration, evidence and deployment limitations. No Git publication or production changes were performed.
