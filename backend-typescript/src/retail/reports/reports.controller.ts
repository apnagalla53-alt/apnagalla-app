import { Controller, Get, Req, UseGuards, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { FeatureGuard, RequireFeature } from '../../common/guards/feature.guard';
import { ReportFilterDto } from './dto/report-filter.dto';

@Controller('api/v1/retail/reports')
@UseGuards(AuthGuard, SubscriptionGuard, FeatureGuard)
@RequireFeature('RETAIL_POS')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  async getDashboard(@Req() req: any, @Query() filters: ReportFilterDto) {
    const { company_id } = req.user;
    return this.reportsService.getDashboard(company_id, filters);
  }

  @Get('sales')
  async getSalesReport(@Req() req: any, @Query() filters: ReportFilterDto) {
    const { company_id } = req.user;
    return this.reportsService.getSalesReport(company_id, filters);
  }

  @Get('sales/items')
  async getTopItemsReport(@Req() req: any, @Query() filters: ReportFilterDto) {
    const { company_id } = req.user;
    return this.reportsService.getTopItemsReport(company_id, filters);
  }

  @Get('purchases')
  async getPurchaseReport(@Req() req: any, @Query() filters: ReportFilterDto) {
    const { company_id } = req.user;
    return this.reportsService.getPurchaseReport(company_id, filters);
  }

  @Get('expenses')
  async getExpenseReport(@Req() req: any, @Query() filters: ReportFilterDto) {
    const { company_id } = req.user;
    return this.reportsService.getExpenseReport(company_id, filters);
  }

  @Get('stock')
  async getStockReport(@Req() req: any, @Query() filters: ReportFilterDto) {
    const { company_id } = req.user;
    return this.reportsService.getStockReport(company_id, filters);
  }

  @Get('customers/due')
  async getCustomerDueReport(@Req() req: any, @Query() filters: ReportFilterDto) {
    const { company_id } = req.user;
    return this.reportsService.getCustomerDueReport(company_id, filters);
  }

  @Get('suppliers/due')
  async getSupplierDueReport(@Req() req: any, @Query() filters: ReportFilterDto) {
    const { company_id } = req.user;
    return this.reportsService.getSupplierDueReport(company_id, filters);
  }

  @Get('returns')
  async getReturnsReport(@Req() req: any, @Query() filters: ReportFilterDto) {
    const { company_id } = req.user;
    return this.reportsService.getReturnsReport(company_id, { ...filters, branch_id: filters.branch_id || req.user.branch_id });
  }
}
