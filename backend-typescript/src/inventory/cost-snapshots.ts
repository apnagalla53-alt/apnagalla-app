import { Prisma } from '@prisma/client';
import { PostingService } from '../accounting/posting.service';
import {costLedger} from './value-journal';

/** Finalize saved line facts and the existing accounting core within the document's transaction. */
export async function snapshotDocumentCosts(tx: Prisma.TransactionClient, accounting: PostingService,
  document: any, type: 'SALE' | 'RETURN', userId: string) {
  const source = type === 'SALE' ? 'SALES_INVOICE' : 'SALES_RETURN';
  const movements = await tx.stockMovement.findMany({ where: { company_id: document.company_id,
    source_document_type: source, source_document_id: document.id } });
  const valuePortions:any[]=[];
  let deferredValue=new Prisma.Decimal(0);
  for (const line of document.lines) {
    const item = await tx.item.findFirst({ where: { id: line.item_id, company_id: document.company_id } });
    let portions = movements.filter(m => (m.cost_line_id || m.source_line_id) === line.id);
    if(type==='SALE'&&line.delivery_challan_line_id){
      const dispatch=await tx.deliveryChallanLine.findFirst({where:{id:line.delivery_challan_line_id,delivery_challan:{company_id:document.company_id}}});
      if(dispatch){
        const originals=await tx.stockMovement.findMany({where:{company_id:document.company_id,source_document_type:'DELIVERY_CHALLAN',source_line_id:dispatch.id,item_id:line.item_id}});
        const basis=originals.reduce((s,m)=>s.plus(m.base_quantity_delta.abs()),new Prisma.Decimal(0));
        if(basis.gt(0)){const ratio=new Prisma.Decimal(line.base_quantity||line.quantity).div(basis);
          portions=originals.map(m=>({...m,base_quantity_delta:m.base_quantity_delta.mul(ratio),value_delta:m.value_delta.mul(ratio),unknown_quantity_delta:m.unknown_quantity_delta?.mul(ratio)||null}));
          deferredValue=deferredValue.plus(portions.reduce((s,m)=>s.plus(m.value_delta.abs()),new Prisma.Decimal(0)));}
      }
    }
    valuePortions.push(...portions);
    let status = 'UNKNOWN', cogs: Prisma.Decimal | null = null;
    if (item?.item_type === 'SERVICE') status = 'SERVICE';
    else if (portions.length && portions.every(m => m.cost_status === 'KNOWN')) {
      status = 'KNOWN'; cogs = portions.reduce((s,m) => s.plus(m.value_delta.abs()), new Prisma.Decimal(0));
    }
    if(type==='RETURN'&&item?.item_type!=='SERVICE'){
      const original=line.original_line_id?await tx.salesInvoiceLine.findFirst({where:{id:line.original_line_id,sales_invoice:{company_id:document.company_id,id:document.original_invoice_id}}}):null;
      if((original?.cost_status||line.cost_status)!=='KNOWN'){status='UNKNOWN';cogs=null;}
    }
    // Price-only modifier options have no authoritative direct-cost model yet.
    if (line.modifier_snapshot?.groups?.some((g:any) => g.options?.length) ||
      line.bundle_snapshot?.components?.some((c:any) => c.item_type === 'SERVICE')) { status = 'UNKNOWN'; cogs = null; }
    const revenue = new Prisma.Decimal(line.taxable_value);
    const quantity = !item?.is_bundle&&portions.length
      ? portions.reduce((sum,m)=>sum.plus(m.base_quantity_delta.abs()),new Prisma.Decimal(0))
      : new Prisma.Decimal(line.base_quantity || line.quantity);
    const data = { cost_status: status, cogs_total: cogs, net_revenue: revenue,
      cost_per_base_unit: cogs != null && quantity.gt(0) ? cogs.div(quantity).toDecimalPlaces(12) : null,
      gross_profit: cogs == null ? null : revenue.minus(cogs),
      cost_snapshot: { policy: 'MOVING_WEIGHTED_AVERAGE_V1', components: portions.map(m => ({ movement_id: m.id,
        item_id: m.item_id, variant_id: m.variant_id, batch_id: m.batch_id, serial_id: m.serial_id,
        quantity: m.base_quantity_delta.abs().toString(), cost_status: m.cost_status,
        known_value: m.value_delta.abs().toString(), unknown_quantity: m.unknown_quantity_delta?.abs().toString() || null })) } };
    if (type === 'SALE') await tx.salesInvoiceLine.update({ where: { id: line.id }, data });
    else await tx.salesReturnLine.update({ where: { id: line.id }, data });
    Object.assign(line, data);
  }
  const knownValue = valuePortions.reduce((s,m) => s.plus(m.value_delta.abs()), new Prisma.Decimal(0));
  if (knownValue.eq(0)) return;
  const ledger = async (code:string,name:string,account_type:string) =>
    await tx.ledgerAccount.findFirst({ where: { company_id: document.company_id, code } }) ||
    await tx.ledgerAccount.create({ data: { company_id: document.company_id, code, name, account_type,
      normal_balance: 'DEBIT', is_system: true } });
  const asset = await costLedger(tx,document.company_id,'1200','Inventory Asset','ASSET'), expense = await ledger('COGS','Cost of Goods Sold','EXPENSE');
  const deferred=deferredValue.gt(0)?await ledger('UNBILLED_COGS','Dispatched inventory awaiting invoice','ASSET'):null;
  await accounting.postVoucher(tx, { company_id: document.company_id, branch_id: document.branch_id,
    financial_year_id: document.financial_year_id, voucher_date: document.document_date, voucher_type:'JOURNAL',
    source_document_type: 'INVENTORY_COST_'+source, source_document_id: document.id,
    document_number: 'COGS-'+document.document_number, posted_by: userId,
    narration: 'Immutable inventory cost '+document.document_number,
    lines: [{ ledger_account_id: expense.id, debit: type === 'SALE' ? knownValue : 0, credit: type === 'RETURN' ? knownValue : 0 },
      { ledger_account_id: asset.id, credit: type === 'SALE' ? knownValue.minus(deferredValue) : 0, debit: type === 'RETURN' ? knownValue : 0 },
      ...(deferred?[{ledger_account_id:deferred.id,credit:deferredValue,debit:0}]:[])] });
}
