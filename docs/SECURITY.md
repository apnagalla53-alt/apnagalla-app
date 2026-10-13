# Security boundary and known limits

The independent [12 October audit](verification/SECURITY_AUDIT_20261012.md) records the original findings. The [remediation report](verification/SECURITY_REMEDIATION_20261012.md) records fixes and new regression evidence. Production approval remains withheld for shared administrator credential rotation and staging/provider gates. Local fixes do not prove a deployed environment.

The latest account/provider linking, temporary-password and tenant erasure rules are documented in [credential policy](SECURITY_CREDENTIAL_POLICY.md), [auth and onboarding](AUTH_AND_ONBOARDING.md) and [tenant lifecycle](TENANT_LIFECYCLE.md). Live SMS, Google consent and recovery email remain unconfigured in local verification; test provider boundaries do not establish transport security or delivery.

## Tenant and platform authorization

Tenant JWTs and platform JWTs use separate secrets. Every protected tenant request reloads the active user, database membership, persisted unrevoked/unexpired session and active company/subscription. Client-supplied company/branch/FY IDs are checked against membership and company ownership. Altering a signed token's payload cannot grant access.

The HTTP boundary resolves resource IDs under the authorized company, rejects foreign/nested relationship writes and returns generic missing-resource responses. Posting services validate ownership. Forced PostgreSQL row security covers company-owned business tables and their foreign-key child chains (90 tables in the verified schema). Identity membership and identity audit remain explicit application boundaries. New endpoints still require company/branch predicates and isolation tests.

Every HTTP request begins with unverified database scope. Validated tenant/Platform guards select company/system authority; every Prisma transaction applies SET LOCAL, and deferred queries retain their creation scope. Trusted provisioning and verified session issuance explicitly enter system scope. Background operator jobs are trusted code. The runtime must neither own tables nor have SUPERUSER, BYPASSRLS, CREATEDB or CREATEROLE; startup checks this. RLS protects against omitted predicates, not a compromised server or arbitrary SQL using its credentials. See [PostgreSQL's privileged bypass rules](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

Only database-assigned `ADMIN`, `OWNER` and `TENANT_ADMIN` roles receive tenant-owner permission treatment. The `system_role` Boolean does not grant blanket access. Other staff require explicit permissions; declared multi-permission requirements require all permissions. Tenant roles never grant platform authority.

Platform endpoints verify a separate persisted platform session, active/unlocked Platform user and database `SUPER_ADMIN` role. Raw SQL, shell commands, arbitrary filesystem paths and credentials are not accepted from the admin browser. Administrative actions require recorded reasons where applicable and create Platform audit entries. Support access is a time-limited, audited, read-only Platform review; it is not tenant impersonation.

## Entitlements and subscription safety

Effective capability = active feature + global rollout + tenant override or plan default. Global OFF overrides tenant allow. Backend checks basic Retail module entitlements and advanced item capabilities on new operations; hiding frontend controls alone is insufficient. Suspended/inactive/expired subscriptions reject access without deleting data. Downgrades and feature disables preserve historical records. Historical advanced item reads remain available under active basic module access.

Bundles now post physical components through the inventory engine, including FEFO lots, and preserve an immutable composition snapshot for returns. Nested/serial/variant bundle components are rejected with a clear individual-billing instruction. Modifiers enforce required selection limits and tenant-owned option prices on quote/post, with immutable price snapshots. Staff/devices/business administration use persisted tenant-scoped APIs. Unsupported catalog capabilities must still not be advertised as complete.

## Passwords and sessions

Passwords use bcrypt; tenant provisioning/first administrator use cost 12. Production owner creation requires 12+ characters with uppercase, lowercase, number and symbol. First Platform operator creation requires 16+. There is no hardcoded production password and no startup-created production administrator.

Access tokens expire after one day and require a persisted session. Logout, device revocation, user disable and forced logout invalidate sessions. There is no refresh-token flow. Ten failed password attempts lock the account; operator recovery is audited. Login, recovery, OTP, reports, catalog queries, labels and uploads use atomic shared PostgreSQL rate windows with hashed keys and expiry housekeeping. Configure exact trusted ingress addresses and complementary edge limits.

Password change, verified email recovery, hashed single-use reset tokens and temporary-password expiry are implemented. SMTP delivery must be verified before launch. Mobile OTP sign-in is not a second factor. Platform MFA is mandatory in production and enabled by default elsewhere. An explicit `PLATFORM_MFA_REQUIRED=false` permits password-only Platform login in development/test; production startup rejects that setting, and the authorization guard still requires MFA in production. Password verification with MFA enabled creates a five-minute challenge; verified TOTP enrolls/authorizes; AES-256-GCM protects secrets; counters and challenges prevent replay. Five wrong attempts exhaust a challenge. Eight hashed recovery codes are shown once and work once. Preserve MFA_ENCRYPTION_KEY separately. Operator recovery uses scripts/platform-mfa-reset.cjs with separate maintenance credentials, verified identity and an audit reason, revoking sessions/challenges. Retail owner/staff MFA is not implemented. No fake recovery-email success is returned; owner invitation delivery remains unavailable.

Browser sessions use HttpOnly, SameSite=Strict cookies and Secure in production. Browser login JSON excludes bearer tokens. Mutating cookie requests require HMAC session-bound CSRF headers and reject untrusted origins. LocalStorage contains a cookie marker, CSRF metadata and UI state. The previous storage version is discarded and requires re-login. Native Android tokens stay in memory, without auth-store persistence. A guarded browser-session exchange accepts a valid bearer session. HttpOnly prevents reading cookies from scripts; it cannot prevent every action by same-origin injected code. See [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). Never put tokens in URLs/logs.

## Financial and inventory safety

Financial Retail POSTs accept a company-scoped idempotency key; production requires it. Fingerprinted request mismatch fails, concurrent equal keys serialize, and the saved response commits in the same transaction as financial work. The browser retains a key after an unknown network outcome and retries without recreating an invoice. Payment, return and posting concurrency still require continued realistic load testing.

Inventory posting locks item/serial rows before projection checks and updates. Only the authoritative posting system should mutate `StockBalanceProjection`. Generic serial reversal is rejected; original-invoice serial returns preserve allocation/warranty history. Journal posting verifies branch/FY/account/party scope and double-entry balance; reversals lock the source voucher. Reconciliation counts never create automatic cash-adjustment journals.

## Attachments and secrets

Attachments are authorized by company/entity and limited to 5 MiB PNG/JPEG/WebP. Signature checks are followed by full decoding, a 20-million-pixel limit, format/frame validation and re-encoding that removes metadata/appended content. Original filenames are normalized; stored paths are generated. A tenant quota (default 1 GiB) is checked under a transaction advisory lock. SVG/executable content is rejected. Image sanitization is not antivirus scanning; real S3 permissions/provider round trips and operational malware scanning remain staging gates.

Inject secrets through a secret manager. Environment files, dumps, uploads and scratch files are excluded from deployment. EVOLIX's local API now uses dedicated restricted database credentials, independent JWT keys and an MFA key. Maintenance credentials stay outside the API process. Known weak local passwords were replaced and sessions revoked; the ignored local access handoff uses Windows-user-bound DPAPI encryption. Business record counts were preserved.

The historically committed shared PostgreSQL administrator password remains valid and in Git history. Per the user's explicit instruction, other projects and that password were untouched. Isolation does not invalidate a superuser credential: if reachable, it can still access EVOLIX and other databases. Coordinated rotation and authorized history cleanup remain release blockers. Any OAuth client secret previously shared in screenshots should also be revoked in Google Cloud; this app's ID-token integration requires only the public client ID.

Logs contain request ID, route template, status, duration and version. They omit request bodies, passwords, authorization headers, raw queries and SQL-bound data. Generic 500 responses avoid leaking internals. Review all future provider error handlers for redaction.

Barcode fields are escaped before HTML generation; previews use a sandboxed iframe and print documents have a script-free CSP. Production frontend builds do not generate source maps. Full backend/frontend npm audits reported zero known vulnerabilities after removing unused deployment tooling and patching transitive dependencies; rerun audits in CI as advisories change. Payment webhooks are not implemented, so unsigned events are not accepted. Future integrations must verify original-body signatures and deduplicate events before subscription crediting.

## Backup and disclosure

Real localhost custom archives and disposable whole-database restore exist. The offsite S3 adapter implements AES-256-GCM archive encryption, identity-bound authentication and retention-policy verification, but its live provider and schedule are not configured. PITR is a managed-provider responsibility and selective tenant restore is unavailable. See `DISASTER_RECOVERY.md`; do not label local archive success production ready.

Security contact and disclosure mailbox: NOT ASSIGNED. Record vulnerabilities privately with tenant/resource scope and sanitized request IDs. Obtain approval for external disclosure or customer messaging; this audit sends no external messages and performs no production deployment.

## In-app Assistant V1

The deterministic Assistant is read-only and uses no external LLM or generated SQL. Every registered tool enforces existing permissions and effective entitlements before tenant-scoped entity resolution and execution. Company/branch authority comes from persisted authenticated memberships, never arbitrary request payload. Conversations bind company, branch, user and login session, expire after 15 idle minutes and reject stale concurrent versions. Query logs redact secrets, JWTs, email and phone-like numbers, omit financial answers and are purged after 30 days. Platform phrase approvals and deactivations are audited, and cannot add executable mappings. Current-state stock/balance questions cannot masquerade as historical reconstructions. See `ASSISTANT_ARCHITECTURE.md` and its verification report.

## Google identity and privacy lifecycle

Google authentication checks signed ID tokens through the official library and a server-issued single-use nonce. Accounts link explicitly using the current password and immutable Google subject; email equality cannot grant access. Google login is tenant-only and cannot grant Platform authority. Credentials are not logged or stored as app sessions. Native Android uses Credential Manager, not embedded WebView OAuth. Live web/Android acceptance is still a release gate.

Account export and deletion requests remain accessible after subscription expiry. Portability exports use explicit company scopes and exclude credentials/storage keys; they are live paginated data, not backups. Deletion requests are persisted pending workflows and do not silently destroy shared-company accounting. The operator must complete the approved retention/deletion procedure and publish real contact details before Play submission. Native app data backup is disabled; QR sharing grants access only to generated files in its dedicated private cache directory.

## Migration, reporting and customer-directed sharing

Migration requires owner authority and effective Retail access. Source uploads are bounded; XML entities, unsafe keys and nested generic records are rejected. Row transactions route opening stock/dues through authoritative inventory/accounting services, preserving source fields in a tenant-scoped audit. Stable source identities and row locks protect retries from duplicate opening postings. Unmapped data is never silently applied to arbitrary tables.

Report questions select known read-only intents, not arbitrary SQL. Queries and inbox/read markers scope company, branch and user; scheduling revalidates active owner membership, subscription and entitlements. No external AI provider receives shop data in this version.

Shop backup requests expose owner contact details only to the authorized Platform support follow-up queue, with an owner-visible notice and audited follow-up completion. Requests never trigger an automatic outbound call/message. Apply contact and import-source retention policy before launch.

WhatsApp receipt links contain a validated phone destination and a user-reviewed text receipt. They contain no session tokens or unauthenticated invoice-access links. The owner explicitly opens WhatsApp and sends there; opening the chat is not a delivery/payment confirmation. Native external intents accept only HTTPS `wa.me` numeric destinations. Physical Android behavior remains unverified until signed-device acceptance.
## Commercial entitlements and exports — 9 October 2026

Plan access, tenant overrides, global rollout and optional company shop preferences are enforced by the shared server entitlement service and route/tool guards. Owner-only preference changes are tenant-scoped, locked and audited. Staff/user permissions still apply to exports and assistant tools. Subscription expiry/downgrade never deletes business history. The BACKUP policy cannot exclude a tier or tenant through a commercial override.

Manual EXPORT_* capabilities differ by tier and are checked on the server; a browser download button does not authorize data. Complete business NDJSON excludes credentials/sessions/storage paths and checks completion. Explicit persisted account-exit/data-portability requests permit required business records irrespective of convenience-export tier. Customer/supplier/report CSV files and their filters remain company-scoped and audited. Document metadata export is not an attachment-file archive. See SUBSCRIPTION_ENTITLEMENTS.md.

