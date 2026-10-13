import { pickOption } from './mobile-controls';
import {test,expect,type Page} from './fixtures';
import {readFile} from 'node:fs/promises';
test.setTimeout(120000);
async function login(page:Page){await page.goto('/password-login');await page.getByLabel('Username or email',{exact:true}).fill(process.env.RETAIL_USERNAME!);await page.getByLabel('Password',{exact:true}).fill(process.env.RETAIL_PASSWORD!);await page.getByRole('button',{name:'Sign In',exact:true}).click();await expect(page).toHaveURL(/retail\/home$/);}
async function setupUpi(page:Page){await page.goto('/retail/more/payments');await page.getByLabel('UPI ID *',{exact:true}).fill('audit.shop@upi');await page.getByLabel('Payee / Business Name *',{exact:true}).fill('Audit Retail Counter');await page.getByLabel('Show UPI QR on Invoice',{exact:true}).check();await page.getByRole('button',{name:'Save UPI Profile',exact:true}).click();await expect(page.getByRole('img',{name:'UPI QR for Audit Retail Counter',exact:true})).toBeVisible();}
test('UPI setup, static QR download, invoice preference, manual amount QR and customer due QR',async({page},info)=>{
  await login(page);await setupUpi(page);await page.reload();await expect(page.getByLabel('UPI ID *',{exact:true})).toHaveValue('audit.shop@upi');
  await page.getByRole('button',{name:'Full Screen',exact:true}).click();await expect(page.getByRole('dialog',{name:'Shop UPI QR'})).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();
  const download=page.waitForEvent('download');await page.getByRole('link',{name:'Download QR',exact:true}).click();expect((await download).suggestedFilename()).toBe('evolix-upi.png');
  await page.evaluate(()=>{(window as any).printCalls=0;window.print=()=>{(window as any).printCalls++;};});await page.getByRole('button',{name:'Print QR',exact:true}).click();expect(await page.evaluate(()=>(window as any).printCalls)).toBe(1);
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'Copy UPI ID',exact:true}).click();await expect(page.getByText('UPI ID copied',{exact:true})).toBeVisible();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('audit.shop@upi');
  await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));await page.getByRole('button',{name:'Share QR',exact:true}).click();await expect(page.getByText('Sharing images is unavailable here. UPI ID copied.',{exact:true})).toBeVisible();
  const suffix=Date.now(),product='QR Product '+suffix;await page.goto('/retail/items/add');await page.locator('#item-name-input').fill(product);await page.locator('#selling-price-input').fill('480');await page.locator('#opening-stock-input').fill('3');await page.locator('#save-item-btn').click();await expect(page).toHaveURL(/retail\/items$/);
  await page.goto('/retail/bill');await page.locator('#item-search-input').fill(product);await page.getByRole('button').filter({hasText:product}).click();await page.locator('#pay-btn').click();await page.locator('#pay-upi').click();await expect(page.getByRole('heading',{name:'Pay ₹480.00 via UPI',exact:true})).toBeVisible();await expect(page.getByRole('img',{name:'UPI QR for Audit Retail Counter amount ₹480.00',exact:true})).toBeVisible();await expect(page).toHaveURL(/retail\/payment$/);
  await page.getByLabel('I checked my UPI or bank app and received this payment.',{exact:true}).check();
  const response=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/retail/bills'));await page.locator('#complete-sale-upi').click();const bill=await(await response).json();await expect(page).toHaveURL(/sale-complete$/);
  await page.goto('/retail/bills/'+bill.id+'/print');await expect(page.getByRole('img',{name:'UPI QR for Audit Retail Counter amount ₹480.00',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:/Pay ₹/})).toHaveCount(0);await expect(page.getByRole('button',{name:'Print invoice',exact:true})).toBeVisible();
  await page.goto('/retail/customers/add');await page.locator('#customer-name').fill('QR Customer '+suffix);await page.getByRole('button',{name:'Advanced details',exact:true}).click();await page.getByLabel('Opening Due (₹)',{exact:true}).fill('1200');await page.getByRole('button',{name:'Save Customer',exact:true}).click();await expect(page).toHaveURL(/khata\/[^/]+$/);const customerId=new URL(page.url()).pathname.split('/').pop();
  await page.goto('/retail/receive-payment?customer='+customerId);await page.getByLabel('Amount (₹)',{exact:true}).fill('500');await pickOption(page.getByLabel('Payment Method',{exact:true}), 'UPI');await expect(page.getByRole('heading',{name:'Pay ₹500.00 via UPI',exact:true})).toBeVisible();await expect(page.getByRole('img',{name:'UPI QR for Audit Retail Counter amount ₹500.00',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('khata-upi-500.png'),fullPage:true});
  // QR display did not submit a payment. Confirming is a separate retailer action.
  await expect(page.locator('.r-stitch-party-outstanding')).toContainText('₹1,200');
});
test('report CSV preserves commas and quotes and neutralizes tenant spreadsheet formulas',async({page})=>{
  await login(page);const product='=HYPERLINK("https://example.invalid","Audit"), # '+Date.now();
  await page.goto('/retail/items/add');await page.locator('#item-name-input').fill(product);await page.locator('#selling-price-input').fill('10');await page.locator('#save-item-btn').click();await expect(page).toHaveURL(/retail\/items$/);
  await page.goto('/retail/reports/stock');await expect(page.locator('#retail-page-content').getByText(product,{exact:true})).toBeVisible();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();const download=await pending;expect(download.suggestedFilename()).toBe('EVOLIX-stock-page.csv');const path=await download.path();expect(path).not.toBeNull();const csv=await readFile(path!,'utf8');
  expect(csv).toContain('"\''+product.replaceAll('"','""')+'"');expect(csv).toContain('"item_id","name","sku","quantity","unit","low_stock_threshold"');
  await download.saveAs('../scratchpad/retail-stock-report-rerun.csv');
});
test('lost billing response retries the same operation without a second invoice',async({page},info)=>{
  await login(page);const suffix=Date.now(),product='Retry Product '+suffix;await page.goto('/retail/items/add');await page.locator('#item-name-input').fill(product);await page.locator('#selling-price-input').fill('100');await page.locator('#opening-stock-input').fill('3');await page.locator('#save-item-btn').click();await expect(page).toHaveURL(/retail\/items$/);
  await page.goto('/retail/bill');await page.locator('#item-search-input').fill(product);await page.getByRole('button').filter({hasText:product}).click();await page.locator('#pay-btn').click();await page.locator('#pay-cash').click();
  let first:any;let lost=true;const keys:string[]=[];
  await page.route('**/api/v1/retail/bills',async route=>{if(route.request().method()!=='POST'){await route.continue();return;}keys.push(route.request().headers()['idempotency-key']);if(lost){lost=false;const actual=await route.fetch();expect(actual.status()).toBe(201);first=await actual.json();await route.abort('connectionclosed');}else await route.continue();});
  await page.locator('#complete-sale-cash').click();await expect(page.getByRole('alert').filter({hasText:/Cannot connect/}).last()).toBeVisible();await expect(page).toHaveURL(/payment$/);
  const retry=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/retail/bills'));await page.locator('#complete-sale-cash').click();const replay=await retry;expect((await replay.json()).id).toBe(first.id);expect(replay.headers()['idempotency-replayed']).toBe('true');expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);await expect(page).toHaveURL(/sale-complete$/);
  await page.goto('/retail/bills');await expect(page.getByText(first.document_number,{exact:true})).toHaveCount(1);await page.screenshot({path:info.outputPath('replayed-single-bill.png'),fullPage:true});
});
test('Daily Galla opening, reconciliation, history, export and error recovery',async({page},info)=>{
  await login(page);await page.goto('/retail/galla');await expect(page.getByTestId('galla-expected')).toBeVisible();
  await page.getByLabel('Opening Cash · optional',{exact:true}).fill('2000');await page.getByRole('button',{name:'Save Cash Count',exact:true}).click();await expect(page.getByTestId('galla-expected')).toBeVisible();
  await expect(page.getByRole('button',{name:'Save Cash Count',exact:true})).toBeEnabled();
  const expected=await page.getByTestId('galla-expected').innerText();const amount=Number(expected.replace(/[₹,]/g,''));await page.getByLabel('Actual Cash Count · optional',{exact:true}).fill(String(amount));await page.getByRole('button',{name:'Save Cash Count',exact:true}).click();await expect(page.getByText(/Difference: ₹0.00 · MATCHED/)).toBeVisible();await page.reload();await expect(page.getByLabel('Opening Cash · optional',{exact:true})).toHaveValue('2000');await expect(page.getByText(/Difference: ₹0.00 · MATCHED/)).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export Galla CSV',exact:true}).click();expect((await download).suggestedFilename()).toMatch(/EVOLIX-Galla-.*csv$/);await expect(page.locator('.r-galla-history')).toHaveCount(7);
  await page.route('**/api/v1/retail/galla?*',r=>r.fulfill({status:503,contentType:'application/json',body:'{"message":"temporarily unavailable"}'}));await page.reload();await expect(page.getByRole('alert').filter({hasText:/server could not/}).last()).toBeVisible();await page.unroute('**/api/v1/retail/galla?*');await page.locator('#retail-page-content').getByRole('button',{name:'Try Again',exact:true}).last().click();await expect(page.getByTestId('galla-expected')).toBeVisible();await page.screenshot({path:info.outputPath('galla-reconciled.png'),fullPage:true});
});
for(const size of [{width:360,height:800},{width:390,height:844},{width:412,height:915},{width:1280,height:900}])test('counter light and dark responsive '+size.width,async({page},info)=>{
  await page.setViewportSize(size);await login(page);
  for(const theme of ['light','dark']){
    await page.evaluate(t=>localStorage.setItem('evolix-theme',t),theme);
    for(const route of ['home','more','galla','more/payments']){await page.goto('/retail/'+route);await expect(page.locator('#retail-page-content')).not.toBeEmpty();await expect(page.locator('.retail-app')).toHaveAttribute('data-theme',theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(route.replace('/','-')+'-'+theme+'-'+size.width+'.png'),fullPage:true});}
  }
});
