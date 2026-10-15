import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import {
  FeatureGuard,
  RequireFeature,
} from '../../common/guards/feature.guard';
import { throttleOperation } from '../../common/operation-throttle';
import { RetailExperienceService } from './retail-experience.service';
import { PrismaService } from '../../database/prisma.service';
import { ExperienceEventDto, experienceEvents } from './experience-events.dto';

@Controller('api/v1/retail/account/experience')
@UseGuards(AuthGuard, SubscriptionGuard, FeatureGuard)
@RequireFeature('RETAIL_POS')
export class RetailExperienceController {
  constructor(
    private experience: RetailExperienceService,
    private db: PrismaService,
  ) {}
  @Get()
  async home(@Req() req: any, @Query('dismissed') dismissed = '') {
    await throttleOperation('retail-experience:' + req.user.id, 120);
    return this.experience.home(
      req.user,
      String(dismissed)
        .slice(0, 12000)
        .split(',')
        .filter(Boolean)
        .slice(0, 100),
    );
  }
  @Post('events')
  async event(@Req() req: any, @Body() dto: ExperienceEventDto) {
    await throttleOperation('retail-experience-events:' + req.user.id, 300);
    // Fixed vocabulary and numeric measurements only. No text, query, product,
    // customer, phone, credentials, bill contents or browser URL are accepted.
    await this.db.auditLog.createMany({
      data: [
        {
          id: dto.event_id,
          company_id: req.user.company_id,
          branch_id: req.user.branch_id,
          user_id: req.user.id,
          action: 'EXPERIENCE_' + dto.event.toUpperCase(),
          details: JSON.stringify({
            workflow: dto.workflow,
            count: dto.count,
            duration_ms: dto.duration_ms,
          }),
        },
      ],
      skipDuplicates: true,
    });
    return { accepted: true };
  }
  @Get('metrics')
  async metrics(@Req() req: any) {
    if (
      !['OWNER', 'ADMIN', 'TENANT_ADMIN'].includes(req.user.role) &&
      !req.user.permissions.includes('reports.read')
    )
      throw new ForbiddenException('Reports access required');
    await throttleOperation('retail-experience-metrics:' + req.user.id, 30);
    const scope = {
        company_id: req.user.company_id,
        branch_id: req.user.branch_id,
      },
      since = new Date(Date.now() - 30 * 86400000);
    const counts = await this.db.auditLog.groupBy({
      by: ['action'],
      where: {
        ...scope,
        created_at: { gte: since },
        action: {
          in: experienceEvents.map((e) => 'EXPERIENCE_' + e.toUpperCase()),
        },
      },
      _count: { _all: true },
    });
    const [company, firstBill] = await Promise.all([
      this.db.company.findUniqueOrThrow({
        where: { id: scope.company_id },
        select: { created_at: true },
      }),
      this.db.salesInvoice.findFirst({
        where: { ...scope, status: 'POSTED' },
        orderBy: { created_at: 'asc' },
        select: { created_at: true },
      }),
    ]);
    const intake = await this.db.$queryRaw<
      any[]
    >`SELECT filename AS source, COUNT(*)::int AS jobs, COUNT(*) FILTER (WHERE status='CONFIRMED')::int AS confirmed, COUNT(*) FILTER (WHERE status='FAILED')::int AS failed, COUNT(*) FILTER (WHERE status='CANCELLED')::int AS cancelled, AVG((configuration->>'initial_review_rows')::numeric) AS average_rows_needing_review, AVG(EXTRACT(EPOCH FROM ((configuration->>'confirmed_at')::timestamptz-created_at))*1000) AS average_completion_ms FROM retail_import_jobs WHERE company_id=${scope.company_id}::uuid AND branch_id=${scope.branch_id}::uuid AND preset='UNIVERSAL_INTAKE' AND created_at>=${since} GROUP BY filename`;
    const firstItem = await this.db.auditLog.findFirst({
      where: { ...scope, action: 'RETAIL_ITEM_CREATED' },
      orderBy: { created_at: 'asc' },
      select: { created_at: true },
    });
    return {
      intake,
      time_to_first_item_ms: firstItem
        ? Math.max(
            0,
            firstItem.created_at.getTime() - company.created_at.getTime(),
          )
        : null,
      window_days: 30,
      events: Object.fromEntries(
        counts.map((r) => [r.action.slice(11).toLowerCase(), r._count._all]),
      ),
      time_to_first_bill_ms: firstBill
        ? Math.max(
            0,
            firstBill.created_at.getTime() - company.created_at.getTime(),
          )
        : null,
      measurement:
        'Optional UI events are best-effort observations. Time to first bill uses posted records and shop creation time.',
    };
  }
}
