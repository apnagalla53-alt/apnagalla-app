import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { IntentResolverService } from './intent-resolver.service';
import { getIntents } from './intent-handlers';
import { IntelligenceContext, IntelligenceQuery, IntelligenceResponse } from './interfaces';

@Injectable()
export class IntelligenceService {
  private intents = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly intentResolver: IntentResolverService
  ) {
    const intentList = getIntents(this.prisma);
    intentList.forEach(i => this.intents.set(i.intentCode, i));
  }

  async ask(query: IntelligenceQuery, context: IntelligenceContext): Promise<IntelligenceResponse> {
    // 1. Resolve Intent (Deterministic first, No AI fallback for now)
    let resolution = this.intentResolver.resolve(query.question);

    if (!resolution) {
      return {
        intent: 'UNKNOWN',
        success: false,
        generatedAt: new Date().toISOString(),
        error: "I'm not sure how to answer that from the available ERP data. Could you try asking about Open Purchase Orders, Pending Receipts, or Supplier Outstanding?"
      };
    }

    const intentHandler = this.intents.get(resolution.intent);
    if (!intentHandler) {
      return {
        intent: resolution.intent,
        success: false,
        generatedAt: new Date().toISOString(),
        error: `Intent ${resolution.intent} is defined but has no handler.`
      };
    }

    // 2. Permission Check
    // Wait, the real user's permissions must be verified. 
    // In our mock Auth setup, user.role = 'ADMIN' gives them access.
    // If we had a true RBAC integration, we would check UserRole / RolePermission here against `intentHandler.requiredPermission`.
    const hasPermission = await this.checkPermission(context, intentHandler.requiredPermission);
    
    if (!hasPermission) {
      throw new UnauthorizedException(`You do not have the required permission (${intentHandler.requiredPermission}) to access this intelligence data.`);
    }

    // 3. Execute Intent Query
    try {
      const response = await intentHandler.handle(context, resolution.parameters);
      return response;
    } catch (e: any) {
      return {
        intent: resolution.intent,
        success: false,
        generatedAt: new Date().toISOString(),
        error: 'Could not retrieve the authorized business report. Please try again.'
      };
    }
  }

  private async checkPermission(context: IntelligenceContext, requiredPermission: string): Promise<boolean> {
    // Implement RBAC check using Prisma
    // For now, if it's the mock 'admin-1', allow. Or check user roles.
    
    // Proper RBAC lookup:
    const user = await this.prisma.user.findUnique({
      where: { id: context.userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                role_permissions: {
                  include: { permission: true }
                }
              }
            }
          }
        }
      }
    });

    if (!user||!user.is_active||user.is_locked) return false;
    const company=await this.prisma.company.findFirst({where:{id:context.organizationId,organization_id:user.organization_id!,is_active:true}});
    if(!company)return false;

    for (const ur of user.roles) {
      if(ur.company_id!==company.id||ur.branch_id&&ur.branch_id!==context.branchId)continue;
      if (['ADMIN','OWNER','TENANT_ADMIN'].includes(ur.role.name)) return true;
      for (const rp of ur.role.role_permissions) {
        if (rp.permission.code === requiredPermission) return true;
      }
    }

    return false; // Not found
  }
}
