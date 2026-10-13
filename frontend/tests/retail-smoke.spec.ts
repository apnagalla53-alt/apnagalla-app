async function goRetail(page:Page,path:string){
  // History updates can precede React's route-specific navigation state.
  await expect(page.locator('.retail-app')).toHaveAttribute('data-route',new URL(page.url()).pathname);
  const tab=page.locator('#nav-'+path);
  if(await tab.isVisible())await tab.click();else {
    await page.getByRole('button',{name:'Open shop menu',exact:true}).click();
    const menu=page.getByRole('dialog',{name:'Shop menu',exact:true});
    if(path==='items'){
      const group=menu.getByRole('button',{name:'Inventory & Stock',exact:true});
      if(await group.getAttribute('aria-expanded')!=='true')await group.click();
    }
    await menu.getByRole('link',{name:({home:'Home',bill:'Make Bill',items:'Items',khata:'Khata'} as Record<string,string>)[path],exact:true}).click();
  }
  await expect(page).toHaveURL(new RegExp('/retail/'+path+'$'));
  await expect(page.locator('.retail-app')).toHaveAttribute('data-route','/retail/'+path);
  await expect(page.getByRole('dialog',{name:'Shop menu',exact:true})).not.toBeVisible();
  if(path==='home')await expect(page.locator('#qa-new-bill')).toBeVisible();
}
import { pickOption } from './mobile-controls';
import { test, expect, type Page } from './fixtures';

test.setTimeout(180_000);
async function login(page: Page, username=process.env.RETAIL_USERNAME!, password=process.env.RETAIL_PASSWORD!) {
  page.setDefaultTimeout(15000);
  await page.goto('/password-login');
  await page.getByPlaceholder('Enter your username or email').fill(username);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', {name:'Sign In',exact:true}).click();
  await expect(page).toHaveURL(/\/retail\/home$/);
  await expect(page.locator('#qa-new-bill')).toBeVisible();
}
async function addToBill(page: Page, name: string) {
  await goRetail(page,'bill');
  await page.locator('#item-search-input').fill(name);
  await page.getByRole('button').filter({hasText:name}).click();
  await expect(page.locator('#pay-btn')).toHaveText('PAY ₹100');
  await page.locator('#pay-btn').click();
}

test('real Retail lifecycle: items, all payment modes, khata, return, stock purchase, expense, needs and reports', async ({page}, info) => {
  const errors: string[] = [];
  const network: string[] = [];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400 && !r.url().includes('/platform/auth/login')) network.push(`${r.status()} ${r.url()}`);});
  page.on('requestfailed',r=>{if(!r.failure()?.errorText.includes('ERR_ABORTED')) network.push(`${r.failure()?.errorText} ${r.url()}`);});
  page.on('dialog',dialog=>dialog.accept());
  await page.setViewportSize({width:390,height:844});
  // Provision through the actual Super Admin UI; this flow uses no seeded shop.
  const freshSuffix=Date.now(),freshOwner='fresh-retail-'+freshSuffix+'@test.invalid',freshPassword='DisposableRetail!'+freshSuffix;
  await page.goto('/platform/login');await page.getByLabel('Username or email',{exact:true}).fill(process.env.PLATFORM_USERNAME!);await page.getByLabel('Password',{exact:true}).fill(process.env.PLATFORM_PASSWORD!);await page.getByRole('button',{name:'Sign In',exact:true}).click();await expect(page).toHaveURL(/platform\/dashboard$/);
  await page.goto('/platform/tenants');await page.getByRole('button',{name:'Create organization',exact:true}).click();
  await page.getByLabel('Shop name',{exact:true}).fill('Fresh Retail '+freshSuffix);await page.getByLabel('Owner name',{exact:true}).fill('Fresh Owner');await page.getByLabel('Owner email / username',{exact:true}).fill(freshOwner);await page.getByLabel('Temporary password',{exact:true}).fill(freshPassword);
  await page.getByLabel('Phone',{exact:true}).fill('9890012345');
  await page.getByRole('button',{name:'Create ready-to-use shop',exact:true}).click();await expect(page.getByRole('button',{name:'Create ready-to-use shop',exact:true})).toHaveCount(0);
  await page.goto('/platform/login');await page.evaluate(()=>localStorage.removeItem('evolix-auth'));await login(page,freshOwner,freshPassword);
  for (const [button, route] of [['qa-new-bill','bill'],['qa-held-bills','bills/held'],['qa-add-expense','expenses/add'],['qa-need-list','needs'],['qa-add-purchase','purchases/new'],['qa-customer-payment','receive-payment']]) {
    if(!await page.locator(`#${button}`).isVisible())await page.getByRole('button',{name:'Open shop menu',exact:true}).click();
    if(!await page.locator(`#${button}`).isVisible())await page.getByRole('button',{name:button==='qa-held-bills'?'Sell & Billing':'Inventory & Stock',exact:true}).click();
    await page.locator(`#${button}`).click(); await expect(page).toHaveURL(new RegExp(`/retail/${route}$`));
    await expect(page.locator('#retail-page-content')).not.toBeEmpty(); await goRetail(page,'home');
  }
  const suffix = Date.now(); const product = `Test Product ${suffix}`; const customer = `Smoke Customer ${suffix}`; const supplier = `Smoke Supplier ${suffix}`;
  await goRetail(page,'items');
  await page.locator('#add-item-btn').click();
  await page.locator('#item-name-input').fill(product);
  await page.locator('#selling-price-input').fill('100');
  await page.locator('#opening-stock-input').fill('10');
  await page.locator('#save-item-btn').click();
  await expect(page).toHaveURL(/\/retail\/items$/);
  const itemRow = page.locator('.r-list-item').filter({hasText:product});
  await expect(itemRow).toContainText('Stock: 10 PCS');
  await itemRow.click(); await expect(page.getByRole('heading',{name:product})).toBeVisible();
  await expect(page.locator('#retail-page-content')).toContainText('Selling Price: ₹100');
  const itemId = (new URL(page.url())).pathname.split('/').pop();

  // Cash received/change, then use the real server invoice in history/detail.
  await addToBill(page,product); await page.locator('#pay-cash').click(); await page.locator('#cash-received-input').fill('200');
  await expect(page.getByText('Change to return')).toBeVisible();
  const cashResponse = page.waitForResponse(r=>r.request().method()==='POST' && r.url().endsWith('/retail/bills'));
  await page.locator('#complete-sale-cash').click(); const cash = await (await cashResponse).json();
  expect(cash.id).toBeTruthy(); expect(Number(cash.grand_total)).toBe(100);
  await expect(page).toHaveURL(/\/retail\/sale-complete$/);
  await expect(page.getByText(cash.document_number,{exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('cash-sale-complete.png'),fullPage:true});
  await page.locator('#view-bill-btn').click(); await expect(page).toHaveURL(new RegExp(`/bills/${cash.id}$`));
  await expect(page.locator('#retail-page-content')).toContainText(product);
  await expect(page.locator('#retail-page-content')).toContainText('Paid: ₹100');
  await page.goto('/retail/bills'); await expect(page.getByText(cash.document_number,{exact:true})).toBeVisible();

  await addToBill(page,product); await page.locator('#pay-upi').click(); await page.getByLabel('I checked my UPI or bank app and received this payment.',{exact:true}).check(); await page.locator('#complete-sale-upi').click();
  await expect(page).toHaveURL(/sale-complete$/); await expect(page.locator('.r-success-details')).toContainText('UPI');
  await page.locator('#new-bill-btn').click();
  await page.goto('/retail/customers/add'); await page.locator('#customer-name').fill(customer); await page.getByRole('button',{name:'Save Customer',exact:true}).click();
  await expect(page).toHaveURL(/\/khata\/[^/]+$/); const customerId = new URL(page.url()).pathname.split('/').pop();
  await addToBill(page,product); await page.locator('#pay-udhar').click();
  await expect(page.getByRole('heading',{name:'Select Customer for Udhar'})).toBeVisible();
  await page.getByRole('searchbox').fill(customer); await page.getByRole('option').filter({hasText:customer}).click(); await page.locator('#save-as-udhar').click();
  await expect(page).toHaveURL(/sale-complete$/);
  await page.goto(`/retail/khata/${customerId}`); await expect(page.locator('#retail-page-content')).toContainText('₹100');
  await page.goto(`/retail/receive-payment?customer=${customerId}`); await page.getByPlaceholder('0',{exact:true}).fill('100'); await page.locator('#receive-payment-save-btn').click();
  await expect(page).toHaveURL(new RegExp(`/khata/${customerId}$`));
  await expect(page.locator('#retail-page-content')).toContainText('₹0');

  await addToBill(page,product); await page.locator('#pay-split').click(); await page.locator('#split-cash-input').fill('40'); await page.locator('#split-upi-input').fill('60'); await page.getByLabel('I checked my UPI or bank app and received this payment.',{exact:true}).check(); await page.locator('#complete-sale-split').click();
  await expect(page).toHaveURL(/sale-complete$/); await expect(page.locator('.r-success-details')).toContainText('Cash ₹40 + UPI ₹60');

  await page.goto(`/retail/bills/${cash.id}/return`); await page.getByRole('button',{name:'+',exact:true}).click(); await page.getByRole('button',{name:'Process Return'}).click(); await expect(page).toHaveURL(/\/retail\/bills$/);
  await page.goto(`/retail/items/${itemId}`); await expect(page.locator('#retail-page-content')).toContainText('Stock: 7 PCS');

  await page.goto('/retail/suppliers'); await page.locator('.fab').click(); await page.getByPlaceholder('e.g. ABC Distributors').fill(supplier); await page.locator('.r-mobile-sheet button[type=submit]').click();
  await expect(page.locator('.item-card').filter({hasText:supplier})).toBeVisible();
  await page.goto('/retail/purchases/new'); await pickOption(page.locator('#purchase-supplier'), {label:supplier}); await pickOption(page.locator('#purchase-item'), {label:product}); await page.locator('#purchase-qty').fill('5'); await page.locator('#purchase-rate').fill('60'); await page.getByRole('button',{name:'SAVE PURCHASE',exact:true}).click();
  await expect(page).toHaveURL(/\/retail\/purchases$/); await expect(page.locator('#retail-page-content')).toContainText('300');
  await page.goto(`/retail/items/${itemId}`); await expect(page.locator('#retail-page-content')).toContainText('Stock: 12 PCS');

  await page.goto('/retail/expenses/add');
  await page.getByRole('button').filter({has:page.locator('svg.lucide-plus')}).click();
  await page.getByPlaceholder('New Category Name').fill(`Tea ${suffix}`); await page.getByRole('button',{name:'Save',exact:true}).click();
  await pickOption(page.getByLabel('Category', {exact:true}), {label:`Tea ${suffix}`});
  await page.getByPlaceholder('0.00',{exact:true}).fill('50'); await page.locator('summary').filter({hasText:'More Details / Bill & Receipt'}).click(); await page.getByPlaceholder('What was this for?').fill('Tea'); await page.getByRole('button',{name:'Save Expense',exact:true}).click();
  await expect(page).toHaveURL(/\/retail\/expenses$/); await expect(page.locator('#retail-page-content')).toContainText('Tea');
  await page.goto('/retail/needs'); await page.locator('.fab').click(); await page.getByPlaceholder('e.g. Dairy Milk Silk').fill(`Test Missing Item ${suffix}`); await page.locator('#need-quantity').fill('2'); await page.locator('.r-mobile-sheet button[type=submit]').click();
  await expect(page.locator('.item-card').filter({hasText:`Test Missing Item ${suffix}`})).toContainText('2');
  for (const route of ['sales','purchases','expenses','stock','customers','suppliers','returns']) {
    await page.goto(`/retail/reports/${route}`); await expect(page.locator('.r-header-title')).toBeVisible();
    await expect(page.getByText('Loading...', {exact:true})).toHaveCount(0);
    await expect(page.getByText('Unable to load summary',{exact:true})).toHaveCount(0);
  }
  await page.goto('/retail/more'); await expect(page.getByRole('button',{name:'Expenses Manage daily expenses'})).toBeVisible();
  const moreRoutes = [['Bill History','bills'],['Purchases','purchases'],['Expenses','expenses'],['Reports','reports'],['Cash & Bank','galla'],['Daily Galla','galla'],['UPI & Payments','more/payments'],['Supplier Due','reports/suppliers'],['Need List','needs'],['Suppliers','suppliers'],['Settings','more/settings'],['Backup & Restore','more/backup']];
  for (const [label,route] of moreRoutes) {
    await page.locator('.r-menu-item').filter({has:page.getByText(label,{exact:true})}).first().click(); await expect(page).toHaveURL(new RegExp(`/retail/${route}$`));
    await expect(page.locator('#retail-page-content')).not.toBeEmpty();
    if(route==='more/settings')await expect(page.getByRole('heading',{name:'Make EVOLIX comfortable',exact:true})).toBeVisible();
    if(route==='more/backup')await expect(page.getByRole('heading',{name:'Backup not configured',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Open shop menu',exact:true}).click();
    const settingsGroup=page.getByRole('button',{name:'Settings & Help',exact:true});
    if(await settingsGroup.getAttribute('aria-expanded')!=='true')await settingsGroup.click();
    await page.getByRole('link',{name:'All settings & tools',exact:true}).click();
  }
  expect(errors).toEqual([]); expect(network).toEqual([]);
  await info.attach('runtime-audit',{body:JSON.stringify({errors,network},null,2),contentType:'application/json'});
});

for (const size of [{width:360,height:800},{width:390,height:844},{width:412,height:915},{width:1280,height:900}]) {
  test(`${size.width < 1000 ? 'mobile' : 'desktop'} ${size.width}: routes, navigation, bill and payment remain visible`,async({page},info)=>{
    await page.setViewportSize(size); await login(page);
    const mobileProduct='Mobile QA '+size.width+' '+Date.now();
    await page.goto('/retail/items/add');await page.locator('#item-name-input').fill(mobileProduct);await page.locator('#selling-price-input').fill('100');await page.locator('#opening-stock-input').fill('5');await page.locator('#save-item-btn').click();await expect(page).toHaveURL(/\/retail\/items$/);
    for(const route of ['home','items','items/add','bill','payment','sale-complete','khata','receive-payment','purchases','purchases/new','suppliers','needs','expenses','expenses/add','reports','more','bills','bills/held','more/settings','more/cash-bank','more/backup']) {
      await page.goto(`/retail/${route}`);
      // Keep the multi-viewport route sweep within the real report quota.
      await page.waitForTimeout(1500);
      await expect(page.locator('#retail-page-content')).not.toBeEmpty();
      if(['home','items','khata','purchases','suppliers','expenses','reports','more/settings'].includes(route))await expect(page.locator('#retail-bottom-nav')).toBeVisible(); else await expect(page.getByRole('button',{name:/Back|Open shop menu/}).first()).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await page.locator('#retail-page-content').innerText()).not.toContain('Something went wrong');
    }
    await goRetail(page,'bill'); await page.locator('#item-search-input').fill('No Such Smoke Item');
    await expect(page.getByRole('heading',{name:'No items found',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'+ Add Item & Bill',exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('Selling price (₹)',{exact:true})).toBeVisible();
    await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
    await page.screenshot({path:info.outputPath(`mobile-${size.width}.png`),fullPage:true});
    await page.locator('#item-search-input').fill(mobileProduct);
    await page.getByRole('button').filter({hasText:mobileProduct}).first().click(); await page.locator('#pay-btn').click();
    for (const mode of ['cash','upi','udhar','split']) await expect(page.locator(`#pay-${mode}`)).toBeVisible();
    await page.locator('#pay-cash').click(); await page.locator('#cash-received-input').fill('200');
    await expect(page.getByText('Change to return')).toBeVisible(); await expect(page.locator('#complete-sale-cash')).toBeVisible();
    const button = await page.locator('#complete-sale-cash').boundingBox(); const nav = await page.locator('#retail-bottom-nav').boundingBox();
    expect(button && button.y+button.height <= size.height).toBeTruthy();
    expect(nav).toBeNull();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`payment-${size.width}.png`),fullPage:true});
    await goRetail(page,'home'); await expect(page).toHaveURL(/home$/);
  });
}

test('Retail shows recoverable API and render errors, loading, empty and setup states',async({page})=>{
  test.setTimeout(60_000);
  await login(page);
  await page.route('**/api/v1/retail/items*',route=>route.fulfill({status:500,contentType:'application/json',body:'{"message":"failure"}'}));
  await goRetail(page,'items'); await expect(page.locator('#retail-page-content').getByRole('alert').last()).toContainText('server could not complete'); await expect(page.locator('#retail-page-content').getByRole('button',{name:'Try Again',exact:true}).last()).toBeVisible();
  await page.unroute('**/api/v1/retail/items*');
  await page.route('**/api/v1/retail/items*',async route=>{await new Promise(resolve=>setTimeout(resolve,600)); await route.fulfill({contentType:'application/json',body:'[]'});});
  await page.reload(); await expect(page.getByText('Loading inventory…',{exact:true})).toBeVisible(); await expect(page.getByText('No items yet',{exact:true})).toBeVisible();
  await page.unroute('**/api/v1/retail/items*'); await page.route('**/api/v1/retail/items*',route=>route.fulfill({contentType:'application/json',body:'{}'}));
  await page.reload(); await expect(page.getByRole('heading',{name:'Something went wrong',exact:true})).toBeVisible();
  await page.unroute('**/api/v1/retail/items*');
  await page.route('**/api/v1/retail/reports/assistant/notifications',route=>route.fulfill({status:500,contentType:'application/json',body:'{"message":"inbox unavailable"}'}));
  await page.goto('/retail/reports');
  await expect(page.locator('#report-inbox')).toContainText('Reports could not be loaded');
  await expect(page.locator('#report-inbox').getByRole('status')).toHaveCount(0);
  await page.unroute('**/api/v1/retail/reports/assistant/notifications');
  await page.getByRole('button',{name:'Retry inbox',exact:true}).click();
  await expect(page.locator('#report-inbox')).not.toContainText('Reports could not be loaded');
  await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('evolix-auth')!);state.state.tenantContext=null;localStorage.setItem('evolix-auth',JSON.stringify(state));});
  await page.reload(); await expect(page.getByRole('heading',{name:'Complete Shop Setup',exact:true})).toBeVisible();
});

test('quick item needs only name and price; failed sale preserves the cart; held bill cannot overwrite it',async({page})=>{
  test.setTimeout(60_000);
  await login(page);
  const product = `Quick Item ${Date.now()}`;
  await page.goto('/retail/items/add');
  await page.locator('#item-name-input').fill(product);
  await page.locator('#selling-price-input').fill('100');
  await page.locator('#save-item-btn').click();
  await expect(page).toHaveURL(/\/retail\/items$/);
  await page.locator('#item-search').fill(product);
  await expect(page.locator('.r-list-item').filter({hasText:product})).toContainText('Stock: 0 PCS');
  const name = `Recovery Product ${Date.now()}`;
  await page.locator('#add-item-btn').click();
  await page.locator('#item-name-input').fill(name);
  await page.locator('#selling-price-input').fill('100');
  await page.locator('#opening-stock-input').fill('1');
  await page.locator('#save-item-btn').click();
  await expect(page).toHaveURL(/\/retail\/items$/);
  await addToBill(page,name);
  await page.locator('#pay-cash').click();
  await page.route('**/api/v1/retail/bills',route=>route.fulfill({status:500,contentType:'application/json',body:'{"message":"posting failed"}'}));
  await page.locator('#complete-sale-cash').click();
  await expect(page).toHaveURL(/\/payment$/);
  await expect(page.getByRole('alert').first()).toContainText('server could not complete');
  await page.unroute('**/api/v1/retail/bills');
  await goRetail(page,'bill'); await expect(page.locator('#pay-btn')).toHaveText('PAY ₹100');
  await page.locator('#hold-bill-btn').click(); await expect(page).toHaveURL(/\/home$/);
  await addToBill(page,name); await goRetail(page,'bill');
  await goRetail(page,'home'); await page.getByRole('button',{name:'Open shop menu',exact:true}).click(); await page.getByRole('button',{name:'Sell & Billing',exact:true}).click(); await page.locator('#qa-held-bills').click();
  await expect(page.getByRole('button',{name:/Resume/}).first()).toBeVisible();await expect(page.locator('#retail-page-content')).not.toContainText('Invalid Date');
  let dialogText = '';
  page.once('dialog',async dialog=>{dialogText=dialog.message(); await dialog.accept();});
  await page.getByRole('button',{name:/Resume/}).first().click();
  expect(dialogText).toContain('Finish or hold your current bill');
  await goRetail(page,'bill'); await expect(page.locator('#pay-btn')).toHaveText('PAY ₹100');
});
