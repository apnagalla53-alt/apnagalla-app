# Website and demo activation verification

14 October 2026. Local implementation; no Git push or hosted deployment performed.

- Dedicated disposable localhost test DB: `evolix_activation_1791978578475_test`. Separate test administrators and a non-owner login without superuser/BYPASSRLS/CREATEDB/CREATEROLE were used. No production or application operator credentials were used for tests.
- **64 tests passed, 0 failed** across five targeted integration suites: activation campaigns (14), platform approval (8), website sessions (12), Google business onboarding (14), and account/referral/lifecycle regressions (16).
- Real HTTP and PostgreSQL checks include duplicate requests, concurrent redemption, final-slot contention, 30-day campaign grants, 60-day manual grants, zero fabricated revenue, unavailable codes, client field injection, owner authorization, platform-only campaign management, tenant isolation/RLS and rate limiting.
- Headed browser: website signup continued with a test-only Google boundary to the software. Saving the profile submitted the request; the code activated a trial; Start fresh opened a usable zero-record shop. Returning to the website login continued with the shared existing session. Auth tokens were not saved in website local storage.
- Website desktop 1440 px and mobile 390 px inspected. Sample tea quantity changed the total from ₹180 to ₹300. Hero, mobile CTA, responsive profile/pending screens and clear campaign feedback were checked. Synthetic preview data remains separate from shop data.
- Three production builds passed: Nest backend, TypeScript/Vite software, Astro website with 37 pages. No new website library was added.
- Production homepage JavaScript: three scripts total **1,164 gzip bytes** (header 364, demo 504, motion 296). This measures those scripts only, excluding CSS, fonts and assets; it is not a hosted load-time guarantee. Compiled signup contains the final production API/software origins.
- Private test helpers, browser fixtures and artifacts stay in ignored `output/activation-flow`; they are not application defaults or release source.
- Hosted Google, provider cutover and real customer traffic remain operator acceptance after manual publication and migration. Free Render can still sleep; timeouts allow wake-up but do not eliminate cold-start delay.

Publish order and administrator instructions: [local handoff](../WEBSITE_DEMO_ACTIVATION_HANDOFF.md).
