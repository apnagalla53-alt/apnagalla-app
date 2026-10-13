import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReferralService {
  constructor(private db: PrismaService) {}
  private async activeCampaign(tx: any) {
    const now = new Date();
    return tx.referralCampaign.findFirst({ where: { enabled: true, starts_at: { lte: now }, OR: [{ ends_at: null }, { ends_at: { gt: now } }] }, orderBy: { created_at: 'desc' } });
  }
  async attachSignup(tx: any, user: any, code?: string) {
    if (!code) return;
    const referral = await tx.referralCode.findUnique({ where: { code: code.trim().toUpperCase() }, include: { user: true, organization: true } });
    if (!referral?.enabled || !referral.organization?.is_active || referral.organization.archived_at) throw new BadRequestException('This referral code is not available. Remove it or check the code.');
    if (referral.user_id === user.id || referral.organization_id === user.organization_id || (user.phone_e164 && user.phone_e164 === referral.user?.phone_e164)) throw new BadRequestException('Self referrals are not permitted.');
    if (await tx.referralAttribution.findUnique({ where: { referred_user_id: user.id } })) return;
    const campaign = await this.activeCampaign(tx);
    const snapshot = campaign ? { id: campaign.id, name: campaign.name, type: campaign.reward_type, value: String(campaign.reward_value), qualification: campaign.qualification, active_days: campaign.active_days, rules: campaign.rules } : { type: 'TRACKING_ONLY', value: '0', qualification: 'SIGNED_UP', active_days: 0, rules: 'Referral tracking only. No reward campaign is configured.' };
    await tx.referralAttribution.create({ data: { code_id: referral.id, campaign_id: campaign?.id, referred_user_id: user.id, campaign_snapshot: snapshot } });
  }
  async attachBusiness(tx: any, userId: string, organizationId: string) {
    const attribution = await tx.referralAttribution.findUnique({ where: { referred_user_id: userId } });
    if (!attribution) return;
    const ref = await tx.referralCode.findUnique({ where: { id: attribution.code_id } });
    if (ref?.organization_id === organizationId) throw new BadRequestException('Self referrals are not permitted.');
    await tx.referralAttribution.update({ where: { id: attribution.id }, data: { referred_organization_id: organizationId } });
  }
  async refresh(tx: any, organizationId: string) {
    const event = await tx.referralAttribution.findUnique({ where: { referred_organization_id: organizationId } });
    if (!event || ['REWARDED','REJECTED'].includes(event.status)) return;
    const org = await tx.organization.findUnique({ where: { id: organizationId }, include: { plan: true, subscription: true } });
    if (!org) return;
    const payments = await tx.subscriptionPayment.findMany({ where: { organization_id: organizationId, status: 'PAID' }, orderBy: { paid_at: 'asc' } });
    const paid = payments.find((p: any) => Number(p.amount) + Number(p.tax) - Number(p.discount) - Number(p.refund_amount) > 0);
    const realPaid = paid && Number(paid.amount) + Number(paid.tax) - Number(paid.discount) - Number(paid.refund_amount) > 0;
    const snapshot = event.campaign_snapshot as any;
    let continuousSince=paid?.paid_at?.getTime()||Date.now();
    if(paid&&snapshot.qualification==='ACTIVE_DAYS'){
      const transitions=await tx.platformAuditLog.findMany({where:{resource_id:organizationId,action:{in:['TENANT_STATUS','TENANT_ARCHIVE','TENANT_RESTORE','TENANT_SUBSCRIPTION']},created_at:{gte:paid.paid_at}},orderBy:{created_at:'asc'},select:{action:true,created_at:true,details:true}});
      for(const transition of transitions){let details:any={};try{details=JSON.parse(transition.details||'{}');}catch{continuousSince=Date.now();continue;}
       const status=details.request?.status||details.status;
       if(transition.action==='TENANT_ARCHIVE'||['SUSPENDED','CANCELLED','ARCHIVED'].includes(status))continuousSince=Date.now();
       if(transition.action==='TENANT_RESTORE'||transition.action==='TENANT_STATUS'&&['ACTIVE','TRIAL'].includes(status))continuousSince=transition.created_at.getTime();
       if(transition.action==='TENANT_SUBSCRIPTION'&&details.previous_subscription?.expires_at&&new Date(details.previous_subscription.expires_at)<transition.created_at)continuousSince=transition.created_at.getTime();
      }
    }
    const active = org.is_active && !org.archived_at && ['ACTIVE','TRIAL'].includes(org.status) && org.subscription && ['ACTIVE','TRIAL','COMPLIMENTARY'].includes(org.subscription.status) && org.subscription.expires_at > new Date();
    const qualifying = snapshot.qualification === 'SIGNED_UP' || (realPaid && active && (snapshot.qualification !== 'ACTIVE_DAYS' || (Date.now() - continuousSince) >= Number(snapshot.active_days || 0) * 86400000));
    const qualified = active && qualifying;
    await tx.referralAttribution.update({ where: { id: event.id }, data: {
      selected_plan: org.plan?.code,
      status: qualified ? 'QUALIFIED' : realPaid ? 'SUBSCRIBED' : org.subscription?.status === 'TRIAL' ? 'TRIAL' : 'SIGNED_UP',
      converted_at: realPaid ? event.converted_at || new Date() : event.converted_at,
      qualified_at: qualified ? event.qualified_at || new Date() : null,
      reward_status: qualified && snapshot.type !== 'TRACKING_ONLY' ? 'PENDING' : 'NONE',
    } });
  }
  async ownerSummary(userId: string, organizationId: string) {
    if(!await this.db.userRole.count({where:{user_id:userId,user:{organization_id:organizationId,is_active:true},role:{organization_id:organizationId,name:{in:['TENANT_ADMIN','OWNER','ADMIN']}}}}))throw new ForbiddenException('Only a business owner can manage referral invitations.');
    const code = await this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`referral-owner:${organizationId}`}))`;
      const org = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!org?.is_active || org.archived_at) throw new BadRequestException('This business is not eligible for new referral invitations.');
      const existing = await tx.referralCode.findUnique({ where: { organization_id: organizationId } });
      if (existing) return existing;
      const campaign = await this.activeCampaign(tx);
      return tx.referralCode.create({ data: { code: 'EVX-' + randomBytes(6).toString('hex').toUpperCase(), user_id: userId, organization_id: organizationId, campaign_id: campaign?.id } });
    });
    const events = await this.db.referralAttribution.findMany({ where: { code_id: code.id }, orderBy: { created_at: 'desc' }, take: 100, include: { referred_organization: { select: { name: true } }, reward: true } });
    const campaign = await this.activeCampaign(this.db);
    const totals = await this.db.referralAttribution.groupBy({ by: ['status'], where: { code_id: code.id }, _count: true });
    const base = process.env.PUBLIC_APP_URL || process.env.FRONTEND_ORIGIN || '';
    return { code: code.code, share_path: '/signup?ref=' + encodeURIComponent(code.code), share_url: base ? base.replace(/\/$/,'') + '/signup?ref=' + encodeURIComponent(code.code) : null,
      campaign: campaign ? { name: campaign.name, reward_type: campaign.reward_type, reward_value: campaign.reward_value, qualification: campaign.qualification, active_days: campaign.active_days, rules: campaign.rules } : { reward_type: 'TRACKING_ONLY', rules: 'Referral tracking only. No reward campaign is configured.' },
      entries: events.map(e => ({ id: e.id, shop: e.referred_organization?.name || 'Business setup pending', plan: e.selected_plan, status: e.status, reward_status: e.reward_status, date: e.created_at, reward: e.reward ? { type: e.reward.type, value: e.reward.value, status: e.reward.status } : null })),
      counts: { shops: totals.reduce((n,t) => n+t._count,0), qualified: totals.filter(t => ['QUALIFIED','REWARDED'].includes(t.status)).reduce((n,t) => n+t._count,0), rewards: await this.db.referralReward.count({ where: { attribution: { code_id: code.id } } }) },
      page_limit: 100,
    };
  }
  async campaigns() { return this.db.referralCampaign.findMany({ orderBy: { created_at: 'desc' }, take: 100 }); }
  async saveCampaign(dto: any, actor: string, id?: string) {
    const { reason, ...definition } = dto;
    if (definition.ends_at && new Date(definition.ends_at) <= new Date(definition.starts_at)) throw new BadRequestException('Campaign expiry must follow its start.');
    if (definition.reward_type === 'SUBSCRIPTION_DAYS' && (!Number.isInteger(definition.reward_value) || definition.reward_value < 1 || definition.reward_value > 365)) throw new BadRequestException('Subscription reward must be 1–365 whole days.');
    if (definition.reward_type === 'TRACKING_ONLY') definition.reward_value = 0;
    else if (!(definition.reward_value > 0)) throw new BadRequestException('A reward must have a positive value.');
    if (definition.qualification === 'ACTIVE_DAYS' && !(definition.active_days > 0)) throw new BadRequestException('Configure the number of days after paid activation.');
    return this.db.$transaction(async tx => {
      const data = { ...definition, starts_at: new Date(definition.starts_at), ends_at: definition.ends_at ? new Date(definition.ends_at) : null };
      const row = id ? await tx.referralCampaign.update({ where: { id }, data }) : await tx.referralCampaign.create({ data });
      await tx.platformAuditLog.create({ data: { user_id: actor, action: id ? 'REFERRAL_CAMPAIGN_UPDATE' : 'REFERRAL_CAMPAIGN_CREATE', resource_type: 'ReferralCampaign', resource_id: row.id, details: JSON.stringify({ reason, definition }) } });
      return row;
    });
  }
  async list(query: any = {}) {
    const events = await this.db.referralAttribution.findMany({ orderBy: { created_at: 'desc' }, take: Math.min(200, Math.max(1, Number(query.limit) || 50)), skip: Math.max(0, Number(query.offset) || 0),
      where: query.status ? { status: String(query.status) } : undefined,
      include: { code: { include: { organization: { select: { name: true, tenant_number: true } } } }, referred_organization: { select: { name: true, tenant_number: true } }, reward: true } });
    const counts = await this.db.referralAttribution.groupBy({ by: ['status'], _count: true });
    return { rows: events, metrics: Object.fromEntries(counts.map(c => [c.status, c._count])), invites: await this.db.referralCode.count(), rewards: await this.db.referralReward.count() };
  }
  async review(id: string, dto: { action: 'refresh'|'approve'|'reject'; reason: string; reference?: string }, actor: string) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM referral_attributions WHERE id=${id}::uuid FOR UPDATE`;
      let event = await tx.referralAttribution.findUnique({ where: { id }, include: { code: true, reward: true } });
      if (!event) throw new NotFoundException('Referral not found.');
      if (dto.action === 'refresh' && event.referred_organization_id) await this.refresh(tx, event.referred_organization_id);
      if (dto.action === 'reject') {
        if (event.reward) throw new ConflictException('An issued reward requires a separately reviewed reversal; it cannot be rejected silently.');
        await tx.referralAttribution.update({ where: { id }, data: { status: 'REJECTED', reward_status: 'REJECTED', rejected_reason: dto.reason } });
      }
      if (dto.action === 'approve') {
        if (event.reward) throw new ConflictException('This referral reward was already recorded.');
        if (event.referred_organization_id) await this.refresh(tx, event.referred_organization_id);
        event = await tx.referralAttribution.findUniqueOrThrow({ where: { id }, include: { code: true, reward: true } });
        if (event.status !== 'QUALIFIED' || !event.code.organization_id || event.code.organization_id === event.referred_organization_id) throw new BadRequestException('This referral has not qualified for a reward.');
        const policy = event.campaign_snapshot as any;
        const beneficiary = await tx.organization.findUnique({ where: { id: event.code.organization_id } });
        if (!beneficiary?.is_active || beneficiary.archived_at) throw new BadRequestException('The referring business must be active to receive a reward.');
        if (policy.type === 'TRACKING_ONLY') throw new BadRequestException('This referral only tracks invitations; it has no reward.');
        if (policy.type === 'FIXED_REWARD' && !dto.reference) throw new BadRequestException('Record the actual manual payout reference. No automatic payout provider is configured.');
        if (policy.type === 'SUBSCRIPTION_DAYS') {
          const sub = await tx.tenantSubscription.findUnique({ where: { organization_id: event.code.organization_id } });
          if (!sub) throw new BadRequestException('The referring business needs a subscription record.');
          const base = Math.max(Date.now(), sub.expires_at.getTime());
          await tx.tenantSubscription.update({ where: { organization_id: sub.organization_id }, data: { expires_at: new Date(base + Number(policy.value) * 86400000) } });
        }
        await tx.referralReward.create({ data: { attribution_id: id, beneficiary_organization_id: event.code.organization_id, type: policy.type, value: Number(policy.value), status: policy.type === 'ACCOUNT_CREDIT' ? 'CREDIT_RECORDED' : 'ISSUED', actor_id: actor, reference: dto.reference } });
        await tx.referralAttribution.update({ where: { id }, data: { status: 'REWARDED', reward_status: 'ISSUED' } });
      }
      await tx.platformAuditLog.create({ data: { user_id: actor, action: 'REFERRAL_' + dto.action.toUpperCase(), resource_type: 'ReferralAttribution', resource_id: id, details: JSON.stringify({ reason: dto.reason, reference: dto.reference || null }) } });
      return tx.referralAttribution.findUnique({ where: { id }, include: { reward: true } });
    }, { timeout: 30000 });
  }
}
