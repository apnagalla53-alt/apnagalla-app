import { Controller, Get, Post, Body, Param, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { BankingService, CreateBankAccountDto, RegisterChequeDto } from './banking.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { FeatureGuard, RequireFeature } from '../common/guards/feature.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermissions } from '../common/guards/auth.guard';

@Controller('api/v1/banking')
@UseGuards(AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard)
@RequireFeature('ACCOUNTING')
export class BankingController {
  constructor(private readonly bankingService: BankingService) {}

  @Get('accounts')
  @RequirePermissions('accounting.read')
  async getBankAccounts(@Req() req: any) {
    const companyId = req.user?.company_id;
    if (!companyId) throw new ForbiddenException('No active company selected');
    return this.bankingService.getBankAccounts(companyId);
  }

  @Post('accounts')
  @RequirePermissions('accounting.write')
  async createBankAccount(@Req() req: any, @Body() body: CreateBankAccountDto) {
    const companyId = req.user?.company_id;
    const branchId = req.user?.branch_id;
    if (!companyId) throw new ForbiddenException('No active company selected');
    return this.bankingService.createBankAccount(companyId, branchId, body);
  }

  @Post('cheques/register')
  @RequirePermissions('accounting.write')
  async registerCheque(@Req() req: any, @Body() body: RegisterChequeDto) {
    const companyId = req.user?.company_id;
    if (!companyId) throw new ForbiddenException('No active company selected');
    
    // Automatically set branch if user is scoped
    if (req.user?.branch_id) {
      body.branch_id = req.user.branch_id;
    }

    return this.bankingService.registerCheque(companyId, body);
  }

  @Post('cheques/:id/clear')
  @RequirePermissions('accounting.write')
  async clearCheque(@Req() req: any, @Param('id') id: string, @Body('clear_date') clearDate: string) {
    const companyId = req.user?.company_id;
    if (!companyId) throw new ForbiddenException('No active company selected');
    
    return this.bankingService.clearCheque(companyId, id, clearDate, req.user.id);
  }

  @Post('cheques/:id/bounce')
  @RequirePermissions('accounting.write')
  async bounceCheque(@Req() req: any, @Param('id') id: string, @Body('reason') reason: string) {
    const companyId = req.user?.company_id;
    if (!companyId) throw new ForbiddenException('No active company selected');
    
    return this.bankingService.bounceCheque(companyId, id, reason);
  }
}
