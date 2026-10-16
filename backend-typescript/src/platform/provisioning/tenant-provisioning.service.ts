import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { initializeExpenseCategories } from '../../retail/expenses/categories/default-expense-categories';
import { IsString, IsOptional, MinLength, MaxLength, IsEmail, IsUUID, IsDateString, IsInt, Min, Max, IsObject, IsIn } from 'class-validator';

export class ProvisionTenantDto {
  @IsString() @MinLength(1) @MaxLength(255)
  organizationName: string;
  @IsOptional() @IsString() @MaxLength(50) organizationCode?: string;
  @IsOptional() @IsString() @MaxLength(255) companyName?: string;
  @IsOptional() @IsString() @MaxLength(50) companyCode?: string;
  @IsOptional() @IsString() @MaxLength(255) branchName?: string;
  @IsOptional() @IsString() @MaxLength(50) branchCode?: string;
  @IsOptional() @IsEmail() @MaxLength(255)
  adminEmail?: string;
  @IsString() @MinLength(1) @MaxLength(255)
  adminName: string;
  @IsString() @MinLength(8) @MaxLength(255)
  adminPassword: string;
  @IsOptional() @IsUUID()
  planId?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) state?: string;
  @IsOptional() @IsString() @MaxLength(100) businessType?: string;
  @IsOptional() @IsString() @MaxLength(2000) address?: string;
  @IsOptional() @IsString() @MaxLength(10) postalCode?: string;
  @IsOptional() @IsIn(['ACTIVE','TRIAL']) subscriptionStatus?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(2000) reason?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10000) userLimit?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10000) deviceLimit?: number;
}

export interface InviteOwnerDto {
  organizationId: string;
  email: string;
  name: string;
}

@Injectable()
export class TenantProvisioningService {
  private readonly logger = new Logger(TenantProvisioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  async provisionTenant(dto: ProvisionTenantDto, actor?: string, verifiedOwnerId?: string, afterProvision?: (tx:Prisma.TransactionClient, context:{organization:any;company:any;user:any})=>Promise<void>) {
    return this.prisma.runSystem(()=>this.provisionTrustedTenant(dto,actor,verifiedOwnerId,afterProvision));
  }
  private async provisionTrustedTenant(dto: ProvisionTenantDto, actor?: string, verifiedOwnerId?: string, afterProvision?: (tx:Prisma.TransactionClient, context:{organization:any;company:any;user:any})=>Promise<void>) {
    const operations=(await this.prisma.platformSetting.findUnique({where:{key:'OPERATIONS'}}))?.value as any;
    if (operations?.signup_enabled === false) throw new BadRequestException('New organization creation is temporarily disabled by Platform operations');
    const verifiedOwner = verifiedOwnerId ? await this.prisma.user.findUnique({where:{id:verifiedOwnerId}}) : null;
    if(verifiedOwnerId&&(!verifiedOwner?.is_active||verifiedOwner.organization_id||(!verifiedOwner.google_subject&&!verifiedOwner.phone_verified_at)))throw new BadRequestException('A verified new owner account is required.');
    const ownerUsername = verifiedOwner?.username || dto.adminEmail || dto.phone;
    if (!ownerUsername) throw new BadRequestException('Owner phone or email is required');
    const existingOrg = dto.organizationCode && await this.prisma.organization.findUnique({ where: { code: dto.organizationCode } });
    if (existingOrg) throw new ConflictException(`Organization code ${dto.organizationCode} is already taken`);

    const existingUser = await this.prisma.user.findUnique({
      where: { username: ownerUsername }
    });
    if (existingUser && existingUser.id !== verifiedOwnerId) throw new ConflictException('Owner phone or email is already in use');

    // Named commercial plans are provisioned once by the platform catalog.
    let planId = dto.planId;
    if (!planId) {
      const defaultPlan = await this.prisma.plan.findUnique({where:{code:'STARTER'}});
      if(!defaultPlan)throw new ServiceUnavailableException('Retail plans are not initialized');
      planId = defaultPlan.id;
    }
    const plan = await this.prisma.plan.findFirst({ where: { id: planId, is_active: true } });
    if (!plan) throw new NotFoundException('Active plan not found');
    if (!['STARTER','SMART','PRO'].includes(plan.code)) throw new BadRequestException('Choose Starter, Smart or Pro. Use tenant overrides for exceptions.');
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const trialPolicy=(await this.prisma.platformSetting.findUnique({where:{key:'ACCOUNT_POLICY'}}))?.value as any;
    if(dto.subscriptionStatus==='TRIAL'&&!dto.expiryDate&&(!trialPolicy?.trial_enabled||!trialPolicy?.trial_days))throw new BadRequestException('Configure trial duration or select an explicit trial expiry.');
    if(dto.subscriptionStatus==='TRIAL'&&!dto.reason)throw new BadRequestException('Record a reason for this trial/demo.');
    const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : new Date(startDate.getTime() + (dto.subscriptionStatus==='TRIAL'?trialPolicy.trial_days:30) * 86400_000);
    if (expiryDate <= startDate) throw new ConflictException('Subscription expiry must be after start');
    if(!verifiedOwnerId&&(dto.adminPassword.length<8||Buffer.byteLength(dto.adminPassword,'utf8')>72))throw new BadRequestException('Use at least 8 characters, up to 72 bytes.');
    const passwordHash = verifiedOwner?.password_hash || await bcrypt.hash(dto.adminPassword, 12);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        if(verifiedOwnerId){await tx.$queryRaw`SELECT id FROM users WHERE id=${verifiedOwnerId}::uuid FOR UPDATE`;const current=await tx.user.findUnique({where:{id:verifiedOwnerId}});if(!current?.is_active||current.organization_id)throw new ConflictException('Business setup is already completed for this account.');}
        // 1. Create Organization
        const org = await tx.organization.create({
          data: {
            name: dto.organizationName,
            code: dto.organizationCode || `EVX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            plan_id: planId,
            status: verifiedOwnerId || dto.subscriptionStatus==='TRIAL' ? 'TRIAL' : 'ACTIVE', business_type: dto.businessType,
            limit_overrides: { ...(dto.userLimit && { users: dto.userLimit }), ...(dto.deviceLimit && { devices: dto.deviceLimit }) },
            subscription: { create: { start_date: startDate, expires_at: expiryDate, status: verifiedOwnerId ? 'PENDING' : dto.subscriptionStatus || 'ACTIVE' } },
          }
        });

        // 2. Create Company
        const company = await tx.company.create({
          data: {
            organization_id: org.id,
            trade_name: dto.companyName || dto.organizationName,
            code: dto.companyCode || 'SHOP',
            legal_name: dto.companyName || dto.organizationName,
            city: dto.city, state: dto.state, phone: dto.phone, email: dto.adminEmail, address:dto.address, postal_code:dto.postalCode,
          }
        });

        // 3. Create Branch
        const branch = await tx.branch.create({
          data: {
            company_id: company.id,
            name: dto.branchName || 'Main Shop',
            code: dto.branchCode || 'HQ',
          }
        });

        // 4. Create Role (Tenant Admin)
        const role = await tx.role.create({
          data: {
            name: 'TENANT_ADMIN',
            description: 'Tenant Administrator',
            organization_id: org.id,
            system_role: false,
          }
        });

        // 5. Create Permissions for Role
        const permissionsList = ['sales.read', 'sales.write', 'purchase.read', 'purchase.create', 'purchase.post', 'purchase.reverse',
          'inventory.read', 'inventory.adjust', 'inventory.transfer', 'accounting.read', 'accounting.write',
          'pos.sale.create', 'pos.return.create', 'pos.shift.read', 'pos.shift.open', 'pos.shift.close',
          'retail.settings', 'retail.staff', 'retail.backup', 'retail.export', 'retail.discount'];
        
        for (const code of permissionsList) {
          const perm = await tx.permission.upsert({
            where: { code },
            update: {},
            create: {
              code,
              module: 'CORE',
              resource: 'ALL',
              action: 'ALL',
              description: code,
            }
          });
          await tx.rolePermission.create({
            data: {
              role_id: role.id,
              permission_id: perm.id
            }
          });
        }

        // 6. Create Admin User
        const user = verifiedOwnerId ? await tx.user.update({where:{id:verifiedOwnerId},data:{organization_id:org.id,onboarding_state:'PLAN_REQUIRED',roles:{create:{role_id:role.id,company_id:company.id,branch_id:branch.id}}}}) : await tx.user.create({
          data: {
            email: dto.adminEmail,
            username: ownerUsername,
            display_name: dto.adminName,
            phone: dto.phone,
            password_hash: passwordHash,
            ...(process.env.NODE_ENV==='production'?{must_change_password:true,temporary_password_expires_at:new Date(Date.now()+24*3600_000)}:{}),
            organization_id: org.id,
            roles: {
              create: [
                {
                  role_id: role.id,
                  company_id: company.id,
                  branch_id: branch.id
                }
              ]
            }
          }
        });

        const godown = await tx.godown.create({ data: { branch_id: branch.id, code: 'MAIN', name: 'Shop Stock' } });
        await tx.unit.create({ data: { company_id: company.id, code: 'PCS', name: 'Pieces' } });
        const year = startDate.getMonth() >= 3 ? startDate.getFullYear() : startDate.getFullYear() - 1;
        const financialYear = await tx.financialYear.create({ data: { company_id: company.id, label: `${year}-${year+1}`,
          start_date: new Date(`${year}-04-01`), end_date: new Date(`${year+1}-03-31`), is_active: true } });
        const ledgerIds: Record<string, string> = {};
        for (const [code, name, type, normal] of [
          ['CASH_IN_HAND', 'Cash in Hand', 'ASSET', 'DEBIT'], ['DEFAULT_BANK', 'Default Bank', 'ASSET', 'DEBIT'],
          ['SALES_REVENUE', 'Sales Revenue', 'REVENUE', 'CREDIT'], ['OUTPUT_GST', 'Output GST', 'LIABILITY', 'CREDIT'],
          ['DIR-EXP', 'Direct Expenses', 'EXPENSE', 'DEBIT'], ['PURCH', 'Purchase Account', 'EXPENSE', 'DEBIT'],
          ['OWNER_CAPITAL', 'Owner Capital', 'EQUITY', 'CREDIT'],
        ]) {
          const ledger = await tx.ledgerAccount.create({ data: { company_id: company.id, branch_id: branch.id, code, name,
            account_type: type, normal_balance: normal, is_system: true } });
          ledgerIds[code] = ledger.id;
        }
        await tx.companyConfiguration.create({ data: { company_id: company.id, default_branch_id: branch.id,
          default_cash_ledger_id: ledgerIds.CASH_IN_HAND, default_bank_ledger_id: ledgerIds.DEFAULT_BANK } });
        await tx.retailCapabilitySettings.create({ data: { company_id: company.id } });
        await initializeExpenseCategories(tx, org.id, company.id, branch.id);
        if(afterProvision)await afterProvision(tx,{organization:org,company,user});
        if (actor) await tx.platformAuditLog.create({ data: { user_id: actor, action: 'TENANT_PROVISION', resource_type: 'Organization', resource_id: org.id,
          details: JSON.stringify({ owner_id: user.id, plan_id: plan.id, company_id: company.id, subscription_expiry: expiryDate.toISOString(), reason: dto.reason || 'Platform tenant provisioning' }) } });

        return {
          organization: org,
          company: company,
          branch: branch,
          godown, financialYear,
          user: { id: user.id, username: user.username, display_name: user.display_name, email: user.email, phone: user.phone },
        };
      }, {
        maxWait: 5000,
        timeout: 10000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });

      this.logger.log(`Successfully provisioned tenant ${result.organization.id}`);
      return result;
    } catch (e: any) {
      this.logger.error(JSON.stringify({event:'tenant_provisioning_failed',error_type:e?.constructor?.name||'Error'}));
      throw e;
    }
  }

  async inviteOwner(dto: InviteOwnerDto) {
    throw new ServiceUnavailableException('Owner invitations are not configured. Create the owner through audited tenant provisioning.');
  }
}
