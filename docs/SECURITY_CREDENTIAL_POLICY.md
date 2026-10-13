# Credential and support policy

Existing passwords are never retrievable. The database stores bcrypt hashes. No public/platform response, UI or audit entry may expose password hashes, raw reset tokens, OTP values, Google ID tokens or session JWTs. Contact information is not a verified sign-in identity.

Username/email and verified provider identities intentionally identify an account globally; tenant access still requires scoped membership and a revocable session. Customer and supplier contact numbers are business data and do not confer login rights. Changing a contact number cannot verify it or replace a provider identity.

Retail and platform authorization use separate JWT secrets and persisted revocable sessions. Tenant payload IDs are validated against company/branch membership. Platform role assignment remains separate from tenant roles; changing a retail token or user payload cannot promote a shop user.

Owner-approved identity linking requires possession of the new provider identity and reauthentication to the existing account. Email/name matching cannot merge accounts. Legacy unverified mobile contact numbers must be explicitly linked after password sign-in.

Reset links go only to verified recovery emails through a configured provider and expire after 20 minutes. Platform temporary passwords are operator-chosen strong values, stored only as hashes, expire after 24 hours and require change. The API returns a success message rather than echoing the password. Sessions are revoked when access is reset, disabled, archived or explicitly invalidated.

Support review is time-limited, read-only and audited. Production secrets live in the hosting secret manager/ignored environment files. Public frontend configuration contains no privileged credentials. Default trials and destructive tenant removal are disabled until deliberately configured and audited.
