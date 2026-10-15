import { Injectable,BadRequestException,ForbiddenException } from '@nestjs/common';
import { INTENT_MAP,INTENTS } from './intent-library';
import { AssistantContext,QueryContext,Result } from './assistant.types';
import { RetailService } from '../retail/retail.service';
import { ReportsService } from '../retail/reports/reports.service';
import { OperationalReportsService } from '../retail/reports/operational-reports.service';
import { CounterService } from '../retail/counter/counter.service';
import { BillingService } from '../retail/billing/billing.service';
import { EntitlementService } from '../common/entitlement.service';
import { dateRange } from './nlp';
import { FinancialReportsService } from '../retail/reports/financial-reports.service';
import { BusinessInsightService } from './business-insight.service';
@Injectable()
export class AssistantToolRegistry {
  constructor(private retail:RetailService,private reports:ReportsService,private operations:OperationalReportsService,private counter:CounterService,private billing:BillingService,private entitlements:EntitlementService,private financial:FinancialReportsService,private insights:BusinessInsightService){}
  permitted(ctx:AssistantContext,code:string){const d=INTENT_MAP.get(code);return !!d&&(['ADMIN','OWNER','TENANT_ADMIN'].includes(ctx.role)||d.permissions.every(p=>ctx.permissions.includes(p)));}
  async authorize(ctx:AssistantContext,code:string){
    const d=INTENT_MAP.get(code);if(!d||!this.permitted(ctx,code))throw new ForbiddenException('Assistant permission denied');
    // Insight snapshots include saved costs/profit even for sales or cash diagnosis.
    // Require profit access before any financial snapshot is loaded or returned.
    await this.entitlements.require(ctx.organization_id,['ASSISTANT_TEXT',d.feature,...(d.category==='insight'?['BUSINESS_INSIGHTS','PROFIT_REPORTING','REPORTS']:[]),...(d.category==='financial'?['PROFIT_REPORTING']:[])],ctx.company_id);
  }
  async execute(ctx:AssistantContext,q:QueryContext):Promise<Result>{
    await this.authorize(ctx,q.intent);const d=INTENT_MAP.get(q.intent)!;
    if(d.category==='insight')return this.insights.analyze(ctx,q.intent,q.dates);
    const currentOnly=['CUSTOMER_BALANCE','SUPPLIER_BALANCE','CUSTOMER_TOTAL_DUE','SUPPLIER_TOTAL_DUE','CUSTOMER_OVERDUE','ITEM_STOCK','LOW_STOCK','OUT_OF_STOCK','STOCK_SUMMARY','LOCATION_STOCK','BATCH_STOCK','EXPIRING_ITEMS','EXPIRED_ITEMS','NEED_LIST','URGENT_NEEDS','PENDING_NEEDS','SUBSCRIPTION_STATUS','SUBSCRIPTION_EXPIRY','CURRENT_PLAN'];
    const today=dateRange('today',ctx.timezone).from;
    if(currentOnly.includes(q.intent)&&q.dates.explicit&&(q.dates.from!==today||q.dates.to!==today))throw new BadRequestException('This question shows current records, not reconstructed historical stock, balances or settings. Ask without a past date.');
    const f={from:q.dates.from,to:q.dates.to,branch_id:ctx.branch_id,...(q.entity?.kind==='customer'?{customer_id:q.entity.id}:{}),...(q.entity?.kind==='supplier'?{supplier_id:q.entity.id}:{}),...(q.entity?.kind==='staff'?{staff_id:q.entity.id}:{}),...(q.entity?.kind==='item'?{item_id:q.entity.id}:{}),...(q.entity?.kind==='category'?{category_id:q.entity.id}:{}),...(q.entity?.kind==='location'?{godown_id:q.entity.id}:{}),...(q.variantId&&q.variantId!=='ALL'?{variant_id:q.variantId}:{})};
    if(q.itemEntity)f.item_id=q.itemEntity.id;
    const title=q.entity?`${d.name}: ${q.entity.name}${q.itemEntity?' · '+q.itemEntity.name:''}`:d.name;
    const result=(summary:Record<string,string|number|null>,definition:string,extra:Partial<Result>={})=>({title,summary,definition,...extra});
    if(d.category==='financial'){
      const filters={...f,...(q.intent==='BILL_PROFIT'?{bill_id:q.entity!.id}:{})};
      if(q.intent==='BILL_PROFIT'&&!q.dates.explicit){const bill=await this.billing.getBillDetail(q.entity!.id,ctx.company_id);filters.from=bill.document_date.toISOString().slice(0,10);filters.to=today;q.dates.label='Bill history';q.dates.from=filters.from;q.dates.to=filters.to;}
      const totals=await this.financial.summary(ctx.company_id,filters);
      const grouped:Record<string,string>={TOP_PROFIT_ITEMS:'items',ITEM_PROFIT:'items',BILL_PROFIT:'bills',CATEGORY_PROFIT:'categories',LOW_MARGIN_ITEMS:'low-margin',BELOW_COST_SALES:'below-cost'};
      const rows=grouped[q.intent]?await this.financial.grouped(ctx.company_id,{...filters,offset:q.offset},grouped[q.intent]):null;
      const reportKind=grouped[q.intent]||({GROSS_PROFIT:'gross',NET_PROFIT:'net',GROSS_MARGIN:'margin'} as Record<string,string>)[q.intent]||'profit';
      const reportQuery=new URLSearchParams({from:filters.from,to:filters.to,...(filters.item_id?{item_id:filters.item_id}:{}),...(filters.bill_id?{bill_id:filters.bill_id}:{})});
      return result({gross_profit:totals.gross_profit,net_business_profit:totals.net_business_profit,gross_margin:totals.gross_margin,
        cogs:totals.cogs,net_sales:totals.net_sales,business_expenses:totals.business_expenses,cost_coverage:totals.cost_coverage,
        warning:totals.warning,service_revenue:totals.service_revenue},totals.definition,
        {rows:rows?.rows.map(r=>({item:r.label,profit:r.gross_profit,margin:r.gross_margin,unknown_lines:r.unknown_lines})),hasMore:rows?.hasMore,link:'/retail/reports/financial/'+reportKind+'?'+reportQuery});
    }
    if(['SALES_SUMMARY','CUSTOMER_SALES','STAFF_SALES'].includes(q.intent)){
      const [totals,payments]=await Promise.all([this.operations.sales(ctx.company_id,f),this.counter.salesPayments(ctx.company_id,ctx.branch_id,f.from,f.to,{...(f.customer_id?{party_id:f.customer_id}:{}),...(f.staff_id?{posted_by:f.staff_id}:{})})]);return result({...totals,cash_sales:payments.cash_sales,upi_sales:payments.upi_sales,card_sales:payments.card_sales,bank_sales:payments.bank_sales,udhar_sales:payments.udhar_sales},'Posted invoice value minus posted returns in the selected period. Payment breakdown is original checkout allocation; returns and later collections are separate. Staff returns are attributed to their original invoice seller.',{empty:totals.bills_count===0,link:'/retail/reports/sales'});
    }
    if(['CASH_SALES','UPI_SALES','CARD_SALES','BANK_SALES','UDHAR_SALES','BILL_COUNT','UDHAR_BILL_COUNT'].includes(q.intent)){
      const totals=await this.counter.salesPayments(ctx.company_id,ctx.branch_id,f.from,f.to);
      const key=({CASH_SALES:'cash_sales',UPI_SALES:'upi_sales',CARD_SALES:'card_sales',BANK_SALES:'bank_sales',UDHAR_SALES:'udhar_sales',BILL_COUNT:'bill_count',UDHAR_BILL_COUNT:'udhar_bill_count'} as const)[q.intent]!;
      return result({[key]:totals[key],...(q.intent==='UDHAR_SALES'?{udhar_bill_count:totals.udhar_bill_count,udhar_customers_count:totals.udhar_customers_count}:{})},'Original checkout payment allocation; credit given is unchanged by later collection. Credit customers counts distinct recorded customer profiles. Returns are reported separately.',{empty:totals.bill_count===0,link:'/retail/reports/sales'});
    }
    if(['DAILY_GALLA','EXPECTED_CASH','OPENING_CASH','CASH_RECEIVED'].includes(q.intent)){
      if(f.from!==f.to)throw new BadRequestException('Choose one day for counter cash. Opening and expected drawer cash cannot be added across days.');
      const r=await this.counter.galla(ctx.company_id,ctx.branch_id,f.from);
      const key=({EXPECTED_CASH:'expected_cash',OPENING_CASH:'opening_cash',CASH_RECEIVED:'cash_received'} as const)[q.intent];
      const summary=key?{[key]:r[key]}:Object.fromEntries(Object.entries(r).filter(([k,v])=>typeof v==='number'&&k!=='ledger_opening_cash'));
      return result(summary as Record<string,number>,'Same Daily Galla service as the counter screen. Total sales is gross checkout value; returns/refunds are separate. Actual cash movement drives expected cash; UPI/card never increase physical drawer cash.',{link:'/retail/galla'});
    }
    if(q.intent==='UPI_RECEIVED'){
      const value=await this.counter.upiReceived(ctx.company_id,ctx.branch_id,f.from,f.to);return result({upi_received:value},'UPI at checkout plus separately posted UPI customer collections; same Sales Report received metric.',{link:'/retail/reports/sales'});
    }
    if(['CUSTOMER_DUE_RECEIVED','CUSTOMER_PAYMENT_RECEIVED','SUPPLIER_PAYMENT_SUMMARY'].includes(q.intent)){
      const r=await this.operations.partyPayments(ctx.company_id,ctx.branch_id,q.intent==='SUPPLIER_PAYMENT_SUMMARY'?'SUPPLIER':'CUSTOMER',f);
      return result(r,'Posted party receipt/payment vouchers in the selected period; checkout receipts and refunds excluded.',{empty:r.payments===0,link:q.intent==='SUPPLIER_PAYMENT_SUMMARY'?'/retail/suppliers':'/retail/khata'});
    }
    if(['CUSTOMER_BALANCE','SUPPLIER_BALANCE','CUSTOMER_KHATA','SUPPLIER_KHATA'].includes(q.intent)){
      const type=q.intent.startsWith('CUSTOMER')?'CUSTOMER':'SUPPLIER';
      const r=await this.retail.getPartyStatement(ctx.company_id,q.entity!.id,type,q.offset,q.dates.explicit&&q.intent.endsWith('KHATA')?q.dates:undefined);
      return result({balance:r.balance},'Current company-wide Khata balance: positive is due, negative is an advance. History lists reference allocations, filtered by voucher date when explicitly requested.',{rows:q.intent.endsWith('KHATA')?r.rows:undefined,hasMore:q.intent.endsWith('KHATA')?r.hasMore:false,link:`/retail/${type==='CUSTOMER'?'khata':'suppliers'}/${r.party.id}`});
    }
    if(['CUSTOMER_TOTAL_DUE','SUPPLIER_TOTAL_DUE'].includes(q.intent)){
      const r=await this.operations.dues(ctx.company_id,q.intent==='CUSTOMER_TOTAL_DUE'?'CUSTOMER':'SUPPLIER',q.offset);
      return result(r.summary,'Company-wide positive balances per party; one party advance does not reduce another party due.',{rows:r.rows.map(({name,due})=>({name,due})),hasMore:r.hasMore,empty:!r.summary.parties_count,link:q.intent==='CUSTOMER_TOTAL_DUE'?'/retail/reports/customers':'/retail/reports/suppliers'});
    }
    if(q.intent==='CUSTOMER_OVERDUE'){const r=await this.operations.overdue(ctx.company_id,ctx.branch_id,dateRange('today',ctx.timezone).to,q.offset);return result(r.summary,'Posted unpaid bills whose promised date is before today.',{rows:r.rows,hasMore:r.hasMore,empty:!r.summary.bills_count});}
    if(['PURCHASE_SUMMARY','SUPPLIER_PURCHASE_SUMMARY'].includes(q.intent)){const r=await this.operations.purchase(ctx.company_id,f);return result(r,'Posted purchase invoices, with their paid and outstanding amounts.',{empty:!r.purchase_count,link:'/retail/reports/purchases'});}
    if(['EXPENSE_SUMMARY','EXPENSE_BY_CATEGORY','OWNER_WITHDRAWAL_SUMMARY'].includes(q.intent)){
      const r=await this.operations.expenses(ctx.company_id,f),key=q.intent==='OWNER_WITHDRAWAL_SUMMARY'?'owner_withdrawal':'business_expenses';return result({[key]:r[key]},'Posted Business Expense and Owner Withdrawal remain separate; same Expense Report totals.',{empty:r[key]===0,link:'/retail/reports/expenses'});
    }
    if(['RETURN_SUMMARY','RETURN_COUNT'].includes(q.intent)){const r=await this.operations.returns(ctx.company_id,f);return result(q.intent==='RETURN_COUNT'?{returns_count:r.returns_count}:r,'Posted sales returns in the selected period; a return is separate from cash refund movement.',{empty:!r.returns_count,link:'/retail/reports/returns'});}
    if(['TOP_SELLING_ITEMS','ITEM_SALES'].includes(q.intent)){
      const rows=await this.reports.getTopItemsReport(ctx.company_id,f);return result({matching_items:rows.length},'Ranked by net sale value, as the existing Top Items report; net line quantities/value shown and fully returned items omitted.',{rows:rows.slice(q.offset,q.offset+5).map(r=>({item:r.name,quantity:r.qty,value:r.value})),hasMore:rows.length>q.offset+5,empty:!rows.length,link:'/retail/reports/sales'});
    }
    if(['ITEM_STOCK','LOW_STOCK','OUT_OF_STOCK','STOCK_SUMMARY','LOCATION_STOCK'].includes(q.intent)){
      const r=await this.operations.stock(ctx.company_id,f,q.offset,5,dateRange('today',ctx.timezone).to,q.intent==='LOW_STOCK'?'LOW':q.intent==='OUT_OF_STOCK'?'OUT':'ALL',true);
      if(q.intent==='ITEM_STOCK'&&!r.items.length)return result({counted_stock:null},'This item has no counted physical stock. Services, kits and uncounted items are excluded; availability is not invented.',{empty:true,link:'/retail/stock'});
      let factor=1,unit=q.intent==='ITEM_STOCK'?r.items[0]?.unit||'':'';
      if(q.intent==='ITEM_STOCK'&&q.unitSearch){const opts=await this.retail.getItemUnits(ctx.company_id,q.entity!.id);const wanted=({packets:'packet',pieces:'piece',bottles:'bottle',pcs:'piece'} as Record<string,string>)[q.unitSearch]||q.unitSearch;
        const matches=(u:{code:string;name:string})=>[u.code,u.name].some(s=>s.toLowerCase()===wanted||(wanted==='piece'&&s.toUpperCase()==='PCS'));
        if(!matches(opts.primary_unit)){const conversion=opts.unit_conversions.find(c=>matches(c.from_unit)&&c.to_unit_id===opts.primary_unit_id);if(!conversion)throw new BadRequestException('That unit is not configured for this item. Ask using its displayed unit.');factor=Number(conversion.conversion_factor);unit=conversion.from_unit.code;}
      }
      const rows=r.items.map(i=>({item:i.name,quantity:Number((i.quantity/factor).toFixed(6)),unit:unit||i.unit}));
      const summary:any=q.intent==='ITEM_STOCK'?{quantity:rows[0].quantity,unit:rows[0].unit,...(q.quantity?{requested_quantity:q.quantity,available:rows[0].quantity>=q.quantity?'Yes':'No'}:{})}:r.summary;
      return result(summary,'Current sellable stock from Inventory projections, excluding expired lots, services, kits, inactive and uncounted items. Historical stock is not reconstructed.',{rows,hasMore:r.hasMore,empty:!r.matched_count,link:'/retail/stock'});
    }
    if(['EXPIRING_ITEMS','EXPIRED_ITEMS','BATCH_STOCK'].includes(q.intent)){const r=await this.operations.batches(ctx.company_id,ctx.branch_id,{expired:q.intent==='EXPIRED_ITEMS',expiring:q.intent==='EXPIRING_ITEMS',item_id:q.entity?.id,offset:q.offset,today:dateRange('today',ctx.timezone).to});return result(r.summary,'Current positive stock by received lot; upcoming expiry covers today through the next 30 days, not receipt-history quantity.',{rows:r.rows,hasMore:r.hasMore,empty:!r.summary.stock_lots,link:'/retail/stock'});}
    if(['NEED_LIST','URGENT_NEEDS','PENDING_NEEDS'].includes(q.intent)){const r=await this.operations.needs(ctx.company_id,ctx.branch_id,q.intent==='URGENT_NEEDS',q.offset);return result(r.summary,'Open NEED/ORDERED entries; received or cancelled entries excluded.',{rows:r.rows,hasMore:r.hasMore,empty:!r.summary.pending_needs,link:'/retail/needs'});}
    if(q.intent==='NEW_STOCK_RECEIVED'){const r=await this.operations.received(ctx.company_id,ctx.branch_id,f,q.offset);return result(r.summary,'Posted PURCHASE_IN movements; excludes imported opening stock. Receipt quantities only; purchase amounts are available in the Purchase Report, not inferred from stock valuation.',{rows:r.rows,hasMore:r.hasMore,empty:!r.summary.stock_movements,link:'/retail/purchases'});}
    if(q.intent==='BILL_LOOKUP'){const r=await this.billing.getBillDetail(q.entity!.id,ctx.company_id);if(r.branch_id!==ctx.branch_id)throw new ForbiddenException('Bill belongs to another store');return result({bill:r.document_number,total:Number(r.grand_total),paid:Number(r.paid_amount),due:Number(r.outstanding_amount)},'Saved invoice and current outstanding amount.',{rows:r.sales_invoice_line.slice(0,5).map(l=>({item:l.item.name,quantity:Number(l.quantity),amount:Number(l.line_total)})),link:'/retail/bills/'+r.id});}
    if(['SUBSCRIPTION_STATUS','SUBSCRIPTION_EXPIRY','CURRENT_PLAN'].includes(q.intent)){const r=this.entitlements.subscriptionSummary(await this.entitlements.resolve(ctx.organization_id));return result(r?{status:r.status,plan:r.plan_name,expires:r.expires_at.toISOString().slice(0,10),days_left:Math.max(0,Math.ceil((+r.expires_at-Date.now())/86400000))}:{status:'NOT_CONFIGURED'},'Persisted tenant subscription and effective plan; expiry never deletes tenant data.',{link:'/retail/more/subscription'});}
    throw new BadRequestException('This business tool is unavailable');
  }
}

