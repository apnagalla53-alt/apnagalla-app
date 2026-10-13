import { FinancialCostVisibilityInterceptor } from '../common/financial-cost-visibility.interceptor';
import { Controller, Post, Get, Body, Req, UseGuards, UseInterceptors, Param, Patch } from '@nestjs/common';
import { PosService } from './pos.service';
import { CreatePosSaleDto } from './dto/create-pos-sale.dto';
import { CreatePosReturnDto } from './dto/create-pos-return.dto';
import { OpenShiftDto, CloseShiftDto } from './dto/shift.dto';
import { HoldBillDto } from './dto/hold-bill.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { FeatureGuard, RequireFeature } from '../common/guards/feature.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermissions } from '../common/guards/auth.guard';

@Controller('erp/pos')
@UseGuards(AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard)
@RequireFeature('RETAIL_POS')
@UseInterceptors(FinancialCostVisibilityInterceptor)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post('sale')
  @RequirePermissions('pos.sale.create')
  async postPosSale(@Req() req: any, @Body() dto: CreatePosSaleDto) {
    const { company_id: companyId, id: userId } = req.user;
    return this.posService.postPosSale(companyId, userId, dto);
  }

  @Get('barcode/:sku')
  @RequirePermissions('pos.sale.create')
  async lookupItemByBarcode(@Req() req: any, @Param('sku') sku: string) {
    const { company_id: companyId } = req.user;
    return this.posService.lookupItemByBarcode(companyId, sku);
  }

  @Post('return')
  @RequirePermissions('pos.return.create')
  async postPosReturn(@Req() req: any, @Body() dto: CreatePosReturnDto) {
    const { company_id: companyId, id: userId } = req.user;
    return this.posService.postPosReturn(companyId, userId, dto);
  }

  @Get('shift/current/:branchId')
  @RequirePermissions('pos.shift.read')
  async getCurrentShift(@Req() req: any, @Param('branchId') branchId: string) {
    const { company_id: companyId, id: userId } = req.user;
    return this.posService.getCurrentShift(companyId, branchId, userId);
  }

  @Post('shift/open')
  @RequirePermissions('pos.shift.open')
  async openShift(@Req() req: any, @Body() dto: OpenShiftDto) {
    const { company_id: companyId, id: userId } = req.user;
    return this.posService.openShift(companyId, userId, dto);
  }

  @Patch('shift/close/:shiftId')
  @RequirePermissions('pos.shift.close')
  async closeShift(@Req() req: any, @Param('shiftId') shiftId: string, @Body() dto: CloseShiftDto) {
    const { company_id: companyId, id: userId } = req.user;
    return this.posService.closeShift(shiftId, companyId, userId, dto);
  }

  @Get('held-bills/:branchId')
  @RequirePermissions('pos.sale.create')
  async getHeldBills(@Req() req: any, @Param('branchId') branchId: string) {
    const { company_id: companyId, id: userId } = req.user;
    return this.posService.getHeldBills(companyId, branchId, userId);
  }

  @Post('held-bills')
  @RequirePermissions('pos.sale.create')
  async holdBill(@Req() req: any, @Body() dto: HoldBillDto) {
    const { company_id: companyId, id: userId } = req.user;
    return this.posService.holdBill(companyId, userId, dto);
  }

  @Post('held-bills/:id/resume')
  @RequirePermissions('pos.sale.create')
  async resumeBill(@Req() req: any, @Param('id') id: string) {
    const { company_id: companyId, id: userId } = req.user;
    return this.posService.resumeBill(id, companyId, userId);
  }
}

