import {Prisma} from '@prisma/client';
import {PostingService} from '../accounting/posting.service';

export async function costLedger(tx:Prisma.TransactionClient,company:string,code:string,name:string,type:string){
  const existing=await tx.ledgerAccount.findFirst({where:{company_id:company,code}});
  // Older installations may use numeric 1200 for a party. Never journal inventory into that account.
  if(code==='1200'&&existing&&(existing.party_id||existing.normal_balance==='CREDIT'))return costLedger(tx,company,'INVENTORY_ASSET',name,type);
  return existing||
    await tx.ledgerAccount.create({data:{company_id:company,code,name,account_type:type,normal_balance:['LIABILITY','REVENUE','PAYABLE'].includes(type)?'CREDIT':'DEBIT',is_system:true}});
}

/** Journal the value actually removed by canonical inventory posting, including known portions of mixed pools. */
export async function journalInventoryLoss(tx:Prisma.TransactionClient,accounting:PostingService,document:any,user:string,source:string){
  const movements=await tx.stockMovement.findMany({where:{company_id:document.company_id,source_document_type:source,source_document_id:document.id}});
  const losses=new Map<string,Prisma.Decimal>();
  for(const movement of movements){
    if(movement.value_delta.gte(0))continue;
    const line=document.lines.find((l:any)=>l.id===movement.source_line_id);
    const code=/personal|owner|drawings/i.test(line?.reason||'')?'OWNER_STOCK_DRAWINGS':'INVENTORY_LOSS';
    losses.set(code,(losses.get(code)||new Prisma.Decimal(0)).plus(movement.value_delta.abs()));
  }
  const amount=[...losses.values()].reduce((s,v)=>s.plus(v),new Prisma.Decimal(0));
  if(amount.eq(0))return;
  const asset=await costLedger(tx,document.company_id,'1200','Inventory Asset','ASSET');
  const lines:any[]=[{ledger_account_id:asset.id,debit:0,credit:amount}];
  for(const [code,value] of losses){const other=await costLedger(tx,document.company_id,code,code==='INVENTORY_LOSS'?'Inventory wastage and write-off':'Owner stock drawings',code==='INVENTORY_LOSS'?'EXPENSE':'EQUITY');
    lines.push({ledger_account_id:other.id,debit:value,credit:0});}
  await accounting.postVoucher(tx,{company_id:document.company_id,branch_id:document.branch_id,financial_year_id:document.financial_year_id,
    voucher_date:document.document_date||document.count_date,voucher_type:'JOURNAL',document_number:'COST-'+document.document_number,
    source_document_type:source+'_COST',source_document_id:document.id,posted_by:user,lines});
}
