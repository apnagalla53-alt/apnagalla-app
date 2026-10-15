import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, RequirePermissions } from '../common/guards/auth.guard';
import { FeatureGuard, RequireFeature } from '../common/guards/feature.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ItemCompositionService } from './item-composition.service';
import { BundleRecipeDto, ModifierGroupsDto, AddVariantDto, AddConversionDto, SetupVariantsDto, UnitPricesDto } from './item-composition.dto';

@Controller('api/v1/retail/items/:id') @UseGuards(AuthGuard, FeatureGuard, PermissionGuard) @RequireFeature('INVENTORY')
export class ItemCompositionController {
  constructor(private readonly service: ItemCompositionService) {}
  @Get('composition') @RequirePermissions('inventory.read')
  get(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.getComposition(req.user.company_id, id); }
  @Put('bundle') @RequireFeature('INVENTORY', 'BUNDLES') @RequirePermissions('inventory.write')
  bundle(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BundleRecipeDto) { return this.service.replaceBundle(req.user, id, dto); }
  @Put('modifiers') @RequireFeature('INVENTORY', 'MODIFIERS') @RequirePermissions('inventory.write')
  modifiers(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ModifierGroupsDto) { return this.service.replaceModifiers(req.user, id, dto); }
  @Post('variants') @RequireFeature('INVENTORY', 'VARIANTS') @RequirePermissions('inventory.write')
  variant(@Req() req:any,@Param('id',ParseUUIDPipe) id:string,@Body() dto:AddVariantDto) {return this.service.addVariant(req.user,id,dto);}
  @Post('variants/setup') @RequireFeature('INVENTORY', 'VARIANTS') @RequirePermissions('inventory.write')
  setupVariants(@Req() req:any,@Param('id',ParseUUIDPipe) id:string,@Body() dto:SetupVariantsDto) {return this.service.setupVariants(req.user,id,dto);}
  @Post('unit-conversions') @RequireFeature('INVENTORY', 'MULTI_UNIT') @RequirePermissions('inventory.write')
  conversion(@Req() req:any,@Param('id',ParseUUIDPipe) id:string,@Body() dto:AddConversionDto) {return this.service.addConversion(req.user,id,dto);}
  @Put('unit-prices') @RequireFeature('INVENTORY','MULTI_UNIT') @RequirePermissions('inventory.write')
  unitPrices(@Req() req:any,@Param('id',ParseUUIDPipe) id:string,@Body() dto:UnitPricesDto) {return this.service.saveUnitPrices(req.user,id,dto);}
}
