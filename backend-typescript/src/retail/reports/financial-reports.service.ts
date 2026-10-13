import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PostingService } from '../../accounting/posting.service';
import {costLedger} from '../../inventory/value-journal';

const zero = () => new Prisma.Decimal(0);
const decimal = (v: any) => new Prisma.Decimal(v || 0);
const pageOffset=(v:any)=>{const n=Number(v||0);if(!Number.isInteger(n)||n<0||n>100000)throw new BadRequestException('Choose a valid page offset');return n;};
export const FINANCIAL_DEFINITION = 'Net sales exclude Output GST and include posted returns. COGS is saved at sale, with original cost reversed on return. Profit totals include known-cost product lines only; services and unknown costs are excluded. Business expenses exclude drawings and supplier payments. Round-off stays in its accounting ledger. Coverage is revenue-weighted original product sales, using line counts when sales revenue is zero.';

@Injectable()
export class FinancialReportsService {
  constructor(private db: PrismaService, private accounting: PostingService) {}

  private period(f: any) {
    const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata'}).format(new Date());
    const from = f.from || today, to = f.to || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      !Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || new Date(from).toISOString().slice(0,10)!==from || new Date(to).toISOString().slice(0,10)!==to || from > to ||
      (!f.bill_id&&Date.parse(to)-Date.parse(from)>366*86400000)) throw new BadRequestException('Choose valid dates within one year');
    return { from, to };
  }

  private async validateScope(company: string, f: any) {
    for (const [field, model, scope] of [
      ['branch_id','branch',{company_id:company}], ['item_id','item',{company_id:company}],
      ['customer_id','party',{company_id:company,party_type:'CUSTOMER'}],
      ['bill_id','salesInvoice',{company_id:company}],
      ['variant_id','itemVariant',{item:{company_id:company}}],
      ['staff_id','user',{roles:{some:{company_id:company}}}],
      ['godown_id','godown',{branch:{company_id:company}}],
    ] as const) if (f[field]) {
      if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(f[field]) ||
        !await (this.db[model] as any).findFirst({where:{id:f[field],...scope},select:{id:true}})) throw new NotFoundException('Report filter not found in this business');
    }
  }

  private facts(company:string, f:any) {
    const {from,to}=this.period(f);
    const filter=Prisma.sql`AND d.company_id=${company}::uuid AND d.status='POSTED'
      AND d.document_date BETWEEN ${from}::date AND ${to}::date
      ${f.branch_id?Prisma.sql`AND d.branch_id=${f.branch_id}::uuid`:Prisma.empty}
      ${f.item_id?Prisma.sql`AND l.item_id=${f.item_id}::uuid`:Prisma.empty}
      ${f.godown_id?Prisma.sql`AND l.godown_id=${f.godown_id}::uuid`:Prisma.empty}
      ${f.category?Prisma.sql`AND i.category=${f.category}`:Prisma.empty}
      ${f.customer_id?Prisma.sql`AND d.party_id=${f.customer_id}::uuid`:Prisma.empty}
      ${f.variant_id?Prisma.sql`AND l.variant_id=${f.variant_id}::uuid`:Prisma.empty}`;
    return Prisma.sql`WITH facts AS (
      SELECT l.id, l.item_id, l.variant_id, i.name item_name, i.category category_id, i.category category_name,
        d.id bill_id, d.document_number bill_name, d.party_id customer_id, p.name customer_name,
        d.posted_by staff_id, u.display_name staff_name, d.document_date date,
        COALESCE(l.net_revenue,l.taxable_value) revenue, l.cogs_total cogs,
        COALESCE(l.cost_status,'UNKNOWN') cost_status, i.item_type,
        COALESCE(l.base_quantity,l.quantity) quantity, true sale
      FROM sales_invoice_lines l JOIN sales_invoices d ON d.id=l.sales_invoice_id
        JOIN items i ON i.id=l.item_id
        JOIN parties p ON p.id=d.party_id LEFT JOIN users u ON u.id=d.posted_by
      WHERE true ${filter} ${f.bill_id?Prisma.sql`AND d.id=${f.bill_id}::uuid`:Prisma.empty}
        ${f.staff_id?Prisma.sql`AND d.posted_by=${f.staff_id}::uuid`:Prisma.empty}
      UNION ALL
      SELECT l.id,l.item_id,l.variant_id,i.name,i.category,i.category,original.id,original.document_number,
        d.party_id,p.name,original.posted_by,u.display_name,d.document_date,
        -COALESCE(l.net_revenue,l.taxable_value),-l.cogs_total,COALESCE(l.cost_status,'UNKNOWN'),i.item_type,
        -COALESCE(l.base_quantity,l.quantity),false
      FROM sales_return_lines l JOIN sales_returns d ON d.id=l.sales_return_id
        JOIN items i ON i.id=l.item_id
        JOIN parties p ON p.id=d.party_id LEFT JOIN sales_invoices original ON original.id=d.original_invoice_id AND original.company_id=d.company_id
        LEFT JOIN users u ON u.id=original.posted_by
      WHERE true ${filter} ${f.bill_id?Prisma.sql`AND original.id=${f.bill_id}::uuid`:Prisma.empty}
        ${f.staff_id?Prisma.sql`AND original.posted_by=${f.staff_id}::uuid`:Prisma.empty}
    )`;
  }

  async summary(company:string,f:any={}) {
    await this.validateScope(company,f);
    const period=this.period(f);
    const [r] = await this.db.$queryRaw<any[]>(Prisma.sql`${this.facts(company,f)}
      SELECT COALESCE(SUM(revenue),0) net_sales,
        COALESCE(SUM(revenue) FILTER(WHERE cost_status='KNOWN'),0) known_cost_revenue,
        COALESCE(SUM(cogs) FILTER(WHERE cost_status='KNOWN'),0) cogs,
        COALESCE(SUM(revenue-cogs) FILTER(WHERE cost_status='KNOWN'),0) gross_profit,
        COALESCE(SUM(revenue) FILTER(WHERE item_type='SERVICE'),0) service_revenue,
        COALESCE(SUM(revenue) FILTER(WHERE item_type='SERVICE' AND cost_status<>'KNOWN'),0) unknown_service_revenue,
        COALESCE(SUM(ABS(revenue)) FILTER(WHERE sale AND item_type<>'SERVICE'),0) coverage_basis,
        COALESCE(SUM(ABS(revenue)) FILTER(WHERE sale AND item_type<>'SERVICE' AND cost_status='KNOWN'),0) covered_basis,
        COUNT(*) FILTER(WHERE sale AND item_type<>'SERVICE') product_lines,
        COUNT(*) FILTER(WHERE sale AND item_type<>'SERVICE' AND cost_status='KNOWN') covered_lines,
        COUNT(*) FILTER(WHERE cost_status<>'KNOWN') incomplete_lines FROM facts`);
    const expenses=await this.db.expense.aggregate({where:{company_id:company,status:'POSTED',type:'BUSINESS_EXPENSE',
      date:{gte:new Date(period.from),lte:new Date(period.to)},...(f.branch_id?{branch_id:f.branch_id}:{})},_sum:{amount:true}});
    const coverage=decimal(r.coverage_basis).gt(0)?decimal(r.covered_basis).div(r.coverage_basis).mul(100):
      Number(r.product_lines)>0?decimal(r.covered_lines).div(String(r.product_lines)).mul(100):new Prisma.Decimal(100);
    const losses=await this.db.voucherLine.aggregate({where:{ledger_account:{company_id:company,code:{in:['INVENTORY_LOSS','PURCHASE_COST_VARIANCE']}},
      voucher:{company_id:company,status:{in:['POSTED','REVERSED']},voucher_date:{gte:new Date(period.from),lte:new Date(period.to)},...(f.branch_id?{branch_id:f.branch_id}:{})}},_sum:{debit:true,credit:true}});
    const loss=decimal(losses._sum.debit).minus(decimal(losses._sum.credit));
    const expense=decimal(expenses._sum.amount).plus(loss), gross=decimal(r.gross_profit), covered=decimal(r.known_cost_revenue);
    const result={...period,net_sales:decimal(r.net_sales).toString(),known_cost_revenue:covered.toString(),cogs:decimal(r.cogs).toString(),
      gross_profit:gross.toString(),gross_margin:covered.eq(0)?null:gross.div(covered).mul(100).toDecimalPlaces(2).toString(),
      business_expenses:(f.item_id||f.variant_id||f.bill_id||f.customer_id||f.staff_id||f.category)?null:expense.toString(),net_business_profit:(f.item_id||f.variant_id||f.bill_id||f.customer_id||f.staff_id||f.category)?null:gross.minus(expense).toString(),
      inventory_write_off:loss.toString(),service_revenue:decimal(r.service_revenue).toString(),unknown_service_revenue:decimal(r.unknown_service_revenue).toString(),cost_coverage:coverage.toDecimalPlaces(2).toString(),
      complete:Number(r.incomplete_lines)===0,unknown_lines:Number(r.incomplete_lines),definition:FINANCIAL_DEFINITION};
    return {...result,warning:result.complete?null:'Incomplete profit: unknown product costs and service direct costs are excluded. Fix missing costs for future sales; historical bills stay unchanged.'};
  }

  async grouped(company:string,f:any,group:string) {
    await this.validateScope(company,f);
    if(group==='below-cost'||group==='unknown-sales'){
      const offset=pageOffset(f.offset);
      const rows=await this.db.$queryRaw<any[]>(Prisma.sql`${this.facts(company,f)} SELECT *,COUNT(*) OVER() total_rows FROM facts WHERE sale
        ${group==='below-cost'?Prisma.sql`AND cost_status='KNOWN' AND revenue<cogs`:Prisma.sql`AND cost_status<>'KNOWN'`}
        ${f.search?Prisma.sql`AND (item_name ILIKE ${'%'+String(f.search).slice(0,100)+'%'} OR bill_name ILIKE ${'%'+String(f.search).slice(0,100)+'%'})`:Prisma.empty}
        ORDER BY date DESC,id LIMIT 50 OFFSET ${offset}`);
      return {rows:rows.map(r=>({id:r.id,bill_id:r.bill_id,bill:r.bill_name,label:r.item_name,date:r.date,staff:r.staff_name,net_sales:String(r.revenue),cogs:r.cogs==null?null:String(r.cogs),gross_profit:r.cogs==null?null:r.revenue.minus(r.cogs).toString(),quantity:String(r.quantity),unknown_lines:r.cost_status==='KNOWN'?0:1,gross_margin:r.revenue.eq(0)||r.cogs==null?null:r.revenue.minus(r.cogs).div(r.revenue).mul(100).toDecimalPlaces(2).toString()})),total:Number(rows[0]?.total_rows||0),offset,hasMore:Number(rows[0]?.total_rows||0)>offset+rows.length,definition:FINANCIAL_DEFINITION};
    }
    const groups:Record<string,string>={items:'item_id::text',bills:'bill_id::text',categories:'category_id::text',customers:'customer_id::text',staff:'staff_id::text',trend:`date_trunc('${f.interval==='month'?'month':f.interval==='week'?'week':'day'}',date)::date::text`,margin:'item_id::text','low-margin':'item_id::text','below-cost':'item_id::text'};
    const labels:Record<string,string>={items:'item_name',bills:'bill_name',categories:'category_name',customers:'customer_name',staff:'staff_name',margin:'item_name','low-margin':'item_name','below-cost':'item_name',trend:groups.trend};
    if(!groups[group])throw new BadRequestException('Choose a supported financial report');
    const offset=pageOffset(f.offset);
    const threshold=Number(f.threshold ?? 10);if(!Number.isFinite(threshold)||threshold<0||threshold>100)throw new BadRequestException('Choose a margin threshold between 0 and 100');
    const rows=await this.db.$queryRaw<any[]>(Prisma.sql`${this.facts(company,f)}, grouped AS (
      SELECT ${Prisma.raw(groups[group])} id,COALESCE(MAX(${Prisma.raw(labels[group])}),'Unattributed') label,
        SUM(revenue) net_sales,SUM(revenue) FILTER(WHERE cost_status='KNOWN') known_cost_revenue,
        SUM(cogs) FILTER(WHERE cost_status='KNOWN') cogs,SUM(revenue-cogs) FILTER(WHERE cost_status='KNOWN') gross_profit,
        SUM(quantity) quantity,COUNT(*) FILTER(WHERE cost_status<>'KNOWN') unknown_lines,
        COUNT(*) FILTER(WHERE sale AND cost_status='KNOWN' AND revenue<cogs) below_cost_sales
      FROM facts GROUP BY ${Prisma.raw(groups[group])}
    ) SELECT *,COUNT(*) OVER() total_rows FROM grouped WHERE true
      ${f.search?Prisma.sql`AND label ILIKE ${'%'+String(f.search).slice(0,100)+'%'}`:Prisma.empty}
      ${group==='below-cost'?Prisma.sql`AND below_cost_sales>0`:Prisma.empty}
      ${group==='low-margin'?Prisma.sql`AND known_cost_revenue>0 AND gross_profit/known_cost_revenue*100<${threshold}`:Prisma.empty}
      ORDER BY ${group==='trend'?Prisma.raw('id ASC'):Prisma.raw('gross_profit DESC NULLS LAST,id ASC NULLS LAST')} LIMIT 50 OFFSET ${offset}`);
    return {rows:rows.map(r=>({id:r.id,label:r.label,net_sales:decimal(r.net_sales).toString(),cogs:r.cogs==null?null:String(r.cogs),
      gross_profit:r.gross_profit==null?null:String(r.gross_profit),quantity:String(r.quantity),unknown_lines:Number(r.unknown_lines),
      below_cost_sales:Number(r.below_cost_sales),gross_margin:decimal(r.known_cost_revenue).eq(0)||r.gross_profit==null?null:
        decimal(r.gross_profit).div(r.known_cost_revenue).mul(100).toDecimalPlaces(2).toString()})),
      total:Number(rows[0]?.total_rows||0),offset,hasMore:Number(rows[0]?.total_rows||0)>offset+rows.length,definition:FINANCIAL_DEFINITION};
  }

  async filterOptions(company:string,type:string,search='',item?:string){
    const name={contains:search.slice(0,100),mode:'insensitive' as const};
    if(type==='item_id')return this.db.item.findMany({where:{company_id:company,is_system:false,name},select:{id:true,name:true},orderBy:{name:'asc'},take:50});
    if(type==='customer_id')return this.db.party.findMany({where:{company_id:company,party_type:'CUSTOMER',name},select:{id:true,name:true},orderBy:{name:'asc'},take:50});
    if(type==='branch_id')return this.db.branch.findMany({where:{company_id:company,name},select:{id:true,name:true},orderBy:{name:'asc'},take:50});
    if(type==='godown_id')return this.db.godown.findMany({where:{branch:{company_id:company},name},select:{id:true,name:true},orderBy:{name:'asc'},take:50});
    if(type==='staff_id')return (await this.db.user.findMany({where:{roles:{some:{company_id:company}},display_name:name},select:{id:true,display_name:true},orderBy:{display_name:'asc'},take:50})).map(r=>({id:r.id,name:r.display_name}));
    if(type==='variant_id'&&item){await this.validateScope(company,{item_id:item});return (await this.db.itemVariant.findMany({where:{item_id:item},select:{id:true,attributes:true},take:50})).map(r=>({id:r.id,name:JSON.stringify(r.attributes)}));}
    throw new BadRequestException('Choose a supported report filter');
  }

  async valuation(company:string,f:any) {
    await this.validateScope(company,f);
    const offset=pageOffset(f.offset);
    const rows=await this.db.$queryRaw<any[]>(Prisma.sql`WITH physical AS (
      SELECT b.item_id,b.variant_id,SUM(b.quantity) quantity FROM stock_balance_projection b
      WHERE b.company_id=${company}::uuid ${f.branch_id?Prisma.sql`AND b.branch_id=${f.branch_id}::uuid`:Prisma.empty}
        ${f.godown_id?Prisma.sql`AND b.godown_id=${f.godown_id}::uuid`:Prisma.empty}
      GROUP BY b.item_id,b.variant_id)
      SELECT i.id item_id,p.variant_id,i.name,v.attributes::text variant_name,u.name unit,p.quantity,
        CASE WHEN s.unknown_quantity=0 AND s.quantity>0 THEN s.known_value/s.quantity ELSE NULL END average_cost,
        CASE WHEN s.unknown_quantity=0 AND s.quantity>0 THEN p.quantity*s.known_value/s.quantity ELSE NULL END inventory_value,
        CASE WHEN s.quantity>0 THEN p.quantity*s.known_value/s.quantity ELSE 0 END known_value,
        CASE WHEN s.quantity>0 THEN p.quantity*s.unknown_quantity/s.quantity ELSE p.quantity END unknown_quantity,
        COUNT(*) OVER() total_rows
      FROM physical p JOIN items i ON i.id=p.item_id JOIN units u ON u.id=i.primary_unit_id
        LEFT JOIN item_variants v ON v.id=p.variant_id LEFT JOIN inventory_cost_states s
        ON s.company_id=${company}::uuid AND s.item_id=p.item_id AND s.variant_key=COALESCE(p.variant_id::text,'BASE')
      WHERE i.company_id=${company}::uuid AND p.quantity>0
        ${f.item_id?Prisma.sql`AND i.id=${f.item_id}::uuid`:Prisma.empty}
        ${f.variant_id?Prisma.sql`AND p.variant_id=${f.variant_id}::uuid`:Prisma.empty}
        ${f.category?Prisma.sql`AND i.category=${f.category}`:Prisma.empty}
        ${f.missing==='true'?Prisma.sql`AND (s.id IS NULL OR s.unknown_quantity>0)`:Prisma.empty}
        ${f.search?Prisma.sql`AND i.name ILIKE ${'%'+String(f.search).slice(0,100)+'%'}`:Prisma.empty}
      ORDER BY i.name,i.id,p.variant_id LIMIT 50 OFFSET ${offset}`);
    return {rows:rows.map(r=>({...r,total_rows:undefined,quantity:String(r.quantity),average_cost:r.average_cost==null?null:String(r.average_cost),
      inventory_value:r.inventory_value==null?null:String(r.inventory_value),known_value:String(r.known_value),unknown_quantity:String(r.unknown_quantity)})),
      hasMore:Number(rows[0]?.total_rows||0)>offset+rows.length,total:Number(rows[0]?.total_rows||0),offset,
      definition:'Current physical stock includes expired stock until written off. Company/item/variant WAC; location values use the same company rate. Unknown value is never estimated from master prices.'};
  }

  async correctMissingCost(company:string,branch:string,user:string,input:{item_id:string;variant_id?:string;cost_per_base_unit:string;note:string}) {
    const rate=new Prisma.Decimal(input.cost_per_base_unit);
    if(!rate.isFinite()||rate.lt(0)||rate.gt('1000000000')||!input.note?.trim()||input.note.length>500)throw new BadRequestException('Enter a non-negative cost and a reason');
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM items WHERE company_id=${company}::uuid AND id=${input.item_id}::uuid FOR UPDATE`;
      const item=await tx.item.findFirst({where:{id:input.item_id,company_id:company}});
      if(!item)throw new NotFoundException('Item not found');
      if(input.variant_id&&!await tx.itemVariant.findFirst({where:{id:input.variant_id,item_id:item.id}}))throw new NotFoundException('Variant not found');
      const key={company_id:company,item_id:item.id,variant_key:input.variant_id||'BASE'};
      let state=await tx.inventoryCostState.findUnique({where:{company_id_item_id_variant_key:key}});
      if(!state){const physical=await tx.stockBalanceProjection.aggregate({where:{company_id:company,item_id:item.id,variant_id:input.variant_id||null},_sum:{quantity:true}});
        state=await tx.inventoryCostState.create({data:{...key,quantity:physical._sum.quantity||zero(),unknown_quantity:physical._sum.quantity||zero()}});}
      if(state.unknown_quantity.lte(0))throw new BadRequestException('This remaining stock has no missing cost to correct');
      const addition=rate.mul(state.unknown_quantity).toDecimalPlaces(12);
      const correctionDate=new Date(this.period({}).from);
      const fy=await tx.financialYear.findFirst({where:{company_id:company,is_closed:false,start_date:{lte:correctionDate},end_date:{gte:correctionDate}}});
      if(!fy)throw new BadRequestException('An open financial year is required');
      const after=await tx.inventoryCostState.update({where:{id:state.id},data:{unknown_quantity:0,known_value:state.known_value.plus(addition)}});
      const audit=await tx.auditLog.create({data:{company_id:company,branch_id:branch,user_id:user,action:'MISSING_STOCK_COST_CORRECTED',
        source_document_type:'INVENTORY_COST_STATE',source_document_id:state.id,details:JSON.stringify({before:state,after,note:input.note.trim(),historical_sales_rewritten:false})}});
      if(addition.gt(0)){
        const ledger=async(code:string,name:string,type:string)=>await tx.ledgerAccount.findFirst({where:{company_id:company,code}})||await tx.ledgerAccount.create({data:{company_id:company,code,name,account_type:type,normal_balance:type==='EQUITY'?'CREDIT':'DEBIT'}});
        const asset=await costLedger(tx,company,'1200','Inventory Asset','ASSET'),equity=await ledger('COST_CORRECTION_EQUITY','Missing opening cost correction','EQUITY');
        await this.accounting.postVoucher(tx,{company_id:company,branch_id:branch,financial_year_id:fy.id,voucher_date:correctionDate,voucher_type:'JOURNAL',
          document_number:'COST-FIX-'+audit.id,source_document_type:'MISSING_COST_CORRECTION',source_document_id:audit.id,posted_by:user,narration:input.note,
          lines:[{ledger_account_id:asset.id,debit:addition,credit:0},{ledger_account_id:equity.id,debit:0,credit:addition}]});
      }
      return {success:true,state:after,historical_sales_rewritten:false};
    });
  }
}

