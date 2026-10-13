import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { jwtSecret } from '../../auth/jwt-secret';
import { validateTenantBoundary } from '../tenant-boundary';
import {throttleOperation} from '../operation-throttle';
import {requestToken,verifyCookieCsrf} from '../../auth/browser-session';
import { EntitlementService } from '../entitlement.service';

import { SetMetadata } from '@nestjs/common';
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const requestedCompanyId = request.headers['x-company-id'];
    const requestedBranchId = request.headers['x-branch-id'];

    const token = requestToken(request);
    let payload;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: jwtSecret(), algorithms:['HS256']
      });
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const userId = payload.sub;
    if (payload.is_platform) throw new UnauthorizedException('A shop session is required');

    // Fetch user and active roles
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                role_permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user || !user.is_active || user.is_locked) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const now = new Date();
    const session = payload.sid && await this.prisma.session.findFirst({ where: { id: payload.sid, user_id: user.id, revoked_at: null, expires_at: { gt: now } } });
    if (!session) throw new UnauthorizedException('Session expired or revoked. Please sign in again.');
    verifyCookieCsrf(request,session.id);
    const authPath=(request.path||'').replace(/^\/api\/v1/,'');
    const lifecycle=authPath.startsWith('/auth/')||authPath.startsWith('/retail/account');
    if(user.onboarding_state&&user.onboarding_state!=='READY'&&!lifecycle)throw new ForbiddenException({code:'ONBOARDING_REQUIRED',message:'Finish your business setup before using the shop.'});
    if(user.must_change_password&&user.temporary_password_expires_at&&user.temporary_password_expires_at<=now)throw new UnauthorizedException('Temporary password expired. Request a new password.');
    if(user.must_change_password&&!['/auth/password/change','/auth/logout'].includes(authPath))throw new ForbiddenException('Change your temporary password before using your shop.');
    if (now.getTime() - session.last_active_at.getTime() > 60_000) {
      await this.prisma.$transaction([
        this.prisma.session.update({ where: { id: session.id }, data: { last_active_at: now } }),
        this.prisma.user.update({ where: { id: user.id }, data: { last_active_at: now } }),
      ]);
    }

    // Determine authorization context
    // We strictly validate requestedCompanyId against the user's actual memberships
    let authorizedRole = null;

    if (requestedCompanyId) {
      // Find role for this specific company
      authorizedRole = user.roles.find(r => r.company_id === requestedCompanyId);
      if (!authorizedRole) {
        throw new ForbiddenException('Access denied to this company');
      }
    } else {
      // Default to their first role if none requested
      authorizedRole = user.roles[0];
    }

    if (!authorizedRole) {
      throw new ForbiddenException('User has no assigned roles/companies');
    }

    // Validate Branch
    if (requestedBranchId && authorizedRole.branch_id && authorizedRole.branch_id !== requestedBranchId) {
      // If the role is branch-specific, they cannot access a different branch
      // (Unless we have logic for 'ALL_BRANCHES', but keeping it strict for now)
      throw new ForbiddenException('Access denied to this branch');
    }

    const activeCompanyId = authorizedRole.company_id;
    if (!activeCompanyId) throw new ForbiddenException('No shop is assigned to this membership');
    const activeBranchId = requestedBranchId || authorizedRole.branch_id; // Use requested if allowed, else default

    const company = await this.prisma.company.findUnique({ where: { id: activeCompanyId }, include: { organization: { include: { subscription: true } } } });
    if (!company || company.organization_id !== user.organization_id || (!lifecycle&&(!company.is_active || !company.organization.is_active || ['SUSPENDED', 'CANCELLED'].includes(company.organization.status)))) {
      throw new ForbiddenException('Shop access is inactive or suspended');
    }
    this.prisma.authorizeTenant(activeCompanyId);
    const subscription=company.organization.subscription;
    const expiredRead=['GET','HEAD'].includes(request.method)&&subscription&&subscription.expires_at<now&&['ACTIVE','TRIAL','COMPLIMENTARY','EXPIRED'].includes(subscription.status);
    if (!lifecycle&&!expiredRead&&company.organization.subscription && (company.organization.subscription.expires_at < now || !['ACTIVE','TRIAL','COMPLIMENTARY'].includes(company.organization.subscription.status))) {
      throw new ForbiddenException('Your subscription expired or is inactive. Contact the owner to renew.');
    }
    if (activeBranchId && !await this.prisma.branch.findFirst({ where: { id: activeBranchId, company_id: activeCompanyId, is_active: true } })) {
      throw new ForbiddenException('Access denied to this branch');
    }
    const financialYearId = request.headers['x-financial-year-id'];
    if (financialYearId && !await this.prisma.financialYear.findFirst({ where: { id: financialYearId, company_id: activeCompanyId } })) {
      throw new ForbiddenException('Access denied to this financial year');
    }
    const operations=(await this.prisma.platformSetting.findUnique({where:{key:'OPERATIONS'}}))?.value as any;
    if (operations?.maintenance_mode && !['GET','HEAD','OPTIONS'].includes(request.method) && !request.url.endsWith('/auth/logout')) {
      throw new ForbiddenException(operations.banner || 'Shop updates are paused for maintenance. Please try again later.');
    }

    // Flatten permissions
    const permissions = new Set<string>();
    authorizedRole.role.role_permissions.forEach((rp: any) => {
      permissions.add(rp.permission.code);
    });
    if(!lifecycle&&!['GET','HEAD','OPTIONS'].includes(request.method)&&!['ADMIN','OWNER','TENANT_ADMIN'].includes(authorizedRole.role.name)){
      await new EntitlementService(this.prisma).require(user.organization_id,['STAFF'],activeCompanyId);
    }

    // Inject secure server-side context
    request.user = { 
      id: user.id, 
      session_id: session.id,
      username: user.username, 
      role: authorizedRole.role.name, 
      system_role: authorizedRole.role.system_role,
      name: user.display_name,
      organization_id: user.organization_id,
      company_id: activeCompanyId,
      branch_id: activeBranchId,
      financial_year_id: financialYearId,
      permissions: Array.from(permissions)
    };

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(),context.getClass()]);
    let inferred: string | undefined;
    if (request.path.includes('/retail/')&&!authPath.startsWith('/retail/account')) {
      const route = request.path.split('/retail/')[1];
      const resource = route.split('/')[0];
      const module = ['items','needs','warranty'].includes(resource) ? 'inventory' : ['purchases','suppliers'].includes(resource) ? 'purchase'
        : ['expenses','customers','khata','galla'].includes(resource) ? 'accounting' : resource === 'reports' ? 'reports' : 'sales';
      inferred = module + (['GET','HEAD'].includes(request.method) ? '.read' : '.write');
      if (route.includes('/return')) inferred = 'sales.return';
      if (resource === 'settings') inferred = 'settings.write';
    }
    if(!inferred&&!required?.length) {
      const prefix=request.path.replace(/^\/api\/v1\//,'').replace(/^\//,'').split('/')[0];
      const module=({attachments:'documents',claims:'inventory',barcodes:'inventory',pricing:'sales',purchase:'purchase',sales:'sales',inventory:'inventory',accounting:'accounting',banking:'accounting'} as any)[prefix];
      if(module)inferred=module+(['GET','HEAD'].includes(request.method)?'.read':'.write');
    }
    if (!['ADMIN','OWNER','TENANT_ADMIN'].includes(authorizedRole.role.name) && (required?.length || inferred)) {
      const needed = required?.length ? required : [inferred!];
      if (!needed.every(p => permissions.has(p))) throw new ForbiddenException('Insufficient permissions');
    }
    await validateTenantBoundary(this.prisma,request,request.user);
    if(request.method==='POST'&&/\/attachments\/?$/.test(request.path))await throttleOperation('upload:'+user.id,30);
    if(request.method==='GET'&&/\/retail\/(reports|galla)/.test(request.path))await throttleOperation('report:'+user.id,120);
    if(request.method==='GET'&&/\/(?:retail\/items|barcodes\/lookup|erp\/pos\/barcode)/.test(request.path))await throttleOperation('catalog:'+user.id,300);
    if(request.method==='POST'&&/\/barcodes\/labels\//.test(request.path))await throttleOperation('label-print:'+user.id,20);

    return true;
  }
}
