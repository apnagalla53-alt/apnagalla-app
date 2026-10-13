import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface AccountPolicy {
  trial_enabled: boolean; trial_days: number | null; trial_plan: 'STARTER'|'SMART'|'PRO';
  permanent_delete_enabled: boolean; retention_days: number | null; delete_requires_backup: boolean;
}
export const ACCOUNT_POLICY_DEFAULTS: AccountPolicy = {
  trial_enabled: false, trial_days: null, trial_plan: 'SMART',
  permanent_delete_enabled: false, retention_days: null, delete_requires_backup: true,
};
@Injectable()
export class AccountPolicyService {
  constructor(private db: PrismaService) {}
  async get(client: any = this.db): Promise<AccountPolicy> {
    return { ...ACCOUNT_POLICY_DEFAULTS, ...((await client.platformSetting.findUnique({ where: { key: 'ACCOUNT_POLICY' } }))?.value || {}) };
  }
  async signupAllowed(client: any = this.db) {
    const operations = (await client.platformSetting.findUnique({ where: { key: 'OPERATIONS' } }))?.value;
    if (operations?.signup_enabled === false) throw new BadRequestException('New account creation is temporarily unavailable. Existing accounts can still sign in.');
  }
  async save(policy: AccountPolicy, reason: string, actor: string) {
    if (policy.trial_enabled && (!Number.isInteger(policy.trial_days) || policy.trial_days! < 1 || policy.trial_days! > 365)) throw new BadRequestException('Configure trial duration between 1 and 365 days.');
    if (policy.permanent_delete_enabled && (!Number.isInteger(policy.retention_days) || policy.retention_days! < 0 || policy.retention_days! > 3650)) throw new BadRequestException('Configure the retention period before enabling deletion.');
    return this.db.$transaction(async tx => {
      const previous = await this.get(tx);
      await tx.platformSetting.upsert({ where: { key: 'ACCOUNT_POLICY' }, create: { key: 'ACCOUNT_POLICY', value: policy as any }, update: { value: policy as any } });
      await tx.platformAuditLog.create({ data: { user_id: actor, action: 'ACCOUNT_POLICY_UPDATE', resource_type: 'PlatformSetting', details: JSON.stringify({ previous, policy, reason }) } });
      return policy;
    });
  }
}
