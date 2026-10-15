# Retail usability verification — 14 October 2026

Status: implemented locally; no Git commit, push or production deployment.

## Behaviour

- Home starts with **Quick Bill**, an amount-only sale. Item billing remains available.
- The bottom navigation provides Home throughout Retail workflows and receipts, plus the plan-enabled AI assistant.
- Suppliers is in default sidebar Quick Access. Smart and Pro users can choose and reorder up to eight shortcuts for Home and the sidebar. Preferences are isolated by user and shop on this device; they do not grant API permissions.
- New staff usernames are their normalized Indian mobile numbers. Existing staff with an unambiguous saved mobile number can sign in by phone without bulk renaming accounts. Duplicate legacy phone aliases are rejected.
- Staff passwords require at least eight characters and fit bcrypt's 72-byte limit. Composition rules are optional for staff. Owner and Platform administrator policies remain stronger. First-login password changes, recovery and reset screens offer Show password.
- Staff sessions last up to 30 days after the temporary password is replaced. Sessions use persistent HttpOnly cookies and validated database records. Logout, expiry, disable and administrator/password revocation remain effective. Temporary and owner sessions retain their existing one-day limit.
- Staff Home does not request summaries outside the staff member's permissions. Existing valid sessions reopen the shop from the sign-in page.
- Item billing searches inline instead of opening a second search popup while typing. Ordinary items add directly. Variant, serial, measurement and other required item configurations retain their forms.
- Payment, item and selection forms do not focus editable fields automatically. Dialogs focus their Close button and do not restore focus to an input that would reopen the keyboard.
- Calendar includes original Udhar on the sale date, including bills without a collection date. It also shows collection reminders on due dates while unpaid. Original credit with a payment snapshot remains visible after collection. Legacy records without snapshots can only reconstruct currently outstanding credit. Credit is filtered before the 1,000-record safety limit; larger result sets show the existing truncation notice.
- Notification inbox includes recent sales, purchases, receipts/payments, expenses, item/stock/party/staff updates, collection reminders, today's tasks and daily reports. Server-side permissions, company/branch scope, subscription status and RLS continue to apply.
- Notifications refresh after local writes, on focus and every 30 seconds while the app is open. Permission is requested after an explicit tap; sound can be disabled/tested. Stable delivered IDs prevent repeated sounds for unchanged updates. First load does not replay historical alerts. Read/delivery preferences belong to this user/shop/branch on this device.
- The notification worker displays supported mobile/desktop notifications and opens the related Retail route. It does not cache data, subscribe to push or deliver updates after the app closes. Browser/device restrictions may suppress sound or system notifications; the inbox remains available. See [MDN Notifications](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API) and [Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

## Workflow colours

The user authorised continuation after reviewing the proposed colour system. Retail, business administration and Platform administration now resolve their task colours centrally. No new animation library, image asset or network request is required.

| Workflow | Accent |
| --- | --- |
| Quick Bill / amount-only sale | Amber |
| Item bills, payment and GST invoices | Blue |
| Items, stock and stock adjustment | Teal |
| Purchases, suppliers and buying list | Violet |
| Khata, collections and money | Orange |
| Expenses and sale returns | Rose |
| Calendar and tasks | Purple |
| Reports | Navy |
| AI assistant | Indigo |
| Staff and access | Cyan |
| Settings | Slate |
| Completed sales | Green |

A sticky task banner identifies the workflow with a title, icon and brief instruction. Draft item bills display their current product-line count. It stays visible while scrolling; returning to the browser does not change the task or clear the draft.

Action meanings remain consistent across task colours: Save/Confirm/Restore use green, Delete/Archive/Disable/Revoke use red, stock reductions and password resets use amber warnings, and informational notices use blue. Existing confirmation and permission checks remain effective. Closing a dialog remains a neutral action. Notifications receive an explicit semantic tone from the server, with frontend compatibility for older feeds; icons and text accompany the colours.

Both Light and Dark appearance preferences apply to this system. The measured task-banner text contrast is at least 4.73:1 across all defined palettes; semantic action/message pairs also exceed 4.5:1. These measurements cover the new palette pairs, not a full accessibility audit of every existing screen.

## Evidence

Dedicated localhost database: `evolix_usability_1791998219650_test`. All mutating API, fixture and browser checks used this disposable database and separately provisioned users. Application operator accounts and real shop/customer data were not used or modified.

Backend checks: 61 distinct focused checks pass across `retail-usability`, `calendar-price-only`, `tenant-administration` and `auth-lifecycle` suites. The initial combined run passed 59; the final changed usability suite passed all 11 (including two additional ambiguity/suspension checks). Backend Nest and frontend TypeScript/Vite production builds pass.

Headed Chromium checks at 390px:

- Quick Access choose/reorder/save is reflected in both Home and the sidebar and survives refresh.
- Editor available on Smart and Pro; Starter has no Edit button.
- Undated Udhar bill appears on today's calendar.
- Amount-only and item billing complete through actual API writes. Home remains visible on payment, bill detail and sale-complete screens.
- Item search results are inline; ordinary item selection opens no secondary configuration dialog.
- Quick Bill and Payment initially focus Body; choosing Cash keeps focus on the button, not an input. No horizontal overflow observed (375px content within 390px viewport with scrollbar).
- One completed sale triggered one notification sound; a subsequent feed refresh produced no duplicate sound and retained the current workflow.
- Show password toggles visibility. Staff sign in by phone and a plain eight-character password, then reload and reopening `/login` return to the same shop.
- Fifteen principal Retail routes were checked in both Light and Dark appearance: Quick Bill, item billing, stock, Add Item, purchasing, Khata, collections, expenses, calendar, assistant, reports, settings, staff, import and Galla. Each had the correct palette/title, visible Home navigation and no horizontal overflow at 390px.
- The task banner stays at the viewport top while scrolling Payment. Cash selection retains button focus and has readable selected-label contrast.
- Item Archive and Restore were exercised through the actual UI/API using a disposable fixture. Their buttons and notifications use red and green respectively. The final 11-check backend usability run also checks successful and destructive notification tones.

Screenshots and private fixture/log files remain ignored under `output/`. Do not publish private helper files, test connection settings or generated synthetic credentials.

## Publication

Reviewed application files are copied to `D:/evolix-trade-erp/output/cloud-release/software` for manual review/publication, without staging or committing. No new database migration is needed for this usability change. The separately prepared activation-campaign migration remains part of the earlier unpublished website/demo feature.

Workflow colours are included in this local handoff. The live services will receive these changes after manual publication/deployment; no Git push was performed.
