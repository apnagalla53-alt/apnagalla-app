# Approved local shopkeeper improvements — 16 October 2026

This iteration is for localhost review. It has not been committed, pushed or deployed. Existing shop records, usernames, password hashes and Platform operator MFA material are preserved. Database-mutating tests use a disposable localhost database ending in `_test`, with synthetic owners and administrators.

## Account access

- Existing users sign in using username/mobile and their existing password, with Show password and Google sign-in.
- New accounts remain Google-only. Unchecked terms produce a red warning only after clicking Google signup; no Google challenge starts before acceptance.
- Referral/campaign entry is on activation/plan selection, with no referral control or next-step banner on signup.
- Ordinary shop passwords accept eight or more characters, including only numbers or only letters, subject to bcrypt's 72-byte input limit. Operator password/MFA controls remain separate.
- Normal shop sessions use a persistent HttpOnly cookie lasting up to 365 days and renew the existing session when the app reopens. Explicit logout, revocation, password change and access restrictions remain enforced. Passwords are not stored in browser storage. Temporary-password sessions retain their shorter lifetime.

## Billing and transaction recovery

- New shops start a continuous shop-initial series: `Ezzy paints and sanitary` → `EPS-001`, `EPS-002`. Existing bill numbers remain intact. Concurrent sales are serialized for numbering; failed postings consume no number.
- Dates display DD/MM/YYYY. Receipts use the saved posting/creation timestamp in India time rather than interpreting a date-only value as 05:30.
- Bills retain item lines, customer, date, due date, discounts and notes. Payment mode, cash/split amounts and receiver choices return after setup navigation. A distinct bill draft ID prevents another bill from inheriting these choices.
- Purchase, expense, amount-only/Udhar, customer/supplier, Add Item, bulk-entry and GST forms retain scoped drafts. Files remain in memory during setup navigation; a full browser reload can require selecting a photo again. Successful saves and explicit continuation without a failed photo clear the corresponding draft.
- UPI/GST setup links return to the originating transaction. Bill writes keep a stable idempotency identity for response-lost retries.
- Successful payment opens the saved receipt directly, with Share, Print, GST bill, Home, New bill and Bill details controls. A normal receipt is labelled Bill / Receipt; the issued A4 GST document remains a separate workflow.
- Item quantity/price Done actions submit or advance appropriately. Billing banners and totals are hidden during item editing; mobile keyboard handling reduces overlapping controls. Sales channel selection uses a readable list.

## UPI and GST

- Up to ten receiving profiles support nicknames, a default, invoice preference and selection during billing. Payment snapshots retain the actual selected UPI address or an alternate ten-digit receiving number.
- Add QR offers camera scan or gallery selection. QR decoding runs on the device, loads its decoder on demand, accepts a valid receiving UPI URI and discards one-off amounts/references. Imported details require confirmation.
- A QR can supply an encoded display name. This is **unverified**; the system cannot determine a bank-verified account-holder name or verify that money arrived. Payment receipt stays a manual confirmation.
- One compact receipt-confirmation banner replaces repeated UPI instructions. Alternate receiving numbers are validated and recorded.
- GST fields normalize uppercase input, suggest numeric/letter keyboards, preserve the form on error, and explain incomplete GSTIN, state mismatch and check-digit failures. The reported screenshot contains an incomplete GSTIN and a conflicting state; those must be corrected rather than accepted.
- GST setup includes a labelled layout preview. Bill details and the saved receipt provide the GST print workflow. Original tax, reporting eligibility and commercial plan checks remain enforced.

## Corrections, audit and fresh shop

- Edit bill creates an atomic, auditable replacement. Delete/cancel reverses stock/cost, cash/bank journals and customer allocations together; it retains the original record as cancelled.
- Issued GST documents, closed financial years, existing returns, later allocated collections and serial-specific cases can require their existing correction/return workflow. They are not silently overwritten.
- Corrections record the entered editor name and reason together with the actual signed-in account, timestamp and before/after state. Audit history is available from the shop menu and relevant transaction screens; financial-cost visibility remains enforced.
- Platform administration → tenant → Danger Zone offers a fresh workspace with a preview, typed confirmation and administrator password. It archives the selected shop intact, creates an empty active workspace under the same organization, moves its memberships, preserves credentials/subscription and ends affected sessions. Other shops are preserved. Recovery can restore the original workspace; both histories remain retained. Issued GST series and legal holds block unsafe resets/recovery.

## Navigation and speed

- Bottom navigation: Home · Items · + · Khata · Quick Actions. The floating assistant remains available.
- Quick Actions includes Suppliers, Udhar, Aaj ka Galla, Payments and Sales History, filtered by existing access rules.
- Add One / Add Many switches are available. Completely blank bulk rows are skipped; partially filled rows require correction.
- Headers offer English/Hindi language selection. Notification counts sit within the bell and are capped visually at two digits. Bill corrections and UPI setting changes enter the existing notification/sound feed.
- Static receiving settings share brief scoped reads while amounts are typed; financial totals still come from the server. Hidden tabs stop notification polling. Date formatters are reused, and returning devices preload Home code during session verification. QR decoding and Hindi resources remain lazy-loaded.
- Production Render cold starts are hosting behavior; this local change does not purchase an always-on service or change production hosting.

## Verification

Frontend and backend production builds pass. Frontend unit coverage includes 46 checks, including ten-line draft recovery, shop isolation, date/time, QR parsing, safe return paths, GST entry and blank bulk rows. Ten focused backend unit checks pass. API regression batches of 65 and 67 checks passed; a final focused batch of 22 session/financial checks passed after subsequent changes. These batches overlap and must not be added as a unique test total.

Financial acceptance checks verify numbering concurrency, rollback, UPI receiver snapshots, exact stock/cost restoration, zero residual cash/Khata after cancellation, atomic bill replacement, GST validation, audit attribution, fresh workspace recovery and unchanged credentials in isolated fixtures. Website signup/session/onboarding contracts use synthetic accounts and a test Google provider; no production account is created.

Local browser automation is disabled in the app settings. Server rendering, source checks, builds and API/unit tests are verified; actual camera permissions, phone keyboard behavior, mobile layout, print/share dialogs and real Google consent still require device review. Local preview: `http://localhost:5185/login` and `http://localhost:5185/signup`.
