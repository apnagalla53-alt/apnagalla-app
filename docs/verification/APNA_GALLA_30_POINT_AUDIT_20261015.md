# Apna Galla: 30-point local acceptance audit

Date: 15 October 2026. Target: `http://localhost:5185`, loopback API on port 8025. All database writes and provisioned demonstration shops used the dedicated disposable localhost database ending `_test`. Existing customer shops and the application operator account were not modified. Nothing was committed or pushed.

This report distinguishes observed browser behavior, passing HTTP/accounting tests and source inspection. “Implemented” does not mean every possible device and workflow was manually tested. Real Google OAuth, native phone keyboards, notification audio on physical devices and PWA installation on an actual phone were not exercised in this pass. The local API uses a test Google client; use **/password-login** for the supplied demo accounts.

## Confirmed gaps

1. **Quick Bill has no item-name field.** `/retail/quick-sale` currently takes an amount, payment method and optional customer. A note is hidden in Optional Details. Writing an item name + price is available through **Make Bill → item search → Add & Sell**, not through Quick Bill. The requested simplified named-item Quick Bill is therefore missing. Amount-only sales remain functional.
2. **Automatic category suggestions cover only a few words.** Rice, tablets, shirts and notebooks worked in the browser. Cable/wire, running shoes, mobile phones and tea did not get a category. Hardware's rule searches for an “electrical” category while its actual suggested category is “Cable & Wire”. This is a vocabulary mismatch. Footwear, mobile and tea rules are absent. This was an audit; these rules were not silently changed.
3. **Business personalization is partial.** All eight organizations receive the correct saved business preset, category list and suggested units. Pharmacy batch prompts, garments/footwear size prompts and electronics serial prompts appear under Advanced Item Features. Most screens still share the same basic form; Quick Bill has no category suggestions, and inline Add & Sell has units but no category picker. Starter still needs the relevant commercial entitlement for paid features.
4. **Recent/frequent billing search priority is missing.** Item search is ordered by name and ID in `RetailService.getItems`; billing does not add frequency or recency ranking.
5. **Requested analytics are incomplete.** First bill timing, item success, bill save/failure/resume and suggestion events exist. Explicit 7-day return, bill/purchase abandonment, draft-loss and duplicate-attempt metrics are absent. Intake cancellation measurements and retry protection do not cover all of these requirements.
6. **Some onboarding guidance and Home details are incomplete.** Customer/supplier empty states do not explain inline creation during billing/purchasing. Established-shop Home shows Sales, Expected Cash, Customer Due and Supplier Due, with no dedicated Stock summary card.

## 30-point checklist

| # | Requirement | Result and evidence |
|---|---|---|
| 1 | First bill without inventory setup | Implemented. HTTP acceptance starts with an empty tenant, creates an untracked item and posts a balanced first bill. |
| 2 | Inline Add & Sell: name, price, quantity | Implemented in Make Bill. The shared creator returns item + quantity to the mounted bill. HTTP item and posting acceptance passed. This is separate from the Quick Bill gap. |
| 3 | Unknown stock is not zero | Implemented. Browser shows “Stock not set up yet”; HTTP acceptance excludes untracked items from out-of-stock results. |
| 4 | Unknown cost is not a free cost | Implemented. First-bill acceptance verifies zero cost coverage, no invented known cost, and historical unknown costs remain unknown after later purchases. |
| 5 | Amount-only sale remains available | Implemented. Browser opened Quick Bill from the central + and confirmed the amount-only form. It has no item-name field. |
| 6 | Create item inside Purchase | Implemented. Purchase creator returns directly into the purchase line; HTTP acceptance verifies actual stock and cost after posting. |
| 7 | Create supplier inside Purchase | Implemented. Shared inline supplier form stays within the purchase component. HTTP acceptance verifies the resulting supplier due. |
| 8 | Create customer inside Bill/Khata | Implemented. Bill has an inline form; Khata uses Add Customer and returns to the new customer's Khata. HTTP acceptance verifies customer credit posting and balance. |
| 9 | Create category inside Add Item | Browser verified. Category was selected without losing the typed name or price. It is persisted with Save Item; the demo item was not saved. |
| 10 | Add Many Items | Implemented. Mobile bulk editor, paste rows and row validation exist. HTTP acceptance verifies all-or-nothing duplicate-SKU failure and safe retries. |
| 11 | Business-type personalization | Partial. Eight correct presets and differentiated units/prompts verified; automatic category matching fails for four tested examples. |
| 12 | Friendly purchase/sale units and pack size | Implemented. All eight Pro demos show “How do you sell it?” and “How do you buy it?”. HTTP acceptance verifies box-to-pieces conversion and genuine cost. |
| 13 | Simple Add Item, advanced fields disclosed | Implemented. Name, price, category and unit first; optional Additional Details and Advanced Item Features below. Browser inspected across eight presets. |
| 14 | First Bill / Import / Set Up Items after onboarding | Implemented. Welcome dialog contains all three choices; Make First Bill is primary. Real Google authentication was outside this local pass. |
| 15 | Adaptive Home | Partial. Empty demo shops show task buttons, not zero-summary cards. Established-shop source uses actual summaries but lacks a Stock summary card. |
| 16 | Maximum three Daily Partner suggestions | Implemented. HTTP acceptance verifies maximum three and uses actual tenant activity. |
| 17 | Actionable suggestions | Implemented by source inspection: low stock leads to a prefilled Need List action; due and cost suggestions link to their relevant workflows. |
| 18 | Why am I seeing this? | Implemented. Suggestion UI exposes reasons derived from server-provided facts. |
| 19 | No fabricated AI recommendations | Implemented. Suggestions come from recorded reports/data; HTTP tests verify actual customer dues and isolation from an empty tenant. Floating assistant also returned an accurate empty-shop sales answer. |
| 20 | Shopkeeper wording | Implemented for the main item fields and personalized prompts. Advanced/accounting screens retain necessary technical terms. |
| 21 | Progressive complexity | Implemented. Optional details/capabilities are disclosed and paid options remain gated. |
| 22 | Recent/frequent items first | **Missing.** Alphabetical name/ID ordering, with no recency/frequency ranking in billing. Source-confirmed; no claim of a passing ranking test. |
| 23 | Empty states teach creation during work | Partial. Items supports the intended journey; customer/supplier empty-state text still encourages separate setup rather than explaining inline creation. |
| 24 | Contextual teaching, no long tutorial | Implemented. Three-choice welcome, optional getting-started tasks, and contextual form hints observed. |
| 25 | Light/dark premium UI | Implemented. Shared theme tokens and semantic colors remain; floating assistant passed eight mobile layout/accessibility combinations. Full visual conformity to every original reference was not re-audited. |
| 26 | Bottom navigation | Updated to latest instruction: **Home · Items · + · Khata · AI Assistant**. + has no visible text, an accessible Quick Bill label, and opens `/retail/quick-sale`. Shop drawer remains available. |
| 27 | Commercial restrictions | Preserved. HTTP acceptance verifies Starter cannot write paid pack conversions through an inline request. Pro demos do not grant features to other plans. |
| 28 | Authoritative accounting | Preserved. No posting engine edits in this pass. Acceptance verifies balanced journals, customer/supplier balances, stock and cost projections. |
| 29 | Product analytics | Partial. Event ingestion, numeric-only measurements, deduplication, scoped metrics and first-bill timing passed; retention/draft-loss/abandonment/duplicate-attempt coverage is incomplete. |
| 30 | Focused acceptance tests and business presets | Passed: 10 isolated HTTP acceptance tests + 4 business-preset unit tests. Eight separate demo accounts also passed browser login and preset inspection. |

## Eight empty demonstration organizations

All eight owners signed in successfully using the actual password form. Each organization has a 60-day Pro trial to allow broad UX inspection. Business types are already assigned; shop details can be changed in Account and settings. No demo inventory, customers, suppliers, purchases or sales were seeded. The Kirana welcome choice is Start fresh; the other seven welcome choices were left unselected.

Credentials are in the **ignored local handoff** `output/simplicity/eight-category-demo-access.private.md`, not in this report or source control.

| Shop | Typed sample | Automatic category | Additional observed behavior |
|---|---|---|---|
| Kirana / Grocery | Rice | Rice / Grains | Kilograms, grams and sack become the suggested sale units. |
| Pharmacy | Paracetamol tablet | Medicines | Strip/box/pieces units and batch/expiry prompt. |
| Hardware | Cable wire | **No suggestion** | General hardware units include metres/feet; manually choosing Cable & Wire gives category hints. |
| Garments | Cotton shirt | Clothing | Pieces/set units and sizes/colours prompt. |
| Footwear | Running shoes | **No suggestion** | Pair first; shoe sizes/colours prompt. |
| Electronics | Mobile phone | **No suggestion** | Pieces/box/set and serial numbers/warranty prompt. |
| Stationery | Notebook | Notebooks & Paper | Pieces/ream/packet units. |
| Restaurant / Cafe | Tea | **No suggestion** | Plate/cup/glass available, but tea does not select Tea & drinks automatically. |

## Requested branding and floating assistant

The exact supplied logo is used as the source. Its shop symbol was cropped/resized for favicon, PWA, Apple and Android launcher icons; the full optimized logo is on the login/signup pages. The Retail header uses the same symbol. App title, manifest name/short name, Apple title, native display name and relevant visible branding say **Apna Galla**. The PWA manifest retains its existing app ID and share target. Maskable icons have separate safe padding.

The round floating chat button is present throughout the signed-in Retail shell, above the bottom controls. It lazy-loads the existing assistant in a dialog, keeps the transaction route mounted, retains the conversation when closed/reopened, supports Escape and returns focus to the launcher. The conversation resets across user/company/branch/year changes. Existing permissions and read-only assistant APIs remain authoritative.

Browser verification: a real assistant request returned HTTP 201 with an accurate empty-shop sales answer. An unfinished item name/price survived open → ask → close. Conversation retention and focus restoration passed. Layout passed at 360/430 pixels, light/dark, 100%/200% text (8 cases): no horizontal overflow, dialog within viewport, launcher above navigation, and no WCAG 2 A/AA axe violations in the dialog. The central + and direct AI tab were clicked successfully.

The final frontend build passed. Existing Vite warning: main chunk remains about 500 KB before compression; the assistant remains a separate lazy chunk. Logo on login is about 14 KB and the small app symbol about 17 KB. No new runtime dependencies were introduced.

Existing installations can retain the old icon/name until the changed build is deployed and the browser refreshes its install metadata. Reinstalling the PWA may be necessary on some devices. This pass changed local source only; no cloud deployment, native APK build or physical-device installation is claimed.

Local evidence: `output/simplicity/category-demo-browser-audit.log`, `floating-assistant-browser-check.log`, `brand-and-category-browser-check.log`, `eight-category-demo-empty-verification.json`; screenshots in `output/playwright/`. These generated files are excluded from version control.
