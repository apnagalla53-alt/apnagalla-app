# Tenant lifecycle and deletion

Archive preserves business data, captures the prior tenant status and ends tenant and support sessions. Restoring reinstates the prior status and does not renew an expired subscription. An ordinary status change cannot bypass an archive.

Permanent deletion is disabled by default. Platform policy must explicitly define a retention period, deletion availability and backup requirement. The preview lists scoped table counts, total rows, legal hold, retention, recovery evidence and typed `DELETE business-code` confirmation. A reason and authenticated platform authority are mandatory.

The database erasure runs in a serializable transaction. Scopes start with the requested tenant/company IDs and follow server-defined Prisma child relations; identifiers are not browser-controlled SQL. Nullable internal links are detached before dependency-ordered deletes. There is no TRUNCATE, broad CASCADE or constraint disabling. An unsupported dependency cycle or cross-tenant integrity conflict rolls back the whole transaction. A deletion receipt and platform audit survive.

Referral financial history is retained with tenant/user identity links detached. Shared recovery archives and platform audit are not erased by tenant removal. Their retention must be documented separately for real customer deletion requests.

Local private attachments use a durable deletion job. A scoped manifest is committed with the database deletion. The job removes each file, verifies that retrieval returns 404, advances a saved cursor, and only then reports COMPLETED. A failed file removal reports STORAGE_RETRY, with the manifest retained for an audited retry from Platform → Tenant erasure jobs. A five-minute lease and compare-and-set claim protect concurrent workers and permit recovery after a crashed worker. Completed retries are idempotent. Database removal and file removal cannot be one atomic operation; an incomplete storage job must remain visible to operators.

Object-store attachments remain blocked until separately verified provider version-erasure tooling exists. Deleting a current S3 key alone would not prove that older versions were erased. Default recovery requires a database backup verified in the past 24 hours. Verification must be followed by the separate restore drill; a verification timestamp alone is not a guaranteed recovery time.

Automated purge acceptance uses only named disposable test tenants, explicitly audited zero-day retention and backup exemption. Never apply that test policy to paying-customer environments. Tests cover local file removal, failed removal with retry, provider-erasure blocking, and preservation of a second tenant. User disable/revocation is independent of tenant lifecycle. Platform can delete an inactive account that has no business-history references after preview and typed confirmation. Historical authorship, including tenant audit records, blocks account deletion; disable access and retain the records instead.
