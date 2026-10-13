# Apna Galla Google business onboarding — 12 October 2026

Implemented the requested combined business profile before subscription and data choice, using the existing green design and universal Retail provisioning, session, RLS and entitlement systems. No separate category application, restaurant KOT, payment gateway, fake OTP or automatic payment confirmation was added. Existing business databases and other projects were not modified by this verification. No deployment was performed.

## Verification boundary

The following PASS results describe the application verified on fresh disposable PostgreSQL databases and headed Chrome. Google account UI/identity transport was replaced only inside isolated test modules/browser fixtures, never production code. The real official Google library separately verified disposable RSA-signed credentials, including signature, audience, issuer, expiry, nonce, verified email and display-name extraction. This is not a live Google consent/sign-in certification. The phrase “APNA GALLA GOOGLE ONBOARDING VERIFIED” is therefore withheld until a real staging Google account completes the flow.

Live Google user: **FAIL / unverified — not exercised with an actual Google account**. SMS OTP, reverse geocoding, online payment checkout and Pro voice remain unconfigured; their absence is described accurately in the UI. Manual address, unverified mobile contact and authorized trial/manual access work without those services.

## Google onboarding

| Check | Result | Evidence |
|---|---|---|
| New Google user | PASS at application boundary | Verified-name field supplied by test identity; one profile screen before plans |
| Existing completed user | PASS at application boundary | Headed re-login opens Home; no onboarding request or screen |
| Resume | PASS | Reload at Plan, Migration and Pending; sign-out/re-login resumes Plan |
| Repeat Google signup/login | PASS | Same user and business; corrected profile name retained |

## Business profile

| Check | Result | Behavior |
|---|---|---|
| Owner Name | PASS | Signed Google name prefilled; editable, trimmed, required, 255-character maximum |
| Shop Name | PASS | Blank initially, required, independent of owner and brand; editable |
| Mobile | PASS | +91 server normalization; invalid numbers rejected; unverified contact, no OTP call |
| Duplicate mobile | PASS | Normalized collision and concurrent two-account contention rejected; no merge |
| Business Type | PASS | Required stable key; full-height sheet with grouped icon rows |
| Address | PASS | Required multiline field; optional structured fields; persisted country India |
| Use My Location | PASS for permission/fallback | Real browser granted and denied permission; manual address remains usable; automatic address lookup not connected |
| Back/Edit | PASS | Corrected shop/category/mobile saved while preserving identities and defaults |
| Loading/error/keyboard/touch | PASS | Visible errors, busy controls, Escape, selected state/focus return, 48px controls |

## Business categories

Total categories: **59**, across Food & daily needs, Health & personal care, Fashion, Electronics, Home/hardware/construction, Automotive, General retail, Services and Other.

| Check | Result |
|---|---|
| Search | PASS — grocery, medical, garments, hardware, electrical, cosmetics, mobile, sanitary, optical, other |
| Hardware aliases | PASS — Hardware, Electrical & Light Fittings, Tools & Fasteners |
| Other/custom | PASS — optional description saved under OTHER |
| Selected state | PASS — check/pressed state, selection retained when reopened |
| No matches | PASS — useful empty state with Choose Other |
| Entitlement boundary | PASS — recommendations recorded as metadata; zero fabricated tenant entitlement overrides |

## Subscription

| Check | Result |
|---|---|
| Starter ₹75 | PASS — backend price/key, correct card and CTA |
| Smart ₹120 | PASS — backend price/key, correct card and CTA |
| Smart Most Popular | PASS — subtle emphasis, vertically stacked cards |
| Pro ₹210 | PASS — backend price/key, correct card and CTA |
| Voice Pro-only | PASS for truthful presentation — Pro-only; voice service explicitly not connected |
| Trial | PASS — only explicitly configured Smart 7-day test policy grants real TRIAL dates/access |
| Manual approval | PASS — actual authorized Platform HTTP action grants complimentary access with audit; no payment invented |
| Pending payment/access | PASS — paid-plan selection cannot enter Retail until actual activation |

## Migration

| Check | Result | Evidence |
|---|---|---|
| Start Fresh | PASS | Saved while pending; real approval/check opens Home |
| Import Existing | PASS | Saved while pending; approval refreshes tenant-admin session and opens importer |
| Real import | PASS | Smart trial → CSV upload → actual mapping/validation/preview → commit → summary → Home |
| Correct database posting | PASS | Imported item ONBOARD-SADDLE had real opening stock 5 and purchase cost 60 |
| Supported formats only | PASS | Existing parser supports CSV/TSV/XLSX/XLS/ODS/JSON/XML; no direct app connection claim |

Paid-plan path: Google → Profile → Choose Smart → Data choice → **Access pending** → real Super Admin activation → Home/Importer. The extra pending state is intentional because online payment checkout is not configured. Trial path: Google → Profile → configured Smart trial → Data choice → Home/Importer. Selecting a plan is not proof of payment.

## Duplication safety

| Record | Duplicates |
|---|---:|
| Users | 0 |
| Tenants | 0 |
| Shops/companies | 0 |
| Default branches | 0 |
| Default stock locations | 0 |
| Financial years/configuration | 0 |
| Subscriptions | 0 |
| Default expense categories | 0 — exactly ten |

Three concurrent profile saves returned the same organization/company. Two distinct accounts competing for the same phone produced one success and one 409. Retry, refresh, repeat Google callback/login and Back/Edit preserved one set of internal structures. Each genuine first-time business contains Rent, Electricity, Transport, Wages / Salary, Packaging, Repairs & Maintenance, Shop Supplies, Internet / Mobile, Delivery / Freight and Other once.

## Final flow and test totals

**Google → Business Profile → Subscription → Migration → Retail Home: PASS at the application/test-provider boundary. Live Google provider: unverified.**

| Check | Passed | Failed | Exit |
|---|---:|---:|---:|
| Backend unit regression, 36 suites | 1,302 | 0 | 0 |
| Focused real PostgreSQL HTTP regression, 6 suites | 136 | 0 | 0 |
| Headed Chrome onboarding acceptance | 7 | 0 | 0 |
| Total unique final assertions | **1,445** | **0** | **0** |

The 14 new restricted-runtime-role API cases cover validation, concurrent provisioning, unverified mobile, duplicate contention, resume, prices, pending access, editing, trial, returning login and Import activation. Other focused suites cover account/referral/OTP, Platform approvals/payments, control-plane security, password/session lifecycle and import/report posting. Test-only MFA override is limited to NODE_ENV=test; production enforcement is unchanged.

All 35 migrations deployed and migrate status reported up to date on clean disposable databases. Backend and frontend TypeScript checks and production builds exited 0. Headed mobile sizes: 360×800, 390×844, 412×915; desktop: 1440×900. Checked full-height category sheet, keyboard/focus, grouped search, stacked plans, manual/GPS address, resume, manual activation and a real import. Browser failure artifacts and private credentials remain ignored. Test-only databases/uploads and preview processes were removed afterward.

Initial test iterations caught stale test tokens after session replacement, a wrong test origin, a browser permission-context setup error, and an incorrect role-name assertion. Those test fixtures were corrected. A real UI issue—stale owner permissions after manual activation—was fixed by refreshing the authorized session before entering Retail. Final counts above are the passing reruns, not a sum of repeated attempts.

Local evidence: `scratchpad/google-onboarding-unit-20261012.log`, `scratchpad/google-onboarding-api-20261012.log`, `scratchpad/google-onboarding-browser.log`; screenshots/traces in ignored `output/playwright/`. Reproduction helpers in ignored scratchpad create only generated localhost `_test` databases and use separate maintenance/runtime credentials. Runnable assertions are `backend-typescript/test/google-business-onboarding.e2e-spec.ts` and `frontend/tests/google-business-onboarding.spec.ts`; backend startup never loads the browser test provider.

## Live acceptance still required

Use the production code on the correct staging HTTPS origin and a real allowed Google account. Verify Google consent/nonce callback, signed credential acceptance, displayed owner name, blank shop name, Profile → Smart request → real manual approval (or configured trial) → Fresh → Home, and a returning login without onboarding. Repeat on signed Android once its native OAuth client/signing certificate is configured. Do not turn off identity verification or Platform MFA to complete live acceptance. Existing security/deployment blockers in SECURITY_REMEDIATION_20261012.md remain a separate release gate.
