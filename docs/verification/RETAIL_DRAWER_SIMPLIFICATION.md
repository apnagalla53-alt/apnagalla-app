# Retail drawer verification — 9 October 2026

The owner-approved drawer has five direct destinations (Home, Make Bill, GST
Invoices, Inventory and Khata), six accordion groups, and a visible Logout.
One group opens at a time. Opening the menu expands and scrolls to the active
child. Module headers now expose the menu; Profile remains in Business & Staff.

| Requirement | Result |
|---|---|
| Previously visible rows | 41, or 42 with Stock Locations enabled |
| New collapsed rows | 12: five direct links, six groups, Logout |
| Accordion groups | 6 |
| Distinct action icons | 45, plus six distinct group icons |
| Removed routes / features | 0 / 0 |
| Retained previous URLs | 41 of 41; existing About page also linked |
| GST direct access / active child / single open group | PASS |
| Permissions / disabled features / empty group filtering | PASS |
| English / Hindi / light / dark | PASS |
| 360×800 / 390×844 / 412×915, no horizontal overflow | PASS |
| Keyboard, Escape, focus returned to trigger | PASS |
| Drawer WCAG 2 A/AA and 2.1 AA automated violations | 0 |
| Frontend typecheck / production build | PASS, exit 0 |

Repeated icons were replaced with purpose-specific Lucide glyphs: Tags for
Items, Boxes for Stock, TriangleAlert for Low Stock; ReceiptText for billing,
History for bill history, Bookmark for held bills; BanknoteArrowDown/Up for
customer collections/supplier payments; Calculator for Galla, ChartNoAxesCombined
for reports, MessageCircle for Ask EVOLIX, Warehouse for stock locations.

Final evidence contains **131 checks passed, zero final failures**: 47 headed
visual/interaction checks, 41 browser destination visits, 16 configuration
checks, 18 security/layout UI checks and nine real API authorization denials.
Staff and Locations were exercised with real platform overrides in a disposable
tenant. Disabled inventory removes its entire empty menu group. Overrides were
restored after the checks. No backend authorization rules were changed for this
drawer work.

Evidence: `output/playwright/stitch/drawer/visual-results.json`,
`navigation-results.json`, `contract-results.json`, `security-ui-*.json`,
`security-fixture.json`, `security-api-inventory-off.json`, and the English/Hindi
screenshots/contact sheets in that directory. Build logs are ignored under
`scratchpad/drawer-frontend-build.log` and `drawer-typecheck.log`.

This verifies the drawer scope. It does not certify the whole Retail migration:
the earlier 97-test headed regression run had 52 passes and 45 failures which
remain separately tracked. No deployment was performed.

**EVOLIX RETAIL DRAWER SIMPLIFICATION VERIFIED**
