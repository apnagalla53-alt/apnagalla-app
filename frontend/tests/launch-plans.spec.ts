import { test,expect,type Page } from './fixtures';
import { existsSync,readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const fixturePath=process.env.LAUNCH_PLAN_FIXTURES?resolve(process.env.LAUNCH_PLAN_FIXTURES):'';
const fixtures=fixturePath&&existsSync(fixturePath)?JSON.parse(readFileSync(fixturePath,'utf8')):null;
// This opt-in suite needs disposable shop fixtures; ordinary test discovery must work without private local files.
test.skip(!fixtures,'Prepare disposable launch-plan fixtures with scripts/provision-launch-plan-test.cjs first.');
test.setTimeout(120000);
async function login(page:Page,username:string,platform=false,pending=false){
  await page.goto(platform?'/platform/login':'/password-login');
  await page.getByLabel('Username or email',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill(fixtures.password);
  await page.getByRole('button',{name:'Sign In',exact:true}).click();await expect(page).toHaveURL(pending?/\/onboarding$/:platform?/\/platform\/dashboard$/:/\/retail\/home$/);
}
async function headers(page:Page){const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('evolix-auth')!).state);return {'X-CSRF-Token':s.csrf_token||'','X-Company-Id':s.tenantContext?.company_id||'','X-Branch-Id':s.tenantContext?.branch_id||'','X-Financial-Year-Id':s.tenantContext?.financial_year_id||'',Origin:new URL(page.url()).origin};}
for(const code of ['STARTER','SMART','PRO'])test(`${code}: real subscription, Shop Features and direct API parity`,async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await login(page,fixtures.shops[code].username);
  await page.goto('/retail/more/subscription');await expect(page.locator('.r-plan-card')).toHaveCount(3);
  for(const [name,price]of [['Starter','75'],['Smart','120'],['Pro','210']]){const card=page.getByRole('article',{name:'Apna Galla '+name,exact:true});await expect(card.getByRole('heading',{name:'Apna Galla '+name,exact:true})).toBeVisible();await expect(card.getByText('₹'+price,{exact:false}).first()).toBeVisible();await expect(card).not.toContainText(/\bVoice\b|Multiple Locations|Multiple Stock Locations|Stock Transfers|Multi.branch/i);}
  await expect(page.getByRole('article',{name:'Apna Galla Smart',exact:true})).toContainText('MOST POPULAR');await expect(page.getByRole('article',{name:'Apna Galla Smart',exact:true})).toContainText('₹45');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(code+'-subscription.png'),fullPage:true});
  const h=await headers(page),profit=await page.request.get('/api/v1/retail/reports/financial/summary',{headers:h});expect(profit.status()).toBe(code==='STARTER'?403:200);
  const serial=await page.request.post('/api/v1/retail/items',{headers:h,data:{name:'Visible Serial '+Date.now(),selling_price:100,track_serial:true}});expect(serial.status()).toBe(code==='PRO'?201:403);
  const location=await page.request.post('/api/v1/godowns',{headers:h,data:{branch_id:fixtures.shops[code].branchId,code:'DENIED',name:'Not included'}});expect(location.status()).toBe(403);
  await page.goto('/retail/more/features');await page.getByRole('searchbox',{name:'Search features',exact:true}).fill('Item Photos');
  const photo=page.locator('.r-feature-card').filter({hasText:'Item Photos'});await expect(photo).toHaveCount(1);await expect(photo).toContainText(code==='STARTER'?'Locked — Smart':'Enabled');
  if(code==='STARTER')await expect(photo.getByRole('link',{name:/Upgrade to Smart/})).toBeVisible();else await expect(photo.getByRole('switch')).toBeVisible();
  await page.getByRole('searchbox',{name:'Search features',exact:true}).fill('Stock Locations');const future=page.locator('.r-feature-card').filter({has:page.getByText('Stock Locations',{exact:true})});await expect(future).toContainText('Future Premium');await expect(future.getByRole('link',{name:/Upgrade to Pro/})).toHaveCount(0);
  await page.getByRole('searchbox',{name:'Search features',exact:true}).fill('Voice Assistant');const voice=page.locator('.r-feature-card').filter({hasText:'Voice Assistant'});await expect(voice).toContainText('Coming Soon');await expect(voice.getByRole('link')).toHaveCount(0);
  await page.screenshot({path:info.outputPath(code+'-future-features.png'),fullPage:true});
});
test('Google-linked onboarding: real saved account displays only final three plans',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await login(page,fixtures.onboarding.username,false,true);
  await expect(page.locator('.ob-plan')).toHaveCount(3);
  for(const name of ['Starter','Smart','Pro'])await expect(page.getByRole('heading',{name:'Apna Galla '+name,exact:true})).toBeVisible();
  const pro=page.locator('.ob-plan').filter({has:page.getByRole('heading',{name:'Apna Galla Pro',exact:true})});await expect(pro).not.toContainText(/Voice|Multiple Locations|Stock Transfers|Multi.branch/);
  await expect(page.locator('.ob-plan-popular')).toContainText('MOST POPULAR');await expect(page.locator('.ob-plan-popular')).toContainText('Item Photos');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('onboarding-final-plans.png'),fullPage:true});
});
test('Platform Super Admin: canonical matrix and tenant-only FORCE_ENABLE / INHERIT',async({page},info)=>{
  await page.setViewportSize({width:1366,height:900});await login(page,fixtures.platform.username,true);
  await page.goto('/platform/plans');await expect(page.getByRole('heading',{name:'Plans',exact:true})).toBeVisible();
  const rows=page.locator('tbody tr');await expect(rows).toHaveCount(3);const pro=rows.filter({hasText:'Apna Galla Pro'});await expect(pro).toContainText('staff: 5');await expect(pro).toContainText('devices: 10');await expect(pro).toContainText('stock_locations: 1');await expect(pro).not.toContainText('Voice Assistant');await expect(pro).not.toContainText('Stock Locations,');
  await page.screenshot({path:info.outputPath('platform-final-plans.png'),fullPage:true});
  await page.goto('/platform/tenants/'+fixtures.shops.PRO.organizationId);await page.getByLabel('Reason for administrative changes',{exact:true}).fill('Visible disposable location override check');await page.getByRole('button',{name:'Features',exact:true}).click();
  const inventory=page.locator('details').filter({has:page.locator('summary').getByText('Inventory',{exact:true})});await inventory.locator('summary').click();
  const location=inventory.locator('tr').filter({hasText:'Stock Locations'}).filter({hasNotText:'Stock Location Export'});await expect(location).toContainText('Off');
  await location.getByRole('button',{name:'Enable',exact:true}).click();await expect(location).toContainText('Enabled');
  await location.getByRole('button',{name:'Use plan default',exact:true}).click();await expect(location).toContainText('Disabled');
  await page.screenshot({path:info.outputPath('platform-location-inherit.png'),fullPage:true});
});
