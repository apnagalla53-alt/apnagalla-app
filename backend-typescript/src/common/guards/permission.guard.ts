import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './auth.guard';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context missing for permission check');
    }

    const hasPermission = () => {
      if (['ADMIN','OWNER','TENANT_ADMIN'].includes(user.role)) return true;
      return requiredPermissions.every((perm) => user.permissions?.includes(perm));
    };

    if (!hasPermission()) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
