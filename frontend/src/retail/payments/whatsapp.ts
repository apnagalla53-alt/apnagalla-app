import { formatDate } from '../../shared/dateFormat';

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
 const name=bill.party?.is_walkin?'':clean(bill.party?.name||bill.walkin_name);
 const text=[name?'Namaste '+name+' ji,':'Namaste,',clean(shop)+' · Bill '+clean(bill.document_number),formatDate(bill.document_date),'Total '+money(bill.grand_total)+' · Paid '+money(bill.paid_amount),Number(bill.outstanding_amount)>0?'Is bill ka baaki: '+money(bill.outstanding_amount):'Payment complete.'];
 if(bill.due_date&&Number(bill.outstanding_amount)>0)text.push('Due date: '+formatDate(bill.due_date));
 if(bill.returns?.length)text.push('Returns/refunds are recorded separately.');
 text.push('Dhanyavaad!');return text.join('\n');
}
