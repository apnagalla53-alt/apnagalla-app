import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, IsDateString, MaxLength, Matches } from 'class-validator';
import { AuthGuard, RequirePermissions } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { FeatureGuard, RequireFeature } from '../../common/guards/feature.guard';
import { FinancialReportsService } from './financial-reports.service';

export class FinancialFilter {
  @IsOptional() @IsDateString() from?:string;
  @IsOptional() @IsDateString() to?:string;
  @IsOptional() @IsUUID() branch_id?:string;
  @IsOptional() @IsUUID() godown_id?:string;
  @IsOptional() @IsUUID() item_id?:string;
  @IsOptional() @IsUUID() bill_id?:string;
  @IsOptional() @IsUUID() variant_id?:string;
  @IsOptional() @IsUUID() customer_id?:string;
  @IsOptional() @IsUUID() staff_id?:string;
  @IsOptional() @IsString() @MaxLength(100) category?:string;
  @IsOptional() @IsString() @MaxLength(100) search?:string;
  @IsOptional() @IsString() offset?:string;
  @IsOptional() @IsString() threshold?:string;
  @IsOptional() @IsString() interval?:string;
  @IsOptional() @IsString() missing?:string;
}
class MissingCostDto {
  @IsUUID() item_id!:string;
  @IsOptional() @IsUUID() variant_id?:string;
  @IsString() @Matches(/^\d+(\.\d{1,12})?$/) cost_per_base_unit!:string;
  @IsString() @MaxLength(500) note!:string;
}
@Controller('api/v1/retail/reports/financial')
@UseGuards(AuthGuard,SubscriptionGuard,FeatureGuard,PermissionGuard)
@RequireFeature('REPORTS','PROFIT_REPORTING')
@RequirePermissions('reports.read')
export class FinancialReportsController {
  constructor(private reports:FinancialReportsService){}
  private scope(req:any,f:FinancialFilter){if(f.branch_id&&f.branch_id!==req.user.branch_id&&!['OWNER','ADMIN','TENANT_ADMIN'].includes(req.user.role))throw new ForbiddenException('Select your authorized branch');return {...f,branch_id:f.branch_id||req.user.branch_id};}
  @Get('filters') filters(@Req() req:any,@Query('type') type:string,@Query('search') search?:string,@Query('item_id') item?:string){return this.reports.filterOptions(req.user.company_id,type,search,item);}
  @Get('summary') summary(@Req() req:any,@Query() f:FinancialFilter){return this.reports.summary(req.user.company_id,this.scope(req,f));}
  @Get('valuation') valuation(@Req() req:any,@Query() f:FinancialFilter){return this.reports.valuation(req.user.company_id,this.scope(req,f));}
  @Get('coverage') async coverage(@Req() req:any,@Query() f:FinancialFilter){return {summary:await this.summary(req,f),stock:await this.valuation(req,{...f,missing:'true'})};}
  @Post('missing-cost') @RequirePermissions('reports.read','inventory.write')
  correct(@Req() req:any,@Body() dto:MissingCostDto){return this.reports.correctMissingCost(req.user.company_id,req.user.branch_id,req.user.id,dto);}
  @Get(':group') grouped(@Req() req:any,@Query() f:FinancialFilter,@Param('group') group:string){return this.reports.grouped(req.user.company_id,this.scope(req,f),group);}
}
