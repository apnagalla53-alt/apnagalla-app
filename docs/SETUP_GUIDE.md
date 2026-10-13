# EVOLIX Studio: setup without prior cloud experience

Developer: **EVOLIX Studio**. Website supplied by the owner: **https://evolix-studio.in**. This guide prepares accounts and configuration; it does not deploy anything automatically or claim that a provider has been purchased.

## First understand the five parts

| Part | What it does |
|---|---|
| Domain | Your public app address, such as a subdomain you choose under evolix-studio.in |
| Backend hosting | Runs billing, authentication and tenant authorization continuously |
| PostgreSQL | Stores shop accounts, stock and accounting records |
| Private object storage | Stores bill photos and encrypted database archives |
| Google / email / Play accounts | Enable Google sign-in, recovery emails and Android distribution |

Google login proves an account identity. Existing linked users return to their shop; explicit signup leads a new owner through business setup and provisioning. Google does not host the app, provide an AI model or confirm a UPI payment.

## 1. Fill public details when you decide them

Sign in as the authorized Super Admin → **Settings → App publishing**. EVOLIX Studio and your website are already provided. Fill the legal operator/developer identity, support email, address, Android package name and approved retention explanation. Leave policy approval off until these are accurate and reviewed. The pages `/privacy`, `/terms`, `/support`, `/delete-account` and `/about` remain visibly draft while incomplete.

Create a real support mailbox on a domain you control; do not publish an invented email. The proposed package `in.evolixstudio.retail` is provisional. Confirm ownership and keep that package consistent in native code, OAuth and Play Console before signing. Store configuration is platform-wide, so a shop owner cannot change the developer's legal details.

## 2. Choose staging first

A manageable starting option is a paid managed API host and managed PostgreSQL, with a static frontend and private S3 buckets. [Render's Node hosting guide](https://render.com/docs/deploy-node-express-app), [Postgres setup](https://render.com/docs/postgresql-creating-connecting) and [static hosting](https://render.com/docs/static-sites) explain the account screens. Compare actual region, cost, support and recovery terms before purchase. Free development tiers are not assumed suitable for a paying retailer: [Render documents that its free database plan has no managed recovery](https://render.com/docs/postgresql-backups).

Alternatively, the supplied Docker Compose runs API + frontend behind your HTTPS proxy, with an external managed PostgreSQL. Use an operator who can maintain its host, security updates and monitoring. The repository contains `Dockerfile`, `Dockerfile.migrations`, frontend `Dockerfile`, and `deploy/compose.production.yml`; these need an actual Docker/staging verification before customer release.

Create separate **staging** and **production** databases, buckets, secrets and Google clients/projects as appropriate. Staging uses disposable business records. Keep production/customer data out of development test databases.

## 3. Create PostgreSQL and protect its connection

Create the managed database in your chosen region. Enable provider backup/PITR. Copy its connection into your hosting **secret environment settings** as `DATABASE_URL`; do not paste it in this chat, Git or a screenshot. Restrict network access and use TLS as documented by the provider. Give migration credentials schema-change access and restrict the normal application account to needed data operations. Have the operator check PostgreSQL client-tool versions and remote TLS verification for backups.

Review migration SQL, then run the migration image/job against the explicitly selected staging DB. Example commands below use an ignored, operator-owned environment file; that file must contain staging values before the first run:

```sh
docker build -f backend-typescript/Dockerfile.migrations -t evolix-migrations backend-typescript
docker run --rm --env-file deploy/.env.production evolix-migrations
```

The image runs `prisma migrate deploy`; it does not reset or discard records. Use the same image for `npx prisma migrate status` and `npx prisma validate`. Keep deployment artifacts, migrations and version tied to the same reviewed commit. Test a realistic upgrade and pre-migration recovery before repeating this step against production.

## 4. Create private storage and real backups

In AWS S3 create separate attachment and backup buckets. Keep **all Block Public Access settings on** and ACLs disabled. Follow [AWS's bucket-access guide](https://docs.aws.amazon.com/AmazonS3/latest/userguide/configuring-block-public-access-bucket.html). Supply region/bucket names through the hosting settings. Use workload IAM where possible; otherwise use a restricted application IAM identity and keep its standard AWS credentials in the hosting secret manager, never AWS root credentials.

Attachment IAM needs private object read/write/delete and required bucket access. Backup IAM needs bucket access/lifecycle inspection and object write/read for the configured backup prefix; optional KMS also needs its restricted key permissions. The exact IAM policy must name your actual buckets, prefixes and deployment identity.

Set `STORAGE_PROVIDER=s3`, `S3_BUCKET`, `S3_REGION`. For backups set `BACKUP_PROVIDER=s3`, `BACKUP_S3_BUCKET`, `BACKUP_S3_REGION`, `BACKUP_S3_PREFIX=evolix-backups/`, `BACKUP_RETENTION_DAYS=30` and a **random 32-byte base64** `BACKUP_ENCRYPTION_KEY`. Generate and save the key privately; do not copy it into a document. Create an Enabled lifecycle rule for the exact prefix with the matching expiration. Preserve key versions separately from archives.

Configure an operator scheduler to run `node scripts/run-backup.cjs` daily and alert on failure/missing freshness. Use managed PITR for a tighter RPO. Create → verify → change disposable data → restore → reconcile, including attachment recovery. See `DISASTER_RECOVERY.md`. Until that real drill passes, backup configuration is not a release PASS.

## 5. Configure the API and frontend

Use `backend-typescript/.env.production.example` as the inventory. Enter independent random tenant/platform JWT secrets, actual HTTPS frontend/API origins, storage/backup details, email settings and an immutable `APP_VERSION`. The template's empty secrets cannot start production. Do not enable startup administrator seeding.

For same-origin Docker hosting, serve the frontend/API under one HTTPS origin through the supplied proxy. For separate static/API hosts, build the frontend with `VITE_API_URL` set to the real HTTPS API origin; set backend `FRONTEND_ORIGIN` to the exact frontend origin. Add that API origin to the frontend CSP `connect-src` and verify CORS. Configure SPA rewrite `/* → /index.html` so refresh/deep links work. Keep static headers as described in `PRODUCTION_DEPLOYMENT.md`; permit only the official Google sign-in resources.

Disable automatic customer-facing deploys until the release is reviewed. Configure readiness `/api/v1/health/ready`, uptime/database/storage/backup alerts, a responsible operator and rollback artifacts. Test through the actual TLS URL, not just localhost. For the native Android client explicitly set `ANDROID_APP_ENABLED=true`, which permits its exact `https://localhost` WebView origin alongside the real web frontend.

## 6. Create the first administrator and shop

An authorized operator opens a private terminal in the protected backend runtime and runs `node scripts/create-platform-admin.cjs`. Enter the identity and hidden strong password interactively; never put passwords in command arguments. Sign into Platform, create a fresh tenant and use its explicit temporary owner password. In production it expires after 24 hours and the owner must change it before billing. Verify all default structures and a real purchase/bill/return/payment without manual internal ERP setup.

## 7. Enable Google login and recovery

Follow `GOOGLE_LOGIN_SETUP.md`: Google Cloud → new business-controlled project → Google Auth Platform Branding/Audience → Web client → exact JavaScript origins → public `GOOGLE_CLIENT_ID` in backend configuration. No Google client secret belongs in the frontend. Publish your completed privacy/terms pages and configure the consent screen/test accounts.

An existing shop user first signs in with their password, opens the top-left shop menu → **Settings & Help → Security** and explicitly connects Google using their current password. Future Google sign-in opens that same assigned shop account. A new owner uses `/signup` and completes the saved owner/business/plan/import-or-fresh steps. Register the Android package and the correct debug/Play **app-signing SHA-1** for native builds; Android uses the Web client ID as its backend audience.

To enable mobile signup, configure the implemented Twilio provider following [AUTH_AND_ONBOARDING.md](AUTH_AND_ONBOARDING.md): create a business-controlled account, finish applicable sender registration, store its credentials privately and test real Indian-number delivery on staging. With `SMS_PROVIDER=none`, the app labels mobile OTP as unconfigured and cannot send a test code. In Platform → Accounts & trial policy, deliberately configure a trial only if you want one; the default is disabled. A plan request alone never counts as payment.

Set up a real SMTP sending provider/domain and SPF/DKIM/DMARC. Supply `EMAIL_PROVIDER=smtp`, SMTP host/port/user/password, real `EMAIL_FROM`, `PUBLIC_APP_URL` and TLS. With port 587 use `SMTP_SECURE=false`, `SMTP_REQUIRE_TLS=true`; with port 465 use `SMTP_SECURE=true`. Verify recovery email and reset a disposable account through the actual delivered link. Missing providers return NOT CONFIGURED, not a fake successful email.

## 8. Prepare Android and Play Console

Install the required Android Studio/JDK/SDK on a build machine. Follow `PLAY_STORE_PUBLISHING.md` for the signed AAB, app-signing fingerprint, internal testing, privacy/account-deletion URLs, Data safety and store listing. Test Google sign-in, printing/sharing, photo attachment, bad network, login, all bill modes and session revocation on a real Play-installed build. Public legal placeholders and an unsigned source project cannot be uploaded as a finished production app.

## 9. Add the voice assistant after the core release

`WHATSAPP_VOICE_ASSISTANT.md` explains the Hindi/Hinglish voice → exact tenant report → Hindi audio architecture. Start with read-only answers to new Udhar and posted incoming stock. Free-to-use model weights still require compute and WhatsApp/provider budgeting. It remains NOT CONFIGURED until the Meta account, verified shop link, signed webhooks, speech services and real delivery tests exist.

## 10. Review before launch

Complete every release checklist item, review the actual production-completion report and real provider/native evidence, then explicitly authorize deployment separately. Current local passing tests do not prove cloud configuration, recovery time or Google Play approval.
