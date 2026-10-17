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

it('recovers calculator and charge in the same bill, then resets calculator, GST and discount for a new bill',async()=>{
 const {useBillStore,billLinePayload,billOptionsPayload}=await import('../../src/retail/retailStore');
 useBillStore.getState().addItem({id:'one',name:'Known item',sku:'one',selling_price:100,purchase_price:0,inventory_tracking:false,current_stock:0,unit:'PCS',tax_rate:18,active:true});
 expect(billLinePayload(useBillStore.getState().items[0]).gst_rate).toBe(0);
 useBillStore.getState().setCalculator({expression:'40',history:[{expression:'400*10%',result:'40'}]});
 useBillStore.getState().setServiceCharge({name:'Packing',amount:20,gst_rate:0});useBillStore.getState().setCustomerName('Test new customer');useBillStore.getState().setDiscountMode('PERCENT');useBillStore.getState().setBillDiscount(10);
 expect(billOptionsPayload()).toMatchObject({bill_discount_percent:10,service_charge:{amount:20},customer_name:'Test new customer'});
 useBillStore.getState().setServiceCharge({name:'Packing',amount:20,gst_rate:0,auto_apply:true} as any);
 expect(billOptionsPayload().service_charge).not.toHaveProperty('auto_apply');
 vi.resetModules();const restored=(await import('../../src/retail/retailStore')).useBillStore;
 expect(restored.getState().calculator.history).toHaveLength(1);expect(restored.getState().serviceCharge?.amount).toBe(20);
 restored.getState().clearBill();expect(restored.getState().calculator.history).toHaveLength(0);expect(restored.getState().calculator.expression).toBe('');expect(restored.getState().discount).toBe(0);expect(restored.getState().customerName).toBe('');
});
