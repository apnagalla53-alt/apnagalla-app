import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AssistantContext, BusinessInsight, InsightDriver, Result } from './assistant.types';
import { FinancialReportsService } from '../retail/reports/financial-reports.service';
import { OperationalReportsService } from '../retail/reports/operational-reports.service';
import { CounterService } from '../retail/counter/counter.service';
import { PrismaService } from '../database/prisma.service';
import { dateRange } from './nlp';

type Period={from:string;to:string;comparison_mode?:'MONTH_TO_DATE'|'WEEK_TO_DATE'};
type Snapshot={financial:any;sales:any;payments:any;expenses:number;discounts:number;returns:any;purchase:any;collections:number;supplierPayments:number;withdrawals:number;galla:any|null};
const dayMs=86400000;
const utc=(s:string)=>new Date(`${s}T00:00:00.000Z`);
const iso=(d:Date)=>d.toISOString().slice(0,10);
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const n=(v:any)=>Number(v??0);
const pct=(current:number,previous:number)=>previous===0?(current===0?0:null):round((current-previous)/Math.abs(previous)*100);
const moneyDelta=(a:number,b:number)=>round(a-b);
export function equalLengthPreviousPeriod(p:Period):Period {
  const from=utc(p.from),to=utc(p.to),days=Math.floor((+to-+from)/dayMs)+1;
  return {from:iso(new Date(+from-days*dayMs)),to:iso(new Date(+from-dayMs))};
}
export function previousMonthEquivalentPeriod(p:Period):Period {
  const from=utc(p.from),to=utc(p.to),days=Math.floor((+to-+from)/dayMs)+1;
  const previousMonth=new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth()-1,1));
  const endOfPrevious=new Date(Date.UTC(previousMonth.getUTCFullYear(),previousMonth.getUTCMonth()+1,0)).getUTCDate();
  return {from:iso(previousMonth),to:iso(new Date(+previousMonth+(Math.min(days,endOfPrevious)-1)*dayMs))};
}
export function previousWeekEquivalentPeriod(p:Period):Period {
  return {from:iso(new Date(+utc(p.from)-7*dayMs)),to:iso(new Date(+utc(p.to)-7*dayMs))};
}
export function decomposeSales(currentSales:number,currentBills:number,previousSales:number,previousBills:number){
  const currentAverage=currentBills?currentSales/currentBills:0,previousAverage=previousBills?previousSales/previousBills:0;
  const billCountImpact=round((currentBills-previousBills)*(currentAverage+previousAverage)/2);
  const averageBillImpact=round((currentAverage-previousAverage)*(currentBills+previousBills)/2);
  return {currentAverage:round(currentAverage),previousAverage:round(previousAverage),billCountImpact,averageBillImpact,totalChange:round(currentSales-previousSales)};
}

/** Deterministic diagnosis over the existing Retail reports and saved Phase 5.6 facts. */
@Injectable()
export class BusinessInsightService {
  constructor(private db:PrismaService,private financial:FinancialReportsService,private operations:OperationalReportsService,private counter:CounterService){}

  private comparison(p:Period):Period {
    return equalLengthPreviousPeriod(p);
  }
  private async snapshot(ctx:AssistantContext,p:Period):Promise<Snapshot>{
    const f={...p,branch_id:ctx.branch_id};
    const start=utc(p.from),end=new Date(+utc(p.to)+dayMs);
    const scope={company_id:ctx.company_id,branch_id:ctx.branch_id,status:'POSTED'};
    const [financial,sales,payments,expenses,discounts,returns,purchase,collections,supplierPayments,withdrawals,galla]=await Promise.all([
      this.financial.summary(ctx.company_id,f),this.operations.sales(ctx.company_id,f),this.counter.salesPayments(ctx.company_id,ctx.branch_id,p.from,p.to),
      this.db.expense.aggregate({where:{...scope,type:'BUSINESS_EXPENSE',date:{gte:start,lt:end}},_sum:{amount:true}}),
      this.db.salesInvoice.aggregate({where:{...scope,document_date:{gte:start,lt:end}},_sum:{discount_amount:true}}),
      this.operations.returns(ctx.company_id,f),this.operations.purchase(ctx.company_id,f),
      this.operations.partyPayments(ctx.company_id,ctx.branch_id,'CUSTOMER',f),this.operations.partyPayments(ctx.company_id,ctx.branch_id,'SUPPLIER',f),
      this.db.expense.aggregate({where:{...scope,type:'OWNER_WITHDRAWAL',date:{gte:start,lt:end}},_sum:{amount:true}}),
      p.from===p.to?this.counter.galla(ctx.company_id,ctx.branch_id,p.from):Promise.resolve(null),
    ]);
    return {financial,sales,payments,expenses:n(expenses._sum.amount),discounts:n(discounts._sum.discount_amount),returns,
      purchase,collections:n(collections.payments),supplierPayments:n(supplierPayments.payments),withdrawals:n(withdrawals._sum.amount),galla};
  }
  private driver(input:Partial<InsightDriver>&Pick<InsightDriver,'type'|'title'|'target_metric'|'evidence_type'|'description'>):InsightDriver {
    const delta=input.absolute_change==null?null:n(input.absolute_change),impact=input.impact_amount==null?null:n(input.impact_amount);
    const magnitude=Math.abs(impact??delta??0),percent=Math.abs(input.percentage_change??0);
    return {type:input.type,title:input.title,target_metric:input.target_metric,current_value:input.current_value??null,previous_value:input.previous_value??null,
      absolute_change:delta,percentage_change:input.percentage_change??null,impact_amount:impact,
      severity:percent>=20||magnitude>=10000?'HIGH':percent>=5||magnitude>=1000?'MEDIUM':'LOW',evidence_type:input.evidence_type,
      supporting_metrics:input.supporting_metrics||{},description:input.description};
  }
  private metricDriver(title:string,key:string,cur:number,prev:number,evidence:InsightDriver['evidence_type']='DIRECT',target='business',description?:string,contributionSign=1){
    const d=moneyDelta(cur,prev);return this.driver({type:key,title,target_metric:target,current_value:round(cur),previous_value:round(prev),absolute_change:d,
      percentage_change:pct(cur,prev),impact_amount:evidence==='DIRECT'?round(d*contributionSign):null,evidence_type:evidence,
      description:description||`${title} changed by ₹${Math.abs(d).toLocaleString('en-IN')}; this is a measured change, not an external-cause claim.`});
  }
  private async groups(ctx:AssistantContext,p:Period,group:'items'|'categories'|'staff'|'customers'){
    const rows=(await this.financial.grouped(ctx.company_id,{...p,branch_id:ctx.branch_id,offset:0},group)).rows as any[];
    if(group!=='customers')return rows;
    const walkIn=await this.db.party.findMany({where:{company_id:ctx.company_id,party_type:'CUSTOMER',is_walkin:true},select:{id:true}});
    const anonymous=new Set(walkIn.map(p=>p.id));return rows.filter(r=>!anonymous.has(r.id));
  }
  private compareGroups(current:any[],previous:any[],key:'net_sales'|'gross_profit'|'cogs'='net_sales',direction:'asc'|'desc'='asc'){
    const now=new Map(current.map(r=>[String(r.id),r])),old=new Map(previous.map(r=>[String(r.id),r]));
    return [...new Set([...now.keys(),...old.keys()])].map(id=>{const r=now.get(id)||old.get(id),before=old.get(id),a=n(now.has(id)?r[key]:0),b=n(before?.[key]);return {label:r.label,current:a,previous:b,change:round(a-b),percent:pct(a,b),unknown:n(r.unknown_lines),margin:r.gross_margin==null?null:n(r.gross_margin),previousMargin:before?.gross_margin==null?null:n(before.gross_margin),currentRevenue:n(now.has(id)?r.net_sales:0),previousRevenue:n(before?.net_sales),currentCogs:n(now.has(id)?r.cogs:0),previousCogs:n(before?.cogs),currentQuantity:n(now.has(id)?r.quantity:0),previousQuantity:n(before?.quantity),id:r.id};})
      .filter(r=>r.previous!==0||r.current!==0).sort((a,b)=>direction==='asc'?a.change-b.change:b.change-a.change).slice(0,5);
  }
  private async allocationFlows(ctx:AssistantContext,p:Period,partyType:'CUSTOMER'|'SUPPLIER'){
    const rows=await this.db.$queryRaw<any[]>(Prisma.sql`SELECT p.id,p.name,
      COALESCE(SUM(CASE WHEN a.allocation_type='NEW_REFERENCE' THEN a.amount WHEN a.allocation_type='AGAINST_REFERENCE' THEN -a.amount ELSE 0 END),0) change
      FROM bill_allocations a JOIN parties p ON p.id=a.party_id JOIN voucher_lines vl ON vl.id=a.voucher_line_id
      JOIN vouchers v ON v.id=vl.voucher_id
      WHERE a.company_id=${ctx.company_id}::uuid AND p.party_type=${partyType}
      AND v.company_id=${ctx.company_id}::uuid AND v.branch_id=${ctx.branch_id}::uuid AND v.status='POSTED'
      AND v.voucher_date BETWEEN ${utc(p.from)}::date AND ${utc(p.to)}::date
      GROUP BY p.id,p.name ORDER BY ABS(SUM(CASE WHEN a.allocation_type='NEW_REFERENCE' THEN a.amount WHEN a.allocation_type='AGAINST_REFERENCE' THEN -a.amount ELSE 0 END)) DESC LIMIT 50`);
    return rows.map(r=>({id:r.id,label:r.name,change:n(r.change)}));
  }
  private async expenseCategories(ctx:AssistantContext,p:Period){
    const rows=await this.db.expense.groupBy({by:['category_id'],where:{company_id:ctx.company_id,branch_id:ctx.branch_id,status:'POSTED',type:'BUSINESS_EXPENSE',date:{gte:utc(p.from),lt:new Date(+utc(p.to)+dayMs)}},_sum:{amount:true}});
    const ids=rows.flatMap(r=>r.category_id?[r.category_id]:[]),cats=ids.length?await this.db.expenseCategory.findMany({where:{company_id:ctx.company_id,id:{in:ids}},select:{id:true,name:true}}):[];
    const labels=new Map(cats.map(c=>[c.id,c.name]));return rows.map(r=>({label:r.category_id?labels.get(r.category_id)||'Uncategorized':'Uncategorized',current:n(r._sum.amount)}));
  }
  private async weekday(ctx:AssistantContext,p:Period){
    return this.db.$queryRaw<any[]>(Prisma.sql`SELECT EXTRACT(ISODOW FROM document_date)::int weekday,
      COALESCE(SUM(grand_total),0)::numeric sales,COUNT(*)::int bills
      FROM sales_invoices WHERE company_id=${ctx.company_id}::uuid AND branch_id=${ctx.branch_id}::uuid AND status='POSTED'
      AND document_date BETWEEN ${utc(p.from)}::date AND ${utc(p.to)}::date GROUP BY 1 ORDER BY 1`);
  }

  async analyze(ctx:AssistantContext,intent:string,range:Period&{explicit:boolean;label:string;comparison_mode?:'MONTH_TO_DATE'|'WEEK_TO_DATE'}):Promise<Result>{
    let currentPeriod:Period={from:range.from,to:range.to};
    if(intent==='WEEKDAY_SALES_ANALYSIS'&&!range.explicit){const today=dateRange('today',ctx.timezone).to;currentPeriod={from:iso(new Date(+utc(today)-89*dayMs)),to:today};}
    if(['SALES_TREND','PROFIT_TREND'].includes(intent)&&!range.explicit){const today=dateRange('today',ctx.timezone).to;currentPeriod={from:iso(new Date(+utc(today)-29*dayMs)),to:today};}
    const previousPeriod=range.comparison_mode==='MONTH_TO_DATE'?previousMonthEquivalentPeriod(currentPeriod):range.comparison_mode==='WEEK_TO_DATE'?previousWeekEquivalentPeriod(currentPeriod):this.comparison(currentPeriod);
    const [cur,prev]=await Promise.all([this.snapshot(ctx,currentPeriod),this.snapshot(ctx,previousPeriod)]);
    const currentSales=n(cur.sales.net_sales),previousSales=n(prev.sales.net_sales),currentBills=n(cur.sales.bills_count),previousBills=n(prev.sales.bills_count);
    const salesParts=decomposeSales(currentSales,currentBills,previousSales,previousBills),currentAvg=salesParts.currentAverage,previousAvg=salesParts.previousAverage;
    const sampleEnough=(currentBills>=3&&previousBills>=3)||(currentBills===0&&previousBills>=3)||(previousBills===0&&currentBills>=3);
    const intentProfit=/PROFIT|MARGIN|COGS|LOSS_MAKING|LOW_MARGIN/.test(intent),intentExpense=/EXPENSE/.test(intent),intentPurchase=/PURCHASE/.test(intent),intentCash=/CASH|MONEY_WENT/.test(intent),intentHealth=/BUSINESS_HEALTH|BUSINESS_PROBLEM/.test(intent),intentCustomer=/CUSTOMER/.test(intent),intentSupplier=/SUPPLIER/.test(intent),intentReturn=/RETURN/.test(intent);
    const partyType=intentCustomer?'CUSTOMER':intentSupplier?'SUPPLIER':null;
    const partyFlows=partyType?await Promise.all([this.allocationFlows(ctx,currentPeriod,partyType),this.allocationFlows(ctx,previousPeriod,partyType)]):null;
    const currentDueMovement=partyFlows?.[0].reduce((sum,x)=>sum+x.change,0)||0,previousDueMovement=partyFlows?.[1].reduce((sum,x)=>sum+x.change,0)||0;
    const cashBridge=(intentCash||intent==='PROFIT_VS_CASH_EXPLANATION')&&!partyType?await Promise.all([
      this.allocationFlows(ctx,currentPeriod,'CUSTOMER'),this.allocationFlows(ctx,previousPeriod,'CUSTOMER'),
      this.allocationFlows(ctx,currentPeriod,'SUPPLIER'),this.allocationFlows(ctx,previousPeriod,'SUPPLIER'),
    ]):null;
    const outflowCur=cur.supplierPayments+cur.expenses+cur.withdrawals,outflowPrev=prev.supplierPayments+prev.expenses+prev.withdrawals;
    const metric=intent==='PROFIT_VS_CASH_EXPLANATION'?'net_business_profit':intentCash&&cur.galla?(intent==='WHERE_MONEY_WENT'?'cash_paid_out':'expected_cash'):intent==='MARGIN_CHANGE_EXPLANATION'||intent.includes('MARGIN_DECLINE')||intent==='LOW_MARGIN_ITEMS_ANALYSIS'?'gross_margin':intent==='COGS_CHANGE_EXPLANATION'?'cogs':intentCustomer?'customer_receivable_change':intentSupplier?'supplier_payable_change':intent==='CATEGORY_PROFIT_DECLINE'||intent==='ITEM_PROFIT_DECLINE'||intent==='LOSS_MAKING_ITEMS_ANALYSIS'?'gross_profit':intentProfit?'net_business_profit':intentExpense?'business_expenses':intentPurchase?'purchases':intentReturn?'returns':intent==='WHERE_MONEY_WENT'?'recorded_outflows':'net_sales';
    const metricValue=(s:Snapshot,due:number):number|null=>metric==='gross_margin'?(s.financial.gross_margin==null?null:n(s.financial.gross_margin)):metric==='gross_profit'?n(s.financial.gross_profit):metric==='cogs'?n(s.financial.cogs):metric==='expected_cash'?n(s.galla?.expected_cash):metric==='cash_paid_out'?n(s.galla?.cash_paid_out):metric==='recorded_outflows'?s.supplierPayments+s.expenses+s.withdrawals:metric==='customer_receivable_change'||metric==='supplier_payable_change'?due:intentProfit?n(s.financial.net_business_profit):intentExpense?s.expenses:intentPurchase?n(s.purchase.total_purchases):intentReturn?n(s.returns.total_returns):n(s.sales.net_sales);
    const currentValue=metricValue(cur,currentDueMovement),previousValue=metricValue(prev,previousDueMovement);
    const delta=currentValue==null||previousValue==null?null:moneyDelta(currentValue,previousValue),changePercent=currentValue==null||previousValue==null?null:pct(currentValue,previousValue);
    const drivers:InsightDriver[]=[];let rows:Record<string,string|number|null>[]=[];
    const currentProfit=n(cur.financial.net_business_profit),previousProfit=n(prev.financial.net_business_profit);
    const currentGross=n(cur.financial.gross_profit),previousGross=n(prev.financial.gross_profit);
    const currentCost=n(cur.financial.cogs),previousCost=n(prev.financial.cogs);
    const currentExpense=cur.expenses+n(cur.financial.inventory_write_off),previousExpense=prev.expenses+n(prev.financial.inventory_write_off);

    if(!intentProfit&&!intentExpense&&!intentPurchase&&!intentCash&&!intentReturn&&!intentCustomer&&!intentSupplier){
      if(sampleEnough){
        const countEffect=salesParts.billCountImpact,avgEffect=salesParts.averageBillImpact;
        if(Math.abs(countEffect)>=500)drivers.push(this.driver({type:'BILL_COUNT',title:'Bill count',target_metric:'net_sales',current_value:currentBills,previous_value:previousBills,absolute_change:currentBills-previousBills,percentage_change:pct(currentBills,previousBills),impact_amount:round(countEffect),evidence_type:'DIRECT',supporting_metrics:{average_bill_current:round(currentAvg),average_bill_previous:round(previousAvg)},description:`Transaction-count decomposition contributes an estimated ₹${Math.round(countEffect).toLocaleString('en-IN')} of the sales change.`}));
        if(Math.abs(avgEffect)>=500)drivers.push(this.driver({type:'AVERAGE_BILL',title:'Average bill',target_metric:'net_sales',current_value:round(currentAvg),previous_value:round(previousAvg),absolute_change:round(currentAvg-previousAvg),percentage_change:pct(currentAvg,previousAvg),impact_amount:round(avgEffect),evidence_type:'DIRECT',supporting_metrics:{current_bill_count:currentBills,previous_bill_count:previousBills},description:`Average-bill decomposition contributes an estimated ₹${Math.round(avgEffect).toLocaleString('en-IN')} of the sales change.`}));
      }
      const wantCategory=/CATEGORY/.test(intent),wantStaff=/STAFF/.test(intent),group=wantCategory?'categories':wantStaff?'staff':'items';let changes:any[]=[],itemChanges:any[]=[];
      if(intent==='SALES_TREND'){
        const days=Math.floor((+utc(currentPeriod.to)-+utc(currentPeriod.from))/dayMs)+1,interval=days<=14?'day':days<=90?'week':'month';
        const trend=await this.financial.grouped(ctx.company_id,{...currentPeriod,branch_id:ctx.branch_id,offset:0,interval},'trend');
        rows=trend.rows.map((r:any)=>({period:r.label,net_sales:n(r.net_sales),known_cogs:r.cogs==null?null:n(r.cogs),gross_profit:r.gross_profit==null?null:n(r.gross_profit)}));
      }else{
        const salesDiagnosis=['WHY_SALES_DOWN','WHY_SALES_UP','COMPARE_SALES','BUSINESS_PROBLEM_SIGNALS'].includes(intent);
        const dimensions:('items'|'categories'|'staff'|'customers')[]=salesDiagnosis?['items','categories','staff','customers']:[group];
        const paired=await Promise.all(dimensions.map(async dimension=>[dimension,await Promise.all([this.groups(ctx,currentPeriod,dimension),this.groups(ctx,previousPeriod,dimension)])] as const));
        for(const [dimension,[a,b]] of paired){const direction=(intent==='WHY_SALES_UP'||intent==='ITEM_SALES_GROWTH'||intent==='CATEGORY_SALES_GROWTH')?'desc':'asc',dimensionChanges=this.compareGroups(a,b,'net_sales',direction);
          if(dimension==='items')itemChanges=dimensionChanges;if(dimension===group)changes=dimensionChanges;
          if(dimension===group)rows=dimensionChanges.map(r=>({name:r.label,current_sales:r.current,previous_sales:r.previous,change:r.change,change_percent:r.percent}));
          for(const item of dimensionChanges.slice(0,salesDiagnosis?2:3))if(Math.abs(item.change)>=500)drivers.push(this.driver({type:dimension.toUpperCase(),title:item.label,target_metric:'net_sales',current_value:item.current,previous_value:item.previous,absolute_change:item.change,percentage_change:item.percent,impact_amount:null,evidence_type:'CORRELATED',supporting_metrics:{dimension},description:`${item.label} sales moved with the overall result. This ${dimension} view overlaps total sales and is supporting evidence, not an additional cause to add.`}));
        }
      }
      if(intent==='STOCKOUT_IMPACT'||intent==='WHY_SALES_DOWN'||intent==='BUSINESS_PROBLEM_SIGNALS'){
        const candidates=itemChanges.filter(x=>x.change<0&&x.id).slice(0,5);
        const availability=await Promise.all(candidates.map(async x=>{try{const r=await this.operations.stock(ctx.company_id,{branch_id:ctx.branch_id,item_id:x.id},0,1,dateRange('today',ctx.timezone).to,'ALL');return {...x,stock:r.items[0]?.quantity??0};}catch{return {...x,stock:null};}}));
        for(const x of availability.filter(x=>x.stock!==null&&x.stock<=0))drivers.push(this.driver({type:'CURRENT_OUT_OF_STOCK',title:`${x.label}: currently out of stock`,target_metric:'item_sales',current_value:x.stock,previous_value:null,absolute_change:null,percentage_change:null,impact_amount:null,evidence_type:'CORRELATED',supporting_metrics:{item_sales_change:x.change},description:'The item has no counted stock now and its selected-period sales declined. Historical stock-out duration and lost sales are unavailable, so no lost-revenue estimate is claimed.'}));
      }
    }
    if(intentProfit){
      if(cur.financial.complete===false||prev.financial.complete===false){/* confidence and warning are propagated below */}
      drivers.push(this.metricDriver('Gross profit', 'GROSS_PROFIT_CHANGE',currentGross,previousGross,'DIRECT','net_business_profit','Authoritative Phase 5.6 gross profit movement before business expenses.'));
      drivers.push(this.metricDriver('Business expenses and write-offs','EXPENSE_CHANGE',currentExpense,previousExpense,'DIRECT','net_business_profit','Expense movement reduces net business profit; drawings and supplier payments are excluded.',-1));
      const cogsIntent=intent==='COGS_CHANGE_EXPLANATION';drivers.push(this.metricDriver('COGS','COGS_CHANGE',currentCost,previousCost,cogsIntent?'DIRECT':'CORRELATED',cogsIntent?'cogs':'gross_profit',cogsIntent?'Saved sale-time weighted-average COGS, including original-cost return reversal.': 'COGS is already reflected in authoritative gross profit; this explains the profit movement and must not be added to gross profit a second time.'));
      if(Math.abs(n(cur.financial.gross_margin)-n(prev.financial.gross_margin))>=0.2)drivers.push(this.driver({type:'GROSS_MARGIN',title:'Gross margin',target_metric:'gross_margin',current_value:cur.financial.gross_margin,previous_value:prev.financial.gross_margin,absolute_change:round(n(cur.financial.gross_margin)-n(prev.financial.gross_margin)),percentage_change:null,impact_amount:null,evidence_type:intent==='MARGIN_CHANGE_EXPLANATION'?'DIRECT':'CORRELATED',supporting_metrics:{current_coverage:cur.financial.cost_coverage,previous_coverage:prev.financial.cost_coverage},description:'Margin movement is a ratio view of the same revenue and COGS facts above; do not add its impact again.'}));
      if(Math.abs(cur.discounts-prev.discounts)>=500)drivers.push(this.metricDriver('Recorded bill discounts','DISCOUNT_CHANGE',cur.discounts,prev.discounts,'CORRELATED','gross_profit','Discounts are already reflected in saved sale revenue; this is a supporting indicator and is not added again.'));
      if(Math.abs(n(cur.returns.total_returns)-n(prev.returns.total_returns))>=500)drivers.push(this.metricDriver('Sales returns','RETURN_CHANGE',n(cur.returns.total_returns),n(prev.returns.total_returns),'CORRELATED','net_sales','Returns are already included in net sales and COGS reversal; shown here as supporting context.'));
      const isTrend=intent==='PROFIT_TREND',group=intent.startsWith('CATEGORY_')?'categories':'items';
      if(isTrend){const days=Math.floor((+utc(currentPeriod.to)-+utc(currentPeriod.from))/dayMs)+1,interval=days<=14?'day':days<=90?'week':'month';const trend=await this.financial.grouped(ctx.company_id,{...currentPeriod,branch_id:ctx.branch_id,offset:0,interval},'trend');rows=trend.rows.map((r:any)=>({period:r.label,net_sales:n(r.net_sales),cogs:r.cogs==null?null:n(r.cogs),gross_profit:r.gross_profit==null?null:n(r.gross_profit)}));}
      else{
        const target=intent==='COGS_CHANGE_EXPLANATION'?'cogs':'gross_profit';const [a,b]=await Promise.all([this.groups(ctx,currentPeriod,group),this.groups(ctx,previousPeriod,group)]);
        const changes=this.compareGroups(a,b,target as any);rows=changes.map(r=>({[group==='items'?'item':'category']:r.label,current_net_sales:r.currentRevenue,previous_net_sales:r.previousRevenue,current_cogs:r.currentCogs,previous_cogs:r.previousCogs,current_gross_profit:target==='gross_profit'?r.current:null,previous_gross_profit:target==='gross_profit'?r.previous:null,current_profit_or_cogs:r.current,previous_profit_or_cogs:r.previous,change:r.change,current_quantity:r.currentQuantity,previous_quantity:r.previousQuantity,current_margin:r.margin,previous_margin:r.previousMargin,unknown_lines:r.unknown}));
        for(const item of changes.slice(0,3))if(Math.abs(item.change)>=500)drivers.push(this.driver({type:group.toUpperCase(),title:item.label,target_metric:metric,current_value:item.current,previous_value:item.previous,absolute_change:item.change,percentage_change:item.percent,impact_amount:null,evidence_type:'CORRELATED',supporting_metrics:{dimension:group},description:'This dimension is a supporting view of the same financial facts and is not added as an independent cause.'}));
        const highMarginDeclines=changes.filter(x=>x.previousRevenue>x.currentRevenue&&x.previousMargin!=null&&n(x.previousMargin)>n(prev.financial.gross_margin)).sort((x,y)=>(y.previousRevenue-y.currentRevenue)-(x.previousRevenue-x.currentRevenue));
        const lowerMarginGrowth=changes.filter(x=>x.currentRevenue>x.previousRevenue&&x.margin!=null&&n(x.margin)<n(cur.financial.gross_margin)).sort((x,y)=>(y.currentRevenue-y.previousRevenue)-(x.currentRevenue-x.previousRevenue));
        if(group==='items'&&currentGross<previousGross&&highMarginDeclines.length&&lowerMarginGrowth.length)drivers.push(this.driver({type:'PRODUCT_MIX',title:'Product mix shifted toward lower-margin sales',target_metric:'gross_profit',current_value:cur.financial.gross_margin,previous_value:prev.financial.gross_margin,absolute_change:round(n(cur.financial.gross_margin)-n(prev.financial.gross_margin)),percentage_change:null,impact_amount:null,evidence_type:'CORRELATED',supporting_metrics:{high_margin_items_down:highMarginDeclines.slice(0,2).map(x=>x.label).join(', '),lower_margin_items_up:lowerMarginGrowth.slice(0,2).map(x=>x.label).join(', ')},description:`Higher-margin items such as ${highMarginDeclines.slice(0,2).map(x=>x.label).join(', ')} lost sales share while lower-margin items such as ${lowerMarginGrowth.slice(0,2).map(x=>x.label).join(', ')} grew. This is a correlated product-mix signal, not a separate amount to add.`}));
      }
    }
    if(intentExpense){
      drivers.push(this.metricDriver('Business expenses','BUSINESS_EXPENSE',cur.expenses,prev.expenses,'DIRECT','net_business_profit','Posted business expense only; owner withdrawals and supplier settlements are excluded.'));
      const [a,b]=await Promise.all([this.expenseCategories(ctx,currentPeriod),this.expenseCategories(ctx,previousPeriod)]);const old=new Map(b.map(x=>[x.label,x.current]));
      rows=a.map(x=>({category:x.label,current:x.current,previous:old.get(x.label)||0,change:round(x.current-(old.get(x.label)||0))})).sort((x:any,y:any)=>y.change-x.change).slice(0,5);
      for(const x of rows.slice(0,3))if(n(x.change)>500)drivers.push(this.driver({type:'EXPENSE_CATEGORY',title:String(x.category),target_metric:'business_expenses',current_value:x.current,previous_value:x.previous,absolute_change:x.change,percentage_change:pct(n(x.current),n(x.previous)),impact_amount:null,evidence_type:'CORRELATED',supporting_metrics:{dimension:'expense category'},description:'Category movement supports the overall expense total and is not added as another expense.'}));
    }
    if(intentPurchase){drivers.push(this.metricDriver('Posted purchases','PURCHASES',n(cur.purchase.total_purchases),n(prev.purchase.total_purchases),'CORRELATED','purchases','Posted supplier invoices in the same branch and comparable date range; purchase outlay is not treated as a profit expense.'));}
    if(intentReturn){drivers.push(this.metricDriver('Posted returns','RETURNS',n(cur.returns.total_returns),n(prev.returns.total_returns),'DIRECT','net_sales','Returns reduce reported net sales and reverse their original saved COGS.',-1));
      drivers.push(this.metricDriver('Return count','RETURN_COUNT',n(cur.returns.returns_count),n(prev.returns.returns_count),'CORRELATED','returns','Return count is supporting context for the recorded return amount.'));}
    if(intentCustomer||intentSupplier){const [a,b]=partyFlows!;const changes=this.compareGroups(a.map(x=>({...x,net_sales:x.change})),b.map(x=>({...x,net_sales:x.change})),'net_sales');if(intent==='CUSTOMER_RECEIVABLE_GROWTH'||intent==='SUPPLIER_PAYABLE_CHANGE')changes.sort((x,y)=>y.change-x.change);rows=changes.map(x=>({party:x.label,current_due_movement:x.current,previous_due_movement:x.previous,change:x.change}));
      drivers.push(this.metricDriver(intentCustomer?'New credit billed':'New supplier references','NEW_DUE_REFERENCE',intentCustomer?n(cur.payments.udhar_sales):n(cur.purchase.outstanding_amount),intentCustomer?n(prev.payments.udhar_sales):n(prev.purchase.outstanding_amount),'DIRECT',intentCustomer?'customer_receivables':'supplier_payables','Period activity, not an invented historical closing-balance snapshot.'));
      drivers.push(this.metricDriver(intentCustomer?'Customer collections':'Supplier payments','SETTLEMENTS',intentCustomer?cur.collections:cur.supplierPayments,intentCustomer?prev.collections:prev.supplierPayments,'DIRECT',intentCustomer?'customer_receivables':'supplier_payables','Posted settlement vouchers in the selected period. Supplier payments settle liabilities; they are not expenses.'));
    }
    if(intentCash){
      if(cur.galla&&prev.galla){
        const facts:[string,string,number,number,string][]=[
          ['Cash sales','CASH_SALES',n(cur.galla.cash_sales),n(prev.galla.cash_sales),'Actual cash tender at checkout; UPI and card are excluded.'],
          ['Old customer dues collected in cash','OLD_DUE_CASH',n(cur.galla.old_dues_cash),n(prev.galla.old_dues_cash),'Actual cash received against earlier customer dues.'],
          ['Cash expenses','CASH_EXPENSES',n(cur.galla.cash_expenses),n(prev.galla.cash_expenses),'Posted expenses paid from the cash drawer.'],
          ['Supplier payments in cash','SUPPLIER_CASH',n(cur.galla.supplier_cash),n(prev.galla.supplier_cash),'Supplier payments classified as cash, not UPI/card/bank.'],
          ['Cash refunds','CASH_REFUNDS',n(cur.galla.cash_refunds),n(prev.galla.cash_refunds),'Refunds posted to the cash drawer.'],
          ['Owner cash withdrawals','OWNER_CASH_WITHDRAWAL',n(cur.galla.cash_owner_withdrawals),n(prev.galla.cash_owner_withdrawals),'Owner cash drawings reduce drawer cash, not operating profit.'],
          ['Expected drawer cash','EXPECTED_DRAWER',n(cur.galla.expected_cash),n(prev.galla.expected_cash),'Same authoritative Daily Galla calculation; opening cash and all posted cash movements are included.'],
        ];
        for(const [title,key,a,b,description] of facts){const sign=['CASH_EXPENSES','SUPPLIER_CASH','CASH_REFUNDS','OWNER_CASH_WITHDRAWAL'].includes(key)?-1:1;drivers.push(this.metricDriver(title,key,a,b,'DIRECT',key==='EXPECTED_DRAWER'?'expected_cash':'cash_movement',description,sign));}
      }else{
        const cashCur=cur.payments.cash_sales,cashPrev=prev.payments.cash_sales,creditCur=n(cur.payments.udhar_sales),creditPrev=n(prev.payments.udhar_sales);
        drivers.push(this.metricDriver('Cash sales at checkout','CASH_SALES',cashCur,cashPrev,'DIRECT','cash_tender','Recorded checkout tender; UPI and card remain separate.'));
        drivers.push(this.metricDriver('New credit given','CREDIT_SALES',creditCur,creditPrev,'CORRELATED','receivables','Unpaid checkout value increases receivables; it is not a cash receipt.'));
        drivers.push(this.metricDriver('Customer collections','CUSTOMER_COLLECTIONS',cur.collections,prev.collections,'DIRECT','working_capital','Posted customer settlements by all payment methods, separate from checkout sales.'));
        drivers.push(this.metricDriver('Supplier payments','SUPPLIER_PAYMENTS',cur.supplierPayments,prev.supplierPayments,'DIRECT','working_capital','Posted supplier settlements; not a profit expense.',-1));
        drivers.push(this.metricDriver('Business expenses','BUSINESS_EXPENSES',cur.expenses,prev.expenses,'DIRECT','working_capital','Posted operating expenses; period total may contain multiple payment methods.',-1));
        drivers.push(this.metricDriver('Owner withdrawals','OWNER_WITHDRAWALS',cur.withdrawals,prev.withdrawals,'DIRECT','working_capital','Owner drawings reduce funds but are not a business expense.',-1));
        drivers.push(this.metricDriver('Sales returns','REFUNDS',n(cur.returns.total_returns),n(prev.returns.total_returns),'CORRELATED','working_capital','Return value is not assumed to equal cash refund; tender-specific refund movement is unavailable for a multi-day range.'));
      }
    }
    if(cashBridge){
      const customerNow=cashBridge[0].reduce((s,x)=>s+x.change,0),customerBefore=cashBridge[1].reduce((s,x)=>s+x.change,0);
      const supplierNow=cashBridge[2].reduce((s,x)=>s+x.change,0),supplierBefore=cashBridge[3].reduce((s,x)=>s+x.change,0);
      drivers.push(this.metricDriver('Net customer receivable movement','RECEIVABLE_MOVEMENT',customerNow,customerBefore,'CORRELATED','cash_conversion','New credit less customer settlements increases receivables and can explain cash pressure; it is not a profit expense.',-1));
      drivers.push(this.metricDriver('Inventory purchases recorded','INVENTORY_PURCHASES',n(cur.purchase.total_purchases),n(prev.purchase.total_purchases),'CORRELATED','cash_conversion','Purchase value is shown as working-capital context. Credit purchases are not assumed to be cash paid.'));
      drivers.push(this.metricDriver('Supplier payable movement','SUPPLIER_PAYABLE_MOVEMENT',supplierNow,supplierBefore,'CORRELATED','cash_conversion','Net new supplier references less settlements; this describes payable movement and is not added to cash paid out.'));
    }
    if(intentHealth||intent==='BUSINESS_PROBLEM_SIGNALS'){
      const values=[['Sales',currentSales,previousSales],['Gross profit',currentGross,previousGross],['Net profit',currentProfit,previousProfit],['Business expenses',cur.expenses,prev.expenses],['Returns',n(cur.returns.total_returns),n(prev.returns.total_returns)]] as const;
      for(const [label,a,b] of values)if(Math.abs(a-b)>=Math.max(500,Math.max(a,b)*0.03))drivers.push(this.metricDriver(label,label.toUpperCase().replaceAll(' ','_'),a,b,'CORRELATED','business_health','Measured period change. Dimensions overlap and should not be summed as separate causes.'));
      drivers.push(this.driver({type:'COST_COVERAGE',title:'Product cost coverage',target_metric:'profit_confidence',current_value:n(cur.financial.cost_coverage),previous_value:n(prev.financial.cost_coverage),absolute_change:round(n(cur.financial.cost_coverage)-n(prev.financial.cost_coverage)),percentage_change:null,impact_amount:null,evidence_type:'DIRECT',supporting_metrics:{profit_complete:cur.financial.complete?'Yes':'No'},description:String(cur.financial.warning||'All product lines in this period have saved costs.')}));
      const group=intent==='CATEGORY_PROFIT_DECLINE'||intent==='CATEGORY_MARGIN_DECLINE'?'categories':'items';const [a,b]=await Promise.all([this.groups(ctx,currentPeriod,group),this.groups(ctx,previousPeriod,group)]);rows=this.compareGroups(a,b,'net_sales').map(x=>({[group==='items'?'item':'category']:x.label,current_sales:x.current,previous_sales:x.previous,change:x.change,change_percent:x.percent}));
    }
    if(intent==='WEEKDAY_SALES_ANALYSIS'){
      const weekdays=await this.weekday(ctx,currentPeriod),names=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      rows=weekdays.map(x=>({weekday:names[n(x.weekday)-1],sales:n(x.sales),bills:n(x.bills)})).sort((a,b)=>n(b.sales)-n(a.sales));
    }
    if(intent==='LOW_MARGIN_ITEMS_ANALYSIS'||intent==='LOSS_MAKING_ITEMS_ANALYSIS'){
      const group=intent==='LOW_MARGIN_ITEMS_ANALYSIS'?'low-margin':'below-cost';const r=await this.financial.grouped(ctx.company_id,{...currentPeriod,branch_id:ctx.branch_id,offset:0},group);
      rows=r.rows.map((x:any)=>({item:x.label,sales:n(x.net_sales),cogs:x.cogs==null?null:n(x.cogs),profit:x.gross_profit==null?null:n(x.gross_profit),margin:x.gross_margin==null?null:n(x.gross_margin),unknown_lines:x.unknown_lines}));
    }

    if(intent==='PROFIT_VS_CASH_EXPLANATION'){
      const priority=['GROSS_PROFIT_CHANGE','EXPENSE_CHANGE','RECEIVABLE_MOVEMENT','INVENTORY_PURCHASES','SUPPLIER_PAYABLE_MOVEMENT','EXPECTED_DRAWER','CASH_EXPENSES','OWNER_CASH_WITHDRAWAL','SUPPLIER_CASH','CASH_SALES','OLD_DUE_CASH','CASH_REFUNDS'];
      drivers.sort((a,b)=>{const ai=priority.indexOf(a.type),bi=priority.indexOf(b.type);return (ai<0?priority.length:ai)-(bi<0?priority.length:bi)||Math.abs(n(b.impact_amount??b.absolute_change))-Math.abs(n(a.impact_amount??a.absolute_change));});
    }else drivers.sort((a,b)=>{
      if(intent==='COGS_CHANGE_EXPLANATION'||intent==='MARGIN_CHANGE_EXPLANATION'){const preferred=intent==='COGS_CHANGE_EXPLANATION'?'COGS_CHANGE':'GROSS_MARGIN';if(a.type===preferred&&b.type!==preferred)return -1;if(b.type===preferred&&a.type!==preferred)return 1;}
      return ({DIRECT:0,CORRELATED:1,ESTIMATED:2}[a.evidence_type]-({DIRECT:0,CORRELATED:1,ESTIMATED:2}[b.evidence_type]))||Math.abs(n(b.impact_amount??b.absolute_change))-Math.abs(n(a.impact_amount??a.absolute_change));
    });
    const needsMinimumSample=(intentProfit&&!['PROFIT_TREND','LOW_MARGIN_ITEMS_ANALYSIS','LOSS_MAKING_ITEMS_ANALYSIS'].includes(intent))||(!intentExpense&&!intentPurchase&&!intentCash&&!intentReturn&&!intentCustomer&&!intentSupplier&&!['SALES_TREND','WEEKDAY_SALES_ANALYSIS'].includes(intent));
    const confidence=needsMinimumSample&&!sampleEnough?'INSUFFICIENT':intentProfit&&(cur.financial.complete===false||prev.financial.complete===false||metric==='gross_margin'&&(cur.financial.gross_margin==null||prev.financial.gross_margin==null))?'LIMITED':'HIGH';
    const followUps=intentProfit?['Margin kyu gira?','Kaunsa item profit kam kar raha hai?','COGS compare karo','Expenses compare karo','Loss me kya bika?']:
      ['Kaunsa item sabse zyada gira?','Category compare karo','Staff compare karo','Stock-out items dikhao'];
    const summary:Record<string,string|number|null>={metric,current_value:currentValue==null?null:round(currentValue),previous_value:previousValue==null?null:round(previousValue),change:delta,change_percent:changePercent,
      current_sales:round(currentSales),previous_sales:round(previousSales),current_bills:currentBills,previous_bills:previousBills,current_average_bill:round(currentAvg),previous_average_bill:round(previousAvg),
      current_gross_profit:round(currentGross),previous_gross_profit:round(previousGross),current_cogs:round(currentCost),previous_cogs:round(previousCost),
      current_business_expenses:round(currentExpense),previous_business_expenses:round(previousExpense),current_margin:cur.financial.gross_margin,previous_margin:prev.financial.gross_margin,
      current_cost_coverage:cur.financial.cost_coverage,previous_cost_coverage:prev.financial.cost_coverage,profit_complete:cur.financial.complete?'Yes':'No',profit_warning:cur.financial.warning,
      current_cash_sales:round(cur.payments.cash_sales),current_upi_sales:round(cur.payments.upi_sales),current_udhar_sales:round(cur.payments.udhar_sales),
      current_customer_collections:round(cur.collections),current_supplier_payments:round(cur.supplierPayments),current_owner_withdrawals:round(cur.withdrawals),
      current_returns:round(n(cur.returns.total_returns)),current_discounts:round(cur.discounts),current_purchases:round(n(cur.purchase.total_purchases)),sample_sufficient:sampleEnough?'Yes':'No'};
    summary.current_recorded_outflows=round(outflowCur);summary.previous_recorded_outflows=round(outflowPrev);
    if(cur.galla){summary.current_expected_cash=round(cur.galla.expected_cash);summary.current_cash_paid_out=round(cur.galla.cash_paid_out);summary.current_actual_cash=cur.galla.actual_cash==null?null:n(cur.galla.actual_cash);summary.current_cash_difference=cur.galla.difference==null?null:n(cur.galla.difference);}
    const title=intentProfit?'Profit diagnosis':intentExpense?'Expense diagnosis':intentPurchase?'Purchase comparison':intentCash?'Cash and sales analysis':intentHealth?'Business health signals':intentReturn?'Return impact':intentCustomer?'Customer receivable activity':intentSupplier?'Supplier payable activity':intent==='WEEKDAY_SALES_ANALYSIS'?'Sales by weekday':'Sales diagnosis';
    const insufficient=needsMinimumSample&&!sampleEnough&&intent!=='WEEKDAY_SALES_ANALYSIS';
    const definition='Compared equal-length business-date periods for the authenticated company and branch. Direct drivers reconcile to their target metric; item/category/staff/stock observations are supporting correlated views and are not summed. Profit and COGS use saved Phase 5.6 facts. Unknown costs remain incomplete. No external LLM or unsupported causal claim is used.';
    const insight:BusinessInsight={current_period:currentPeriod,comparison_period:previousPeriod,delta,change_percent:changePercent,metric,drivers:insufficient?[]:drivers.slice(0,10),follow_ups:followUps,confidence:insufficient?'INSUFFICIENT':confidence};
    return {title,summary,rows:insufficient?[]:rows.slice(0,10),definition,empty:insufficient,
      link:intentProfit?'/retail/reports/financial/profit':intentCash?'/retail/galla':intentExpense?'/retail/reports/expenses':intentPurchase?'/retail/reports/purchases':'/retail/reports/sales',insight};
  }
}
