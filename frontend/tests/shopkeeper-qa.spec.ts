import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from './fixtures';
import { pickOption } from './mobile-controls';

// Generated only by the disposable local runner. Never use a business tenant.
const fixture=JSON.parse(readFileSync(path.resolve('../scratchpad/shopkeeper-browser-private.json'),'utf8'));
test.use({channel:'chrome'});
test.setTimeout(90000);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC','base64');
async function login(page:Page,platform=false){
  await page.goto(platform?'/platform/login':'/password-login');
  await page.getByLabel('Username or email',{exact:true}).fill(platform?fixture.adminUsername:fixture.username);
  await page.getByLabel('Password',{exact:true}).fill(fixture.password);
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page).toHaveURL(platform?/platform\/dashboard$/:/retail\/home$/);
}
const cases=[
  {kind:'item',route:'items/add',endpoint:'items',save:'SAVE ITEM',end:/retail\/items$/},
  {kind:'expense',route:'expenses/add',endpoint:'expenses',save:'Save Expense',end:/retail\/expenses$/},
  {kind:'purchase',route:'purchases/new',endpoint:'purchases',save:'SAVE PURCHASE',end:/retail\/purchases$/},
  {kind:'sale',route:'quick-sale',endpoint:'bills/amount-sale',save:'Save Quick Sale',end:/retail\/bills\/[^/]+$/},
] as const;
async function form(page:Page,c:typeof cases[number]){
  await page.goto('/retail/'+c.route);
  if(c.kind==='item'){
    await page.locator('#item-name-input').fill('QA browser item '+Date.now());await page.locator('#selling-price-input').fill('20');
  }else if(c.kind==='expense'){
    await expect(page.locator('#expense-category')).toContainText(/Delivery|Electricity|Rent/);await page.locator('#expense-amount').fill('5');
  }else if(c.kind==='purchase'){
    await pickOption(page.locator('#purchase-mode'),'QUICK');await pickOption(page.locator('#purchase-supplier'),fixture.supplierId);await page.locator('#purchase-total').fill('5');
  }else await page.locator('#amount-sale-amount').fill('5');
}
async function attach(page:Page,c:typeof cases[number]){
  if(c.kind==='item')await page.locator('#item-photo-picker summary').click();
  if(c.kind==='expense')await page.locator('summary').filter({hasText:'More Details / Bill & Receipt'}).click();
  if(c.kind==='sale')await page.locator('summary').filter({hasText:'Optional Details'}).click();
  await page.locator('input[type=file]').first().setInputFiles({name:'qa.png',mimeType:'image/png',buffer:png});
}
for(const c of cases){
  test(c.kind+' saves with no photo and never renders false retry controls',async({page})=>{
    await page.setViewportSize({width:390,height:844});await login(page);await form(page,c);
    let uploads=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/v1/attachments'))uploads++;});
    await page.evaluate(()=>{(window as any).falsePhotoControls=[];new MutationObserver(()=>{for(const text of ['Retry Photo Upload','Continue without photo','photo upload needs retry'])if(document.body.textContent?.includes(text))(window as any).falsePhotoControls.push(text);}).observe(document.body,{childList:true,subtree:true,characterData:true});});
    await page.getByRole('button',{name:c.save,exact:true}).click();await expect(page).toHaveURL(c.end);
    expect(uploads).toBe(0);expect(await page.evaluate(()=>(window as any).falsePhotoControls)).toEqual([]);
  });
  test(c.kind+' offers retry only after selected upload fails, and retry does not duplicate the record',async({page},info)=>{
    await page.setViewportSize({width:390,height:844});await login(page);await form(page,c);await attach(page,c);
    let creates=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/v1/retail/'+c.endpoint))creates++;});
    await page.route('**/api/v1/attachments',r=>r.fulfill({status:503,json:{message:'Isolated photo failure fixture'}}));
    await page.getByRole('button',{name:c.save,exact:true}).click();
    await expect(page.getByRole('button',{name:'Retry Photo Upload',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Continue without photo',exact:true})).toBeVisible();
    await page.screenshot({path:info.outputPath('photo-retry-'+c.kind+'.png'),fullPage:true});
    await page.unroute('**/api/v1/attachments');await page.getByRole('button',{name:'Retry Photo Upload',exact:true}).click();await expect(page).toHaveURL(c.end);expect(creates).toBe(1);
  });
}
test('failed photo can be skipped without losing the saved sale',async({page})=>{
  await login(page);const c=cases[3];await form(page,c);await attach(page,c);
  await page.route('**/api/v1/attachments',r=>r.fulfill({status:503,json:{message:'Isolated photo failure fixture'}}));
  await page.getByRole('button',{name:c.save,exact:true}).click();await page.getByRole('button',{name:'Continue without photo',exact:true}).click();await expect(page).toHaveURL(c.end);
});
test('returns screen and downloaded CSV both show the single 10 rupee return',async({page},info)=>{
  await login(page);await page.goto('/retail/reports/returns');
  const card=page.locator('.r-card').filter({hasText:'Total Return Value'});await expect(card.locator('.r-card-value')).toHaveText('₹10');
  await expect(page.getByText('Includes cash refunds and credit adjustments.',{exact:false})).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();const file=await download;
  await file.saveAs(info.outputPath('returns.csv'));const csv=readFileSync(info.outputPath('returns.csv'),'utf8');
  const lines=csv.trim().split(/\r?\n/).map(line=>line.replace(/^\uFEFF/,'').split(',').map(c=>c.replace(/^"|"$/g,'')));
  const column=lines[0].indexOf('grand_total');expect(lines.slice(1).reduce((sum,row)=>sum+Number(row[column]),0)).toBe(10);
  await page.screenshot({path:info.outputPath('returns-summary-10.png'),fullPage:true});
});

test('return CSV follows every page and does not save a partial file after a failed page',async({page},info)=>{
  await login(page);await page.goto('/retail/reports/returns');
  let failSecondPage=false;const offsets:number[]=[];
  // Only the pagination boundary is simulated; the preceding test downloads real DB returns.
  await page.route('**/api/v1/retail/account/exports/RETURNS?*',route=>{
    const offset=Number(new URL(route.request().url()).searchParams.get('offset'));offsets.push(offset);
    if(offset===1000&&failSecondPage)return route.fulfill({status:503,json:{message:'Isolated second-page failure'}});
    return route.fulfill({json:{headers:['grand_total'],rows:offset===0?Array.from({length:1000},()=>['1']):[['3'],['4']],hasMore:offset===0,nextOffset:offset===0?1000:null}});
  });
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();const file=await download;
  expect(file.suggestedFilename()).toBe('EVOLIX-returns.csv');await file.saveAs(info.outputPath('returns-all-pages.csv'));
  const lines=readFileSync(info.outputPath('returns-all-pages.csv'),'utf8').trim().split(/\r?\n/);
  expect(lines).toHaveLength(1003);expect(lines.slice(1).reduce((sum,row)=>sum+Number(row.replaceAll('"','')),0)).toBe(1007);expect(offsets).toEqual([0,1000]);
  failSecondPage=true;let incompleteDownloads=0;page.on('download',()=>incompleteDownloads++);
  await page.getByRole('button',{name:'Export CSV',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Unable to export returns. Please retry.'})).toBeVisible();
  expect(incompleteDownloads).toBe(0);await expect(page.getByRole('button',{name:'Export CSV',exact:true})).toBeEnabled();
});
test('empty category picker offers explicit custom/default creation and initializes safely',async({page},info)=>{
  await login(page);await page.route('**/api/v1/retail/expense-categories',r=>r.request().method()==='GET'?r.fulfill({json:[]}):r.continue());
  await page.goto('/retail/expenses/add');await expect(page.getByText('No expense categories yet.',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Category *',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Add expense category'})).toHaveText(/Add Category/);
  await page.screenshot({path:info.outputPath('expense-empty-categories.png'),fullPage:true});
  await page.unroute('**/api/v1/retail/expense-categories');await page.getByRole('button',{name:'Use default categories',exact:true}).click();
  await expect(page.getByText('No expense categories yet.',{exact:true})).toHaveCount(0);await expect(page.locator('#expense-category')).not.toContainText('Select Category');
});
test('cash label links to Galla and amount-only warning works in English and Hindi without overflow',async({page},info)=>{
  await login(page);
  await page.goto('/retail/reports/sales');await expect(page.getByText('Cash Received from Sales:',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'View Daily Galla',exact:true}).click();await expect(page).toHaveURL(/retail\/galla$/);
  await page.goto('/retail/quick-sale');
  for(const width of [360,390,412,1366]){
    await page.setViewportSize({width,height:844});await expect(page.getByText('Amount-only Sale',{exact:true})).toBeVisible();await expect(page.getByText('No item is selected, so item stock will not update and exact profit cannot be calculated.',{exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.goto('/retail/expenses/add');
  for(const width of [360,390,412,1366]){
    await page.setViewportSize({width,height:844});await expect(page.locator('#expense-category')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.evaluate(()=>localStorage.setItem('evolix-language','hi'));await page.goto('/retail/quick-sale');await expect(page.getByText('केवल रकम की बिक्री',{exact:true})).toBeVisible();
  await expect(page.getByText('इस बिक्री में आइटम नहीं चुना गया है, इसलिए स्टॉक नहीं बदलेगा और सही मुनाफा नहीं निकाला जा सकेगा।',{exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('amount-only-hindi.png'),fullPage:true});
});
test('Super Admin can find and grant pending Smart access; owner continues without a new Google login',async({page,browser},info)=>{
  await login(page,true);await page.goto('/platform/tenants');await page.getByLabel('Access requests',{exact:true}).selectOption('pending');
  await page.getByLabel('Search shops, ID or phone',{exact:true}).fill('Pending Smart browser shop');
  await page.getByRole('link',{name:'Review / grant access',exact:true}).click();await expect(page).toHaveURL(new RegExp('/platform/tenants/'+fixture.pendingOrg+'$'));
  await expect(page.getByText('Pending access · EVOLIX Smart',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Grant access',exact:true})).toBeDisabled();await expect(page.getByText('Enter a reason above to enable approval.',{exact:false})).toBeVisible();
  await page.getByLabel('Reason for administrative changes',{exact:true}).fill('Approve disposable Smart evaluation');await expect(page.getByRole('button',{name:'Grant access',exact:true})).toBeEnabled();
  await page.screenshot({path:info.outputPath('platform-grant-access.png'),fullPage:true});
  const ownerContext=await browser.newContext({baseURL:process.env.TEST_BASE_URL});const ownerPage=await ownerContext.newPage();
  const exchanged=await ownerContext.request.post('/api/v1/auth/browser-session',{headers:{Authorization:'Bearer '+fixture.pendingLogin.access_token,'X-Requested-With':'XMLHttpRequest'}});expect(exchanged.ok()).toBe(true);const browserSession=await exchanged.json();await ownerPage.addInitScript(session=>{if(!localStorage.getItem('evolix-auth'))localStorage.setItem('evolix-auth',JSON.stringify({state:{session_id:'cookie',csrf_token:session.csrf_token,authEpoch:crypto.randomUUID(),user:session.user,tenantContext:null},version:1}));},browserSession);
  await ownerPage.goto('/onboarding');await expect(ownerPage.getByRole('heading',{name:'Your setup is saved'})).toBeVisible();
  await page.getByRole('button',{name:'Grant access',exact:true}).click();await expect(page.getByRole('heading',{name:'Grant access',exact:true})).toHaveCount(0);
  await ownerPage.getByRole('button',{name:'Check activation status',exact:true}).click();await expect(ownerPage).toHaveURL(/retail\/home$/);await ownerContext.close();
});
