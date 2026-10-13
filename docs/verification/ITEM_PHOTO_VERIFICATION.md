# Add Item photo verification

Verified on 9 October 2026 (Asia/Kolkata).

## Delivered behavior

- Items / Stock → Add Item offers an optional Camera / Gallery photo.
- JPG, PNG and WebP are accepted, up to 5 MB. Local previews can be replaced or removed.
- Item creation uses the existing Retail facade. Photos use the existing tenant-scoped ITEM / ITEM_IMAGE attachment service.
- If the item saves but its photo upload fails, Retry Photo Upload reuses the saved item ID. Continue without photo is also available.
- Inventory displays a compact, lazy-loaded 44 px thumbnail. Item Details displays the photo alongside item information.
- Photo metadata and content remain private; no filesystem or unauthenticated storage URL is exposed.
- No database schema migration is required.

## Evidence

Headed Playwright CLI used a disposable QA tenant on ports 5174 / 8011 and database `evolix_phase8_browser_20261007_test`.

Passed: local preview, Camera capture input, Gallery selection, invalid file type rejection, 5 MB limit, remove/reselect, real item creation, simulated HTTP 503 upload failure, successful retry, exactly one item creation, inventory thumbnail, persistence after reload, item detail deep-link reload, and save without a photo.

Inventory and Item Details had no horizontal overflow at 360×800, 390×844 and 412×915. Protected content returned 200 to the authorized owner, 401 without authentication and 403 for unauthorized company scope. A physical phone camera was not used; its native file-input capture option was verified.

- `output/playwright/item-photo/UPLOAD_QA.json`
- `output/playwright/item-photo/PERSISTENCE_QA.json`
- Screenshots in `output/playwright/item-photo/`

API regression: `retail-flow.e2e-spec.ts`, `retail-field-coverage.e2e-spec.ts`, `attachments.e2e-spec.ts`: **34 passed, 0 failed, exit 0**.

An initial dashboard test failure occurred after Indian midnight because POS fixture documents used the UTC date. Fixtures now use one captured Indian business date, with the dashboard filtered to that same date. No dashboard production behavior was changed.

Builds: backend `npx tsc --noEmit` / `npm run build` and frontend `npx tsc -b` / `npm run build`: **exit 0**.

Local preview uses the rebuilt backend and current frontend. `http://localhost:5173/retail/items/add` and `http://localhost:8010/api/v1/health/ready` both returned **200**. The temporary QA runtime and its headed browser session were stopped.
