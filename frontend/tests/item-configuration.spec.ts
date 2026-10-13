import { pickOption } from './mobile-controls';
import { test, expect, type Page } from './fixtures';
const apiOrigin = process.env.TEST_API_ORIGIN || 'http://localhost:8010/api/v1';
test.setTimeout(120_000);

async function login(page: Page, username: string, password: string, platform = false) {
  await page.goto(platform ? '/platform/login' : '/password-login');
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(platform ? /platform\/dashboard$/ : /retail\/home$/);
}

test('owner configures a bundle, extras, variants and pack units and bills a kit through the UI', async ({ page }, info) => {
  await login(page, process.env.PLATFORM_USERNAME!, process.env.PLATFORM_PASSWORD!, true);
  const platformToken = await page.evaluate(() => JSON.parse(localStorage.getItem('evolix-auth')!).state.session_id);
  const platformHeaders = { Authorization: 'Bearer ' + platformToken };
  const suffix = Date.now(), owner = `configuration-${suffix}@test.invalid`, password = `DisposableConfig!${suffix}`;
  const provision = await page.request.post(apiOrigin + '/platform/admin/tenants', { headers: platformHeaders, data: { planId: process.env.TEST_NEW_TENANT_PLAN_ID, organizationName: 'Configuration QA ' + suffix, adminName: 'Configuration Owner', adminEmail: owner, adminPassword: password } });
  expect(provision.status()).toBe(201); const shop = await provision.json();
  for (const feature_code of ['BUNDLES', 'MODIFIERS', 'VARIANTS', 'MULTI_UNIT']) {
    const response = await page.request.post(`${apiOrigin}/platform/admin/tenants/${shop.organization.id}/actions`, { headers: platformHeaders, data: { action: 'feature', feature_code, enabled: true, reason: 'Disposable browser configuration acceptance' } });
    expect(response.status()).toBe(201);
  }
  await page.evaluate(() => localStorage.removeItem('evolix-auth'));
  await login(page, owner, password); await page.setViewportSize({ width: 390, height: 844 });
  const createItem = async (name: string, stock: string, kind?: string, variants = false) => {
    await page.goto('/retail/items/add'); await page.locator('#item-name-input').fill(name); await page.locator('#selling-price-input').fill('100');
    if (stock) await page.locator('#opening-stock-input').fill(stock);
    if (kind || variants) { await page.locator('#more-details-toggle').click(); if (kind) await pickOption(page.getByLabel('Item type', { exact: true }), kind); if (variants) await page.getByLabel('Variants (size, colour or other choices)', { exact: true }).check(); }
    await page.locator('#save-item-btn').click(); await expect(page).toHaveURL(/retail\/items$/);
    await page.locator('#item-search').fill(name); await page.locator('.r-list-item').filter({ hasText: name }).click(); await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  };
  await createItem('Kit component', '5');
  await createItem('Owner kit', '', 'BUNDLE');
  await page.getByLabel('Find a component', { exact: true }).fill('Kit component');
  await pickOption(page.getByLabel('Add component', { exact: true }), { label: 'Kit component · PCS' });
  await page.getByRole('button', { name: 'Save Bundle Contents', exact: true }).click(); await expect(page.getByText('Bundle contents saved.', { exact: true })).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Choices & extras' }).click();
  await page.getByRole('button', { name: 'Add Option Group', exact: true }).click();
  await page.getByLabel('Group name', { exact: true }).fill('Packing'); await page.getByLabel('Option name', { exact: true }).fill('Gift wrap'); await page.getByLabel('Price adjustment per unit (₹)', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Save Options', exact: true }).click(); await expect(page.getByText('Options saved.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Make Bill', exact: true }).click(); await page.locator('#item-search-input').fill('Owner kit'); await page.getByRole('button').filter({ hasText: 'Owner kit' }).first().click();
  await expect(page.getByRole('heading', { name: 'Included in this kit', exact: true })).toBeVisible(); await page.getByLabel(/Gift wrap/).check(); await page.getByRole('button', { name: 'Save Line', exact: true }).click();
  await expect(page.locator('#pay-btn')).toHaveText('PAY ₹110'); await page.locator('#pay-btn').click(); await page.locator('#pay-cash').click(); await page.locator('#complete-sale-cash').click(); await expect(page).toHaveURL(/sale-complete$/);
  await createItem('Variant shirt', '', undefined, true); await page.locator('summary').filter({ hasText: 'Variants' }).click();
  await page.getByLabel('Size / option', { exact: true }).fill('Large'); await page.getByLabel('Colour (optional)', { exact: true }).fill('Blue'); await page.getByRole('button', { name: 'Add Variant', exact: true }).click(); await expect(page.getByText(/^(Large · Blue|Blue · Large)$/)).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Units & packs' }).click(); await page.getByLabel(/1 BOX contains/).fill('10'); await page.getByRole('button', { name: 'Add Unit', exact: true }).click(); await expect(page.getByText('1 BOX = 10 PCS', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('item-configuration.png'), fullPage: true });
});
