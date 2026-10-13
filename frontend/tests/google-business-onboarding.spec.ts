import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {randomUUID,randomInt} from 'node:crypto';
import {pickOption} from './mobile-controls';
test.setTimeout(120000);
const fixture=()=>JSON.parse(readFileSync('../scratchpad/google-onboarding-browser-private.json','utf8'));
const phone=()=>String(randomInt(6000000000,9999999999));
// Only the Google browser/identity transport is simulated. All application HTTP,
// cookies, CSRF, provisioning, plans, approval, RLS and imports are real.
async function installGoogle(page:Page,subject='headed-'+randomUUID()){
 await page.addInitScript(({subject})=>{
  let configuration:any;
  (window as any).google={accounts:{id:{initialize:(value:any)=>{configuration=value;},renderButton:(element:HTMLElement)=>{
   const button=document.createElement('button');button.textContent='Continue with Google';button.type='button';
   button.onclick=()=>configuration.callback({credential:JSON.stringify({subject,email:subject+'@gmail.com',displayName:'Aamir Khan',emailAuthoritative:true,nonce:configuration.nonce})});element.appendChild(button);
  }}}};
 },{subject});return subject;
}
async function signup(page:Page){await page.goto('/signup');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Continue with Google',exact:true}).click();await expect(page.getByRole('heading',{name:'Set Up Your Business',exact:true})).toBeVisible();}
async function profile(page:Page,mobile=phone(),category='Kirana / Grocery'){
 await expect(page.getByLabel('Owner Name',{exact:false})).toHaveValue('Aamir Khan');await expect(page.getByLabel('Shop / Business Name',{exact:false})).toHaveValue('');
 await page.getByLabel('Owner Name',{exact:false}).fill('Aamir Owner');await page.getByLabel('Shop / Business Name',{exact:false}).fill('Shree Ganesh General Store');await page.getByLabel('Mobile Number',{exact:false}).fill(mobile);
 await page.getByRole('button',{name:/Business Type/}).click();await page.getByLabel('Search business types',{exact:true}).fill(category);await page.getByRole('button',{name:category,exact:true}).click();
 await page.getByLabel(/^Address/).fill('Main Market, Khargone, Madhya Pradesh');return mobile;
}
async function requestHeaders(page:Page){const store=await page.evaluate(()=>JSON.parse(localStorage.getItem('evolix-auth')!).state);return {'X-CSRF-Token':store.csrf_token||'','X-Company-Id':store.tenantContext?.company_id||'','X-Branch-Id':store.tenantContext?.branch_id||'','X-Financial-Year-Id':store.tenantContext?.financial_year_id||''};}
async function signout(page:Page){await page.request.post('/api/v1/auth/account/logout',{headers:await requestHeaders(page)});await page.evaluate(()=>localStorage.removeItem('evolix-auth'));await page.goto('/login');}
async function approve(page:Page){
 const setup=await (await page.request.get('/api/v1/auth/account/onboarding')).json(),data=fixture();
 const login=await page.request.post('/api/v1/platform/auth/login',{data:{username:data.adminUsername,password:data.password}});expect(login.status()).toBe(200);
 const admin=await login.json();const result=await page.request.post('/api/v1/platform/admin/tenants/'+setup.business.id+'/actions',{headers:{Authorization:'Bearer '+admin.access_token},data:{action:'approve_access',plan_id:data.smartPlan,free_days:30,complimentary:true,reason:'Disposable headed onboarding verification'}});expect(result.status()).toBe(201);
}
test('Google → combined profile → Smart → saved Fresh choice → real admin approval → Home; resume and returning Google',async({page,context})=>{
 await page.setViewportSize({width:390,height:844});await installGoogle(page);await signup(page);
 const permissions=await context.newCDPSession(page),target=await permissions.send('Target.getTargetInfo');await permissions.send('Browser.setPermission',{permission:{name:'geolocation'},setting:'denied',origin:new URL(page.url()).origin,browserContextId:target.targetInfo.browserContextId});expect(await page.evaluate(async()=>(await navigator.permissions.query({name:'geolocation'})).state)).toBe('denied');await page.getByRole('button',{name:'Use My Location Optional',exact:true}).click();await expect(page.getByText('Location permission was not granted. You can continue with a manual address.')).toBeVisible({timeout:15000});
 const mobile=await profile(page);
 await page.getByRole('button',{name:/Business Type/}).click();
 const dialog=page.getByRole('dialog',{name:'Select business type'});await expect(dialog).toBeVisible();
 for(const q of ['grocery','medical','garments','hardware','electrical','cosmetics','mobile','sanitary','optical','other']){await page.getByLabel('Search business types',{exact:true}).fill(q);await expect(dialog.locator('.ob-type-results section>button').first()).toBeVisible();}
 await page.getByLabel('Search business types',{exact:true}).fill('hardware');await expect(dialog.locator('.ob-type-results section>button')).toHaveCount(3);
 await page.getByLabel('Search business types',{exact:true}).fill('grocery');await expect(dialog.getByRole('button',{name:'Kirana / Grocery',exact:true})).toHaveAttribute('aria-pressed','true');await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await page.screenshot({path:'../output/playwright/google-onboarding-profile.png',fullPage:true});
 await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Choose Your Plan'})).toBeVisible();
 for(const amount of ['₹75','₹120','₹210'])await expect(page.getByText(amount,{exact:false})).toBeVisible();await expect(page.getByText('MOST POPULAR')).toBeVisible();await expect(page.getByText('Voice Ask Apna Galla is Pro-only. The voice service is not connected yet.')).toBeVisible();
 await page.screenshot({path:'../output/playwright/google-onboarding-plans.png',fullPage:true});
 await page.reload();await expect(page.getByRole('heading',{name:'Choose Your Plan'})).toBeVisible();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(/\/login$/);await page.getByRole('button',{name:'Continue with Google',exact:true}).click();await expect(page.getByRole('heading',{name:'Choose Your Plan'})).toBeVisible();
 await page.getByRole('button',{name:'Edit business profile',exact:true}).click();await expect(page.getByLabel('Mobile Number',{exact:false})).toHaveValue(mobile);await page.getByLabel('Shop / Business Name',{exact:false}).fill('Corrected Grocery');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Choose Smart',exact:true}).click();await expect(page.getByRole('heading',{name:'Bring Your Existing Data?'})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Bring Your Existing Data?'})).toBeVisible();
 await page.getByRole('button',{name:/Start fresh Apna/}).click();await expect(page.getByRole('heading',{name:'Your setup is saved'})).toBeVisible();await expect(page.getByText('Payment status: pending · No payment confirmed')).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Your setup is saved'})).toBeVisible();await approve(page);await page.getByRole('button',{name:'Check activation status',exact:true}).click();await expect(page).toHaveURL(/\/retail\/home$/);await expect(page.getByText('Corrected Grocery',{exact:true}).first()).toBeVisible();
 await signout(page);const onboardingRequests:string[]=[];page.on('request',request=>{if(request.url().includes('/auth/account/onboarding'))onboardingRequests.push(request.url());});await page.getByRole('button',{name:'Continue with Google',exact:true}).click();await expect(page).toHaveURL(/\/retail\/home$/);expect(onboardingRequests).toHaveLength(0);
});
test('Other and optional GPS → real Smart trial → real CSV opening-stock import → Summary → Home',async({page,context})=>{
 await page.setViewportSize({width:412,height:915});await installGoogle(page);await signup(page);await profile(page,phone(),'Other');await page.getByLabel('Describe your business').fill('Horse accessories');
 await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:22.2,longitude:75.4});await page.getByRole('button',{name:'Use My Location Optional',exact:true}).click();await expect(page.getByText(/Location saved.*automatic address lookup is not connected/)).toBeVisible();
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Start 7-day smart trial',exact:true}).click();await expect(page.getByRole('heading',{name:'Bring Your Existing Data?'})).toBeVisible();await page.getByRole('button',{name:/Import existing data Supported/}).click();await expect(page).toHaveURL(/\/retail\/more\/import$/);
 await pickOption(page.getByRole('combobox',{name:'Data type',exact:true}),'ITEMS');await pickOption(page.getByLabel('Previous app'),'GENERIC');
 await page.getByLabel('Exported file').setInputFiles({name:'Opening-items.csv',mimeType:'text/csv',buffer:Buffer.from('Name,SKU,Selling Price,Purchase Price,Opening Stock\nImported saddle,ONBOARD-SADDLE,100,60,5')});await page.getByRole('button',{name:'Preview file',exact:true}).click();await expect(page.getByText('READY: 1',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Confirm valid rows / retry failed rows',exact:true}).click();await expect(page.getByText('IMPORTED: 1',{exact:true})).toBeVisible();
 const items=await page.request.get('/api/v1/retail/items?search=ONBOARD-SADDLE',{headers:await requestHeaders(page)});expect(items.status()).toBe(200);expect((await items.json())[0].current_stock).toBe(5);await page.screenshot({path:'../output/playwright/google-onboarding-import-summary.png',fullPage:true});await page.getByRole('link',{name:'Continue to Home',exact:true}).click();await expect(page).toHaveURL(/\/retail\/home$/);
});
test('manual activation refreshes a first-time owner session and resumes the saved Import choice',async({page})=>{
 await page.setViewportSize({width:390,height:844});await installGoogle(page);await signup(page);await profile(page);await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Choose Smart',exact:true}).click();await page.getByRole('button',{name:/Import existing data Supported/}).click();await expect(page.getByRole('heading',{name:'Your setup is saved'})).toBeVisible();
 await approve(page);await page.getByRole('button',{name:'Check activation status',exact:true}).click();await expect(page).toHaveURL(/\/retail\/more\/import$/);await expect(page.getByLabel('Exported file')).toBeVisible();expect(['OWNER','TENANT_ADMIN','ADMIN']).toContain(await page.evaluate(()=>JSON.parse(localStorage.getItem('evolix-auth')!).state.user.role));
});
for(const size of [{width:360,height:800},{width:390,height:844},{width:412,height:915},{width:1440,height:900}])test(`profile, full-height sheet and plans fit ${size.width}px with keyboard and selected state`,async({page})=>{
 await page.setViewportSize(size);await installGoogle(page);await signup(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await profile(page);await page.getByRole('button',{name:/Business Type/}).click();const dialog=page.getByRole('dialog',{name:'Select business type'});const bounds=await dialog.boundingBox();expect(bounds!.height).toBeGreaterThan(size.height*.9);
 await page.getByLabel('Search business types',{exact:true}).fill('not-a-real-category');await expect(page.getByText('No matching business types')).toBeVisible();await page.getByRole('button',{name:'Choose Other',exact:true}).click();await expect(page.getByLabel('Describe your business')).toBeVisible();
 await page.getByRole('button',{name:/Business Type/}).click();await page.getByLabel('Search business types',{exact:true}).fill('other');await expect(dialog.getByRole('button',{name:'Other',exact:true})).toHaveAttribute('aria-pressed','true');await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:/Business Type/})).toBeFocused();
 await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Choose Your Plan'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const cards=await page.locator('.ob-plan').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left};}));expect(cards[1].top).toBeGreaterThan(cards[0].bottom);expect(cards[2].top).toBeGreaterThan(cards[1].bottom);
 await page.screenshot({path:`../output/playwright/google-onboarding-plans-${size.width}.png`,fullPage:true});
});
