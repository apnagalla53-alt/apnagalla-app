"""Sanitized owner checklist; never includes credentials or browser traces."""
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/EVOLIX_Migration_Reports_WhatsApp_Test_Guide.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Segoe', 'C:/Windows/Fonts/segoeui.ttf'))
pdfmetrics.registerFont(TTFont('SegoeBold', 'C:/Windows/Fonts/segoeuib.ttf'))
ink = colors.HexColor('#173c2b')
body = ParagraphStyle('body', fontName='Segoe', fontSize=9.5, leading=13, textColor=colors.HexColor('#283b32'), spaceAfter=4)
title = ParagraphStyle('title', parent=body, fontName='SegoeBold', fontSize=22, leading=27, textColor=ink, spaceAfter=12)
heading = ParagraphStyle('heading', parent=body, fontName='SegoeBold', fontSize=12, leading=16, spaceBefore=6)
small = ParagraphStyle('small', parent=body, fontSize=9, leading=12)
story = []
def p(text, style=body): return Paragraph(escape(text), style)
def page(name, intro):
    if story: story.append(PageBreak())
    story.extend([p('EVOLIX / OWNER ACCEPTANCE', small), p(name, title), p(intro), Spacer(1, 7)])
def check(number, name, action, expected):
    story.append(KeepTogether([p(f'{number}. {name}', heading), p('Do: ' + action), p('Expected: ' + expected), p('[  ] PASS    [  ] FAIL    [  ] BLOCKED     Notes: ____________________', small), Spacer(1, 4)]))

page('Import your existing shop', 'Use a disposable shop and your own sanitized sample export. Keep the original backup. These checks supplement the main EVOLIX Manual Test Guide. Checked build: 07 October 2026.')
check('M1', 'First sign-in choices', 'Create a new shop in Super Admin, sign in as its owner and choose Import your data.', 'The welcome dialog offers Import your data / Start fresh and opens the import guide. Start fresh dismisses the dialog without deleting data; import remains in More.')
check('M2', 'Previous-app guide and file', 'Choose Vyapar, Tally, BUSY, Zoho or Other. Export structured items/parties from that app and choose the matching type.', 'The screen explains exporting and supported files. PDF/photo/encrypted app backups are not silently accepted as accounting records.')
check('M3', 'Preview and map', 'Upload CSV or a spreadsheet, select the sheet/header and review each field, default and error.', 'Preview creates no live items, stock or dues. Unknown columns need acknowledgment and stay in source audit. An invalid selling price or missing stock cost is rejected.')
check('M4', 'Items and opening stock', 'Import one item priced INR 100 with 5 units at actual cost INR 60. Open Items and Stock.', 'One item and 5 units exist. Inventory and the opening voucher are posted by the existing engines. Cost is not guessed from selling price.')
check('M5', 'Customers and suppliers', 'Import one customer owing INR 200 and one supplier owed INR 300. Open both Khatas.', 'Customer receivable is INR 200; supplier payable is INR 300. Name/contact/code map to the correct party. Negative advances require review.')
check('M6', 'Retry and source history', 'Retry confirmation, reopen import history and repeat the same reviewed file. Try a second opening-stock snapshot for the same item.', 'No duplicate masters, stock or opening dues. Invalid/failed rows remain visible; existing stock history blocks another opening snapshot. Reopening history clears stale file selection.')

page('Reports and shop records copy', 'Amounts must reconcile against posted bills, purchases and accounting. Daily notification delivery is in-app only. Never use a portability copy as proof of disaster-recovery readiness.')
check('R1', 'Hindi / Hinglish questions', 'In Reports ask: aaj kitne logo ko udhaar diya; aaj konsa naya maal aaya; today sales; aaj kharch.', 'Answers use the selected business date, tenant and branch. Exact totals/definitions are expandable. An unsupported question is rejected rather than guessed.')
check('R2', 'Original Udhar vs collections', 'Create an Udhar bill for INR 100, collect it later and ask the original date Udhar question.', 'Original credit given remains INR 100. New stock includes actual purchases and excludes imported opening stock.')
check('R3', 'Scheduled in-app summary', 'Enable daily summaries, select language and a time just before the current India time. Wait about two minutes, then open Reports.', 'One snapshot appears for today, with an unread indicator and real generated time. Mark read clears its unread state. Repeated refreshes do not create another summary.')
check('R4', 'Opt-out and tenant boundary', 'Disable summaries. Use another shop owner and inspect its inbox and reports.', 'No new opted-out summary is generated; another tenant cannot read or mark your summary. Expired/suspended shops do not receive new scheduled summaries.')
page('Shop backup and support follow-up', 'Keep the saved shop-records copy in a private place. It contains business/customer data. This owner download is separate from the operator database-backup and disaster-recovery system.')
check('B1', 'Download and notice', 'More > Backup & Restore > Export Account Data. Keep the downloaded NDJSON file.', 'A complete shop-records copy downloads. Credentials/session tokens/storage paths are excluded. The owner is told support was notified. Attachment files are separate.')
check('B2', 'Support follow-up queue', 'As Platform Admin, open Alerts and find this shop backup request. Mark follow-up done.', 'The request shows shop/requesting-owner contact details and disappears from the pending queue after completion. No automatic call, email or WhatsApp is sent.')
check('B3', 'Real backup distinction', 'Inspect the provider status and read the backup/restore documents.', 'Missing provider shows Not configured. This live paginated copy is not a consistent database archive and cannot be restored with the opening-data importer.')
check('B4', 'Interrupted download', 'Temporarily disconnect during a download, reconnect and retry the action.', 'The app reports failure rather than saving an incomplete file as success. Retry uses the existing request key. Server-prepared status does not claim successful device delivery.')
check('B5', 'Owner and tenant isolation', 'Use a staff login and a different shop owner to try the original backup request ID.', 'Staff cannot request a complete business export. Another shop cannot download this request. Subscription expiry does not delete the original records or remove the owner portability route.')

page('WhatsApp receipts and Udhar', 'Use only your own controlled phone numbers for real sending. Automated acceptance intercepts WhatsApp navigation and sends no customer messages. Review the recipient and message before tapping Send in WhatsApp.')
check('W1', 'Saved customer number', 'Create a customer with a mobile, make a bill and click WhatsApp receipt on Bill Details.', 'The saved number appears; the preview includes shop, bill, items, paid and due amounts. Open WhatsApp opens that number chat with prefilled text.')
check('W2', 'One-off phone on walk-in bill', 'Make a walk-in bill, open WhatsApp receipt and enter a mobile manually.', 'A valid chat link appears. The number is used for this send only; the customer record is not silently edited. No number means no send link.')
check('W3', 'Number validation', 'Try an invalid number, then a 10-digit Indian mobile, +91 number and your controlled international number.', 'Invalid destinations show an error. Indian numbers get 91 once; explicit international country codes work. URLs/letters cannot become a destination.')
check('W4', 'Udhar customer and invoice', 'Open a customer Khata, click WhatsApp, then open WhatsApp receipt for one sale in the timeline.', 'The first message gives current balance. The invoice message shows that specific saved bill and outstanding amount. Opening dues do not pretend to be a sales receipt.')
check('W5', 'Cash/UPI split receipt', 'Make a INR 200 quick bill split INR 100 cash + INR 100 UPI; open WhatsApp receipt on Sale successful.', 'Actual item lines and both payment amounts appear, paid INR 200 and due INR 0. Opening WhatsApp does not change invoice/payment data.')
check('W6', 'PDF and device behavior', 'For a full invoice use Print > Save as PDF and attach it manually. Repeat chat opening on your signed Android app.', 'The app states it preloads a text receipt. It never claims a PDF attachment, delivery or payment confirmation merely from opening a chat. Android handoff needs real-device verification.')

page('Remaining release acceptance', 'Software checks do not replace provider setup or physical-device acceptance. Do not launch using a local all-green test count alone. Record evidence and an accountable owner for each gate.')
check('G1', 'Google and recovery email', 'Configure Google OAuth and SMTP using the setup guides; test real login/linking, logout and delivered reset mail.', 'Live provider round trips pass. Unconfigured provider controls remain honest. Automated signed-token tests alone are insufficient.')
check('G2', 'Offsite recovery', 'Configure encrypted private offsite backups, schedule, alerts and attachment recovery; restore a disposable environment.', 'Verified database and attachment recovery, retention, alert delivery and measured RPO/RTO. No selective shared-database tenant restore is claimed.')
check('G3', 'Counter printer and Hindi voice', 'Print an actual bill on the shop printer. Listen to Hindi greeting on the target phone and change its volume.', 'Readable paper with correct totals; clear audible Hindi and appropriate volume. Installed printer drivers and speech requests are not enough.')
check('G4', 'Accessibility and signed Android', 'Install a signed release on a real phone; use TalkBack, larger text, camera/share, WhatsApp and weak network.', 'Focus/labels/reading order and core workflows work without overflow or duplicate billing. Web-only QA does not establish Android acceptance.')
check('G5', 'Public and operational setup', 'Fill reviewed legal operator/support/package/retention settings, configure hosting/monitoring and complete RELEASE_CHECKLIST.md.', 'No public placeholders; real security/support contacts, TLS, health/alerts, migration backup and rollback rehearsal. Deployment requires a separate explicit instruction.')
story.extend([Spacer(1, 12), p('References: docs/DATA_MIGRATION.md, docs/REPORT_ASSISTANT.md, docs/WHATSAPP_RECEIPTS.md, docs/SETUP_GUIDE.md, docs/RELEASE_CHECKLIST.md.', small)])

def footer(canvas, doc):
    canvas.setStrokeColor(colors.HexColor('#d9e7df'))
    canvas.line(42, 38, 553, 38)
    canvas.setFont('Segoe', 8)
    canvas.setFillColor(colors.HexColor('#52675b'))
    canvas.drawString(42, 25, 'EVOLIX Studio | evolix-studio.in | Manual acceptance addendum')
    canvas.drawRightString(553, 25, str(doc.page))
SimpleDocTemplate(str(OUT), pagesize=(595.28, 841.89), rightMargin=42, leftMargin=42, topMargin=40, bottomMargin=48).build(story, onFirstPage=footer, onLaterPages=footer)
print(str(OUT))
