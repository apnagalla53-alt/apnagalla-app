import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingEngineService } from './pricing-engine.service';
import { CreatePriceListDto, UpdatePriceListDto } from './dto/create-price-list.dto';
import { CreatePriceListItemDto, UpdatePriceListItemDto } from './dto/price-list-item.dto';
import { CreateCustomerRateDto, UpdateCustomerRateDto } from './dto/customer-rate.dto';
import { CreatePromotionSchemeDto, UpdatePromotionSchemeDto } from './dto/promotion-scheme.dto';
import { EvaluatePricingDto } from './dto/evaluate-pricing.dto';
import { AuthGuard, RequirePermissions } from '../common/guards/auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { FeatureGuard, RequireFeature } from '../common/guards/feature.guard';
import { PermissionGuard } from '../common/guards/permission.guard';

@Controller('api/v1/pricing')
@UseGuards(AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard)
@RequireFeature('SALES','ADVANCED_PRICING')
export class PricingController {
  constructor(
    private readonly pricingService: PricingService,
    private readonly pricingEngine: PricingEngineService,
  ) {}

  // ── Price Lists ───────────────────────────────────────────────────────────

  @Post('price-lists')
  @RequirePermissions('pricing.price_list.manage')
  async createPriceList(@Request() req: any, @Body() dto: CreatePriceListDto) {
    return this.pricingService.createPriceList(req.user.company_id, dto);
  }

  @Get('price-lists')
  @RequirePermissions('pricing.price_list.read')
  async getPriceLists(@Request() req: any, @Query('status') status?: string, @Query('branch_id') branchId?: string) {
    return this.pricingService.getPriceLists(req.user.company_id, { status, branchId });
  }

  @Get('price-lists/:id')
  @RequirePermissions('pricing.price_list.read')
  async getPriceListById(@Request() req: any, @Param('id') id: string) {
    return this.pricingService.getPriceListById(req.user.company_id, id);
  }

  @Patch('price-lists/:id')
  @RequirePermissions('pricing.price_list.manage')
  async updatePriceList(@Request() req: any, @Param('id') id: string, @Body() dto: UpdatePriceListDto) {
    return this.pricingService.updatePriceList(req.user.company_id, id, dto);
  }

  @Delete('price-lists/:id')
  @RequirePermissions('pricing.price_list.manage')
  async deletePriceList(@Request() req: any, @Param('id') id: string) {
    return this.pricingService.deletePriceList(req.user.company_id, id);
  }

  // ── Price List Items & Slabs ──────────────────────────────────────────────

  @Post('price-lists/:id/items')
  @RequirePermissions('pricing.price_list.manage')
  async addPriceListItem(
    @Request() req: any,
    @Param('id') priceListId: string,
    @Body() dto: CreatePriceListItemDto,
  ) {
    return this.pricingService.addPriceListItem(req.user.company_id, priceListId, dto);
  }

  @Patch('price-lists/:id/items/:itemId')
  @RequirePermissions('pricing.price_list.manage')
  async updatePriceListItem(
    @Request() req: any,
    @Param('id') priceListId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePriceListItemDto,
  ) {
    return this.pricingService.updatePriceListItem(req.user.company_id, priceListId, itemId, dto);
  }

  @Delete('price-lists/:id/items/:itemId')
  @RequirePermissions('pricing.price_list.manage')
  async deletePriceListItem(
    @Request() req: any,
    @Param('id') priceListId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.pricingService.deletePriceListItem(req.user.company_id, priceListId, itemId);
  }

  // ── Customer Rates & Slabs ────────────────────────────────────────────────

  @Post('customer-rates')
  @RequirePermissions('pricing.price_list.manage')
  async createCustomerRate(@Request() req: any, @Body() dto: CreateCustomerRateDto) {
    return this.pricingService.createCustomerRate(req.user.company_id, dto);
  }

  @Get('customer-rates')
  @RequirePermissions('pricing.price_list.read')
  async getCustomerRates(@Request() req: any, @Query('party_id') partyId?: string) {
    return this.pricingService.getCustomerRates(req.user.company_id, partyId);
  }

  @Patch('customer-rates/:id')
  @RequirePermissions('pricing.price_list.manage')
  async updateCustomerRate(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateCustomerRateDto) {
    return this.pricingService.updateCustomerRate(req.user.company_id, id, dto);
  }

  @Delete('customer-rates/:id')
  @RequirePermissions('pricing.price_list.manage')
  async deleteCustomerRate(@Request() req: any, @Param('id') id: string) {
    return this.pricingService.deleteCustomerRate(req.user.company_id, id);
  }

  // ── Promotion Schemes ─────────────────────────────────────────────────────

  @Post('schemes')
  @RequirePermissions('pricing.scheme.manage')
  async createPromotionScheme(@Request() req: any, @Body() dto: CreatePromotionSchemeDto) {
    return this.pricingService.createPromotionScheme(req.user.company_id, dto);
  }

  @Get('schemes')
  @RequirePermissions('pricing.scheme.read')
  async getPromotionSchemes(
    @Request() req: any,
    @Query('scheme_type') schemeType?: string,
    @Query('status') status?: string,
  ) {
    return this.pricingService.getPromotionSchemes(req.user.company_id, { schemeType, status });
  }

  @Get('schemes/:id')
  @RequirePermissions('pricing.scheme.read')
  async getPromotionSchemeById(@Request() req: any, @Param('id') id: string) {
    return this.pricingService.getPromotionSchemeById(req.user.company_id, id);
  }

  @Patch('schemes/:id')
  @RequirePermissions('pricing.scheme.manage')
  async updatePromotionScheme(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePromotionSchemeDto,
  ) {
    return this.pricingService.updatePromotionScheme(req.user.company_id, id, dto);
  }

  @Delete('schemes/:id')
  @RequirePermissions('pricing.scheme.manage')
  async deletePromotionScheme(@Request() req: any, @Param('id') id: string) {
    return this.pricingService.deletePromotionScheme(req.user.company_id, id);
  }

  // ── Pricing Evaluation & Explain ──────────────────────────────────────────

  @Post('evaluate')
  @RequirePermissions('pricing.price_list.read')
  async evaluatePricingPreview(@Request() req: any, @Body() dto: EvaluatePricingDto) {
    return this.pricingService.evaluatePricingPreview(req.user.company_id, dto);
  }

  @Get('explain/:itemId')
  @RequirePermissions('pricing.price_list.read')
  async explainPricing(
    @Request() req: any,
    @Param('itemId') itemId: string,
    @Query('party_id') partyId?: string,
    @Query('quantity') quantity?: string,
    @Query('branch_id') branchId?: string,
    @Query('customer_type') customerType?: string,
  ) {
    return this.pricingEngine.explainPricing(
      req.user.company_id,
      partyId,
      itemId,
      undefined,
      quantity || '1',
      { branchId, customerType },
    );
  }

  // ── Trace Inspection ──────────────────────────────────────────────────────

  @Get('traces/:documentType/:documentId')
  @RequirePermissions('pricing.price_list.read')
  async getPricingTraces(
    @Request() req: any,
    @Param('documentType') documentType: string,
    @Param('documentId') documentId: string,
  ) {
    return this.pricingService.getPricingTraces(req.user.company_id, documentType, documentId);
  }
}
