import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { AccountingService, CreateAccountDto } from './accounting.service';
import { PostingService, CreateVoucherDto } from './posting.service';
import { CreditService } from './credit.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { FeatureGuard, RequireFeature } from '../common/guards/feature.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermissions } from '../common/guards/auth.guard';

@Controller('api/v1/accounting')
@UseGuards(AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard)
@RequireFeature('ACCOUNTING')
export class AccountingController {
  constructor(
    private readonly accountingService: AccountingService,
    private readonly postingService: PostingService,
    private readonly creditService: CreditService,
  ) {}

  @Get('accounts')
  @RequirePermissions('accounting.read')
  async getChartOfAccounts(@Req() req: any) {
    const companyId = req.user?.company_id;
    if (!companyId) throw new ForbiddenException('No active company selected');
    return this.accountingService.getChartOfAccounts(companyId);
  }

  @Post('accounts')
  @RequirePermissions('accounting.write')
  async createAccount(@Req() req: any, @Body() body: CreateAccountDto) {
    const companyId = req.user?.company_id;
    const branchId = req.user?.branch_id;
    if (!companyId) throw new ForbiddenException('No active company selected');
    return this.accountingService.createAccount(companyId, branchId, body);
  }

  @Get('accounts/:id/balance')
  @RequirePermissions('accounting.read')
  async getAccountBalance(@Req() req: any, @Param('id') id: string) {
    const companyId = req.user?.company_id;
    if (!companyId) throw new ForbiddenException('No active company selected');
    return this.accountingService.getAccountBalance(companyId, id);
  }

  @Get('ledger/:id')
  @RequirePermissions('accounting.read')
  async getLedger(
    @Req() req: any, 
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const companyId = req.user?.company_id;
    if (!companyId) throw new ForbiddenException('No active company selected');
    return this.accountingService.getLedger(companyId, id, startDate, endDate);
  }

  @Get('trial-balance')
  @RequirePermissions('accounting.read')
  async getTrialBalance(@Req() req: any, @Query('asOfDate') asOfDate?: string) {
    const companyId = req.user?.company_id;
    if (!companyId) throw new ForbiddenException('No active company selected');
    return this.accountingService.getTrialBalance(companyId, asOfDate);
  }

  @Post('vouchers')
  @RequirePermissions('accounting.write')
  async createVoucher(@Req() req: any, @Body() body: CreateVoucherDto) {
    const companyId = req.user?.company_id;
    if (!companyId) throw new ForbiddenException('No active company selected');
    
    if (body.company_id !== companyId) {
      throw new ForbiddenException('Cannot post voucher to another organization');
    }

    if (body.branch_id && req.user?.branch_id && body.branch_id !== req.user?.branch_id) {
      throw new ForbiddenException('Cannot post voucher to another branch');
    }

    // Pass user identity for audit trail
    body.posted_by = req.user.id;
    
    return this.postingService.postVoucherWithIsolationChecks(body);
  }

  @Post('vouchers/:id/reverse')
  @RequirePermissions('accounting.write')
  async reverseVoucher(@Req() req: any, @Param('id') id: string, @Body('reason') reason: string) {
    const companyId = req.user?.company_id;
    if (!companyId) throw new ForbiddenException('No active company selected');
    
    return this.postingService.reverseVoucherWithIsolationChecks(companyId, id, req.user.id, reason);
  }

  @Get('parties/:id/outstanding')
  @RequirePermissions('accounting.read')
  async getPartyOutstanding(@Req() req: any, @Param('id') id: string) {
    const companyId = req.user?.company_id;
    if (!companyId) throw new ForbiddenException('No active company selected');
    const outstanding = await this.creditService.getPartyOutstanding(companyId, id);
    return { outstanding };
  }

  @Get('parties/:id/ageing')
  @RequirePermissions('accounting.read')
  async getPartyAgeing(@Req() req: any, @Param('id') id: string) {
    const companyId = req.user?.company_id;
    if (!companyId) throw new ForbiddenException('No active company selected');
    return this.creditService.getPartyAgeing(companyId, id);
  }

  @Get('parties/:id/credit-status')
  @RequirePermissions('accounting.read')
  async getPartyCreditStatus(@Req() req: any, @Param('id') id: string) {
    const companyId = req.user?.company_id;
    if (!companyId) throw new ForbiddenException('No active company selected');
    return this.creditService.checkCreditLimit(companyId, id, 0);
  }
}
