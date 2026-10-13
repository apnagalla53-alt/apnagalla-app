# Import, reports, backup-request and WhatsApp acceptance

Date: 7 October 2026. This is local acceptance on disposable PostgreSQL databases and a real headed Chromium browser. No production deployment, Play publication, customer message or automatic follow-up call was performed. Existing work in the dirty checkout was preserved.

## Verified changes

- First owner sign-in offers Import your data / Start fresh. Both choices persist; Start fresh deletes nothing. More exposes the migration guide and tools.
- Owner-only preview/mapping/source audit and transactional create-only imports for items, customers, suppliers, opening stock and dues. Inventory and accounting post through existing engines, not direct stock projection writes.
- Vendor presets and official export guides; structured formats with explicit bounds and rejection of unsupported proprietary/PDF/image backups. Unknown fields require acknowledgment and remain in the audit. Actual vendor export samples were not supplied: presets are reviewable mappings, not certified universal adapters.
- Row locks, source identity, immutable review fingerprints, safe retries, correct supplier payable direction, explicit stock cost, rollback on posting failure and rejection of a second opening snapshot.
- Hindi/Hinglish/English report questions use known read-only report intents. Original Udhar, purchased stock and real daily cash/payment definitions are visible. No external AI/SQL generation is claimed.
- Owner-opted daily in-app summaries are generated on the server and stored once per day. Scheduling checks active owner membership, expiry, Retail and Reports entitlements. Visible inbox refresh and read markers work.
- Owner shop-records download creates a Platform Admin follow-up queue entry. Acknowledgment is audited; no automatic call/message. Export includes business records but excludes system credentials and attachment storage paths. It is a live portability copy, not disaster recovery or selective tenant restore.
- WhatsApp receipt buttons on bill success/detail and invoice entries in customer Khata; customer balance chat button; saved or one-off phone; validated country code; message review; actual paid/due/split amounts and item details. Text receipt only; PDF attachment is manual. Test destinations were intercepted.
- Improved readable warning/danger badges, calendar link contrast, native dialog positioning and existing light theme. Stock, dates, pricing, POS and accounting architecture were retained.

## Actual evidence

| Check | Result | Scope |
| --- | --- | --- |
| Headed browser regression | 71 passed / 0 failed / 0 skipped, exit 0 | One worker, visible Chromium, 16.6 minutes |
| Final headed recheck | 8 passed / 0 failed, exit 0 | Import history, fresh owner, actual scheduled inbox, download/follow-up, 360/390/412px, WhatsApp |
| Backend E2E | 213 passed / 0 failed, 17 files, exit 0 | Retail/universal/batch/serial/bundle/platform/isolation/real disposable backup/restore and new migration/report tests |
| Final backend recheck | 23 passed / 0 failed, exit 0 | Includes Khata invoice reference and disabled Reports entitlement preventing summaries |
| Unit/integration | 255 passed / 0 failed, 30 files, exit 0 | Includes 20 parser/normalization/security cases |
| Backend | TypeScript noEmit + production build: PASS | Final source |
| Frontend | TypeScript noEmit + production build: PASS | Final source; build also checks referenced TS projects |
| Prisma | 26-migration clean deploy/status/validate/generate: PASS | Local disposable DB; no reset/data-loss push |
| Production dependency audit | 0 reported vulnerabilities | Backend `npm audit --omit=dev`; not a guarantee of future advisory coverage |
| Spreadsheet | Desktop Excel opened actual CSV: PASS | 88 data rows, 9 formula-like text cells, 0 active formulas; readonly, macros disabled |
| Accessibility scan | 0 serious/critical violations | Seven light-theme core screens; keyboard focus; full human screen-reader pass still open |
| CLI supplement | Receipt reviewed: PASS | Actual saved bill, manual phone normalized once, encoded text link; no real WhatsApp sending |
| New manual PDF | 5 pages rendered and visually inspected: PASS | New-feature checks and remaining release gates |

**539 distinct automated tests** = 71 browser + 213 E2E + 255 unit/integration. The eight and 23 targeted rechecks repeat cases already included; they are not added. Raw browser traces and credential logs remain ignored. Sanitized test names/outcomes and the complete 72-check status list are in `results.json`.

The full backend run preceded the final scheduler entitlement refinement; its affected 23 cases were rerun afterward. The full browser run preceded the final import-history/inbox refinements; all affected migration/WhatsApp cases were rerun afterward. No final failing test is suppressed as a pass.

Disposable DBs: `evolix_import_20261007_test`, `evolix_import_unit_20261007_test`, `evolix_phase8_browser_20261007_test`. The restore test explicitly restricts its destination to `evolix_master_restore_test`. Migration 26 adds seven tables/indexes and aligns two calendar FK RESTRICT actions; no business records are dropped.

## Previously partial / blocked checks

The original 72-check guide now has **65 PASS / 4 PARTIAL / 3 BLOCKED**. A manual PASS can combine browser actions, real API/accounting assertions and desktop Excel; it is not a claim that every check was observed on a physical Android phone.

| Original check | Current status | Evidence / remaining work |
| --- | --- | --- |
| 44: audible voice/volume | PARTIAL | Real Hindi speech request repeated; a human must hear pronunciation/volume on the target phone |
| 56: CSV spreadsheet | PASS | Actual CSV opened in Excel; no active formulas |
| 58: printer/settings | PARTIAL | Settings/print UI passed; installed HP driver currently Offline; no physical bill printed |
| 63: subscription lifecycle | PASS | Real Retail browser trial/complimentary/expired/renewed states and retained item records |
| 67: publishing details | PARTIAL | Draft settings/public policies work; real approved operator/support/package/retention fields still needed |
| 68: Google and email | BLOCKED | Provider capability check still unconfigured; real OAuth/login and SMTP delivery need accounts/configuration |
| 69: offsite backup/recovery | BLOCKED | Disposable pg_dump/pg_restore real tests passed; production provider, schedule/alerts, attachment recovery, RPO/RTO absent |
| 70: signed Android | BLOCKED | No JDK/SDK/java/adb; no signed release or physical Play device; native WhatsApp handoff remains unverified |
| 72: complete accessibility | PARTIAL | Automated/viewport/focus checks pass; human TalkBack/reading order/complete keyboard acceptance remains |

## Critical and high launch gates

Remaining critical operational gates: verified production private offsite database/attachment backup and restore, production hosting/secrets/TLS/monitoring, real operator/support/retention details and accountable incident/deletion workflows. Local backups/downloads do not close those gates.

Remaining high product/distribution gates: actual Google OAuth and recovery email delivery for the promised providers; signed Android compile/install/Play/device acceptance; real printer, audible Hindi and human accessibility; real vendor migration fixtures and reconciliation before advertising certified migration support. Docker image/staging deployment acceptance also remains open. Previously reported development-tool dependency advisories require reviewed tooling upgrades; the final production dependency subset reports zero.

**Release decision: NOT PRODUCTION READY.** Local software acceptance is complete for these additions; operator/provider/device gates remain. Do not deploy automatically.

## Guides and review files

- `docs/DATA_MIGRATION.md`
- `docs/REPORT_ASSISTANT.md`
- `docs/WHATSAPP_RECEIPTS.md`
- `docs/SETUP_GUIDE.md` and `docs/GOOGLE_LOGIN_SETUP.md`
- `docs/PRODUCTION_DEPLOYMENT.md`, `docs/DISASTER_RECOVERY.md`, `docs/SECURITY.md`, `docs/RELEASE_CHECKLIST.md`
- `output/pdf/EVOLIX_Migration_Reports_WhatsApp_Test_Guide.pdf`
- Original full guide: `output/pdf/EVOLIX_Manual_Test_Guide.pdf`

Local review: frontend `http://localhost:5173`; API `http://localhost:8010/api/v1`. These services use disposable test fixtures, not customer production records.
