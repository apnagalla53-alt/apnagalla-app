# Platform control plane

The existing Platform module manages tenants, plans, subscriptions, effective features, limits, users, devices, payments, support, backups and audit. Retail tokens cannot authorize Platform endpoints. Each request verifies the separate platform JWT, an active unrevoked platform session and the persisted SUPER_ADMIN role.

Normal plans are STARTER, SMART and PRO. Legacy database plan records remain for history; new custom commercial plans are rejected. Tenant exceptions use explicit feature or numeric overrides. Resetting a numeric override restores inheritance. Feature resolution includes the selected company's shop preferences and configuration state. Plan changes preserve historical data and tenant overrides; the UI previews lost defaults and price before saving.

Tenant list search covers shop/code/contact/owner email and name. Detail tabs include owner/provider state, setup requests, imports, referrals, support, usage, audit, backups and lifecycle controls. Neither provider subject IDs nor password hashes are public fields. Contact display is not proof of identity verification.

Administrative actions require recorded reasons. Platform support is a one-hour, audited read-only record review with a visible shop banner; it does not create unrestricted impersonation or expose passwords. Access actions revoke sessions, send reset links to verified email, force password change or set a hash-only temporary password with a 24-hour expiry and mandatory change.

Business display codes and metadata can be edited. Primary tenant UUIDs remain immutable. Archive is the safe removal path; see TENANT_LIFECYCLE.md. The browser cannot supply SQL or shell commands to these controls.

User contact changes never create verified identities. Tenant role assignment requires a role, company and optional branch in that tenant, rejects platform roles, protects the last active owner, and revokes previous sessions. Credential changes invalidate pending recovery/link tokens and sessions; temporary passwords are stored only as bcrypt hashes. Disabled, unused accounts can be removed after dependency preview. Accounts referenced by business history are retained.

Online subscription checkout, automatic reward payouts, OTP delivery, live Google consent and offsite backup verification require external configuration. Manual subscription receipts represent actual operator-recorded payments; no provider response or revenue is fabricated.
