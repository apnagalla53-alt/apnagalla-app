import { beforeEach,expect,it,vi } from 'vitest';
const auth=vi.hoisted(()=>({state:{user:{id:'owner'},tenantContext:{organization_id:'org',company_id:'shop-a',branch_id:'branch',financial_year_id:'fy'}},listeners:[] as Function[]}));
vi.mock('../../src/shared/store/authStore',()=>({useAuthStore:{getState:()=>auth.state,subscribe:(callback:Function)=>{auth.listeners.push(callback);return()=>{};}}}));
const values=new Map<string,string>();
beforeEach(()=>{vi.resetModules();auth.listeners=[];auth.state={user:{id:'owner'},tenantContext:{organization_id:'org',company_id:'shop-a',branch_id:'branch',financial_year_id:'fy'}};values.clear();vi.stubGlobal('sessionStorage',{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});});
it('recovers ten item lines, customer and transaction details after a reload',async()=>{
 const {useBillStore}=await import('../../src/retail/retailStore');for(let i=1;i<=10;i++)useBillStore.getState().putLine({item_id:'item-'+i,name:'Product '+i,quantity:i,rate:20,unit:'PCS',discount_amount:0,total:0});
 useBillStore.getState().setCustomer({id:'customer',name:'Test customer',balance:50});useBillStore.getState().setDetails({date:'2026-10-16',due_date:'2026-10-20',note:'Draft waiting for UPI setup'});useBillStore.getState().setBillDiscount(5);
 vi.resetModules();const restored=(await import('../../src/retail/retailStore')).useBillStore.getState();expect(restored.items).toHaveLength(10);expect(restored.customer?.id).toBe('customer');expect(restored.details.note).toBe('Draft waiting for UPI setup');expect(restored.details.due_date).toBe('2026-10-20');expect(restored.discount).toBe(5);
});
it('keeps each shop separate and restores the first draft when switching back',async()=>{
 const {useBillStore}=await import('../../src/retail/retailStore');useBillStore.getState().putLine({item_id:'one',name:'Only A',quantity:1,rate:10,unit:'PCS',discount_amount:0,total:0});
 const previous=auth.state;auth.state={...auth.state,tenantContext:{...auth.state.tenantContext,company_id:'shop-b'}};auth.listeners.forEach(fn=>fn(auth.state,previous));expect(useBillStore.getState().items).toHaveLength(0);
 const second=auth.state;auth.state=previous;auth.listeners.forEach(fn=>fn(auth.state,second));expect(useBillStore.getState().items[0].name).toBe('Only A');
});
it('clears a confirmed bill so returning cannot resubmit the saved draft',async()=>{
 const {useBillStore}=await import('../../src/retail/retailStore');useBillStore.getState().putLine({item_id:'one',name:'One',quantity:1,rate:10,unit:'PCS',discount_amount:0,total:0});useBillStore.getState().setSavedSale({invoice:{id:'saved'},mode:'Cash'});useBillStore.getState().clearBill();
 vi.resetModules();expect((await import('../../src/retail/retailStore')).useBillStore.getState().items).toHaveLength(0);
});
