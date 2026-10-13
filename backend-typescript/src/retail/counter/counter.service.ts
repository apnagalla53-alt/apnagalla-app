import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpiProfileDto, CashCountDto } from './counter.dto';
function day(value:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Choose a valid date');
  const start=new Date(value+'T00:00:00.000Z');
  if(!Number.isFinite(start.getTime())||start.toISOString().slice(0,10)!==value) throw new BadRequestException('Choose a valid date');
  return {start,end:new Date(start.getTime()+86400000)};
}
const money=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
@Injectable()
export class CounterService {
  constructor(private db:PrismaService) {}
  /** Original checkout payments, independent of later Khata collections. Shared by Galla and Assistant. */
  async salesPayments(companyId:string,branchId:string|undefined,from:string,to:string,filters:{party_id?:string;posted_by?:string}={}) {
    const start=day(from).start,end=day(to).end;
    const where={company_id:companyId,branch_id:branchId,status:'POSTED',document_date:{gte:start,lt:end},...filters};
    const payments:Record<string,number>={CASH:0,UPI:0,CARD:0,BANK:0};
    let sales=0,credit=0,bills=0,creditBills=0,cursor:string|undefined;const creditCustomers=new Set<string>();
    while(true){
      const invoices=await this.db.salesInvoice.findMany({where,select:{id:true,party_id:true,grand_total:true,payment_snapshot:true},orderBy:{id:'asc'},take:200,...(cursor?{cursor:{id:cursor},skip:1}:{})});
      for(const invoice of invoices){
        if(!Array.isArray(invoice.payment_snapshot))throw new BadRequestException('Original checkout payment allocation is unavailable for an older bill in this period. Review Bill History; EVOLIX will not guess Cash, UPI or original Udhar.');
        bills++;sales+=Number(invoice.grand_total);let paid=0;
        for(const p of Array.isArray(invoice.payment_snapshot)?invoice.payment_snapshot:[]){const entry=p as any;if(entry.method in payments)payments[entry.method]+=Number(entry.amount||0);paid+=Number(entry.amount||0);}
        const due=Math.max(0,Number(invoice.grand_total)-paid);credit+=due;if(due>0){creditBills++;creditCustomers.add(invoice.party_id);}
      }
      if(invoices.length<200)break;cursor=invoices[invoices.length-1].id;
      if(bills>10000)throw new BadRequestException('Choose a smaller period; checkout summaries support up to 10,000 bills.');
    }
    return {total_sales:money(sales),bill_count:bills,cash_sales:money(payments.CASH),upi_sales:money(payments.UPI),card_sales:money(payments.CARD),bank_sales:money(payments.BANK),udhar_sales:money(credit),udhar_bill_count:creditBills,udhar_customers_count:creditCustomers.size};
  }
  async upiReceived(companyId:string,branchId:string|undefined,from:string,to:string){
    const [checkout,collections]=await Promise.all([this.salesPayments(companyId,branchId,from,to),this.db.voucherLine.aggregate({where:{ledger_account:{code:'DEFAULT_BANK'},debit:{gt:0},voucher:{company_id:companyId,branch_id:branchId,status:'POSTED',voucher_type:'RECEIPT',payment_method:'UPI',voucher_date:{gte:day(from).start,lt:day(to).end},OR:[{source_document_type:null},{source_document_type:{not:'POS_RECEIPT'}}]}},_sum:{debit:true}})]);
    return money(checkout.upi_sales+Number(collections._sum.debit||0));
  }
  async upi(companyId:string) {
    const config=await this.db.companyConfiguration.findUnique({where:{company_id:companyId}});
    const profile:any=config?.payment_configuration;
    return profile?.upi_id ? {...profile,configured:true,bank_verified:false,automatic_confirmation:false} : {configured:false,bank_verified:false,automatic_confirmation:false};
  }
  async saveUpi(companyId:string,branchId:string,userId:string,dto:UpiProfileDto) {
    return this.db.$transaction(async tx=>{
      await tx.companyConfiguration.upsert({where:{company_id:companyId},create:{company_id:companyId,payment_configuration:{...dto}},update:{payment_configuration:{...dto}}});
      await tx.auditLog.create({data:{company_id:companyId,branch_id:branchId,user_id:userId,action:'UPI_PROFILE_UPDATED',details:'Primary receiving profile and invoice preference updated'}});
      return {...dto,configured:true,bank_verified:false,automatic_confirmation:false};
    });
  }
  async qr(companyId:string,amount?:number) {
    const profile:any=await this.upi(companyId);
    if(!profile.configured) throw new NotFoundException('Set up the shop receiving UPI profile first');
    if(amount!==undefined && (!Number.isFinite(amount)||amount<=0||amount>999999999)) throw new BadRequestException('Enter a positive payment amount');
    const params=new URLSearchParams({pa:profile.upi_id,pn:profile.payee_name,cu:'INR'});
    if(amount!==undefined)params.set('am',amount.toFixed(2));
    return {uri:'upi://pay?'+params.toString(),upi_id:profile.upi_id,payee_name:profile.payee_name,amount:amount??null,bank_verified:false,automatic_confirmation:false};
  }
  async galla(companyId:string,branchId:string,date:string) {
    const {start,end}=day(date),scope={company_id:companyId,branch_id:branchId};
    const config=await this.db.companyConfiguration.findUnique({where:{company_id:companyId},select:{default_cash_ledger_id:true}});
    const cashScope={company_id:companyId,OR:[{code:{in:['CASH_IN_HAND','CASH']}},...(config?.default_cash_ledger_id?[{id:config.default_cash_ledger_id}]:[])]};
    const [paymentTotals,expenses,count,opening]=await Promise.all([
      this.salesPayments(companyId,branchId,date,date),
      this.db.expense.groupBy({by:['type','payment_method'],where:{...scope,status:'POSTED',date:{gte:start,lt:end}},_sum:{amount:true}}),
      this.db.dailyCashCount.findUnique({where:{company_id_branch_id_date:{...scope,date:start}}}),
      this.db.voucherLine.aggregate({where:{voucher:{...scope,status:'POSTED',voucher_date:{lt:start}},ledger_account:cashScope},_sum:{debit:true,credit:true}}),
    ]);
    let cashIn=0,cashOut=0,cashSales=0,oldDueCash=0,supplierCash=0,refundCash=0,oldDues=0,supplierPayments=0,refunds=0;
    for await(const v of this.counterVouchers(scope,start,end)) {
      const lines=v.lines;
      const isCash=(l:typeof lines[number])=>l.ledger_account_id===config?.default_cash_ledger_id||['CASH_IN_HAND','CASH'].includes(l.ledger_account.code);
      const incoming=lines.filter(isCash).reduce((s,l)=>s+Number(l.debit),0);
      const outgoing=lines.filter(isCash).reduce((s,l)=>s+Number(l.credit),0);
      cashIn+=incoming;cashOut+=outgoing;
      if(v.source_document_type==='POS_RECEIPT')cashSales+=incoming;
      if(v.voucher_type==='RECEIPT'&&v.source_document_type!=='POS_RECEIPT'&&lines.some(l=>l.party?.party_type==='CUSTOMER')) {
        oldDueCash+=incoming;oldDues+=lines.filter(l=>l.party?.party_type==='CUSTOMER').reduce((s,l)=>s+Number(l.credit),0);
      }
      if(v.voucher_type==='PAYMENT'&&lines.some(l=>l.party?.party_type==='SUPPLIER')) {
        supplierCash+=outgoing;supplierPayments+=lines.filter(l=>l.party?.party_type==='SUPPLIER').reduce((s,l)=>s+Number(l.debit),0);
      }
      if(v.source_document_type==='POS_REFUND') {refundCash+=outgoing;refunds+=lines.filter(l=>l.party).reduce((s,l)=>s+Number(l.debit),0);}
    }
    const sum=(type:string,cash=false)=>expenses.filter(e=>e.type===type&&(!cash||e.payment_method==='CASH')).reduce((s,e)=>s+Number(e._sum.amount||0),0);
    const ledgerOpening=Number(opening._sum.debit||0)-Number(opening._sum.credit||0);
    const openingCash=count?.opening_cash==null?ledgerOpening:Number(count.opening_cash),expected=money(openingCash+cashIn-cashOut);
    const actual=count?.actual_cash==null?null:Number(count.actual_cash),difference=actual===null?null:money(actual-expected);
    return {date,...paymentTotals,cash_sales:money(cashSales),
      old_customer_dues_received:money(oldDues),old_dues_cash:money(oldDueCash),supplier_payments:money(supplierPayments),supplier_cash:money(supplierCash),
      business_expenses:money(sum('BUSINESS_EXPENSE')),cash_expenses:money(sum('BUSINESS_EXPENSE',true)),owner_withdrawals:money(sum('OWNER_WITHDRAWAL')),cash_owner_withdrawals:money(sum('OWNER_WITHDRAWAL',true)),refunds:money(refunds),cash_refunds:money(refundCash),
      cash_received:money(cashIn),cash_paid_out:money(cashOut),other_cash_in:money(cashIn-cashSales-oldDueCash),other_cash_out:money(cashOut-supplierCash-refundCash-sum('BUSINESS_EXPENSE',true)-sum('OWNER_WITHDRAWAL',true)),
      ledger_opening_cash:money(ledgerOpening),opening_cash:money(openingCash),opening_override:count?.opening_cash!=null,expected_cash:expected,actual_cash:actual,difference,
      status:difference===null?'NOT_COUNTED':difference===0?'MATCHED':difference<0?'SHORT':'EXCESS',note:count?.note||'',accounting_modified_by_count:false};
  }
  private async *counterVouchers(scope:{company_id:string;branch_id:string},start:Date,end:Date){
    let cursor:string|undefined,count=0;
    while(true){const page=await this.db.voucher.findMany({where:{...scope,status:'POSTED',voucher_date:{gte:start,lt:end}},include:{lines:{include:{ledger_account:{select:{code:true}},party:{select:{party_type:true}}}}},orderBy:{id:'asc'},take:200,...(cursor?{cursor:{id:cursor},skip:1}:{})});
      count+=page.length;if(count>10000)throw new BadRequestException('Counter summary exceeds 10,000 vouchers for this day.');
      for(const row of page)yield row;if(page.length<200)break;cursor=page[page.length-1].id;
    }
  }
  async count(companyId:string,branchId:string,userId:string,dto:CashCountDto) {
    const {start}=day(dto.date);
    await this.db.$transaction(async tx=>{
      await tx.dailyCashCount.upsert({where:{company_id_branch_id_date:{company_id:companyId,branch_id:branchId,date:start}},
        create:{company_id:companyId,branch_id:branchId,date:start,opening_cash:dto.opening_cash,actual_cash:dto.actual_cash,note:dto.note,updated_by:userId},
        update:{opening_cash:dto.opening_cash??null,actual_cash:dto.actual_cash??null,note:dto.note,updated_by:userId}});
      await tx.auditLog.create({data:{company_id:companyId,branch_id:branchId,user_id:userId,action:'GALLA_CASH_COUNT',details:JSON.stringify(dto)}});
    });
    return this.galla(companyId,branchId,dto.date);
  }
  async history(companyId:string,branchId:string,before:string) {
    const {start}=day(before);
    const dates=Array.from({length:7},(_,i)=>new Date(start.getTime()-i*86400000).toISOString().slice(0,10));
    // A bounded week; full summary selected by business date, not cached financial totals.
    const summaries=[];
    for(const date of dates)summaries.push(await this.galla(companyId,branchId,date));
    return summaries;
  }
}
