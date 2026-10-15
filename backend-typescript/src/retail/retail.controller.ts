import {
  Controller,
  BadRequestException,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  Patch,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RetailService } from './retail.service';
import { ItemRemovalService } from './item-removal.service';
import { ItemRemovalDto } from './dto/item-removal.dto';
import {
  CreateRetailItemDto,
  UpdateRetailItemDto,
  InlineRetailItemDto,
  BulkRetailItemsDto,
} from './dto/retail-item.dto';
import {
  CreateRetailCustomerDto,
  UpdateRetailCustomerDto,
  ReceivePaymentDto,
} from './dto/retail-customer.dto';
import {
  CreateRetailSupplierDto,
  UpdateRetailSupplierDto,
  PaySupplierDto,
} from './dto/retail-supplier.dto';
import { CreateRetailPurchaseDto } from './dto/retail-purchase.dto';
import { CreateNeedListDto, UpdateNeedStatusDto, UpdateNeedListDto } from './dto/retail-need.dto';
import { AuthGuard, RequirePermissions } from '../common/guards/auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { FeatureGuard, RequireFeature } from '../common/guards/feature.guard';
import { FinancialCostVisibilityInterceptor } from '../common/financial-cost-visibility.interceptor';
import { PrismaService } from '../database/prisma.service';
import { ItemCompositionService } from '../item-composition/item-composition.service';

@Controller('api/v1/retail')
@UseGuards(AuthGuard, SubscriptionGuard, FeatureGuard)
@RequireFeature('RETAIL_POS')
@UseInterceptors(FinancialCostVisibilityInterceptor)
export class RetailController {
  constructor(private readonly retailService: RetailService, private readonly itemRemoval: ItemRemovalService,private readonly db:PrismaService,private readonly composition:ItemCompositionService) {}

  // ── ITEMS ──────────────────────────────────────────────────────────

  @Get('units')
  @RequireFeature('RETAIL_POS', 'INVENTORY')
  getUnits(@Req() req: any) {
    return this.retailService.getUnits(req.user.company_id);
  }

  @Get('items')
  async getItems(
    @Req() req: any,
    @Query('search') search?: string,
    @Query() query?: any,
  ) {
    const { company_id } = req.user;
    return this.retailService.getItems(company_id, search, query);
  }

  @Post('items')
  async createItem(@Req() req: any, @Body() dto: CreateRetailItemDto) {
    const { company_id, id: userId, branch_id } = req.user;
    const financialYearId = req.headers['x-financial-year-id'];
    return this.retailService.createItem(
      company_id,
      userId,
      financialYearId,
      branch_id,
      dto,
    );
  }

  @Post('items/bulk')
  @RequirePermissions('inventory.write')
  async bulkItems(@Req() req:any,@Body() dto:BulkRetailItemsDto){
    return this.db.runAtomic(async()=>{
      const rows:any[]=[];
      for(let index=0;index<dto.items.length;index++){
        try{rows.push(await this.retailService.createItem(req.user.company_id,req.user.id,req.user.financial_year_id,req.user.branch_id,dto.items[index]));}
        catch(error){if(error instanceof BadRequestException)throw new BadRequestException({message:'Row '+(index+1)+': '+error.message,row_index:index});throw error;}
      }
      return {items:rows,count:rows.length};
    });
  }

  @Post('items/inline')
  @RequirePermissions('inventory.write')
  async inlineItem(@Req() req:any,@Body() dto:InlineRetailItemDto){
    const {purchase_unit_code,purchase_unit_factor,purchase_unit_selling_price,...itemData}=dto;
    return this.db.runAtomic(async()=>{
      const item=await this.retailService.createItem(req.user.company_id,req.user.id,req.user.financial_year_id,req.user.branch_id,itemData);
      let purchase_unit_id=item.primary_unit_id;
      if(purchase_unit_code&&purchase_unit_code!==item.unit){
        if(!(purchase_unit_factor!>0))throw new BadRequestException('Enter the number of sale units in one purchase unit');
        const conversion=await this.composition.addConversion(req.user,item.id,{unit_code:purchase_unit_code,conversion_factor:purchase_unit_factor!,selling_price:purchase_unit_selling_price});
        purchase_unit_id=conversion.from_unit_id;
      }
      return {...item,purchase_unit_id};
    });
  }

  @Get('item-categories')
  getItemCategories(
    @Req() req: any,
    @Query('search') search?: string,
    @Query() query?: any,
  ) {
    return this.retailService.getItemCategories(
      req.user.company_id,
      search,
      query,
    );
  }

  @Post('items/removal')
  @RequirePermissions('inventory.write')
  removeSelectedItems(@Req() req:any, @Body() dto:ItemRemovalDto) {
    return this.itemRemoval.remove(req.user.company_id, req.user.id, dto.ids, dto.action, dto.confirmation);
  }

  @Get('items/:id/removal')
  @RequirePermissions('inventory.write')
  itemRemovalPreflight(@Req() req:any, @Param('id',new ParseUUIDPipe()) id:string) {
    return this.itemRemoval.preflight(req.user.company_id, id);
  }

  @Get('items/:id/options')
  getItemOptions(@Req() req: any, @Param('id') id: string) {
    return this.retailService.getItemOptions(
      req.user.company_id,
      req.user.branch_id,
      id,
    );
  }

  @Post('items/:id') // Using POST for simpler proxying or use PATCH
  @RequirePermissions('inventory.write')
  async updateItem(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateRetailItemDto,
  ) {
    return this.retailService.updateItem(req.user.company_id, id, dto, req.user.id);
  }

  @Delete('items/:id')
  @RequirePermissions('inventory.write')
  removeItem(@Req() req:any,@Param('id') id:string) {
    return this.retailService.updateItem(req.user.company_id,id,{active:false},req.user.id);
  }

  @Patch('customers/:id')
  @RequirePermissions('accounting.write')
  updateCustomer(@Req() req:any,@Param('id') id:string,@Body() dto:UpdateRetailCustomerDto) {
    return this.retailService.updateParty(req.user.company_id,id,'CUSTOMER',dto,req.user.id);
  }
  @Delete('customers/:id')
  @RequirePermissions('accounting.write')
  removeCustomer(@Req() req:any,@Param('id') id:string) {
    return this.retailService.updateParty(req.user.company_id,id,'CUSTOMER',{active:false},req.user.id);
  }
  @Patch('suppliers/:id')
  @RequirePermissions('purchase.write')
  updateSupplier(@Req() req:any,@Param('id') id:string,@Body() dto:UpdateRetailSupplierDto) {
    return this.retailService.updateParty(req.user.company_id,id,'SUPPLIER',dto,req.user.id);
  }
  @Delete('suppliers/:id')
  @RequirePermissions('purchase.write')
  removeSupplier(@Req() req:any,@Param('id') id:string) {
    return this.retailService.updateParty(req.user.company_id,id,'SUPPLIER',{active:false},req.user.id);
  }

  // ── CUSTOMERS ──────────────────────────────────────────────────────
  @Get('warranty')
  @RequireFeature('RETAIL_POS','SERIAL_TRACKING')
  lookupWarranty(@Req() req: any, @Query('search') search: string) {
    return this.retailService.lookupWarranty(req.user.company_id, search);
  }

  @Get('customers')
  async getCustomers(
    @Req() req: any,
    @Query('search') search?: string,
    @Query() query?: any,
  ) {
    const { company_id } = req.user;
    return this.retailService.getCustomers(company_id, search, query);
  }

  @Post('customers')
  async createCustomer(@Req() req: any, @Body() dto: CreateRetailCustomerDto) {
    const { company_id } = req.user;
    return this.retailService.createCustomer(company_id, dto, {
      branchId: req.user.branch_id,
      financialYearId:
        req.user.financial_year_id || req.headers['x-financial-year-id'],
      userId: req.user.id,
    });
  }

  @Get('customers/:id/khata')
  async getCustomerKhata(@Req() req: any, @Param('id') id: string) {
    const { company_id } = req.user;
    return this.retailService.getCustomerKhata(company_id, id);
  }

  @Post('customers/:id/payments')
  async receivePayment(
    @Req() req: any,
    @Param('id') partyId: string,
    @Body() dto: ReceivePaymentDto,
  ) {
    const { company_id, branch_id, id: userId } = req.user;
    const financialYearId = req.headers['x-financial-year-id'];
    return this.retailService.receivePayment(
      company_id,
      branch_id,
      financialYearId,
      userId,
      partyId,
      dto,
    );
  }

  // ── SUPPLIERS ──────────────────────────────────────────────────────

  @Get('suppliers')
  async getSuppliers(
    @Req() req: any,
    @Query('search') search?: string,
    @Query() query?: any,
  ) {
    const { company_id } = req.user;
    return this.retailService.getSuppliers(company_id, search, query);
  }

  @Post('suppliers')
  async createSupplier(@Req() req: any, @Body() dto: CreateRetailSupplierDto) {
    const { company_id } = req.user;
    return this.retailService.createSupplier(company_id, dto, {
      branchId: req.user.branch_id,
      financialYearId: req.user.financial_year_id,
      userId: req.user.id,
    });
  }

  @Get('suppliers/:id/khata')
  async getSupplierKhata(@Req() req: any, @Param('id') id: string) {
    const { company_id } = req.user;
    return this.retailService.getSupplierKhata(company_id, id);
  }

  @Post('suppliers/:id/payments')
  async paySupplier(
    @Req() req: any,
    @Param('id') partyId: string,
    @Body() dto: PaySupplierDto,
  ) {
    const { company_id, branch_id, id: userId } = req.user;
    const financialYearId = req.headers['x-financial-year-id'];
    return this.retailService.paySupplier(
      company_id,
      branch_id,
      financialYearId,
      userId,
      partyId,
      dto,
    );
  }

  // ── PURCHASES ──────────────────────────────────────────────────────

  @Get('purchases')
  async getPurchases(@Req() req: any, @Query() query: any) {
    const { company_id } = req.user;
    return this.retailService.getPurchases(company_id, query);
  }

  @Post('purchases')
  async createPurchase(@Req() req: any, @Body() dto: CreateRetailPurchaseDto) {
    const { company_id, branch_id, id: userId } = req.user;
    const financialYearId = req.headers['x-financial-year-id'];
    return this.retailService.createPurchase(
      company_id,
      branch_id,
      financialYearId,
      userId,
      dto,
    );
  }

  // ── NEED LIST ──────────────────────────────────────────────────────

  @Get('needs')
  async getNeeds(@Req() req: any, @Query() query: any) {
    const { company_id } = req.user;
    return this.retailService.getNeeds(company_id, query);
  }

  @Post('needs')
  async createNeed(@Req() req: any, @Body() dto: CreateNeedListDto) {
    const { company_id, branch_id, id: userId } = req.user;
    return this.retailService.createNeed(company_id, branch_id, userId, dto);
  }

  @Post('needs/:id/status')
  async updateNeedStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateNeedStatusDto,
  ) {
    const { company_id } = req.user;
    return this.retailService.updateNeedStatus(id, company_id, dto);
  }

  @Patch('needs/:id')
  @RequirePermissions('inventory.write')
  updateNeed(@Req() req:any,@Param('id') id:string,@Body() dto:UpdateNeedListDto) {
    return this.retailService.updateNeed(id,req.user.company_id,dto,req.user.id);
  }
}
