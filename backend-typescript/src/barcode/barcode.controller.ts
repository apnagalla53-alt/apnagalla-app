import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { BarcodeService } from './barcode.service';
import { BarcodePrintService } from './barcode-print.service';
import { AssignBarcodeDto } from './dto/assign-barcode.dto';
import { GenerateBarcodeDto } from './dto/generate-barcode.dto';
import { GenerateProductLabelDto, RecordPrintJobDto } from './dto/print-label.dto';
import { InwardLabelRequestDto } from './dto/inward-label.dto';
import { CreateLabelTemplateDto, UpdateLabelTemplateDto } from './dto/label-template.dto';
import { AuthGuard, RequirePermissions } from '../common/guards/auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { FeatureGuard, RequireFeature } from '../common/guards/feature.guard';
import { PermissionGuard } from '../common/guards/permission.guard';

@Controller('api/v1/barcodes')
@UseGuards(AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard)
@RequireFeature('INVENTORY')
export class BarcodeController {
  constructor(
    private readonly barcodeService: BarcodeService,
    private readonly barcodePrintService: BarcodePrintService,
  ) {}

  // ── Barcode Assignment & Lookup ───────────────────────────────────────────

  @Post('assign')
  @RequirePermissions('barcode.create')
  async assignBarcode(@Request() req: any, @Body() dto: AssignBarcodeDto) {
    return this.barcodeService.assignBarcode(req.user.company_id, req.user.id, dto);
  }

  @Get('item/:itemId')
  @RequirePermissions('barcode.read')
  async getBarcodesByItem(@Request() req: any, @Param('itemId') itemId: string) {
    return this.barcodeService.getBarcodesByItem(req.user.company_id, itemId);
  }

  @Get('lookup/:barcode')
  @RequirePermissions('barcode.read')
  async lookupBarcode(@Request() req: any, @Param('barcode') barcode: string) {
    return this.barcodeService.lookupBarcode(req.user.company_id, barcode);
  }

  @Post('generate')
  @RequirePermissions('barcode.create')
  async generateBarcode(@Request() req: any, @Body() dto: GenerateBarcodeDto) {
    return this.barcodeService.generateBarcode(req.user.company_id, dto);
  }

  @Patch(':id/primary')
  @RequirePermissions('barcode.update')
  async setPrimaryBarcode(@Request() req: any, @Param('id') id: string) {
    return this.barcodeService.setPrimaryBarcode(req.user.company_id, req.user.id, id);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('barcode.update')
  async deactivateBarcode(@Request() req: any, @Param('id') id: string) {
    return this.barcodeService.deactivateBarcode(req.user.company_id, req.user.id, id);
  }

  @Delete(':id')
  @RequirePermissions('barcode.delete')
  async deleteBarcode(@Request() req: any, @Param('id') id: string) {
    return this.barcodeService.deleteBarcode(req.user.company_id, req.user.id, id);
  }

  // ── Labels & Printing ─────────────────────────────────────────────────────

  @Post('labels/product')
  @RequirePermissions('label.print')
  async generateProductLabel(@Request() req: any, @Body() dto: GenerateProductLabelDto) {
    return this.barcodePrintService.generateProductLabel(req.user.company_id, req.user.id, dto);
  }

  @Post('labels/inward')
  @RequirePermissions('label.print')
  async generateInwardLabels(@Request() req: any, @Body() dto: InwardLabelRequestDto) {
    return this.barcodePrintService.generateInwardLabels(req.user.company_id, req.user.id, dto);
  }

  @Post('labels/print-job')
  @RequirePermissions('label.print')
  async recordPrintJob(@Request() req: any, @Body() dto: RecordPrintJobDto) {
    return this.barcodePrintService.recordPrintJob(req.user.company_id, req.user.id, dto);
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  @Post('templates')
  @RequirePermissions('barcode.create')
  async createTemplate(@Request() req: any, @Body() dto: CreateLabelTemplateDto) {
    return this.barcodePrintService.createTemplate(req.user.company_id, dto);
  }

  @Get('templates')
  @RequirePermissions('barcode.read')
  async getTemplates(@Request() req: any, @Query('type') type?: string) {
    return this.barcodePrintService.getTemplates(req.user.company_id, type);
  }

  @Get('templates/:id')
  @RequirePermissions('barcode.read')
  async getTemplateById(@Request() req: any, @Param('id') id: string) {
    return this.barcodePrintService.getTemplateById(req.user.company_id, id);
  }

  @Patch('templates/:id')
  @RequirePermissions('barcode.update')
  async updateTemplate(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateLabelTemplateDto) {
    return this.barcodePrintService.updateTemplate(req.user.company_id, id, dto);
  }

  @Delete('templates/:id')
  @RequirePermissions('barcode.delete')
  async deleteTemplate(@Request() req: any, @Param('id') id: string) {
    return this.barcodePrintService.deleteTemplate(req.user.company_id, id);
  }
}
