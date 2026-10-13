import { afterEach, describe, expect, it, vi } from 'vitest';
import { allowedBrowserOrigin, retailerCookieDomain } from './browser-session';
import { validateEnvironment } from '../common/environment';
afterEach(()=>vi.unstubAllEnvs());
describe('Website/app session boundaries',()=>{
  it('trusts exactly the website and app in production, without wildcard sibling origins',()=>{
    vi.stubEnv('NODE_ENV','production');vi.stubEnv('FRONTEND_ORIGIN','https://app.apnagalla.in');vi.stubEnv('WEBSITE_ORIGIN','https://apnagalla.in');
    expect(allowedBrowserOrigin('https://apnagalla.in')).toBe(true);expect(allowedBrowserOrigin('https://app.apnagalla.in')).toBe(true);
    for(const origin of ['https://evil.apnagalla.in','https://apnagalla.in.evil.test','http://apnagalla.in','http://192.168.31.178:5173'])expect(allowedBrowserOrigin(origin)).toBe(false);
  });
  it('shares retailer cookies only; Platform cookies stay host-only',()=>{
    vi.stubEnv('RETAIL_COOKIE_DOMAIN','.apnagalla.in');expect(retailerCookieDomain()).toBe('.apnagalla.in');expect(retailerCookieDomain(true)).toBeUndefined();
  });
  it('rejects a cookie parent that does not own both configured origins',()=>{
    expect(()=>validateEnvironment({DATABASE_URL:'postgresql://localhost/app_test',FRONTEND_ORIGIN:'http://app.apnagalla.test',WEBSITE_ORIGIN:'http://other.test',RETAIL_COOKIE_DOMAIN:'.apnagalla.test'})).toThrow('WEBSITE_ORIGIN must belong');
  });
  it('rejects malformed and path-bearing trusted website origins',()=>{
    expect(()=>validateEnvironment({DATABASE_URL:'postgresql://localhost/app_test',WEBSITE_ORIGIN:'https://apnagalla.in/path'})).toThrow('exact origin');
  });
});
