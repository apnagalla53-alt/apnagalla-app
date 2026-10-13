import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

export const isTenantAdministrator = (user: any) => ['ADMIN', 'OWNER', 'TENANT_ADMIN'].includes(user?.role) || user?.permissions?.includes('identity.admin');

@Injectable()
export class TenantAdministrationGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    if (!isTenantAdministrator(context.switchToHttp().getRequest().user)) throw new ForbiddenException('Only your shop administrator can manage this setting');
    return true;
  }
}
