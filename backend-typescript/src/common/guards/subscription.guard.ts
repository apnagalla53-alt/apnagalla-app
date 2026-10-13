import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Platform/Unauthenticated boundary check
    if (!user) {
      return true; // Let AuthGuard or PlatformGuard handle unauthenticated access
    }

    if (!user.organization_id) {
      // If user has no organization_id (e.g. Platform Super Admin)
      return true; 
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: user.organization_id },
      select: { status: true, is_active: true }
    });

    if (!org || !org.is_active) {
      throw new ForbiddenException('Organization is inactive. ERP access blocked.');
    }

    if (org.status === 'SUSPENDED') {
      throw new ForbiddenException('Organization is suspended. ERP access blocked.');
    }

    if (org.status === 'CANCELLED') {
      throw new ForbiddenException('Organization is cancelled. ERP access blocked.');
    }

    // TRIAL and ACTIVE are permitted
    return true;
  }
}
