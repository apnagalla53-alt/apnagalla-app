# Neon transfer verification — 14 October 2026

The operator authorized preserving both existing shops and transferring their current data to the selected Neon production database. This was an actual data migration, not an automated business-flow test.

## Result

**TRANSFER COMPLETE.** Target: the operator-selected direct Neon `neondb` connection in Singapore, PostgreSQL 18.6. The source remains `localhost/evolix_trade_dev` and its application configuration/data were not changed.

| Preserved record group | Count |
|---|---:|
| Shops | 2 |
| Retail accounts | 3 |
| Platform administrator accounts | 1 |
| Items | 4 |
| Parties | 2 |
| Sales | 0 |
| Purchases | 0 |
| Photo attachments | 0 |

Preserved shops: **Qusai Personal Check — EVX-00022** and **ganesh — EVX-00023**. User IDs, password hashes, Google identity links, tenant IDs and account status were preserved exactly. No account was reset, renamed, disabled or replaced. Operator credentials are not included in this report or release.

## Verification

- A fresh local snapshot/archive was created. All 133 tables have snapshot row counts and content fingerprints; the archive SHA-256 was checked before restore. Recovery files and migration connection secrets remain ignored local files.
- Schema-only restore passed in a dedicated disposable localhost database ending `_test`. No customer or operator account rows were copied into that validation database; no operator account was used for tests.
- Neon was guarded as empty before restore. Existing public schema and provider database roles were retained. No `--clean`, target database drop/reset, table truncation, or ownership/security bypass was used.
- Restore, runtime grants, all table fingerprint comparisons and table ownership/row-security checks ran in one transaction. Any failure rolled back the target import.
- The Windows PostgreSQL client's system CA lookup initially failed. A trusted CA bundle from the installed Node runtime fixed the connection, retaining `verify-full` hostname/certificate validation and required channel binding.
- The generated restore SQL leaves `row_security=off`. A protected-table verification query initially failed and the import rolled back. That behavior was reproduced on the empty local schema; setting row security back to **on** fixed it. The corrected restore committed with the original RLS policies enabled and forced as recorded in the source.
- All 133 table fingerprints matched before commit. Post-commit, all 128 tables outside intentional session/token revocation matched the snapshot again; no differences were found.
- Imported retail/Platform sessions and one-time authentication challenges/tokens were revoked on the destination only. Passwords and enrolled identity records remained unchanged.
- All 35 migration checksums match the source code, with no pending migrations. Prisma 5.22 `migrate status` on Neon reports the schema is up to date.
- Runtime has zero application-table ownership, zero role memberships and no superuser/BYPASSRLS/database/role creation privileges. Table reads and INSERT/UPDATE/DELETE grants are present; migration history is read-only for runtime.
- The four production startup RLS checks (`items`, `parties`, `sales_invoices`, `attachments`) all passed.

## Remaining deployment work

The runtime account's actual connection must still be saved privately and tested before configuring Render. Cloudinary live integration, production secrets, hosted API, Netlify domains, Google HTTPS origins, SMTP/recovery and hosted acceptance are not completed by a database transfer.

This is a snapshot transfer, not ongoing replication. Any business changes made on localhost after the snapshot require a reviewed final synchronization before hosting cutover. No existing photo files needed moving because the source contains zero attachments.

Next: [cloud launch steps](../CLOUD_LAUNCH_STEPS.md). Do not expose the migration-owner connection as the API runtime connection.
