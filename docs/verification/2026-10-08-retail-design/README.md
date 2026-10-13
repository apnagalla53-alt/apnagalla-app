# Retail design refresh — 8 October 2026

User-selected scope: Home, Items, Stock and Expenses, including item and expense forms. Light mode remains the default, with warm white surfaces, restrained green accents, consistent icons and readable controls. Existing Retail facade/core behavior and all advanced item fields are retained.

## Changes

- Home has four primary actions, compact customer-payment and Daily Galla shortcuts and real period summaries. After the user's follow-up, the shop-tool grid moved into a global top-left hamburger drawer. All 16 existing tool links remain available there, with Home, Daily Galla, Calendar and All settings & tools bringing the menu to 20 links. Long business names have a two-line visual limit with the complete name available in the title and accessibility tree.
- Items and Stock have explicit loaded-result counts, full-catalog search, stock status and keyboard-accessible item rows. Stock has one set of Inventory / Low Stock / Out of Stock controls, a Buy Stock action and expandable help for uncounted items.
- Add Item groups basic details and opening stock, then exposes all existing identification, unit, cost, tax, variant, batch, serial and warranty fields through More Details. Every field has an associated label.
- Expenses separates business spending and owner withdrawals, retains real totals/filtering/pagination and improves history rows. Add Expense groups amount/category, payment, date/recipient, notes and bill image. Cash, UPI, Card and Bank use the existing shared payment controls.
- The shared photo picker now hides its native upload inputs correctly, gives them accessible labels, and has consistent Retail styling for camera, gallery and image previews. Upload/retry behavior remains intact.

## Verification

| Check | Actual result |
| --- | --- |
| Frontend `npx tsc --noEmit` | Exit 0 |
| Frontend `npm run build` | Exit 0 |
| Existing headed Chromium browser tests | 23 distinct cases passed; 0 unresolved failures |
| Screen/viewport inspections | 24 passed: six screens at 360×800, 390×844, 412×915 and 1280×900 |
| Accessibility scans | 18 scans, zero WCAG 2 A/AA and 2.1 AA violations reported: six screens in light, dark and large-text modes |
| Layout | No horizontal overflow or off-screen fields/buttons detected; desktop content width limited to 760px |
| API readiness | `/api/v1/health/ready` returned `ready` |

The initial 20-case run had 19 passes and one test-selector failure: the lifecycle test selected every `select` on Add Expense. Adding the labeled Payment Method selector made that locator ambiguous. The test now uses `getByLabel('Category', {exact:true})`. A four-case corrective run passed the full lifecycle, field/photo coverage, price-only stock and purchase/Home workflows. Three further existing manual acceptance cases passed real low/out stock filtering, the exact Daily Galla cash example, and Home period/privacy/deep-link/keyboard behavior. Repeated cases are counted once; the final distinct count is 23.

The wider accessibility inspection found unlabeled native photo inputs. Those were fixed and all 18 scans rerun successfully. Automated accessibility scans do not replace assistive-technology or physical-device acceptance.

## Local evidence

Sanitized machine-readable results: [results.json](results.json).

Ignored local artifacts are under `output/playwright/`:

- `retail-design-home-final-390.png`, `retail-design-home-final-1280.png`, `retail-design-home-full.png`.
- `retail-design-items-390.png`, `retail-design-stock-390.png`, `retail-design-items-add-390.png`.
- `retail-design-expenses-390.png`, `retail-design-expenses-add-390.png`.
- Corresponding screenshots at 360, 412 and 1280 pixels, plus dark and large-text screenshots.
- Headed traces/videos, initial/corrective result reports and the final manual acceptance report.

Tests used the existing disposable browser PostgreSQL database and real local API. No production data reset or deployment was performed. Backend migrations/engines were not changed or re-audited as part of this UI-only work. Previously documented provider, release and production-readiness gates remain separate requirements.

## Top-left navigation drawer follow-up

The user requested that the icons/options shown in the Home tool grid move into a left sidebar opened by a three-line icon. `RetailNavigationDrawer` is now part of the Retail shell, so it is available on every Retail route. The light drawer groups all tools, highlights the current route and provides a close button. The native modal traps focus, restores focus to the trigger, closes with Escape or backdrop click, and closes after link selection. The existing centered Bill/bottom navigation remains.

Four affected existing headed test cases passed after a corrective rerun: full Retail lifecycle, held-bill/cart recovery, Home/menu/catalog search and the core accessibility pass. The first run found a real stacked-sticky-header obstruction over Resume. Only the menu toolbar now uses sticky positioning; module headers scroll normally. A pre-existing Held Bills timestamp mismatch was also corrected to use the API's actual `created_at` field rather than the missing `held_at` field.

The drawer passed six additional layout/keyboard/accessibility inspections: 360, 390, 412 and 1280 pixels in light mode, plus dark and large-text modes at 390. Each had 20 links, zero reported accessibility violations, no horizontal drawer overflow, working focus containment/return, Escape and backdrop closure. All 24 underlying screen/viewport checks were rerun successfully after adding the toolbar. Frontend typecheck/build again exited 0.

Drawer evidence: [drawer-results.json](drawer-results.json), with local screenshots `output/playwright/retail-drawer-390-light-comfortable.png` and `output/playwright/retail-home-with-menu-390.png`. The follow-up cases overlap the earlier 23; do not add them as distinct new tests.
