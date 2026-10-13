"""Rebuild the owner acceptance PDF; no credentials or real customer data."""
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/pdf/EVOLIX_Manual_Test_Guide.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('Segoe','C:/Windows/Fonts/segoeui.ttf'))
pdfmetrics.registerFont(TTFont('SegoeBold','C:/Windows/Fonts/segoeuib.ttf'))
GREEN=HexColor('#35634b');INK=HexColor('#243229');MUTED=HexColor('#57665b');PALE=HexColor('#edf4ee');BORDER=HexColor('#dde6de')
W,H=A4
BODY=ParagraphStyle('body',fontName='Segoe',fontSize=10.3,leading=14,textColor=INK)
SMALL=ParagraphStyle('small',parent=BODY,fontSize=9,leading=12,textColor=MUTED)
SECTIONS=[
('Start, login and navigation',[
('Local and phone access','PC: open http://localhost:5173/login. Phone: use the PC LAN address and port 5174; see docs/LAN_TESTING.md. Sign in as a shop owner.','Home opens with your correct business name. Keep servers running; check LAN firewall if the phone cannot connect.'),
('Centred Bill button','At 360, 390 and 412px widths, inspect the bottom navigation and tap Bill.','Order is Home, Items, Bill, Khata, More; + and Bill are centred. New Bill opens.'),
('Home and shop tools','Inspect Home actions and summaries. Tap the three-line Menu at the upper left; inspect each group and open Stock and Reports.','Grouped tools open their named modules; the drawer closes after selection. Home stays clear and readable.'),
('Summary dates and privacy','Switch Today, Yesterday, This Week and This Month. Hide and show amounts.','Real totals change with the selected period. Hidden amounts reveal correctly; errors offer retry.'),
('Refresh and keyboard','Open a deep link such as /retail/calendar and refresh. Use Tab and Enter from the login page.','Pages reload without blank content. Focus is visible and buttons have meaningful labels.'),
('Logout and denied access','Log out. Open /retail/bills directly. Try opening Platform with the Retail login.','Protected pages request login; a tenant account cannot become a Super Admin.')]),
('Price-only billing and counted stock',[
('Save an unknown item while billing','New Bill: search a unique item name. Choose Add Item & Bill. Enter selling price ₹200; leave stock unconfigured.','Only price is required after the name. Item is saved and added to the bill; no opening stock is invented.'),
('Find it again','Finish a cash bill. Open Stock and search that item. Start a new bill and search it again.','The saved item appears as Stock not counted and can be selected for another bill.'),
('Start actual counting','Create a supplier. Buy Stock: receive 5 of that item at ₹100 cost. Check Stock.','Tracking starts at 5 received units. Historical uncounted sales are not retroactively deducted.'),
('Return an older uncounted sale','Open the first price-only bill and return its item using the original bill. Recheck Stock.','Refund/return posts once; the counted quantity remains 5, rather than increasing to 6.'),
('Respect counted stock','Sell 1 of the now-counted item. Try selling more than the remaining quantity.','First bill reduces stock to 4. Overselling fails clearly and does not post an extra bill.'),
('Inventory and alerts','Stock: use Inventory, Low Stock and Add Stock tabs. Open Filter for Out of Stock. Search a service or uncounted item.','Counted alerts exclude services, kits and uncounted items. New catalog items and actual receipts are accessible.')]),
('Bills, payment modes and UPI split',[
('Cash and change','Add a stocked item priced ₹480. Choose Cash, enter ₹500 received and complete.','Change is ₹20; one ₹480 bill is saved and actual cash sale enters Galla.'),
('UPI setup','More → UPI & Payments: save your own valid UPI ID and payee name. Try an invalid ID first.','Invalid ID is rejected. The valid profile persists after refresh; this is not bank verification.'),
('Half cash, half UPI','Bill total ₹500: choose Split, enter Cash ₹250 and UPI ₹250. Inspect QR before completing.','QR says Pay ₹250.00 via UPI, never ₹500.00. Cash and UPI are manually confirmed separately.'),
('Split on the saved invoice','Complete that split bill. Open its details and Print invoice; enable invoice QR in Payment Settings.','Both ₹250 methods are listed. QR records the UPI portion and says not to pay again; no misleading Pay Now on a paid bill.'),
('Udhar and promise date','Choose a credit-enabled customer, bill on Udhar and set the promised payment date.','Bill is unpaid; due increases; Calendar shows the bill on that date. No physical cash is counted.'),
('Split amount validation','Enter cash+UPI below or above the bill total. Then correct the split to exactly the total.','Completion is blocked until the split equals the bill total. Use Udhar for an unpaid customer bill; no missing amount is silently treated as paid.')]),
('Bill corrections and network recovery',[
('Quantity, price and discount','Create an itemized bill. Change quantity/rate and apply an allowed discount. Continue to Payment.','Server quote and final bill agree, including tax and units; no silent pricing error.'),
('Customer selection','Choose a customer or add a new customer from New Bill. Also test a walk-in cash bill.','Correct customer/name is preserved; customer is required for unpaid credit.'),
('Hold and resume','Hold a bill, open Held Bills and resume. Try resuming while another cart is active.','Items/options/customer persist; the current cart is not silently overwritten.'),
('Retry after lost response','Use a disposable bill and browser developer tools to interrupt its response after submitting. Retry the retained bill.','A retry resolves the same operation; no second invoice, stock deduction or journal.'),
('Attachment retry','Attach a sale image. Interrupt its upload after the bill is saved, then retry the photo.','Screen says bill saved; retry uploads only the photo, rather than billing again.'),
('Return and cancellation limits','Return part of a posted bill, then try returning more than the remaining sold quantity.','Only valid original quantities are refunded; double-return is rejected and due/stock remain consistent.')]),
('Items and universal Retail modes',[
('Basic item and opening stock','Items → Add Item: enter name, selling price and optional real opening quantity/cost.','Item saves, searches correctly and opening stock uses the inventory posting system.'),
('Service','Enable Services for the test tenant. Add a service and bill it without stock.','Service earns a real bill without physical stock deduction; it is not shown as out of stock.'),
('Variant and pack unit','Enable Variants/Multi-unit. Add Size/Colour in Item Details and a BOX factor of 10. Receive the chosen variant and pack.','Variants retain separate stock. One BOX equals 10 base units; changing a saved factor is rejected.'),
('Weight, length and area','Enable the measurement features. Create and receive suitable items; bill 0.5kg, 2m and an area using length×width.','Quantity/rate/converted stock and server total are correct. Invalid dimensions fail clearly.'),
('Batch, expiry and FEFO','Enable Batch. Receive two batches with different future expiries. Bill stock; separately try an expired batch.','Earliest eligible expiry is allocated first; expired stock is rejected. Return restores original allocation.'),
('Serial, warranty, kit and extras','Enable advanced features. Receive unique serials; configure a component kit and paid extra. Bill and return from originals.','A serial sells once, warranty remains traceable, kit deducts components, extras affect server price and returns use the original snapshot.')]),
('Suppliers and searchable purchases',[
('Supplier details','Suppliers → Add Supplier. Save a name; also test optional contact, credit period/limit, address and tax details.','Minimal and expanded forms save real supplier records without requiring every optional field.'),
('Monthly supplier visit','Expand Supplier visits while adding. Set next visit on day 31 and Monthly. Inspect the next short month and following month.','Short month uses its last day; next 31-day month returns to day 31. Recurrence starts at the anchor.'),
('Search Buy Stock items','Buy Stock: tap Choose Item, then search item name, SKU or barcode in the sheet and choose a result.','Search queries the catalog; it is not restricted to the first initially loaded page. Selection remains visible.'),
('Itemized receiving','Choose supplier, add two items with quantity/cost, unit/variant/batch/serial where applicable, then save.','One posted purchase receives correct stock, supplier liability and balanced accounting.'),
('Credit, paid and partial purchase','Record separate Credit, Paid and Partial purchases. Add supplier bill number/date/due date and optional image.','Amounts and dues match the chosen payment status; repeated supplier bill numbers are rejected.'),
('Pay supplier','Supplier account → Make Payment: try cash, UPI/card/bank and partial/full due. Attach proof and retry an upload.','Outstanding decreases once; incoming shop UPI QR is not used to pay a supplier; proof retry does not pay twice.')]),
('Calendar, repayments and tasks',[
('Calendar navigation','Open Calendar from Home or More. Choose previous/next month, Today and a marked date.','Selected date and month are clear, with no overflow at 360px. Event markers match real entries.'),
('Weekly supplier schedule','Create a supplier with next visit on a Wednesday and Every week. Inspect dates before/after that anchor.','Visits repeat on Wednesdays only from the configured date; no earlier visit is invented.'),
('Promised customer repayment','Save an Udhar bill with a due date. Open the unpaid Bill Details and update its promise date.','Calendar → Receivables moves the unpaid bill to the new date and shows customer, bill and real due amount.'),
('Collected and supplier dues','Receive the full customer due and inspect Calendar again. Create a credit purchase with a due date.','Collected bill disappears from Receivables; posted unpaid purchase appears under Payables.'),
('Task and meeting','Select a date, Add Task / Meeting, save a title and mark it completed. Refresh the page.','Date/title/completion persist for this shop. A completed task is not counted as an open Home task.'),
('Holiday accuracy and coverage','Calendar: select 20 October 2026 and 8 November 2026; inspect a year without published holiday data.','Dussehra/Diwali appear on verified dates. Unsupported year states coverage is unavailable; business reminders still work.')]),
('Custom payment voice greeting',[
('Enable and customize','Settings → Payment voice greeting. Enable it, enter Thank you for visiting {shop}, choose English and save.','Settings survive refresh and the real business name replaces {shop}.'),
('Preview and device volume','Tap Preview greeting with phone volume audible. Repeat using Hindi text and language.','Your device requests speech; audible pronunciation is understandable. Install/select a Hindi voice if unavailable.'),
('Confirmed billing greeting','Complete a cash or UPI bill after checking actual receipt. Then refresh or revisit Bill Details.','One automatic greeting is requested for the successful payment, not for a QR display or history viewing.'),
('Customer collection','Receive an old customer payment. Separately record an unpaid Udhar bill and pay a supplier.','Greeting plays for received customer money; unpaid Udhar and outgoing supplier payment do not announce receipt.'),
('Disabled, blocked or offline voice','Disable greeting and complete a bill. Re-enable; test a device/browser without automatic playback.','Disabled stays silent. Browser/audio limitations never undo payment; Play thank-you greeting provides a manual retry.'),
('Tenant voice privacy','Change voice text in Shop A and sign into Shop B. Inspect B settings and complete a B test payment.','Shop A greeting/configuration does not leak into Shop B; each shop uses its own setting.')]),
('Daily Galla, Khata and expenses',[
('Opening cash and method totals','Set opening cash ₹2,000. Make cash ₹500, UPI ₹300 and Udhar ₹200 sales today.','Expected cash increases by ₹500 only. UPI/credit are reported separately.'),
('Actual cash movement','Receive old dues ₹100 cash; pay supplier ₹150 cash; expense ₹50 cash; owner withdrawal ₹100 cash; cash refund ₹80.','With the previous scenario and no other movement, expected cash is ₹2,220. Each cash movement is counted once.'),
('Cash count reconciliation','Enter actual counted cash ₹2,200 against expected ₹2,220. Save and inspect history.','Difference is Short ₹20. No balancing accounting journal is silently fabricated.'),
('Galla history and date','Open yesterday/custom date and past summaries. Export available report CSV.','Dates use Indian business days and correct totals; historical cash count is recoverable.'),
('Business expense versus owner money','Record business expense and owner withdrawal with category/date/method/note; inspect both history tabs.','Correct transaction class, payment account and real period summaries; cancellation reverses appropriately.'),
('Customer due QR','Customer Khata → Receive Payment → UPI: customer owes ₹1,200, receiving ₹500.','QR requests ₹500; scan alone does not reduce due. Retailer confirms receipt before recording payment.')]),
('Reports, documents and settings',[
('Reports directory','Open Reports and sales/purchase/expense/stock/customer due/supplier due/returns reports. Apply dates and filters.','Each implemented report has loading/empty/error/content states and truthful, reconciled totals.'),
('CSV export','Export a report containing names with commas/quotes and a name beginning with =. Open in a spreadsheet.','Columns remain correct and tenant text is not executed as a spreadsheet formula.'),
('Document security','Upload allowed JPG/PNG/WebP within the stated size limit. Try a renamed executable, oversized image and foreign-shop document ID.','Valid private file previews/downloads; invalid files and foreign IDs are rejected.'),
('Business, profile and print settings','Review business/branch/FY, profile, invoice QR option, theme and larger text. Open a real receipt print dialog.','Persisted business values and device display choices work. Physical printing needs your actual supported printer/service.'),
('Staff and logged-in devices','As owner, create a permitted staff account and role. Log in on a second device; revoke it from Devices.','Permissions restrict operations and a revoked session loses access. A cashier cannot change owner settings.'),
('Portability and deletion request','Owner: export business data. Submit a test account deletion request from the published deletion page.','Export contains scoped business data without credentials. Request shows pending; it does not falsely claim completed deletion.')]),
('Platform and tenant isolation',[
('Separate Platform login','Open /platform/login and sign in with the Platform test account. Try a Retail token/login instead.','Only persisted Super Admin authority reaches Platform controls; a tenant cannot promote itself.'),
('Brand-new shop','Platform → Create Tenant: enter a new owner identity and explicit temporary password, then log in as that owner.','Business, branch, stock location, financial year, subscription and entitlements initialize before the first bill.'),
('Plan, overrides and lifecycle','Change test tenant plan/feature override. Suspend then reactivate. Inspect expired/trial/complimentary states.','Backend entitlements change, access matches state, and historical stock/bills/accounting are preserved.'),
('Audit, sessions and support','Inspect tenant activity and audit after changes. Disable a test user or revoke a device; inspect support controls.','Controls are authorized, recorded and effective; browser has no arbitrary raw SQL or shell execution.'),
('Metrics and providers','Inspect revenue/subscription receipts/expenses, database health, backup and infrastructure.','Real recorded figures are distinguishable from unconfigured providers; no fabricated backup or CPU-success claims.'),
('Two-shop attack check','With disposable Shops A/B, try A credentials against B item, bill, supplier, calendar task, document and settings IDs.','GET/write attempts fail without exposing B data or changing its inventory/accounting.')]),
('Release-only checks and limitations',[
('Public publishing details','Platform Settings → App publishing: fill reviewed operator, support, package, retention and policy details. Visit /privacy /terms /support /delete-account /about.','Incomplete details remain draft; approved public values are accurate and accessible without installation.'),
('Google and recovery email','After real OAuth/SMTP setup, connect Google with the current shop password; test sign-in, logout and delivered reset links.','Verified linked account only; no email-based takeover. Missing provider is NOT CONFIGURED, not success.'),
('Real backup and restore','Operator: configure private backup provider, scheduler and alerts; restore DB and attachments into a disposable staging environment.','Recovery is verified against actual data with measured RPO/RTO. No claim of selective shared-DB tenant restore.'),
('Signed Android app','After installing JDK/SDK and signing an AAB, use a physical Play-test phone. Test native Google, camera, QR share, print and TalkBack.','Actual device flows pass; source synchronization alone is not a signed-build or device PASS.'),
('Slow or disconnected network','Use browser/device throttling and temporary API disconnect during searches, billing and payment. Return online and retry.','Understandable recoverable state; cart survives and important retries do not duplicate money/stock. Full offline POS is not claimed.'),
('Accessibility and release decision','Use 360/390/412px and laptop. Check focus, labels, text size, contrast and form errors. Collect failed/blocked results.','No horizontal overflow or hidden required controls. Do not launch paying customers while critical/security/provider gates remain open.')]),
]

# Keep original check IDs stable; these cover the later migration and design work.
SECTIONS.extend([
('Import your existing shop',[
('First sign-in choices','Create a fresh test shop in Platform and log in as its owner. Choose Import your data; separately try Start fresh.','Both choices work. Start fresh deletes nothing; migration remains available in More.'),
('Previous-app export guide','Choose Vyapar, Tally, BUSY, Zoho or Other; read the guide and upload a sanitized CSV or spreadsheet.','Guide explains supported structured files. PDF/photos/encrypted app backups are not treated as accounting records.'),
('Preview and column mapping','Select sheet/header and map names, prices, codes and contacts. Try missing prices and invalid numbers.','Preview changes no live data. Invalid rows and unknown columns need review before confirmation.'),
('Items and opening stock','Import a new item priced INR 100 with 5 units at actual cost INR 60. Open Items and Stock.','One item and 5 units exist. Opening inventory uses the posting engine; selling price is not guessed as cost.'),
('Parties and opening dues','Import a customer owing INR 200 and supplier owed INR 300. Open both Khatas.','Contacts map to the correct parties; balances match. Negative advances require explicit review.'),
('Import retry and history','Retry confirmation and inspect history; repeat the same file. Try another opening snapshot for the same item.','No duplicate stock/dues/masters. Failed rows are visible; prior stock history blocks another opening snapshot.')]),
('Report questions and notifications',[
('Hindi and Hinglish','Reports: ask aaj kitne logo ko udhaar diya; aaj konsa naya maal aaya; today sales; aaj kharch.','Supported questions answer with real shop/date totals; unsupported questions are rejected rather than guessed.'),
('Report detail and date','Inspect answer definitions and source detail. Change selected date and compare the sales and purchase history.','Totals and definitions reconcile with posted records for the selected business date.'),
('Original Udhar after collection','Create INR 100 Udhar and collect it later. Ask the original day credit question again.','Original credit given stays INR 100; collecting it does not rewrite historical credit given.'),
('New goods definition','Compare a real purchase receipt and imported opening stock using the new goods question.','Real purchases appear as incoming goods; opening migration stock is excluded from that purchase answer.'),
('Scheduled in-app summary','Enable summaries, choose language and a due India time. Wait about two minutes and inspect the Reports inbox.','One real snapshot appears with generated time and unread state. Mark read works; refresh creates no duplicate.'),
('Opt-out and shop boundary','Disable summaries. Log in to another disposable shop; inspect its inbox and reports.','No new opted-out summary; another shop cannot read yours. Expired/suspended shops get no new scheduled summary.')]),
('Shop records copy and follow-up',[
('Download shop records','Owner: More > Backup & Restore > Export Account Data. Keep the NDJSON download privately.','Scoped business records download without credentials/session tokens/storage paths. Attachment files are separate.'),
('Platform follow-up notice','After requesting the copy, open Platform Alerts and locate the test shop backup request.','Shop/requesting-owner contact details appear; no automatic call, email or WhatsApp is claimed.'),
('Complete support follow-up','Platform: mark that follow-up completed, then refresh Alerts.','It leaves the pending queue and the action persists; the download does not claim a selective tenant restore.'),
('Interrupted download','Disconnect temporarily during download; reconnect and retry.','Failure is clear; an incomplete file is not called successful. Retrying uses the existing request key.'),
('Owner-only export isolation','Try a staff account and Shop B owner against Shop A export request.','Staff cannot request full business export; another shop cannot download it. Expiration never deletes the data.'),
('Portability versus recovery','Inspect backup provider status and compare the records copy with operator disaster-recovery backup.','Missing provider says Not configured. A live records copy is not a consistent database restore archive.')]),
('WhatsApp receipts and Udhar',[
('Saved customer mobile','Make a customer bill with your controlled mobile. Bill Details > WhatsApp receipt > inspect preview.','Number and text include shop, bill, items, paid and due amounts. Opening the link preloads the correct chat.'),
('Walk-in receipt number','Make a walk-in bill; choose WhatsApp receipt and enter a mobile manually.','Valid number opens a chat; missing number cannot send. One-off recipient does not silently edit a customer.'),
('Invalid and country-code numbers','Try invalid text, 10-digit Indian mobile, +91 and a controlled international number.','Invalid input is rejected; 91 is added once for Indian numbers and explicit international codes are respected.'),
('Udhar reminder and invoice','Customer Khata: open WhatsApp for balance, then receipt for a specific saved sale.','Balance message uses current due; invoice message uses that bill. Opening dues do not pretend to be a receipt.'),
('Cash and UPI split message','Quick bill INR 200: cash INR 100 + UPI INR 100. Open WhatsApp receipt after saving.','Actual lines and both amounts appear, paid INR 200 and due zero. Opening WhatsApp changes no payment data.'),
('PDF and actual device handoff','Print > Save as PDF; attach manually in WhatsApp. Test chat opening on your actual phone.','App preloads text only; it does not claim PDF attachment/delivery. Review recipient before sending test messages.')]),
('Latest menu and form design',[
('Drawer on every module','On Home, Items and Expenses, open top-left Menu. Use close, Escape and backdrop; navigate to a tool.','Drawer closes correctly, highlights current page, traps keyboard focus while open and returns it to Menu.'),
('Complete grouped navigation','Inspect Overview, Sell and manage stock, People and money, Your account. Open held bills and Calendar.','All enabled tools are accessible, labels match pages and held-bill dates are readable.'),
('Item form sections','Add an item using name and price, then inspect opening stock and advanced sections. Reopen saved item.','Simple entry stays clear; variant/unit/batch/serial and other enabled fields remain available and save correctly.'),
('Stock tabs and search','Stock: search, switch Inventory/Low Stock, apply Out of Stock in Filter, then Add Item or Buy Stock.','One clear tab row; uncounted/service/kit items do not create false low-stock alerts; actions work.'),
('Expense form and history','Add business expense using category/amount, payment choice, date, note and image. Open Owner history too.','Labeled fields and selected payment are clear; image works; history totals distinguish business and owner money.'),
('Phone and desktop polish','Use 360x800, 390x844, 412x915 and laptop. Test light theme, larger text, keyboard and form errors.','No horizontal overflow, hidden CTA or header overlap. Cards, text, focus and validation remain readable.')]),
])


SECTIONS.extend([
('Updated stock and selection sheets',[
('Stock workflows','Open Stock. Tap Add Item, Inventory and Low Stock.','Only the selected tab is highlighted. Low Stock includes zero stock; services and uncounted items are excluded.'),
('Unit sheet','Add Item: tap Unit, search Bottle, choose it, reopen, then press Escape.','Large rows show the selected unit. Closing restores focus to the unit field.'),
('Category sheet','Tap Category. Search Soap. Add a custom category, save the item and open Add Item again.','Groups and icons are clear. The saved custom category is available to this shop only.'),
('Complete item fields','Save a name, price, stock, minimum level, unit, category, cost, MRP and description.','Values persist in the correct item record. Tracking choices remain in More Details.'),
('Filter and export','In Inventory tap Filter, Out of Stock and Apply. Select an item and Export Selected.','Only matching counted items appear. The downloaded CSV contains the selected records.'),
('Item actions','Tap an item More button. Choose Buy Stock; then open its details and View Stock Movements.','Purchase prefills the item. Real posted movements appear; no stock is invented.'),
]),
('Updated forms, staff and device layout',[
('Purchase and party sheets','In Buy Stock choose supplier and item. Search each sheet, choose a record and save a real purchase.','Selections persist. Search covers the full shop catalog and Load More handles larger results.'),
('Payment choices','In Quick Sale, expense or supplier payment tap Cash, UPI, Card and Bank where available.','The chosen method is obvious. Supplier payments never display the shop incoming UPI QR.'),
('Dates and filters','Open Reports: Custom, choose dates and Apply. Open Galla: Custom Date. Filter expense history.','Each sheet applies real dates or filters. Empty and failed requests show understandable states.'),
('Staff and permissions','More: Staff. Create a shop role, select permissions, add staff, assign role, edit and disable access.','Changes persist through protected services. Owner roles cannot be granted to new staff.'),
('Location transfer','With Multiple Stock Locations enabled, add Back Room. Transfer 3 of 10 counted units.','Locations show 7 and 3; total remains 10. Variant, batch and serial transfer is explicitly unsupported.'),
('Layout and keyboard','Check 360, 390, 412px, tablet and desktop; light and dark. Open sheets with a short viewport.','No horizontal overflow. Focus and close work. Also test the actual phone keyboard; browser resizing is only a simulation.'),
]),
])

CHECK_COUNT=sum(len(cases) for _,cases in SECTIONS)
c=canvas.Canvas(str(OUT),pagesize=A4)
c.setTitle('EVOLIX Retail - Manual Acceptance Test Guide')
c.setAuthor('EVOLIX Studio')
TOTAL=len(SECTIONS)+2
def paragraph(text,x,y,width,style=BODY):
    p=Paragraph(escape(text),style);_,height=p.wrap(width,H);p.drawOn(c,x,y-height);return height
def header(page,title,subtitle='Owner acceptance | Disposable test shop | 8 October 2026'):
    c.setFillColor(GREEN);c.rect(0,H-7,W,7,fill=1,stroke=0)
    c.setFont('SegoeBold',12);c.drawString(42,H-42,'EVOLIX RETAIL')
    c.setFillColor(MUTED);c.setFont('Segoe',9);c.drawRightString(W-42,H-42,'EVOLIX Studio')
    c.setFillColor(INK);c.setFont('SegoeBold',20);c.drawString(42,H-78,title)
    paragraph(subtitle,42,H-94,W-84,SMALL)
    c.setStrokeColor(BORDER);c.line(42,38,W-42,38)
    c.setFillColor(MUTED);c.setFont('Segoe',9);c.drawString(42,23,'Use test data. Record evidence without passwords or customer secrets.')
    c.drawRightString(W-42,23,f'{page} / {TOTAL}')
def field(name,x,y,width,height=22,multiline=False):
    c.acroForm.textfield(name=name,x=x,y=y,width=width,height=height,fontName='Helvetica',fontSize=10,textColor=INK,borderColor=BORDER,fillColor=white,forceBorder=True,fieldFlags='multiline' if multiline else '')

header(1,'Manual test guide',f'{CHECK_COUNT} practical checks | Fillable PASS / FAIL / BLOCKED results')
paragraph('Test everyday Retail workflows and the nine requested improvements. This guide gives actions and expected outcomes; it is not a declaration that you have completed the tests.',42,H-140,W-84)
paragraph('Start here',42,H-205,W-84,ParagraphStyle('h',parent=BODY,fontName='SegoeBold',fontSize=15,leading=20))
instructions=[
 '1. Use a disposable shop. PC: http://localhost:5173/login. For a phone on the same router, start the LAN preview on port 5174 and use the PC address from ipconfig. See docs/LAN_TESTING.md. Super Admin uses /platform/login. Credentials are supplied separately.',
 '2. Create clearly named test customers, suppliers and items. Use a fresh shop/day for exact Galla checks. Use your receiving UPI ID and manually confirm any actual money received.',
 '3. For each check, select one result. PASS means you observed the expected outcome. FAIL means it differed. BLOCKED means a required account, device, permission or provider is unavailable.',
 '4. Enable advanced item features on your test tenant before those scenarios. Do not enable capabilities in a real customer shop just for testing.',
 '5. Keep phone speaker volume audible for voice checks. Real Google/email/backup/native checks need configured accounts or a signed app. The WhatsApp voice assistant is not active yet.',
 '6. Save the completed PDF and record failed check IDs on the final page. Take a screenshot only when it contains safe test data.'
]
y=H-237
for text in instructions:y-=paragraph(text,42,y,W-84)+12
c.setFillColor(INK);c.setFont('SegoeBold',11)
for label,name,y in [('Tester','tester',165),('Shop / test tenant','shop',126),('Device / browser','device',87)]:c.drawString(42,y+8,label);field(name,175,y, W-217)
c.showPage()
number=0
for page,(section,cases) in enumerate(SECTIONS,2):
    header(page,section)
    top=H-127
    for title,steps,expected in cases:
        number+=1;bottom=top-105
        c.setFillColor(PALE);c.setStrokeColor(BORDER);c.roundRect(42,bottom,W-84,99,9,fill=1,stroke=1)
        c.setFillColor(GREEN);c.setFont('SegoeBold',11);c.drawString(53,top-24,f'{number:02d}  {title}')
        used=paragraph('Do: '+steps,53,top-31,W-106,BODY)
        used2=paragraph('Expect: '+expected,53,top-33-used,W-106,SMALL)
        if used+used2>53: raise ValueError(f'Test {number} overflows: {used+used2}')
        label_y=bottom+6
        if top-33-used-used2 < label_y+13: raise ValueError(f'Test {number} result row overlaps text')
        for j,(state,label) in enumerate([('pass','PASS'),('fail','FAIL'),('blocked','BLOCKED')]):
            x=53+j*98;c.acroForm.checkbox(name=f'test_{number:02d}_{state}',tooltip=f'Test {number} {label}',x=x,y=label_y,size=10,buttonStyle='check',borderWidth=0.6,borderColor=GREEN,fillColor=white,textColor=GREEN,forceBorder=True)
            c.setFillColor(MUTED);c.setFont('Segoe',8);c.drawString(x+16,label_y+1,label)
        top-=110
    c.showPage()
header(TOTAL,'Results and defect log')
paragraph('Choose one result for each test above. Leave production-only checks BLOCKED until their real prerequisites exist. A passed browser test cannot replace audible voice, physical printing, native signing or a live offsite restore drill.',42,H-136,W-84)
for j,label in enumerate(['Passed','Failed','Blocked']):
    x=42+j*170;c.setFillColor(INK);c.setFont('SegoeBold',11);c.drawString(x,H-209,label);field('total_'+label.lower(),x,H-247,140,25)
paragraph('Record check ID, what happened, expected result, device and safe screenshot reference.',42,H-279,W-84)
field('defects',42,204,W-84,325,multiline=True)
paragraph('Verified holiday references (selected 2026 coverage)',42,177,W-84,ParagraphStyle('refs',parent=BODY,fontName='SegoeBold'))
paragraph('https://www.iirs.gov.in/holidaycalender\nhttps://www.indiapost.gov.in/holidays-list',42,150,W-84,SMALL)
paragraph('Do not publish a store release until the release checklist and remaining production gates are complete. Keep completed PDF and defect evidence with the tested build version.',42,102,W-84,SMALL)
c.save()
print(f'Created {OUT} with {number} tests and {TOTAL} pages.')


