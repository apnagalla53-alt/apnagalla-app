# Retail UX modernization — acceptance evidence

Verified on 8 October 2026. This report covers the Retail interaction refresh. It is not a production release, a live provider certification or a claim of unrestricted reference parity. Existing dirty work was preserved; no deployment or commit was performed.

## Counts

| Measure | Count / definition |
|---|---|
| ZIP references individually reviewed | 26 |
| Additional stock references individually reviewed | 4; total references 30 |
| Baseline Retail files audited | 67 TSX screens/components, not 67 distinct routes |
| Major workflow groups in final screen matrix | 30 |
| Groups changed by this refresh | 27; 3 retained with shared styling |
| Native select declarations found / replaced / retained in Retail | 40 / 40 / 0; mapped declarations can generate many runtime fields |
| New reusable UI exports | 18 public entries, 17 implementations; SearchableSelectionSheet aliases SelectionSheet |
| Home actions | 6 card actions + Galla and Customer Paid Me shortcuts |
| Navigation | 30 links by default; 31 when multiple stock locations is enabled |

## Final screen matrix

| Screen | Reference Pattern | Previous EVOLIX | New EVOLIX | Dropdowns Removed | Browser Verified | Status |
|---|---|---|---|---|---|---|
| Home | Quick cards, date chips, private totals, reminders | Long module grid and competing summaries | Six action cards + Galla/customer collection shortcuts; drawer holds modules | 0 | Period/privacy/navigation | DONE |
| Navigation drawer | Grouped icon rows | Tools in Home grid | 30 links; 31 with stock locations enabled | 0 | Menu/searchable workflows | DONE |
| Items / Stock | Manage / bulk, export, search, stock cards | Plain list and stock buttons | Selection, paged CSV, server search, low/out filter, item actions | 0 | Create/search/filter/export | DONE |
| Add Item | Product/service, sections, unit/category sheets | Native kind/unit/tax selectors | Direct type/tax/mode, complete grouped fields, unit/category sheets | 4 | Saved category/unit/description | DONE |
| Item Detail / composition | Cards and useful item actions | Component dropdown | Component sheet; persisted universal data; batch/serial/movement sheets | 1 | Kit, variant, serial, movements | DONE |
| Variant / unit setup | Progressive advanced configuration | Dedicated setup page | Existing setup retained with shared touch/focus styling | 0 | Variant/pack/bundle setup | RETAINED |
| Make Bill | Customer/item sheets, clear line and date controls | Embedded selectors and separate legacy modals | Paged catalog/customer sheets; native line/customer/quick-item dialogs | 1 | All item modes, retry, inline item | DONE |
| Line configuration | Selected rows, advanced choices | Variant/unit/batch native lists | Variant/unit/batch sheets; serial/modifier rules retained | 3 | Variant, units, FEFO, serial, modifier | DONE |
| Quick Sale / Udhar | Compact amount and direct method/channel | Customer/channel dropdown | Server party search, direct channel, method cards, due date/proof | 2 | Amount cash/credit/partial | DONE |
| Payment / completion / receipt | Method cards, clear paid/due state | Redundant method dropdown | Cash/UPI/card/bank choices; split QR uses UPI amount; server-search Udhar customer sheet | 1 shared | Cash, UPI, Udhar, split, receipts | DONE |
| Bill History / held bills / returns | History tabs and recovery | Separate routes | Sales workflow tabs and shared mobile styling; authoritative return rules | 0 | History, held cart, return/resale | DONE |
| Purchase History / Add Purchase | Buy/pay/history and grouped forms | Supplier/item/type dropdowns | Workflow tabs, remote supplier/catalog, direct source/type, unit/variant sheets | 5 + item shared | Itemized/quick/cash/credit/partial | DONE |
| Customer Khata / Customer Detail | Search, due cards, collection CTA | Initial customer page only | Server search/Load More, cards and existing payment/WhatsApp/reminders | 0 | Customer/payment/collection | DONE |
| Supplier list / Khata | Search, add, credit balance | Simple rows/initial page | Search/pagination, cards, Add Supplier sheet, existing ledger | 0 | Create/search/supplier dues | DONE |
| Customer / Supplier form | Primary details + progressive credit fields | Supplier category/cycle dropdowns | Direct category/visit cycle, optional details/credit grouped | 2 | Saved fields and visit calendar | DONE |
| Customer / Supplier payment | Full/partial and payment method cards | Party/method dropdowns | Remote due-party sheet, four method cards, proof/date/note | 1 + method shared | Customer and four supplier methods | DONE |
| Add Expense / Owner withdrawal | Category and payment cards | Category dropdown | Category sheet, grouped form, workflow tabs, sticky save | 1 + method shared | Both accounting flows | DONE |
| Expense History | Summary/search/date/category filters | Inline category selector | Business/owner/history navigation and Apply/Clear filter sheet | 1 | History and filtered expense | DONE |
| Need List | Fast status and customer requests | Six native select declarations | Direct source/priority/status filter; party/status sheets; native Add Need | 6 | Saved customer request/status | DONE |
| Daily Galla | Date chips, counter summaries/count | Inline custom date form | Today/Yesterday/Custom Date sheet; real drawer/count/history retained | 0 | Exact drawer 2220 and Short 20 | DONE |
| Calendar | Month, visit/receivable/payable/task tabs | Existing functional calendar | Shared mobile sizing/theme; real visits/promises/holiday coverage retained | 0 | Visits/tasks/due dates | RETAINED |
| Reports / Report Assistant | Dashboard cards and periods | Inline custom filters and language selectors | Custom period sheet; direct language choices; authoritative report cards | 2 | Reports, export, Hindi queries, schedule | DONE |
| In-app Assistant | Easy question/action flow | Language dropdown | Direct language choices and mobile styling; real permission rules retained | 1 | Owner/cashier/approval/network | DONE |
| More / Account Settings | Categorized account cards | Existing grouped settings | Consistent cards/targets and full drawer discovery | 0 | More/settings routes | DONE |
| Staff / Roles & Permissions | Retail cards and action sheets | Links to ERP admin pages | Retail staff search/create/edit/roles/access/password/device actions | 0 | Roles/create/disable/revoke | DONE |
| Stock Locations | Optional advanced location cards | Branch dropdown/plain list | Branch sheet; native create/view/standard-item transfer; hidden if disabled | 1 | Real total-preserving transfer | DONE |
| Documents | Search/filter/preview/download | Category dropdown | Document-type sheet and shared cards; scoped private file APIs retained | 1 | Authenticated preview/upload retry | DONE |
| Voice Settings | Direct understandable choices | Language/rate dropdowns | Language/speed segments; save/preview remains explicit | 2 | Persistence/greeting isolation | DONE |
| Data Migration / first login | Guided choice and preview | Three native app/type/mapping selects | Searchable app/type/mapping sheets and safe import/start-fresh welcome | 3 | Fresh onboarding/import/delayed dialog | DONE |
| Backup / Subscription / Devices / Security / UPI / Printer / Profile / Business / Help | Categorized, real account workflows | Existing working account pages | Shared touch sizing/light/dark; existing provider and permission boundaries retained | 0 | Core regression; external-device gates remain | RETAINED |

DONE means the described interaction was implemented and checked; RETAINED identifies working flows preserved by this refresh. Dropdown counts shared across screens are counted once in the baseline total.

## Final dropdown matrix

| Screen | Field | Previous | New control | Status |
|---|---|---|---|---|
| assistant/RetailAssistant.tsx | Answer language | Native select | Direct segmented choices | DONE |
| billing/RetailLineConfigurator.tsx | line-variant | Native select | Searchable selection sheet | DONE |
| billing/RetailLineConfigurator.tsx | line-unit | Native select | Searchable selection sheet | DONE |
| billing/RetailLineConfigurator.tsx | line-batch | Native select | Searchable selection sheet | DONE |
| billing/RetailNewBill.tsx | invoice-channel | Native select | Direct segmented choices | DONE |
| components/PaymentChoices.tsx | Payment method | Native select | Payment icon cards | DONE |
| components/PurchaseItemSearch.tsx | id | Native select | Server-search item sheet with Load More | DONE |
| components/SupplierVisitSettings.tsx | edit-visit-cycle | Native select | Direct segmented choices | DONE |
| imports/RetailImport.tsx | Previous app | Native select | Searchable selection sheet | DONE |
| imports/RetailImport.tsx | Data type | Native select | Searchable selection sheet | DONE |
| imports/RetailImport.tsx | Column mapping | Native select | Searchable selection sheet | DONE |
| reports/ReportAssistant.tsx | Answer language | Native select | Direct segmented choices | DONE |
| reports/ReportAssistant.tsx | Scheduled summary language | Native select | Direct segmented choices | DONE |
| RetailAddExpense.tsx | expense-category | Native select | Searchable selection sheet | DONE |
| RetailAddItem.tsx | item-kind | Native select | Direct segmented choices | DONE |
| RetailAddItem.tsx | selling-mode | Native select | Direct segmented choices | DONE |
| RetailAddItem.tsx | item-unit | Native select | Searchable selection sheet | DONE |
| RetailAddItem.tsx | item-gst | Native select | Direct segmented choices | DONE |
| RetailAddPurchase.tsx | purchase-mode | Native select | Direct segmented choices | DONE |
| RetailAddPurchase.tsx | purchase-supplier | Native select | Server-search party sheet with Load More | DONE |
| RetailAddPurchase.tsx | 'purchase-variant-' + index | Native select | Searchable selection sheet | DONE |
| RetailAddPurchase.tsx | 'purchase-unit-' + index | Native select | Searchable selection sheet | DONE |
| RetailAddPurchase.tsx | purchase-category | Native select | Direct segmented choices | DONE |
| RetailAmountSale.tsx | amount-sale-customer | Native select | Server-search party sheet with Load More | DONE |
| RetailAmountSale.tsx | amount-sale-channel | Native select | Direct segmented choices | DONE |
| RetailExpenses.tsx | expenses-category | Native select | Category sheet inside Apply/Clear filter sheet | DONE |
| RetailItemDetail.tsx | component-add | Native select | Searchable selection sheet | DONE |
| RetailNeeds.tsx | need-filter | Native select | Direct segmented choices | DONE |
| RetailNeeds.tsx | 'need-status-'+n.id | Native select | Searchable selection sheet | DONE |
| RetailNeeds.tsx | need-source | Native select | Direct segmented choices | DONE |
| RetailNeeds.tsx | need-customer | Native select | Server-search party sheet with Load More | DONE |
| RetailNeeds.tsx | need-supplier | Native select | Server-search party sheet with Load More | DONE |
| RetailNeeds.tsx | need-priority | Native select | Direct segmented choices | DONE |
| RetailPartyForm.tsx | supplier-visit-cycle | Native select | Direct segmented choices | DONE |
| RetailPartyForm.tsx | supplier-category | Native select | Direct segmented choices | DONE |
| RetailPartyPayment.tsx | party-payment-party | Native select | Server-search party sheet with Load More | DONE |
| settings/RetailDocuments.tsx | documents-category | Native select | Searchable selection sheet | DONE |
| settings/RetailStockLocations.tsx | location-branch | Native select | Searchable selection sheet | DONE |
| settings/RetailVoiceSettings.tsx | greeting-language | Native select | Direct segmented choices | DONE |
| settings/RetailVoiceSettings.tsx | greeting-speed | Native select | Direct segmented choices | DONE |

The pending-dues filter also now renders an icon, explanation and working Show All Customers action when no matching dues exist.

## Reusable controls

Sheet, SelectionSheet, SearchableSelectionSheet (alias), SearchField, LoadingState, EmptyState, SegmentedControl, MobileSelect adapter, ActionSheet, FilterSheet, StickyActionBar, TabStrip, RetailWorkflowTabs, InventoryCard, ItemCategoryPicker, RemotePartySelect, StockTransferSheet and ItemStockDetails. Existing PaymentChoices and PurchaseItemSearch were modernized rather than recreated.

Native dialogs provide browser focus trapping and background inertness. Explicit Escape handling closes search sheets on the first press, closing returns focus to the trigger, required selection proxies retain form validation, and selection rows support arrow/Home/End keys. Automated axe checks cover serious/critical issues in tested core screens and the category sheet; this is not full accessibility certification.

## Data and engine boundaries

Inventory low/out filters run before server pagination and include counted zero stock. Item/variant/barcode search and custom category lookup use company scope. Saved descriptions use existing custom attributes; custom categories persist through the saved item. Units remain actual unit codes; choosing a packaging name does not invent a conversion factor.

Only supporting catalog/category read queries were added to the backend for this UX change. Physical stock and journals still use the existing posting systems. No inventory projection mutation, tenant bypass, pricing rewrite or accounting rewrite was introduced by this refresh.

Location transfers are available for standard counted items. Existing transfer DTOs do not accept variant, batch or serial identities; those items are explicitly unavailable in the transfer sheet. Full tracked-item transfers remain a separately scoped engine task.

Wholesale-price fields, refer-a-friend rewards, platform-native contact picker, automatic WhatsApp delivery and unsupported financial reports are not decorative controls. Wholesale is outside Retail scope; unreconciled profit/valuation reports are not fabricated. Dates/attachments/printer/share/voice capabilities retain truthful device/provider states.

## Issues found and fixed

| Severity | Finding | Resolution |
|---|---|---|
| HIGH | A deferred first-login welcome could be underneath an active billing modal and block clicks | Welcome now uses the native Sheet and appears only on Home; late responses defer until Home |
| HIGH | Filtering only the initially loaded stock page omitted matching low/out items on later pages | Tenant-scoped projected-stock filter runs before pagination; search includes active item/variant barcodes |
| HIGH | Udhar payment customer selection only loaded the first page | Debounced server search, Load More, loading/error/retry and native selected rows; verified billing to customer 101 |
| MEDIUM | Long customer names clipped due amounts; caption remained white on a light summary card | Full-width responsive party buttons and correct theme text colors; explicit amount bounds and axe checks |
| MEDIUM | Search-sheet Escape/focus return and grouped listbox semantics failed browser checks | Explicit Escape/focus handling, valid option structure and native dialog focus trap |
| MEDIUM | Staff permission checkbox reverted during an asynchronous save | Optimistic selected state with error rollback; real API-backed role and staff regression |
| MEDIUM | Supplier loading state lacked status semantics and screenshots could capture incomplete data | Accessible status state and browser wait before visual capture |

The first 62-test headed run had 60 PASS / 2 FAIL. One was the welcome race; one was a generated test password without a required digit. Intermediate reruns also exposed the inverse welcome/billing open order and an incorrect test-only customer URL. The final welcome behavior and test fixtures correct both. Failures are retained in the intermediate evidence rather than relabeled as passes. Prisma generation initially encountered Windows DLL locking; stopping the verified test API process allowed generation, rebuild and restart to pass.

## Verification

| Check | Actual result | Exit code |
|---|---|---|
| Backend database E2E, all configured files | 18 files / 292 passed / 0 failed | 0 |
| Backend unit suite, all configured files | 31 files / 1,030 passed / 0 failed | 0 |
| Headed Chromium Retail suite, latest outcomes across main run and reruns | 65 unique scenarios passed / 0 unresolved failures | Final targeted runs 0 |
| Frontend TypeScript | npx tsc --noEmit and npx tsc -b passed | 0 |
| Frontend production build | npm run build passed | 0 |
| Backend TypeScript and production build | npx tsc --noEmit and npm run build passed | 0 |
| Prisma validation | Schema valid | 0 |
| Local development migration status | 27 migrations, up to date | 0 |
| Disposable clean migration chain | Previously deployed all 27 migrations successfully; no UX migration added | 0 |
| 360x800, 390x844, 412x915, 768x1024, 1280x900 | Light and dark route/overflow checks passed | 0 |
| Tenant isolation | Backend regression and explicit stock/category search boundaries passed | 0 |

Browser evidence is an aggregation, **not one all-green 65-test invocation**. The main run passed 60 of 62; failed scenarios were fixed and passed on subsequent targeted runs, and three new regressions were added (delayed welcome, customer 101, pending-dues empty state). The final visual/staff/lifecycle rerun passed 7/7, the final welcome/search rerun passed 7/7, the final 390/empty-state run passed 2/2, and the icon/type repair check passed 1/1. Each source JSON retains its real attempt results. The aggregate uses the latest outcome for each current file/title/project and excludes the superseded welcome test title.

The 10 Retail browser files are assistant, item-configuration, retail-field-coverage, retail-smoke, manual-acceptance, retail-improvements, import-report-acceptance, whatsapp-receipt, partial-rerun and retail-ux. This does not claim every unrelated frontend test file was rerun for this UI change.

Screenshots cover all 20 tested Retail routes in both themes at 390px, plus selected key screens at the other widths. They were visually reviewed; customer amount clipping found in those images was fixed and checked explicitly against card bounds. Core/category/Khata axe checks have no serious/critical violations. Browser resizing simulates small keyboards; actual phone keyboard and hardware behavior remain required.

Evidence: [acceptance summary](../../output/verification/retail-ux/acceptance.json), [browser aggregate](../../output/playwright/ux-final-aggregate.json), [final visual JSON](../../output/playwright/ux-visual-final-results.json), [backend E2E log](../../output/verification/retail-ux/backend-e2e.log), [backend unit log](../../output/verification/retail-ux/backend-unit.log), [frontend build log](../../output/verification/retail-ux/frontend-build.log). Screenshot/trace folders remain local under output/playwright/ux-final-main, ux-dialog-final, ux-visual-final and ux-empty-final. The updated blank PDF has 114 checks, 21 pages, 349 interactive fields and no preselected results.

## Reference coverage

The pre-change audit names all 30 supplied references. The following final mapping records equivalent fields/actions and any material differences.

| Reference screen(s) | EVOLIX equivalent | Fields and actions covered | Difference / reason | EVOLIX enhancement | Status |
|---|---|---|---|---|---|
| Home light/dark/private/lower (4) | Home | Store/account, date/privacy, actions, summaries, events, low stock, UPI | Exact carousel/artwork not copied; reminders show real data | Galla, assistant and complete drawer | Covered |
| Account top/settings (2) | More / settings | Business, documents, backup, devices, plan, profile, invoice, theme, support/logout | Referral rewards/native store rating await actual programs/distribution | Import and security controls | Covered with reasons |
| Drawer top/middle (2) | Upper-left drawer | Business/stock/people/reports/account links | Unimplemented experimental modules excluded | Optional locations, assistant, import | Covered |
| Reports summary/discovery/empty (3) | Reports | Period, summaries, categorized reports, zero states/export | Staff analytics and unauthoritative profit/stock valuation not fabricated | Hindi questions and real scheduled notifications | Covered with reasons |
| Supplier details/add/list empty (3) | Suppliers / Add Supplier | Regular/distributor, name/contact, credit, optional tax/address, search/add | OS contact picker requires native permission flow; manual contact works | Visit schedule and calendar | Covered with reasons |
| Customer list (1) | Khata | Search, balance/phone, add and open/customer collection | Balance shows loaded scope honestly | WhatsApp and promise date | Covered |
| Supplier payment header/body (2) | Pay Supplier | Party, full/partial, date, cash/UPI/card/bank, proof/note/confirm | Shop incoming QR is never shown for supplier payout | Remote party search | Covered |
| Purchase top/lower (2) | Buy Stock / Quick Bill Record | Source, supplier, cash/credit/partial, amount, bill/date/due/proof/note | Invoice image does not invent stock without itemized receipt | Itemized universal receiving | Covered |
| Invoice top/lower, Udhar, Quick cash (4) | Make Bill / Udhar / Quick Sale | Customer/items/amount/date/due, channel/payment, proof/note | No automatic payment confirmation from QR | Universal item sheets and exact split QR | Covered |
| Owner/business expense history and add (3) | Expenses | Category/amount/date/method/proof/note, totals/search/filter | No fake totals | Owner withdrawal kept separate | Covered |
| New inventory reference (1) | Items / Stock | Workflow tabs, manage/bulk, export/select/search/filter, rate/unit/stock/minimum/status | Add Item names catalog action clearly; stock receipt remains Buy Stock | Paged server filters and item action sheets | Covered |
| New Add Stock reference (1) | Add Item | Name/type/unit/category/current/minimum/cost/selling/MRP/description | Wholesale price excluded by Retail scope | Variant/measurement/batch/serial/kit modes preserved | Covered with reason |
| New unit reference (1) | Unit sheet | Packaging/measured units, large rows/close | No implicit pack factors | Search/selected/keyboard state | Covered |
| New category reference (1) | Category sheet | Search, grouped icon rows, close | Exact icon/color/brand not copied | Custom and existing shop categories | Covered |

Reference rows account for 30 images (26 ZIP + 4 later images). These are equivalent interactions with documented boundaries, not a claim that unsupported native or wholesale features exist.

## Remaining checks outside this browser acceptance

Stock movement preview currently displays the existing bounded API page (up to 100 movements); complete historical movement pagination remains a follow-up. The staff role list currently displays up to 100 roles. These limits do not change posting or remove historical data.

A real Android device must still verify keyboard, camera/gallery, native sharing, physical printer, audible Hindi voice and signed-app behavior. Google OAuth, email, payment callbacks, offsite backup/restore and Play Store publishing need real configured accounts and release checks. They are not made production-ready by this visual refresh. No automatic deployment was performed.

