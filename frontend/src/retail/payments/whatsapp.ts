import { billLineQuantity } from '../billing/BillLineDescription';

/** Only phone numbers form the destination; no user-controlled URLs/schemes. */
export function whatsappNumber(value:string):string {
  const raw=value.trim();
  if(!/^(?:\+|00)?[\d ()-]+$/.test(raw))throw new Error('Enter a valid mobile number, or an international number with country code.');
  let digits=raw.replace(/[ ()-]/g,'');
  if(/^0[6-9]\d{9}$/.test(digits))digits=digits.slice(1);
  if(/^[6-9]\d{9}$/.test(digits))return '91'+digits;
  const international=/^(?:\+|00)/.test(digits);
  digits=digits.replace(/^(?:\+|00)/,'');
  if(/^91[6-9]\d{9}$/.test(digits))return digits;
  if(international&&/^[1-9]\d{7,14}$/.test(digits)&&!digits.startsWith('91'))return digits;
  throw new Error('Use a 10-digit Indian mobile number, or +country code and number.');
}
export function whatsappLink(phone:string,text='') {
  const number=whatsappNumber(phone);
  if(text.length>6000)throw new Error('Message is too long. Use a receipt summary or attach the PDF in WhatsApp.');
  const url='https://wa.me/'+number+(text?'?text='+encodeURIComponent(text):'');
  if(url.length>28000)throw new Error('Message is too long. Use a receipt summary or attach the PDF in WhatsApp.');
  return url;
}
const money=(value:unknown)=>{
  const n=Number(value);if(!Number.isFinite(n))throw new Error('Receipt amount is unavailable. Reload the bill.');
  return '₹'+n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
};
const clean=(value:unknown)=>String(value??'').replace(/[\r\n\x00-\x1f]/g,' ').trim();
export function receiptMessage(bill:any,shop:string) {
  const header=[`Receipt · ${clean(shop)}`,`Bill: ${clean(bill.document_number)}`,`Date: ${String(bill.document_date).slice(0,10)}`,`Customer: ${clean(bill.party?.is_walkin?'Walk-in Customer':bill.party?.name||'Walk-in Customer')}`,`Status: ${clean(bill.status)}`];
  const totals=[`Bill total: ${money(bill.grand_total)}`,`Paid: ${money(bill.paid_amount)}`,`Outstanding: ${money(bill.outstanding_amount)}`];
  if(Number(bill.discount_amount)>0)totals.push('Bill discount: '+money(bill.discount_amount));
  if(Number(bill.tax_amount)>0)totals.push('Tax: '+money(bill.tax_amount));
  if(bill.due_date&&Number(bill.outstanding_amount)>0)totals.push('Payment due: '+String(bill.due_date).slice(0,10));
  if(bill.payments?.length)totals.push('Payment at billing: '+bill.payments.map((p:any)=>`${clean(p.method)} ${money(p.amount)}`).join(' + '));
  const lines=(bill.sales_invoice_line||[]).map((line:any)=>{
    const attributes=line.variant?` · ${Object.values(line.variant.attributes||{}).map(clean).join(' / ')}`:'';
    const serials=line.serial_allocations?.length?' · Serial '+line.serial_allocations.map((a:any)=>clean(a.serial?.serial_number)+(a.returned_at?' (returned)':'')).join(', '):'';
    const measured=line.dimensions?' · Measures '+Object.values(line.dimensions).map(clean).join(' × ')+' · Priced quantity '+clean(line.base_quantity??line.quantity)+' '+clean(line.unit?.code):'';
    const warranty=line.warranty_snapshot?.days?' · Warranty '+clean(line.warranty_snapshot.days)+' days, '+clean(line.warranty_snapshot.start)+' to '+clean(line.warranty_snapshot.end):'';
    const rateUnit=line.dimensions?line.unit?.code:line.entered_unit?.code||line.unit?.code;
    return `${clean(line.item?.name||line.description||'Item')}${attributes}: ${billLineQuantity(line)}${measured} · Rate ${money(line.rate)} / ${clean(rateUnit||'unit')} · Line total ${money(line.line_total)}${serials}${warranty}`;
  });
  if((bill.sales_invoice_line||[]).some((l:any)=>Number(l.sold_entered_quantity)>Number(l.remaining_quantity)))totals.push('Original billed amounts shown. Returned items/refunds are recorded separately.');
  const end=['Thank you for visiting our shop.'];
  let text=[...header,'',...lines,'',...totals,'',...end].join('\n');
  if(text.length>6000||encodeURIComponent(text).length>24000)text=[...header,'',`${lines.length} item lines. Ask the shop for the detailed PDF invoice.`,'',...totals,'',...end].join('\n');
  if(text.length>6000)throw new Error('This receipt needs a PDF. Open Print invoice and save as PDF.');
  return text;
}
