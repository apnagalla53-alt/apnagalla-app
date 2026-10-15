import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { businessDate } from '../../common/business-date';
import { throttleOperation } from '../../common/operation-throttle';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { FeatureGuard, RequireFeature } from '../../common/guards/feature.guard';

@Controller('api/v1/retail/account/notifications')
@UseGuards(AuthGuard, SubscriptionGuard, FeatureGuard)
@RequireFeature('RETAIL_POS')
export class RetailNotificationsController {
  constructor(private db: PrismaService) {}
  @Get()
  async feed(@Req() req:any) {
    const user=req.user, scope={company_id:user.company_id,branch_id:user.branch_id};
    await throttleOperation('shop-notifications:'+user.id,120);
    const owner=['OWNER','ADMIN','TENANT_ADMIN'].includes(user.role);
    const can=(permission:string)=>owner||user.permissions.includes(permission);
    const since=new Date(Date.now()-7*86400_000),today=businessDate(),date=new Date(today+'T00:00:00Z');
    type Tone='success'|'danger'|'warning'|'info';
    type Alert={id:string;title:string;body:string;path:string;at:string;tone:Tone};
    const rows:Alert[]=[];
    const add=(kind:string,row:any,title:string,body:string,path:string,at:Date,tone:Tone=kind.startsWith('due-')||kind.startsWith('task-')?'warning':kind==='report'?'info':'success')=>rows.push({id:kind+':'+row.id+':'+at.toISOString(),title,body,path,at:at.toISOString(),tone});
    const money=(amount:any)=>'₹'+Number(amount).toLocaleString('en-IN',{maximumFractionDigits:2});
    const jobs:Promise<void>[]=[];
    if(can('sales.read'))jobs.push((async()=>{
      const bills=await this.db.salesInvoice.findMany({where:{...scope,status:'POSTED',created_at:{gte:since}},orderBy:{created_at:'desc'},take:20,select:{id:true,document_number:true,grand_total:true,outstanding_amount:true,created_at:true,party:{select:{name:true}}}});
      for(const b of bills)add('sale',b,Number(b.outstanding_amount)>0?'Udhar bill saved':'Sale completed',b.document_number+' · '+b.party.name+' · '+money(b.grand_total)+(Number(b.outstanding_amount)>0?' · Due '+money(b.outstanding_amount):''),'/retail/bills/'+b.id,b.created_at);
    })());
    if(can('purchase.read'))jobs.push((async()=>{
      const purchases=await this.db.purchaseInvoice.findMany({where:{...scope,status:'POSTED',posted_at:{gte:since}},orderBy:{posted_at:'desc'},take:20,select:{id:true,document_number:true,grand_total:true,posted_at:true,party:{select:{name:true}}}});
      for(const p of purchases)add('purchase',p,'Purchase saved',p.party.name+' · '+p.document_number+' · '+money(p.grand_total),'/retail/purchases',p.posted_at!);
    })());
    if(can('accounting.read'))jobs.push((async()=>{
      const [payments,expenses,dues,tasks]=await Promise.all([
        this.db.voucher.findMany({where:{...scope,status:'POSTED',voucher_type:{in:['RECEIPT','PAYMENT']},created_at:{gte:since}},orderBy:{created_at:'desc'},take:20,select:{id:true,document_number:true,voucher_type:true,source_document_type:true,created_at:true}}),
        this.db.expense.findMany({where:{...scope,status:'POSTED',updated_at:{gte:since}},orderBy:{updated_at:'desc'},take:20,select:{id:true,amount:true,type:true,updated_at:true}}),
        this.db.salesInvoice.findMany({where:{...scope,status:'POSTED',outstanding_amount:{gt:0},due_date:{lte:date}},orderBy:[{due_date:'asc'},{id:'asc'}],take:20,select:{id:true,document_number:true,outstanding_amount:true,due_date:true,party:{select:{name:true}}}}),
        this.db.retailCalendarTask.findMany({where:{...scope,completed:false,date},orderBy:{id:'asc'},take:20}),
      ]);
      // Bill receipts are already represented by the sale/purchase alert.
      for(const p of payments.filter(p=>!['POS_RECEIPT','POS_PAYMENT','PURCHASE_PAYMENT','EXPENSE'].includes(p.source_document_type||'')))add('payment',p,p.voucher_type==='RECEIPT'?'Customer payment received':'Payment recorded',p.document_number,'/retail/galla',p.created_at);
      for(const e of expenses)add('expense',e,e.type==='OWNER_WITHDRAWAL'?'Owner withdrawal saved':'Expense saved',money(e.amount),'/retail/expenses',e.updated_at);
      for(const d of dues)add('due-'+today,d,'Customer collection reminder',d.party.name+' · '+d.document_number+' · '+money(d.outstanding_amount),'/retail/bills/'+d.id,date);
      for(const t of tasks)add('task-'+today,t,'Task due today',t.title,'/retail/calendar',date);
    })());
    if(can('inventory.read'))jobs.push((async()=>{
      const needs=await this.db.needList.findMany({where:{company_id:scope.company_id,OR:[{branch_id:scope.branch_id},{branch_id:null}],updated_at:{gte:since}},orderBy:{updated_at:'desc'},take:20,select:{id:true,name:true,status:true,updated_at:true}});
      for(const n of needs)add('need',n,'Need list updated',n.name+' · '+({NEED:'To buy',ORDERED:'Ordered',RECEIVED:'Received',CANCELLED:'Cancelled'} as Record<string,string>)[n.status],'/retail/needs',n.updated_at,n.status==='CANCELLED'?'warning':'success');
    })());
    // Audit notices expose a fixed label, never raw audit details or passwords.
    const actions=[...(can('inventory.read')?['RETAIL_ITEM_CREATED','RETAIL_ITEM_UPDATED','RETAIL_ITEM_REMOVED','RETAIL_ITEM_RESTORED','RETAIL_ITEM_ARCHIVED','RETAIL_ITEM_PERMANENTLY_DELETED','STOCK_ADJUSTMENT_POSTED','STOCK_ADJUSTMENT_REVERSED']:[]),...(can('purchase.read')?['RETAIL_SUPPLIER_CREATED','RETAIL_SUPPLIER_UPDATED','RETAIL_SUPPLIER_REMOVED','RETAIL_SUPPLIER_RESTORED']:[]),...(can('accounting.read')?['RETAIL_CUSTOMER_CREATED','RETAIL_CUSTOMER_UPDATED','RETAIL_CUSTOMER_REMOVED','RETAIL_CUSTOMER_RESTORED','GALLA_CASH_COUNT']:[]),...(can('identity.admin')?['STAFF_CREATE','STAFF_UPDATE','STAFF_DISABLE','STAFF_ENABLE','STAFF_RESET_PASSWORD']:[])];
    const labels:Record<string,string>={RETAIL_NEED_UPDATED:'Need list updated',RETAIL_ITEM_CREATED:'Item added',RETAIL_ITEM_UPDATED:'Item details updated',RETAIL_ITEM_REMOVED:'Item removed',RETAIL_ITEM_RESTORED:'Item restored',RETAIL_ITEM_ARCHIVED:'Item archived',RETAIL_ITEM_PERMANENTLY_DELETED:'Item permanently deleted',STOCK_ADJUSTMENT_POSTED:'Stock updated',STOCK_ADJUSTMENT_REVERSED:'Stock adjustment reversed',RETAIL_SUPPLIER_CREATED:'Supplier added',RETAIL_SUPPLIER_UPDATED:'Supplier details updated',RETAIL_SUPPLIER_REMOVED:'Supplier removed',RETAIL_SUPPLIER_RESTORED:'Supplier restored',RETAIL_CUSTOMER_CREATED:'Customer added',RETAIL_CUSTOMER_UPDATED:'Customer details updated',RETAIL_CUSTOMER_REMOVED:'Customer removed',RETAIL_CUSTOMER_RESTORED:'Customer restored',GALLA_CASH_COUNT:'Counter cash counted',STAFF_CREATE:'Staff member added',STAFF_UPDATE:'Staff details updated',STAFF_DISABLE:'Staff access disabled',STAFF_ENABLE:'Staff access enabled',STAFF_RESET_PASSWORD:'Staff password reset'};
    if(actions.length)jobs.push((async()=>{
      const audit=await this.db.auditLog.findMany({where:{company_id:scope.company_id,OR:[{branch_id:scope.branch_id},{branch_id:null}],created_at:{gte:since},action:{in:actions}},orderBy:{created_at:'desc'},take:20,select:{id:true,action:true,created_at:true}});
      for(const a of audit)add('update',a,'Shop updated',labels[a.action]||'Shop activity updated',a.action.startsWith('STAFF')?'/retail/more/staff':a.action.includes('SUPPLIER')?'/retail/suppliers':a.action.includes('CUSTOMER')?'/retail/khata':a.action.includes('NEED')?'/retail/needs':a.action.includes('STOCK')?'/retail/stock':a.action.includes('ITEM')?'/retail/items':'/retail/galla',a.created_at,/_(?:REMOVED|ARCHIVED|PERMANENTLY_DELETED|DISABLE)$/.test(a.action)?'danger':['STOCK_ADJUSTMENT_REVERSED','STAFF_RESET_PASSWORD'].includes(a.action)?'warning':'success');
    })());
    if(can('reports.read'))jobs.push((async()=>{
      const reports=await this.db.retailReportNotification.findMany({where:{...scope,user_id:user.id,created_at:{gte:since}},orderBy:{created_at:'desc'},take:10,select:{id:true,day:true,created_at:true}});
      for(const r of reports)add('report',r,'Daily report ready',r.day,'/retail/reports#report-inbox',r.created_at);
    })());
    await Promise.all(jobs);
    return {rows:rows.sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id)).slice(0,100),window_days:7,refreshed_at:new Date().toISOString()};
  }
}
