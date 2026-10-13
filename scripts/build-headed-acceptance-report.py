"""Produce sanitized results only; never publish Playwright auth traces."""
import ast, json, re, shutil
from collections import Counter
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/verification/2026-10-07-headed-manual'
OUT.mkdir(parents=True,exist_ok=True)
tree=ast.parse((ROOT/'scripts/build-manual-test-guide.py').read_text(encoding='utf-8'))
sections=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SECTIONS' for t in n.targets))
raw=json.loads((ROOT/'output/playwright/headed-full-60-results.json').read_text(encoding='utf-8'))
tests=[]
def walk(suite):
    for spec in suite.get('specs',[]):
        for test in spec['tests']:
            result=test['results'][-1]
            tests.append({'name':spec['title'],'file':spec['file'],'status':result['status'],'duration_ms':result['duration']})
    for child in suite.get('suites',[]):walk(child)
for suite in raw['suites']:walk(suite)
counts=Counter(t['status'] for t in tests)
if len(tests)!=60 or counts['passed']!=60 or any(raw.get('errors',[])):
    raise SystemExit('Only the final complete 60-test passing headed run may produce this report')
ledger=json.loads((ROOT/'output/playwright/headed-ledger-results.json').read_text(encoding='utf-8'))
if ledger['stats']['expected']!=11 or ledger['stats']['unexpected'] or ledger['stats']['skipped'] or ledger.get('errors'):
    raise SystemExit('The post-ledger headed recheck must pass all 11 cases')

partial={44:'Real English/Hindi speech requests were made. A person must still confirm audible pronunciation, volume and installed Hindi voices on the target phone.',
56:'CSV download bytes, quoting and formula neutralization passed. Opening that CSV in a desktop spreadsheet was not performed.',
58:'Business/profile/display/invoice settings and print controls passed. A physical printer/service must still be tested.',
63:'Plan, override, suspension/reactivation and free days passed in the browser; expiry/trial/complimentary rules passed in API tests. Every state was not separately inspected in a Retail browser.',
67:'Public pages and draft publishing settings passed. Legal operator/support/package/retention details still require reviewed real values.',
72:'360/390/412px, larger text, desktop layouts, focus and labels were exercised. A complete contrast/screen-reader/keyboard audit remains open.'}
blocked={68:'Live Google OAuth and SMTP are not configured. Signed-token/recovery security tests passed; real provider login and delivered email remain blocked.',
69:'Local whole-database backup/restore tests passed. Production private offsite storage, scheduler/alerts, attachment recovery and measured production RPO/RTO remain blocked.',
70:'No signed Android release or physical Play-test phone was tested. Native Google/camera/share/printer/TalkBack acceptance remains blocked.'}
group_evidence=[
'Headed login, light theme, navigation, module routes, periods, logout and denied access.',
'Fresh-shop real purchase, original uncounted return, counted sale, oversell rejection and stock filters.',
'Real cash/UPI/Udhar/split posting, exact QR amount and reference-only paid receipt.',
'Real edited quote, inline customer, held cart, lost-response replay, photo-only retry and bounded original returns.',
'Real catalog/purchase/POS/return flows for services, packs, variants, measurements, FEFO and serials. Kit/extras UI and original snapshot return API tests also passed.',
'Expanded suppliers, full catalog search, itemized/amount purchases, three payment states and duplicate supplier bill rejection.',
'Saved weekly/monthly visits, month-end clamping, moved/collected receivables, payables, persisted tasks and verified holiday coverage.',
'Persisted per-shop voice settings, real speech requests, received-money triggers, disabled/unavailable handling and foreign company rejection.',
'Exact drawer: 2000 + 500 + 100 - 150 - 50 - 100 - 80 = 2220; UPI 300 and Udhar 200 separate. Short 20 persisted; Galla/Khata/expense tests passed.',
'Reports/CSV, real private image preview/download, file/tenant security API tests, actual staff/password/revocation and account export/deletion-request browser flows.',
'Real Super Admin tenant creation and audit controls plus explicit isolation, entitlement and subscription API regression.',
'Public publishing and failure/retry layouts tested; external release gates are explicitly separated.'
]
checks=[]
cli_evidence={5:'Headed CLI password-field Enter submitted login successfully; browser tests also exercised Tab focus and deep-link refresh.',
36:'Four supplier methods passed. Headed CLI interrupted a proof upload with HTTP 503, retried only the photo, and confirmed one payment of 10 with remaining due 40 from a credit purchase of 50. The saved proof was visible.'}
for group,(section,items) in enumerate(sections):
    for title,steps,expected in items:
        number=len(checks)+1
        status='PARTIAL' if number in partial else 'BLOCKED' if number in blocked else 'PASS'
        checks.append({'number':number,'section':section,'title':title,'status':status,'evidence':partial.get(number,blocked.get(number,cli_evidence.get(number,group_evidence[group])))})
manual=Counter(c['status'] for c in checks)
summary={'date':'2026-10-07','cli_version':'0.1.22','browser':{'passed':60,'failed':0,'exit_code':0,'headed':True,'workers':1},'post_ledger_browser_recheck':{'passed':11,'failed':0,'exit_code':0,'headed':True,'included_in_existing_60':True},'backend_e2e':{'passed':190,'failed':0,'exit_code':0},'backend_unit_integration':{'passed':235,'failed':0,'exit_code':0},'cli_supplement':cli_evidence,'manual':dict(manual),'checks':checks,'browser_tests':tests}
(OUT/'results.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')

intro='''# EVOLIX headed acceptance - 7 October 2026

Playwright CLI **0.1.22** was installed globally. An interactive CLI browser walkthrough used `open --headed`; the complete existing and added regression scenarios ran through `@playwright/test --headed`, with one worker and 250 ms slow motion. These are separate tooling paths; the 60 count is the test runner result, not 60 CLI commands.

## Final evidence

| Check | Actual final result |
|---|---|
| Full visible Chromium suite | **60 passed, 0 failed; exit 0** |
| Post-ledger visible recheck | **11 passed, 0 failed; exit 0**; already included in the 60 distinct cases |
| Backend E2E | 190 passed / 16 files; exit 0 |
| Backend unit/integration | 235 passed / 29 files; exit 0 |
| Backend typecheck and production build | Both exit 0 |
| Frontend typecheck and production build | Both exit 0 |
| Prisma validate / migration status | Exit 0; 25 migrations, up to date; no schema changes or reset |
| API readiness / frontend | `ready` / HTTP 200 at localhost 8010 / 5173 |

**485 distinct automated tests passed.** Repeated diagnostic and targeted runs are not added to that count. The 72 manual-guide checks are broader than automated test cases: **63 PASS, 6 PARTIAL, 3 BLOCKED**. PASS evidence can combine real browser actions and real API assertions; each row identifies scope. PARTIAL and BLOCKED are not production release passes. Two additional headed CLI checks verified Enter-key login and interrupted supplier-payment proof recovery.

## Issues found and corrected during visible testing

- Return quantity could reset during asynchronous duplicate development loads. Ignore stale loads and capture the numeric value before a React state updater.
- A variant without an SKU appeared blank in Buy Stock. Render its saved attributes.
- Bill details/receipts showed base quantity instead of the customer's pack unit and omitted saved serial/warranty information. Render persisted entered-unit, variant and warranty data.
- Serial returns had no original-serial selection. Select eligible original serials; the authoritative POS service validates and restores them.
- Failed item search left an invisible dropdown backdrop blocking recovery. Remove that backdrop for an error and provide Retry Search.
- Missing/rejecting device speech is handled without undoing a saved payment. Added label associations for low-stock and inline customer fields.
- Same-day Khata entries were sorted by document text, which could put payment before purchase and misstate running balances. Sort by business date and posting creation instead; a real database regression deliberately reverses document-text order and verifies 50 then 40. The visible supplier ledger confirmed that sequence.

The initial 43-case headed run had 39 passes and four Bill-centre assertion failures. Windows' visible scrollbar occupied viewport space; assertions now measure the actual navigation bar and check button, icon and label. Supplemental diagnostic failures also included incorrect fixture labels/roles, premature serial-control inspection and ambiguous alert/badge locators. These were corrected without skipping tests or using forced clicks. Real workflow fixes were verified in the final complete run.

## Environment and privacy

Browser writes used the disposable `evolix_phase8_browser_20261007_test` database. Final backend E2E used a new `evolix_headed_e2e_20261007_test` database after deploying all 25 migrations; unit/integration used a separate guarded database. Restore targeted only `evolix_master_restore_test`. Existing dirty work was preserved. No production deployment, real customer messaging or Play upload occurred.

Diagnostic E2E repeats on the unit-test database failed setup because older fixture cleanup did not cover purchase orders/returns and matched unrelated claim users by username prefix. Security cleanup now scopes its own organization; purchase-order cleanup was updated. Legacy fixture cleanup still requires separate clean E2E and unit databases. The final fresh-database run is the release evidence; failed diagnostic runs were not counted as passes. Prisma generate initially encountered the Windows live-engine file lock; stopping the local API and rerunning generate succeeded, then the API was restarted.

The 60-case complete run preceded the final same-day ledger correction. That correction passed a new database regression, the full 190-case backend E2E, a headed CLI ledger inspection, and an 11-case headed recheck of supplier/customer/Khata/Galla/calendar workflows. The first targeted recheck had 4 passes and 7 login failures: stale sessions from local API restarts correctly reached the real device limit. Only the named disposable owner's stale sessions were revoked; the final targeted run passed all 11. Device-limit enforcement was preserved.

Credential files and raw CLI sessions, Playwright traces/videos and request logs remain ignored because they can contain authentication data. The disposable platform password was rotated and its sessions revoked; the ignored local credential file contains its updated value. Included results/logs/screenshots are sanitized test evidence.

## Manual-guide execution matrix

| # | Guide check | Result | Evidence / remaining work |
|---|---|---|---|
'''
markdown=intro+'\n'.join(f"| {c['number']:02} | {c['title']} | **{c['status']}** | {c['evidence']} |" for c in checks)
markdown+='''

## Repeat the visible run

From `frontend`, set `RETAIL_USERNAME`, `RETAIL_PASSWORD`, `PLATFORM_USERNAME` and `PLATFORM_PASSWORD` from your ignored local test credential file, then run:

```powershell
npx playwright test --config=playwright.headed.config.ts --headed --workers=1
```

The opt-in config keeps ordinary CI defaults unchanged. Its JSON report and private traces are under `output/playwright/`. The original blank fillable guide remains in `output/pdf/EVOLIX_Manual_Test_Guide.pdf`; this operation creates a separate execution report.

Production remains gated by the PARTIAL/BLOCKED items and the operational release checklist. A local all-green browser run is not a signed Android, live Google/SMTP, physical printer, audible Hindi or production backup acceptance. See `docs/verification/PRODUCTION_COMPLETION_REPORT.md` and `docs/RELEASE_CHECKLIST.md`.
'''
(OUT/'README.md').write_text(markdown,encoding='utf-8')
for name in ['headed-final-full-browser','headed-ledger-browser','headed-clean-migrations','headed-prisma-generate','headed-backend-e2e','headed-backend-unit','headed-backend-typecheck','headed-backend-build','headed-frontend-typecheck','headed-frontend-build','headed-prisma-validate','headed-prisma-status']:
    source=ROOT/'scratchpad'/f'{name}.log'
    if source.exists():
        text=source.read_text(encoding='utf-8-sig',errors='replace')
        text=re.sub(r'\x1b\[[0-9;]*m','',text)
        if re.search(r'Bearer\s+eyJ|password_hash\s*[:=]',text):raise RuntimeError('Unexpected secret-bearing log')
        (OUT/f'{name}.log').write_text(text,encoding='utf-8')
screens=OUT/'screenshots';screens.mkdir(exist_ok=True)
for pattern in ['manual-exact-galla-2220.png','manual-serial-warranty.png','manual-private-document.png','manual-calendar-persisted.png','home-clean-modules.png']:
    sources=list((ROOT/'output/playwright/headed-regression').rglob(pattern))
    if sources:shutil.copy2(sources[0],screens/pattern)

pdfmetrics.registerFont(TTFont('Segoe','C:/Windows/Fonts/segoeui.ttf'))
pdfmetrics.registerFont(TTFont('SegoeBold','C:/Windows/Fonts/segoeuib.ttf'))
green=colors.HexColor('#35634b');ink=colors.HexColor('#243229');muted=colors.HexColor('#57665b')
body=ParagraphStyle('body',fontName='Segoe',fontSize=9.4,leading=13,textColor=ink,spaceAfter=9)
small=ParagraphStyle('small',parent=body,fontSize=8,leading=10.5,spaceAfter=0)
heading=ParagraphStyle('heading',parent=body,fontName='SegoeBold',fontSize=20,leading=25,spaceAfter=15)
sub=ParagraphStyle('sub',parent=body,fontName='SegoeBold',fontSize=12,leading=16,spaceBefore=11,spaceAfter=8)
p=lambda text,style=body:Paragraph(escape(text),style)
pdf=ROOT/'output/pdf/EVOLIX_Headed_Test_Results.pdf';pdf.parent.mkdir(parents=True,exist_ok=True)
story=[p('EVOLIX Retail',heading),p('Visible browser acceptance | 7 October 2026',sub),
p('Playwright CLI installed: 0.1.22. Interactive CLI walkthrough and complete headed Chromium regression with one worker and slowed interactions.'),
p('60 browser + 190 backend E2E + 235 unit/integration = 485 distinct automated tests passed. Failed: 0 in the final runs. Both production builds and typechecks passed. Prisma: 25 migrations deployed to a fresh disposable database; generate succeeded.'),
p('After the final same-day ledger correction: 11 relevant headed browser cases passed again. These are included in the 60-case count, not counted twice.'),
p('72 manual-guide checks: 63 PASS, 6 PARTIAL, 3 BLOCKED. Two additional headed CLI checks passed. Browser/API evidence is distinguished from external services and physical devices. No production deployment or Play upload was performed.'),
p('Fixed during testing',sub),p('Return quantity reset; blank purchase variant labels; pack-unit and serial/warranty bill display; original-serial return selection; failed-search recovery; unavailable device voice; same-day ledger order. Failed setup diagnostics and clean-database requirements are documented.'),
p('Production release gates',sub),p('Google/SMTP setup, private offsite backup plus attachment restore/scheduler/alerts, reviewed legal/support publishing values, signed Android and physical phone/printer/audible voice acceptance remain open. Partial checks are not release passes.'),
p('Manual execution matrix',sub)]
table=[[p('#',small),p('Manual guide check',small),p('Result',small),p('Evidence / remaining work',small)]]
for c in checks:
    table.append([p(f"{c['number']:02}",small),p(c['title'],small),p(c['status'],small),p(c['evidence'],small)])
for index,(start,end) in enumerate([(1,9),(9,27),(27,45),(45,63),(63,73)]):
    if index:story.append(PageBreak())
    header=[p('#',small),p('Manual guide check',small),p('Result',small),p('Evidence / remaining work',small)]
    grid=Table([header]+table[start:end],colWidths=[23,130,57,301],repeatRows=1,hAlign='LEFT')
    grid.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#edf4ee')),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),1,green),('LINEBELOW',(0,1),(-1,-1),.35,colors.HexColor('#dde6de')),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
    story.append(grid)
story.extend([Spacer(1,15),p('Reproduce: frontend - npx playwright test --config=playwright.headed.config.ts --headed --workers=1. Supply credentials only through ignored environment/local files.',body),p('Detailed sanitized evidence: docs/verification/2026-10-07-headed-manual/README.md and results.json. Raw authentication traces/videos are private and are not release artifacts.',body)])
def footer(canvas,doc):
    canvas.setStrokeColor(colors.HexColor('#dde6de'));canvas.line(42,34,553,34);canvas.setFont('Segoe',8);canvas.setFillColor(muted);canvas.drawString(42,21,'EVOLIX Studio | Disposable local test data | Release gates remain open');canvas.drawRightString(553,21,str(doc.page))
SimpleDocTemplate(str(pdf),pagesize=(595.28,841.89),leftMargin=42,rightMargin=42,topMargin=42,bottomMargin=49,title='EVOLIX Headed Test Results',author='EVOLIX Studio').build(story,onFirstPage=footer,onLaterPages=footer)
print(f'Created manual matrix ({dict(manual)}) and execution PDF; browser {dict(counts)}')
