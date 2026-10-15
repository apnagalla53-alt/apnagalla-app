import { Injectable, BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as os from 'os';
import { PrismaService } from '../database/prisma.service';
import { EntitlementService } from '../common/entitlement.service';
import { TenantActionDto, PlanDto, FeatureDto, SubscriptionPaymentDto, RefundPaymentDto, PlatformExpenseDto, AnnouncementDto, PlatformSettingsDto } from './platform.dto';
import { runtimeMetrics } from './runtime-metrics';
import { RETAIL_FEATURES, RETAIL_PLAN_DEFAULTS, defaultPlanFeatures } from '../common/retail-plan-catalog';
import { ReferralService } from '../auth/referral.service';
import { installLaunchPlanRevision } from './launch-plan-revision';

const userSelect = { id: true, username: true, display_name: true, email: true, phone: true, is_active: true,
  is_locked: true, last_login_at: true, last_active_at: true, organization_id: true, created_at: true, phone_verified_at:true, email_verified_at:true, password_login_enabled:true, must_change_password:true, onboarding_state:true };
export function validateLimits(limits: Record<string, number>) {
  for (const [key, value] of Object.entries(limits)) {
    if (!['users', 'staff', 'devices', 'branches', 'stock_locations', 'companies', 'storage_mb', 'assistant_queries', 'voice_queries'].includes(key) || !Number.isInteger(value) || value < (['staff','assistant_queries','voice_queries'].includes(key)?0:1) || value > 1_000_000) {
      throw new BadRequestException('Use supported integer subscription limits');
    }
  }
}
function publicTenant<T extends { tenant_number: number }>(org: T) { return { ...org, public_id: `EVX-${String(org.tenant_number).padStart(5, '0')}` }; }

@Injectable()
export class PlatformService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService, private readonly entitlements: EntitlementService, private readonly referrals: ReferralService) {}

  async onModuleInit() {
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('retail-commercial-plans-v1'))`;
      for (const [code,row] of Object.entries(RETAIL_FEATURES)) await tx.feature.upsert({where:{code},create:{code,name:row[0],description:row[2]},update:{}});
      for (const definition of RETAIL_PLAN_DEFAULTS) {
        // Never overwrite operator edits during startup.
        if(await tx.plan.findUnique({where:{code:definition.code}}))continue;
        const plan=await tx.plan.create({data:definition});
        const features=await tx.feature.findMany({where:{code:{in:defaultPlanFeatures(definition.code)}}});
        await tx.planFeature.createMany({data:features.map(f=>({plan_id:plan.id,feature_id:f.id}))});
      }
      const marker='RETAIL_COMMERCIAL_PLANS_V1';
      if(!await tx.platformSetting.findUnique({where:{key:marker}})) {
        const legacy=await tx.plan.findUnique({where:{code:'DEFAULT'},include:{plan_features:true}});
        const starter=await tx.plan.findUniqueOrThrow({where:{code:'STARTER'},include:{plan_features:true}});
        const tenants=legacy?await tx.organization.findMany({where:{plan_id:legacy.id},select:{id:true}}):[];
        const starterIds=new Set(starter.plan_features.map(f=>f.feature_id));
        // Preserve any legacy grants as explicit concessions; existing overrides win.
        for(const tenant of tenants)for(const f of legacy!.plan_features.filter(f=>!starterIds.has(f.feature_id))) {
          await tx.tenantEntitlement.upsert({where:{uix_tenant_entitlements:{organization_id:tenant.id,feature_id:f.feature_id}},create:{organization_id:tenant.id,feature_id:f.feature_id,is_enabled:true},update:{}});
        }
        if(legacy)await tx.organization.updateMany({where:{plan_id:legacy.id},data:{plan_id:starter.id}});
        await tx.platformSetting.create({data:{key:marker,value:{version:1,migrated_at:new Date().toISOString(),legacy_tenants:tenants.map(t=>t.id),policy:'Legacy grants retained as tenant overrides; legacy plan and assignments retained.'}}});
      }
      // Separate one-time commercial revision: preserves subsequent operator edits.
      const exportsMarker='RETAIL_EXPORT_ENTITLEMENTS_V1';
      if(!await tx.platformSetting.findUnique({where:{key:exportsMarker}})){
        for(const definition of RETAIL_PLAN_DEFAULTS){const plan=await tx.plan.findUnique({where:{code:definition.code}});if(!plan)continue;const exports=await tx.feature.findMany({where:{code:{in:defaultPlanFeatures(definition.code).filter(code=>code.startsWith('EXPORT_'))}}});await tx.planFeature.createMany({data:exports.map(f=>({plan_id:plan.id,feature_id:f.id})),skipDuplicates:true});}
        await tx.platformSetting.create({data:{key:exportsMarker,value:{version:1,installed_at:new Date().toISOString()}}});
      }
      await installLaunchPlanRevision(tx);
    },{timeout:30000});
  }

  async audit(tx: Prisma.TransactionClient, actor: string, action: string, resource: string, id?: string, details?: unknown) {
    return tx.platformAuditLog.create({ data: { user_id: actor, action, resource_type: resource, resource_id: id,
      details: details === undefined ? null : JSON.stringify(details) } });
  }

  async listTenants(query:any={}) {
    const ownerMatches=query.search?await this.prisma.user.findMany({where:{OR:[{display_name:{contains:String(query.search),mode:'insensitive'}},{email:{contains:String(query.search),mode:'insensitive'}},{phone:{contains:String(query.search)}}]},select:{organization_id:true},take:1000}):[];
    const rows = await this.prisma.organization.findMany({ include: { plan: true, subscription: true,
      companies: { select: { id: true, trade_name: true, city: true, state: true, phone: true } } },
      where:{...(query.access==='pending'&&{subscription:{is:{status:'PENDING'}}}),...(query.status&&{status:String(query.status) as any}),...(query.plan&&{plan:{code:String(query.plan)}}),...(query.search?{OR:[{name:{contains:String(query.search),mode:'insensitive'}},{code:{contains:String(query.search),mode:'insensitive'}},
        {id:{in:ownerMatches.map(u=>u.organization_id).filter((id):id is string=>!!id)}},
        {companies:{some:{phone:{contains:String(query.search)}}}},...(/^EVX-\d+$/i.test(String(query.search))?[{tenant_number:Number(String(query.search).slice(4))}]:[])]}:{})},
      take:Math.min(200,Math.max(1,Number(query.limit)||100)),skip:Math.max(0,Number(query.offset)||0),orderBy: { tenant_number: 'desc' } });
    const contacts=await this.prisma.user.findMany({where:{organization_id:{in:rows.map(r=>r.id)}},select:{...userSelect,google_subject:true,onboarding_data:true},orderBy:{created_at:'asc'}});
    return rows.map(org=>({...publicTenant(org),owner_contacts:contacts.filter(u=>u.organization_id===org.id).slice(0,5).map(({google_subject,...u})=>({...u,google_connected:!!google_subject}))}));
  }

  async getTenant(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id }, include: { plan: true, subscription: true,
      companies: { include: { branches: true } }, support_sessions: { where: { ended_at: null, expires_at: { gt: new Date() } } } } });
    if (!org) throw new NotFoundException('Tenant not found');
    const companyIds = org.companies.map(c => c.id);
    const paymentConfigs=await this.prisma.companyConfiguration.findMany({where:{company_id:{in:companyIds}},select:{payment_configuration:true}});
    const upiConfigured=paymentConfigs.some(c=>!!(c.payment_configuration as any)?.upi_id);
    const [users, sessions, effective, bills, items, parties, storage, payments, audit] = await Promise.all([
      this.prisma.user.findMany({ where: { organization_id: id }, select: { ...userSelect, google_subject:true, onboarding_data:true, roles: { select: { role: { select: { name: true } }, company_id: true, branch_id: true } } } }),
      this.prisma.session.findMany({ where: { user: { organization_id: id } }, select: { id: true, user_id: true, user_agent: true, ip_address: true, issued_at: true, expires_at: true, revoked_at: true, last_active_at: true }, orderBy: { issued_at: 'desc' }, take: 100 }),
      this.entitlements.resolve(id, this.prisma, companyIds[0]),
      this.prisma.salesInvoice.count({ where: { company_id: { in: companyIds } } }),
      this.prisma.item.count({ where: { company_id: { in: companyIds } } }),
      this.prisma.party.count({ where: { company_id: { in: companyIds } } }),
      this.prisma.attachment.aggregate({ where: { organization_id: id }, _sum: { file_size: true }, _count: true }),
      this.prisma.subscriptionPayment.findMany({ where: { organization_id: id }, orderBy: { paid_at: 'desc' } }),
      this.prisma.platformAuditLog.findMany({ where: { resource_id: id }, orderBy: { created_at: 'desc' }, take: 100,
        include: { user: { select: { display_name: true } } } }),
    ]);
    const [imports,referrals]=await Promise.all([this.prisma.retailImportJob.findMany({where:{company_id:{in:companyIds}},orderBy:{created_at:'desc'},take:100}),this.prisma.referralAttribution.findMany({where:{OR:[{referred_organization_id:id},{code:{organization_id:id}}]},include:{reward:true},take:100,orderBy:{created_at:'desc'}})]);
    return { ...publicTenant(org), users:users.map(({google_subject,...u})=>({...u,google_connected:!!google_subject})), sessions, effective, payments, audit, imports,referrals, upi_configured:upiConfigured,
      usage: { users: users.length, active_users: users.filter(u => u.is_active).length,
        devices: sessions.filter(s => !s.revoked_at && s.expires_at > new Date()).length,
        branches: org.companies.reduce((sum, c) => sum + c.branches.length, 0), bills, items, parties,
        attachments: storage._count, storage_bytes: storage._sum.file_size || 0 } };
  }

  async tenantAction(id: string, dto: TenantActionDto, actor: string) {
    if (dto.action === 'approve_access' && dto.reason.trim().length < 3) throw new BadRequestException('Enter a meaningful audit reason of at least 3 characters.');
    if (dto.limits) validateLimits(dto.limits);
    await this.prisma.$transaction(async tx => {
      if (dto.action === 'approve_access') await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${id}::uuid FOR UPDATE`;
      const org = await tx.organization.findUnique({ where: { id }, include: { subscription: true } });
      if (!org) throw new NotFoundException('Tenant not found');
      if(org.archived_at&&!['note','logout','support_end'].includes(dto.action))throw new BadRequestException('Restore the archived tenant before changing its access or subscription.');
      let result: unknown;
      switch (dto.action) {
        case 'approve_access': {
          if (org.subscription?.status !== 'PENDING') throw new BadRequestException('Access is no longer pending. Refresh this shop before making another change.');
          if (!dto.plan_id || !dto.free_days || dto.complimentary === undefined) throw new BadRequestException('Choose a plan, access duration and access type.');
          const plan = await tx.plan.findFirst({ where: { id: dto.plan_id, is_active: true, code: { in: ['STARTER','SMART','PRO'] } } });
          if (!plan) throw new NotFoundException('Active Starter, Smart or Pro plan not found');
          if (!dto.complimentary) {
            const payment = dto.payment_id && await tx.subscriptionPayment.findFirst({ where: { id: dto.payment_id, organization_id: id, status: 'PAID', plan_name: plan.name } });
            if (!payment || !payment.amount.plus(payment.tax).minus(payment.discount).gt(0) || !payment.refund_amount.eq(0) || dto.free_days > payment.period_months * 31) throw new BadRequestException('Record and verify an unrefunded payment for this shop and plan before granting paid access.');
          } else if (dto.payment_id) throw new BadRequestException('Complimentary access must not claim a payment.');
          const now = new Date();
          const expiry = new Date(now.getTime() + dto.free_days * 86400_000);
          await tx.organization.update({ where: { id }, data: { plan_id: plan.id, status: 'ACTIVE', is_active: true } });
          result = await tx.tenantSubscription.update({ where: { organization_id: id }, data: { start_date: now, expires_at: expiry, status: dto.complimentary ? 'COMPLIMENTARY' : 'ACTIVE', complimentary: dto.complimentary } });
          // Onboarding state resolves the active subscription on the next read.
          // Avoid locking user rows after the organization: code redemption locks users first.
          break;
        }
        case 'status':
          if (!dto.status) throw new BadRequestException('Choose a tenant status');
          result = await tx.organization.update({ where: { id }, data: { status: dto.status as any, is_active: !['SUSPENDED', 'CANCELLED'].includes(dto.status) } });
          if (['SUSPENDED', 'CANCELLED'].includes(dto.status)) await tx.session.updateMany({ where: { user: { organization_id: id }, revoked_at: null }, data: { revoked_at: new Date() } });
          break;
        case 'subscription': {
          if (!dto.plan_id && !dto.expires_at && !dto.free_days && dto.complimentary === undefined) throw new BadRequestException('Choose a plan, expiry, free days or complimentary status');
          if (dto.plan_id && !await tx.plan.findFirst({ where: { id: dto.plan_id, is_active: true, code:{in:['STARTER','SMART','PRO']} } })) throw new NotFoundException('Active Starter, Smart or Pro plan not found');
          if (dto.plan_id) await tx.organization.update({ where: { id }, data: { plan_id: dto.plan_id } });
          const now = new Date();
          const baseExpiry = org.subscription?.expires_at && org.subscription.expires_at > now ? org.subscription.expires_at : new Date(now.getTime() + (org.subscription ? 0 : 30 * 86400_000));
          const expiry = dto.expires_at ? new Date(dto.expires_at) : new Date(baseExpiry.getTime() + (dto.free_days || 0) * 86400_000);
          result = await tx.tenantSubscription.upsert({ where: { organization_id: id }, create: { organization_id: id,
            start_date: now, expires_at: expiry, status:dto.subscription_status||'ACTIVE', complimentary: dto.complimentary || dto.subscription_status==='COMPLIMENTARY' },
            update: { expires_at: expiry, status: dto.subscription_status||'ACTIVE', ...(dto.complimentary !== undefined && { complimentary: dto.complimentary }) } });
          if(['TRIAL','ACTIVE'].includes(org.status))await tx.organization.update({where:{id},data:{status:dto.subscription_status==='TRIAL'?'TRIAL':'ACTIVE'}});
          break;
        }
        case 'limits':
          if (!dto.limits) throw new BadRequestException('Limits are required');
          result = await tx.organization.update({ where: { id }, data: { limit_overrides: { ...(org.limit_overrides as object), ...dto.limits } } });
          break;
        case 'clear_limits': {
          const keys=dto.limit_keys||Object.keys(org.limit_overrides as object||{});
          const values={...(org.limit_overrides as Record<string,number>||{})};for(const key of keys){if(!['users','staff','devices','branches','stock_locations','companies','storage_mb','assistant_queries','voice_queries'].includes(key))throw new BadRequestException('Unknown limit');delete values[key];}
          result=await tx.organization.update({where:{id},data:{limit_overrides:values}});break;
        }
        case 'logout':
          result = await tx.session.updateMany({ where: { user: { organization_id: id }, revoked_at: null }, data: { revoked_at: new Date() } });
          break;
        case 'disable_user': case 'enable_user': case 'unlock_user':
          if (!dto.user_id || !await tx.user.findFirst({ where: { id: dto.user_id, organization_id: id } })) throw new NotFoundException('Tenant user not found');
          result = await tx.user.update({ where: { id: dto.user_id }, data: dto.action === 'unlock_user' ? { is_locked: false, failed_login_count: 0 } : { is_active: dto.action === 'enable_user' }, select: userSelect });
          if (dto.action === 'disable_user') await tx.session.updateMany({ where: { user_id: dto.user_id, revoked_at: null }, data: { revoked_at: new Date() } });
          break;
        case 'revoke_session':
          if (!dto.session_id) throw new BadRequestException('Choose a session');
          result = await tx.session.updateMany({ where: { id: dto.session_id, user: { organization_id: id }, revoked_at: null }, data: { revoked_at: new Date() } });
          if (!(result as { count: number }).count) throw new NotFoundException('Active tenant session not found');
          break;
        case 'feature': case 'clear_feature': {
          if (!dto.feature_code) throw new BadRequestException('Choose a feature');
          const feature = await tx.feature.findUnique({ where: { code: dto.feature_code } });
          if (!feature) throw new NotFoundException('Feature not found');
          if (dto.action === 'clear_feature') result = await tx.tenantEntitlement.deleteMany({ where: { organization_id: id, feature_id: feature.id } });
          else {
            if (dto.enabled === undefined) throw new BadRequestException('Feature enabled is required');
            result = await tx.tenantEntitlement.upsert({ where: { uix_tenant_entitlements: { organization_id: id, feature_id: feature.id } },
              create: { organization_id: id, feature_id: feature.id, is_enabled: dto.enabled }, update: { is_enabled: dto.enabled } });
          }
          break;
        }
        case 'note':
          result = await tx.organization.update({ where: { id }, data: { internal_notes: [...(Array.isArray(org.internal_notes) ? org.internal_notes : []),
            { text: dto.reason, actor, at: new Date().toISOString() }] } });
          break;
        case 'support_start':
          result = await tx.platformSupportSession.create({ data: { organization_id: id, platform_user_id: actor, reason: dto.reason,
            expires_at: new Date(Date.now() + 3600_000) } });
          break;
        case 'support_end':
          result = await tx.platformSupportSession.updateMany({ where: { organization_id: id, ...(dto.support_id && { id: dto.support_id }), ended_at: null }, data: { ended_at: new Date() } });
          break;
        default: throw new BadRequestException('Unknown tenant action');
      }
      // Whitelist audit metadata: never record password hashes or session tokens.
      await this.audit(tx, actor, `TENANT_${dto.action.toUpperCase()}`, 'Organization', id, { request: dto, previous_status: org.status, previous_plan_id: org.plan_id,previous_subscription:org.subscription?{status:org.subscription.status,expires_at:org.subscription.expires_at}:null });
      if (['status','subscription','approve_access'].includes(dto.action)) await this.referrals.refresh(tx,id);
    }, { isolationLevel: dto.action === 'approve_access' ? Prisma.TransactionIsolationLevel.ReadCommitted : Prisma.TransactionIsolationLevel.Serializable });
    return this.getTenant(id);
  }

  async plans() { return this.prisma.plan.findMany({ include: { plan_features: { include: { feature: true } } }, orderBy: { name: 'asc' } }); }
  async savePlan(dto: PlanDto, actor: string, id?: string) {
    if(!['STARTER','SMART','PRO'].includes(dto.code)) throw new BadRequestException('Only Starter, Smart and Pro are normal commercial plans. Use tenant feature/limit overrides for exceptions.');
    validateLimits(dto.limits);
    const definition=RETAIL_PLAN_DEFAULTS.find(p=>p.code===dto.code)!;
    const expected=defaultPlanFeatures(dto.code).sort(),requested=[...dto.feature_codes].sort();
    if(JSON.stringify(expected)!==JSON.stringify(requested)||dto.monthly_price!==definition.monthly_price||Object.entries(dto.limits).some(([key,value])=>!(key in definition.limits)||(definition.limits as any)[key]!==value))throw new BadRequestException('Launch prices, feature assignments and default limits are fixed. Use tenant feature/limit overrides for exceptional access.');
    return this.prisma.$transaction(async tx => {
      if (id && !await tx.plan.findUnique({ where: { id } })) throw new NotFoundException('Plan not found');
      const features = await tx.feature.findMany({ where: { code: { in: dto.feature_codes } } });
      if (new Set(dto.feature_codes).size !== features.length) throw new BadRequestException('Unknown or duplicate feature code');
      const data = { ...definition, is_active: dto.is_active ?? true };
      const plan = id ? await tx.plan.update({ where: { id }, data }) : await tx.plan.create({ data });
      await tx.planFeature.deleteMany({ where: { plan_id: plan.id } });
      if (features.length) await tx.planFeature.createMany({ data: features.map(f => ({ plan_id: plan.id, feature_id: f.id })) });
      await this.audit(tx, actor, id ? 'PLAN_UPDATE' : 'PLAN_CREATE', 'Plan', plan.id, dto);
      return plan;
    });
  }
  async features() { return this.prisma.feature.findMany({ orderBy: { name: 'asc' } }); }
  async saveFeature(dto: FeatureDto, actor: string) {
    return this.prisma.$transaction(async tx => {
      const feature = await tx.feature.upsert({ where: { code: dto.code }, create: dto, update: dto });
      await this.audit(tx, actor, 'FEATURE_ROLLOUT_UPDATE', 'Feature', feature.id, dto);
      return feature;
    });
  }
  async payments() { return this.prisma.subscriptionPayment.findMany({ include: { organization: { select: { name: true, tenant_number: true } } }, orderBy: { paid_at: 'desc' }, take: 500 }); }
  async recordPayment(dto: SubscriptionPaymentDto, actor: string) {
    if (dto.discount > dto.amount + dto.tax) throw new BadRequestException('Discount exceeds charge');
    return this.prisma.$transaction(async tx => {
      const org = await tx.organization.findUnique({ where: { id: dto.organization_id }, include: { plan: true } });
      if (!org) throw new NotFoundException('Tenant not found');
      if (dto.status === 'PAID' && new Date(dto.paid_at) > new Date()) throw new BadRequestException('Paid receipts cannot be future-dated');
      if (await tx.subscriptionPayment.findFirst({ where: { organization_id: org.id, reference: dto.reference } })) throw new BadRequestException('This tenant billing reference is already recorded');
      const payment = await tx.subscriptionPayment.create({ data: { ...dto, paid_at: new Date(dto.paid_at), plan_name: org.plan?.name || 'No plan' } });
      await this.audit(tx, actor, 'SUBSCRIPTION_PAYMENT', 'Organization', org.id, { payment_id: payment.id, ...dto });
      await this.referrals.refresh(tx,org.id);
      return payment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async refundPayment(id: string, dto: RefundPaymentDto, actor: string) {
    return this.prisma.$transaction(async tx => {
      const payment = await tx.subscriptionPayment.findUnique({ where: { id } });
      if (!payment) throw new NotFoundException('Subscription payment not found');
      if (payment.status !== 'PAID' || payment.refund_amount.plus(dto.amount).gt(payment.amount.plus(payment.tax).minus(payment.discount))) throw new BadRequestException('Refund exceeds the remaining paid amount');
      const result = await tx.subscriptionPayment.update({ where: { id }, data: { refund_amount: payment.refund_amount.plus(dto.amount), refund_at: new Date() } });
      await this.audit(tx, actor, 'SUBSCRIPTION_REFUND', 'Organization', payment.organization_id, { payment_id: id, ...dto });
      await this.referrals.refresh(tx,payment.organization_id);
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async expenses() { return this.prisma.platformExpense.findMany({ orderBy: { expense_date: 'desc' }, take: 500 }); }
  async recordExpense(dto: PlatformExpenseDto, actor: string) {
    return this.prisma.$transaction(async tx => {
      const expense = await tx.platformExpense.create({ data: { ...dto, expense_date: new Date(dto.expense_date), created_by: actor } });
      await this.audit(tx, actor, 'PLATFORM_EXPENSE_CREATE', 'PlatformExpense', expense.id, dto);
      return expense;
    });
  }
  async users() {
    return { tenant_users: await this.prisma.user.findMany({ select: userSelect, orderBy: { created_at: 'desc' }, take: 1000 }),
      platform_users: await this.prisma.platformUser.findMany({ select: { id: true, username: true, display_name: true, email: true, is_active: true, is_locked: true, last_active_at: true } }) };
  }
  async sessions() {
    const [tenant, platform] = await Promise.all([
      this.prisma.session.findMany({ orderBy: { issued_at: 'desc' }, take: 500, include: { user: { select: { username: true, display_name: true, organization_id: true } } } }),
      this.prisma.platformSession.findMany({ orderBy: { issued_at: 'desc' }, take: 100, include: { user: { select: { username: true, display_name: true } } } }),
    ]);
    return { tenant, platform };
  }
  async support() {
    const rows = await this.prisma.platformSupportSession.findMany({ orderBy: { started_at: 'desc' }, take: 200,
      include: { organization: { select: { name: true, tenant_number: true } } } });
    return rows.map(row=>({ ...row, status: row.ended_at?'ENDED':row.expires_at<new Date()?'EXPIRED':'ACTIVE' }));
  }
  async supportRecords(sessionId: string, kind: string, actor: string) {
    const session=await this.prisma.platformSupportSession.findFirst({where:{id:sessionId,platform_user_id:actor,ended_at:null,expires_at:{gt:new Date()}}});
    if(!session)throw new NotFoundException('Active support window not found');
    const companies=await this.prisma.company.findMany({where:{organization_id:session.organization_id},select:{id:true}});
    const scope={company_id:{in:companies.map(c=>c.id)}};let rows:unknown[];
    if(kind==='bills')rows=await this.prisma.salesInvoice.findMany({where:scope,orderBy:{document_date:'desc'},take:50,select:{id:true,document_number:true,document_date:true,status:true,grand_total:true,paid_amount:true,outstanding_amount:true,party:{select:{name:true}},lines:true}});
    else if(kind==='items')rows=await this.prisma.item.findMany({where:scope,take:100,select:{id:true,name:true,sku:true,is_active:true,default_sale_rate:true}});
    else if(kind==='purchases')rows=await this.prisma.purchaseInvoice.findMany({where:scope,orderBy:{document_date:'desc'},take:50,select:{id:true,document_number:true,document_date:true,status:true,grand_total:true,paid_amount:true,outstanding_amount:true,party:{select:{name:true}}}});
    else throw new BadRequestException('Support records must be bills, items or purchases');
    await this.prisma.$transaction(tx=>this.audit(tx,actor,'SUPPORT_RECORDS_READ','Organization',session.organization_id,{support_session_id:sessionId,kind,records:rows.length}));
    return {kind,rows,support_expires_at:session.expires_at};
  }
  async alerts() {
    const now=new Date();
    const tenants=await this.prisma.organization.findMany({ where:{subscription:{expires_at:{lte:new Date(now.getTime()+7*86400_000)}}},
      include:{subscription:true} });
    const latest=await this.prisma.platformBackup.findFirst({where:{verified_at:{not:null}},orderBy:{created_at:'desc'}});
    const backup_requests=await this.prisma.retailDataBackupRequest.findMany({where:{contacted_at:null},orderBy:{created_at:'desc'},take:100,include:{company:{select:{trade_name:true,legal_name:true,phone:true,organization_id:true}},user:{select:{display_name:true,phone:true}}}});
    return { backup_requests, alerts: tenants.map(t=>({ id:t.id, tenant_id:t.id, title:t.name, detail:t.subscription!.expires_at<now?'Subscription expired':'Subscription expires within 7 days', date:t.subscription!.expires_at })),
      backup:latest?{status:'VERIFIED_ARCHIVE',last_verified:latest.verified_at}:{status:'NO_VERIFIED_BACKUP',last_verified:null} };
  }
  async backupFollowup(id:string,actor:string) {
    return this.prisma.$transaction(async tx=>{
      const request=await tx.retailDataBackupRequest.findUnique({where:{id}});
      if(!request)throw new NotFoundException('Backup request not found');
      const updated=await tx.retailDataBackupRequest.update({where:{id},data:{contacted_at:new Date()}});
      await this.audit(tx,actor,'BACKUP_FOLLOWUP_RECORDED','RetailDataBackupRequest',id);
      return updated;
    });
  }
  async auditLogs() { return this.prisma.platformAuditLog.findMany({ orderBy: { created_at: 'desc' }, take: 500, include: { user: { select: { display_name: true } } } }); }

  async dashboard() {
    const now = new Date(); const today = new Date(now); today.setHours(0, 0, 0, 0);
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const [tenants, userCount, activeToday, activeWeek, online, payments, expenseTotals] = await Promise.all([
      this.prisma.organization.findMany({ include: { subscription: true, plan:true } }), this.prisma.user.count(),
      this.prisma.user.count({ where: { last_active_at: { gte: today } } }),
      this.prisma.user.count({ where: { last_active_at: { gte: new Date(now.getTime() - 7 * 86400_000) } } }),
      this.prisma.user.count({ where: { is_active: true, sessions: { some: { revoked_at: null, expires_at: { gt: now }, last_active_at: { gte: new Date(now.getTime() - 300_000) } } } } }),
      this.prisma.subscriptionPayment.findMany({ orderBy: { paid_at: 'desc' } }),
      this.prisma.platformExpense.aggregate({ _sum: { amount: true } }),
    ]);
    const paid = payments.filter(p => p.status === 'PAID');
    const net = (p: typeof payments[number]) => p.amount.plus(p.tax).minus(p.discount).minus(p.refund_amount).toNumber();
    const activeOrgs = new Set(tenants.filter(o => o.is_active && o.status === 'ACTIVE' && o.subscription && o.subscription.expires_at > now && !o.subscription.complimentary).map(o => o.id));
    const mrrOrg = new Set<string>(); let mrr = 0;
    for (const p of paid) {
      const end = new Date(p.paid_at); end.setMonth(end.getMonth() + p.period_months);
      if (!mrrOrg.has(p.organization_id) && activeOrgs.has(p.organization_id) && p.paid_at <= now && end > now) {
        mrr += p.amount.minus(p.discount).minus(Prisma.Decimal.min(p.refund_amount, p.amount.minus(p.discount))).toNumber() / p.period_months;
        mrrOrg.add(p.organization_id);
      }
    }
    return { total_tenants: tenants.length, active_tenants: tenants.filter(t => t.status === 'ACTIVE').length,
      paying_tenants: mrrOrg.size, new_tenants_this_month: tenants.filter(t=>t.created_at >= month).length,
      trial_tenants: tenants.filter(t => t.status === 'TRIAL' && t.subscription?.status === 'TRIAL').length, suspended_tenants: tenants.filter(t => t.status === 'SUSPENDED').length,
      cancelled_tenants: tenants.filter(t => t.status === 'CANCELLED').length, archived_tenants:tenants.filter(t=>t.status==='ARCHIVED').length,
      plan_distribution:Object.fromEntries(['STARTER','SMART','PRO'].map(code=>[code,tenants.filter(t=>!t.archived_at&&t.plan?.code===code).length])),
      expired_tenants: tenants.filter(t => t.subscription && t.subscription.expires_at < now).length,
      expiring_7_days: tenants.filter(t => t.subscription && t.subscription.expires_at >= now && t.subscription.expires_at <= new Date(now.getTime() + 7 * 86400_000)).length,
      total_users: userCount, active_today: activeToday, active_7_days: activeWeek, online_users: online,
      subscription_revenue: paid.reduce((sum, p) => sum + net(p), 0),
      revenue_this_month: paid.filter(p => p.paid_at >= month).reduce((sum, p) => sum + net(p), 0),
      pending_payments: payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount.plus(p.tax).minus(p.discount).toNumber(), 0),
      refunds: paid.reduce((sum, p) => sum + p.refund_amount.toNumber(), 0), platform_expenses: Number(expenseTotals._sum.amount || 0),
      mrr: Math.round(mrr * 100) / 100, arr: Math.round(mrr * 1200) / 100,
      metric_notes: { active_users: 'Distinct users with server-recorded requests; online requires an unrevoked session active within 5 minutes.',
        mrr: 'Latest paid, current billing period per active non-complimentary tenant, excluding tax and refunds; divided by actual billed months.',
        trial_conversion: 'Unavailable: historical trial cohort tracking is not configured.', churn: 'Unavailable: historical beginning-period customer cohorts are not configured.' } };
  }

  async infrastructure() {
    const start = performance.now(); let database: unknown;
    try {
      const rows = await this.prisma.$queryRaw<any[]>`SELECT current_database() AS name, version() AS version, pg_database_size(current_database())::text AS size_bytes,
        (SELECT count(*)::int FROM pg_stat_activity WHERE datname=current_database()) AS connections,
        (SELECT setting::int FROM pg_settings WHERE name='max_connections') AS max_connections,
        (SELECT numbackends FROM pg_stat_database WHERE datname=current_database()) AS active_backends`;
      database = { status: 'CONNECTED', ...rows[0], size_bytes: Number(rows[0].size_bytes), latency_ms: Math.round((performance.now() - start) * 100) / 100 };
    } catch { database = { status: 'UNAVAILABLE', message: 'Database health query failed' }; }
    const mem = process.memoryUsage();
    return { environment: process.env.NODE_ENV || 'development', version: process.env.APP_VERSION || 'local development (version not configured)',
      uptime_seconds: Math.floor(process.uptime()), node_version: process.version, database,
      process_memory_bytes: { rss: mem.rss, heap_used: mem.heapUsed, heap_total: mem.heapTotal },
      host_memory_bytes: { total: os.totalmem(), free: os.freemem() }, cpu_cores: os.cpus().length,
      process_cpu_seconds: process.cpuUsage().user / 1_000_000 + process.cpuUsage().system / 1_000_000,
      requests: runtimeMetrics.snapshot(), provider_metrics: { status: 'UNAVAILABLE', reason: 'Cloud CPU, disk, storage, PITR and billing adapters are not configured.' } };
  }
  async settings() { return (await this.prisma.platformSetting.findUnique({ where: { key: 'OPERATIONS' } }))?.value || { maintenance_mode: false, banner: '', signup_enabled: true }; }
  async saveSettings(dto: PlatformSettingsDto, actor: string) {
    return this.prisma.$transaction(async tx => {
      const { reason, force_login, ...value } = dto;
      const settings = await tx.platformSetting.upsert({ where: { key: 'OPERATIONS' }, create: { key: 'OPERATIONS', value }, update: { value } });
      if (force_login) await tx.session.updateMany({ where: { revoked_at: null }, data: { revoked_at: new Date() } });
      await this.audit(tx, actor, 'PLATFORM_OPERATIONS_UPDATE', 'PlatformSetting', undefined, dto);
      return settings.value;
    });
  }
  async announcements() { return this.prisma.platformAnnouncement.findMany({ orderBy: { starts_at: 'desc' } }); }
  async createAnnouncement(dto: AnnouncementDto, actor: string) {
    if (new Date(dto.ends_at) <= new Date(dto.starts_at)) throw new BadRequestException('Announcement end must follow start');
    return this.prisma.$transaction(async tx => {
      const row = await tx.platformAnnouncement.create({ data: { ...dto, starts_at: new Date(dto.starts_at), ends_at: new Date(dto.ends_at), created_by: actor } });
      await this.audit(tx, actor, 'ANNOUNCEMENT_CREATE', 'PlatformAnnouncement', row.id, dto);
      return row;
    });
  }
}
