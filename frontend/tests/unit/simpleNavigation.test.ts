import { describe, expect, it } from 'vitest';
import { simpleDrawerItems, visibleSimpleDrawer, activeDrawerItem } from '../../src/retail/components/retailNavigation';
import type { User } from '../../src/shared/store/authStore';
const user=(role:string,permissions:string[]=[])=>({id:'disposable',username:'test',display_name:'Test',email:null,phone:null,roles:[],role,permissions} as User);
const features=new Set(['RETAIL_POS','INVENTORY','PURCHASING','KHATA','EXPENSES','ACCOUNTING','REPORTS','STAFF']);
describe('Flat daily drawer keeps real access boundaries',()=>{
 it('has one link per destination and direct daily tasks',()=>{
  const visible=visibleSimpleDrawer({user:user('OWNER'),features});
  expect(new Set(visible.map(item=>item.route)).size).toBe(visible.length);
  expect(visible.map(item=>item.id)).toEqual(['home','quick-sale','galla','bills','purchases','inventory','khata','suppliers','expenses','reports','staff','business','settings-help']);
  expect(visible.some(item=>/Sell & Billing|Inventory & Stock|People & Money|Business & Staff/.test(item.label))).toBe(false);
 });
 it('hides staff, financial and purchase destinations from a sales-only member',()=>{
  const ids=visibleSimpleDrawer({user:user('CASHIER',['sales.write','sales.read']),features}).map(item=>item.id);
  expect(ids).toContain('quick-sale');expect(ids).toContain('bills');
  for(const hidden of ['staff','reports','purchases','suppliers','expenses','galla','khata'])expect(ids).not.toContain(hidden);
 });
 it('does not turn plan features on for an owner',()=>{
  const ids=visibleSimpleDrawer({user:user('OWNER'),features:new Set(['RETAIL_POS'])}).map(item=>item.id);
  expect(ids).toContain('quick-sale');expect(ids).not.toContain('staff');expect(ids).not.toContain('reports');
  expect(visibleSimpleDrawer({user:user('OWNER'),features:null}).map(item=>item.id)).not.toContain('quick-sale');
 });
 it('highlights a bill detail without a duplicated GST or Make Bill drawer entry',()=>{
  expect(activeDrawerItem(simpleDrawerItems,{pathname:'/retail/bills/test-id',search:'',hash:''})).toBe('bills');
  expect(simpleDrawerItems.filter(item=>item.route==='/retail/bill'||item.route==='/retail/gst')).toHaveLength(0);
 });
});
