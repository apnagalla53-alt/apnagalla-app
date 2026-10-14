# Apna Galla cloud launch — operator steps

Prepared 13 October 2026. The release source is prepared; provider secrets, database setup, DNS and hosted acceptance still need completion. Do not call the software live until the final checks below pass.

## 1. Source and automatic build configuration

- Software/backend repository: `https://github.com/apnagalla53-alt/apnagalla-app`, branch `main`.
- Website repository: `https://github.com/apnagalla53-alt/apnagalla-website`, branch `codex/cloud-release-20261013` for the reviewed website connection. Keep the existing live website until the API is ready.
- Root `render.yaml` is a Render Blueprint. In Render choose **New → Blueprint**, connect GitHub, choose the app repository and `main`. Choosing **New Web Service** does not automatically import a Blueprint.
- Root `netlify.toml` in each repository defines its base, build command, publish directory, public API URLs, routing and headers. Import from Git, not a manual drag-and-drop build.
- Render Blueprint selects a **paid Starter** service in Singapore. Review the displayed cost before creating it. No paid service has been purchased by this code preparation.

## 2. Neon database

1. In Neon, create an Apna Galla project. Choose a region close to Render Singapore, and check that project's backup/restore retention. Use a separate staging branch/database for synthetic acceptance data.
2. Decide whether production starts empty or preserves the current personal-check shop. To preserve it, use a fresh cleaned database export and a controlled restore into a new empty target. Do not restore the old pre-cleanup demo dump. Preserve the operator account, hashes and IDs. See the detailed guide linked below.
3. For an empty target, open Neon SQL Editor for that database and run **Phase A only** from `deploy/neon-roles.sql.example`. It creates `evolix_migrator` and `evolix_runtime`; the runtime must not own tables or have elevated membership.
   Use **Run**, not Explain/Analyze. The corrected template does not set a persistent `app.security_scope` role default: Neon rejected that earlier instruction. The API sets scope inside each authorized transaction. Verify the two role rows before setting passwords. PostgreSQL 18.6 has been reported on this project; compatibility of the pinned Prisma release and migrations remains to be checked during deployment.
4. The two SQL-created roles initially have no passwords. Neon Console **Reset password** can then fail with `cannot update password for role without password`. For these **new unused roles only**, run `deploy/neon-initialize-passwords.sql.example` once through SQL Editor **Run**. It initializes random server-generated passwords without returning them or embedding a secret in saved SQL. Verify success, then use Roles → each existing role → **Reset password** and privately save those two final generated values. Do not rerun initialization after either role is in use. Neon requires plaintext SQL password input; `psql \password` sends a client-side hashed verifier and is not a supported shortcut here. Keep passwords/connection strings out of screenshots, Git and chat. This does not touch `neondb_owner` or the application operator account.
5. Copy the project's **direct** connection hostname/database from Neon Connect. Build a direct TLS URL for the migration role; replace username/password with that role's credentials, URL-encode special characters, retain `sslmode=require`. Example shape, never literal credentials:

   `postgresql://evolix_migrator:URL_ENCODED_PASSWORD@ACTUAL_NEON_HOST/ACTUAL_DATABASE?sslmode=require`

6. In a private terminal, enter `backend-typescript`, inject that URL as `DATABASE_URL` temporarily, then run individually:

   ```sh
   npm ci
   npx prisma migrate deploy
   npx prisma migrate status
   npx prisma generate
   npm run build
   ```

7. Run **Phase B** of the SQL template as the migration owner, then the read-only verification as runtime. All privilege flags must be false, elevated memberships empty, owned application tables zero, and tenant RLS forced. Never use `migrate reset` for this deployment.
8. Render `DATABASE_URL` must use `evolix_runtime` and the same dedicated database with TLS. Start with direct runtime connection and a capacity-appropriate `connection_limit`; test pooled connections before adopting them. The migration owner's URL must not be given to the running API.
9. For an empty installation only, create the first Platform administrator using the private interactive `node scripts/create-platform-admin.cjs` CLI. It refuses to replace an existing administrator. Production requires MFA. A restore containing the existing operator does not need this creation step.

## 3. Cloudinary

1. Create the project product environment in Cloudinary. Copy its cloud name, API key and API secret into **Render environment settings only**:

   ```text
   STORAGE_PROVIDER=cloudinary
   CLOUDINARY_CLOUD_NAME=<your cloud name>
   CLOUDINARY_API_KEY=<your API key>
   CLOUDINARY_API_SECRET=<your API secret>
   ```

2. Do not create an unsigned browser upload preset. The backend signs uploads of sanitized photos as authenticated raw assets. No public CDN URL or API secret goes into Netlify/browser code.
3. Once staging runs, upload a PNG/JPEG/WebP photo through the app, open it, and test another tenant cannot open it. Confirm the asset is `authenticated` in Cloudinary and an unsigned URL fails. Then test deleting a disposable photo.
4. Changing the provider does not migrate old local photos. Preserve source files; copy, download and verify each asset before updating its attachment record's provider in a maintenance window. The app refuses mismatched-provider reads/deletes to protect those records.
5. Configure and test photo recovery separately. Cloudinary is not the PostgreSQL backup provider. Permanent tenant erasure currently refuses non-local assets until object/version erasure is implemented and verified.

## 4. Render backend

1. Connect GitHub using the Apna Galla project account; allow this repository. Import **New → Blueprint** from app repository `main`.
2. Populate every `sync: false` field before launch: runtime `DATABASE_URL`, independent random `JWT_SECRET` and `PLATFORM_JWT_SECRET` (at least 48 characters), `MFA_ENCRYPTION_KEY` (32 random bytes encoded base64), Cloudinary values, public `GOOGLE_CLIENT_ID`, and `APP_VERSION` (the release commit).
3. Keep supplied domains: frontend `https://app.apnagalla.in`, website `https://apnagalla.in`, API `https://api.apnagalla.in`. Leave `RETAIL_COOKIE_DOMAIN` unset. Never copy a development MFA bypass into production.
4. `BACKUP_PROVIDER=none`, `EMAIL_PROVIDER=none`, `SMS_PROVIDER=none` mean unavailable, not configured. Configure SMTP recovery and independently tested database/offsite/photo recovery before accepting paying customers. Review the full `.env.production.example`.
5. Deploy after migrations/grants. The service uses Node 24, `npm ci && npx prisma generate && npm run build`, starts `node dist/main.js`, and checks `/api/v1/health/ready`. Automatic deploy is initially off.
6. Copy the **actual** service hostname displayed by Render, such as `your-actual-service.onrender.com`. Add custom domain `api.apnagalla.in`; enter the corresponding GoDaddy CNAME below. Wait for Render's verified HTTPS certificate.

## 5. Netlify software and existing website

1. In the existing Netlify team, **Add new project → Import an existing project → GitHub**. Select `apnagalla53-alt/apnagalla-app`, branch `main`.
2. Root `netlify.toml` should detect base `frontend`, build `npm ci && npm run build`, publish `dist` relative to base, Node 24. Both public API variables point at `https://api.apnagalla.in`. Never put database/storage secrets in Netlify.
3. After the build, copy the actual Netlify site hostname and add custom domain `app.apnagalla.in` in Domain management. Then create the `app` CNAME at GoDaddy.
4. For the **existing** website Netlify project `apnagalla` serving `apnagalla.in`, keep domain settings. When API HTTPS is working, choose the reviewed website branch `codex/cloud-release-20261013` in continuous deployment (or merge that reviewed branch normally). Root website config detects `marketing-site`, build `npm run build`, publish `dist`.
5. Website public variables are `PUBLIC_SITE_URL=https://apnagalla.in`, `PUBLIC_APP_URL=https://app.apnagalla.in`, `PUBLIC_API_URL=https://api.apnagalla.in`. Rebuild if changed. Website login/signup now use the shared backend/database.

## 6. GoDaddy DNS records

Your screenshot shows the website records already exist. **Keep the first two records and existing NS/SOA/TXT/email records. Add only the last two after copying real provider hostnames.** No Cloudinary or Neon DNS record is needed.

| Action | Type | Name | Value | TTL |
|---|---|---|---|---|
| Keep existing | A | `@` | `75.2.60.5` | 1 hour |
| Keep existing | CNAME | `www` | `apnagalla.netlify.app` | 1 hour |
| Add | CNAME | `app` | **Actual new software Netlify hostname**, e.g. `your-app-site.netlify.app` | 1 hour |
| Add | CNAME | `api` | **Actual Render API hostname**, e.g. `your-api-service.onrender.com` | 1 hour |

The last two values are placeholders, not issued hostnames. Enter hostnames only: no `https://`, paths or ports. Do not create a CNAME pointing `app` to the existing marketing website. Custom domains must also be registered with their respective provider before HTTPS can work. Preserve Google verification and DMARC records; no nameserver change is needed.

[Netlify external DNS](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/) and [Render custom domains](https://render.com/docs/custom-domains) describe the provider-specific verification.

## 7. Google on both domains

1. Edit the existing **Web application** client in Google Auth Platform → Clients. Replace the screenshot's `http://apnagalla.in` with **`https://apnagalla.in`** and add **`https://app.apnagalla.in`**. Keep only required localhost development origins.
2. Authorized JavaScript origins contain no path/trailing slash. This app uses a GIS credential callback, so no redirect URI/client secret is required for this flow.
3. Complete Branding with the real homepage, Privacy/Terms pages, support contact and authorized domain `apnagalla.in`. Configure the appropriate audience/publication; in Testing, only authorized test accounts can be used. Revoke the previously exposed OAuth secret in Google Console.
4. Put the same public Web client ID in Render `GOOGLE_CLIENT_ID`; both frontends obtain it from the API. Re-test with regular Chrome on each exact HTTPS domain.
5. A new Google user creates a pending account, completes shop onboarding and requests a plan. Payment/access approval remains manual until a real verified gateway is configured. Existing password accounts must explicitly link Google in Security.

[Google setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [Cloudinary private access](https://cloudinary.com/documentation/control_access_to_media).

## 8. Final cutover checks

Verify `https://api.apnagalla.in/api/v1/health/ready`, website signup/login → `https://app.apnagalla.in/auth/continue`, direct software login, refresh/logout, Platform MFA, tenant isolation, uploads, purchase/sale/accounting, correct subscription gates and recovery. Use isolated staging accounts for automated tests, never the operator/personal-check shop. Shared login requires the final three HTTPS domains; unrelated Netlify/Render default domains do not prove cookie compatibility.

More detail: [shared login and cloud setup](APNAGALLA_WEBSITE_AND_CLOUD_SETUP.md). Real Google sign-in, hosted load, provider ingress/IP rate limiting, email and recovery remain hosted acceptance work. The local adapter checks/builds cannot certify them.
