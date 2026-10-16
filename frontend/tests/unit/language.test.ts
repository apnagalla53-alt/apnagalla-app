import { beforeEach, expect, test, vi } from 'vitest';
const values=new Map<string,string>();
beforeEach(()=>{vi.resetModules();values.clear();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v)});vi.stubGlobal('document',{documentElement:{lang:'',dir:''}});});
test('English keeps original copy and does not require Hindi resources',async()=>{
 const mod=await import('../../src/i18n');await mod.uiLanguageReady;expect(mod.ui('Quick Bill')).toBe('Quick Bill');expect(mod.default.hasResourceBundle('hi','translation')).toBe(false);expect(document.documentElement.lang).toBe('en');
});
test('saved Hindi downloads before the app renders, persists and switches back to English',async()=>{
 values.set('evolix-language','hi');const mod=await import('../../src/i18n');await mod.uiLanguageReady;expect(document.documentElement.lang).toBe('hi');expect(mod.ui('Home')).not.toBe('Home');expect(values.get('evolix-language')).toBe('hi');await mod.setUiLanguage('en');expect(mod.ui('Home')).toBe('Home');expect(document.documentElement.lang).toBe('en');
});
test('quick Hindi then English selection respects the latest selection',async()=>{
 const mod=await import('../../src/i18n');await mod.uiLanguageReady;await Promise.all([mod.setUiLanguage('hi'),mod.setUiLanguage('en')]);expect(mod.default.language).toBe('en');
});
