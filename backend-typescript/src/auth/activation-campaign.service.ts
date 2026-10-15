import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ReferralService } from './referral.service';
import { consumeRate } from '../common/shared-rate-limit';

export type ActivationCampaignInput = { code:string; name:string; enabled:boolean; plan_code:string; trial_days:number; max_redemptions?:number|null; starts_at:string; ends_at?:string|null; reason:string };
@Injectable()
export class ActivationCampaignService {
  constructor(private db:PrismaService,private referrals:ReferralService) {}
  async list() {
    return this.db.runSystem(()=>this.db.activationCampaign.findMany({orderBy:{created_at:'desc'},take:100,include:{_count:{select:{redemptions:true}}}}));
  }
  async save(dto:ActivationCampaignInput,actor:string,id?:string) {
    const code=dto.code.trim().toUpperCase(),name=dto.name.trim(),starts=new Date(dto.starts_at),ends=dto.ends_at?new Date(dto.ends_at):null;
    if(!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)||code.startsWith('EVX-')||!name||dto.reason.trim().length<3)throw new BadRequestException('Use a 3–40 character code, a campaign name and an audit reason. EVX- codes are reserved for shop invitations.');
    if(!Number.isInteger(dto.trial_days)||dto.trial_days<1||dto.trial_days>60||!['STARTER','SMART','PRO'].includes(dto.plan_code))throw new BadRequestException('Choose an active plan and 1–60 trial days.');
    if(!Number.isFinite(starts.getTime())||ends&&(!Number.isFinite(ends.getTime())||ends<=starts))throw new BadRequestException('Campaign end must be after its start.');
    return this.db.runSystem(()=>this.db.$transaction(async tx=>{
      // Reserve EVX- for generated customer invitations; serialize campaign code edits.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'activation-campaign-code:'+code}))`;
      if(id)await tx.$queryRaw`SELECT id FROM activation_campaigns WHERE id=${id}::uuid FOR UPDATE`;
      const current=id?await tx.activationCampaign.findUnique({where:{id}}):null;
      if(id&&!current)throw new NotFoundException('Campaign not found.');
      if(await tx.referralCode.findUnique({where:{code}})||await tx.activationCampaign.findFirst({where:{code,...(id?{id:{not:id}}:{})}}))throw new ConflictException('This code is already used. Choose another code.');
      if(!await tx.plan.findFirst({where:{code:dto.plan_code,is_active:true}}))throw new BadRequestException('This plan is unavailable.');
      const used=id?await tx.activationRedemption.count({where:{campaign_id:id}}):0;
      if(used&&current?.code!==code)throw new BadRequestException('Keep the code unchanged after its first redemption. Disable it to stop new activations.');
      if(dto.max_redemptions!=null&&(!Number.isInteger(dto.max_redemptions)||dto.max_redemptions<1||dto.max_redemptions<used))throw new BadRequestException('The usage limit must be at least the number of existing redemptions.');
      const data={code,name,enabled:dto.enabled,plan_code:dto.plan_code,trial_days:dto.trial_days,max_redemptions:dto.max_redemptions??null,starts_at:starts,ends_at:ends};
      const result=id?await tx.activationCampaign.update({where:{id},data}):await tx.activationCampaign.create({data});
      await tx.platformAuditLog.create({data:{user_id:actor,action:id?'ACTIVATION_CAMPAIGN_UPDATED':'ACTIVATION_CAMPAIGN_CREATED',resource_type:'ActivationCampaign',resource_id:result.id,details:JSON.stringify({reason:dto.reason,previous:current,changes:data})}});
      return result;
    }));
  }
  async redeem(userId:string,input:string) {
    // Account-bound limits work behind shared proxies and shop networks too.
    await consumeRate('activation-code:user:'+userId,10,600000);
    const code=input.trim().toUpperCase();
    if(!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code))throw new BadRequestException('Enter a valid referral or campaign code.');
    return this.db.runSystem(()=>this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const user=await tx.user.findUniqueOrThrow({where:{id:userId}});
      if(!user.is_active||user.is_locked||!user.organization_id||!['PLAN_REQUIRED','ACCESS_PENDING','MIGRATION_OFFERED'].includes(user.onboarding_state))throw new ForbiddenException('Complete your business profile before applying a code.');
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${user.organization_id}::uuid FOR UPDATE`;
      const org=await tx.organization.findUniqueOrThrow({where:{id:user.organization_id},include:{subscription:true,companies:{select:{id:true}}}});
      if(!org.is_active||org.archived_at||['SUSPENDED','CANCELLED','ARCHIVED'].includes(org.status))throw new ForbiddenException('This shop is unavailable for activation.');
      const owner=await tx.userRole.findFirst({where:{user_id:userId,company_id:{in:org.companies.map(c=>c.id)},role:{name:{in:['OWNER','TENANT_ADMIN','ADMIN']}}}});
      if(!owner?.company_id)throw new ForbiddenException('Only this shop’s owner can apply an activation code.');
      const previous=await tx.activationRedemption.findFirst({where:{OR:[{organization_id:org.id},{user_id:userId}]},include:{campaign:true}});
      if(previous){if(previous.campaign.code===code)return {kind:'TRIAL',already_applied:true};throw new ConflictException('A campaign trial has already been used for this shop.');}
      if(org.subscription?.status!=='PENDING')throw new BadRequestException('This shop already has an access decision. A campaign cannot replace or extend it.');
      const campaign=await tx.activationCampaign.findUnique({where:{code}});
      if(!campaign){
        // Customer invitation codes keep their tracking/reward rules and never grant trial access.
        const attribution=await tx.referralAttribution.findUnique({where:{referred_user_id:userId},include:{code:true}});
        if(attribution&&attribution.code.code!==code)throw new ConflictException('A different referral code is already attached to this account.');
        if(attribution)return {kind:'REFERRAL',already_applied:true};
        await this.referrals.attachSignup(tx,user,code);
        await this.referrals.attachBusiness(tx,userId,org.id);
        await tx.auditLog.create({data:{user_id:userId,company_id:owner.company_id,action:'ONBOARDING_REFERRAL_APPLIED',details:JSON.stringify({code})}});
        return {kind:'REFERRAL',already_applied:false};
      }
      await tx.$queryRaw`SELECT id FROM activation_campaigns WHERE id=${campaign.id}::uuid FOR UPDATE`;
      const locked=await tx.activationCampaign.findUniqueOrThrow({where:{id:campaign.id}}),now=new Date();
      if(!locked.enabled||locked.starts_at>now||locked.ends_at&&locked.ends_at<=now)throw new BadRequestException('This campaign code is unavailable or expired.');
      if(locked.max_redemptions!=null&&await tx.activationRedemption.count({where:{campaign_id:locked.id}})>=locked.max_redemptions)throw new BadRequestException('This campaign has reached its activation limit.');
      const plan=await tx.plan.findFirst({where:{code:locked.plan_code,is_active:true}});
      if(!plan)throw new BadRequestException('This campaign’s plan is unavailable.');
      const expiry=new Date(now.getTime()+locked.trial_days*86400000);
      await tx.activationRedemption.create({data:{campaign_id:locked.id,user_id:userId,organization_id:org.id,plan_code:plan.code,trial_days:locked.trial_days,expires_at:expiry}});
      await tx.organization.update({where:{id:org.id},data:{plan_id:plan.id,status:'TRIAL'}});
      await tx.tenantSubscription.update({where:{organization_id:org.id},data:{status:'TRIAL',complimentary:true,start_date:now,expires_at:expiry}});
      await tx.user.update({where:{id:userId},data:{onboarding_state:'MIGRATION_OFFERED',onboarding_data:{...(user.onboarding_data as any),requested_plan_code:plan.code,activation_source:'CAMPAIGN',activation_campaign_code:code}}});
      await tx.auditLog.create({data:{user_id:userId,company_id:owner.company_id,action:'CAMPAIGN_TRIAL_STARTED',details:JSON.stringify({campaign_id:locked.id,code,plan_code:plan.code,trial_days:locked.trial_days,expires_at:expiry})}});
      await this.referrals.refresh(tx,org.id);
      return {kind:'TRIAL',already_applied:false};
    },{timeout:30000}));
  }
}
