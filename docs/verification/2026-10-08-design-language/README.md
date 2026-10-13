# Design handoff, languages, customer context and greeting verification

## Changes

- Added i18next/react-i18next, local Hindi resources, English fallback, device preference and React subscriptions across Retail copy.
- Added the Settings language controls and prominent Payment voice greeting entry.
- Preserved Khata customer context for New Bill and checkout, with validated deep-link reload/error/retry behavior.
- Removed bottom More; added language, greeting, import, security, policies, billing and logout access in the grouped shop sidebar.
- Defaulted previously unconfigured shops to an enabled thank-you greeting; explicit saved off is respected. Actual received amount gates checkout playback.
- Prepared a source-backed 106-route Figma handoff, conditional panel inventory and 14 financial report variants.

No database schema change or destructive migration was required. Existing dirty-worktree changes were preserved. No production deployment was performed.

## Build evidence

Backend `npx tsc --noEmit` and `npm run build` exited 0. Frontend `npx tsc -b` and `npm run build` exited 0. Final logs are in ignored scratchpad files `design-backend-build.log`, `design-final-types.log` and `design-final-build.log`.

## API regression

The complete 19-file E2E run had **387 passed / 1 failed out of 388**. The failure was the previous test expecting the unconfigured greeting to be disabled. That expectation was updated for the intentional default behavior, with additional explicit-off persistence and tenant-isolation assertions.

The affected `calendar-price-only.e2e-spec.ts` was rerun: **17 passed, 0 failed, exit 0**. Combined latest evidence therefore passes all **388 distinct API cases**. This is a full initial run plus targeted recheck, not a claim of a second full 388-case run. The initial attempt against an outdated disposable database failed during setup and is excluded from product test counts.

## Headed browser regression

The 18-case run across Retail smoke, field coverage and improvements had **13 passed / 5 failed**. Failures used the old five-tab bottom navigation expectations. Tests now expect four tabs and assert required sidebar destinations rather than a brittle fixed link count.

The six-case improvements recheck had **5 passed / 1 failed**; the remaining assertion still expected the previous fixed sidebar count. After updating it, the affected sidebar case passed: **1 passed, 0 failed, exit 0**. All **18 distinct browser cases** have passing latest evidence. Do not sum reruns as extra distinct tests.

Machine-readable evidence is under `output/playwright/design-handoff/`: `REGRESSION_INITIAL.json`, `REGRESSION_RECHECK1.json`, `REGRESSION_FINAL.json` and `QA_RESULTS.json`.

## Additional CLI-driven headed acceptance

The visible Chrome session verified:

1. Khata -> New Bill retains the selected customer.
2. Valid customer deep-link reload resolves correctly.
3. Checkout retains that customer.
4. An actual cash bill posts successfully.
5. Real browser speech synthesis requests one greeting and emits a `start` event, without substituting a mock speech engine.
6. Hindi changes immediately and persists on reload.
7. SPA language switching preserves draft lines and business values.
8. Custom Hindi greeting persists; English preset is restored afterward.
9. Four bottom tabs, no bottom More and centered Bill; required sidebar tools are available.
10. Invalid customer resolution blocks checkout; a valid Khata entry recovers.

The PDF capture walkthrough is read-only except for normal demo fixture creation and the separately tested cash bill. Route captures are visual reference evidence, not a full functional re-test of every displayed page. Device-specific voice quality and all translated technical copy remain separate QA concerns.
