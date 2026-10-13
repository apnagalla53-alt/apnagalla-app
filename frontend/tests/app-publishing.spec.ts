import {test,expect} from './fixtures';

async function login(page:any,platform=false){await page.goto(platform?'/platform/login':'/password-login');await page.getByLabel('Username or email',{exact:true}).fill(platform?process.env.PLATFORM_USERNAME!:process.env.RETAIL_USERNAME!);await page.getByLabel('Password',{exact:true}).fill(platform?process.env.PLATFORM_PASSWORD!:process.env.RETAIL_PASSWORD!);await page.getByRole('button',{name:'Sign In',exact:true}).click();await expect(page).toHaveURL(platform?/\/platform\/dashboard$/:/\/retail\/home$/);}

test('public policies/support/deletion remain reachable without app installation',async({page})=>{
  for(const [path,title] of [['privacy','Privacy policy'],['terms','Terms of service'],['support','Help & support'],['delete-account','Delete your account'],['about','About EVOLIX']]){
    await page.goto('/'+path);await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();await expect(page.getByText('Developed by EVOLIX Studio',{exact:false})).toBeVisible();
    await page.reload();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});

test('the default Retail theme uses bright surfaces and restrained sage accents',async({page},info)=>{
  await login(page);await expect(page.locator('.retail-app')).toHaveAttribute('data-theme','light');
  await expect(page.locator('.r-home-sale')).toBeVisible();
  const palette=await page.locator('.r-home-sale').evaluate(card=>({surface:getComputedStyle(card).backgroundColor,text:getComputedStyle(card).color}));
  const surface=palette.surface.match(/\d+/g)!.slice(0,3).map(Number),text=palette.text.match(/\d+/g)!.slice(0,3).map(Number);
  expect(Math.min(...surface)).toBeGreaterThan(200);expect(Math.max(...text)).toBeLessThan(160);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:info.outputPath('home-light-premium.png'),fullPage:true});
});
test('owner can submit an account deletion request from the public web page',async({page})=>{
  await login(page);await page.goto('/delete-account');await page.getByRole('button',{name:'Request account deletion',exact:true}).click();await expect(page.getByText(/Request received: .*Status: Pending review/)).toBeVisible();
  await page.goto('/retail/home');await expect(page.locator('#qa-new-bill')).toBeVisible();
});
test('Super Admin can edit app publishing placeholders and inspect privacy requests',async({page})=>{
  await login(page,true);await page.goto('/platform/settings');await page.getByRole('link',{name:'Configure app publishing'}).click();await expect(page.getByRole('heading',{name:'App publishing',exact:true})).toBeVisible();
  await expect(page.getByLabel('Developer name',{exact:true})).toHaveValue('EVOLIX Studio');await expect(page.getByLabel('Developer website',{exact:true})).toHaveValue('https://evolix-studio.in');
  await page.getByLabel('Change reason',{exact:true}).fill('Review publishing placeholders');await page.getByRole('button',{name:'Save publishing details',exact:true}).click();await expect(page.getByText('Publishing details saved.',{exact:true})).toBeVisible();
});
test('comfortable and larger text, dark mode and real settings remain usable at 360px',async({page},info)=>{
  await page.setViewportSize({width:360,height:800});await login(page);await page.goto('/retail/more/settings');await page.getByRole('button',{name:'Larger text',exact:true}).click();await page.getByRole('button',{name:'Dark',exact:true}).click();
  await expect(page.getByRole('button',{name:'Dark',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.goto('/retail/home');
  const colours=await page.locator('.r-retail-toolbar h1').evaluate(heading=>({text:getComputedStyle(heading).color,expected:getComputedStyle(heading.closest('.retail-app')!).getPropertyValue('--r-text').trim()}));
  expect(colours.text).toBe('rgb(234, 243, 238)');
  await page.screenshot({path:info.outputPath('home-large-dark.png'),fullPage:true});
  for(const route of ['more/settings','more/profile','more/business','more/devices','more/subscription','more/features','more/locations','more/help','more/security']){
    await page.goto('/retail/'+route);await expect(page.getByText('Coming Soon',{exact:true})).toHaveCount(0);await expect(page.locator('#retail-page-content')).not.toBeEmpty();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});
