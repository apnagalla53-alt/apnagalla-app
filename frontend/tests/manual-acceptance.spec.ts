import { pickOption } from './mobile-controls';
import { test, expect, type Page } from './fixtures';

test.setTimeout(240_000);
const apiOrigin = process.env.TEST_API_ORIGIN || 'http://localhost:8010/api/v1';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const shifted = (days: number) => new Date(new Date(today() + 'T12:00:00Z').getTime() + days * 86400000).toISOString().slice(0, 10);

async function login(page: Page, username: string, password: string, platform = false) {
  await page.goto(platform ? '/platform/login' : '/password-login');
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(platform ? /platform\/dashboard$/ : /retail\/home$/);
}
async function freshShop(page: Page, features: string[] = []) {
  page.setDefaultTimeout(15_000);
  await login(page, process.env.PLATFORM_USERNAME!, process.env.PLATFORM_PASSWORD!, true);
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('evolix-auth')!).state.session_id);
  const headers = { Authorization: 'Bearer ' + token }, suffix = Date.now();
  const username = `manual-${suffix}@test.invalid`, password = `DisposableManual!${suffix}`;
  const created = await page.request.post(apiOrigin + '/platform/admin/tenants', { headers, data: { planId: process.env.TEST_NEW_TENANT_PLAN_ID, organizationName: 'Visible Manual QA ' + suffix, adminName: 'Manual Owner', adminEmail: username, adminPassword: password } });
  expect(created.status()).toBe(201); const shop = await created.json();
  for (const feature_code of features) {
    const enabled = await page.request.post(apiOrigin + '/platform/admin/tenants/' + shop.organization.id + '/actions', { headers, data: { action: 'feature', feature_code, enabled: true, reason: 'Disposable owner manual acceptance' } });
    expect(enabled.status()).toBe(201);
  }
  await page.evaluate(() => localStorage.removeItem('evolix-auth'));
  await login(page, username, password);
  await page.setViewportSize({ width: 390, height: 844 });
  page.on('dialog', dialog => dialog.accept());
  return { ...shop, username, password };
}
async function headers(page: Page) {
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('evolix-auth')!).state);
  return { Authorization: 'Bearer ' + state.session_id, 'X-Company-Id': state.tenantContext.company_id, 'X-Branch-Id': state.tenantContext.branch_id, 'X-Financial-Year-Id': state.tenantContext.financial_year_id };
}
async function read(page: Page, path: string) {
  const response = await page.request.get(apiOrigin + '/' + path, { headers: await headers(page) });
  expect(response.status()).toBe(200); return response.json();
}
async function supplier(page: Page, name = 'Manual Supplier') {
  await page.goto('/retail/suppliers'); await page.locator('.fab').click();
  await page.getByPlaceholder('e.g. ABC Distributors').fill(name);
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/retail/suppliers'));
  await page.locator('.r-mobile-sheet button[type=submit]').click();
  const result = await (await response).json(); await expect(page.getByRole('dialog')).toHaveCount(0); return result;
}
async function item(page: Page, name: string, options: { mode?: string; stock?: string; price?: string; service?: boolean; batch?: boolean; serial?: boolean; variants?: boolean; low?: string } = {}) {
  await page.goto('/retail/items/add');
  await page.locator('#item-name-input').fill(name); await page.locator('#selling-price-input').fill(options.price || '100');
  if (options.stock) await page.locator('#opening-stock-input').fill(options.stock);
  if (options.mode || options.service || options.batch || options.serial || options.variants || options.low) {
    await page.locator('#more-details-toggle').click();
    if (options.service) await pickOption(page.getByLabel('Item type', { exact: true }), 'SERVICE');
    if (options.mode) await pickOption(page.getByLabel('Sold by', { exact: true }), options.mode);
    if (options.batch) await page.getByLabel('Batch & expiry tracking', { exact: true }).check();
    if (options.serial) { await page.getByLabel('Serial numbers & warranty', { exact: true }).check(); await page.getByLabel('Warranty in days', { exact: true }).fill('365'); }
    if (options.variants) await page.getByLabel('Variants (size, colour or other choices)', { exact: true }).check();
    if (options.low) await page.locator('#low-stock-alert-input').fill(options.low);
  }
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/retail/items'));
  await page.locator('#save-item-btn').click(); const saved = await (await response).json();
  await expect(page).toHaveURL(/retail\/items$/); return saved;
}
async function receive(page: Page, supplierId: string, name: string, options: { quantity?: string; cost?: string; unit?: string; variant?: string; batch?: string; expiry?: string; serial?: string; length?: string; width?: string } = {}) {
  await page.goto('/retail/purchases/new'); await pickOption(page.locator('#purchase-supplier'), supplierId);
  await pickOption(page.locator('#purchase-item'), { label: name });
  if (options.unit) await pickOption(page.locator('#purchase-unit-0'), { label: options.unit });
  if (options.variant) await pickOption(page.locator('#purchase-variant-0'), { label: options.variant });
  await page.locator('#purchase-qty').fill(options.quantity || '5'); await page.locator('#purchase-rate').fill(options.cost || '10');
  if (options.batch) await page.getByLabel('Batch Number', { exact: true }).fill(options.batch);
  if (options.expiry) await page.getByLabel('Expiry Date', { exact: true }).fill(options.expiry);
  if (options.serial) await page.getByLabel('Serial numbers, one per line', { exact: false }).fill(options.serial);
  if (options.length) await page.getByLabel('Length', { exact: true }).fill(options.length);
  if (options.width) await page.getByLabel('Width', { exact: true }).fill(options.width);
  await page.getByRole('button', { name: 'SAVE PURCHASE', exact: true }).click(); await expect(page).toHaveURL(/retail\/purchases$/);
}
async function addToBill(page: Page, name: string) {
  await page.goto('/retail/bill'); await page.locator('#item-search-input').fill(name);
  await page.getByRole('button').filter({ hasText: name }).first().click();
}
async function completeCash(page: Page) {
  await page.locator('#pay-btn').click(); await page.locator('#pay-cash').click();
  await expect(page.locator('#complete-sale-cash')).toBeEnabled();
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/retail/bills'));
  await page.locator('#complete-sale-cash').click(); const bill = await (await response).json();
  await expect(page).toHaveURL(/sale-complete$/); return bill;
}
async function returnBill(page: Page, billId: string, name: string, quantity = '1') {
  await page.goto('/retail/bills/' + billId + '/return');
  await expect(page.getByLabel('Return quantity for ' + name, { exact: true })).toBeVisible();
  const serial=page.getByRole('checkbox');
  if(await serial.count()) await serial.first().check();
  else await page.getByLabel('Return quantity for ' + name, { exact: true }).fill(quantity);
  await expect(page.getByLabel('Return quantity for ' + name, { exact: true })).toHaveValue(quantity);
  await expect(page.getByRole('button', { name: 'Process Return', exact: false })).toBeEnabled();
  await page.getByRole('button', { name: 'Process Return', exact: false }).click(); await expect(page).toHaveURL(/retail\/bills$/);
}
async function stock(page: Page, name: string, expected: number) {
  await page.goto('/retail/stock'); await page.locator('#item-search').fill(name);
  await expect(page.locator('.r-list-item').filter({ hasText: name })).toContainText('Stock: ' + expected + ' ');
}
async function amountSale(page: Page, amount: string, method: string, customerId?: string, date?: string) {
  await page.goto(method === 'UDHAR' ? '/retail/udhar' : '/retail/quick-sale');
  await page.getByLabel('Amount (₹)', { exact: false }).fill(amount);
  if (customerId) await pickOption(page.locator('#amount-sale-customer'), customerId);
  if (method !== 'UDHAR') await pickOption(page.getByLabel('Payment Method', { exact: true }), method);
  if (date) await page.locator('#amount-sale-date').fill(date);
  await page.getByRole('button', { name: method === 'UDHAR' ? 'Save Udhar' : 'Save Quick Sale', exact: true }).click();
  await expect(page).toHaveURL(/retail\/bills\/[^/]+$/);
}

test('Manual 07–12 / 24: real purchase starts counting; an older uncounted return never creates phantom stock', async ({ page }, info) => {
  await freshShop(page); const name = 'Visible price-only goods';
  await page.goto('/retail/bill'); await page.locator('#item-search-input').fill(name); await page.getByRole('button', { name: '+ Add Item & Bill', exact: true }).click();
  await page.getByLabel('Selling price (₹)', { exact: true }).fill('200'); await page.getByRole('button', { name: 'Save & Add to Bill', exact: true }).click();
  const first = await completeCash(page), detail = await read(page, 'retail/bills/' + first.id), id = detail.sales_invoice_line[0].item_id;
  const s = await supplier(page); await receive(page, s.id, name, { cost: '100' }); await stock(page, name, 5);
  await returnBill(page, first.id, name); await stock(page, name, 5);
  await addToBill(page, name); await completeCash(page); await stock(page, name, 4);
  const attempt = await page.request.post(apiOrigin + '/retail/bills', { headers: await headers(page), data: { items: [{ item_id: id, quantity: 5, rate: 200 }], payment_splits: [{ method: 'CASH', amount: 1000 }] } });
  expect(attempt.status()).toBe(400); await stock(page, name, 4);
  await page.screenshot({ path: info.outputPath('manual-counted-stock-after-old-return.png'), fullPage: true });
});

test('Manual 18 / 26: a service bills without stock and split checkout rejects missing or excessive payment', async ({ page }) => {
  await freshShop(page, ['SERVICES']); const service = await item(page, 'Manual repair service', { service: true });
  await addToBill(page, service.name); await page.locator('#pay-btn').click(); await page.locator('#pay-split').click();
  await page.locator('#split-cash-input').fill('40'); await page.locator('#split-upi-input').fill('40'); await expect(page.locator('#complete-sale-split')).toBeDisabled();
  await page.locator('#split-upi-input').fill('80'); await expect(page.locator('#complete-sale-split')).toBeDisabled();
  await page.locator('#split-upi-input').fill('60'); await expect(page.locator('#complete-sale-split')).toBeDisabled();
  await page.getByLabel('I checked my UPI or bank app and received this payment.',{exact:true}).check(); await expect(page.locator('#complete-sale-split')).toBeEnabled();
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/retail/bills'));
  await page.locator('#complete-sale-split').click(); const bill = await (await response).json(); await expect(page).toHaveURL(/sale-complete$/);
  const movements = await read(page, 'inventory/movements?item_id=' + service.id); expect(movements).toEqual([]);
  await returnBill(page, bill.id, service.name); expect(await read(page, 'inventory/movements?item_id=' + service.id)).toEqual([]);
});

test('Manual 27: variant BOX receiving/selling uses ten base units and protects saved conversion factors', async ({ page }, info) => {
  await freshShop(page, ['VARIANTS', 'MULTI_UNIT']); const product = await item(page, 'Manual packed shirt', { variants: true });
  await page.goto('/retail/items/' + product.id); await page.locator('summary').filter({ hasText: 'Variants' }).click(); await page.getByLabel('Size / option', { exact: true }).fill('Large');
  await page.getByRole('button', { name: 'Add Variant', exact: true }).click(); await expect(page.getByText('Large', { exact: true })).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Units & packs' }).click(); await page.getByLabel(/1 BOX contains/).fill('10'); await page.getByRole('button', { name: 'Add Unit', exact: true }).click();
  await expect(page.getByText('1 BOX = 10 PCS', { exact: true })).toBeVisible(); await page.getByLabel(/1 BOX contains/).fill('20'); await page.getByRole('button', { name: 'Add Unit', exact: true }).click(); await expect(page.getByRole('alert').last()).toBeVisible();
  const s = await supplier(page); await receive(page, s.id, product.name, { quantity: '2', unit: 'BOX (10 base units)', variant: 'Large' }); await stock(page, product.name, 20);
  await addToBill(page, product.name); await pickOption(page.getByLabel('Variant', { exact: true }), { label: 'Large' }); await pickOption(page.getByLabel('Unit', { exact: true }), { label: 'BOX' }); await page.getByLabel('Rate (₹ per selected unit)', { exact: true }).fill('100'); await page.getByRole('button', { name: 'Save Line', exact: true }).click();
  const bill = await completeCash(page); expect(Number(bill.grand_total)).toBe(100); await stock(page, product.name, 10);
  await page.goto('/retail/bills/' + bill.id); await expect(page.locator('#retail-page-content')).toContainText('1 BOX');
  await page.screenshot({ path: info.outputPath('manual-pack-bill.png'), fullPage: true });
});

for (const mode of ['WEIGHT', 'LENGTH', 'AREA']) test('Manual 28: receive, bill and return ' + mode.toLowerCase() + ' through Retail', async ({ page }, info) => {
  await freshShop(page, [mode]); const product = await item(page, 'Manual ' + mode.toLowerCase(), { mode }); const s = await supplier(page);
  await receive(page, s.id, product.name, mode === 'AREA' ? { quantity: '1', length: '5', width: '4' } : { quantity: '10' });
  await addToBill(page, product.name);
  const quantity = mode === 'WEIGHT' ? '.5' : mode === 'LENGTH' ? '2' : '1';
  await page.getByLabel(mode === 'WEIGHT' ? 'Weight / quantity' : mode === 'LENGTH' ? 'Length / quantity' : 'Quantity', { exact: true }).fill(quantity);
  if (mode === 'AREA') {
    await page.getByLabel('Length', { exact: true }).fill('0'); await page.getByLabel('Width', { exact: true }).fill('3'); await page.getByRole('button', { name: 'Save Line', exact: true }).click(); await expect(page.getByRole('button', { name: 'Save Line', exact: true })).toBeVisible();
    await page.getByLabel('Length', { exact: true }).fill('2');
  }
  await page.getByRole('button', { name: 'Save Line', exact: true }).click(); const bill = await completeCash(page);
  const total = mode === 'WEIGHT' ? 50 : mode === 'LENGTH' ? 200 : 600; expect(Number(bill.grand_total)).toBe(total);
  await stock(page, product.name, mode === 'WEIGHT' ? 9.5 : mode === 'LENGTH' ? 8 : 14);
  await returnBill(page, bill.id, product.name, quantity); await stock(page, product.name, mode === 'AREA' ? 20 : 10);
  await page.screenshot({ path: info.outputPath('manual-' + mode.toLowerCase() + '-returned.png'), fullPage: true });
});

test('Manual 29: receiving two expiry lots uses FEFO and rejects expired-only stock', async ({ page }, info) => {
  await freshShop(page, ['BATCH_TRACKING']); const s = await supplier(page), product = await item(page, 'Manual medicine', { batch: true });
  await receive(page, s.id, product.name, { quantity: '2', batch: 'LATER', expiry: shifted(90) }); await receive(page, s.id, product.name, { quantity: '2', batch: 'EARLIER', expiry: shifted(30) });
  const options = await read(page, 'retail/items/' + product.id + '/options'); const earlier = options.batches.find((b: any) => b.batch_number === 'EARLIER');
  await addToBill(page, product.name); const bill = await completeCash(page); const details = await read(page, 'retail/bills/' + bill.id);
  expect(details.sales_invoice_line[0].batch_id).toBe(earlier.id); await returnBill(page, bill.id, product.name); await stock(page, product.name, 4);
  const expired = await item(page, 'Manual expired medicine', { batch: true }); await receive(page, s.id, expired.name, { quantity: '1', batch: 'EXPIRED', expiry: shifted(-1) });
  await addToBill(page, expired.name); await page.locator('#pay-btn').click(); await page.locator('#pay-cash').click(); await page.locator('#complete-sale-cash').click(); await expect(page.getByRole('alert').last()).toBeVisible(); await expect(page).toHaveURL(/retail\/payment$/);
  await page.screenshot({ path: info.outputPath('manual-expired-checkout-blocked.png'), fullPage: true });
});

test('Manual 30: unique serial receiving, one sale, visible warranty and original return/resale', async ({ page }, info) => {
  await freshShop(page, ['SERIAL_TRACKING']); const s = await supplier(page), product = await item(page, 'Manual serial appliance', { serial: true });
  await receive(page, s.id, product.name, { quantity: '2', serial: 'MANUAL-SN-ONE\nMANUAL-SN-TWO' });
  await addToBill(page, product.name); await page.getByLabel('MANUAL-SN-ONE', { exact: true }).check(); await page.getByRole('button', { name: 'Save Line', exact: true }).click(); const bill = await completeCash(page);
  await page.goto('/retail/bills/' + bill.id); await expect(page.locator('#retail-page-content')).toContainText('MANUAL-SN-ONE'); await expect(page.locator('#retail-page-content')).toContainText('Warranty');
  await page.screenshot({ path: info.outputPath('manual-serial-warranty.png'), fullPage: true });
  await addToBill(page, product.name); await expect(page.getByLabel('MANUAL-SN-ONE', { exact: true })).toHaveCount(0); await page.keyboard.press('Escape');
  await returnBill(page, bill.id, product.name); await addToBill(page, product.name); await page.getByLabel('MANUAL-SN-ONE', { exact: true }).check(); await page.getByRole('button', { name: 'Save Line', exact: true }).click(); await completeCash(page); await stock(page, product.name, 1);
});

test('Manual 38–42: recurring visits, changed promise, collection and refreshed tasks reflect in Calendar', async ({ page }, info) => {
  await freshShop(page); const s = await supplier(page);
  await page.goto('/retail/suppliers/' + s.id); await page.locator('summary').filter({ hasText: 'Supplier visit schedule' }).click(); await page.getByLabel('Next visit', { exact: true }).fill('2026-01-31'); await pickOption(page.getByLabel('Repeat', { exact: true }), 'MONTHLY'); await page.getByRole('button', { name: 'Save Visit Schedule', exact: true }).click();
  await page.reload(); await page.locator('summary').filter({ hasText: 'Supplier visit schedule' }).click(); await expect(page.getByLabel('Next visit', { exact: true })).toHaveValue('2026-01-31');
  const feb = await read(page, 'retail/calendar?month=2026-02'), mar = await read(page, 'retail/calendar?month=2026-03'); expect(feb.visits.map((v: any) => v.date)).toEqual(['2026-02-28']); expect(mar.visits.map((v: any) => v.date)).toEqual(['2026-03-31']);
  await page.getByLabel('Next visit', { exact: true }).fill(today()); await pickOption(page.getByLabel('Repeat', { exact: true }), 'WEEKLY'); await page.getByRole('button', { name: 'Save Visit Schedule', exact: true }).click();
  await page.goto('/retail/customers/add'); await page.locator('#customer-name').fill('Manual promised customer'); await page.getByRole('button', { name: 'Save Customer', exact: true }).click(); await expect(page).toHaveURL(/khata\/[^/]+$/); const customerId = new URL(page.url()).pathname.split('/').pop()!;
  await page.goto('/retail/udhar'); await page.getByLabel('Amount (₹)', { exact: false }).fill('100'); await pickOption(page.locator('#amount-sale-customer'), customerId); await page.getByLabel('Due Date', { exact: true }).fill(today()); await page.getByRole('button', { name: 'Save Udhar', exact: true }).click(); await expect(page).toHaveURL(/bills\/[^/]+$/); const billId = new URL(page.url()).pathname.split('/').pop()!;
  const updated = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().endsWith('/calendar/receivables/' + billId)); await page.getByLabel('Customer promised payment on', { exact: true }).fill(shifted(1)); expect((await updated).status()).toBe(200);
  await page.goto('/retail/calendar'); await page.getByRole('button', { name: shifted(1) + ' has events', exact: true }).click(); await page.getByRole('button', { name: 'Receivables', exact: true }).click(); await expect(page.getByRole('link').filter({ hasText: 'Manual promised customer' })).toBeVisible();
  await page.goto('/retail/receive-payment?customer=' + customerId); await page.getByLabel('Amount (₹)', { exact: false }).fill('100'); await page.locator('#receive-payment-save-btn').click(); await expect(page).toHaveURL(/khata\/[^/]+$/);
  expect((await read(page, 'retail/calendar?month=' + shifted(1).slice(0, 7))).receivables.some((r: any) => r.id === billId)).toBe(false);
  await page.goto('/retail/calendar'); await page.getByRole('button', { name: 'Add Task / Meeting', exact: true }).click(); await page.getByLabel('Task or meeting', { exact: true }).fill('Manual task persisted'); await page.getByRole('button', { name: 'Save Task', exact: true }).click(); await page.getByRole('button', { name: 'Tasks', exact: true }).click(); await page.getByRole('checkbox', { name: 'Manual task persisted', exact: true }).check(); await page.reload(); await page.getByRole('button', { name: 'Tasks', exact: true }).click(); await expect(page.getByRole('checkbox', { name: 'Manual task persisted', exact: true })).toBeChecked();
  await page.screenshot({ path: info.outputPath('manual-calendar-persisted.png'), fullPage: true });
});

test('Manual 49–53: the exact drawer example is 2220, Short 20 persists, and UPI/Udhar stay outside cash', async ({ page }, info) => {
  await freshShop(page);
  await page.goto('/retail/customers/add'); await page.locator('#customer-name').fill('Manual Galla customer'); await page.getByRole('button', { name: 'Save Customer', exact: true }).click(); await expect(page).toHaveURL(/khata\/[^/]+$/); const customerId = new URL(page.url()).pathname.split('/').pop()!;
  await amountSale(page, '100', 'UDHAR', customerId, shifted(-1));
  const refundable = await item(page, 'Refundable eighty', { stock: '1', price: '80' }); await item(page, 'Counter four twenty', { stock: '1', price: '420' });
  await addToBill(page, refundable.name); await page.locator('#item-search-input').fill('Counter four twenty'); await page.getByRole('button').filter({ hasText: 'Counter four twenty' }).first().click(); const cashBill = await completeCash(page); expect(Number(cashBill.grand_total)).toBe(500);
  await amountSale(page, '300', 'UPI'); await amountSale(page, '200', 'UDHAR', customerId);
  await page.goto('/retail/receive-payment?customer=' + customerId); await page.getByLabel('Amount (₹)', { exact: false }).fill('100'); await page.locator('#receive-payment-save-btn').click(); await expect(page).toHaveURL(/khata\/[^/]+$/);
  const s = await supplier(page); await page.goto('/retail/purchases/new'); await pickOption(page.locator('#purchase-mode'), 'QUICK'); await pickOption(page.locator('#purchase-supplier'), s.id); await page.getByLabel('Total Bill Amount', { exact: true }).fill('300'); await page.getByRole('button', { name: 'SAVE PURCHASE', exact: true }).click(); await expect(page).toHaveURL(/retail\/purchases$/);
  await page.goto('/retail/suppliers/' + s.id + '/pay'); await page.getByLabel('Amount (₹)', { exact: false }).fill('150'); await page.locator('#pay-supplier-save-btn').click(); await expect(page).toHaveURL(/suppliers\/[^/]+$/);
  await page.goto('/retail/expenses/add'); await page.getByRole('button', { name: 'Add expense category', exact: true }).click(); await page.getByPlaceholder('New Category Name').fill('Manual utilities'); await page.getByRole('button', { name: 'Save', exact: true }).click(); await pickOption(page.locator('#expense-category'), { label: 'Manual utilities' }); await page.locator('#expense-amount').fill('50'); await page.getByRole('button', { name: 'Save Expense', exact: true }).click(); await expect(page).toHaveURL(/retail\/expenses$/);
  await page.goto('/retail/expenses/add'); await page.getByRole('button', { name: 'Owner Took Money', exact: true }).click(); await page.locator('#expense-amount').fill('100'); await page.getByRole('button', { name: 'Save Expense', exact: true }).click(); await expect(page).toHaveURL(/retail\/expenses$/);
  await returnBill(page, cashBill.id, refundable.name);
  await page.goto('/retail/galla'); await page.getByLabel('Opening Cash · optional', { exact: true }).fill('2000'); await page.getByRole('button', { name: 'Save Cash Count', exact: true }).click(); await expect(page.getByTestId('galla-expected')).toHaveText('₹2,220.00');
  const g = await read(page, 'retail/galla?date=' + today()); expect(g.cash_sales).toBe(500); expect(g.upi_sales).toBe(300); expect(g.udhar_sales).toBe(200); expect(g.old_dues_cash).toBe(100); expect(g.supplier_cash).toBe(150); expect(g.cash_expenses).toBe(50); expect(g.cash_owner_withdrawals).toBe(100); expect(g.cash_refunds).toBe(80);
  await page.getByLabel('Actual Cash Count · optional', { exact: true }).fill('2200'); await page.getByRole('button', { name: 'Save Cash Count', exact: true }).click(); await expect(page.getByText('Difference: ₹-20.00 · SHORT', { exact: true })).toBeVisible(); await page.reload(); await expect(page.getByText('Difference: ₹-20.00 · SHORT', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('manual-exact-galla-2220.png'), fullPage: true });
});

test('Manual 04 / 05 / 55 / 72: real period/privacy changes, deep-link refresh and keyboard focus', async ({ page }, info) => {
  await freshShop(page); await amountSale(page, '321', 'CASH'); await page.goto('/retail/home'); await expect(page.locator('.r-home-sale')).toContainText('₹321');
  await page.getByRole('button', { name: 'Yesterday', exact: true }).click(); await expect(page.locator('.r-home-sale')).toContainText('₹0');
  for (const label of ['This Week', 'This Month', 'Today']) { await page.getByRole('button', { name: label, exact: true }).click(); await expect(page.locator('.r-home-sale')).toContainText('₹321'); }
  await page.getByRole('button', { name: 'Hide amounts', exact: true }).click(); await expect(page.locator('.r-home-sale')).not.toContainText('₹321'); await page.getByRole('button', { name: 'Show amounts', exact: true }).click(); await expect(page.locator('.r-home-sale')).toContainText('₹321');
  await page.goto('/retail/calendar'); await page.reload(); await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible();
  await page.goto('/retail/reports'); await page.getByRole('button').filter({ hasText: 'Sales Report' }).click(); await expect(page.locator('#retail-page-content')).toContainText('321');
  await page.goto('/password-login'); await page.evaluate(() => localStorage.removeItem('evolix-auth')); await page.reload(); await page.getByLabel('Username or email', { exact: true }).focus(); await page.keyboard.press('Tab'); await expect(page.getByLabel('Password', { exact: true })).toBeFocused(); await page.keyboard.press('Tab'); await expect(page.getByRole('checkbox', { name: 'Show password', exact: true })).toBeFocused();
  await page.screenshot({ path: info.outputPath('manual-keyboard-focus.png'), fullPage: true });
});

test('Manual 13 / 19 / 20 / 23 / 57 / 60: corrected bill, inline customer, photo-only retry, private preview and export', async ({ page }, info) => {
  await freshShop(page); const product=await item(page,'Manual photo goods',{stock:'3'});
  await addToBill(page,product.name); await page.getByRole('button',{name:'Edit line',exact:true}).click();
  await page.getByLabel('Quantity',{exact:true}).fill('2'); await page.getByLabel('Rate (₹ per selected unit)',{exact:true}).fill('80'); await page.getByLabel('Line Discount (₹)',{exact:true}).fill('10'); await page.getByRole('button',{name:'Save Line',exact:true}).click();
  await page.locator('#customer-selector').click(); await page.locator('#add-new-customer-btn').click(); await page.locator('#new-customer-name').fill('=Manual, "Photo" customer'); await page.locator('#save-select-customer-btn').click(); await expect(page.locator('#customer-sheet')).toHaveCount(0);
  await page.locator('summary').filter({hasText:'Bill details & photo'}).click();
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC','base64');
  await page.locator('input[type=file]').first().setInputFiles({name:'manual-sale-photo.png',mimeType:'image/png',buffer:png});
  let bills=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/retail/bills'))bills++;});
  await page.route('**/api/v1/attachments',route=>route.fulfill({status:503,contentType:'application/json',body:'{"message":"Disposable upload interruption"}'}));
  await page.locator('#pay-btn').click(); await page.locator('#pay-cash').click(); await page.locator('#cash-received-input').fill('200'); await expect(page.getByText('₹50',{exact:true})).toBeVisible();
  await page.locator('#complete-sale-cash').click(); await expect(page.getByRole('alert').filter({hasText:'Bill saved'})).toContainText('Bill saved'); await expect(page.getByRole('button',{name:'Retry Photo Upload',exact:true})).toBeVisible();
  await page.unroute('**/api/v1/attachments'); await page.getByRole('button',{name:'Retry Photo Upload',exact:true}).click(); await expect(page).toHaveURL(/sale-complete$/); expect(bills).toBe(1); await stock(page,product.name,1);
  await page.goto('/retail/more/documents'); await page.getByLabel('Search documents',{exact:true}).fill('manual-sale-photo'); await page.getByRole('button',{name:'View',exact:true}).click(); await expect(page.getByRole('dialog',{name:'Document preview'}).getByRole('img')).toBeVisible(); await page.screenshot({path:info.outputPath('manual-private-document.png'),fullPage:true}); await page.getByRole('button',{name:'Close',exact:true}).click();
  const download=page.waitForEvent('download'); await page.getByRole('button',{name:'Download',exact:true}).click(); expect((await download).suggestedFilename()).toBe('manual-sale-photo.png');
  await page.goto('/retail/more/backup'); const exported=page.waitForEvent('download'); await page.getByRole('button',{name:'Download Business Records',exact:true}).click(); expect((await exported).suggestedFilename()).toBe('EVOLIX-account-data.ndjson');
  const data=await page.request.get(apiOrigin+'/retail/account/export',{headers:await headers(page)});expect(data.status()).toBe(200);const content=await data.text();expect(content).toContain(product.name);expect(content).not.toMatch(/password_hash|access_token|session_id/);
  await page.goto('/retail/bill');await page.locator('#item-search-input').fill(product.name);await page.context().setOffline(true);await expect(page.getByRole('alert').last()).toBeVisible();await page.context().setOffline(false);await page.getByRole('button',{name:'Retry Search',exact:true}).click();await expect(page.getByRole('button').filter({hasText:product.name}).first()).toBeVisible();
});

test('Manual 43–48: real device speech requests, persistence, collection-only greeting and tenant separation',async({page},info)=>{
  await page.addInitScript(()=>{const original=window.speechSynthesis.speak.bind(window.speechSynthesis);(window as any).manualSpeech=[];window.speechSynthesis.speak=utterance=>{(window as any).manualSpeech.push({text:utterance.text,language:utterance.lang});original(utterance);};});
  const shop=await freshShop(page); await page.goto('/retail/more/voice');await page.getByLabel('Play after a confirmed customer payment',{exact:true}).check();await page.getByLabel('Greeting',{exact:true}).fill('Thank you for visiting {shop}.');await page.getByRole('button',{name:'Save Greeting',exact:true}).click();await expect(page.getByRole('status')).toContainText('saved');await page.reload();await expect(page.getByLabel('Greeting',{exact:true})).toHaveValue('Thank you for visiting {shop}.');
  await page.getByRole('button',{name:'Preview greeting',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).manualSpeech.length)).toBe(1);expect((await page.evaluate(()=>(window as any).manualSpeech[0])).text).toContain(shop.organization.name);
  await pickOption(page.getByLabel('Language',{exact:true}), 'hi-IN');await page.getByLabel('Greeting',{exact:true}).fill('हमारी दुकान पर आने के लिए धन्यवाद।');await page.getByRole('button',{name:'Preview greeting',exact:true}).click();expect((await page.evaluate(()=>(window as any).manualSpeech.at(-1))).language).toBe('hi-IN');
  await pickOption(page.getByLabel('Language',{exact:true}), 'en-IN');await page.getByLabel('Greeting',{exact:true}).fill('Thank you for visiting {shop}.');await page.getByRole('button',{name:'Save Greeting',exact:true}).click();await expect(page.getByRole('status')).toContainText('saved');
  await page.goto('/retail/customers/add');await page.locator('#customer-name').fill('Manual voice customer');await page.getByRole('button',{name:'Save Customer',exact:true}).click();await expect(page).toHaveURL(/khata\/[^/]+$/);const customer=new URL(page.url()).pathname.split('/').pop()!;
  await amountSale(page,'100','UDHAR',customer);expect(await page.evaluate(()=>(window as any).manualSpeech.length)).toBe(0);
  await page.goto('/retail/receive-payment?customer='+customer);await page.getByLabel('Amount (₹)', { exact: false }).fill('50');await page.locator('#receive-payment-save-btn').click();await expect(page).toHaveURL(/khata\/[^/]+$/);await expect.poll(()=>page.evaluate(()=>(window as any).manualSpeech.length)).toBe(1);
  await page.reload();expect(await page.evaluate(()=>(window as any).manualSpeech.length)).toBe(0);
  const outgoing=await supplier(page,'Manual voice outgoing');await page.goto('/retail/purchases/new');await pickOption(page.locator('#purchase-mode'), 'QUICK');await pickOption(page.locator('#purchase-supplier'), outgoing.id);await page.getByLabel('Total Bill Amount',{exact:true}).fill('50');await page.getByRole('button',{name:'SAVE PURCHASE',exact:true}).click();await expect(page).toHaveURL(/retail\/purchases$/);await page.goto('/retail/suppliers/'+outgoing.id+'/pay');await page.getByLabel('Amount (₹)', { exact: false }).fill('5');await page.locator('#pay-supplier-save-btn').click();await expect(page).toHaveURL(/suppliers\/[^/]+$/);expect(await page.evaluate(()=>(window as any).manualSpeech.length)).toBe(0);
  await page.goto('/retail/more/voice');await page.getByLabel('Play after a confirmed customer payment',{exact:true}).uncheck();await page.getByRole('button',{name:'Save Greeting',exact:true}).click();await expect(page.getByRole('status')).toContainText('saved');await amountSale(page,'20','CASH');expect(await page.evaluate(()=>(window as any).manualSpeech.length)).toBe(0);
  const a=await headers(page);await page.evaluate(()=>localStorage.removeItem('evolix-auth'));await freshShop(page);const settings=await read(page,'retail/checkout-voice');expect(settings.enabled).toBe(true);expect(settings.text).toBe('Thank you for visiting {shop}. Please visit again.');expect(settings.shop_name).not.toBe(shop.organization.name);const foreign=await page.request.get(apiOrigin+'/retail/checkout-voice',{headers:{...await headers(page),'X-Company-Id':a['X-Company-Id']}});expect([400,403]).toContain(foreign.status());
  await page.screenshot({path:info.outputPath('manual-other-shop-greeting.png'),fullPage:true});
});

test('Manual 59: create staff, assign Cashier, change temporary password, deny owner settings and revoke access',async({page,browser},info)=>{
  await freshShop(page);await page.goto('/roles');await page.getByRole('button',{name:'Create Custom Role',exact:true}).click();const modal=page.locator('.modal-content');await modal.locator('input[type=text]').nth(0).fill('Cashier');await modal.locator('input[type=text]').nth(1).fill('Visible acceptance cashier');await modal.getByRole('button',{name:'Create',exact:true}).click();await expect(modal).toHaveCount(0);
  await page.goto('/users');await page.getByRole('button',{name:'Create User',exact:true}).click();const username='manual-staff-'+Date.now(),temporary='ManualTemporary!921',password='ManualStaffChanged!921';
  await modal.locator('input[type=text]').nth(0).fill(username);await modal.locator('input[type=text]').nth(1).fill('Visible Manual Cashier');await modal.locator('input[type=password]').fill(temporary);await modal.getByRole('button',{name:'Create',exact:true}).click();await expect(modal).toHaveCount(0);const row=page.getByRole('row').filter({hasText:username});await row.getByTitle('Manage Roles').click();await modal.getByRole('button',{name:'Cashier',exact:true}).click();await expect(modal.locator('.badge').filter({hasText:'Cashier'})).toContainText('Cashier');await modal.locator('.modal-header button').click();
  const second=await browser.newContext({viewport:{width:390,height:844},baseURL:process.env.TEST_BASE_URL||'http://localhost:5173'}),staff=await second.newPage();staff.setDefaultTimeout(15000);
  try{await staff.goto('/password-login');await staff.getByLabel('Username or email',{exact:true}).fill(username);await staff.getByLabel('Password',{exact:true}).fill(temporary);await staff.getByRole('button',{name:'Sign In',exact:true}).click();await expect(staff).toHaveURL(/change-password$/);await staff.getByLabel('Temporary password',{exact:true}).fill(temporary);await staff.getByLabel('New password',{exact:true}).fill(password);await staff.getByLabel('Confirm new password',{exact:true}).fill(password);await staff.getByRole('button',{name:'Save new password',exact:true}).click();await expect(staff).toHaveURL(/login$/);await login(staff,username,password);
    const denied=await staff.request.post(apiOrigin+'/retail/checkout-voice',{headers:await headers(staff),data:{enabled:true,text:'Unauthorized',language:'en-IN',rate:.9}});expect(denied.status()).toBe(403);
    await page.goto('/users');await page.getByRole('row').filter({hasText:username}).getByTitle('Force Logout').click();const expired=await staff.request.get(apiOrigin+'/retail/account',{headers:await headers(staff)});expect(expired.status()).toBe(401);await staff.reload();await expect(staff).toHaveURL(/login$/);await page.screenshot({path:info.outputPath('manual-staff-access-revoked.png'),fullPage:true});
  }finally{await second.close();}
});

test('Manual 35 / 36 / 37 / 40 / 42: all purchase payment states, four supplier methods and published holiday coverage',async({page},info)=>{
  await freshShop(page);const s=await supplier(page);const suffix=Date.now();
  for(const state of ['Credit','Partial','Paid']){
    await page.goto('/retail/purchases/new');await pickOption(page.locator('#purchase-mode'), 'QUICK');await pickOption(page.locator('#purchase-supplier'), s.id);await page.getByLabel('Total Bill Amount',{exact:true}).fill('200');await page.locator('summary').filter({hasText:'Bill details'}).click();await page.getByLabel('Supplier Bill Number',{exact:true}).fill('MANUAL-'+state+'-'+suffix);await page.getByLabel('Due Date',{exact:true}).fill(today());await page.getByRole('button',{name:state,exact:true}).click();if(state==='Partial')await page.getByLabel('Amount Paid Now',{exact:true}).fill('50');if(state!=='Credit')await pickOption(page.getByLabel('Payment Method',{exact:true}), 'CASH');await page.getByRole('button',{name:'SAVE PURCHASE',exact:true}).click();await expect(page).toHaveURL(/retail\/purchases$/);
  }
  const purchases=await read(page,'retail/purchases?limit=20');const rows=Array.isArray(purchases)?purchases:purchases.data;expect(rows.map((p:any)=>Number(p.outstanding_amount)).sort((a:number,b:number)=>a-b)).toEqual([0,150,200]);
  await page.goto('/retail/purchases/new');await pickOption(page.locator('#purchase-mode'), 'QUICK');await pickOption(page.locator('#purchase-supplier'), s.id);await page.getByLabel('Total Bill Amount',{exact:true}).fill('200');await page.locator('summary').filter({hasText:'Bill details'}).click();await page.getByLabel('Supplier Bill Number',{exact:true}).fill('MANUAL-Credit-'+suffix);await page.getByRole('button',{name:'SAVE PURCHASE',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'already recorded'}).last()).toBeVisible();expect((await read(page,'retail/purchases?limit=20')).length).toBe(3);
  await page.goto('/retail/calendar');await page.getByRole('button',{name:'Payables',exact:true}).click();await expect(page.getByRole('link').filter({hasText:s.name})).toHaveCount(2);
  for(const method of ['CASH','UPI','CARD','BANK']){
    await page.goto('/retail/suppliers/'+s.id+'/pay');await page.getByLabel('Amount (₹)', { exact: false }).fill('10');await pickOption(page.getByLabel('Payment Method',{exact:true}), method);await expect(page.getByRole('img',{name:/UPI QR/})).toHaveCount(0);await page.locator('#pay-supplier-save-btn').click();await expect(page).toHaveURL(/suppliers\/[^/]+$/);
  }
  await page.goto('/retail/calendar');await page.getByRole('button',{name:'2026-10-20 has events',exact:true}).click();await expect(page.getByText('Dussehra',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Next month',exact:true}).click();await page.getByRole('button',{name:'2026-11-08 has events',exact:true}).click();await expect(page.getByText(/Diwali/)).toBeVisible();await page.getByRole('button',{name:'Next month',exact:true}).click();await page.getByRole('button',{name:'Next month',exact:true}).click();await expect(page.locator('#retail-page-content')).toContainText(/not been published|not yet published|not available|unavailable|not configured/i);await page.screenshot({path:info.outputPath('manual-holiday-coverage.png'),fullPage:true});
});

test('Manual 47: unsupported device voice cannot prevent or undo a real bill',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{configurable:true,value:undefined}));await freshShop(page);await page.goto('/retail/more/voice');await page.getByLabel('Play after a confirmed customer payment',{exact:true}).check();await page.getByRole('button',{name:'Save Greeting',exact:true}).click();await expect(page.getByRole('status')).toContainText('saved');await page.getByRole('button',{name:'Preview greeting',exact:true}).click();await expect(page.getByRole('status')).toContainText('unavailable');const product=await item(page,'Manual no-audio goods',{stock:'2'});await addToBill(page,product.name);const bill=await completeCash(page);await page.getByRole('button',{name:'Play thank-you greeting',exact:true}).click();await expect(page.getByRole('status')).toContainText('Voice is unavailable');expect(Number((await read(page,'retail/bills/'+bill.id)).paid_amount)).toBe(100);await stock(page,product.name,1);
});

test('Manual 12: real low/out filters exclude uncounted goods and services',async({page})=>{
  await freshShop(page,['SERVICES']);await item(page,'Manual low counted',{stock:'1',low:'2'});await item(page,'Manual zero counted',{stock:'0'});await item(page,'Manual service excluded',{service:true});await page.goto('/retail/bill');await page.locator('#item-search-input').fill('Manual uncounted excluded');await page.getByRole('button',{name:'+ Add Item & Bill',exact:true}).click();await page.getByLabel('Selling price (₹)',{exact:true}).fill('100');await page.getByRole('button',{name:'Save & Add to Bill',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.goto('/retail/stock');await page.getByRole('group',{name:'Stock status'}).getByRole('button',{name:'Low Stock',exact:true}).click();await expect(page.locator('.r-list-item')).toHaveCount(2);await expect(page.getByText('Manual low counted',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Filter inventory',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Out of Stock',exact:true}).click();await page.getByRole('button',{name:'Apply Filters',exact:true}).click();await expect(page.locator('.r-list-item')).toHaveCount(1);await expect(page.locator('.r-list-item')).toContainText('Manual zero counted');await page.getByRole('group',{name:'Stock status'}).getByRole('button',{name:'All Items',exact:true}).click();await expect(page.locator('.r-list-item')).toHaveCount(4);
});
