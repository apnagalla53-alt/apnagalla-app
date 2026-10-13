import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { featureMetadata } from './retail-plan-catalog';

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}
  subscriptionSummary(effective:any,now=new Date()) {
    return effective.subscription?{status:effective.subscription_status,
      plan_name:effective.plan?.name||'No plan',plan_code:effective.plan?.code||null,monthly_price:effective.plan?.monthly_price??null,
      expires_at:effective.subscription.expires_at,complimentary:effective.subscription.complimentary}:null;
  }
  async resolve(organizationId:string,client:Prisma.TransactionClient|PrismaService=this.prisma,companyId?:string) {
    const org=await client.organization.findUnique({where:{id:organizationId},include:{plan:{include:{plan_features:true}},tenant_entitlements:true,subscription:true}});
    if(!org)throw new NotFoundException('Organization not found');
    if(companyId&&!await client.company.findFirst({where:{id:companyId,organization_id:organizationId},select:{id:true}}))throw new NotFoundException('Business not found');
    const settings=companyId?(await client.companyConfiguration.findUnique({where:{company_id:companyId}}))?.shop_feature_settings as Record<string,boolean>|undefined:undefined;
    const features=await client.feature.findMany({orderBy:{name:'asc'}});
    const defaults=new Set(org.plan?.plan_features.map(p=>p.feature_id)||[]);
    const now=new Date(),sub=org.subscription;
    const subscription_status=['SUSPENDED','CANCELLED'].includes(org.status)?org.status:!org.is_active?'SUSPENDED':!sub?'NOT_CONFIGURED':sub.expires_at<=now?'EXPIRED':!['ACTIVE','TRIAL','COMPLIMENTARY'].includes(sub.status)?sub.status:sub.complimentary?'COMPLIMENTARY':org.status==='TRIAL'?'TRIAL':sub.status;
    // Legacy organizations without a subscription retain their established guard policy.
    const active=org.is_active&&!['SUSPENDED','CANCELLED'].includes(org.status)&&(!sub||(sub.start_date<=now&&sub.expires_at>now&&['ACTIVE','TRIAL','COMPLIMENTARY'].includes(sub.status)));
    const bucket=parseInt(createHash('sha256').update(org.id).digest('hex').slice(0,8),16)%100;
    const effective=features.map(feature=>{
      const meta=featureMetadata(feature.code),override=org.tenant_entitlements.find(e=>e.feature_id===feature.id);
      const rollout=feature.is_active&&(feature.rollout_mode==='ON'||feature.rollout_mode==='PERCENTAGE'&&bucket<feature.rollout_percent||feature.rollout_mode==='BETA'&&Array.isArray(feature.beta_tenants)&&feature.beta_tenants.includes(org.id));
      // Operator data protection is never removed by a commercial plan/tenant override.
      const entitled=feature.code==='BACKUP'||(override?.is_enabled??defaults.has(feature.id));
      const shop_enabled=meta.core?true:settings?.[feature.code]??meta.default_shop_enabled;
      return {id:feature.id,code:feature.code,name:feature.name,...meta,plan_entitled:entitled,shop_enabled,
        enabled:active&&rollout&&entitled&&shop_enabled,rollout_enabled:rollout,plan_default:defaults.has(feature.id),override:override?.is_enabled??null,rollout_mode:feature.rollout_mode};
    });
    return {organization_id:org.id,company_id:companyId||null,plan:org.plan?{id:org.plan.id,code:org.plan.code,name:org.plan.name,monthly_price:Number(org.plan.monthly_price),description:org.plan.description}:null,
      features:effective,limits:{...(org.plan?.limits as object||{}),...(org.limit_overrides as object||{})},subscription:sub,subscription_status,subscription_active:active,status:org.status,synced_at:now.toISOString()};
  }
  async require(organizationId:string,codes:string[],companyId?:string,client:Prisma.TransactionClient|PrismaService=this.prisma) {
    const effective=await this.resolve(organizationId,client,companyId);
    for(const code of codes) {
      const feature=effective.features.find(f=>f.code===code);
      if(!feature?.enabled)throw new ForbiddenException({code:!feature?.plan_entitled?'FEATURE_NOT_ENTITLED':!effective.subscription_active?'SUBSCRIPTION_INACTIVE':!feature.rollout_enabled?'FEATURE_UNAVAILABLE':'SHOP_FEATURE_DISABLED',feature:code,required_plan:feature?.required_plan||null,message:`${feature?.name||code} is not available for this shop.`});
    }
    return effective;
  }
}
