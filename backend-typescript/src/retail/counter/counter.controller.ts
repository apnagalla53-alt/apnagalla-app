import { Controller, Get, Post, Delete, Param, Query, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, RequirePermissions } from '../../common/guards/auth.guard';
import { FeatureGuard, RequireFeature } from '../../common/guards/feature.guard';
import { CounterService } from './counter.service';
import { UpiProfileDto, CashCountDto } from './counter.dto';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
@Controller('api/v1/retail') @UseGuards(AuthGuard,FeatureGuard) @RequireFeature('RETAIL_POS')
export class CounterController {
  constructor(private counter:CounterService) {}
  @Get('payments/upi') @RequirePermissions('sales.read')
  upi(@Req() req:any){return this.counter.upi(req.user.company_id);}
  @Post('payments/upi') @RequirePermissions('settings.write')
  save(@Req() req:any,@Body() dto:UpiProfileDto){return this.counter.saveUpi(req.user.company_id,req.user.branch_id,req.user.id,dto);}
  @Get('payments/upi/qr') @RequirePermissions('sales.read')
  qr(@Req() req:any,@Query('amount') amount?:string,@Query('profile_id') profileId?:string){return this.counter.qr(req.user.company_id,amount===undefined?undefined:Number(amount),profileId);}
  @Delete('payments/upi/:id') @RequirePermissions('settings.write')
  removeUpi(@Req() req:any,@Param('id') id:string){return this.counter.removeUpi(req.user.company_id,req.user.branch_id,req.user.id,id);}
  @Get('galla') @RequirePermissions('accounting.read')
  galla(@Req() req:any,@Query('date') date?:string){return this.counter.galla(req.user.company_id,req.user.branch_id,date||today());}
  @Post('galla/count') @RequirePermissions('accounting.write')
  count(@Req() req:any,@Body() dto:CashCountDto){return this.counter.count(req.user.company_id,req.user.branch_id,req.user.id,dto);}
  @Get('galla/history') @RequirePermissions('accounting.read')
  history(@Req() req:any,@Query('before') before?:string){return this.counter.history(req.user.company_id,req.user.branch_id,before||today());}
}
