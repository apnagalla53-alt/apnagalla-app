import { pickOption } from './mobile-controls';
import { test, expect } from './fixtures';

test.describe('Tenant administration lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/password-login');
    await page.getByLabel('Username or email', { exact: true }).fill(process.env.RETAIL_USERNAME || 'admin');
    await page.getByLabel('Password', { exact: true }).fill(process.env.RETAIL_PASSWORD || 'Evolix@2026');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/retail\/home$/, { timeout: 15000 });
  });

  test('Organization Lifecycle respects the current tenant and initializes owned business structures', async ({ page }) => {
    // Tenant creation/suspension belongs to Platform. The old test wrongly created a new tenant as a Retail owner.
    await page.goto('/organizations');
    await expect(page.locator('h1')).toHaveText('Organization Management');
    await expect(page.getByRole('button', { name: 'Edit organization' })).toBeVisible();
    await expect(page.locator('table tbody tr')).toHaveCount(1);
    const ownCode = await page.locator('table tbody tr td').first().innerText();
    await page.getByPlaceholder('Search organizations...').fill(ownCode);
    await expect(page.locator('table tbody tr')).toContainText(ownCode);
    await expect(page.getByRole('button', { name: 'Create Organization' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Edit organization' }).click();
    await expect(page.getByLabel('Organization name')).not.toHaveValue('');
    await page.getByRole('button', { name: 'Save details' }).click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();

    await page.goto('/companies');
    await expect(page.locator('h1')).toHaveText('Company Management');
    await expect(page.locator('table tbody')).not.toContainText('No companies found');
    await page.goto('/branches');
    await expect(page.locator('h1')).toHaveText('Branch Management');
    await expect(page.locator('table tbody')).not.toContainText('No branches found');
    await page.goto('/godowns');
    await expect(page.locator('h1')).toHaveText('Godown Management');
    await expect(page.locator('table tbody')).not.toContainText('No godowns found');

    await page.goto('/financial-years');
    await expect(page.locator('h1')).toHaveText('Financial Year Management');
    const year = 2200 + Math.floor(Math.random() * 1000);
    const label = `QA ${year}-${year + 1}`;
    await page.getByRole('button', { name: 'Create Financial Year' }).click();
    await pickOption(page.locator('.modal-content select'), { index: 1 });
    await page.locator('label:text-is("Label") ~ input').fill(label);
    await page.locator('label:text-is("Start Date") ~ input').fill(`${year}-04-01`);
    await page.locator('label:text-is("End Date") ~ input').fill(`${year + 1}-03-31`);
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Create Financial Year' }).click();
    await pickOption(page.locator('.modal-content select'), { index: 1 });
    await page.locator('label:text-is("Label") ~ input').fill(`Overlap ${year}`);
    await page.locator('label:text-is("Start Date") ~ input').fill(`${year}-10-01`);
    await page.locator('label:text-is("End Date") ~ input').fill(`${year + 1}-09-30`);
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText(/overlaps with existing/).first()).toBeVisible();
  });
});
