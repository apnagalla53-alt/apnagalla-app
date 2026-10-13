import { Controller, Post, Body, Get, UseGuards, Param, Patch, Req, ParseUUIDPipe, Query } from '@nestjs/common';
import { PlatformAuthGuard } from '../auth/platform-auth.guard';
import { TenantProvisioningService, ProvisionTenantDto } from '../provisioning/tenant-provisioning.service';
import { PrismaService } from '../../database/prisma.service';
import { PlatformService } from '../platform.service';
import { PlatformBackupService, RestoreBackupDto } from '../backup.service';
import { TenantActionDto, PlanDto, FeatureDto, SubscriptionPaymentDto, RefundPaymentDto, PlatformExpenseDto, AnnouncementDto, PlatformSettingsDto } from '../platform.dto';

@UseGuards(PlatformAuthGuard)
@Controller('platform/admin')
export class PlatformAdminController {
  constructor(
    private readonly provisioningService: TenantProvisioningService,
    private readonly prisma: PrismaService,
    private readonly platform: PlatformService,
    private readonly backup: PlatformBackupService,
  ) {}

  @Post('tenants')
  async provisionTenant(@Body() dto: ProvisionTenantDto, @Req() req: any) {
    return this.provisioningService.provisionTenant(dto, req.user.sub);
  }

  @Post('tenants/:id/invite')
  async inviteOwner(
    @Param('id') id: string,
    @Body() dto: { email: string; name: string }
  ) {
    return this.provisioningService.inviteOwner({
      organizationId: id,
      email: dto.email,
      name: dto.name
    });
  }

  @Get('tenants')
  async listTenants(@Query() query: any) {
    return this.platform.listTenants(query);
  }

  @Get('tenants/:id')
  async getTenant(@Param('id', ParseUUIDPipe) id: string) {
    return this.platform.getTenant(id);
  }

  @Patch('tenants/:id/status')
  async updateTenantStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TenantActionDto, @Req() req: any,
  ) {
    return this.platform.tenantAction(id, { ...dto, action: 'status' }, req.user.sub);
  }

  @Post('tenants/:id/actions')
  action(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TenantActionDto, @Req() req: any) { return this.platform.tenantAction(id, dto, req.user.sub); }
  @Get('dashboard') dashboard() { return this.platform.dashboard(); }
  @Get('backups') backups() { return this.backup.list(); }
  @Post('backups') createBackup(@Req() req: any) { return this.backup.create(req.user.sub); }
  @Post('backups/:id/verify') verifyBackup(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) { return this.backup.verify(id, req.user.sub); }
  @Post('backups/:id/restore') restoreBackup(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RestoreBackupDto, @Req() req: any) { return this.backup.restore(id, dto, req.user.sub); }
  @Get('plans') plans() { return this.platform.plans(); }
  @Post('plans') createPlan(@Body() dto: PlanDto, @Req() req: any) { return this.platform.savePlan(dto, req.user.sub); }
  @Patch('plans/:id') updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlanDto, @Req() req: any) { return this.platform.savePlan(dto, req.user.sub, id); }
  @Get('features') features() { return this.platform.features(); }
  @Post('features') saveFeature(@Body() dto: FeatureDto, @Req() req: any) { return this.platform.saveFeature(dto, req.user.sub); }
  @Get('payments') payments() { return this.platform.payments(); }
  @Post('payments') recordPayment(@Body() dto: SubscriptionPaymentDto, @Req() req: any) { return this.platform.recordPayment(dto, req.user.sub); }
  @Post('payments/:id/refund') refundPayment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundPaymentDto, @Req() req: any) { return this.platform.refundPayment(id, dto, req.user.sub); }
  @Get('expenses') expenses() { return this.platform.expenses(); }
  @Post('expenses') recordExpense(@Body() dto: PlatformExpenseDto, @Req() req: any) { return this.platform.recordExpense(dto, req.user.sub); }
  @Get('users') users() { return this.platform.users(); }
  @Get('sessions') sessions() { return this.platform.sessions(); }
  @Get('support') support() { return this.platform.support(); }
  @Get('support/:id/records') supportRecords(@Param('id', ParseUUIDPipe) id:string,@Query('kind') kind:string,@Req() req:any) { return this.platform.supportRecords(id,kind,req.user.sub); }
  @Get('alerts') alerts() { return this.platform.alerts(); }
  @Post('backup-requests/:id/followup') followup(@Param('id',ParseUUIDPipe) id:string,@Req() req:any) {return this.platform.backupFollowup(id,req.user.sub);}
  @Get('audit') audit() { return this.platform.auditLogs(); }
  @Get('infrastructure') infrastructure() { return this.platform.infrastructure(); }
  @Get('settings') settings() { return this.platform.settings(); }
  @Post('settings') saveSettings(@Body() dto: PlatformSettingsDto, @Req() req: any) { return this.platform.saveSettings(dto, req.user.sub); }
  @Get('announcements') announcements() { return this.platform.announcements(); }
  @Post('announcements') createAnnouncement(@Body() dto: AnnouncementDto, @Req() req: any) { return this.platform.createAnnouncement(dto, req.user.sub); }
}
