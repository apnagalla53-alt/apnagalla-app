"""Build the source-backed EVOLIX screen specification for a Figma designer."""
from pathlib import Path
import json, html, re
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/EVOLIX_UI_UX_Figma_Design_Handoff.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
CAT = json.loads((ROOT/'docs/design/EVOLIX_SCREEN_CATALOG.json').read_text(encoding='utf-8'))
CAP_PATH = ROOT/'output/playwright/design-handoff/screens/CAPTURES.json'
CAP = json.loads(CAP_PATH.read_text(encoding='utf-8')) if CAP_PATH.exists() else {}
FONT = Path('C:/Windows/Fonts')
pdfmetrics.registerFont(TTFont('EVRegular',str(FONT/'segoeui.ttf')))
pdfmetrics.registerFont(TTFont('EVBold',str(FONT/'segoeuib.ttf')))
pdfmetrics.registerFontFamily('EVRegular',normal='EVRegular',bold='EVBold')
W,H=A4
GREEN=HexColor('#2C6650'); INK=HexColor('#20342B'); MUTED=HexColor('#5C6C64')
PALE=HexColor('#EFF5F1'); LINE=HexColor('#DCE6DF'); AMBER=HexColor('#855723')
STYLE={
 'body':ParagraphStyle('body',fontName='EVRegular',fontSize=10,leading=14,textColor=INK),
 'small':ParagraphStyle('small',fontName='EVRegular',fontSize=9,leading=12.5,textColor=INK),
 'tiny':ParagraphStyle('tiny',fontName='EVRegular',fontSize=8,leading=11,textColor=MUTED),
 'heading':ParagraphStyle('heading',fontName='EVBold',fontSize=12,leading=16,textColor=GREEN),
 'title':ParagraphStyle('title',fontName='EVBold',fontSize=23,leading=29,textColor=INK),
}

def clean(value):
 value=html.unescape(str(value))
 value=re.sub(r'[\u2010-\u2015\u2212]','-',value).replace('\u2022',' / ').replace('\u00a0',' ')
 return value
def escape(value): return html.escape(clean(value))

class Book:
 def __init__(self):
  self.c=canvas.Canvas(str(OUT),pagesize=A4,pageCompression=1)
  self.c.setTitle('EVOLIX UI/UX - Complete Figma Design Handoff')
  self.c.setAuthor('Evolix Studio')
  self.n=0;self.y=H-92;self.section='';self.page_index=[];self.screen_pages={}
 def footer(self):
  self.c.setStrokeColor(LINE);self.c.line(32,35,W-32,35)
  self.c.setFillColor(MUTED);self.c.setFont('EVRegular',8)
  self.c.drawString(32,21,'EVOLIX  |  Evolix Studio  |  08 Oct 2026  |  Design specification')
  self.c.drawRightString(W-32,21,str(self.n))
 def new(self,title,subtitle='',key=None):
  if self.n:self.footer();self.c.showPage()
  self.n+=1;self.section=title;self.page_index.append({'page':self.n,'title':title})
  self.c.setFillColor(GREEN);self.c.setFont('EVBold',9);self.c.drawString(32,H-29,'EVOLIX / DESIGN HANDOFF')
  self.c.setFont('EVRegular',8);self.c.drawRightString(W-32,H-29,'RETAIL + PLATFORM + ACCOUNT')
  if key:self.c.bookmarkPage(key);self.c.addOutlineEntry(clean(title),key,level=0,closed=False)
  self.y=H-46
  self.drawpara(escape(title),32,W-64,'title')
  if subtitle:self.drawpara(escape(subtitle),32,W-64,'tiny')
  self.y-=15
 def drawpara(self,text,x,width,style='body',gap=7):
  p=Paragraph(text,STYLE[style]);_,h=p.wrap(width,10000)
  p.drawOn(self.c,x,self.y-h);self.y-=h+gap
  return h
 def ensure(self,height=60):
  if self.y-height<51:self.new(self.section+' / continued')
 def block(self,title,items):
  self.ensure(45);self.drawpara(escape(title),32,W-64,'heading')
  for text in items:
   p=Paragraph('- '+escape(text),STYLE['body']);_,h=p.wrap(W-64,10000);self.ensure(h+8)
   self.drawpara('- '+escape(text),32,W-64,'body',6)
  self.y-=6
 def text(self,text):
  p=Paragraph(escape(text),STYLE['body']);_,h=p.wrap(W-64,10000);self.ensure(h+10)
  self.drawpara(escape(text),32,W-64)
 def table(self,headers,rows,widths):
  for index,row in enumerate([headers]+rows):
   style='small';ps=[Paragraph(escape(cell),STYLE[style]) for cell in row]
   heights=[p.wrap(width-16,10000)[1] for p,width in zip(ps,widths)];rh=max(heights)+16
   self.ensure(rh+4)
   self.c.setFillColor(PALE if index==0 or index%2==0 else white)
   self.c.rect(32,self.y-rh,W-64,rh,fill=1,stroke=0)
   x=32
   for p,width in zip(ps,widths):
    ph=p.wrap(width-16,10000)[1];p.drawOn(self.c,x+8,self.y-8-ph);x+=width
   self.y-=rh
  self.y-=12
 def picture(self,file,x,top,maxw,maxh):
  img=ImageReader(str(file));iw,ih=img.getSize();scale=min(maxw/iw,maxh/ih);dw,dh=iw*scale,ih*scale
  self.c.setFillColor(white);self.c.setStrokeColor(LINE);self.c.roundRect(x-1,top-dh-1,dw+2,dh+2,8,fill=1,stroke=1)
  self.c.drawImage(img,x,top-dh,width=dw,height=dh,mask='auto')
  return dh
 def screen(self,s):
  self.new(s['id']+' / '+s['title'],s['group']+'  |  '+s['route'],key=s['id'])
  self.screen_pages[s['id']]=self.n
  top=self.y;capture=CAP.get(s['id'],{});file=ROOT/capture.get('file','__missing__')
  has_img=file.is_file()
  if has_img:
   mobile=s['group'] in ['Retail','Public & access'] or s['component']=='Login'
   if mobile:
    dh=self.picture(file,32,top,200,455);self.y=top-dh-12
    self.drawpara('CURRENT BUILD / 390 x 844<br/>Disposable demonstration data.',32,200,'tiny')
    if capture.get('error'):
     self.drawpara('Observed error state: '+escape('; '.join(capture['error'])),32,200,'tiny')
    if capture.get('overflow'):self.drawpara('Observed overflow: resolve in redesign.',32,200,'tiny')
    if s.get('source'):self.drawpara('Component: '+escape(s['component'])+'<br/>'+escape(s['source']),32,200,'tiny')
    x=252;width=W-x-32;self.y=top
   else:
    dh=self.picture(file,32,top,W-64,260);self.y=top-dh-13
    self.drawpara('CURRENT BUILD / desktop 1280 x 900. First viewport, not a full form capture.',32,W-64,'tiny')
    x=32;width=W-64
  else:
   x=32;width=W-64
   self.drawpara('Specification only. A reliable content-state capture was not available in this demonstration session.',x,width,'tiny')
  observed=s.get('observedLabels',{})
  fields=list(dict.fromkeys(s['fields']+observed.get('fields',[])))
  actions=list(dict.fromkeys(s['actions']+observed.get('actions',[])))
  sections=[('Fields and information',fields),('Actions and navigation',actions),('Business rules / design cautions',s['notes']),('Required Figma variants',[
   'Apply the common state matrix on page 5, including errors/retry and pending/success for write actions.',
   'Hindi + English; comfortable and larger text; long names and realistic values.' if s['group']=='Retail' else 'Desktop + tablet (mobile for public/sign-in); keyboard focus and narrow-width behavior.'
  ])]
  for heading,items in sections:
   if self.y<100:
    self.new(s['id']+' / '+s['title']+' / continued',s['route']);x=32;width=W-64
   self.drawpara(escape(heading),x,width,'heading',5)
   for item in items:
    p=Paragraph('- '+escape(item),STYLE['small']);_,ph=p.wrap(width,10000)
    if self.y-ph<52:
     self.new(s['id']+' / '+s['title']+' / continued',s['route']);x=32;width=W-64
    self.drawpara('- '+escape(item),x,width,'small',4)
   self.y-=8
  if not has_img and s.get('source'):
   self.drawpara('Source: '+escape(s['source']),x,width,'tiny')
 def finish(self):
  self.footer();self.c.save()
  (ROOT/'output/pdf/EVOLIX_UI_UX_PAGE_INDEX.json').write_text(json.dumps({'pages':self.n,'screens':self.screen_pages,'contents':self.page_index},indent=2),encoding='utf-8')

b=Book()
b.new('EVOLIX\nUI / UX design handoff','Complete screen and workflow brief for Figma',key='cover')
b.text('A premium, light and approachable Retail application, with the depth needed to run a real shop. Developed by Evolix Studio - evolix-studio.in.')
cover=ROOT/'output/playwright/design-handoff/screens/S11.png'
if cover.exists():
 top=b.y-8;b.picture(cover,32,top,208,450);b.y=top
 b.drawpara('106 route views',270,285,'title');b.drawpara('10 public / access<br/>57 Retail<br/>23 Platform<br/>16 tenant administration',270,285,'body',15)
 b.drawpara('What the designer receives',270,285,'heading')
 b.drawpara('Current-build screenshots, screen fields and actions, conditional universal-item flows, payment rules, state coverage, component guidance and prototype acceptance.',270,285,'body',15)
 b.drawpara('Design direction',270,285,'heading')
 b.drawpara('Light neutral canvas. Quiet green accents. Compact rectangular cards. Large readable controls. A complete left-side shop menu and one prominent billing action.',270,285,'body',15)
 b.drawpara('Important',270,285,'heading')
 b.drawpara('Screenshots are the existing implementation, not a finished Figma design. Preserve business logic and workflow depth while improving presentation.',270,285,'body')

b.new('How to use this specification','Read the brief, then design by workflow and screen ID.',key='using')
b.block('Scope and evidence',[
 'The route inventory was extracted from App.tsx and component sources on 08 October 2026. Each S-number maps back to a real route view.',
 'Aliases are included when they serve different entry points. Shared components are identified; do not count aliases as separate backend capabilities.',
 'Current screenshots use a disposable local demo shop. They do not contain customer production records or credentials.',
 'Screen pages show the first viewport. All listed fields/actions, including content below the fold and conditional panels, must still be designed.',
 'The field list combines source labels with a human-readable coverage brief. Do not infer mandatory fields or backend validation from a proposed visual treatment.',
 'Required Figma variants are acceptance requirements, not a claim that every existing state has already passed visual QA.',
 'Availability depends on permissions, plan entitlements and provider configuration. Show the real unavailable/not-configured state.',
 'This is a design handoff, not a production-readiness certification. Deployments, provider setup and release checks remain separate.'
])
b.block('Recommended Figma file structure',[
 '00 - Brief, sitemap and workflow map; 01 - Foundations; 02 - Components.',
 '03 - Retail mobile; 04 - Retail tablet/desktop; 05 - Public/auth; 06 - Platform admin; 07 - Tenant administration.',
 '08 - Prototype journeys; 09 - State and language matrix; 10 - Developer handoff and open questions.',
 'Name frames with the screen ID, title, viewport, state and language: S27_NewBill_390_Content_EN.'
])
b.text('Companion catalog: docs/design/EVOLIX_SCREEN_CATALOG.json. It keeps route/component mappings and field/action lists editable. This PDF can be shared independently.')

b.new('Product and visual direction','Minimal in presentation, complete in daily business workflows.',key='direction')
b.block('The primary user',[
 'An older retailer may read slowly, use one hand and know business terms better than software terms. Make the next action obvious without training.',
 'Use familiar labels: Make Bill, Customer Paid Me, Buy Stock, Udhar, Daily Galla. Add plain explanations to technical settings.',
 'Do not make the owner configure companies, ledgers, warehouses or financial years manually before ordinary billing.',
 'Keep common tasks short; reveal advanced details only when relevant. Never hide customer selection, due amounts or stock warnings.'
])
b.table(['Foundation','Recommended design target'],[
 ['Canvas / surface','#F7FAF8 canvas; white cards; #EFF5F1 soft tint.'],
 ['Primary / text','#2C6650 quiet EVOLIX green; #20342B primary text; #5C6C64 secondary.'],
 ['Borders / status','#DCE6DF subtle borders. Separate accessible success, warning and error tones with labels.'],
 ['Typography','Readable humanist sans serif with a Devanagari companion. Body 16px; secondary 14px; headings 20-28px.'],
 ['Spacing / shape','4/8px spacing scale. Page gutters 16-24px. Cards 12-16px radius; compact horizontal list cards.'],
 ['Touch / keyboard','At least 44px action hit area. Visible focus ring. Short labels with icons; do not use emoji navigation.'],
 ['Motion','Subtle, optional. Respect reduced motion. No animation that delays checkout.'],
 ['Large text','Layout must expand naturally without truncating price, due amount, unit or action names.']
 ],[150,W-64-150])
b.text('These are proposed Figma foundations. Verify contrast and adapt the palette in the design system. The current screenshots illustrate implemented structure, not final token values.')

b.new('Navigation and information architecture','The upper-left three-line menu is the complete shop directory.',key='navigation')
b.block('Always available',[
 'Bottom navigation: Home, Items, Bill, Khata. Bill remains the prominent centered action. No More button in the bottom bar.',
 'Upper-left menu: grouped tools, icons + labels, current page highlight, a close control and logout.',
 'Header: store identity where helpful, notification access, profile access and a clear back action. Avoid overlaying the page title or primary CTA.',
 'Current /retail/more remains a compatible directory route. It is reached through the sidebar rather than a bottom navigation tab.'
])
b.table(['Group','Visible destinations'],[
 ['Sell and stock','Home; Make Bill; Quick Sale; Udhar Sale; Bill History; Held Bills; Items; Stock; Purchases; Need List.'],
 ['People and money','Customers/Khata; Suppliers; Receive Customer Payment; Supplier Payment; Expenses; Daily Galla; Reports; Calendar; Assistant.'],
 ['Your account','Business; Profile; Subscription; Shop Features; Staff; Documents; Devices; UPI & Payments; Printer & Invoice.'],
 ['Settings and help','Settings; Language; Payment voice greeting; Security; Import Data; Backup / Export; Help; Privacy & Terms; Logout.'],
 ['Conditional','Stock Locations appears when multiple locations are enabled. Advanced universal options follow entitlement checks.'],
 ['Platform','Separate platform sign-in and authorization. Desktop navigation for organizations, plans, revenue, users, audit, support, health and backups.']
 ],[125,W-64-125])

b.new('Reusable components and states','Build a coherent component system before polishing individual screens.',key='components')
b.block('Component families',[
 'App shell, compact module header, segmented workflow tabs, bottom navigation, grouped navigation drawer.',
 'Metric card, quick-action button, compact item/party/transaction row, status badge, grouped form card and progressive disclosure.',
 'Text/phone/currency/quantity/date inputs, search field, searchable selection sheet, radio/payment method cards and switch.',
 'Photo attachment picker, upload progress, document preview, UPI QR card, invoice/receipt preview and WhatsApp action.',
 'Sticky primary action, confirmation dialog, toast/status feedback, inline error/retry panel and empty state with a useful CTA.',
 'Data table with pagination/filter/search; responsive list alternative; date-range control; charts with textual totals and honest no-data state.'
])
b.block('Interaction and accessibility',[
 'A sticky CTA must not cover Camera/Gallery controls, the last form field or the keyboard. Allow scroll padding and safe-area insets.',
 'Selection sheets: search, clear search, selected state, disabled reason, add record where allowed, escape/back closure and focus return.',
 'Loading cannot look like zero sales or zero dues. Network failure must retain input and offer retry without duplicate posting.',
 'Payment buttons remain pending while saving. Only server-confirmed completion shows success; retried requests must not create duplicate bills.',
 'Every icon-only button needs an accessible name. Every input needs a visible label. Use readable errors near the affected field.'
])
b.block('English and Hindi',[
 'The app now uses i18next + react-i18next with local English/Hindi resources and English fallback. Settings switches language on this device.',
 'Translate interface copy and status explanations. Customer names, item names, phone numbers and saved notes remain exactly as entered.',
 'Use INR formatting and allow longer Hindi labels to wrap. Dates and monetary values must stay unambiguous.',
 'Design both language versions of the core prototype. Some existing technical/admin prose still uses English fallback and needs further copy review.'
])

b.new('Billing and customer workflows','Preserve customer context and make payment outcomes explicit.',key='billing-flow')
b.block('Khata to bill',[
 'Khata -> open customer -> New Bill -> selected customer already shown -> add items -> Pay -> customer retained.',
 'Reloading the customer bill deep link resolves the customer through the tenant-scoped API. An invalid/unavailable customer blocks checkout and shows retry.',
 'Do not force the user to select the same customer again. A valid existing draft can remain; a completed sale starts a new cart.'
])
b.block('Itemized bill',[
 'Choose/search customer or use walk-in -> search/scan item -> choose variant, unit, quantity, dimensions, batch/serial or options where required -> quote -> payment.',
 'Quick add from billing asks for a familiar item name, price and unit. Optional stock is not silently invented. Tracked items require their actual inventory context.',
 'Edit bill line supports appropriate unit/quantity/price and existing universal constraints. Show a measured item with its calculation, not only a generic quantity.',
 'Hold/resume, remove line, discounts, bill date, due date, sale channel, note and attachment must have coherent layouts.'
])
b.block('Payment modes',[
 'Cash: total, cash received, change and Complete Sale.',
 'UPI: exact amount QR, UPI ID/payee, manual confirmation and Complete Sale. Opening the QR is not payment proof.',
 'Udhar: customer required, full outstanding amount, promise date and Save as Udhar.',
 'Split: cash + UPI + optional remaining Udhar. The QR encodes only the UPI part, not the whole bill. The remaining credit needs a customer.',
 'Paid receipt: success summary, print/share/WhatsApp, new bill. Unpaid/partly paid receipt shows the true outstanding balance.'
])
b.block('Receipt and thank-you voice',[
 'WhatsApp opens a phone-number chat with receipt text; allow a manually entered number if none is saved. Do not imply server-side WhatsApp delivery.',
 'After a saved received payment, the browser may speak the shop greeting once. Unpaid credit does not trigger a payment greeting.',
 'Settings -> Payment voice greeting: on/off, custom words, English/Hindi preset, voice language, speed and preview. {shop} inserts the shop name.',
 'A previously saved off preference remains off. Device-installed voices, browser interaction requirements and sound settings affect playback.'
])

b.new('Purchases and universal stock','Use one inventory engine with clear conditional input.',key='stock-flow')
b.block('Buy stock and supplier payment',[
 'Supplier search -> itemized Buy Stock or general amount purchase -> item search -> quantity and purchase rate -> receiving details -> credit/cash/partial -> bill image/note -> Save.',
 'Keep the supplier identity, invoice number, purchase date and due date visible. Supplier visits use a saved date/recurrence and appear in Calendar.',
 'Supplier payment: supplier, balance, amount, date, Cash/UPI/Card/Bank, proof/note and confirmation. Do not show the shop incoming QR for paying a supplier.',
 'Purchase History: compact rows, date/status/amount, expandable details, attachments and clear outstanding information.'
])
b.table(['Item family','Design requirement'],[
 ['Product / piece','Name, price, base unit, optional opening stock/cost and low-stock level.'],
 ['Service','Unit/rate and quantity or duration. Avoid a physical stock count.'],
 ['Weight / length','Decimal quantity and selected measuring unit; actual conversion and line total.'],
 ['Area / volume','Dimensions and quantity formula where applicable; readable calculated base quantity.'],
 ['Variants','Attribute/variant choice, variant SKU/price/stock and separate receiving identity.'],
 ['Multi-unit','Base vs selling pack unit and conversion. A carton is not automatically one piece.'],
 ['Batch / expiry','Batch identity, expiry, available quantity and FEFO allocation visibility.'],
 ['Serial / warranty','Unique serial selection, availability, warranty duration and sold/returned state.'],
 ['Bundle / modifiers','Components/quantities; option groups/min/max; price adjustments and required choices.'],
 ['Compatibility','Supported compatibility metadata and search; do not invent an external product database.']
 ],[130,W-64-130])
b.text('All stock changes use authoritative postings. UI redesign must not bypass stock checks, price quoting, serial uniqueness, tenant scoping or entitlement enforcement.')

b.new('Money, reports and daily planning','Use real transactions and show what a number means.',key='money-flow')
b.block('Daily Galla',[
 'Date: Today / Yesterday / custom date. Opening cash, sales/payment breakdown, old dues collected, cash paid out and expected counter cash.',
 'Expected cash = opening cash + actual cash inflows - actual cash outflows. UPI/Card do not increase physical cash.',
 'Actual count, difference and matched/short/excess status are reconciliation notes; they must not automatically alter journal entries.',
 'History keeps daily summaries. Clarify business timezone and date boundary in the prototype.'
])
b.block('Reports and assistant',[
 'Reports Home: clear business categories, date scope, important totals and links to sales/purchases/expenses/stock/dues/returns and real financial reports.',
 'Financial values come from cost snapshots/journals. Missing cost coverage must remain visible; do not fabricate profit or stock valuation.',
 'Report filters: period, search and relevant item/category/party/staff filters; export where implemented, loading/empty/error states.',
 'In-app report notifications open the corresponding report. They are not external push/WhatsApp delivery.',
 'Assistant accepts supported English/Hindi business questions, shows the interpreted period and evidence. Unsupported questions need a useful fallback.',
 'External generative AI and WhatsApp voice messages are separate provider-dependent work. Do not make them appear live in this design.'
])
b.block('Calendar and parties',[
 'Month/date navigation, selected day, supplier visits, receivables, payables and tasks. Add/edit a task with clear dates and recurrence where implemented.',
 'Customer promise dates come from bill/payment workflows. Supplier due dates come from purchases. Calendar summaries must agree with those sources.',
 'Festivals/holidays are regional/date-dependent; use the actual calendar data and configuration, not static fabricated dates.',
 'Customers and suppliers need search, contact, balance, credit rules and progressive address/tax details. Keep collection/payment actions easy to reach.'
])

b.new('Figma delivery and prototype acceptance','Deliver an editable design system, not only flat screenshots.',key='delivery')
b.block('Required deliverables',[
 'Figma file link with view access; reusable variables/tokens, text styles, Auto Layout, named layers, icon components and component variants.',
 'Mobile reference frames: 360x800, 390x844 and 412x915. Tablet 768px and desktop 1280/1440px. Platform is desktop-first but must stay usable on tablet.',
 'English/Hindi and comfortable/larger text for core Retail; light theme is primary. Any dark mode is a deliberate secondary variant.',
 'All 106 route views mapped to this catalog; additional conditional panels and 14 financial report variants covered.',
 'Clickable prototypes for bill/payment/return, customer collection, supplier purchase/payment, item/stock, expenses, import and settings.',
 'State board with loading, empty, error/retry, pending/success, permissions and provider-not-configured states.',
 'Annotations for interaction, scroll/sticky behavior, validation, responsive changes and backend dependencies; exportable original assets.'
])
b.block('Acceptance checks for the designer',[
 'An older first-time user can make a bill, collect old Udhar and find today\'s counter cash without searching settings.',
 'Khata New Bill retains the selected customer; Split shows separate cash/UPI/Udhar with correct QR amount.',
 'No back/title/New Bill overlap. No Camera/Gallery/Save overlap. No clipped amount/unit/action at any target mobile size.',
 'Item lists and low-stock lists use compact rectangular rows; long names wrap without displacing price/status.',
 'All implemented tools are discoverable in the sidebar. Bottom More is absent; billing remains prominent.',
 'No mock success for Google, backup, email, monitoring or payment confirmation. Show availability accurately.',
 'Retail workflow fields are retained during visual simplification; business logic and historical records are preserved.'
])
b.text('Share the completed Figma file back with the frame IDs and agreed design tokens. It can then be translated into the existing React components without rebuilding the Retail engine.')

for group in ['Public & access','Retail','Platform','Tenant administration']:
 b.new(group+' / screen index','Use the S-number to find the detailed specification.',key='index-'+group.replace(' ','-'))
 rows=[[s['id'],s['title'],s['route']] for s in CAT['screens'] if s['group']==group]
 b.table(['ID','Screen','Route'],rows,[40,210,W-64-250])

for s in CAT['screens']:b.screen(s)

b.new('Financial report variants','S56 is a dynamic view with 14 implemented route kinds.',key='financial-variants')
b.table(['Kind','Information / design focus'],[
 ['profit','Profit and loss summary with real cost coverage and date scope.'],
 ['gross','Net sales and COGS; gross profit definition.'],
 ['net','Operating expenses and resulting net profit.'],
 ['trend','Period-by-period trend; chart/table and meaningful empty state.'],
 ['items','Item revenue, cost, quantity and profit; item filter.'],
 ['bills','Bill-level revenue, cost and profit; source bill discovery.'],
 ['categories','Category aggregation and comparable period totals.'],
 ['customers','Customer attribution where present; walk-in handling.'],
 ['staff','Staff-attributed sales/profit without invented attribution.'],
 ['margin','Margin analysis and correct percentage denominators.'],
 ['low-margin','Low-margin results and configured threshold.'],
 ['below-cost','Below-cost sales and cost availability.'],
 ['coverage','Missing/known cost coverage and unresolved cost warning.'],
 ['valuation','Stock cost/valuation including incomplete cost state.']
 ],[100,W-64-100])
b.text('Route pattern: /retail/reports/financial/{kind}. Preserve any existing filter/search/export controls. Cash Flow and Balance Sheet are not implemented report routes in this catalog; do not portray them as available.')

b.new('Conditional panels and modal inventory','A page design is incomplete without its intermediate choices.',key='modals')
b.table(['Surface','Required contents / behavior'],[
 ['Customer sheet','Search by name/phone, balances, selected customer, walk-in/new customer and loading/empty/retry.'],
 ['Item picker','Search/name/SKU/barcode, unit/price/stock, selected line, quick add, enabled tracking hints.'],
 ['Quick add item','Name, price, unit/custom unit and optional stock; save then add to current draft.'],
 ['Edit bill line','Quantity, appropriate unit, price/discount and applicable measurements/variant/serial/modifiers.'],
 ['Unit sheet','Search by name/code/aliases, selected value, feature-disabled reason and Add custom unit.'],
 ['Category sheet','Search/groups, recognizable consistent icons, selection and no-matches state.'],
 ['Photo picker','Camera/Gallery, limit/error/progress, thumbnail, remove/change; final CTA never overlaps.'],
 ['Split payment','Cash, UPI, remaining credit toggle/amount, customer, promise date and exact UPI-part QR.'],
 ['QR full screen','Payee, UPI ID, fixed/static amount distinction, print/download/share/copy with supported-state fallback.'],
 ['WhatsApp receipt','Saved/manual phone, normalize/validate, preview receipt message, open chat; no fake automatic send.'],
 ['Supplier form','Type/name/nickname/contact, credit period/limit/bills, address/tax details, visit date/recurrence.'],
 ['Import onboarding','Import your data / Start fresh; export guides, supported source presets and mapping.'],
 ['Import wizard','Select file/type, preview/mapping, validation/conflicts, confirmations, posting result and error report.'],
 ['Opening / closing cash','Date, opening amount, actual count, difference explanation and non-posting reconciliation.'],
 ['Destructive controls','Explicit confirmation, scoped affected entity, reason if required, saving/failed/success state.']
 ],[135,W-64-135])

b.new('Additional current-build references','Useful variants beyond the main route first viewport.',key='extra-reference')
extras=[('sidebar.png','Complete shop sidebar'),('settings-hindi.png','Settings in Hindi'),('voice-settings.png','Custom Hindi voice greeting'),('payment-split.png','Split Cash / UPI / Udhar'),('unit-picker.png','Searchable universal unit picker'),('add-item-details.png','Add Item / advanced options')]
for start in range(0,len(extras),2):
 if start:b.new('Additional current-build references / continued')
 for col,(filename,title) in enumerate(extras[start:start+2]):
  file=ROOT/'output/playwright/design-handoff'/filename
  x=32+col*270;top=H-140
  p=Paragraph(escape(title),STYLE['heading']);_,ph=p.wrap(250,500);p.drawOn(b.c,x,top-ph)
  if file.exists():b.picture(file,x,top-35,235,520)
  else:
   p=Paragraph('See modal specification. A captured variant was not available.',STYLE['body']);p.wrap(240,500);p.drawOn(b.c,x,top-70)

b.new('Provider and availability boundaries','Make incomplete integrations honest and understandable.',key='boundaries')
b.table(['Area','Design the real boundary'],[
 ['Google login','Only available after valid OAuth client configuration. Never hardcode a fake connected state.'],
 ['UPI QR','Static/dynamic payment URI is real; receipt remains manually confirmed without a bank/provider callback.'],
 ['Voice greeting','Browser text-to-speech; language voices may vary by device. Not a payment gateway soundbox.'],
 ['WhatsApp','Open chat/receipt sharing with phone number. WhatsApp chatbot/voice-note delivery is not implied.'],
 ['Backup / export','Tenant export and database backup are distinct. Show Not configured when provider is absent. No unsupported selective shared-DB restore claim.'],
 ['Publishing','Developer/business/support/domain/package details remain owner-editable placeholders until finalized. No invented legal/support contact.'],
 ['Infrastructure','Real health/provider values or Unavailable/Not configured; never fabricated CPU/storage charts.'],
 ['Subscriptions','Manual records can be real. No fake online payment; expiry/downgrade must preserve data.'],
 ['Offline','Show connectivity/retry and retain input. Do not imply a full offline POS synchronization system.'],
 ['AI','Use current deterministic business assistant/report evidence. New external AI integrations require a separately implemented boundary.']
 ],[115,W-64-115])
b.block('Implementation safeguards',[
 'Tenant-scoped IDs and server-side permissions/entitlements remain authoritative.',
 'Stock movements and accounting entries cannot be replaced by local UI calculations.',
 'Idempotent writes and saved-state protection remain in billing/payment/import/return flows.',
 'The design may organize existing options more clearly; backend changes need a separately reviewed requirement.'
])
b.finish()
print(json.dumps({'pdf':str(OUT),'pages':b.n,'route_views':len(CAT['screens']),'captured_views':sum((ROOT/c.get('file','__missing__')).is_file() for c in CAP.values())}))
