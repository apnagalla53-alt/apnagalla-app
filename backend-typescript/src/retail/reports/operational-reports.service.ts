import { Injectable,BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReportFilterDto } from './dto/report-filter.dto';
import { businessDate } from '../../common/business-date';
/** Additional read models in the reporting facade, not another business engine. */
@Injectable()
export class OperationalReportsService {
  constructor(private db:PrismaService){}
  private range(f:ReportFilterDto){return {...(f.from?{gte:new Date(/^\d{4}-\d{2}-\d{2}$/.test(f.from)?f.from+'T00:00:00Z':f.from)}:{}),...(f.to?{lte:new Date(/^\d{4}-\d{2}-\d{2}$/.test(f.to)?f.to+'T23:59:59.999Z':f.to)}:{})};}
  async sales(company_id:string,f:ReportFilterDto){
    const where={company_id,...(f.branch_id?{branch_id:f.branch_id}:{}),status:'POSTED',document_date:this.range(f),...(f.customer_id?{party_id:f.customer_id}:{}),...(f.staff_id?{posted_by:f.staff_id}:{})};
    const ids=f.staff_id?await this.db.salesInvoice.findMany({where:{company_id,branch_id:f.branch_id,posted_by:f.staff_id},select:{id:true},take:10001}):[];
    if(ids.length>10000)throw new BadRequestException('Staff return attribution exceeds 10,000 source bills; use a smaller shop scope.');
    const returnWhere={company_id,...(f.branch_id?{branch_id:f.branch_id}:{}),status:'POSTED',document_date:this.range(f),...(f.customer_id?{party_id:f.customer_id}:{}),...(f.staff_id?{original_invoice_id:{in:ids.map(i=>i.id)}}:{})};
    const [sales,returns]=await Promise.all([this.db.salesInvoice.aggregate({where,_sum:{grand_total:true},_count:{_all:true}}),this.db.salesReturn.aggregate({where:returnWhere,_sum:{grand_total:true}})]);
    return {gross_sales:Number(sales._sum.grand_total||0),returns:Number(returns._sum.grand_total||0),net_sales:Number(sales._sum.grand_total||0)-Number(returns._sum.grand_total||0),bills_count:sales._count._all};
  }
  async purchase(company_id:string,f:ReportFilterDto){
    const r=await this.db.purchaseInvoice.aggregate({where:{company_id,branch_id:f.branch_id,status:'POSTED',document_date:this.range(f),...(f.supplier_id?{party_id:f.supplier_id}:{})},_sum:{grand_total:true,paid_amount:true,outstanding_amount:true},_count:{_all:true}});
    return {total_purchases:Number(r._sum.grand_total||0),paid_amount:Number(r._sum.paid_amount||0),outstanding_amount:Number(r._sum.outstanding_amount||0),purchase_count:r._count._all};
  }
  async expenses(company_id:string,f:ReportFilterDto){
    const groups=await this.db.expense.groupBy({by:['type'],where:{company_id,branch_id:f.branch_id,status:'POSTED',date:this.range(f),...(f.category_id?{category_id:f.category_id}:{})},_sum:{amount:true},_count:{_all:true}});
    return {business_expenses:Number(groups.find(g=>g.type==='BUSINESS_EXPENSE')?._sum.amount||0),owner_withdrawal:Number(groups.find(g=>g.type==='OWNER_WITHDRAWAL')?._sum.amount||0),record_count:groups.reduce((s,g)=>s+g._count._all,0)};
  }
  async returns(company_id:string,f:ReportFilterDto){const r=await this.db.salesReturn.aggregate({where:{company_id,branch_id:f.branch_id,status:'POSTED',document_date:this.range(f)},_sum:{grand_total:true},_count:{_all:true}});return {total_returns:Number(r._sum.grand_total||0),returns_count:r._count._all};}
  async overdue(company_id:string,branch_id:string,today=businessDate(),offset=0){
    const where={company_id,branch_id,status:'POSTED',due_date:{lt:new Date(today+'T00:00:00Z')},outstanding_amount:{gt:0}};
    const [totals,rows]=await Promise.all([this.db.salesInvoice.aggregate({where,_sum:{outstanding_amount:true},_count:{_all:true}}),this.db.salesInvoice.findMany({where,select:{document_number:true,outstanding_amount:true,due_date:true,party:{select:{name:true}}},orderBy:[{due_date:'asc'},{id:'asc'}],skip:offset,take:6})]);
    return {summary:{overdue_amount:Number(totals._sum.outstanding_amount||0),bills_count:totals._count._all},rows:rows.slice(0,5).map(r=>({bill:r.document_number,name:r.party.name,due:Number(r.outstanding_amount),date:r.due_date!.toISOString().slice(0,10)})),hasMore:rows.length>5};
  }
  async batches(company_id:string,branch_id:string,opts:{expired?:boolean;expiring?:boolean;item_id?:string;offset:number;today:string}){
    const start=new Date(opts.today+'T00:00:00Z'),end=new Date(+start+31*86400000);
    const where={company_id,branch_id,quantity:{gt:0},batch_id:{not:null},...(opts.item_id?{item_id:opts.item_id}:{}),...(opts.expired?{batch:{expiry_date:{lt:start}}}:opts.expiring?{batch:{expiry_date:{gte:start,lt:end}}}:{})};
    const [total,rows]=await Promise.all([this.db.stockBalanceProjection.count({where}),this.db.stockBalanceProjection.findMany({where,include:{item:{select:{name:true,primary_unit:{select:{code:true}}}},batch:{select:{batch_number:true,expiry_date:true}},godown:{select:{name:true}},variant:{select:{attributes:true}}},orderBy:[{batch:{expiry_date:'asc'}},{id:'asc'}],skip:opts.offset,take:6})]);
    return {summary:{stock_lots:total},rows:rows.slice(0,5).map(r=>({item:r.item.name,batch:r.batch!.batch_number,expiry:r.batch!.expiry_date?.toISOString().slice(0,10)||null,quantity:Number(r.quantity),unit:r.item.primary_unit.code,location:r.godown.name,variant:r.variant?Object.values(r.variant.attributes as object).join(' / '):null})),hasMore:rows.length>5};
  }
  async needs(company_id:string,branch_id:string,urgent:boolean,offset=0){
    const where={company_id,OR:[{branch_id},{branch_id:null}],status:{in:['NEED','ORDERED']},...(urgent?{priority:'URGENT'}:{})};
    const [total,rows]=await Promise.all([this.db.needList.count({where}),this.db.needList.findMany({where,select:{name:true,quantity:true,priority:true,status:true,needed_by:true},orderBy:[{created_at:'desc'},{id:'asc'}],take:6,skip:offset})]);
    return {summary:{pending_needs:total},rows:rows.slice(0,5).map(r=>({name:r.name,quantity:Number(r.quantity),priority:r.priority,status:r.status,needed_by:r.needed_by?.toISOString().slice(0,10)||null})),hasMore:rows.length>5};
  }
  async received(company_id:string,branch_id:string,f:ReportFilterDto,offset=0,limit=5){
    const where={company_id,branch_id,movement_type:'PURCHASE_IN',business_date:this.range(f)};
    const [total,rows]=await Promise.all([this.db.stockMovement.count({where}),this.db.stockMovement.findMany({where,include:{item:{select:{name:true}},unit:{select:{code:true}}},orderBy:[{created_at:'desc'},{id:'asc'}],skip:offset,take:limit+1})]);
    // Receipt quantities are authoritative here; movement value_delta is not a purchase valuation.
    return {summary:{stock_movements:total},rows:rows.slice(0,limit).map(r=>({item:r.item.name,quantity:Number(r.quantity_delta),unit:r.unit.code})),hasMore:rows.length>limit};
  }
  async partyPayments(company_id:string,branch_id:string,party_type:'CUSTOMER'|'SUPPLIER',f:ReportFilterDto){
    const r=await this.db.voucherLine.aggregate({where:{party:{party_type,...(f.customer_id||f.supplier_id?{id:f.customer_id||f.supplier_id}:{})},voucher:{company_id,branch_id,status:'POSTED',voucher_type:party_type==='CUSTOMER'?'RECEIPT':'PAYMENT',voucher_date:this.range(f),OR:[{source_document_type:null},{source_document_type:{notIn:['POS_RECEIPT','POS_REFUND']}}]}},_sum:{debit:true,credit:true}});
    return {payments:party_type==='CUSTOMER'?Number(r._sum.credit||0)-Number(r._sum.debit||0):Number(r._sum.debit||0)-Number(r._sum.credit||0)};
  }
  async stock(company_id:string,f:ReportFilterDto,offset=0,limit=5,today=businessDate(),mode:'ALL'|'LOW'|'OUT'='ALL') {
    const summary={total_items:0,low_stock_count:0,out_of_stock_count:0};let cursor:string|undefined,matched=0;const items:any[]=[];
    while(true){
      const catalog=await this.db.item.findMany({where:{company_id,OR:mode==='ALL'?[{is_active:true},{stock_balance_projection:{some:{company_id,branch_id:f.branch_id,godown_id:f.godown_id,variant_id:f.variant_id,quantity:{gt:0}}}}]:[{is_active:true}],is_system:false,inventory_tracking:true,is_bundle:false,item_type:{not:'SERVICE'},...(f.item_id?{id:f.item_id}:{})},select:{id:true,name:true,sku:true,is_active:true,low_stock_threshold:true,primary_unit:{select:{code:true}}},orderBy:{id:'asc'},take:200,...(cursor?{cursor:{id:cursor},skip:1}:{})});
      const quantities=catalog.length?await this.db.stockBalanceProjection.groupBy({by:['item_id'],where:{company_id,branch_id:f.branch_id,item_id:{in:catalog.map(i=>i.id)},...(f.godown_id?{godown_id:f.godown_id}:{}),...(f.variant_id?{variant_id:f.variant_id}:{}),...(mode==='ALL'?{}:{OR:[{batch:null},{batch:{expiry_date:null}},{batch:{expiry_date:{gte:new Date(today+'T00:00:00Z')}}}]})},_sum:{quantity:true}}):[];
      const map=new Map(quantities.map(q=>[q.item_id,Number(q._sum.quantity||0)]));
      for(const item of catalog){const quantity=map.get(item.id)||0,low=quantity<=Number(item.low_stock_threshold),out=quantity<=0;summary.total_items++;if(low)summary.low_stock_count++;if(out)summary.out_of_stock_count++;
        if(mode==='LOW'&&!low||mode==='OUT'&&!out)continue;
        if(matched>=offset&&items.length<limit)items.push({item_id:item.id,name:item.name,sku:item.sku||'',quantity,unit:item.primary_unit.code,archived:!item.is_active,low_stock_threshold:Number(item.low_stock_threshold)});matched++;
      }
      if(catalog.length<200)break;cursor=catalog[catalog.length-1].id;
      if(summary.total_items>=10000)throw new BadRequestException('Stock scope exceeds 10,000 catalog items; filter an item or location.');
    }
    return {summary,items,hasMore:matched>offset+items.length,matched_count:matched};
  }
  async dues(company_id:string,type:'CUSTOMER'|'SUPPLIER',offset=0,limit=5){
    let cursor:string|undefined,count=0,total=0,read=0;const rows:{id:string;name:string;phone:null;due:number}[]=[];
    while(true){const parties=await this.db.party.findMany({where:{company_id,party_type:type},select:{id:true,name:true},orderBy:{id:'asc'},take:200,...(cursor?{cursor:{id:cursor},skip:1}:{})});
      const groups=parties.length?await this.db.billAllocation.groupBy({by:['party_id','allocation_type'],where:{company_id,party_id:{in:parties.map(p=>p.id)}},_sum:{amount:true}}):[];
      const balances=new Map<string,number>();for(const g of groups)if(g.party_id)balances.set(g.party_id,(balances.get(g.party_id)||0)+Number(g._sum.amount||0)*(g.allocation_type==='NEW_REFERENCE'?1:g.allocation_type==='AGAINST_REFERENCE'?-1:0));
      for(const p of parties){read++;const due=balances.get(p.id)||0;if(due<=0)continue;total+=due;if(count>=offset&&rows.length<limit)rows.push({...p,phone:null,due});count++;}
      if(parties.length<200)break;cursor=parties[parties.length-1].id;if(read>=10000)throw new BadRequestException('Due report scope exceeds 10,000 parties.');
    }
    return {summary:{total_due:total,parties_count:count},rows,hasMore:count>offset+rows.length};
  }
}
