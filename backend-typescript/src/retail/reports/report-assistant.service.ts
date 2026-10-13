import { BadRequestException, ForbiddenException, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CounterService } from '../counter/counter.service';
import { businessDate } from '../../common/business-date';
import { EntitlementService } from '../../common/entitlement.service';
import { throttleOperation } from '../../common/operation-throttle';
import { OperationalReportsService } from './operational-reports.service';
import { FinancialReportsService } from './financial-reports.service';
import { dateRange } from '../../assistant/nlp';

export function reportIntent(query:string) {
  const q=query.normalize('NFKC').toLowerCase();
  if(/profit|margin|munafa|मुनाफ|लाभ|मार्जिन/.test(q))return 'PROFIT';
  if(/udhaar|udhar|उधार|उधार|credit/.test(q))return 'UDHAR';
  if(/maal|माल|stock received|new stock|purchase|खरीद/.test(q))return 'RECEIVED';
  if(/bikri|बिक्री|sales|sale|बिकर/.test(q))return 'SALES';
  if(/expense|kharch|खर्च/.test(q))return 'EXPENSES';
  if(/galla|summary|report|रिपोर्ट|गल्ला|cash|upi|कैश|नकद|सारांश/.test(q))return 'SUMMARY';
  throw new BadRequestException('Ask about sales, udhar, new stock, expenses or daily galla. Unsupported questions are not guessed.');
}
@Injectable()
export class ReportAssistantService implements OnModuleInit,OnModuleDestroy {
  private timer?:NodeJS.Timeout;
  private running=false;
  private logger=new Logger(ReportAssistantService.name);
  constructor(private db:PrismaService,private counter:CounterService,private entitlements:EntitlementService,private operations:OperationalReportsService,private financial:FinancialReportsService){}
  onModuleInit(){if(process.env.NODE_ENV!=='test'||process.env.REPORT_SCHEDULER_ENABLED==='true'){this.timer=setInterval(()=>void this.dispatch().catch(()=>this.logger.error('Daily report generation failed; retrying on next tick')),60000);this.timer.unref();}}
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
  scope(user:any){return {company_id:user.company_id,branch_id:user.branch_id,user_id:user.id};}
  async answer(user:any,query:string,date?:string,language='hi') {
    await throttleOperation('report-query:'+user.id,60);
    const intent=reportIntent(query);
    if(intent==='PROFIT'){
      if(/bill|item|category|kaunsa|कौन|मैगी|maggi|में| mein | me /i.test(query))throw new BadRequestException('Open Ask EVOLIX for item, bill and category profit. This quick report question supports whole-business profit only.');
      await this.entitlements.require(user.organization_id,['PROFIT_REPORTING'],user.company_id);
      const effective=await this.entitlements.resolve(user.organization_id,this.db,user.company_id);
      if(!effective.features.some(f=>f.code==='REPORTS'&&f.enabled))throw new ForbiddenException('Reports are disabled for this shop');
      const dates=date?{from:date,to:date}:dateRange(query,'Asia/Kolkata');
      const totals=await this.financial.summary(user.company_id,{...dates,branch_id:user.branch_id});
      const text=`${dates.from} — ${dates.to}: Gross profit ₹${totals.gross_profit}, net business profit ₹${totals.net_business_profit}, cost coverage ${totals.cost_coverage}%. ${totals.warning||''}`;
      return {intent,date:dates.to,language,text,totals,rows:[],definition:totals.definition,engine:'Authoritative saved cost queries; no external AI provider'};
    }
    const today=businessDate();
    const selected=date||(/yesterday|kal|कल/.test(query.toLowerCase())?new Date(new Date(today).getTime()-86400000).toISOString().slice(0,10):today);
    const start=new Date(selected+'T00:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(selected)||!Number.isFinite(+start)||start.toISOString().slice(0,10)!==selected)throw new BadRequestException('Choose a valid report date');
    const end=new Date(+start+86400000),scope={company_id:user.company_id,branch_id:user.branch_id};
    let rows:any[]=[],totals:any={},text='';
    if(intent==='RECEIVED') {
      const received=await this.operations.received(user.company_id,user.branch_id,{from:selected,to:selected},0,50);
      totals=received.summary;rows=received.rows;
      text=language==='hi'?`${selected}: ${totals.stock_movements} माल प्राप्ति रिकॉर्ड। खरीद राशि के लिए खरीद रिपोर्ट देखें।`:`${selected}: ${totals.stock_movements} stock receipts. See the Purchase Report for purchase amounts.`;
    }else if(intent==='UDHAR') {
      const invoices=await this.db.salesInvoice.findMany({where:{...scope,status:'POSTED',document_date:{gte:start,lt:end}},select:{id:true,document_number:true,party_id:true,grand_total:true,payment_snapshot:true,party:{select:{name:true}}},take:10001});
      if(invoices.length>10000)throw new BadRequestException('This day exceeds the assistant limit. Use the detailed sales report/export.');
      const dues=invoices.map(i=>({...i,credit:Math.max(0,Number(i.grand_total)-(Array.isArray(i.payment_snapshot)?i.payment_snapshot:[]).reduce<number>((sum,p:any)=>sum+Number(p.amount||0),0))})).filter(i=>i.credit>0);
      totals={customers:new Set(dues.map(i=>i.party_id)).size,bills:dues.length,udhar_given:Math.round(dues.reduce((s,i)=>s+i.credit,0)*100)/100};
      rows=dues.slice(0,50).map(i=>({bill:i.document_number,customer:i.party.name,udhar_given:i.credit}));
      text=language==='hi'?`${selected}: ${totals.customers} ग्राहकों को ${totals.bills} बिलों में ₹${totals.udhar_given.toFixed(2)} उधार दिया।`:`${selected}: ${totals.customers} customers received ₹${totals.udhar_given.toFixed(2)} credit across ${totals.bills} bills.`;
    }else {
      // Refuse oversized days rather than returning a partial financial total.
      const counts=await Promise.all([this.db.voucher.count({where:{...scope,status:'POSTED',voucher_date:{gte:start,lt:end}}}),this.db.salesInvoice.count({where:{...scope,status:'POSTED',document_date:{gte:start,lt:end}}}),this.db.expense.count({where:{...scope,status:'POSTED',date:{gte:start,lt:end}}})]);
      if(counts.some(n=>n>10000))throw new BadRequestException('Use the detailed report/export for this large business day');
      totals=await this.counter.galla(user.company_id,user.branch_id,selected);
      text=language==='hi'?`${selected}: बिक्री ₹${totals.total_sales.toFixed(2)}, ${totals.bill_count} बिल। नकद आया ₹${totals.cash_received.toFixed(2)}, UPI बिक्री ₹${totals.upi_sales.toFixed(2)}, खर्च ₹${totals.business_expenses.toFixed(2)}, अपेक्षित गल्ला ₹${totals.expected_cash.toFixed(2)}।`:`${selected}: sales ₹${totals.total_sales.toFixed(2)}, ${totals.bill_count} bills. Cash received ₹${totals.cash_received.toFixed(2)}, UPI sales ₹${totals.upi_sales.toFixed(2)}, expenses ₹${totals.business_expenses.toFixed(2)}, expected drawer ₹${totals.expected_cash.toFixed(2)}.`;
    }
    return {intent,date:selected,language,text,totals,rows,detail_limit:50,generated_at:new Date().toISOString(),definition:intent==='UDHAR'?'Original invoice credit at billing, regardless of later collection':intent==='RECEIVED'?'Posted PURCHASE_IN movements; excludes imported opening stock':'Posted payments and accounting entries. UPI is separate from physical cash.',engine:'Verified report queries; no external AI provider'};
  }
  preference(user:any){return this.db.retailReportPreference.findUnique({where:{company_id_branch_id_user_id:this.scope(user)}});}
  savePreference(user:any,data:{enabled:boolean,time:string,language:string}) {
    if(!['OWNER','ADMIN','TENANT_ADMIN'].includes(user.role))throw new ForbiddenException('Scheduled summaries are configured by the shop owner');
    return this.db.retailReportPreference.upsert({where:{company_id_branch_id_user_id:this.scope(user)},create:{...this.scope(user),...data},update:data});
  }
  async inbox(user:any) {
    const scope=this.scope(user);
    const [rows,unread]=await Promise.all([this.db.retailReportNotification.findMany({where:scope,orderBy:{created_at:'desc'},take:30}),this.db.retailReportNotification.count({where:{...scope,read_at:null}})]);
    return {rows,unread};
  }
  read(user:any,id:string){return this.db.retailReportNotification.updateMany({where:{...this.scope(user),id},data:{read_at:new Date()}});}
  async dispatch(now=new Date()) {
    if(this.running)return;this.running=true;
    try {
      const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false}).format(now),day=businessDate(now);
      let cursor:string|undefined;
      while(true){
        const prefs=await this.db.retailReportPreference.findMany({where:{enabled:true,time:{lte:clock}},orderBy:{id:'asc'},take:100,...(cursor?{cursor:{id:cursor},skip:1}:{}),include:{user:{include:{roles:{include:{role:true}}}},company:true}});
        for(const p of prefs) {
          try {
          if(!p.user.is_active||p.user.is_locked||p.user.organization_id!==p.company.organization_id||!p.user.roles.some(r=>['OWNER','ADMIN','TENANT_ADMIN'].includes(r.role.name)&&(!r.company_id||r.company_id===p.company_id)&&(!r.branch_id||r.branch_id===p.branch_id)))continue;
          const effective=await this.entitlements.resolve(p.company.organization_id);
          if(['SUSPENDED','CANCELLED'].includes(effective.status)||!effective.subscription||!['ACTIVE','TRIAL','COMPLIMENTARY'].includes(effective.subscription.status)||effective.subscription.expires_at<now||!['RETAIL_POS','REPORTS'].every(code=>effective.features.some(f=>f.code===code&&f.enabled)))continue;
          const scope={company_id:p.company_id,branch_id:p.branch_id,user_id:p.user_id,day};
          if(await this.db.retailReportNotification.findUnique({where:{company_id_branch_id_user_id_day:scope}}))continue;
          const summary=await this.answer({id:p.user_id,company_id:p.company_id,branch_id:p.branch_id},'daily summary',day,p.language);
          await this.db.retailReportNotification.upsert({where:{company_id_branch_id_user_id_day:scope},create:{...scope,summary},update:{}});
          }catch{this.logger.error('A daily report could not be generated; other shops continue, retry next tick');}
        }
        if(prefs.length<100)break;cursor=prefs[prefs.length-1].id;
      }
    }finally{this.running=false;}
  }
}
