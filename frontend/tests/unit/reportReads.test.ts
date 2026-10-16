import { beforeAll, beforeEach, afterEach, expect, test, vi } from 'vitest';
const mock=vi.hoisted(()=>({get:vi.fn(),state:{authEpoch:'a',user:{id:'owner'},tenantContext:{company_id:'shop',branch_id:'branch',financial_year_id:'fy'}},listeners:[] as Function[]}));
vi.mock('../../src/shared/api',()=>({default:{get:mock.get}}));
vi.mock('../../src/shared/store/authStore',()=>({useAuthStore:{getState:()=>mock.state,subscribe:(fn:Function)=>mock.listeners.push(fn)}}));
let read:typeof import('../../src/retail/reports/reportReads').readReport,clear:()=>void;
const events=new EventTarget();
beforeAll(async()=>{vi.stubGlobal('window',events);const mod=await import('../../src/retail/reports/reportReads');read=mod.readReport;clear=mod.clearReportReads;});
beforeEach(()=>{clear();mock.get.mockReset();mock.state={authEpoch:'a',user:{id:'owner'},tenantContext:{company_id:'shop',branch_id:'branch',financial_year_id:'fy'}};});
afterEach(()=>vi.useRealTimers());
test('80 concurrent Home reads share one request and callers cannot mutate cached data',async()=>{
 mock.get.mockResolvedValue({data:{sales:12}});const rows=await Promise.all(Array.from({length:80},()=>read('/retail/account/experience')));rows[0].data.sales=999;
 expect(rows[1].data.sales).toBe(12);expect((await read('/retail/account/experience')).data.sales).toBe(12);expect(mock.get).toHaveBeenCalledTimes(1);
});
test('different dismissed suggestions and calendar months have separate responses',async()=>{
 mock.get.mockResolvedValue({data:{}});await read('/retail/account/experience',{dismissed:'one'});await read('/retail/account/experience',{dismissed:'two'});
 await read('/retail/calendar',{month:'2026-10'});await read('/retail/calendar',{month:'2026-11'});expect(mock.get).toHaveBeenCalledTimes(4);
});
test('expiry forces a fresh read after ten seconds',async()=>{
 vi.useFakeTimers();mock.get.mockResolvedValue({data:{}});await read('/retail/account/migration');await vi.advanceTimersByTimeAsync(10001);await read('/retail/account/migration');expect(mock.get).toHaveBeenCalledTimes(2);
});
test.each(['company_id','branch_id','financial_year_id'] as const)('changing %s never reuses another scope',async key=>{
 mock.get.mockResolvedValue({data:{}});await read('/retail/calendar');mock.state={...mock.state,tenantContext:{...mock.state.tenantContext,[key]:'other'}};await read('/retail/calendar');expect(mock.get).toHaveBeenCalledTimes(2);
});
test('a successful mutation event invalidates Home and report responses',async()=>{
 mock.get.mockResolvedValue({data:{}});await read('/retail/account/experience');await read('/retail/reports/dashboard');events.dispatchEvent(new Event('evolix-data-changed'));await read('/retail/account/experience');await read('/retail/reports/dashboard');expect(mock.get).toHaveBeenCalledTimes(4);
});
test('session change clears reused data',async()=>{
 mock.get.mockResolvedValue({data:{}});await read('/retail/calendar');const previous=mock.state;mock.state={...mock.state,authEpoch:'new'};mock.listeners.forEach(fn=>fn(mock.state,previous));await read('/retail/calendar');expect(mock.get).toHaveBeenCalledTimes(2);
});
test('a late response from the previous shop cannot be displayed',async()=>{
 let finish!:Function;mock.get.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const request=read('/retail/calendar');mock.state={...mock.state,tenantContext:{...mock.state.tenantContext,company_id:'other'}};finish({data:{secret:'old shop'}});await expect(request).rejects.toThrow('shop changed');
});
test('a late response started before a mutation cannot display stale figures',async()=>{
 let finish!:Function;mock.get.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const request=read('/retail/account/experience');events.dispatchEvent(new Event('evolix-data-changed'));finish({data:{}});await expect(request).rejects.toThrow('data changed');
});
test('failed reads are retryable and are never cached',async()=>{
 mock.get.mockRejectedValueOnce(Error('offline')).mockResolvedValue({data:{ok:true}});await expect(read('/retail/calendar')).rejects.toThrow('offline');expect((await read('/retail/calendar')).data.ok).toBe(true);expect(mock.get).toHaveBeenCalledTimes(2);
});
test.each(['/auth/session','/retail/items','/retail/bills','/retail/account/subscription'])('sensitive/live endpoint %s cannot enter the read cache',async path=>{
 await expect(read(path)).rejects.toThrow('approved read-only');expect(mock.get).not.toHaveBeenCalled();
});
