import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { TenantProvisioningService } from '../platform/provisioning/tenant-provisioning.service';
import { AccountPolicyService } from './account-policy.service';
import { AuthService } from './auth.service';
import { ReferralService } from './referral.service';
import { BUSINESS_TYPES,businessTypeCatalog } from './business-types';
import { normalizeIndianPhone } from './phone';
import { businessSelection } from './business-selection';

@Injectable()
export class OnboardingService {
  constructor(private db: PrismaService, private provisioning: TenantProvisioningService, private policy: AccountPolicyService, private auth: AuthService, private referrals: ReferralService) {}
  async state(userId: string) {
    let user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user?.is_active) throw new NotFoundException('Account not found.');
    const org = user.organization_id ? await this.db.organization.findUnique({ where: { id: user.organization_id }, include: { subscription: true, companies: { select: { id: true, trade_name: true,address:true,city:true,state:true,postal_code:true } } } }) : null;
    const accessActive=!!(org?.is_active&&org.subscription&&['ACTIVE','TRIAL','COMPLIMENTARY'].includes(org.subscription.status)&&org.subscription.expires_at>new Date());
    let next=user.onboarding_state;
    if(next==='OWNER_PROFILE_REQUIRED'&&user.google_subject)next='BUSINESS_PROFILE_REQUIRED';
    if(['PLAN_REQUIRED','ACCESS_PENDING'].includes(next)&&accessActive){
      const saved=org?.companies[0]&&await this.db.runSystem(()=>this.db.retailMigrationChoice.findUnique({where:{company_id_user_id:{company_id:org.companies[0].id,user_id:userId}}}));
      next=saved?'READY':'MIGRATION_OFFERED';
    }
    if(next!==user.onboarding_state){
      user=await this.db.user.update({where:{id:userId},data:{onboarding_state:next}});
    }
    const plans = await this.db.plan.findMany({ where: { code: { in: ['STARTER','SMART','PRO'] }, is_active: true }, select: { code: true, name: true, monthly_price: true, limits: true } });
    const policy = await this.policy.get();
    const contact=user.phone||user.phone_e164;
    const tenantContext=org&&accessActive?await this.db.runSystem(async()=>{
      const membership=await this.db.userRole.findFirst({where:{user_id:userId,company_id:{in:org.companies.map(c=>c.id)}}});
      const company=org.companies.find(c=>c.id===membership?.company_id);
      const branch=membership?.branch_id?await this.db.branch.findFirst({where:{id:membership.branch_id,company_id:company?.id}}):null;
      const fy=company?await this.db.financialYear.findFirst({where:{company_id:company.id,is_closed:false,start_date:{lte:new Date()},end_date:{gte:new Date()}},orderBy:{is_active:'desc'}}):null;
      return company&&branch?{organization_id:org.id,organization_name:org.name,company_id:company.id,company_name:company.trade_name||org.name,branch_id:branch.id,branch_name:branch.name,financial_year_id:fy?.id,financial_year_label:fy?.label}:null;
    }):null;
    return { state:user.onboarding_state, owner_name:user.display_name==='New shop owner'?'':user.display_name,phone:contact,mobile_verified:!!user.phone_verified_at&&contact===user.phone_e164,email:user.email,data:user.onboarding_data,
      business:org?{id:org.id,name:org.name,company_id:org.companies[0]?.id,business_type:org.business_type,additional_business_types:org.additional_business_types,address:org.companies[0]?.address,city:org.companies[0]?.city,state:org.companies[0]?.state,postal_code:org.companies[0]?.postal_code}:null,
      subscription:org?.subscription||null,tenant_context:tenantContext,access_active:accessActive,plans:plans.sort((a,b)=>['STARTER','SMART','PRO'].indexOf(a.code)-['STARTER','SMART','PRO'].indexOf(b.code)),trial:{trial_enabled:policy.trial_enabled,trial_days:policy.trial_days,trial_plan:policy.trial_plan},business_types:businessTypeCatalog(),payment_provider:{configured:false},import_formats:['CSV','TSV','XLSX','XLS','ODS','JSON','XML']};
  }
  async owner(userId: string, name: string) {
    const current = await this.state(userId);
    if (!['OWNER_PROFILE_REQUIRED','BUSINESS_PROFILE_REQUIRED'].includes(current.state)||current.business) throw new BadRequestException('Your owner profile is already completed. Resume the current setup step.');
    const displayName = name.trim();
    if (!displayName) throw new BadRequestException('Enter your name.');
    await this.db.user.update({ where: { id: userId }, data: { display_name: displayName, onboarding_state: 'BUSINESS_PROFILE_REQUIRED' } });
    return this.state(userId);
  }
  async business(userId: string, dto: any) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.onboarding_state !== 'BUSINESS_PROFILE_REQUIRED' || user.organization_id) throw new BadRequestException('Resume your current setup step.');
    return this.profile(userId,{...dto,owner_name:user.display_name,mobile:dto.mobile||user.phone||user.phone_e164});
  }
  async profile(userId:string,dto:any){
    const owner=String(dto.owner_name||'').trim(),name=String(dto.name||'').trim(),address=String(dto.address||'').trim();
    if(!owner||owner.length>255||!name||name.length>255||!address||address.length>1000)throw new BadRequestException('Enter your owner name, shop name and address.');
    const selected=businessSelection(dto.business_type,dto.additional_business_types);
    const mobile=normalizeIndianPhone(dto.mobile),type=BUSINESS_TYPES.find(type=>type[0]===selected.business_type);
    if(!type)throw new BadRequestException('Choose a supported business type.');
    const custom=type[0]==='OTHER'?String(dto.custom_business_type||'').trim():'';
    if(custom.length>100)throw new BadRequestException('Describe your business in 100 characters or fewer.');
    if((dto.latitude==null)!==(dto.longitude==null))throw new BadRequestException('Location needs both latitude and longitude.');
    await this.db.runSystem(()=>this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const user=await tx.user.findUniqueOrThrow({where:{id:userId}});
      if(!user.is_active||user.is_locked)throw new ForbiddenException('Account is unavailable.');
      if(user.onboarding_state==='READY')throw new BadRequestException('Your setup is complete. Change business details in Settings.');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${mobile}))`;
      const local=mobile.slice(3);
      const others=await tx.$queryRaw<{id:string}[]>`SELECT id FROM users WHERE id<>${userId}::uuid AND (phone_e164=${mobile} OR regexp_replace(phone,'[^0-9]','','g') IN (${local},${'91'+local},${'0'+local})) LIMIT 1`;
      if(others.length)throw new ConflictException({code:'MOBILE_ALREADY_LINKED',message:'This mobile number is already linked with another Apna Galla account.'});
      let orgId=user.organization_id,companyId:string;
      if(!orgId){
        if(!['OWNER_PROFILE_REQUIRED','BUSINESS_PROFILE_REQUIRED'].includes(user.onboarding_state))throw new BadRequestException('Resume your current setup step.');
        const result=await this.provisioning.provisionTenant({organizationName:name,adminName:owner,adminEmail:user.email||undefined,phone:mobile,adminPassword:randomBytes(24).toString('hex'),businessType:type[0],address,city:dto.city?.trim(),state:dto.state?.trim(),postalCode:dto.postal_code?.trim()},undefined,userId,async(inner,context)=>this.referrals.attachBusiness(inner,userId,context.organization.id));
        orgId=result.organization.id;companyId=result.company.id;
        await tx.organization.update({where:{id:orgId},data:{additional_business_types:selected.additional_business_types}});
      }else{
        const memberships=await tx.userRole.findMany({where:{user_id:userId,company_id:{not:null},role:{name:{in:['OWNER','TENANT_ADMIN','ADMIN']}}}});
        const company=await tx.company.findFirst({where:{organization_id:orgId,id:{in:memberships.map(m=>m.company_id!)},organization:{is_active:true,archived_at:null}}});
        if(!company)throw new ForbiddenException('Business owner access is required.');companyId=company.id;
        await tx.organization.update({where:{id:orgId},data:{name,...selected}});
        await tx.company.update({where:{id:companyId},data:{trade_name:name,legal_name:name,phone:mobile,address,...(dto.city!==undefined?{city:dto.city.trim()}:{}),...(dto.state!==undefined?{state:dto.state.trim()}:{}),...(dto.postal_code!==undefined?{postal_code:dto.postal_code.trim()}: {})}});
      }
      const profile={owner_name:owner,name,mobile,...selected,custom_business_type:custom,address,city:dto.city?.trim(),state:dto.state?.trim(),postal_code:dto.postal_code?.trim()};
      await tx.user.update({where:{id:userId},data:{display_name:owner,phone:mobile,onboarding_data:{...(user.onboarding_data as any),...selected,custom_business_type:custom,suggested_features:type[3],profile:JSON.parse(JSON.stringify(profile)),...(dto.latitude!=null?{location:{latitude:dto.latitude,longitude:dto.longitude}}:{})}}});
      await tx.auditLog.create({data:{company_id:companyId,user_id:userId,action:user.organization_id?'BUSINESS_ONBOARDING_UPDATED':'BUSINESS_ONBOARDING_CREATED',details:JSON.stringify({...selected,mobile_verified:!!user.phone_verified_at&&user.phone_e164===mobile})}});
    }));
    return this.requestActivation(userId);
  }
  async requestActivation(userId:string) {
    await this.db.runSystem(()=>this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const user=await tx.user.findUniqueOrThrow({where:{id:userId}});
      if(!user.is_active||user.is_locked||!user.organization_id)throw new BadRequestException('Complete your shop details first.');
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${user.organization_id}::uuid FOR UPDATE`;
      const org=await tx.organization.findUniqueOrThrow({where:{id:user.organization_id},include:{subscription:true,companies:{select:{id:true}}}});
      if(!org.is_active||org.archived_at)throw new ForbiddenException('This shop is unavailable.');
      const owner=await tx.userRole.findFirst({where:{user_id:userId,company_id:{in:org.companies.map(c=>c.id)},role:{name:{in:['OWNER','TENANT_ADMIN','ADMIN']}}}});
      if(!owner?.company_id)throw new ForbiddenException('Business owner access is required.');
      if(org.subscription?.status!=='PENDING')return;
      const data=user.onboarding_data as any;
      if(data?.activation_requested_at){
        if(user.onboarding_state==='PLAN_REQUIRED')await tx.user.update({where:{id:userId},data:{onboarding_state:'ACCESS_PENDING'}});
        return;
      }
      const plan=await tx.plan.findFirst({where:{code:data?.requested_plan_code||'SMART',is_active:true}});
      if(!plan)throw new BadRequestException('A demo plan is unavailable. Contact support.');
      await tx.organization.update({where:{id:org.id},data:{plan_id:plan.id}});
      await tx.user.update({where:{id:userId},data:{onboarding_state:'ACCESS_PENDING',onboarding_data:{...data,requested_plan_code:plan.code,activation_requested_at:new Date().toISOString(),activation_source:'MANUAL_REQUEST'}}});
      await tx.auditLog.create({data:{user_id:userId,company_id:owner.company_id,action:'PLAN_ACTIVATION_REQUESTED',details:JSON.stringify({plan_code:plan.code,automatic:true,payment_recorded:false})}});
    }));
    return this.state(userId);
  }
  async plan(userId: string, choice: 'TRIAL'|'REQUEST', code?: string) {
    if(choice==='TRIAL')throw new BadRequestException('Your free trial must be activated by the administrator or an eligible campaign code.');
    const state = await this.state(userId);
    if (!['PLAN_REQUIRED','MIGRATION_OFFERED','ACCESS_PENDING'].includes(state.state) || !state.business) throw new BadRequestException('Resume your current setup step.');
    const planCode = code;
    const plan = await this.db.plan.findFirst({ where: { code: planCode, is_active: true } });
    if (!plan || !['STARTER','SMART','PRO'].includes(plan.code)) throw new BadRequestException('Choose Starter, Smart or Pro.');
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (!['PLAN_REQUIRED','MIGRATION_OFFERED','ACCESS_PENDING'].includes(user.onboarding_state)) throw new BadRequestException('Your plan selection is already completed.');
      const sub = await tx.tenantSubscription.findUniqueOrThrow({ where: { organization_id: state.business!.id } });
      if (['ACTIVE','TRIAL','COMPLIMENTARY'].includes(sub.status) && sub.expires_at > new Date()) throw new BadRequestException('Access was already activated. Refresh to continue.');
      await tx.organization.update({ where: { id: state.business!.id }, data: { plan_id: plan.id } });
      await tx.user.update({ where: { id: userId }, data: { onboarding_state: 'ACCESS_PENDING', onboarding_data: { ...(user.onboarding_data as any), requested_plan_code: plan.code, activation_requested_at: (user.onboarding_data as any)?.activation_requested_at||new Date().toISOString() } } });
      await tx.auditLog.create({ data: { user_id: userId, company_id: state.business!.company_id, action: 'PLAN_ACTIVATION_REQUESTED', details: JSON.stringify({ plan_code: plan.code, configured_days: null }) } });
      await this.referrals.refresh(tx, state.business!.id);
    });
    return this.state(userId);
  }
  async migration(userId: string, choice: 'FRESH'|'IMPORT', context: any) {
    const state = await this.state(userId);
    if (!['MIGRATION_OFFERED','ACCESS_PENDING','READY'].includes(state.state) || !state.business?.company_id) throw new BadRequestException('Choose your plan before continuing.');
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const scope = { company_id: state.business!.company_id, user_id: userId };
      await tx.retailMigrationChoice.upsert({ where: { company_id_user_id: scope }, create: { ...scope, choice }, update: { choice } });
      const org=await tx.organization.findUniqueOrThrow({where:{id:state.business!.id},include:{subscription:true}});
      const active=org.is_active&&['ACTIVE','TRIAL','COMPLIMENTARY'].includes(org.subscription?.status||'')&&org.subscription!.expires_at>new Date();
      await tx.user.update({ where: { id: userId }, data: { onboarding_state: active?'READY':'ACCESS_PENDING',onboarding_data:{...(state.data as any),migration_choice:choice} } });
      await tx.auditLog.create({ data: { ...scope, action: active?'ONBOARDING_READY':'ONBOARDING_ACCESS_PENDING', details: JSON.stringify({ choice }) } });
    });
    const current=await this.state(userId);
    if(current.state!=='READY')return current;
    return { ...(await this.auth.loginUser(userId, context)), next: choice === 'IMPORT' ? '/retail/more/import' : '/retail/home' };
  }
}
