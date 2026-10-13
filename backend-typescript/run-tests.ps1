npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx vitest run src/inventory/inventory.spec.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx vitest run src/purchase/posting.service.spec.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx vitest run src/accounting/accounting.spec.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx vitest run src/sales/sales.spec.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx vitest run -c vitest.config.e2e.ts test/security.e2e-spec.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
