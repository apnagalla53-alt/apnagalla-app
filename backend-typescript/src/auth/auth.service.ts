import { Injectable, UnauthorizedException, OnModuleInit, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { throttleLogin } from './login-throttle';
import { EntitlementService } from '../common/entitlement.service';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly invalidPasswordHash = bcrypt.hash(randomBytes(32).toString('hex'), 12);
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private entitlements: EntitlementService,
  ) {}

  async onModuleInit() {
    await this.bootstrapAdminUser();
  }

  async bootstrapAdminUser() {
    // Check if the admin user exists
    let admin = await this.prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (!admin && process.env.NODE_ENV !== 'production' && process.env.TENANT_BOOTSTRAP_PASSWORD) {
      const hashedPassword = await bcrypt.hash(process.env.TENANT_BOOTSTRAP_PASSWORD, 12);
      
      const org = await this.prisma.organization.upsert({
        where: { code: 'DEFAULT' },
        update: {},
        create: {
          name: 'Default Organization',
          code: 'DEFAULT',
          is_active: true,
        }
      });

      const company = await this.prisma.company.upsert({
        where: { uix_companies_org_code: { organization_id: org.id, code: 'DEF-COMP' } },
        update: {},
        create: {
          organization_id: org.id,
          code: 'DEF-COMP',
          legal_name: 'Default Company Ltd',
          trade_name: 'Default Company',
          gstin: 'GSTIN1234567890',
        }
      });

      const branch = await this.prisma.branch.upsert({
        where: { uix_branches_company_code: { company_id: company.id, code: 'HQ' } },
        update: {},
        create: {
          company_id: company.id,
          name: 'Main Branch',
          code: 'HQ',
        }
      });

      const role = await this.prisma.role.upsert({
        where: { uix_roles_org_name: { organization_id: org.id, name: 'ADMIN' } },
        update: {},
        create: {
          organization_id: org.id,
          name: 'ADMIN',
          description: 'Administrator',
          system_role: true,
        }
      });

      // Give admin all permissions
      const allPermissions = [
        'sales.read', 'sales.write', 'purchase.read', 'purchase.write', 
        'inventory.read', 'inventory.write', 'accounting.read', 'accounting.write'
      ];
      
      for (const p of allPermissions) {
        await this.prisma.permission.upsert({
          where: { code: p },
          update: {},
          create: {
            code: p,
            description: p,
            module: p.split('.')[0],
            resource: p.split('.')[0],
            action: p.split('.')[1]
          }
        });

        const perm = await this.prisma.permission.findUnique({ where: { code: p } });
        if (perm) {
          await this.prisma.rolePermission.upsert({
            where: { role_id_permission_id: { role_id: role.id, permission_id: perm.id } },
            update: {},
            create: {
              role_id: role.id,
              permission_id: perm.id,
              scope: 'ALL_COMPANIES'
            }
          });
        }
      }

      // Create User
      const adminUser = await this.prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
          organization_id: org.id,
          username: 'admin',
          password_hash: hashedPassword,
          display_name: 'System Administrator',
          is_active: true,
        }
      });

      await this.prisma.userRole.upsert({
        where: { user_id_role_id: { user_id: adminUser.id, role_id: role.id } },
        update: {},
        create: {
          user_id: adminUser.id,
          role_id: role.id,
          company_id: company.id,
          branch_id: branch.id,
        }
      });

    }
  }

  async login(username: string, pass: string, context: { ip?: string; userAgent?: string; deviceId?: string } = {}) {
    await throttleLogin(`tenant:${context.ip || 'local'}`);
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.is_active || user.is_locked || user.password_login_enabled === false) {
      await bcrypt.compare(pass, await this.invalidPasswordHash);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(pass, user.password_hash);
    if (!isMatch) {
      await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM users WHERE id=${user.id}::uuid FOR UPDATE`;
        const current = await tx.user.findUnique({ where: { id: user.id } });
        if (current) await tx.user.update({ where: { id: user.id }, data: { failed_login_count: { increment: 1 }, is_locked: current.is_locked || current.failed_login_count >= 9 } });
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.loginUser(user.id, context,user.password_hash);
  }

  /** Called only after password verification or server-verified external identity. */
  async loginUser(userId: string, context: { ip?: string; userAgent?: string; deviceId?: string } = {},verifiedPasswordHash?:string) {
    return this.prisma.runSystem(()=>this.issueVerifiedUserSession(userId,context,verifiedPasswordHash));
  }
  /** Rehydrate a verified existing session after website -> app navigation; never issues another session/token. */
  async sessionProfile(userId:string) {
    return this.prisma.runSystem(async()=>{
      const user=await this.prisma.user.findUnique({where:{id:userId},include:{roles:{include:{role:{include:{role_permissions:{include:{permission:true}}}}}}}});
      if(!user?.is_active||user.is_locked)throw new UnauthorizedException('Sign in again to continue.');
      const membership=user.roles[0],role=membership?.role;
      const company=membership?.company_id?await this.prisma.company.findUnique({where:{id:membership.company_id},include:{organization:true}}):null;
      const branch=membership?.branch_id?await this.prisma.branch.findUnique({where:{id:membership.branch_id}}):null;
      if(company&&(!company.organization.is_active||['SUSPENDED','CANCELLED','ARCHIVED'].includes(company.organization.status)))throw new UnauthorizedException('This shop is inactive. Contact the owner.');
      const now=new Date(),year=company?await this.prisma.financialYear.findFirst({where:{company_id:company.id,is_closed:false,start_date:{lte:now},end_date:{gte:now}},orderBy:{is_active:'desc'}}):null;
      return {user:{id:user.id,username:user.username,display_name:user.display_name,email:user.email,phone:user.phone,organization_id:user.organization_id,role:role?.name||'USER',permissions:role?.role_permissions.map(p=>p.permission.code)||[],must_change_password:user.must_change_password,onboarding_state:user.onboarding_state,is_platform:false},tenant_context:company&&branch?{organization_id:company.organization_id,organization_name:company.organization.name,company_id:company.id,company_name:company.trade_name||company.legal_name,branch_id:branch.id,branch_name:branch.name,financial_year_id:year?.id,financial_year_label:year?.label}:null};
    });
  }
  private async issueVerifiedUserSession(userId: string, context: { ip?: string; userAgent?: string; deviceId?: string } = {},verifiedPasswordHash?:string) {

    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: { include: { role_permissions: { include: { permission: true } } } } }
        }
      }
    });

    const user = userWithRoles;
    if (!user || !user.is_active || user.is_locked) throw new UnauthorizedException('Invalid credentials');
    if (user.must_change_password && user.temporary_password_expires_at && user.temporary_password_expires_at <= new Date()) {
      throw new UnauthorizedException('Your temporary password expired. Ask your shop administrator to issue a new one or use password recovery.');
    }

    const activeRole = userWithRoles?.roles[0]?.role;
    const permissions = activeRole?.role_permissions.map(rp => rp.permission.code) || [];

    const membership = userWithRoles?.roles[0];
    const company = membership?.company_id ? await this.prisma.company.findUnique({ where: { id: membership.company_id }, include: { organization: true } }) : null;
    const branch = membership?.branch_id ? await this.prisma.branch.findUnique({ where: { id: membership.branch_id } }) : null;
    const now = new Date();
    const financialYear = company ? await this.prisma.financialYear.findFirst({ where: { company_id: company.id, is_closed: false, start_date: { lte: now }, end_date: { gte: now } }, orderBy: { is_active: 'desc' } }) : null;

    if (company && (!company.organization.is_active || ['SUSPENDED', 'CANCELLED'].includes(company.organization.status))) {
      throw new UnauthorizedException('This shop is suspended or inactive. Contact the owner.');
    }
    const session = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${user.id}::uuid FOR UPDATE`;
      const current=await tx.user.findUniqueOrThrow({where:{id:user.id}});
      if(!current.is_active||current.is_locked||current.organization_id!==user.organization_id||current.password_hash!==user.password_hash||verifiedPasswordHash&&current.password_hash!==verifiedPasswordHash)throw new UnauthorizedException('Account changed during sign-in. Please sign in again.');
      if(user.organization_id){
        await tx.$queryRaw`SELECT id FROM organizations WHERE id=${user.organization_id}::uuid FOR UPDATE`;
        const effective=await this.entitlements.resolve(user.organization_id,tx);
        if(context.deviceId)await tx.session.updateMany({where:{user_id:user.id,device_id:context.deviceId,revoked_at:null},data:{revoked_at:now}});
        const devices=await tx.session.count({where:{user:{organization_id:user.organization_id},revoked_at:null,expires_at:{gt:now}}});
        const limit=Number((effective.limits as any).devices);
        if(limit>0&&devices>=limit)throw new ForbiddenException('This shop has reached its device limit. Ask the owner to revoke an old device or upgrade.');
      }
      await tx.user.update({ where: { id: user.id }, data: { last_login_at: now, last_active_at: now, failed_login_count: 0 } });
      return tx.session.create({ data: { user_id: user.id, expires_at: new Date(now.getTime() + 86400_000),
        device_id:context.deviceId,
        ip_address: context.ip?.slice(0, 45), user_agent: context.userAgent?.slice(0, 512) } });
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    const payload = { sub: user.id, username: user.username, sid: session.id, is_platform: false };
    return {
      access_token: await this.jwtService.signAsync(payload),
      tenant_context: company && branch ? {
        organization_id: company.organization_id, organization_name: company.organization.name,
        company_id: company.id, company_name: company.trade_name || company.legal_name,
        branch_id: branch.id, branch_name: branch.name,
        financial_year_id: financialYear?.id, financial_year_label: financialYear?.label,
      } : null,
      user: {
        id: user.id,
        username: user.username,
        name: user.display_name,
        display_name: user.display_name,
        role: activeRole?.name || 'USER',
        permissions: permissions,
        must_change_password: user.must_change_password,
        onboarding_state: user.onboarding_state,
        organization_id: user.organization_id,
        email:user.email,
        phone:user.phone,
      }
    };
  }
}
