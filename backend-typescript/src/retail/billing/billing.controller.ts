import { FinancialCostVisibilityInterceptor } from '../../common/financial-cost-visibility.interceptor';
import { Controller, Post, Get, Body, Req, UseGuards, UseInterceptors, Query, Param } from '@nestjs/common';
import { BillingService } from './billing.service';
import { RetailBillDto, RetailHoldDto, RetailReturnDto, RetailAmountSaleDto } from '../dto/retail-bill.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { FeatureGuard, RequireFeature } from '../../common/guards/feature.guard';

@Controller('api/v1/retail/bills')
@UseGuards(AuthGuard, SubscriptionGuard, FeatureGuard)
@RequireFeature('RETAIL_POS')
@UseInterceptors(FinancialCostVisibilityInterceptor)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  async getBills(@Req() req: any, @Query() query: any) {
    const { company_id, branch_id } = req.user;
    return this.billingService.getBills(company_id, branch_id, query);
  }

  @Get('hold')
  async getHeldBills(@Req() req: any) {
    const { company_id, branch_id, id: userId } = req.user;
    return this.billingService.getHeldBills(company_id, branch_id, userId);
  }

  @Get(':id')
  async getBillDetail(@Req() req: any, @Param('id') id: string) {
    const { company_id } = req.user;
    return this.billingService.getBillDetail(id, company_id);
  }

  @Post()
  async createBill(@Req() req: any, @Body() dto: RetailBillDto) {
    const { company_id, branch_id, id: userId } = req.user;
    return this.billingService.createBill(company_id, branch_id, userId, dto);
  }

  @Post('amount-sale')
  createAmountSale(@Req() req: any, @Body() dto: RetailAmountSaleDto) {
    return this.billingService.createAmountSale(req.user.company_id, req.user.branch_id, req.user.id, dto);
  }

  @Post('quote')
  quoteBill(@Req() req: any, @Body() dto: RetailBillDto) {
    return this.billingService.quoteBill(req.user.company_id, req.user.branch_id, dto);
  }

  @Post('hold')
  async holdBill(@Req() req: any, @Body() dto: RetailHoldDto) {
    const { company_id, branch_id, id: userId } = req.user;
    return this.billingService.holdBill(company_id, branch_id, userId, dto.items, { customer_id: dto.customer_id, reference_name: dto.reference_name, notes: dto.note, bill_discount: dto.bill_discount });
  }

  @Post('hold/:id/resume')
  async resumeBill(@Req() req: any, @Param('id') id: string) {
    const { company_id, id: userId } = req.user;
    return this.billingService.resumeBill(id, company_id, userId);
  }

  @Post('return')
  async postReturn(@Req() req: any, @Body() dto: RetailReturnDto) {
    const { company_id, branch_id, id: userId } = req.user;
    return this.billingService.postReturn(company_id, branch_id, userId, dto);
  }
}

