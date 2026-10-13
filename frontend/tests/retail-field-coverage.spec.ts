import { pickOption } from './mobile-controls';
import { test, expect } from './fixtures';
test.setTimeout(180000);
const login=async(page:any)=>{page.setDefaultTimeout(15000);await page.goto('/password-login');await page.getByPlaceholder('Enter your username or email').fill(process.env.RETAIL_USERNAME!);await page.getByPlaceholder('Enter your password').fill(process.env.RETAIL_PASSWORD!);await page.getByRole('button',{name:'Sign In',exact:true}).click();await expect(page).toHaveURL(/retail\/home$/);};
test('advanced parties, multi-item purchase, photo retry, supplier payment, Quick Sale, Udhar and needs use real API',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:390,height:844});await login(page);
  const suffix=Date.now(),customer='Advanced Customer '+suffix,supplier='Advanced Supplier '+suffix,product='Advanced Stock '+suffix;
  await page.goto('/retail/customers/add');await page.locator('#customer-name').fill(customer);await page.locator('#customer-mobile').fill('9800012345');
  await page.getByRole('button',{name:'Advanced details',exact:true}).click();await page.getByLabel('Party Code (optional)').fill('AC-'+suffix);await page.getByLabel('Address',{exact:true}).fill('Main Road');
  await page.getByLabel('Email',{exact:true}).fill('advanced@test.invalid');await page.getByLabel('Credit Days',{exact:true}).fill('15');await page.getByLabel('Credit Limit (₹)',{exact:true}).fill('10000');await page.getByLabel('Opening Due (₹)',{exact:true}).fill('50');
  await page.getByRole('button',{name:'Save Customer',exact:true}).click();await expect(page).toHaveURL(/khata\/[^/]+$/);const customerId=new URL(page.url()).pathname.split('/').pop();
  await expect(page.locator('#retail-page-content')).toContainText('9800012345');await expect(page.locator('#retail-page-content')).toContainText('50');
  await page.goto('/retail/khata');await page.locator('#khata-search').fill('AC-'+suffix);await expect(page.getByText(customer,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Suppliers',exact:true}).click();await page.locator('.fab').click();await page.getByPlaceholder('e.g. ABC Distributors').fill(supplier);
  await page.getByRole('button',{name:'Advanced details',exact:true}).click();await page.getByLabel('Nickname',{exact:true}).fill('Distributor Shop');await pickOption(page.getByLabel('Supplier Category',{exact:true}), 'DISTRIBUTOR');
  const supplierResponse=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/retail/suppliers'));
  await page.locator('.r-mobile-sheet button[type=submit]').click();const supplierData=await(await supplierResponse).json();expect(supplierData.nickname).toBe('Distributor Shop');const supplierId=supplierData.id;
  await page.goto('/retail/items/add');await page.locator('#item-name-input').fill(product);await page.locator('#selling-price-input').fill('100');await page.locator('#opening-stock-input').fill('10');await page.locator('#save-item-btn').click();await expect(page).toHaveURL(/retail\/items$/);
  await page.goto('/retail/purchases/new');await pickOption(page.getByLabel('Select Supplier',{exact:true}), supplierId);await pickOption(page.locator('#purchase-item'), {label:product});await page.locator('#purchase-qty').fill('2');await page.locator('#purchase-rate').fill('50');
  await page.getByRole('button',{name:'Add another item',exact:true}).click();await pickOption(page.locator('#purchase-item-1'), {label:product});await page.locator('#purchase-qty-1').fill('1');await page.locator('#purchase-rate-1').fill('50');
  await page.getByText('Bill details',{exact:true}).click();await page.getByLabel('Supplier Bill Number',{exact:true}).fill('BILL-'+suffix);await page.getByLabel('Note',{exact:true}).fill('Multi item delivery');
  await page.getByRole('button',{name:'Partial',exact:true}).click();await page.getByLabel('Amount Paid Now',{exact:true}).fill('50');await pickOption(page.getByLabel('Payment Method',{exact:true}), 'UPI');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC','base64');
  await page.locator('input[type=file]').first().setInputFiles({name:'bill.png',mimeType:'image/png',buffer:png});
  let purchases=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/retail/purchases'))purchases++;});
  await page.route('**/api/v1/attachments',route=>route.fulfill({status:503,contentType:'application/json',body:'{"message":"Photo upload unavailable"}'}));
  await page.getByRole('button',{name:'SAVE PURCHASE',exact:true}).click();await expect(page.getByRole('button',{name:'Retry Photo Upload',exact:true})).toBeVisible();await expect(page.getByRole('status')).toContainText('Purchase saved');
  await page.unroute('**/api/v1/attachments');await page.getByRole('button',{name:'Retry Photo Upload',exact:true}).click();await expect(page).toHaveURL(/retail\/purchases$/);expect(purchases).toBe(1);
  await page.goto('/retail/suppliers/'+supplierId);await expect(page.locator('#retail-page-content')).toContainText('100');
  await page.goto('/retail/suppliers/'+supplierId+'/pay');await page.getByRole('button',{name:'Pay Full Amount',exact:true}).click();await pickOption(page.getByLabel('Payment Method',{exact:true}), 'BANK');await page.locator('summary').filter({hasText:'Optional Details'}).click();await page.getByLabel('Note',{exact:true}).fill('Settled supplier');await page.locator('#pay-supplier-save-btn').click();await expect(page).toHaveURL(new RegExp('/suppliers/'+supplierId+'$'));
  await page.goto('/retail/quick-sale');await page.getByLabel('Amount (₹)', { exact: false }).fill('75');await pickOption(page.getByLabel('Payment Method',{exact:true}), 'CARD');await page.locator('summary').filter({hasText:'Optional Details'}).click();await page.getByLabel('Note',{exact:true}).fill('Card quick sale');await page.getByRole('button',{name:'Save Quick Sale',exact:true}).click();await expect(page).toHaveURL(/retail\/bills\/[^/]+$/);await expect(page.locator('#retail-page-content')).toContainText('75');
  await page.goto('/retail/udhar');await page.getByLabel('Amount (₹)', { exact: false }).fill('125');await pickOption(page.locator('#amount-sale-customer'), customerId!);await page.locator('summary').filter({hasText:'Optional Details'}).click();await pickOption(page.getByLabel('Sales Channel',{exact:true}), 'PHONE');await page.getByRole('button',{name:'Save Udhar',exact:true}).click();await expect(page).toHaveURL(/retail\/bills\/[^/]+$/);
  await page.goto('/retail/needs');await page.locator('.fab').click();await page.getByLabel('Item Name',{exact:true}).fill('Customer Need '+suffix);await pickOption(page.getByLabel('Source',{exact:true}), 'CUSTOMER');await pickOption(page.getByLabel('Customer (optional)',{exact:true}), customerId!);await pickOption(page.getByLabel('Preferred Supplier',{exact:true}), supplierId);await pickOption(page.getByLabel('Priority',{exact:true}), 'URGENT');await page.getByLabel('Expected Price (₹)',{exact:true}).fill('300');await page.getByLabel('Note',{exact:true}).fill('Phone request');await page.getByRole('button',{name:'SAVE NEED',exact:true}).click();await expect(page.locator('.item-card').filter({hasText:'Customer Need '+suffix})).toContainText('URGENT');
  await page.screenshot({path:info.outputPath('retail-advanced-needs-390.png'),fullPage:true});expect(errors).toEqual([]);
});
for(const width of [360,390,412,1280])test('field coverage responsive '+width,async({page},info)=>{
  await page.setViewportSize({width,height:900});await login(page);
  for(const route of ['quick-sale','udhar','customers/add','purchases/new','needs','khata']){
    await page.goto('/retail/'+route);await expect(page.locator('#retail-page-content')).not.toBeEmpty();
    if(route==='customers/add')await page.getByRole('button',{name:'Advanced details',exact:true}).click();
    if(route==='needs'){await page.locator('.fab').click();await expect(page.locator('#need-name')).toBeVisible();}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.goto('/retail/purchases/new');await page.getByText('Bill details',{exact:true}).click();await page.screenshot({path:info.outputPath('retail-purchase-fields-'+width+'.png'),fullPage:true});
});
