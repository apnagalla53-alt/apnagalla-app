import { describe,it,expect,vi } from 'vitest';
import { RETAIL_PLAN_DEFAULTS, defaultPlanFeatures, featureMetadata, LAUNCH_PLAN_REVISION } from './retail-plan-catalog';
import { installLaunchPlanRevision } from '../platform/launch-plan-revision';
import { hideFinancialCosts } from './financial-cost-visibility.interceptor';
import { importCapabilities } from '../retail/imports/import-entitlements';

describe('Final launch plan configuration',()=>{
  it.each([['STARTER',75,16,1,0,2],['SMART',120,38,3,2,5],['PRO',210,45,6,5,10]])('%s exact price, feature count and one-shop limits',(code,price,count,users,staff,devices)=>{
    const plan=RETAIL_PLAN_DEFAULTS.find(p=>p.code===code)!;
    expect(plan.monthly_price).toBe(price);expect(plan.name).toBe('Apna Galla '+String(code)[0]+String(code).slice(1).toLowerCase());
    expect(plan.limits).toEqual({users,staff,devices,branches:1,stock_locations:1,companies:1});
    expect(defaultPlanFeatures(String(code))).toHaveLength(Number(count));
    expect(defaultPlanFeatures(String(code))).not.toEqual(expect.arrayContaining(['ASSISTANT_VOICE']));
    for(const key of ['MULTIPLE_STOCK_LOCATIONS','ASSISTANT_VOICE','EXPORT_SCHEDULED','EXPORT_LOCATIONS','ADVANCED_REPORTS'])expect(defaultPlanFeatures(String(code))).not.toContain(key);
  });
  it('unknown plans never inherit a future or legacy minimum',()=>expect(defaultPlanFeatures('BROWSER_OLD')).toEqual([]));
  it('future metadata has no incorrect Pro upgrade requirement',()=>{
    expect(featureMetadata('MULTIPLE_STOCK_LOCATIONS')).toMatchObject({required_plan:null,commercial_state:'FUTURE_PREMIUM'});
    expect(featureMetadata('ASSISTANT_VOICE')).toMatchObject({required_plan:null,commercial_state:'COMING_SOON'});
    expect(featureMetadata('ADVANCED_PRICING')).toMatchObject({required_plan:'PRO',commercial_state:'COMING_SOON'});
  });
  it('redacts nested paid profit facts while retaining operational invoice values',()=>{
    expect(hideFinancialCosts({grand_total:10,lines:[{quantity:1,cogs_total:3,cost_snapshot:{cost:3},gross_profit:7}],movements:[{base_quantity_delta:-1,cost_rate:3,value_delta:-3,unknown_quantity_delta:0}],summary:{inventory_value:3}})).toEqual({grand_total:10,lines:[{quantity:1}],movements:[{base_quantity_delta:-1}],summary:{}});
  });
  it('detects mapped and unmapped advanced import fields without dropping them',()=>{
    expect(importCapabilities('ITEMS',{'Batch Number':'LOT-1','Serial Number':'S-1'},{selling_mode:'WEIGHT'})).toEqual({required:['INVENTORY','BATCH_TRACKING','SERIAL_TRACKING','WEIGHT'],unsupported:['Batch Number','Serial Number']});
    expect(importCapabilities('ITEMS',{'Track Batch':'No'},{selling_mode:'PIECE'}).required).toEqual(['INVENTORY']);
  });
  it('commercial revision is marker-idempotent and never touches tenant business delegates',async()=>{
    const tx={ $executeRaw:vi.fn(), platformSetting:{findUnique:vi.fn().mockResolvedValue({key:LAUNCH_PLAN_REVISION})},plan:{upsert:vi.fn()},feature:{upsert:vi.fn()} };
    expect(await installLaunchPlanRevision(tx)).toBe(false);expect(tx.plan.upsert).not.toHaveBeenCalled();expect(tx.feature.upsert).not.toHaveBeenCalled();
  });
});
