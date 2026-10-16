import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard,RequirePermissions } from '../common/guards/auth.guard';
import { PrismaService } from '../database/prisma.service';
import { EntitlementService } from '../common/entitlement.service';
import { hideFinancialCosts } from '../common/financial-cost-visibility.interceptor';
@Controller('api/v1/retail/audit') @UseGuards(AuthGuard) @RequirePermissions('settings.write')
export class RetailAuditController {
  constructor(private db:PrismaService){}
  @Get() async list(@Req() req:any,@Query('source_id') sourceId?:string,@Query('before') before?:string){
    const valid=/^[a-f0-9-]{36}$/i;
    const rows=await this.db.auditLog.findMany({where:{company_id:req.user.company_id,...(req.user.branch_id?{OR:[{branch_id:req.user.branch_id},{branch_id:null}]}:{}),...(sourceId&&valid.test(sourceId)?{source_document_id:sourceId}:{}),...(before&&!Number.isNaN(Date.parse(before))?{created_at:{lt:new Date(before)}}:{})},take:100,orderBy:[{created_at:'desc'},{id:'desc'}],include:{user:{select:{display_name:true,username:true}}}});
    const permitted=['OWNER','ADMIN','TENANT_ADMIN'].includes(req.user.role)||req.user.permissions?.includes('reports.read');
    const effective=permitted?await new EntitlementService(this.db).resolve(req.user.organization_id,this.db,req.user.company_id):null;
    const costs=permitted&&['REPORTS','PROFIT_REPORTING'].every(code=>effective?.features.some(f=>f.code===code&&f.enabled));
    const visible=costs?rows:rows.map(row=>{try{return {...row,details:JSON.stringify(hideFinancialCosts(JSON.parse(row.details||'null')))};}catch{return row;}});
    return {rows:visible,next:rows.length===100?rows[rows.length-1].created_at.toISOString():null};
  }
}
