# Disaster recovery

## Actual capability and release gate

Live production provider, schedule, approved retention, offsite recovery, RPO and RTO are **NOT CONFIGURED / NOT MEASURED**. The implemented S3 adapter encrypts full archives with AES-256-GCM and checks the configured bucket lifecycle; configuration and successful live recovery remain release gates. The implemented adapter creates real PostgreSQL custom archives on localhost, verifies archive entries and restores only into a configured pre-created disposable `_restore_test` database. Production restore from the browser is deliberately refused. Archive-list verification alone does not prove successful recovery.

There is **no selective tenant restore** for the shared database. Whole-database recovery affects every tenant. Do not restore one customer's backup over the shared live database or advertise tenant-level recovery.

## Proposed policy — requires provider and operator approval

| Asset | Proposed protection | Retention | Recovery target, unverified |
|---|---|---|---|
| PostgreSQL | Managed continuous WAL/PITR plus daily full backup | 30-day PITR, 90-day encrypted offsite full backups | RPO ≤15 minutes; RTO ≤4 hours |
| Attachments | Private encrypted versioned object storage, replicated/offsite copy | At least 90 days, consistent deletion/retention policy | RPO ≤1 hour; RTO ≤4 hours |
| Build/configuration | Immutable release artifacts and secret-manager versions | Last 10 releases and necessary schema-compatible artifacts | Rollback within 30 minutes after decision |

These are targets, not achieved guarantees. A local same-host archive is neither offsite nor sufficient for provider/host loss. The local adapter does not implement scheduling, retention pruning or archive encryption. Keep database and object-storage recovery points consistent and verify checksums/access restrictions using provider tooling.

## Disposable drill performed by the automated suite

1. Explicitly create an isolated local `*_test` source and `evolix_master_restore_test` target; apply the migration chain to both. Never use the development or customer database as a test source.
2. Run `test/platform-backup.e2e-spec.ts` with the isolated source `DATABASE_URL`. The fixture creates its own operator and recovery marker.
3. Create a real pg_dump custom archive with --enable-row-security --inserts --no-owner --no-acl and a trusted system scope; record its nonzero size. INSERT output permits recovery to an RLS-enforced target without COPY FROM restrictions.
4. Verify `pg_restore --list` has archive entries. Reject a restore request whose confirmation is wrong.
5. Change the recovery marker in the disposable target. Assert the changed value exists before restore.
6. Create a real safety archive of the target; record restore start and operator reason.
7. Restore the verified archive into the disposable target with fixed pg_restore arguments: --exit-on-error --enable-row-security --clean --if-exists --no-owner --no-acl. DDL requires operator/migration credentials; the API runtime cannot own/drop tables.
8. Verify original marker value, organization count, operator record and applied migration count; record success audit and safety backup identity.

The local drill's final test log is linked in the Phase 7 report. This proves a whole-database local restore, not production provider recovery, arbitrary external database support, selective tenant restore, attachment recovery or achieved RPO/RTO.

## Production recovery workflow

1. Incident commander freezes writes and declares affected tenants/services. Record UTC timestamps and request/deployment IDs without secrets.
2. Preserve the current database, WAL, logs and storage state; create a safety backup if safe. Never overwrite the only recoverable copy.
3. Provider operator restores into a **new private database**, using the approved recovery point. Recover corresponding private objects and versions into a separate location.
4. Verify migration state, critical row counts, tenant boundaries, balanced journals, inventory movements/projections, serial allocation history and attachments against documented recovery probes.
5. Run readiness checks and the fresh-tenant/browser regression on recovered staging. Validate recovered data with affected owners where appropriate.
6. Obtain incident-command approval, switch secret-manager connection/storage configuration, roll services, revoke sessions if compromised and reopen writes gradually.
7. Measure actual lost-data interval and recovery time. Document RPO/RTO results, root cause and follow-up work.

Recover MFA_ENCRYPTION_KEY and its appropriate secret-manager version alongside the database. Preserve/recover JWT and backup keys independently; revoke sessions if compromise is suspected. Re-establish migration ownership, runtime grants and forced row policies before reopening writes. Do not give the API owner or BYPASSRLS privileges to make a restore work. The production browser never accepts maintenance credentials; recovery is an operator action.

## Failure scenarios

- **Provider failure:** escalate to provider incident support; restore to approved alternate provider from encrypted offsite copies. DNS, IAM, TLS and storage access must be rehearsed beforehand.
- **Database failure:** use verified PITR/full backup into a new database. Investigate corruption before promotion; monitor connections/replication/space afterward.
- **Bad deployment:** stop new rollout and return to a retained schema-compatible artifact. Do not roll back data blindly. Capture a backup before any compensating data repair.
- **Bad migration:** migrations are additive but PostgreSQL does not provide automatic Prisma down migrations. Prefer a reviewed roll-forward repair. If restore is necessary, recover to a new database and reconcile legitimate post-backup transactions with owners.
- **Secret compromise:** rotate affected secrets/provider credentials, revoke all applicable sessions, preserve audit evidence and investigate object/database access. Never reuse any credential historically committed in the archived development configuration.

## Emergency contacts — fill before launch

Incident commander: NOT ASSIGNED. Database operator: NOT ASSIGNED. Hosting provider support: NOT CONFIGURED. Storage provider support: NOT CONFIGURED. Security contact: NOT ASSIGNED. Customer communications owner: NOT ASSIGNED. Escalation channel and after-hours rotation: NOT CONFIGURED.

Release remains blocked until provider settings, contacts, alert delivery, a production-like restore and measured RPO/RTO are verified.

## Configure the implemented offsite adapter

Use a private separate S3 bucket with Block Public Access and restricted workload IAM. Set BACKUP_PROVIDER=s3, BACKUP_S3_BUCKET/REGION, BACKUP_S3_PREFIX=evolix-backups/, BACKUP_RETENTION_DAYS=30 (or an approved 7–365 day value), and a random 32-byte base64 BACKUP_ENCRYPTION_KEY in the secret manager. Create an Enabled lifecycle rule for that exact prefix with matching current-object expiration. Versioned buckets also need approved noncurrent-version retention. Preserve encryption-key versions separately from archives; key loss makes recovery impossible. Automatic key-rotation lookup is not implemented.

Schedule `node scripts/run-backup.cjs` in the protected backend runtime, initially daily, and alert on nonzero exit and missing backup freshness. This command creates a real archive, privately encrypts/uploads it, downloads/authenticates it, and verifies PostgreSQL archive entries. It does not prove a restore or install a scheduler. A daily archive alone has up to 24-hour data loss; use managed PITR for a tighter approved RPO. Configure BACKUP_ALERT_WEBHOOK_URL only for an authorized private HTTPS operator endpoint. Test real alert delivery.

For a live offsite drill, use a separate recovery environment, the actual archive provider/appropriate retained encryption key, and a pre-created local *_restore_test target. Source connection credentials remain protected. Verify original records, journals, stock/serial history and the 33 applied migrations after changing a recovery marker. Production browser restore remains refused. Managed recovery into a new production-like database and attachment object recovery must also be rehearsed, timed and documented by the operator. Six automated cryptographic integrity tests use a simulated S3 transport; they are not evidence that a cloud account exists.

## Owner shop copy versus operator recovery

Full internal data protection includes Starter ₹75, Smart ₹120 and Pro ₹210 equally. Never filter database/object backup scope by EXPORT_* capabilities, shop preferences or tenant plan. Manual report downloads are separate paid convenience entitlements. Account-exit portability remains available on every tier. The local restore drill now verifies fresh shops on all three plans, including customer, item, posted stock movement and accounting voucher records.

The owner's More → Backup & Restore download is a live paginated NDJSON portability copy. It creates a support follow-up queue entry with an owner-visible notice; it does not run `pg_dump`, include attachment bytes, guarantee a consistent snapshot or implement selective tenant restore. `EXPORT_PREPARED` describes server preparation, not confirmed device delivery. See `DATA_MIGRATION.md`. Operator encrypted offsite archives, attachment recovery, verified restores and measured RPO/RTO remain independently required.
