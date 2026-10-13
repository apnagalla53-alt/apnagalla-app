import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntitlementService } from '../entitlement.service';
import {PrismaService} from '../../database/prisma.service';

export const FEATURES_KEY = 'features';
export const RequireFeature = (...features: string[]) => SetMetadata(FEATURES_KEY, features);

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private entitlements: EntitlementService,
    private prisma:PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const declared = this.reflector.getAllAndOverride<string[]>(FEATURES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!declared || declared.length === 0) {
      return true; // No specific features required
    }

    const request = context.switchToHttp().getRequest();
    const requiredFeatures=[...declared];
    const user = request.user;

    if (!user || !user.organization_id) {
      throw new ForbiddenException('Missing organization context for feature entitlement check');
    }

    const path=request.path||request.url||'';
    const resource=path.includes('/retail/')?path.split('/retail/')[1].split('/')[0]:'';
    const moduleFeature=({purchases:'PURCHASING',suppliers:'PURCHASING',customers:'KHATA',khata:'KHATA',expenses:'EXPENSES','expense-categories':'EXPENSES',reports:'REPORTS',items:'INVENTORY',needs:'INVENTORY',galla:'ACCOUNTING'} as any)[resource];
    if(moduleFeature)requiredFeatures.push(moduleFeature);
    if(resource==='galla')requiredFeatures.push('DAILY_GALLA');
    if(resource==='needs')requiredFeatures.push('NEED_LIST');
    const write=!['GET','HEAD','OPTIONS'].includes(request.method);
    const recovery=/\/(?:return|returns)(?:\/|$)|\/reverse$/.test(path);
    if(write&&!recovery){
      if(/\/inventory\/transfers(?:\/|$)/.test(path))requiredFeatures.push('MULTIPLE_STOCK_LOCATIONS');
      if(/\/pricing\//.test(path))requiredFeatures.push('ADVANCED_PRICING');
      if(/\/items\/[^/]+\/variants/.test(path))requiredFeatures.push('VARIANTS');
      if(/\/items\/[^/]+\/(?:units|conversions)/.test(path))requiredFeatures.push('MULTI_UNIT');
      if(/\/items\/[^/]+\/compatibility/.test(path))requiredFeatures.push('COMPATIBILITY');
      const body=request.body||{},records:any[]=[];
      let lines=Array.isArray(body.items)?body.items:Array.isArray(body.lines)?body.lines:[];
      // Posting a saved draft has no line payload. Recheck its current item capabilities too.
      const documentPath=path.match(/\/(purchase\/(?:receipts|invoices|returns)|sales\/(?:challans|invoices|returns)|inventory\/(?:adjustments|transfers|opening-stock))\/([0-9a-f-]{36})\/post$/i);
      if(documentPath){
        const models:Record<string,string>={'purchase/receipts':'goodsReceipt','purchase/invoices':'purchaseInvoice','purchase/returns':'purchaseReturn','sales/challans':'deliveryChallan','sales/invoices':'salesInvoice','sales/returns':'salesReturn','inventory/adjustments':'stockAdjustment','inventory/transfers':'stockTransfer','inventory/opening-stock':'openingStock'};
        const document=await (this.prisma as any)[models[documentPath[1]]].findFirst({where:{id:documentPath[2],company_id:user.company_id},include:{lines:true}});
        if(document)lines=[...lines,...document.lines.map((l:any)=>({...l,unit_id:l.entered_unit_id||l.unit_id}))];
      }
      const locationIds=[...new Set([body.godown_id,...lines.map((line:any)=>line.godown_id)].filter(Boolean))] as string[];
      if(locationIds.length){
        const locations=await this.prisma.godown.findMany({where:{id:{in:locationIds},branch:{company_id:user.company_id}},select:{id:true,branch_id:true}});
        for(const location of locations){const primary=await this.prisma.godown.findFirst({where:{branch_id:location.branch_id},orderBy:[{created_at:'asc'},{id:'asc'}],select:{id:true}});if(location.id!==primary?.id)requiredFeatures.push('MULTIPLE_STOCK_LOCATIONS');}
      }
      if(resource==='items')records.push(body);
      if(body.modifiers?.length||body.modifier_option_ids?.length||lines.some((l:any)=>l.modifiers?.length||l.modifier_option_ids?.length))requiredFeatures.push('MODIFIERS');
      if(body.compatibility?.length||body.compatibility_metadata||body.compatibility_tags)requiredFeatures.push('COMPATIBILITY');
      if(body.adjustment_type==='OUT')requiredFeatures.push('WASTAGE');
      if(body.price_list_id||body.price_level_id)requiredFeatures.push('ADVANCED_PRICING');
      const ids=[...new Set([...lines.map((l:any)=>l?.item_id),...(body.item_id?[body.item_id]:[])])].filter(Boolean) as string[];
      if(ids.length)records.push(...await this.prisma.item.findMany({where:{company_id:user.company_id,id:{in:ids}},select:{item_type:true,selling_mode:true,has_variants:true,track_batch:true,track_serial:true,is_bundle:true,primary_unit_id:true,id:true}}));
      for(const item of records){
        if(item.item_type==='SERVICE'||item.selling_mode==='SERVICE')requiredFeatures.push('SERVICES');
        if(item.has_variants)requiredFeatures.push('VARIANTS');
        if(item.track_batch)requiredFeatures.push('BATCH_TRACKING');
        if(item.track_serial)requiredFeatures.push('SERIAL_TRACKING');
        if(item.is_bundle)requiredFeatures.push('BUNDLES');
        if(['WEIGHT','LENGTH','AREA','VOLUME'].includes(item.selling_mode))requiredFeatures.push(item.selling_mode);
      }
      for(const line of lines){const item=records.find(i=>i.id===line?.item_id);if(item&&line.unit_id&&line.unit_id!==item.primary_unit_id)requiredFeatures.push('MULTI_UNIT');}
    }

    const resolved = await this.entitlements.resolve(user.organization_id,this.prisma,user.company_id);
    // Expired subscriptions retain core historical reads; paid reporting stays locked.
    const historical=!write&&resolved.subscription_status==='EXPIRED';
    const activeFeatureCodes = resolved.features.filter(e => e.enabled||(historical&&e.core&&e.plan_entitled&&e.rollout_enabled)).map(e => e.code);

    const hasAllRequiredFeatures = requiredFeatures.every(f => activeFeatureCodes.includes(f));

    if (!hasAllRequiredFeatures) {
      const missingFeatures = requiredFeatures.filter(f => !activeFeatureCodes.includes(f));
      const missing=resolved.features.find(f=>f.code===missingFeatures[0]);
      throw new ForbiddenException({code:!missing?.plan_entitled?'FEATURE_NOT_ENTITLED':!resolved.subscription_active?'SUBSCRIPTION_INACTIVE':!missing.rollout_enabled?'FEATURE_UNAVAILABLE':'SHOP_FEATURE_DISABLED',features:missingFeatures,required_plan:missing?.required_plan||null,message:`Organization lacks entitlement for features: ${missingFeatures.join(', ')}`});
    }

    return true;
  }
}
