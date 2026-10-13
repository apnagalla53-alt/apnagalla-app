import { test as base, expect } from '@playwright/test';
export { expect };
export type { Page } from '@playwright/test';

// Real sessions consume real plan device allowances. Every browser test revokes
// its own sessions, including sessions created before a fresh tenant switch.
export const test = base.extend<{ sessionCleanup: void; migrationPrompt: boolean }>({
  migrationPrompt: [true,{option:true}],
  sessionCleanup: [async ({ page,migrationPrompt }, use) => {
    if(migrationPrompt)await page.addLocatorHandler(page.getByRole('button',{name:'Start fresh',exact:true}),async()=>{await page.getByRole('button',{name:'Start fresh',exact:true}).click();});
    const sessions: { url: string; token?: string; cookie?:string; csrf?:string; context: any }[] = [];
    const pending: Promise<void>[] = [];
    page.on('response', response => {
      if (!/\/auth\/(?:login|browser-session|mfa\/verify)$/.test(response.url()) || !response.ok()) return;
      pending.push(response.json().then(async body => {
        if (body.access_token) sessions.push({ url: response.url().replace(/login$/, 'logout'), token: body.access_token, context: body.tenant_context });
        if(body.session_mode==='cookie'){
          const headers=await response.headersArray();
          const cookie=headers.find(h=>h.name.toLowerCase()==='set-cookie'&&/^evolix_(shop|platform)_session=/.test(h.value))?.value.split(';')[0];
          if(cookie)sessions.push({url:response.url().replace(/(?:login|browser-session|mfa\/verify)$/,'logout'),cookie,csrf:body.csrf_token,context:body.tenant_context});
        }
      }));
    });
    await use();
    await Promise.all(pending);
    // Stop the app before revoking its session. Otherwise background reads can
    // trigger a logout redirect while Chrome is closing its recorded context.
    if (!page.isClosed()) await page.goto('about:blank');
    for (const session of sessions) {
      const headers: Record<string, string> = session.token?{Authorization:'Bearer '+session.token}:{Cookie:session.cookie!,'X-CSRF-Token':session.csrf!};
      if (session.context) {
        headers['X-Company-Id'] = session.context.company_id;
        headers['X-Branch-Id'] = session.context.branch_id;
        headers['X-Financial-Year-Id'] = session.context.financial_year_id;
      }
      const response = await page.request.post(session.url, { headers });
      expect([200, 201, 401]).toContain(response.status());
    }
  }, { auto: true }],
});
