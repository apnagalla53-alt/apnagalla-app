# Apna Galla: website, shared login and cloud setup

Prepared 13 October 2026. **Code and local verification are complete for this connection; the services are not live.** Cloud accounts, a reviewed Git release, DNS, Google settings, private production secrets and staging acceptance remain necessary. Local tests do not certify the hosted deployment.

## What you are setting up

| Address | Purpose | Provider |
|---|---|---|
| `https://apnagalla.in` | Public website, signup and sign-in | Netlify website project |
| `https://app.apnagalla.in` | Retail software and Platform panel | Separate Netlify software project |
| `https://api.apnagalla.in` | Shared authentication and business API | Render |
| Private PostgreSQL connection | Accounts, organizations and business records | Neon |
| Private authenticated assets | Item and business document photos | Cloudinary |

Website signup saves into the software database. Website login redirects to `https://app.apnagalla.in/auth/continue`; the software retrieves the existing session and opens onboarding or the shop. A returning customer does not create another account or sign in twice.

Both frontends call the same HTTPS API. The API sets a host-only Secure/HttpOnly/SameSite Strict session cookie. Leave `RETAIL_COOKIE_DOMAIN` unset for this deployment. Tokens are not passed in redirect URLs or persisted in browser local storage. The website and software origins are explicitly allowed; cookie writes still need the existing origin/CSRF protections.

The source folders are:

- Software development folder: `D:\evolix-trade-erp`; reviewed deployment source is published to `apnagalla53-alt/apnagalla-app` without old history or personal downloads.
- Website: `D:\Apna galla`, repository `apnagalla53-alt/apnagalla-website`; Astro is inside `marketing-site`.

## 1. Create the accounts

1. Sign in to [GitHub](https://github.com/) with access to both repositories. Keep source and deployment credentials private. Use `main` in the new app repository, and reviewed website branch `codex/cloud-release-20261013` when available.
2. Create a [Neon account](https://console.neon.tech/). Create a project named `apna-galla-staging` first; choose a region compatible with your Render region. Confirm PostgreSQL version compatibility before migrating existing data.
3. Create a [Render account](https://dashboard.render.com/). Connect the software repository. The supplied template selects a paid Starter service in Singapore, without a persistent disk; check the displayed price before creating it.
4. Use your existing [Netlify account](https://app.netlify.com/) and the existing website project already serving `apnagalla.in`. Connect its reviewed website branch. Create one additional Netlify project for the software; do not replace the existing website's domain ownership/settings.
5. Open GoDaddy DNS management for `apnagalla.in`. Preserve the existing Netlify apex/`www` records, email MX records and unrelated DNS records. Add only the required new `app` and `api` records after their provider targets are known.
6. Create a [Cloudinary account](https://console.cloudinary.com/) for this project. Store its API secret only in Render's secret environment; follow the private photo setup below.

The working software checkout contains extensive uncommitted work. Review and publish the intended release to GitHub before importing it into the providers. Never commit `.env`, private test reports, operator handoffs, uploads, database dumps or credentials. No Git push or cloud service creation was performed by this setup.

## 2. Prepare Neon safely

Use separate database identities: a migration owner for schema changes and a restricted runtime user for the API. The API deliberately refuses privileged roles or application-table ownership in production.

1. Create a dedicated database/branch for staging. Use only synthetic test data there. Reserve a separate production database/branch for the eventual live shop.
2. Open [the role template](../deploy/neon-roles.sql.example). Replace its database name with the actual dedicated Neon database name, review it, and run Phase A through an authorized SQL/operator connection.
3. Create the runtime role through SQL, rather than using a privileged default Console role. Give runtime no `neon_superuser` membership, `BYPASSRLS`, database/role creation or ownership rights. Use private `psql` `\password` prompts to set independent random passwords. Do not put passwords in this document or public SQL examples.
4. Copy the **direct TLS migration connection** privately into the migration runner's `DATABASE_URL`. Never put that connection in Render's API environment.
5. Initially use a direct TLS runtime connection for Render, with an appropriate Prisma connection limit for the chosen database capacity. Adopt a pooled runtime connection only after testing transaction-scoped RLS, concurrency and rate limiting through that pooler. Migrations/recovery use the direct connection.

The application uses Prisma **5.22** and a `DATABASE_URL` datasource. Follow the pinned lockfile; changing the Prisma major version is separate work. Neon connection/role guidance: [official Prisma guide](https://github.com/neondatabase/website/blob/main/content/docs/guides/prisma.md), [official role guide](https://github.com/neondatabase/website/blob/main/content/docs/manage/roles.md).

For a **fresh empty** database, run these individually from `backend-typescript` with the intended direct migration URL privately injected:

```sh
npm ci
npx prisma migrate deploy
npx prisma migrate status
npx prisma validate
npx prisma generate
```

Then apply Phase B of the role template as the migration owner, including default privileges for future tables/sequences. Verify runtime flags, memberships, grants, table ownership and forced tenant row policies. Do not run `migrate reset` or `db push --accept-data-loss` against hosting databases.

### Keeping your current personal-check shop

If you want the existing personal-check organization and operator account on Neon, migrate a **fresh export of the current cleaned database** into a new empty production target. This is a separate, supervised data migration, not an automated test. Do not restore the old pre-cleanup recovery dump: it contains the demo tenants you asked to remove.

Preserve password hashes, account IDs, business IDs, migration history and plans. Move private attachments separately. A database restore is an alternative to initializing a fresh schema, not something to layer blindly over an already populated target. Re-establish migration ownership and restricted runtime grants afterwards. Verify organization/record counts and attachments before switching the application.

Revoke imported login sessions, one-time reset/verification tokens and outstanding MFA challenges before cutover. Existing enrolled MFA requires the correct encryption-key version; a new production key cannot decrypt old enrollment. Preserve operator credentials and use the audited MFA enrollment/recovery process. Never use customer databases for tests. See [disaster recovery](DISASTER_RECOVERY.md).

For a completely empty installation only, the operator can run `node scripts/create-platform-admin.cjs` in a private interactive terminal after migrations. It refuses to replace an existing Super Admin and prompts for a strong password. Do not run it to reset your existing operator.

## 3. Fix Google sign-in

Your screenshots show `origin_mismatch`: Google received an origin that was not authorized on the Web OAuth client. LAN URLs such as `http://192.168.31.178:5173` are not valid production JavaScript origins. Password sign-in remains available on LAN. Use localhost on the server PC for Google development, or the final HTTPS domains for the live application.

1. Open [Google Cloud Console](https://console.cloud.google.com/). Select the project containing your existing **Web application** OAuth client. Android clients are for a separate native integration.
2. In Google Auth Platform, complete Branding with the app name **Apna Galla**, an email you control, homepage `https://apnagalla.in`, the real Privacy Policy and Terms URLs, and authorized domain `apnagalla.in`. Confirm those legal pages and contact details before public launch.
3. Use the intended external audience. While the consent app is in Testing, add the Google accounts your team will test with. Complete Google's required publication/verification steps before opening registration to customers.
4. Open Clients and edit the **Web application** client. Add these Authorized JavaScript origins, without paths or trailing slashes:

```text
https://apnagalla.in
https://app.apnagalla.in
http://localhost
http://localhost:5173
http://localhost:4321
```

5. Save the client. Register another development port only if you actually run this project there. Do not add port 5175, which belongs to your other project. The website canonicalizes `www.apnagalla.in` to the apex domain.
6. Copy the public client ID ending in `.apps.googleusercontent.com` into Render's `GOOGLE_CLIENT_ID`. Both frontends obtain it from the same API. It must be the same client whose origins you just edited.
7. This implementation uses a JavaScript credential callback and backend ID-token verification. It does not require a new redirect URI or a browser client secret. Revoke the client secret exposed in the earlier screenshot through Google Console; do not paste another secret into chat or Git.
8. Test in regular Chrome, using the exact registered URL. If Google still reports an origin error, compare that page's scheme, hostname and port with this client's origins. Confirm the client ID, allowed testing account and saved configuration.

For an existing password account, sign in using its password and connect Google in the software's Security settings. Matching an email alone does not silently link accounts. A new user should choose Create account with Google, accept the terms, fill in the business profile and choose a plan. Plan choice requests access; only audited manual approval or a configured real payment flow can activate paid access.

[Google's official setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) explains Web clients, origins, branding, popup/CSP settings and ID-token verification.

## 4. Create the Render API

The repository-root [render.yaml](../render.yaml) is the active preparation template. Import it as a Blueprint, or create a Web Service manually with the same settings. Creating the service incurs the provider plan you accept; the file itself has not deployed anything.

| Field | Value |
|---|---|
| Repository | `apnagalla53-alt/apnagalla-app` |
| Root directory | `backend-typescript` |
| Runtime | Node 24 |
| Build command | `npm ci && npx prisma generate && npm run build` |
| Start command | `node dist/main.js` |
| Health check | `/api/v1/health/ready` |
| Automatic deploy | Off initially |
| Region | Singapore; select a compatible Neon region |
| Persistent disk | None; durable photos are in Cloudinary |

Set these in Render's environment settings, never in Git or Netlify public variables:

| Variable | Value/source |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Dedicated Neon runtime TLS connection |
| `JWT_SECRET` | Fresh random secret, at least 48 characters |
| `PLATFORM_JWT_SECRET` | Different fresh random secret, at least 48 characters |
| `MFA_ENCRYPTION_KEY` | Random 32-byte base64 key; retain securely for recovery |
| `FRONTEND_ORIGIN` | `https://app.apnagalla.in` |
| `WEBSITE_ORIGIN` | `https://apnagalla.in` |
| `API_ORIGIN` | `https://api.apnagalla.in` |
| `PUBLIC_APP_URL` | `https://app.apnagalla.in` |
| `GOOGLE_CLIENT_ID` | Public Web OAuth client ID |
| `APP_VERSION` | Reviewed Git commit/release identifier |
| `TRUSTED_PROXY_CIDRS` | Start with `loopback`; verify actual Render ingress before adjusting |
| `STORAGE_PROVIDER` | `cloudinary` |
| `CLOUDINARY_CLOUD_NAME` | Project product environment's cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key, server only |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret, server only |
| `UPLOAD_DIR` | `/tmp/apna-galla/uploads`; temporary directory, not durable photo storage |
| `BACKUP_PROVIDER` | `none` until encrypted offsite recovery is configured |
| `EMAIL_PROVIDER` | `none` until verified TLS SMTP recovery is configured |
| `SMS_PROVIDER` | `none` unless a real configured provider is required |

Leave `RETAIL_COOKIE_DOMAIN` unset. Do not copy local `PLATFORM_MFA_REQUIRED=false`: production requires MFA and rejects that bypass. Preserve the existing operator account. Use the full [production environment inventory](../backend-typescript/.env.production.example) for provider-specific settings.

Add custom domain `api.apnagalla.in` to Render. In your DNS provider, add the CNAME record Render displays. Wait for domain verification and HTTPS. Check `https://api.apnagalla.in/api/v1/health/ready` before testing login. A database-role or missing-secret startup error must be fixed at its source; do not bypass production validation.

The native Node template does not prove compatible `pg_dump`/`pg_restore` tools are installed. Supply and verify those tools, or validate the existing Docker deployment alternative, before enabling archive backups. `BACKUP_PROVIDER=none` means **NOT CONFIGURED**, not successful protection. Persistent photo storage also needs its own recovery procedure. See [Render Prisma deployment](https://render.com/docs/deploy-prisma-orm).

### Private Cloudinary photo setup

1. In the project product environment, locate its cloud name and API credentials. Put the three `CLOUDINARY_*` values in Render and select `STORAGE_PROVIDER=cloudinary`. Never add them to Netlify, browser code, chat or Git. No unsigned upload preset is needed.
2. The API uploads already sanitized photo bytes as `raw` assets with delivery type `authenticated`, under opaque IDs `apna-galla/<company UUID>/<category>/<photo UUID>.<extension>`. It preserves original bytes and database metadata; it does not expose a public CDN URL to the browser.
3. Authorized attachment requests first check the tenant and document permissions, then fetch a 60-second signed Cloudinary download inside the API. Redirects are rejected, downloads are capped at 5 MB, and signed URLs/provider errors are never returned or logged.
4. In staging, upload each supported photo format, retrieve it, delete it, and attempt access from a different tenant. Check in Cloudinary that delivery type is **authenticated**, and that an unsigned public URL fails. SDK mocks prove adapter behavior only; real account integration must pass before cutover.
5. Existing local/S3 photos are **not migrated by changing an environment variable**. Preserve their original source files and database metadata. Copy each source asset to the corresponding authenticated Cloudinary ID, download and compare its bytes, then update that record's `storage_provider` only after verification during a controlled maintenance window. Do not delete the source until restore/recovery has been verified. The API deliberately refuses access/deletion through a mismatched provider instead of silently using the wrong store.
6. Configure an asset recovery policy appropriate to the actual Cloudinary plan and test restoration. Cloudinary photo storage is separate from Neon database recovery and the application's encrypted archive backup service. The existing permanent tenant-erasure workflow refuses non-local assets until a verified object-store/version erasure workflow exists; do not bypass that safeguard.

See [Cloudinary authenticated media](https://cloudinary.com/documentation/control_access_to_media), [signed uploads and private downloads](https://cloudinary.com/documentation/image_upload_api_reference), and [asset backups](https://cloudinary.com/documentation/backups_and_version_management).

## 5. Create the two Netlify projects

Update the existing website project from the reviewed website branch and import the new software repository from `main` as a separate project. Use the root `netlify.toml` already prepared in each repository; it contains build configuration, security headers and routing. Do not paste backend secrets into a Netlify browser build.

| Setting | Website project | Software project |
|---|---|---|
| Repository | `apnagalla53-alt/apnagalla-website` | `apnagalla53-alt/apnagalla-app` |
| Base | `marketing-site` | `frontend` |
| Publish, relative to base | `dist` | `dist` |
| Build | `npm run build` | `npm ci && npm run build` |
| Node | 24 | 24 |
| Custom domain | `apnagalla.in`, plus `www` alias | `app.apnagalla.in` |
| Public API variable | `PUBLIC_API_URL=https://api.apnagalla.in` | `VITE_API_URL=https://api.apnagalla.in` and `VITE_API_BASE_URL=https://api.apnagalla.in` |
| Additional public variables | `PUBLIC_APP_URL=https://app.apnagalla.in`, `PUBLIC_SITE_URL=https://apnagalla.in` | None for database or Google secrets |

Remove conflicting dashboard values and rebuild after changing public variables: they are compiled into the frontend. The software includes the SPA fallback required for `/auth/continue`, `/retail/home` and `/platform/login` deep links. `/api/*` remains an API route, before that fallback.

Add each custom domain in Netlify. At your existing DNS provider, copy the exact records that the dashboard requests. Do not guess IP addresses. Confirm the apex website, `www` redirect and software subdomain all have valid HTTPS. [Netlify external DNS instructions](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/).

The two Netlify addresses and Render's default address are on different registrable domains. This cookie design is intended for the three agreed `apnagalla.in` HTTPS origins. Do not treat an arbitrary `.netlify.app` + `.onrender.com` combination as a successful shared-login deployment.

## 6. Test the hosted staging system before launch

Use a separate staging database and its separately registered HTTPS origins; do not mutate the existing personal-check shop with automated fixtures. Configure origins consistently in Google, API environment and frontend builds.

1. Open website Signup on desktop and mobile. Accept terms and create a new Google account through the real Google popup. Confirm only one backend account appears.
2. Complete the business profile and plan request. Approve using a separately provisioned staging Platform administrator. Verify paid access is never granted just because a QR, request or plan page was displayed.
3. Sign in on the website and arrive at the software without a second login. Refresh the software; verify the same account and business remain selected.
4. Sign in directly to the software with the same Google account. Confirm it does not create another user or organization.
5. Test an existing password account, explicit Google linking, logout, disabled accounts and expired/revoked sessions. After logout, `/auth/session` must return 401.
6. Inspect cookies on the API host: Secure, HttpOnly session, SameSite Strict, no parent `Domain`. Confirm no JWT in URLs/local storage. Reject untrusted-origin and missing-CSRF writes.
7. Test Platform MFA, manual access approval and tenant isolation. Retail users must never obtain Platform authorization.
8. Test photos, purchases, sales, split payments, inventory/accounting, imports, reports and deep links on the deployed release. Verify an API 404 stays an API error, rather than returning the app HTML.
9. Measure actual forwarded client IP/rate-limit behavior through Render. Never enable trust for all internet or all private networks.
10. Configure SMTP recovery, encrypted offsite backups, photo recovery, monitoring and alerts. Perform a real restore into a disposable target and record the measured recovery time/data loss. The unavailable provider labels must remain truthful until these succeed.

Cloud Google sign-in, DNS/HTTPS, Neon restore, email delivery, storage recovery, provider ingress and hosted load remain unverified. Complete [the release checklist](RELEASE_CHECKLIST.md) and record evidence before accepting paying customers.

## Local verification and limits

The targeted checks cover trusted origins, CSRF, secure cookie settings, account restoration, temporary-password restrictions, Google signup/link boundaries and logout revocation. They use a dedicated localhost database ending `_test` and separate fixture accounts. Google identity is mocked only at the integration-test boundary; real Google Cloud sign-in still requires the hosted/manual check above.

Visible browser checks verify website password login → software, responsive signup/provider availability, and the LAN Google explanation. Production builds must use the configured public API URL, rather than a development `.env.local` value.

No cloud account, DNS record, provider secret or public deployment has been created by this work. The next action is to create the provider accounts, then follow steps 2–6 using your own private settings.
