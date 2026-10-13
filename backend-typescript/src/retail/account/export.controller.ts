import { Controller, Get, Param, Query, Req, UseGuards, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsUUID, IsString, MaxLength, Max, Min, IsNumberString } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '../../common/guards/auth.guard';
import { EntitlementService } from '../../common/entitlement.service';
import { PrismaService } from '../../database/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { FinancialReportsService } from '../reports/financial-reports.service';
import { ReportFilterDto } from '../reports/dto/report-filter.dto';
import { RetailService } from '../retail.service';
import { throttleOperation } from '../../common/operation-throttle';
export class ExportQuery extends ReportFilterDto {
  @IsOptional() @Type(()=>Number) @IsInt() @Min(0) offset?:number;
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(1000) limit?:number;
  @IsOptional() @IsUUID() party_id?:string;
  @IsOptional() @IsString() @MaxLength(36000) ids?:string;
  @IsOptional() @IsString() @MaxLength(255) search?:string;
  @IsOptional() @IsIn(['CUSTOMER','SUPPLIER']) party_type?:'CUSTOMER'|'SUPPLIER';
  @IsOptional() @IsIn(['items','bills','categories','customers','staff','margin','low-margin','below-cost','unknown-sales','trend','summary','valuation']) group?:string;
  @IsOptional() @IsString() @MaxLength(255) category?:string;
  @IsOptional() @IsUUID() bill_id?:string;
  @IsOptional() @IsIn(['true','false']) missing?:string;
  @IsOptional() @IsIn(['day','week','month']) interval?:string;
  @IsOptional() @IsNumberString() threshold?:string;
}
const permissions:Record<string,string>={ITEMS:'inventory.read',STOCK:'inventory.read',CUSTOMERS:'accounting.read',SUPPLIERS:'purchase.read',KHATA:'accounting.read',SALES:'reports.read',PURCHASES:'reports.read',EXPENSES:'reports.read',GST:'sales.read',PROFIT:'reports.read',STAFF:'identity.admin',LOCATIONS:'identity.admin',DOCUMENTS:'documents.read',RETURNS:'reports.read'};
@Controller('api/v1/retail/account/exports')
@UseGuards(AuthGuard)
export class RetailExportController {
  constructor(private db:PrismaService,private entitlements:EntitlementService,private reports:ReportsService,private financial:FinancialReportsService,private retail:RetailService){}
  @Get(':kind')
  async export(@Req() req:any,@Param('kind') kind:string,@Query() query:ExportQuery) {
    kind=kind.toUpperCase();const permission=permissions[kind];
    if(!permission)throw new NotFoundException('This export format is not implemented');
    if(!['OWNER','ADMIN','TENANT_ADMIN'].includes(req.user.role)&&!req.user.permissions.includes(permission))throw new ForbiddenException('Insufficient export permissions');
    const entitlement=kind==='RETURNS'?'EXPORT_SALES':'EXPORT_'+kind;
    await this.entitlements.require(req.user.organization_id,[entitlement,...(kind==='PROFIT'?['PROFIT_REPORTING']:[])],req.user.company_id);
    if(query.from&&query.to&&query.from>query.to)throw new BadRequestException('End date must be after the start date');
    if(kind==='KHATA'&&!!query.from!==!!query.to)throw new BadRequestException('Select both dates for a ledger range');
    await throttleOperation('report-export:'+req.user.id,20);
    const company=req.user.company_id,offset=query.offset||0,limit=query.limit||500,filters={...query,branch_id:query.branch_id||req.user.branch_id};
    let records:any[]=[],headers:string[]=[];let mapped:unknown[][]|undefined,hasMore=false;
    const ids=query.ids?.split(',');if(ids&&(ids.length>1000||ids.some(id=>!/^[0-9a-f-]{36}$/i.test(id))))throw new BadRequestException('Select valid item identifiers');
    if(ids&&await this.db.item.count({where:{company_id:company,id:{in:ids}}})!==new Set(ids).size)throw new NotFoundException('Selected item not found in this shop');
    if(kind==='ITEMS')records=await this.db.item.findMany({where:{company_id:company,...(ids?{id:{in:ids}}:{}),...(query.search?{name:{contains:query.search,mode:'insensitive'}}:{})},orderBy:{id:'asc'},skip:offset,take:limit+1,select:{id:true,name:true,sku:true,barcodes:{select:{barcode:true}},default_sale_rate:true,purchase_rate:true,mrp:true,category:true,hsn_sac:true,item_type:true,inventory_tracking:true,selling_mode:true,low_stock_threshold:true,primary_unit:{select:{code:true}}}});
    else if(kind==='CUSTOMERS'||kind==='SUPPLIERS') {
      records=await this.db.party.findMany({where:{company_id:company,party_type:kind==='CUSTOMERS'?'CUSTOMER':'SUPPLIER',...(query.customer_id||query.supplier_id?{id:query.customer_id||query.supplier_id}:{}),...(query.search?{name:{contains:query.search,mode:'insensitive'}}:{})},orderBy:{id:'asc'},skip:offset,take:limit+1,select:{id:true,name:true,code:true,phone:true,email:true,address:true,gstin:true,is_active:true}});
      const balances=records.length?await this.db.billAllocation.groupBy({by:['party_id','allocation_type'],where:{company_id:company,party_id:{in:records.map(r=>r.id)}},_sum:{amount:true}}):[];
      records=records.map(p=>({...p,outstanding_amount:balances.filter(b=>b.party_id===p.id).reduce((sum,b)=>sum+Number(b._sum.amount||0)*(b.allocation_type==='NEW_REFERENCE'?1:b.allocation_type==='AGAINST_REFERENCE'?-1:0),0)}));
    }
    else if(kind==='STAFF')records=await this.db.user.findMany({where:{organization_id:req.user.organization_id,roles:{some:{company_id:company}}},orderBy:{id:'asc'},skip:offset,take:limit+1,select:{id:true,username:true,display_name:true,phone:true,email:true,is_active:true}});
    else if(kind==='LOCATIONS')records=await this.db.godown.findMany({where:{branch:{company_id:company}},orderBy:{id:'asc'},skip:offset,take:limit+1,select:{id:true,name:true,code:true,branch_id:true,is_active:true}});
    else if(kind==='DOCUMENTS')records=await this.db.attachment.findMany({where:{company_id:company},orderBy:{id:'asc'},skip:offset,take:limit+1,select:{id:true,original_file_name:true,mime_type:true,file_size:true,entity_type:true,entity_id:true,created_at:true}});
    else if(kind==='GST')records=await this.db.retailGstInvoice.findMany({where:{company_id:company,branch_id:filters.branch_id,...(query.from||query.to?{issue_date:{...(query.from?{gte:new Date(query.from)}:{}),...(query.to?{lte:new Date(query.to)}:{})}}:{})},orderBy:{id:'asc'},skip:offset,take:limit+1,select:{id:true,document_number:true,financial_year:true,issue_date:true,sales_invoice_id:true,snapshot:true}});
    else if(kind==='KHATA') {
      if(!query.party_id||!query.party_type)throw new BadRequestException('Select a customer or supplier ledger');
      const statement=await this.retail.getPartyStatement(company,query.party_id,query.party_type,offset,query.from&&query.to?{from:query.from,to:query.to}:undefined);
      records=statement.rows;hasMore=statement.hasMore;
    }else {
      const data=kind==='STOCK'?await this.reports.getStockReport(company,filters):kind==='CUSTOMERS'?await this.reports.getCustomerDueReport(company,filters):kind==='SUPPLIERS'?await this.reports.getSupplierDueReport(company,filters):kind==='SALES'?await this.reports.getSalesReport(company,filters):kind==='PURCHASES'?await this.reports.getPurchaseReport(company,filters):kind==='EXPENSES'?await this.reports.getExpenseReport(company,filters):kind==='RETURNS'?await this.reports.getReturnsReport(company,filters):query.group==='summary'||!query.group?await this.financial.summary(company,filters):query.group==='valuation'?await this.financial.valuation(company,{...filters,offset:String(offset)}):await this.financial.grouped(company,{...filters,offset:String(offset)},query.group);
      const key=({STOCK:'items',CUSTOMERS:'customers',SUPPLIERS:'suppliers',SALES:'bills',PURCHASES:'purchases',EXPENSES:'expenses',RETURNS:'returns'} as any)[kind];
      const source=key?(data as any)[key]:(data as any).rows||[data];
      const all=kind==='STOCK'?source.filter((r:any)=>(!ids||ids.includes(r.item_id))&&(!query.search||r.name.toLowerCase().includes(query.search.toLowerCase()))):source;
      records=kind==='PROFIT'&&query.group&&query.group!=='summary'?all:all.slice(offset,offset+limit+1);
      hasMore=!!(data as any).hasMore;
    }
    if(kind==='ITEMS')records=records.map(({barcodes,primary_unit,default_sale_rate,purchase_rate,...record})=>({...record,unit_code:primary_unit.code,barcode:barcodes.map((b:any)=>b.barcode).join(' | '),selling_price:default_sale_rate,purchase_price:purchase_rate}));
    if(records.length>limit){hasMore=true;records=records.slice(0,limit);}
    // Stable empty-file headers and no raw objects, credentials or filesystem paths.
    headers=records.length?Object.keys(records[0]):['No records'];
    const cell=(value:any)=>value===null||value===undefined?'':value instanceof Date?value.toISOString():typeof value==='object'?JSON.stringify(value):String(value);
    mapped=records.map(row=>headers.map(key=>cell(row[key])));
    await this.db.auditLog.create({data:{company_id:company,branch_id:req.user.branch_id,user_id:req.user.id,action:'TENANT_REPORT_EXPORTED',details:JSON.stringify({kind,offset,records:records.length,has_more:hasMore,from:query.from,to:query.to})}});
    return {kind,headers,rows:mapped,hasMore,nextOffset:hasMore?offset+records.length:null,scope:'Current page; use nextOffset for further records',attachment_files_included:false};
  }
}
