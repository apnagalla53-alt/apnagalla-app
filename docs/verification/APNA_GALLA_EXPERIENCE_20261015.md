# APNA GALLA ADD ITEMS FASTER V1

Local implementation report, 15 October 2026. Overall field-release verification is pending. No commit, Git push, real customer import, production posting, production migration or operator credential change was performed.

## UI

| Check | Result |
| --- | --- |
| Approved Light Theme reused | PASS — warm off-white/white, emerald and shared semantic tokens |
| Approved Dark Theme reused | PASS — same components, deep surfaces and readable semantic tones |
| New design system introduced | NO |
| Bottom navigation preserved | PASS — Home / Bill / Items / Khata / More |
| Subpage Back and one-click Home | PASS — normal intake back; Home remains in the bottom nav |
| Large tap targets, labels, reduced motion | PASS in scoped browser checks |

## METHODS

| Method | Result |
| --- | --- |
| Supplier Bill Photo | PASS locally — actual OCR worker, reviewed purchase and stock/Khata checks |
| Excel / CSV | PASS — genuine XLSX, CSV, mapping, invalid rows and 501-row recovery |
| Voice | LIMITED — editable transcript, controlled parser and typed fallback verified; native microphone recognition needs device testing |
| WhatsApp Share | DEVICE LIMITED — PWA handoff/preview/purge verified; native Android WhatsApp sharing pending |
| Barcode intake | NOT IMPLEMENTED |
| Shelf Scan | NOT IMPLEMENTED |
| Add One Item / Add Many Items | Preserved |

## UNIVERSAL INTAKE

| Check | Result |
| --- | --- |
| Shared intake engine | PASS |
| Draft before commit | PASS |
| Normalized review model | PASS |
| Product matching | PASS — existing/new/possible, explicit choice, conflicting identifiers stay uncertain |
| Field/user confirmation | PASS — provenance and explicit review |
| Tenant isolation | PASS — foreign job/row/photo/confirm/reference access rejected |
| Recovery | PASS — saved review and partial import survive reload |
| Cancellation/late OCR | PASS — cancelled lease cannot recreate rows |

Hindi combining marks are preserved in normalized item names. A supplementary parser/matching check confirms distinct Hindi words do not collapse and contradictory barcode/SKU references do not auto-select an item.

## SUPPLIER BILL

| Check | Result |
| --- | --- |
| Camera/gallery | PASS for UI/file picker and gallery upload; physical camera capture remains a native-device check |
| OCR | PASS on a clear synthetic bill; limited layouts, no general recognition-accuracy claim |
| Existing item matching | PASS |
| New item | PASS |
| Possible-match review | PASS |
| Supplier selection/creation | PASS — existing picker and inline supplier form |
| Unknown conversion | PASS — blocks until reviewed; no guessed pack size |
| Current plan/Shop Features | PASS — rechecked at confirmation, including a disabled Multi-unit scenario |
| Duplicate invoice detection | PASS — same content, different photo, case changes, concurrent confirmations |
| Purchase through existing service | PASS |
| Impossible calendar date rejected | PASS — no JavaScript date rollover |
| Wrong total rollback | PASS — no purchase, new item or payable survives the failed confirmation |
| GST and balanced vouchers | PASS in the existing-item/possible-match/new-item supplier-bill scenario |

Actual browser OCR flow: Soap bar 24 PCS at ₹10 and existing Biscuit packet 10 PKT at ₹8; one ₹320 credit purchase. Authoritative item quantities became 24 and 10. Supplier due increased from the prior ₹240 to ₹560. No bill photo became a product image.

A separate integration scenario checked one existing row, one possible duplicate selected as existing, one new 5% GST item, ₹61 subtotal + ₹2 GST = ₹63 total, balanced posted vouchers, cross-tenant supplier rejection and rollback of a deliberately wrong total. Two concurrent confirmation attempts returned the same saved purchase ID.

## EXCEL

| Check | Result |
| --- | --- |
| Upload | PASS — CSV and real XLSX; XLS supported by the same existing parser, separate device/file corpus pending |
| Auto-map | PASS |
| Ambiguous mapping | PASS — RATE2 requires an explicit selling-price choice |
| Validation | PASS — invalid numbers, formulas, disguised workbook and malformed image rejected |
| Partial-ready import | PASS |
| Duplicate handling | PASS — existing kept, row identities reused, 501 rows saved once |
| Opening stock/cost | PASS — quantity alone does not post stock; explicit unknown-cost opening stock is retained honestly |

Browser CSV scenario saved one ready row while retaining the bad row, survived reload, corrected the bad price and saved it later. Neither item became stock tracked. Backend checks also verified explicit counted stock of three with unknown cost.

## VOICE

| Check | Result |
| --- | --- |
| Capture | LIMITED — browser provider abstraction/UI implemented; hardware speech not verified |
| Transcript | PASS — editable and reload preserved |
| Structured parsing | PASS — English and Hindi digits/common units; uncertain inputs flagged |
| Review/edit | PASS — typed Voice Pencil corrected and saved through review |
| Unsupported-device fallback | PASS — typed entry available |
| Paid AI dependency | NO |

The browser created Voice corrected pencil without stock tracking. Quantity three was a source value, not an automatic opening balance.

## WHATSAPP

| Check | Result |
| --- | --- |
| Share target | PASS locally — service-worker multipart redirect and preview; native OS support remains device limited |
| Supplier bill pipeline reused | PASS |
| Fallback upload | PASS |
| Temporary handoff expiry/purge | PASS for invalid/expired-path rejection and explicit purge behavior; 30-minute expiry is enforced on access |

The handoff opened the authenticated capture preview without automatically posting a purchase. Logout's purge message cleared the dedicated share cache. No universal Android/iOS sharing claim is made.

## ACCOUNTING SAFETY

| Check | Result |
| --- | --- |
| Direct OCR → stock | NO |
| Direct voice → stock | NO |
| Direct Excel → accounting without confirmation | NO |
| Purchase service authoritative | PASS |
| Idempotency | PASS |
| Duplicate purchase protection | PASS |
| Billing, costing/COGS, Khata, Galla, inventory regression | PASS in the focused suites below |
| Existing customer data / operator credentials changed | NO |

## TESTS

Latest results across focused runs, deduplicated by suite. The final intake/simplicity rerun passed 24/24 after the metrics correction. A supplementary matching assertion then passed. The complete intake suite was rerun again (14/14) after the calendar-date guard. Unchanged regression suites retain their passing results; these are not represented as one uninterrupted full-suite run.

| Suite | PASS | FAIL |
| --- | ---: | ---: |
| test/assistant.e2e-spec.ts | 129 | 0 |
| test/costing-profit.e2e-spec.ts | 39 | 0 |
| test/google-business-onboarding.e2e-spec.ts | 14 | 0 |
| test/import-report.e2e-spec.ts | 23 | 0 |
| test/retail-intake.e2e-spec.ts | 14 | 0 |
| test/retail-simplicity.e2e-spec.ts | 10 | 0 |
| test/retail-usability.e2e-spec.ts | 11 | 0 |
| src/auth/business-presets.spec.ts | 4 | 0 |
| src/retail/experience/recommendations.spec.ts | 3 | 0 |
| Total | 247 | 0 |

Backend: 240 distinct integration checks passed. Preset/recommendation unit checks: 7 passed. Dedicated disposable localhost `_test` database; synthetic owners; no application operator account borrowed.

Frontend focused layout/accessibility: 32 PASS / 0 FAIL, plus two category-sheet theme scans PASS / 0 FAIL. The matrix used 360/430 px, light/dark, 100/200% root text on Home, Add Item, intake choices and voice entry. Automated WCAG 2 A/AA checks were scoped to these rendered states; they are not a claim of full-application accessibility certification. Initial transient-theme checks were replaced by settled application theme checks. A visual review also caught enlarged nav crowding; five equal columns and compact wrapping labels were then checked again. Category-sheet dark header contrast was corrected and retested.

Functional browser checks also covered the first zero-stock cash bill, inline purchase supplier/item and quantity preservation, refresh recovery, unit conversion, assistant facts, OCR purchase, CSV exception handling, voice correction and PWA handoff. Onboarding category UI used a deterministic intercepted setup response; real onboarding HTTP behavior was tested separately. No participant was impersonated as a usability study.

Backend build: PASS. Frontend build: PASS. Typecheck: PASS (Nest build and frontend `tsc -b`). No production deployment performed.

## PERFORMANCE

- Initial production JS: approximately 500.29 kB minified / 156.43 kB gzip. Vite still reports its >500 kB warning.
- Lazy intake JS: approximately 31.6 kB / 9.9 kB gzip; OCR is backend-worker only. No browser OCR/Excel/AI or animation dependency was added to initial Retail loading.
- Warm local desktop Vite navigation including network-idle: Home 1,704 ms, Bill 1,189 ms. Not a cold mobile installation benchmark.
- Authenticated item search against the small synthetic catalog: 74, 61, 60, 64, 59 ms; median 61 ms. Not a 2,000-item mobile benchmark.
- Real self-hosted English OCR, one clear 1,700×750 synthetic two-row bill, cached language model: 680 ms, process peak RSS about 276 MiB, engine confidence 92, two rows and ₹320 detected total. Confidence is engine output, not an accuracy percentage. Hindi/cold model/production concurrency were not benchmarked.

## KNOWN LIMITATIONS / FIELD RELEASE CHECKS

1. Provision and validate a separate OCR worker and shared durable private storage before enabling OCR in production. The existing API start command does not run OCR. No paid hosting service was created.
2. V1 handles explicit column-style invoice rows, not every supplier layout. Handwriting, low-quality images, discounts and extra charges may require manual Buy Stock. A complete user-reviewed bill total is required to detect total mismatch.
3. PDF, barcode intake and shelf scanning are absent. New simple items use the minimum selling price required by the existing item service; advanced variants/serials/dimensions stay in their existing workflows.
4. Native microphone recognition, camera behavior and Android WhatsApp/PWA sharing still need representative device testing. Typed voice and gallery/upload fallbacks are available.
5. No unassisted new-participant 20-row bill study was possible here. Readiness-vs-review understanding, real correction accuracy and support/duplicate-product rates need that field study.
6. API document access expires after seven days; physical deletion and 90-day draft redaction require the worker cleanup to run. Share-cache expiry is checked on access/cleanup, not an OS timer.
7. No offline financial posting, general natural-language understanding, universal invoice recognition, universal OS share support or production throughput guarantee is claimed.
8. Native virtual keyboard and cold mobile/network performance remain device checks. Full-app accessibility certification is outside the scoped automated scans.

Overall “APNA GALLA ADD ITEMS FASTER V1 VERIFIED” is deliberately not claimed while the native-device and unassisted participant checks remain outstanding.

## OTHER APPROVED BRIEFS

[Zero-setup/Simplicity report](../APNAGALLA_SIMPLICITY_PHASE.md) covers inline entities, first bill, honest stock/cost, presets, adaptive Home and deterministic suggestions.

[Light Theme report](../APNA_GALLA_LIGHT_THEME_IMPLEMENTATION.md) records exact tokens, Home/Add Item/Onboarding/Ask changes and shared themes.

[Universal Intake architecture and deployment](../APNA_GALLA_UNIVERSAL_INTAKE.md) documents provider boundaries, recovery, permissions, retention and worker setup.
