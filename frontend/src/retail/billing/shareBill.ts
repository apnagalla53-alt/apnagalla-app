import { formatDate,formatTime } from '../../shared/dateFormat';
export async function shareBill(bill:any){
  if(bill.status!=='POSTED')throw new Error('Open the cancelled bill in audit history.');
  const text=[bill.company?.trade_name||bill.company?.legal_name||'Apna Galla',`Bill ${bill.document_number}`,`${formatDate(bill.document_date)} · ${formatTime(bill.posted_at||bill.created_at)}`,...(bill.sales_invoice_line||[]).map((l:any)=>`${l.item?.name||'Item'} × ${l.entered_quantity??l.quantity} · ₹${Number(l.line_total).toFixed(2)}`),`Total ₹${Number(bill.grand_total).toFixed(2)}`,`Paid ₹${Number(bill.paid_amount).toFixed(2)} · Due ₹${Number(bill.outstanding_amount).toFixed(2)}`].join('\n');
  if(navigator.share){await navigator.share({title:'Bill '+bill.document_number,text});return 'Shared';}await navigator.clipboard.writeText(text);return 'Bill copied. You can paste it into WhatsApp.';
}
