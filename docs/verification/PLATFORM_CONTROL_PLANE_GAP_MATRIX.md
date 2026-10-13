# Master control-plane implementation gap audit

Audit started 9 October 2026, before changing authentication/platform application code. The workspace has substantial existing uncommitted development; those changes are preserved. No AGENTS.md was found in the workspace or its parent. The user-supplied master specification is the active scope; new native apps, offline sync, WhatsApp and statutory GST-provider work are excluded.

## Existing architecture and gaps

| Specification | Existing implementation | Gap / work | Priority |
|---|---|---|---|
| A, AR, AS, AT | Persisted Starter ₹75 / Smart ₹120 / Pro ₹210, authoritative guards, switches, exports and all-tier backup scope | Restrict normal platform plan selection/editing to the three canonical codes; retain historical legacy records. | High |
| B–E, BD–BF | Password login, hashed passwords, nonce-bound server-validated linked Google login | Public sign-up, mobile normalization/verified identity, OTP provider boundary, safe duplicate/link rules, clear sign-in/sign-up pages. | High |
| F, AG, AH | Reset email service, temporary password flags, revocable sessions, separate platform identity tables | Platform-triggered reset/force-reset/temporary-password actions and explicit role management; no password-reveal API. | High |
| G, AW, AX | Reasoned one-hour support records window; audited read-only bill/item/purchase review | Clear tenant support-mode banner/open action and consistent credential/session controls. | Medium |
| H–K, BB, BC, BH | Provisioning initializes company, branch, location, year, role, ledgers | Durable owner/business/plan/migration onboarding states; searchable distinct-icon business types and safe feature suggestions; resume interrupted setup. | High |
| L–O, AU | Active subscriptions and manual expiry/plan changes | Configurable trial policy, real TRIAL status over one of three base plans, visible expiry and manual trial/pilot controls. | High |
| P–S | Real upload/map/validate/preview/confirm import jobs and competitor export presets | Integrate with onboarding; expose import review in tenant detail. Preserve supported formats and duplicate behavior truth. | Medium |
| T–AA, BA, BL | No referral program | Opaque owner code/link, persisted referral attribution, configurable campaigns, conversion/qualification, idempotent rewards, fraud review and platform/owner screens. | High |
| AC–AF, AJ, AY | Real dashboard, bounded tenant listing/details and usage | Owner/contact/provider metadata, useful search, plan/trial distribution, lifecycle/referral/history detail tabs and previews. | Medium |
| AI | Immutable organization UUID and tenant number, display code | Audited editable display code/business metadata without changing primary IDs. | High |
| AK–AN, BO, CE | Suspend/reactivate and session revocation | Archive/restore, retention/legal-hold policy, scoped dependency preview and atomic guarded permanent deletion on disposable tenants. | High |
| AO–AQ, CJ | Grants/denials/inherit, numeric overrides, downgrade preservation | Before-save plan delta, company shop/configured state in effective view and numeric override reset. | Medium |
| AV, AZ | Real manual payments/refunds and critical-action audit | Referral conversion hook, audit new onboarding/trial/lifecycle/reward/password controls; protect critical writes with reasons/confirmations. | High |
| BP–CC, CL | Existing ignores, frontend/backend containers, route lazy loading | Exact disk/bundle/context audit, safer exclusions, allowlisted dry-run cleanup and measured before/after report. | Medium |
| CF–CM | 1,294 unit and 479 API tests passed in prior commercial scope | Fresh independent baseline, new auth/onboarding/referral/lifecycle/security tests and headed mobile/platform acceptance. | High |
| CN, CR | Existing deployment/security/subscription/import documentation | New requested control-plane, auth/onboarding, referral, lifecycle, credential and disk reports. No final declaration until provider-dependent acceptance is demonstrated. | High |

## Provider and data-safety boundaries

Google Cloud and SMS provider accounts are not configured in this workspace. Implemented transport/verification code and isolated test doubles cannot prove live OTP delivery or Google consent/sign-up. Capability APIs/UI must report this accurately. Online subscription checkout, production offsite backup/scheduling/object recovery, voice and measured production RPO/RTO also remain separate unconfigured gates.

Public sign-up must not activate a paid plan merely from a tap. Trial duration/experience must come from persisted platform policy. Business initialization must reuse the current provisioning service. Identity changes require a verified identity or a reauthenticated account, with no name-based linking. Permanent deletion must be blocked unless archive, typed confirmation, retention/legal and required recovery checks pass; tests must use disposable data.

## Initial disk measurement

`scripts/audit-disk-usage.ps1` measured **2,901,713,024 bytes (2.70 GiB), 41,186 files**, with zero scan errors. Largest top-level consumers: output 1,441,195,562 bytes; backend 780,114,243; frontend 202,599,212; scratchpad 150,734,391; Git 139,262,494; docs 130,741,059. Backend dependencies use 645,412,573 bytes; frontend dependencies 189,520,668. Existing built frontend is 1,785,555 bytes, backend dist 3,639,274 bytes.

[Raw before audit](../../output/platform-control/disk-before.json). No customer data, database, uploaded document, handoff/reference asset, lockfile, migration or test evidence was deleted during this audit. Generated output and development dependencies are not a measure of deployed runtime size.

## Implementation order

1. Extend the existing identity/session architecture and provisioning for verified public signup and durable onboarding.
2. Add persisted account/trial policy and integrate actual import onboarding.
3. Add referrals and authoritative qualification/reward bookkeeping.
4. Extend current platform controls, tenant lifecycle and credential actions with audit/guards.
5. Finish screens, isolated security/regression/browser evidence, documentation and allowlisted cleanup. Restore the Haidery localhost/LAN preview afterward.
