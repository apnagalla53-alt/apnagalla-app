import { describe,it,expect } from 'vitest';
import { drawerGroups,canShowDrawerItem } from '../../src/retail/components/retailNavigation';
const service=drawerGroups.flatMap(group=>group.children).find(item=>item.id==='service-calculator')!;
describe('Contextual service navigation',()=>{
 const owner={id:'synthetic-owner',role:'OWNER',is_platform:false,permissions:[]} as any;
 const features=new Set(['RETAIL_POS','INVENTORY']);
 it('shows the calculator only for an effective repair activity',()=>{expect(canShowDrawerItem(service,{user:owner,features})).toBe(false);expect(canShowDrawerItem(service,{user:owner,features,serviceCalculator:true})).toBe(true);});
 it('preserves feature and staff permission boundaries',()=>{expect(canShowDrawerItem(service,{user:owner,features:new Set(),serviceCalculator:true})).toBe(false);expect(canShowDrawerItem(service,{user:{...owner,role:'STAFF',permissions:['sales.write']},features,serviceCalculator:true})).toBe(false);expect(canShowDrawerItem(service,{user:{...owner,role:'STAFF',permissions:['sales.write','inventory.read']},features,serviceCalculator:true})).toBe(true);});
});
