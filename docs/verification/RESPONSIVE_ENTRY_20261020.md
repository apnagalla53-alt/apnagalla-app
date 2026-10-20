# Responsive bill and Udhaar entry — 20 October 2026

Implemented locally in D:/evolix-trade-erp. No commit, Git push, deployment, production migration, or production data change was made for this request.

## Reproduced causes

- `useKeyboardLayout` closed its keyboard layout on input blur before the visual viewport had recovered. The bill Add button moved about 65 px between pointerdown and pointerup; the Udhaar footer moved about 80 px. The first gesture added no bill line and sent no Udhaar save request.
- A pending item lookup disabled Add. An otherwise valid first tap could not submit until a second attempt after the response.
- Search results arriving while Add was pressed inserted suggestions in the page, moving the button about 62 px and losing that click even on a laptop.
- In the controlled Udhaar-entry-and-customer-picker flow, three customer list requests were observed, including a redundant parent fetch. The initial selector request also waited 250 ms before starting.

## Changes

- Keyboard layout now follows viewport geometry through blur and remains stable until an active pointer gesture's native click has completed. Cancelled gestures, window blur, rotation and cleanup release the lock. Desktop focus alone still does not imply a keyboard.
- Item search results and errors defer their visual update through an active gesture, without pausing the request. The handler keeps controls stable through the first tap.
- Add can accept a valid first tap during lookup. It starts an outstanding debounce immediately or shares the existing in-flight request, displays `Checking item…`, and adds only after successful resolution. A synchronous guard prevents duplicate submissions. Failure permits an explicit retry; closing the form prevents a delayed insertion.
- Lookup reuse is restricted to the mounted entry's name, item/service purpose, user/session, company, branch and financial year. A submit finishing after an authentication or shop-context change is discarded.
- Existing saved item identity, rate, GST, stock checks, configured-item requirements and server pricing are retained. Item creation still belongs to the successful bill transaction.
- Removed the redundant customer fetch in RetailAmountSale. The selector starts its initial list immediately and still debounces typed searches. The measured flow now makes one customer list request rather than three.
- Added nine keyboard-layout regression tests. No backend or schema changes were needed.

## Verification

- Frontend unit suite: **87 passed, 0 failed**. Report: output/multi-business-20261020/responsive-entry-verified-unit.json.
- Frontend production build: passed. Log: output/multi-business-20261020/responsive-entry-verified-build.log.
- Browser first-click checks: new item during pending search; one shared lookup; keyboard Enter; invalid price/quantity/GST; failed search and retry; saved item identity/rate; viewport restoration during the press; search results arriving during the press; mobile/laptop horizontal overflow.
- Real synthetic Udhaar save: one pointer gesture, exactly one POST, amount 45, customer due increased by exactly 45. The local save and receipt-navigation measurement was 655 ms; this is not a production hosting benchmark.
- Real synthetic service/parts sale: two half-quantity entries merged into one service line, plus one part line; canonical total and paid amount both 250.
- Mobile-size (390 px) and laptop (1440 px) preview images are in output/playwright/responsive-entry-20261020. Mobile keyboard geometry was simulated in Edge; a physical mobile-device keyboard was not tested.
- Browser mutations used the existing isolated synthetic owners on the dedicated localhost database ending in `_test`, through the owned 5192/8042 preview. Application operator credentials/accounts and production customer records were preserved.
- The separate publication checkout output/cloud-release/software remains clean and untouched.

The changes address measured entry responsiveness and unnecessary requests. Production hosting wake-up times and network/database latency were not changed or benchmarked.
