# Website signup and demo activation — local handoff

Prepared 14 October 2026. Changes are local and have not been committed, pushed or deployed. Production data, existing shops and the application operator account were not modified.

## What the customer sees

1. `apnagalla.in` prominently offers **Create account & get demo**. The signup/login pages use the same API and identity as the software. A signed-in visitor continues straight to the software using its shared HttpOnly API cookie; the website does not store authentication tokens.
2. Google signup redirects through `app.apnagalla.in/auth/continue` to the saved onboarding step. Existing accounts retain their identity and records.
3. The owner saves their name, shop, mobile contact, category and address. Saving the profile automatically submits one activation request and opens **Your demo request is sent**. Reloads and concurrent retries do not duplicate this initial request.
4. The default requested demo plan is Smart. The platform administrator chooses the actual plan and duration. Pending access does not permit billing.
5. The waiting page accepts a referral or campaign code. An eligible activation campaign immediately grants its configured trial; an ordinary customer invitation only records a referral. It never grants access by itself.
6. The active owner chooses **Start fresh** or **Import existing data**, then enters the existing software. The waiting page checks approval every 30 seconds while visible; it also has a manual check button.

## Administrator controls

- **Platform → Organizations → Pending access → shop → Grant access**: select the plan, complimentary access, 30 or 60 days (or explicit custom duration), and an audit reason. No payment or revenue is invented.
- **Platform → Demo activation codes** (`/platform/activation-campaigns`): create a code such as `DEMO30`, choose Smart and 30 days, set its dates and optional maximum activations, supply an audit reason, and enable it. Share that code; each eligible account/shop gets its own duration starting when redeemed.
- Codes default to disabled until deliberately enabled. You can edit or disable them. Changes affect future redemptions, not the expiry of existing grants. Used codes cannot be renamed. `EVX-` is reserved for customer invitation codes.
- Campaign trials are restricted to completed owner profiles awaiting their first access decision. One campaign redemption per account and organization, 1–60 days, server-selected plan, bounded guessing, atomic usage limits and unique redemption records prevent repeat extensions and concurrent over-redemption. Disabled, future, expired, exhausted and invalid codes are rejected. Existing/expired/suspended/archived access cannot be replaced by a campaign.
- Existing referral rewards remain under Referral program. Account policy defaults apply to administrator-created trials; public trial self-activation is disabled for new signups.

## Website experience and performance

- Bright primary CTA, mobile sticky CTA, three-step explanation and accessible sample billing/khata/stock tabs. The examples are explicitly fictional and do not write any business records.
- Small CSS transitions and an IntersectionObserver reveal script; no animation package, video or new runtime dependency. Reduced-motion preferences are respected. Without JavaScript, the marketing content and signup links remain available.
- Google SDK loads only on account pages after consent for signup. Website and software account checks allow a sleeping Free Render service time to wake. This improves recovery from a cold start; it does not make Free compute continuously available.

## Manual publication order

1. Review and commit the app changes in **`D:\evolix-trade-erp\output\cloud-release\software`**, whose remote is `apnagalla53-alt/apnagalla-app` and branch is `main`. This checkout contains the reviewed changes without the original workspace's unrelated dirty files or private outputs. Do not blanket-push the original legacy repository.
2. Review and commit the website in **`D:\Apna galla`**. Its current branch is `codex/cloud-release-20261013` on `apnagalla53-alt/apnagalla-website`. The existing website Netlify project must deploy this updated branch, or a reviewed merge into its production `main`. Pushing a different branch alone does not update the main website.
3. Take a current Neon recovery checkpoint/backup, then apply **`20261014110000_activation_campaigns`** using the private `evolix_migrator` connection and `prisma migrate deploy`. Apply the existing runtime grants/default privileges from Phase B of `deploy/neon-roles.sql.example` to the new tables. Keep `evolix_runtime` as the API role. Do not reset the database, disable RLS, or put migration-owner credentials into Render.
4. Deploy the backend before the frontends. Keep the existing production security, Neon, Cloudinary and Google client settings. Update `APP_VERSION` to the actual release commit. Check `/api/v1/health/ready`.
5. Deploy software Netlify from the app repository `main`, then the existing website project from the reviewed website code. Both root `netlify.toml` files contain the public API/app origins. Keep all private credentials in Render.
6. Verify the real Google client allows exactly the intended `https://apnagalla.in` and `https://app.apnagalla.in` origins. Test the hosted signup → profile → pending approval → campaign/manual trial → software flow using isolated acceptance accounts. Do not use the personal-check shop or operator account for automated tests.

The new migration adds two tables and forced system-scoped RLS policies. It does not replace or delete customer tables. Existing campaigns start empty; no public universal trial code was seeded.

## Verification

The backend integration checks use a new disposable localhost database ending in `_test`, separately provisioned administrators and a restricted non-owner database role. Google/SMS boundaries are synthetic only inside these test fixtures; the hosted Google authorization is not simulated or changed.

Backend checks cover signup identity reuse, shared cookie session/CSRF behavior, profile validation and concurrency, automatic request idempotence, manual 30/60-day approval, campaign privileges and validation, no fabricated payments, concurrent one-use campaigns, inactive/expired trials, referral tracking, RLS and account-bound rate limiting.

The browser exercise confirmed website signup → software business profile → automatic pending request → campaign code → Start fresh → a zero-record shop, and returning website login → existing software session. Desktop/mobile preview and keyboard-accessible sample controls were checked. Backend, software and all 37 website pages build successfully. See the accompanying verification report for exact results.
