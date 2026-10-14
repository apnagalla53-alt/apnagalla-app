# Netlify + Render + Neon setup

Status on 13 October 2026: **hosting preparation, not a deployed or production-certified service**. For the current two-frontend deployment, use [the step-by-step website + software account setup](APNAGALLA_WEBSITE_AND_CLOUD_SETUP.md). Live Google authentication, cloud storage/recovery, SMTP, proxy/IP forwarding and monitoring still need staging verification. See [production deployment](PRODUCTION_DEPLOYMENT.md), [security remediation](verification/SECURITY_REMEDIATION_20261012.md) and [onboarding results](verification/GOOGLE_BUSINESS_ONBOARDING_20261012.md).

## Architecture

Website `https://apnagalla.in` and software `https://app.apnagalla.in` → shared `https://api.apnagalla.in` Render API → Neon PostgreSQL. Both frontends use the same API-host session cookie. Private photos use authorized storage; database archives use a separate encrypted backup bucket. Neon holds relational data, not the photo files. Keep Secure/HttpOnly/SameSite Strict cookies and CSRF enforcement; leave `RETAIL_COOKIE_DOMAIN` unset.

Do not pair a direct `https://...onrender.com` API with `https://...netlify.app` frontends and expect Strict cookies to work across those different sites. The current configuration builds both software API variables with `https://api.apnagalla.in`, and website `PUBLIC_API_URL` uses that same origin. An optional `/api/*` proxy remains before the software SPA fallback; the chosen clients use the central custom domain directly. [Netlify proxy documentation](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/).

## 1. Prepare accounts and a reviewed release

Create/sign in to your own Netlify, Render and Neon accounts and connect the private GitHub repository. The local checkout contains extensive uncommitted/untracked work; the current remote branch is not proof that these changes are published. Review the release, exclude ignored secrets/test artifacts and commit/push it before provider builds. Do not publish local `.env`, archives, operator credentials, uploads, test traces or database dumps.

Start with a dedicated staging environment and synthetic shop data. Choose a nearby compatible region for API/database where available; then measure actual shop latency. The agreed production names are `apnagalla.in`, `app.apnagalla.in` and `api.apnagalla.in`. Staging also needs consistently configured same-site HTTPS origins, frontend builds and Google client settings.

Use fresh cloud-only credentials. Never copy the shared local PostgreSQL administrator or an old test password. The historical shared local DBA exposure still requires separate owner-led rotation without changing other projects from this task. Revoke the Google client secret exposed earlier; this app's Google ID-token flow does not need a client secret.

## 2. Create the Neon database and roles

Create a dedicated project/database for staging. Use a separate production project/branch when promoting, with an agreed data migration plan; do not copy QA bills into customer production.

Create `evolix_migrator` and `evolix_runtime` using **SQL** and the Phase A statements in [the role template](../deploy/neon-roles.sql.example). Neon-created Console/CLI/API roles receive privileged `neon_superuser` membership; a SQL-created runtime role must instead receive explicit limited grants. [Neon's official role documentation](https://github.com/neondatabase/website/blob/main/content/docs/manage/roles.md).

The template deliberately contains no password. In a private interactive administrator `psql` session, run `\password evolix_migrator` and `\password evolix_runtime`; enter different password-manager-generated values. Store the runtime URL only in Render's backend secrets. Store the migration URL only in the operator/CI migration job. Never give runtime membership in the migration/database-owner role.

Use Neon's **direct TLS connection** for the initial staging API and migrations, with separate users. This avoids introducing an unverified pooler while validating transaction-scoped RLS. Size Prisma's connection limit to the selected database capacity. A pooled runtime connection may be adopted after explicitly testing scoped concurrent transactions and rate-limit locks through that pooler; migrations/recovery still use the direct operator connection. The app is on Prisma **5.22**, so do not copy a Prisma 7/8 upgrade into this deployment. [Neon's Prisma documentation](https://github.com/neondatabase/website/blob/main/content/docs/guides/prisma.md).

The current schema uses `DATABASE_URL`. For a migration job, inject the direct **migrator** URL as its DATABASE_URL. For the API, inject the direct **runtime** URL. No owner/direct migration URL needs to exist in the API's environment.

## 3. Apply migrations once, separately from the API

Use an authorized CI/operator runner with Node 24, the reviewed source and the pinned lockfile. From `backend-typescript`, with the intended direct migration connection injected privately:

```sh
npm ci
npx prisma generate
npx prisma validate
npx prisma migrate deploy
npx prisma migrate status
```

Alternatively build/run `backend-typescript/Dockerfile.migrations` with the migration URL in that job only. Never run `migrate reset` or `db push --accept-data-loss`. Do not put migration credentials into the Render API just to run its pre-deploy command. The runtime image omits Prisma's development CLI; it must not download an unpinned tool at startup.

After deploy, execute the template's Phase B grants as the migration owner. Recheck the runtime role's flags, memberships, table ownership and forced RLS. All 35 migrations must be applied before API startup. For a populated release, verify a pre-migration backup and check locks/duration on realistic staging data.

## 4. Deploy the Render backend to staging

Use a paid, continuously available Web Service for retail counter use. Render documents idle shutdown, temporary filesystem storage and unavailable SMTP ports on Free services; Free is for demo/testing, not this production workload. [Render Free limitations](https://render.com/docs/free).

The active repository-root [Render template](../render.yaml) specifies native Node, `backend-typescript` root, manual deployments, a paid persistent disk and `/api/v1/health/ready`. Creating a paid service requires your chosen billing plan. [The older Docker template](../deploy/render.yaml.example) remains an alternative; its images have not been built in this local environment. Neither configuration has deployed a service.

Use `PORT=8010` with this image because its internal Docker health check uses that port. Render routes the service using its PORT setting. The Nest API already listens on that port without a localhost-only binding. For a native Node deployment instead, build with `npm ci --include=dev && npx prisma generate && npm run build` and start `npm run start:prod`; separately supply a compatible `pg_dump`/`pg_restore` runtime before claiming backups work.

Backend environment values:

| Setting | Value/source |
|---|---|
| NODE_ENV | production, including staging to exercise the real security gates |
| DATABASE_URL | TLS Neon runtime connection only |
| JWT_SECRET / PLATFORM_JWT_SECRET | Separate fresh random values, minimum 48 characters |
| MFA_ENCRYPTION_KEY | Fresh random 32-byte base64 key; preserve separately for recovery |
| FRONTEND_ORIGIN / PUBLIC_APP_URL | `https://app.apnagalla.in` |
| WEBSITE_ORIGIN | `https://apnagalla.in` |
| API_ORIGIN | `https://api.apnagalla.in` |
| APP_VERSION | Reviewed immutable Git commit/release ID |
| TRUSTED_PROXY_CIDRS | Actual verified ingress addresses; never `true`, `*`, all private networks or all internet |
| GOOGLE_CLIENT_ID | Public Web OAuth client ID after registering the frontend origin |
| STORAGE_PROVIDER / S3_* | Private S3-compatible configuration verified with the existing adapter |
| AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY | Scoped bucket credentials in Render secrets if workload identity is unavailable |
| BACKUP_PROVIDER / BACKUP_* | Encrypted offsite configuration; `none` means not configured and blocks customer release |
| EMAIL_PROVIDER / SMTP_* | Verified TLS SMTP recovery; `none` blocks recovery readiness |
| SMS_PROVIDER | none unless actual Twilio delivery is configured/tested |
| ANDROID_APP_ENABLED | false for this web-only release |

Full inventory: `backend-typescript/.env.production.example`. Do not set production bootstrap passwords or disable Platform MFA. Verify incoming Origin, cookies, forwarded client IP and CSRF through the real Netlify/Render path; do not blindly trust X-Forwarded-For. Until trusted ingress is measured, conservative defaults can count clients under one proxy IP and are not a release sign-off.

## 5. Deploy the Netlify frontend

Use the active repository-root [Netlify configuration](../netlify.toml). It sets base `frontend`, publish `dist`, Node 24, a lockfile build, API routing, deep-link fallback and security headers for the agreed domains. Import the separate website repository as a second Netlify project using its own root configuration. Preparing these files has not triggered a deployment.

Set both software API URL variables to `https://api.apnagalla.in`; set the website's `PUBLIC_API_URL` to that origin too. Remove conflicting Netlify dashboard settings. No database passwords, JWT/MFA keys, SMTP/storage credentials or Google client secret belong in browser build variables. Build the exact reviewed release and configure custom domains/HTTPS before shared-login acceptance.

Netlify's base/publish settings are relative to the configured base directory. [Official build settings](https://docs.netlify.com/build/configure-builds/overview/). Keep static hashed assets cacheable, HTML revalidated, and actual API responses `Cache-Control: no-store`; verify no authenticated response is cached or served to another account. An API 404 must remain a JSON/API 404, not `index.html`.

## 6. Google and the first Super Admin

Register the **exact frontend HTTPS origin** on the Google Web OAuth client, not a `/login` path or a guessed backend origin. Keep testing accounts allowed until the consent app's intended audience is configured. Revoke the previously exposed client secret. Follow [the project Google guide](GOOGLE_LOGIN_SETUP.md).

For a fresh empty installation only, run `node scripts/create-platform-admin.cjs` once in a private interactive operator terminal against the intended database. It refuses to replace an existing operator. Preserve the current operator's identity/password during any authorized data migration; do not use that account for staging tests. Enroll production MFA and preserve recovery codes privately. No owner database URL belongs in a customer browser.

Create a fresh Google shop and verify Profile → Smart → data choice → real manual approval or configured trial → Home. Confirm an Import choice opens the real importer, and returning Google login skips setup. Keep public signup/trials as explicit Platform policy decisions; selecting a plan is still not automatic payment.

## 7. Files, backups, monitoring and promotion

Keep buckets private and restrict upload/download through existing authorized API routes. The current S3 adapter requests AWS server-side encryption, so validate actual provider compatibility instead of assuming every S3-style service works. A paid persistent disk is an alternative only with a separately verified attachment backup/recovery procedure; an ephemeral Render folder cannot hold customer photos.

For database archives, provision the private backup bucket, retention, encryption key, schedule and alerts. Run the real backup command in a separately authorized scheduler environment and restore into a disposable target. Match the PostgreSQL client/server versions. Do not inject an owner URL into the API to solve backup privileges. The existing command uses the application context and production role gates; validate archive permissions and the chosen job identity before enabling scheduling. Neon recovery/PITR depends on its configured plan and retention and is additional to the verified app recovery plan, not a substitute for missing photo backups.

Verify both `/api/v1/health` and `/api/v1/health/ready`, uptime alerts, error logs/request IDs, database/storage alerts, backup freshness and recovery. Then run [the release checklist](RELEASE_CHECKLIST.md) on the exact HTTPS deployment: real Google, logout/CSRF, Platform MFA/approval, fresh tenant, isolation, stock/accounting, duplicate checkout, invoice/UPI, imports, photos and mobile widths. Test slow/network interruptions and large requests through Netlify's proxy limit. Record actual PASS/FAIL evidence and retain the previous compatible artifact and pre-migration backup before opening to paying customers.

No cloud account was created, no DNS/secret was changed, no Git push was performed, and nothing was deployed by this preparation.
