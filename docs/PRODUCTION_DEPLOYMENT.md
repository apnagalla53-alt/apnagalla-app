# Production deployment — Production candidate setup

Status: **release blocked**. This run does not deploy. See `verification/PRODUCTION_COMPLETION_REPORT.md` for measured results and open gates. Passing local builds does not configure production infrastructure.

For the selected website + software stack, start with [Apna Galla website, Google login and cloud setup](APNAGALLA_WEBSITE_AND_CLOUD_SETUP.md). Repository-root `netlify.toml` and `render.yaml` now prepare the agreed domains; no service has been deployed. The older alternatives in `deploy/` remain examples. Actual secrets, migration jobs, storage/recovery and staging acceptance are required.

The latest account/platform scope is documented in [control-plane verification](verification/PLATFORM_CONTROL_PLANE_VERIFICATION.md), [auth and onboarding setup](AUTH_AND_ONBOARDING.md), [tenant lifecycle](TENANT_LIFECYCLE.md) and [credential policy](SECURITY_CREDENTIAL_POLICY.md). Review those provider and deletion boundaries before enabling public signup or permanent erasure. Trial offers and permanent deletion are disabled by default; changes require an explicit audited Platform policy.

## Requirements and runtime

- Node.js **24.11.1** was used for verification. Use a maintained Node 24 runtime in CI and staging; some development tooling requires a newer 24.x patch. Validate the exact pinned container and runtime before release.
- PostgreSQL with a private network, TLS, a dedicated application database and a restricted application role. The local PostgreSQL custom archive adapter requires matching `pg_dump` / `pg_restore` tools.
- HTTPS reverse proxy, private persistent storage, secret manager, real backup provider and monitoring. Shared PostgreSQL rate limiting is implemented; configure complementary ingress limits and exact trusted proxy addresses.
- Deploy only `backend-typescript` and built `frontend/dist`. Never package `archive`, `scratch`, `scratchpad`, tests, local uploads, `.env` files or local database dumps.

Application authorization is reinforced by forced PostgreSQL row security on company business/child tables. Identity and Platform authorization still require application checks. Do not claim tenant-selective restore.

## Environment separation

Development: copy `backend-typescript/.env.example` to ignored `.env`. Test: use a separately created **localhost database ending `_test`**, explicitly inject its `DATABASE_URL`, and apply migrations. Legacy tests can clear entire tables; never run them on an application/customer database. Production: inject values from a secret manager using `.env.production.example` as the key inventory. The root `.env.example` documents retired Python configuration.

| Variable | Production contract |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | PostgreSQL connection; never expose to client or logs; use TLS and restricted role |
| `JWT_SECRET`, `PLATFORM_JWT_SECRET` | Different random values, at least 48 characters each; generate independently; no examples/default passwords |
| `MFA_ENCRYPTION_KEY` | Random 32-byte base64 key; mandatory Platform authenticator encryption; preserve versions separately from the database |
| `TRUSTED_PROXY_CIDRS` | Exact ingress source addresses only; default loopback; include the actual container ingress source if using Docker |
| `TENANT_UPLOAD_QUOTA_BYTES` | Tenant photo quota; default 1073741824; minimum 5242880 |
| `FRONTEND_ORIGIN`, `API_ORIGIN` | Exact HTTPS origins, no path/query/credentials; no localhost |
| `APP_VERSION` | Immutable release identifier/build commit |
| `PORT` | Private API listening port; verified locally at 8010 |
| `STORAGE_PROVIDER` | `s3`, or explicitly approved persistent private `local` storage |
| `S3_BUCKET`, `S3_REGION` | Required for S3; private bucket, workload IAM access; integration must be tested in staging |
| `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `S3_KMS_KEY_ID` | Optional provider endpoint/path style/KMS settings |
| `UPLOAD_DIR` | Mandatory with local production storage; persistent path outside public web root |
| `BACKUP_PROVIDER` | `s3` is the encrypted offsite adapter; `none` reports NOT CONFIGURED; `local` is development only |
| `BACKUP_S3_BUCKET`, `BACKUP_S3_REGION`, `BACKUP_S3_PREFIX`, `BACKUP_RETENTION_DAYS` | Separate private backup bucket with a verified lifecycle prefix/expiration policy; 7–365 days |
| `BACKUP_ENCRYPTION_KEY` | Random 32-byte base64 AES key; version and preserve in a separate secret manager |
| `GOOGLE_CLIENT_ID` | Public Web OAuth audience; optional until live account setup completes |
| `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` / `TWILIO_FROM` | `none` disables mobile OTP; `twilio` requires credentials and a registered sending service/number. Verify real delivery before public signup launch |
| `EMAIL_PROVIDER`, `SMTP_*`, `EMAIL_FROM`, `PUBLIC_APP_URL` | Real SMTP recovery/verification delivery, TLS and real HTTPS app links; none is a launch gate |
| `ANDROID_APP_ENABLED` | Explicitly allows the native https://localhost origin, alongside the exact frontend origin |
| `BACKUP_DIRECTORY`, `PG_DUMP_PATH`, `PG_RESTORE_PATH` | Operator-only local archive settings; never browser supplied |
| `BACKUP_RESTORE_DATABASE` | Non-production disposable `_restore_test` target only; production browser restore is refused |
| `VITE_API_URL` | Build-time frontend origin, blank for same-origin `/api/v1`; never contains secrets |

Production startup rejects predictable/shared JWT keys, missing MFA encryption, disabled Platform MFA, unsafe origins, storage/version/provider errors and bootstrap passwords. It also refuses privileged/table-owner runtime accounts and missing RLS. BACKUP_PROVIDER=none permits startup but blocks release. Serve frontend/API through the same HTTPS origin for browser cookies.

Tokens expire after one day and have persisted revocable sessions. There is no refresh-token secret/flow. Google login, Twilio mobile OTP and SMTP password/email recovery are implemented, but live provider accounts are **not configured**. WhatsApp, online subscription payments, external error tracking and cloud infrastructure telemetry also remain **not configured**. Do not invent provider environment settings or advertise automatic UPI confirmation. The UPI QR only prepares a payment URI; the retailer separately confirms receipt.

## Database preparation and migration

Create a new PostgreSQL database through infrastructure tooling; use separate migration and application credentials. Restrict the application role to its schema and data operations. Review the migration SQL and existing duplicate SKU/party codes before release: new uniqueness is tenant scoped and intentionally fails on conflicting historical data. Resolve duplicates with the owner; never silently merge financial records.

From `backend-typescript`, with the intended deployment database explicitly injected:

```sh
npm ci
npx prisma migrate deploy
npx prisma migrate status
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run build
```

The full chain contains 35 migrations. The security migration adds MFA challenges, shared rate windows and forced business/child RLS. It was applied to a clean disposable database and both preserved local EVOLIX databases with business record counts unchanged. Existing account/plan migrations retain historical records and overrides. Representative staging data, migration duration and locks still need verification. Never use migrate reset or db push --accept-data-loss in production.

Provision two separate roles through a trusted database operator: a migration owner and a runtime LOGIN with NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE and no membership in the owner. The runtime gets schema USAGE, table SELECT/INSERT/UPDATE/DELETE and sequence USAGE/SELECT, without table ownership or schema CREATE. Give it only SELECT on _prisma_migrations. Configure matching default privileges for future migration-created tables. The migration owner is trusted; initialize its app.security_scope=system setting through the database administrator when migrations need existing tenant data. Runtime connections have no default system scope.

Never run migrations with runtime credentials. Local .env.maintenance.local is an ignored operator-only connection, never loaded by AppModule or sent to a browser. In production, inject migration credentials only into the migration job/authorized recovery environment, and use a migration role without local disposable-test CREATE DATABASE/ROLE powers. After backup restoration, reapply ownership, grants and RLS before switching the API connection.

## First Super Admin

No production account is auto-seeded. After migrations, run the operator-only interactive command in a private terminal:

```sh
node scripts/create-platform-admin.cjs
```

It prompts for a username and hidden matching password (16+ characters with all four character classes), stores bcrypt cost 12 and records audit. Do not put passwords in command arguments, screenshots or logs. First sign-in now requires authenticator enrollment; save the eight recovery codes privately. Lost-device recovery uses scripts/platform-mfa-reset.cjs with verified operator identity, an audit reason and a separate maintenance connection. Preserve MFA_ENCRYPTION_KEY in the secret manager; key loss requires audited re-enrollment.

Create a shop in Super Admin using an explicit owner password (production policy: 12+ characters with all four classes). A normal Retail plan needs Retail POS, Inventory, Khata, Purchases, Expenses, Reports, Sales and Accounting. Advanced capabilities require their separate effective entitlements. Provisioning creates owner membership, business, branch, default stock location, financial year, unit, ledgers, configuration and subscription atomically.

## API and frontend deployment

Run `npm run start:prod` from the built backend with secret-manager environment, a service manager, graceful restart and private network access. Do not use the watch server. Run `npm ci`, `npx tsc --noEmit`, `npm run build` in `frontend`, then serve immutable `dist` with SPA fallback to `index.html`. Do not deploy Vite's development server.

`deploy/nginx.conf.example` provides same-origin routing, deep-link fallback, security headers and edge limits. Supply real DNS/certificates upstream; review CSP when adding providers. HSTS is set only at the TLS deployment layer. Do not proxy the development school application on port 8000; EVOLIX Trade's verified local API is 8010.

## Storage and backup

The S3 adapter uses private authenticated reads and provider IAM. PNG/JPEG/WebP uploads have a 5 MiB limit, full decoding/re-encoding, a 20-million-pixel limit and a tenant quota with concurrency locking. Bucket permissions, provider failure, retention, object versioning, malware scanning and live S3 round trips remain staging gates.

The S3 backup adapter encrypts real PostgreSQL archives with AES-256-GCM before private upload, verifies bucket retention, authenticates downloads before archive verification, and rejects production browser restore. `node scripts/run-backup.cjs` is an operator scheduler entry point with failure exit/optional alerts. The real provider, schedule, credentials, alert delivery and PITR are **NOT CONFIGURED** in this workspace. Local custom archives and a disposable restore drill are real, but cannot satisfy production recovery. Configure and validate the provider as described in `DISASTER_RECOVERY.md`. Do not enable a shared-database tenant restore button.

## Health, monitoring and rollout

Public `/api/v1/health` reports API alive and deployment version. `/api/v1/health/ready` performs a database query and returns generic 503 on failure, without database names/connection strings. Restrict detailed infrastructure/backup views to Super Admin. Logs contain JSON request IDs, route templates, status and duration; no body, authorization header or raw query string.

Configure readiness/uptime, redacted error tracking, database/storage alerts, backup freshness and restore-drill alerts. External integrations are not claimed active. Shared database rate limits are implemented; verify ingress IP forwarding and actual trusted proxy addresses in staging to avoid counting all customers under the proxy IP.

First deploy to a staging environment using a fresh tenant and sanitized realistic data. Run the release checklist, mobile/desktop acceptance, isolation tests, financial reconciliation and recovery drill against that exact release. Require explicit human review before promoting. Preserve the previous artifact and verified pre-migration backup; use additive schema changes and a roll-forward fix. A code rollback must be schema compatible. Never reverse a migration by destructive guessed SQL.

## Container artifacts

`backend-typescript/Dockerfile`, `frontend/Dockerfile` and `deploy/compose.production.yml` prepare a same-origin deployment behind operator TLS. Build `backend-typescript/Dockerfile.migrations` as the dedicated migration job image and run it with migration credentials; its default command is `npx prisma migrate deploy`. The runtime image omits development tools and does not migrate automatically. Never use the runtime image to download a different Prisma CLI during release. Docker is unavailable in the current verification environment: image build, nginx syntax, container health and staging rollout remain required evidence. The frontend initial JavaScript was split by route to avoid shipping platform/legacy screens with the first Retail view.

For a beginner-friendly setup sequence see `SETUP_GUIDE.md`. For Android signing, store declarations and account-deletion URLs see `PLAY_STORE_PUBLISHING.md`.

## Import, report inbox and shop portability release

Apply the complete migration chain before deploying this code. The import release migration `20261007200000_retail_import_reports_backup` adds seven staging/onboarding/report/backup-request tables and tenant indexes, and aligns two calendar foreign keys to the schema's RESTRICT policy. Assistant migration `20261008120000_assistant_v1` brings the chain to 27 migrations and adds four catalog/session/query-log tables with scoped indexes. Neither drops business data. Review normal DDL locking in staging and take the required operator backup before production migration.

Use the committed lockfile with `npm ci`. Spreadsheet parsing uses the official SheetJS 0.20.3 distribution rather than the outdated npm registry version; build egress/mirrors must allow its pinned distribution. Source imports are bounded but should also have edge upload limits. Keep import source audits tenant-private and apply the operator's documented data-retention policy.

Assistant V1 uses pinned local Fuse.js and existing services; no AI provider credentials are required. API startup initializes missing default intent/example records without reactivating retired examples. Apply migrations first; do not use db push/reset. Review `ASSISTANT_ARCHITECTURE.md` for 30-day log retention, 15-minute conversations, current single-API rate limiting and pilot scope limits. Older invoices lacking original payment snapshots require source reconciliation; the Assistant and Counter will not guess their Cash/UPI/Udhar breakdown. The Assistant verification is not approval to deploy the wider product or bypass its remaining provider/Android release gates.

Daily in-app summaries run in an always-running API process. See `REPORT_ASSISTANT.md` for scheduling, deduplication, missed-day behavior and monitoring. `REPORT_SCHEDULER_ENABLED=true` is a test opt-in, not a production secret. Shop downloads generate platform support follow-up entries; they do not replace encrypted offsite database/attachment backups. See `DATA_MIGRATION.md` and `WHATSAPP_RECEIPTS.md` for supported formats and explicit customer-directed sharing boundaries.
