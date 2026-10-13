import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards, Request } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { PurchaseConversionService } from './conversion.service';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../common/guards/auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { FeatureGuard, RequireFeature } from '../common/guards/feature.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermissions } from '../common/guards/auth.guard';

@Controller('api/v1/purchase')
@UseGuards(AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard)
@RequireFeature('PURCHASING')
export class PurchaseController {
  constructor(
    private readonly purchaseService: PurchaseService,
    private readonly conversionService: PurchaseConversionService
  ) {}

  // Dashboard
  @Get('dashboard')
  @RequirePermissions('purchase.read')
  getDashboard(@Request() req: any) {
    return this.purchaseService.getPurchasingDashboard(req.user.company_id);
  }

  // PO
  @Post('orders')
  @RequirePermissions('purchase.create')
  createPurchaseOrder(@Request() req: any, @Body() data: any) {
    const payload: Prisma.PurchaseOrderCreateInput = {
      ...data,
      document_date: new Date(data.document_date),
      expected_delivery_date: data.expected_delivery_date ? new Date(data.expected_delivery_date) : undefined,
      company: { connect: { id: req.user.company_id } },
      branch: { connect: { id: req.user.branch_id || data.branch_id } },
      party: { connect: { id: data.party_id } },
      lines: {
        create: data.lines.map((l: any) => ({
          ...l,
          item: { connect: { id: l.item_id } },
          unit: { connect: { id: l.unit_id } }
        }))
      }
    };
    delete (payload as any).company_id;
    delete (payload as any).branch_id;
    delete (payload as any).party_id;

    return this.purchaseService.createPurchaseOrder(payload);
  }

  @Get('orders')
  @RequirePermissions('purchase.read')
  getPurchaseOrders(@Request() req: any) {
    return this.purchaseService.getPurchaseOrders(req.user.company_id);
  }

  @Get('orders/:id')
  @RequirePermissions('purchase.read')
  getPurchaseOrderById(@Param('id') id: string) {
    // Note: ensure Service methods also validate company_id internally
    return this.purchaseService.getPurchaseOrderById(id);
  }

  @Post('orders/:id/convert')
  @RequirePermissions('purchase.create')
  convertPurchaseOrder(@Request() req: any, @Param('id') id: string, @Body() conversionData: any) {
    return this.conversionService.convertPurchaseOrderToGoodsReceipt(req.user.company_id, id, req.user.id, conversionData);
  }

  // GRN
  @Post('receipts')
  @RequirePermissions('purchase.create')
  createGoodsReceipt(@Request() req: any, @Body() data: any) {
    return this.purchaseService.createGoodsReceiptWithQuantities(req.user.company_id, data);
  }

  @Get('receipts')
  @RequirePermissions('purchase.read')
  getGoodsReceipts(@Request() req: any) {
    return this.purchaseService.getGoodsReceipts(req.user.company_id);
  }

  @Get('receipts/:id')
  @RequirePermissions('purchase.read')
  getGoodsReceiptById(@Param('id') id: string) {
    return this.purchaseService.getGoodsReceiptById(id);
  }

  @Post('receipts/:id/post')
  @RequirePermissions('purchase.post')
  postGoodsReceipt(@Request() req: any, @Param('id') id: string) {
    return this.purchaseService.postGoodsReceipt(id, req.user.id);
  }

  @Post('receipts/:id/reverse')
  @RequirePermissions('purchase.reverse')
  reverseGoodsReceipt(@Request() req: any, @Param('id') id: string) {
    return this.purchaseService['postingService'].reverseGoodsReceipt(id, req.user.id); 
  }

  @Post('receipts/:id/convert')
  @RequirePermissions('purchase.create')
  convertGoodsReceipt(@Request() req: any, @Param('id') id: string, @Body() conversionData: any) {
    return this.conversionService.convertGoodsReceiptToPurchaseInvoice(req.user.company_id, id, req.user.id, conversionData);
  }

  // Invoices
  @Post('invoices')
  @RequirePermissions('purchase.create')
  createPurchaseInvoice(@Request() req: any, @Body() data: any) {
    return this.purchaseService.createPurchaseInvoiceWithQuantities(req.user.company_id, data);
  }

  @Get('invoices')
  @RequirePermissions('purchase.read')
  getPurchaseInvoices(@Request() req: any) {
    return this.purchaseService.getPurchaseInvoices(req.user.company_id);
  }

  @Get('invoices/:id')
  @RequirePermissions('purchase.read')
  getPurchaseInvoiceById(@Param('id') id: string) {
    return this.purchaseService.getPurchaseInvoiceById(id);
  }

  @Post('invoices/:id/post')
  @RequirePermissions('purchase.post')
  postPurchaseInvoice(@Request() req: any, @Param('id') id: string) {
    return this.purchaseService.postPurchaseInvoice(id, req.user.id);
  }

  @Post('invoices/:id/reverse')
  @RequirePermissions('purchase.reverse')
  reversePurchaseInvoice(@Request() req: any, @Param('id') id: string) {
    return this.purchaseService['postingService'].reversePurchaseInvoice(id, req.user.id);
  }

  @Get('invoices/:id/match')
  @RequirePermissions('purchase.read')
  check3WayMatch(@Param('id') id: string) {
    return this.purchaseService.perform3WayMatch(id);
  }

  // Returns
  @Post('returns')
  @RequirePermissions('purchase.create')
  createPurchaseReturn(@Request() req: any, @Body() data: any) {
    return this.purchaseService.createPurchaseReturn(req.user.company_id, data);
  }

  @Get('returns')
  @RequirePermissions('purchase.read')
  getPurchaseReturns(@Request() req: any) {
    return this.purchaseService.getPurchaseReturns(req.user.company_id);
  }

  @Get('returns/:id')
  @RequirePermissions('purchase.read')
  getPurchaseReturnById(@Param('id') id: string) {
    return this.purchaseService.getPurchaseReturnById(id);
  }

  @Post('returns/:id/post')
  @RequirePermissions('purchase.post')
  postPurchaseReturn(@Request() req: any, @Param('id') id: string) {
    return this.purchaseService.postPurchaseReturn(id, req.user.id);
  }

  @Post('returns/:id/reverse')
  @RequirePermissions('purchase.reverse')
  reversePurchaseReturn(@Request() req: any, @Param('id') id: string) {
    return this.purchaseService['postingService'].reversePurchaseReturn(id, req.user.id);
  }

  @Post('returns/:id/replace')
  @RequirePermissions('purchase.create')
  replaceReturn(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.purchaseService.createReplacement(req.user.company_id, id, req.user.id, dto);
  }
}
