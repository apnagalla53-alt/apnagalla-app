import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { AuthGuard, RequirePermissions } from '../../common/guards/auth.guard';
import { FeatureGuard, RequireFeature } from '../../common/guards/feature.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';

class TaskDto {
  @IsString() @MinLength(1) @MaxLength(200) title: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
}
class CompleteDto { @IsBoolean() completed: boolean; }
class VisitDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsIn(['NONE','WEEKLY','MONTHLY']) cycle: string;
}
class VoiceDto {
  @IsBoolean() enabled: boolean;
  @IsString() @MinLength(1) @MaxLength(300) text: string;
  @IsIn(['en-IN','hi-IN']) language: string;
  @IsOptional() @IsNumber() @Min(0.7) @Max(1.2) rate?: number;
}
const dateOf = (value:string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Use YYYY-MM-DD');
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==value) throw new BadRequestException('Invalid calendar date');
  return date;
};
// Deliberately informational: selected Indian government holidays, not a state closure calendar.
// Verified against https://www.indiapost.gov.in/holidays-list and https://www.iirs.gov.in/holidaycalender
const HOLIDAYS_2026 = [
  ['2026-01-26','Republic Day'],['2026-03-04','Holi'],['2026-03-21','Id-ul-Fitr'],['2026-03-26','Ram Navami'],
  ['2026-03-31','Mahavir Jayanti'],['2026-04-03','Good Friday'],['2026-05-01','Buddha Purnima'],
  ['2026-05-27','Id-ul-Zuha'],['2026-06-26','Muharram'],['2026-08-15','Independence Day'],
  ['2026-08-26','Milad-un-Nabi'],['2026-09-04','Janmashtami'],['2026-10-02','Gandhi Jayanti'],
  ['2026-10-20','Dussehra'],['2026-11-08','Diwali'],['2026-11-24',"Guru Nanak's Birthday"],['2026-12-25','Christmas'],
];

@Controller('api/v1/retail')
@UseGuards(AuthGuard, SubscriptionGuard, FeatureGuard) @RequireFeature('RETAIL_POS')
export class RetailCalendarController {
  constructor(private db:PrismaService) {}

  @Get('calendar') @RequirePermissions('accounting.read')
  async calendar(@Req() req:any,@Query('month') month:string) {
    if(!/^\d{4}-\d{2}$/.test(month||''))throw new BadRequestException('Use YYYY-MM');
    const from=dateOf(month+'-01'),to=new Date(from);to.setUTCMonth(to.getUTCMonth()+1);
    const scope={company_id:req.user.company_id,branch_id:req.user.branch_id};
    const [suppliers,receivables,payables,tasks]=await Promise.all([
      this.db.party.findMany({where:{company_id:scope.company_id,party_type:'SUPPLIER',is_active:true,visit_date:{not:null,lte:new Date(to.getTime()-1)}},select:{id:true,name:true,visit_date:true,visit_cycle:true},take:1001,orderBy:{id:'asc'}}),
      this.db.salesInvoice.findMany({where:{...scope,status:'POSTED',outstanding_amount:{gt:0},due_date:{gte:from,lt:to}},select:{id:true,document_number:true,due_date:true,outstanding_amount:true,party:{select:{name:true}}},take:1001,orderBy:{due_date:'asc'}}),
      this.db.purchaseInvoice.findMany({where:{...scope,status:'POSTED',outstanding_amount:{gt:0},due_date:{gte:from,lt:to}},select:{id:true,document_number:true,due_date:true,outstanding_amount:true,party:{select:{name:true}}},take:1001,orderBy:{due_date:'asc'}}),
      this.db.retailCalendarTask.findMany({where:{...scope,date:{gte:from,lt:to}},orderBy:{date:'asc'},take:1001}),
    ]);
    const visits:any[]=[];
    for(const s of suppliers.slice(0,1000)){
      const anchor=s.visit_date!;
      for(let d=new Date(from);d<to;d.setUTCDate(d.getUTCDate()+1)){
        if(d<anchor)continue;
        const occurs=s.visit_cycle==='WEEKLY'?(d.getTime()-anchor.getTime())%(7*86400000)===0:
          s.visit_cycle==='MONTHLY'?d.getUTCDate()===Math.min(anchor.getUTCDate(),new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()):d.getTime()===anchor.getTime();
        if(occurs)visits.push({id:s.id+'-'+d.toISOString().slice(0,10),party_id:s.id,title:s.name,date:d.toISOString().slice(0,10),cycle:s.visit_cycle});
      }
    }
    return {month,visits,receivables:receivables.slice(0,1000),payables:payables.slice(0,1000),tasks:tasks.slice(0,1000),
      holidays:HOLIDAYS_2026.filter(([date])=>date.startsWith(month)).map(([date,title])=>({date,title})),
      holiday_notice:month.startsWith('2026-')?'Selected national holidays for 2026. State/local dates and lunar observances may differ.':'Holiday dates have not been published in EVOLIX for this year. Your business reminders still work.',
      holiday_source:'https://www.indiapost.gov.in/holidays-list',truncated:[suppliers,receivables,payables,tasks].some(rows=>rows.length>1000)};
  }
  @Post('calendar/tasks') @RequirePermissions('sales.write')
  createTask(@Req() req:any,@Body() dto:TaskDto){
    if(!dto.title.trim())throw new BadRequestException('Task name is required');
    return this.db.retailCalendarTask.create({data:{company_id:req.user.company_id,branch_id:req.user.branch_id,created_by:req.user.id,title:dto.title.trim(),date:dateOf(dto.date)}});
  }
  @Patch('calendar/tasks/:id') @RequirePermissions('sales.write')
  async completeTask(@Req() req:any,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CompleteDto){
    const result=await this.db.retailCalendarTask.updateMany({where:{id,company_id:req.user.company_id,branch_id:req.user.branch_id},data:{completed:dto.completed}});
    if(!result.count)throw new NotFoundException('Task not found');return {updated:true};
  }
  @Patch('calendar/suppliers/:id') @RequirePermissions('purchase.write')
  async visit(@Req() req:any,@Param('id',ParseUUIDPipe) id:string,@Body() dto:VisitDto){
    const result=await this.db.party.updateMany({where:{id,company_id:req.user.company_id,party_type:'SUPPLIER',is_active:true},data:{visit_date:dateOf(dto.date),visit_cycle:dto.cycle}});
    if(!result.count)throw new NotFoundException('Supplier not found');return {updated:true};
  }
  @Patch('calendar/receivables/:id') @RequirePermissions('sales.write')
  async promise(@Req() req:any,@Param('id',ParseUUIDPipe) id:string,@Body() dto:TaskDto){
    const date=dateOf(dto.date);
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id=${id}::uuid AND company_id=${req.user.company_id}::uuid FOR UPDATE`;
      const bill=await tx.salesInvoice.findFirst({where:{id,company_id:req.user.company_id,branch_id:req.user.branch_id,status:'POSTED',outstanding_amount:{gt:0}}});
      if(!bill)throw new NotFoundException('Unpaid bill not found');
      if(date<bill.document_date)throw new BadRequestException('Payment date cannot be before the bill date');
      await tx.salesInvoice.update({where:{id},data:{due_date:date}});
      await tx.billAllocation.updateMany({where:{company_id:req.user.company_id,reference_document_id:id,reference_document_type:'SALES_INVOICE',allocation_type:'NEW_REFERENCE'},data:{due_date:date}});
      return {updated:true};
    });
  }
  @Get('checkout-voice') @RequirePermissions('sales.read')
  async voice(@Req() req:any){
    const [configuration,shop]=await Promise.all([this.db.companyConfiguration.findUnique({where:{company_id:req.user.company_id}}),this.db.company.findUniqueOrThrow({where:{id:req.user.company_id},select:{trade_name:true,legal_name:true}})]);
    return {enabled:true,text:'Thank you for visiting {shop}. Please visit again.',language:'en-IN',rate:0.9,...(configuration?.checkout_voice_configuration as object||{}),shop_name:shop.trade_name||shop.legal_name};
  }
  @Post('checkout-voice') @RequirePermissions('settings.write')
  async saveVoice(@Req() req:any,@Body() dto:VoiceDto){
    if(!dto.text.trim())throw new BadRequestException('Enter a greeting');
    await this.db.companyConfiguration.upsert({where:{company_id:req.user.company_id},create:{company_id:req.user.company_id,checkout_voice_configuration:{...dto}},update:{checkout_voice_configuration:{...dto}}});
    return this.voice(req);
  }
}
