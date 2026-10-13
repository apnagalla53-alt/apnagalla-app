import { test, expect } from './fixtures';

test.describe('Identity flows', () => {
  test('login success', async ({ page }) => {
    await page.goto('/password-login');
    await page.getByLabel('Username or email',{exact:true}).fill(process.env.RETAIL_USERNAME!);
    await page.getByLabel('Password',{exact:true}).fill(process.env.RETAIL_PASSWORD!);
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*retail\/home/, { timeout: 15000 });
    await expect(page.locator('#qa-new-bill')).toBeVisible();
  });

  test('invalid login', async ({ page }) => {
    await page.goto('/password-login');
    await page.getByLabel('Username or email',{exact:true}).fill(process.env.RETAIL_USERNAME!);
    await page.getByLabel('Password',{exact:true}).fill('WrongDisposablePassword!');
    await page.click('button[type="submit"]');
    
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15000 });
  });

  test('protected route redirect', async ({ page }) => {
    // Clear context to be unauthenticated
    await page.context().clearCookies();
    
    await page.goto('/users');
    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });

  test('logout', async ({ page }) => {
    await page.goto('/password-login');
    await page.getByLabel('Username or email',{exact:true}).fill(process.env.RETAIL_USERNAME!);
    await page.getByLabel('Password',{exact:true}).fill(process.env.RETAIL_PASSWORD!);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*retail\/home/);
    
    await page.goto('/retail/more');await page.locator('#logout-btn').click();
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
    await expect(page.getByRole('link',{name:'Use existing shop password',exact:true})).toBeVisible();
    // Try to access dashboard again
    await page.goto('/retail/home');
    await expect(page).toHaveURL(/.*login/);
  });
  
  test('renders Users screen', async ({ page }) => {
    await page.goto('/password-login');
    await page.getByLabel('Username or email',{exact:true}).fill(process.env.RETAIL_USERNAME!);
    await page.getByLabel('Password',{exact:true}).fill(process.env.RETAIL_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*retail\/home/);
    
    await page.goto('/users');
    await expect(page.locator('h1')).toHaveText('User Management');
  });
  
  test('user search', async ({ page }) => {
    await page.goto('/password-login');
    await page.getByLabel('Username or email',{exact:true}).fill(process.env.RETAIL_USERNAME!);
    await page.getByLabel('Password',{exact:true}).fill(process.env.RETAIL_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*retail\/home/);
    
    await page.goto('/users');
    
    const username=process.env.RETAIL_USERNAME!;
    await page.fill('input[placeholder="Search users..."]', username);
    await page.waitForTimeout(1000);
    
    await expect(page.locator('table tbody tr').first()).toContainText(username);
  });

  test('Create User UI', async ({ page }) => {
    await page.goto('/password-login');
    await page.getByLabel('Username or email',{exact:true}).fill(process.env.RETAIL_USERNAME!);
    await page.getByLabel('Password',{exact:true}).fill(process.env.RETAIL_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*retail\/home/);
    
    await page.goto('/users');
    await page.click('button:has-text("Create User")');
    await expect(page.locator('.modal-content')).toBeVisible();
    await page.locator('.modal-content input[type="text"]').first().fill('new_user_test');
    await page.locator('.modal-content input[type="password"]').fill('DisposablePassword123!');
    // The second text input is display name
    await page.locator('.modal-content input[type="text"]').nth(1).fill('New User Test');
    
    // We won't submit it to prevent DB clutter, just verify UI works
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('.modal-content')).not.toBeVisible();
  });

  test('Create Role UI', async ({ page }) => {
    await page.goto('/password-login');
    await page.getByLabel('Username or email',{exact:true}).fill(process.env.RETAIL_USERNAME!);
    await page.getByLabel('Password',{exact:true}).fill(process.env.RETAIL_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*retail\/home/);
    
    await page.goto('/roles');
    await page.click('button:has-text("Create Custom Role")');
    await expect(page.locator('.modal-content')).toBeVisible();
    await page.click('button:has-text("Cancel")');
  });

  test('Session revoke through UI', async ({ page }) => {
    await page.goto('/password-login');
    await page.getByLabel('Username or email',{exact:true}).fill(process.env.RETAIL_USERNAME!);
    await page.getByLabel('Password',{exact:true}).fill(process.env.RETAIL_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*retail\/home/);
    
    await page.goto('/sessions');
    await expect(page.locator('table tbody')).toBeVisible();
    await expect(page.locator('table tbody')).toContainText('Current');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', {name:'Sign out this device',exact:true}).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
