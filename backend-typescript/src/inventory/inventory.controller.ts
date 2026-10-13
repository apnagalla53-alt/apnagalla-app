import { Controller, Get, Post, Body, Param, UseGuards, UseInterceptors, Request, Query } from '@nestjs/common';
import { InventoryPostingService, PostMovementDto } from './posting.service';
import { StockAdjustmentService, CreateAdjustmentDto } from './adjustment.service';
import { StockTransferService, CreateTransferDto } from './transfer.service';
import { OpeningStockService, PostOpeningStockDto } from './opening-stock.service';
import { StockCountService, CreateStockCountDto } from './stock-count.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { FeatureGuard, RequireFeature } from '../common/guards/feature.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermissions } from '../common/guards/auth.guard';
import { PrismaService } from '../database/prisma.service';
import { FinancialCostVisibilityInterceptor } from '../common/financial-cost-visibility.interceptor';

@Controller('api/v1/inventory')
@UseGuards(AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard)
@RequireFeature('INVENTORY')
@UseInterceptors(FinancialCostVisibilityInterceptor)
export class InventoryController {
  constructor(
    private readonly inventoryPostingService: InventoryPostingService,
    private readonly stockAdjustmentService: StockAdjustmentService,
    private readonly stockTransferService: StockTransferService,
    private readonly openingStockService: OpeningStockService,
    private readonly stockCountService: StockCountService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stock')
  @RequirePermissions('inventory.read')
  async getStockSummary(
    @Request() req: any,
    @Query('godown_id') godownId?: string,
    @Query('item_id') itemId?: string,
  ) {
    const where: any = { company_id: req.user.company_id };
    if (godownId) where.godown_id = godownId;
    if (itemId) where.item_id = itemId;

    const balances = await this.prisma.stockBalanceProjection.findMany({
      where,
      include: {
        item: { select: { sku: true, name: true, primary_unit_id: true } },
        godown: { select: { code: true, name: true } },
      },
    });

    return balances.map(b => ({
      godown: b.godown.name,
      item: b.item.name,
      sku: b.item.sku,
      quantity: b.quantity.toString(),
      unit: b.item.primary_unit_id,
    }));
  }

  @Get('movements')
  @RequirePermissions('inventory.read')
  async getStockLedger(
    @Request() req: any,
    @Query('godown_id') godownId?: string,
    @Query('item_id') itemId?: string,
  ) {
    const where: any = { company_id: req.user.company_id };
    if (godownId) where.godown_id = godownId;
    if (itemId) where.item_id = itemId;

    const movements = await this.prisma.stockMovement.findMany({
      where,
      orderBy: { business_date: 'asc' },
      include: {
        item: { select: { name: true } },
      },
      take: 100,
    });

    return movements;
  }

  @Post('adjustments')
  @RequirePermissions('inventory.adjust')
  async postAdjustment(@Request() req: any, @Body() body: any) {
    const dto: CreateAdjustmentDto = {
      company_id: req.user.company_id,
      branch_id: req.user.branch_id,
      financial_year_id: req.headers['x-financial-year-id'] || body.financial_year_id, // FY should be passed in headers or body
      user_id: req.user.id,
      document_date: new Date(body.document_date || Date.now()),
      adjustment_type: body.adjustment_type, // 'IN' | 'OUT'
      narration: body.narration,
      lines: body.lines,
    };
    
    // For testing/mock backwards compatibility
    if (body.godown_id && body.item_id) {
      dto.lines = [{
        item_id: body.item_id,
        godown_id: body.godown_id,
        quantity: body.quantity,
        unit_id: body.unit_id || 'PCS',
        reason: body.reason
      }];
      dto.adjustment_type = body.type || 'IN';
    }

    const result = await this.stockAdjustmentService.createAndPost(dto);
    return { success: true, id: result.id, document_number: result.document_number };
  }

  @Post('transfers')
  @RequirePermissions('inventory.transfer')
  async postTransfer(@Request() req: any, @Body() body: any) {
    const dto: CreateTransferDto = {
      company_id: req.user.company_id,
      branch_id: req.user.branch_id,
      financial_year_id: req.headers['x-financial-year-id'] || body.financial_year_id,
      user_id: req.user.id,
      document_date: new Date(body.document_date || Date.now()),
      source_godown_id: body.source_godown_id,
      destination_godown_id: body.destination_godown_id,
      narration: body.narration,
      lines: body.lines,
    };

    // For testing/mock backwards compatibility
    if (body.from_godown_id && body.to_godown_id) {
      dto.source_godown_id = body.from_godown_id;
      dto.destination_godown_id = body.to_godown_id;
      dto.lines = [{
        item_id: body.item_id,
        unit_id: body.unit_id || 'PCS',
        quantity: body.quantity
      }];
    }

    const result = await this.stockTransferService.createAndPost(dto);
    return { success: true, id: result.id, document_number: result.document_number };
  }

  @Post('adjustments/:id/reverse')
  @RequirePermissions('inventory.adjust')
  async reverseAdjustment(@Request() req: any, @Param('id') id: string) {
    const result = await this.stockAdjustmentService.reverseAdjustment(id, req.user.id);
    return { success: true, id: result.id };
  }

  @Post('transfers/:id/reverse')
  @RequirePermissions('inventory.transfer')
  async reverseTransfer(@Request() req: any, @Param('id') id: string) {
    const result = await this.stockTransferService.reverseTransfer(id, req.user.id);
    return { success: true, id: result.id };
  }

  @Get('opening-stocks')
  @RequirePermissions('inventory.read')
  async getOpeningStocks(@Request() req: any) {
    return this.openingStockService.getOpeningStocks(req.user.company_id, req.user.branch_id);
  }

  @Post('opening-stocks')
  @RequirePermissions('inventory.adjust') // Reusing adjust permission, or could be inventory.opening
  async postOpeningStock(@Request() req: any, @Body() body: any) {
    const dto: PostOpeningStockDto = {
      company_id: req.user.company_id,
      branch_id: req.user.branch_id,
      financial_year_id: req.headers['x-financial-year-id'] || body.financial_year_id,
      document_number: body.document_number,
      document_date: new Date(body.document_date || Date.now()),
      narration: body.narration,
      lines: body.lines,
    };
    const result = await this.openingStockService.postOpeningStock(dto, req.user.id);
    return { success: true, id: result.id, document_number: result.document_number };
  }

  @Get('stock-counts')
  @RequirePermissions('inventory.read')
  async getStockCounts(@Request() req: any) {
    return this.stockCountService.getStockCounts(req.user.company_id, req.user.branch_id);
  }

  @Post('stock-counts')
  @RequirePermissions('inventory.adjust')
  async createStockCount(@Request() req: any, @Body() body: any) {
    const dto: CreateStockCountDto = {
      company_id: req.user.company_id,
      branch_id: req.user.branch_id,
      financial_year_id: req.headers['x-financial-year-id'] || body.financial_year_id,
      document_number: body.document_number,
      count_date: new Date(body.count_date || Date.now()),
      godown_id: body.godown_id,
      notes: body.notes,
      lines: body.lines,
    };
    const result = await this.stockCountService.createStockCount(dto, req.user.id);
    return { success: true, id: result.id, document_number: result.document_number };
  }

  @Post('stock-counts/:id/post')
  @RequirePermissions('inventory.adjust')
  async postStockCount(@Request() req: any, @Param('id') id: string) {
    const result = await this.stockCountService.postStockCount(id, req.user.id);
    return { success: true, id: result.id, status: result.status };
  }
}
