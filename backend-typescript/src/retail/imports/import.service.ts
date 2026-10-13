import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { RetailService } from '../retail.service';
import { OpeningStockService } from '../../inventory/opening-stock.service';
import { CreateRetailItemDto } from '../dto/retail-item.dto';
import { CreateRetailCustomerDto } from '../dto/retail-customer.dto';
import { CreateRetailSupplierDto } from '../dto/retail-supplier.dto';
import { parseExport, hash, key, SourceRow } from './import-format';
import { PRESETS, FIELDS, suggestMapping } from './import-presets';
import { businessDate } from '../../common/business-date';
import { throttleOperation } from '../../common/operation-throttle';
import { EntitlementService } from '../../common/entitlement.service';
import { importCapabilities } from './import-entitlements';

export const importOwner=(user:any)=>{
  if(!['ADMIN','OWNER','TENANT_ADMIN'].includes(user.role))throw new ForbiddenException('Only the shop owner can migrate business data');
};
function number(value:string,field:string) {
  const text=value.replace(/₹|INR|Rs\.?/gi,'').trim();
  if(!/^-?(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,6})?$/.test(text))throw new Error(`${field}: enter a plain or Indian-grouped number with at most 6 decimal places`);
  const result=Number(text.replace(/,/g,''));
  if(!Number.isFinite(result)||result<0||result>999999999)throw new Error(`${field}: negative, credit-advance or oversized values need accountant review`);
  return result;
}
function normalize(kind:string,source:SourceRow,mapping:Record<string,string>,defaults:Record<string,string>) {
  const fields:any={};const errors:string[]=[];
  for(const field of FIELDS[kind]) {
    const value=mapping[field] ? source[mapping[field]] : defaults[field];
    if(value!==undefined&&String(value).trim()!=='')fields[field]=String(value).trim();
  }
  const numeric=['selling_price','purchase_price','mrp','opening_stock','gst_rate','low_stock_threshold','credit_days','credit_limit','opening_balance','quantity','cost_rate'];
  for(const field of numeric)if(fields[field]!==undefined) {
    try {
      if(['opening_stock','quantity'].includes(field)) {
        const match=fields[field].match(/^([\d.,]+)\s+([\p{L}\p{N}²³._-]+)$/u);
        if(match){fields[field]=match[1];if(!fields.unit_code)fields.unit_code=match[2];}
      }
      if(['purchase_price','cost_rate'].includes(field))fields[field]=fields[field].replace(/\/[^/]+$/,'');
      fields[field]=number(fields[field],field);
    }catch(error){errors.push((error as Error).message);delete fields[field];}
  }
  if(kind==='ITEMS') {
    if(fields.selling_price===undefined)errors.push('Map Selling price or explicitly enter a default price');
    fields.unit_code=fields.unit_code || 'PCS';
    if(fields.inventory_tracking!==undefined) {
      if(!/^(true|false|yes|no|1|0)$/i.test(fields.inventory_tracking))errors.push('Inventory tracking must be yes/no');
      fields.inventory_tracking=/^(true|yes|1)$/i.test(fields.inventory_tracking);
    }else fields.inventory_tracking=fields.opening_stock!==undefined||!!fields.selling_mode&&fields.selling_mode!=='PIECE';
    if(fields.opening_stock>0&&fields.purchase_price===undefined)errors.push('Opening stock needs its actual purchase/cost rate; zero must be explicitly provided');
    if(fields.selling_mode===undefined)fields.selling_mode='PIECE';
    if(fields.selling_mode==='PIECE'&&fields.opening_stock!==undefined&&!Number.isInteger(fields.opening_stock))errors.push('Piece stock must be a whole number; choose WEIGHT/LENGTH/AREA if appropriate');
  }
  if(kind==='STOCK') {
    if(!fields.sku&&!fields.barcode)errors.push('Map an existing SKU or barcode; names alone cannot identify stock safely');
    if(!fields.quantity||fields.cost_rate===undefined)errors.push('Stock needs a positive quantity and explicit cost rate');
  }
  for(const field of ['name','code','sku','mobile','gstin','pan','state','nickname','unit_code','barcode','external_id']) {
    const max=({code:50,mobile:50,gstin:15,pan:10,state:100,nickname:100,unit_code:20} as any)[field]||255;
    if(fields[field]?.length>max)errors.push(`${field} exceeds ${max} characters`);
  }
  if(fields.gstin&&!/^[0-9]{2}[A-Z0-9]{13}$/i.test(fields.gstin))errors.push('GSTIN must contain 15 letters/numbers starting with a state code');
  const {external_id,...dto}=fields;
  if(kind!=='STOCK') {
    const cls:any=kind==='ITEMS'?CreateRetailItemDto:kind==='CUSTOMERS'?CreateRetailCustomerDto:CreateRetailSupplierDto;
    for(const e of validateSync(plainToInstance(cls,dto)))errors.push(...Object.values(e.constraints||{}));
  }
  return {fields,errors};
}
@Injectable()
export class RetailImportService {
  constructor(private db:PrismaService,private retail:RetailService,private stock:OpeningStockService,private entitlements:EntitlementService){}
  private async requireRow(user:any,kind:string,source:SourceRow,fields:any,client:any=this.db){
    return this.requireRows(user,kind,[{source,normalized:fields}],client);
  }
  private async requireRows(user:any,kind:string,rows:{source:any;normalized:any}[],client:any=this.db){
    const required=new Set<string>(),unsupported=new Set<string>();
    for(const row of rows){const capabilities=importCapabilities(kind,row.source as SourceRow,row.normalized);capabilities.required.forEach(code=>required.add(code));capabilities.unsupported.forEach(field=>unsupported.add(field));}
    await this.entitlements.require(user.organization_id,[...required],user.company_id,client);
    if(unsupported.size)throw new BadRequestException('These advanced columns cannot be posted by this importer: '+[...unsupported].slice(0,20).join(', ')+'. Use item configuration / Buy Stock with tracking details. They will not be silently discarded.');
  }
  presets(user:any){importOwner(user);return {presets:PRESETS,fields:FIELDS,formats:['csv','tsv','txt','xls','xlsx','xlsm','xlsb','ods','json','ndjson','xml'],max_rows:10000,max_mb:5};}
  async preview(user:any,file:Express.Multer.File,body:any) {
    importOwner(user);await throttleOperation('import-preview:'+user.id,20);
    if(!file)throw new BadRequestException('Choose an export file');
    if(!Object.hasOwn(FIELDS,body.kind)||!PRESETS.some(p=>p.id===body.preset))throw new BadRequestException('Choose a preset and data type');
    if(Object.keys(body).some(k=>!['kind','preset','date','sheet','header_row','mapping','defaults'].includes(k)))throw new BadRequestException('Unrecognized import option');
    const date=body.date||businessDate();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(new Date(date).getTime())||new Date(date).toISOString().slice(0,10)!==date)throw new BadRequestException('Choose a valid cutover date');
    if(!await this.db.financialYear.findFirst({where:{id:user.financial_year_id,company_id:user.company_id,is_closed:false,start_date:{lte:new Date(date)},end_date:{gte:new Date(date)}}}))throw new BadRequestException('The cutover date must be inside the selected open financial year');
    const data=parseExport(file.buffer,file.originalname,body.kind,{sheet:body.sheet,headerRow:Number(body.header_row||1)});
    let mapping:Record<string,string>,defaults:Record<string,string>;
    try{mapping=body.mapping?JSON.parse(body.mapping):suggestMapping(body.kind,data.headers);defaults=body.defaults?JSON.parse(body.defaults):{};}catch{throw new BadRequestException('Column mappings/defaults must be JSON objects');}
    for(const object of [mapping,defaults]) {
      if(!object||Array.isArray(object)||typeof object!=='object'||Object.keys(object).some(k=>!FIELDS[body.kind].includes(k)))throw new BadRequestException('Only the listed migration fields can be mapped');
      if(Object.values(object).some(v=>typeof v!=='string'||v.length>4000))throw new BadRequestException('Mappings and defaults must be short text values');
    }
    mapping=Object.fromEntries(Object.entries(mapping).filter(([,value])=>value!==''));
    defaults=Object.fromEntries(Object.entries(defaults).filter(([,value])=>value!==''));
    if(Object.values(mapping).some(column=>!data.headers.includes(column))||new Set(Object.values(mapping)).size!==Object.values(mapping).length)throw new BadRequestException('Each mapped source column must exist and have one destination');
    const unmapped=data.headers.filter(h=>!Object.values(mapping).includes(h));
    const config={mapping,defaults,date,sheets:data.sheets,source_sheet:body.sheet||data.sheets[0]||null,header_row:Number(body.header_row||1),unmapped};
    const fingerprint=hash(hash(file.buffer)+JSON.stringify({preset:body.preset,kind:body.kind,...config}));
    const scope={company_id:user.company_id,branch_id:user.branch_id};
    const existing=await this.db.retailImportJob.findFirst({where:{...scope,fingerprint}});
    if(existing)return this.job(user,existing.id);
    const seen=new Set<string>();
    const rows=data.rows.map((source,index)=>{
      const result=normalize(body.kind,source,mapping,defaults);
      const identity=String(result.fields.external_id||result.fields.sku||result.fields.barcode||result.fields.code||[result.fields.name,result.fields.mobile].filter(Boolean).join('|')).normalize('NFKC').trim().toLowerCase();
      if(!identity)result.errors.push('Provide a stable code/name to identify this record');
      const sourceKey=hash(body.preset+':'+body.kind+':'+identity);
      if(seen.has(sourceKey))result.errors.push('Duplicate identity in this file');seen.add(sourceKey);
      if(body.kind==='ITEMS'&&!result.fields.sku)result.fields.sku='IMP-'+sourceKey.slice(0,24);
      if(['CUSTOMERS','SUPPLIERS'].includes(body.kind)&&!result.fields.code)result.fields.code='IMP-'+sourceKey.slice(0,24);
      return {number:index+1,source,normalized:{...result.fields,_source_key:sourceKey},errors:result.errors,status:result.errors.length?'INVALID':'READY'};
    });
    await this.requireRows(user,body.kind,rows);
    const id=await this.db.runAtomic(async()=>{
      await this.db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${user.company_id+':'+fingerprint},0))::text`;
      const prior=await this.db.retailImportJob.findFirst({where:{...scope,fingerprint}});if(prior)return prior.id;
      const job=await this.db.retailImportJob.create({data:{...scope,financial_year_id:user.financial_year_id,user_id:user.id,kind:body.kind,preset:body.preset,filename:file.originalname.replace(/[\\/\x00-\x1f]/g,'_').slice(0,255),fingerprint,configuration:config,headers:data.headers}});
      for(let start=0;start<rows.length;start+=500)await this.db.retailImportRow.createMany({data:rows.slice(start,start+500).map(row=>({...row,job_id:job.id}))});
      await this.db.auditLog.create({data:{company_id:user.company_id,branch_id:user.branch_id,user_id:user.id,action:'IMPORT_PREVIEW_CREATED',details:JSON.stringify({job_id:job.id,kind:job.kind,rows:rows.length})}});
      return job.id;
    });
    return this.job(user,id);
  }
  async job(user:any,id:string,page=1) {
    importOwner(user);
    const job=await this.db.retailImportJob.findFirst({where:{id,company_id:user.company_id,branch_id:user.branch_id}});
    if(!job)throw new NotFoundException('Import not found');
    const counts=await this.db.retailImportRow.groupBy({by:['status'],where:{job_id:id},_count:{_all:true}});
    const rows=await this.db.retailImportRow.findMany({where:{job_id:id},orderBy:{number:'asc'},skip:(Math.max(1,Math.min(200,Number(page)||1))-1)*50,take:50});
    return {...job,counts:Object.fromEntries(counts.map(c=>[c.status,c._count._all])),rows};
  }
  async history(user:any){importOwner(user);return this.db.retailImportJob.findMany({where:{company_id:user.company_id,branch_id:user.branch_id},orderBy:{created_at:'desc'},take:30});}
  async commit(user:any,id:string,acceptUnmapped:boolean) {
    const job=await this.job(user,id);const config:any=job.configuration;
    if(config.unmapped.length&&!acceptUnmapped)throw new BadRequestException('Review unmapped fields. They are retained in the import audit, not posted to business tables');
    const hasReady=await this.db.retailImportRow.count({where:{job_id:id,status:'READY'}});
    const todo=await this.db.retailImportRow.findMany({where:{job_id:id,status:hasReady?'READY':'FAILED'},orderBy:{number:'asc'},take:25});
    // Revalidate persisted previews after downgrade before posting any row.
    await this.requireRows(user,job.kind,todo);
    for(const row of todo)try {
      await this.db.runAtomic(async()=>{
        await this.db.$queryRaw`SELECT id FROM retail_import_rows WHERE id=${row.id}::uuid FOR UPDATE`;
        const current=await this.db.retailImportRow.findUniqueOrThrow({where:{id:row.id}});
        if(!['READY','FAILED'].includes(current.status))return;
        const {_source_key,external_id,...fields}=current.normalized as any;
        await this.requireRow(user,job.kind,current.source as SourceRow,fields,this.db);
        await this.db.$queryRaw`SELECT id FROM companies WHERE id=${user.company_id}::uuid FOR UPDATE`;
        const scope={company_id:user.company_id,kind:job.kind,source_key:_source_key};
        const prior=await this.db.retailImportIdentity.findFirst({where:scope});
        let entityId=prior?.entity_id;let status='IMPORTED';
        if(prior)status='SKIPPED';
        else if(job.kind==='ITEMS') {
          const existing=await this.db.item.findFirst({where:{company_id:user.company_id,sku:{equals:fields.sku,mode:'insensitive'}}});
          if(existing) {entityId=existing.id;status='SKIPPED';}
          else entityId=(await this.retail.createItem(user.company_id,user.id,job.financial_year_id,user.branch_id,fields,undefined,new Date(config.date))).id;
        }else if(job.kind==='CUSTOMERS'||job.kind==='SUPPLIERS') {
          const existing=await this.db.party.findFirst({where:{company_id:user.company_id,code:fields.code}});
          if(existing) {
            if(existing.party_type!==(job.kind==='CUSTOMERS'?'CUSTOMER':'SUPPLIER'))throw new BadRequestException('Code already belongs to a different party type');
            entityId=existing.id;status='SKIPPED';
          }else{
            const context={branchId:user.branch_id,financialYearId:job.financial_year_id,userId:user.id,openingDate:new Date(config.date)};
            entityId=(job.kind==='CUSTOMERS'?await this.retail.createCustomer(user.company_id,fields,context):await this.retail.createSupplier(user.company_id,fields,context)).id;
          }
        }else {
          const item=fields.sku?await this.db.item.findFirst({where:{company_id:user.company_id,sku:{equals:fields.sku,mode:'insensitive'}}}):await this.db.item.findFirst({where:{company_id:user.company_id,barcodes:{some:{barcode:fields.barcode}}}});
          if(!item)throw new BadRequestException('Import the item master first; SKU/barcode was not found in this shop');
          await this.requireRow(user,'STOCK',{},item,this.db);
          if(item.track_batch||item.track_serial||item.has_variants||item.is_bundle||item.item_type==='SERVICE')throw new BadRequestException('Tracked/variant/bundle stock needs its receiving details; use Buy Stock');
          // A stock snapshot is an opening position, never an additive receipt on
          // top of an existing ledger. The same authoritative item lock is used.
          await this.db.$queryRaw`SELECT id FROM items WHERE id=${item.id}::uuid FOR UPDATE`;
          if(await this.db.stockMovement.count({where:{company_id:user.company_id,item_id:item.id}}))throw new BadRequestException('This item already has stock history. Use Buy Stock/stock adjustment instead of an opening snapshot');
          const unit=fields.unit_code?await this.db.unit.findFirst({where:{company_id:user.company_id,code:fields.unit_code}}):await this.db.unit.findUnique({where:{id:item.primary_unit_id}});
          const location=await this.db.godown.findFirst({where:{branch_id:user.branch_id,is_active:true,branch:{company_id:user.company_id},...(fields.location_code?{code:fields.location_code}:{})},orderBy:[{created_at:'asc'},{id:'asc'}]});
          if(!unit||!location)throw new BadRequestException('Unit or stock location is not configured in this store');
          if(unit.id!==item.primary_unit_id)await this.entitlements.require(user.organization_id,['MULTI_UNIT'],user.company_id);
          const primary=await this.db.godown.findFirst({where:{branch_id:user.branch_id,is_active:true},orderBy:[{created_at:'asc'},{id:'asc'}]});
          if(location.id!==primary?.id)await this.entitlements.require(user.organization_id,['MULTIPLE_STOCK_LOCATIONS'],user.company_id);
          await this.stock.postOpeningStock({company_id:user.company_id,branch_id:user.branch_id,financial_year_id:job.financial_year_id,document_number:'IMP-'+_source_key.slice(0,32),document_date:new Date(config.date),narration:'Reviewed migration opening stock',lines:[{item_id:item.id,unit_id:unit.id,godown_id:location.id,quantity:fields.quantity,cost_rate:fields.cost_rate}]},user.id);
          entityId=item.id;
        }
        if(!prior)await this.db.retailImportIdentity.create({data:{...scope,entity_id:entityId!}});
        await this.db.retailImportRow.update({where:{id:row.id},data:{status,entity_id:entityId,errors:[]}});
        await this.db.auditLog.create({data:{company_id:user.company_id,branch_id:user.branch_id,user_id:user.id,action:'IMPORT_ROW_'+status,details:JSON.stringify({job_id:id,row:row.number,kind:job.kind,entity_id:entityId})}});
      });
    }catch(error:any){await this.db.retailImportRow.updateMany({where:{id:row.id,status:{in:['READY','FAILED']}},data:{status:'FAILED',errors:[error instanceof BadRequestException?error.message:'This row could not be posted. Check references/duplicates and retry.']}});}
    const ready=await this.db.retailImportRow.count({where:{job_id:id,status:'READY'}});
    const failures=await this.db.retailImportRow.count({where:{job_id:id,status:{in:['INVALID','FAILED']}}});
    await this.db.retailImportJob.update({where:{id},data:{status:ready?'IN_PROGRESS':failures?'COMPLETE_WITH_ERRORS':'COMPLETE'}});
    return this.job(user,id);
  }
}
