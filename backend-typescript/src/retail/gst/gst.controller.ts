import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, RequirePermissions } from '../../common/guards/auth.guard';
import { FeatureGuard, RequireFeature } from '../../common/guards/feature.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { GstBillsQueryDto, GstInvoiceDto, GstProfileDto } from './gst.dto';
import { RetailGstService } from './gst.service';

@Controller('api/v1/retail/gst')
@UseGuards(AuthGuard,SubscriptionGuard,FeatureGuard)
@RequireFeature('RETAIL_POS')
export class RetailGstController {
  constructor(private gst:RetailGstService) {}
  @Get('profile') @RequirePermissions('sales.read')
  profile(@Req() req:any) { return this.gst.profile(req.user.company_id); }
  @Put('profile') @RequirePermissions('settings.write')
  @RequireFeature('RETAIL_POS','GST_INVOICES')
  saveProfile(@Req() req:any,@Body() dto:GstProfileDto) { return this.gst.saveProfile(req.user.company_id,req.user.branch_id,req.user.id,dto); }
  @Get('bills') @RequirePermissions('sales.read')
  bills(@Req() req:any,@Query() query:GstBillsQueryDto) { return this.gst.bills(req.user.company_id,req.user.branch_id,query); }
  @Get('bills/:id') @RequirePermissions('sales.read')
  draft(@Req() req:any,@Param('id',ParseUUIDPipe) id:string) { return this.gst.draft(req.user.company_id,req.user.branch_id,id); }
  @Post('bills/:id/preview') @RequirePermissions('sales.read')
  @RequireFeature('RETAIL_POS','GST_INVOICES')
  preview(@Req() req:any,@Param('id',ParseUUIDPipe) id:string,@Body() dto:GstInvoiceDto) { return this.gst.preview(req.user.company_id,req.user.branch_id,id,dto); }
  @Post('bills/:id/issue') @RequirePermissions('sales.write')
  @RequireFeature('RETAIL_POS','GST_INVOICES')
  issue(@Req() req:any,@Param('id',ParseUUIDPipe) id:string,@Body() dto:GstInvoiceDto) { return this.gst.issue(req.user.company_id,req.user.branch_id,req.user.id,id,dto); }
}
