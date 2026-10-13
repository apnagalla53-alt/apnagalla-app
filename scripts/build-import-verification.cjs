// Publish sanitized outcomes only. Keep credentials, screenshots of passwords,
// Playwright traces and raw request logs out of committed verification records.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/verification/2026-10-07-import-report-rerun');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
const raw=read('output/playwright/headed-import-full-71-results.json');
if(raw.stats.expected!==71||raw.stats.unexpected||raw.stats.skipped||raw.errors?.length)throw Error('Require complete passing 71-case headed run');
const targeted=read('output/playwright/headed-results.json');
if(targeted.stats.expected!==8||targeted.stats.unexpected||targeted.stats.skipped||targeted.errors?.length)throw Error('Require latest passing 8-case migration/WhatsApp recheck');
const tests=[];
const walk=s=>{for(const spec of s.specs||[])for(const t of spec.tests){const r=t.results.at(-1);tests.push({name:spec.title,file:spec.file,status:r.status,duration_ms:r.duration});}for(const child of s.suites||[])walk(child);};
raw.suites.forEach(walk);
const prior=read('docs/verification/2026-10-07-headed-manual/results.json');
const changed={
44:['PARTIAL','Real Hindi speech request/capabilities rerun in headed browser; audible pronunciation, volume and Hindi voice on target phone still need human acceptance.'],
56:['PASS','Real downloaded stock CSV opened read-only in desktop Excel: 88 rows, 9 formula-like text cells and zero active formulas. CSV escaping and formula neutralization also rerun in browser.'],
58:['PARTIAL','Settings/print controls rerun. Installed HP printer driver currently reports Offline; no paper bill was printed or inspected.'],
63:['PASS','Fresh real Retail browser independently inspected TRIAL, COMPLIMENTARY, expired access denial and renewed access with item data retained; platform plan/override/suspension flows also rerun.'],
67:['PARTIAL','Public pages, privacy requests and draft platform publishing settings rerun. Real reviewed operator/support/package/retention values remain unfilled.'],
68:['BLOCKED','Live Google OAuth and SMTP remain unconfigured; provider capability check rerun. Signed-token/recovery backend tests pass but do not establish delivered provider login/email.'],
69:['BLOCKED','Real disposable PostgreSQL archive/restore tests rerun and shop portability download verified. Production offsite credentials, schedule/alerts, attachment recovery and measured RPO/RTO remain unconfigured.'],
70:['BLOCKED','No JAVA_HOME/ANDROID_HOME, java or adb available. Signed Android build, Play-installed phone and native WhatsApp/camera/share/print/TalkBack not verified.'],
72:['PARTIAL','Seven-screen WCAG scan has zero serious/critical violations; keyboard focus and mobile/desktop/light/dark/larger-text rerun. Full human keyboard/screen-reader/TalkBack acceptance remains open.'],
};
const checks=prior.checks.map(c=>changed[c.number]?{...c,status:changed[c.number][0],evidence:changed[c.number][1]}:{...c,evidence:c.evidence+' Existing flow rerun in the complete headed regression.'});
const manual=checks.reduce((a,c)=>(a[c.status]=(a[c.status]||0)+1,a),{});
const result={date:'2026-10-07',browser:{passed:71,failed:0,skipped:0,exit_code:0,headed:true,workers:1},latest_targeted_browser:{passed:8,failed:0,exit_code:0,included_in_existing_71:true},backend_e2e:{passed:213,failed:0,files:17,exit_code:0},latest_targeted_backend:{passed:23,failed:0,exit_code:0,included_in_existing_213:true,scope:'Final REPORTS entitlement change and Khata invoice receipt reference'},backend_unit_integration:{passed:255,failed:0,files:30,exit_code:0},distinct_automated_tests:539,builds:{backend:'PASS',frontend:'PASS'},database:{migrations:26,clean_deploy:'PASS',status:'PASS',validate:'PASS',generate:'PASS',disposable_only:true},manual,csv_excel:read('scratchpad/csv-excel-evidence.json'),production_dependency_audit:read('scratchpad/import-production-dependency-audit.json').metadata.vulnerabilities,checks,tests,release_decision:'NOT PRODUCTION READY: provider/operator/physical-device release gates remain. No deployment or external customer messages performed.'};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({browser:result.browser,distinct_tests:result.distinct_automated_tests,manual}));
