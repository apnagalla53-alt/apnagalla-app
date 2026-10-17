import {useEffect,useState} from 'react';
import api from '../../shared/api';
import {useBillStore,billLinePayload,billOptionsPayload} from '../retailStore';
const money=(value:number)=>'₹'+value.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
export function TaxBreakdown({quote,rates=[]}:{quote:any;rates?:number[]}) {
  if(!quote)return null;
  const discount=Number(quote.discount_amount||0);
  const taxable=quote.taxable_amount!=null?Number(quote.taxable_amount):(quote.lines||[]).reduce((s:number,l:any)=>s+Number(l.taxable_value||0),0);
  const tax=quote.tax_amount!=null?Number(quote.tax_amount):(quote.lines||[]).reduce((s:number,l:any)=>s+Number(l.tax_amount||0),0);
  const unique=[...new Set(rates.filter(Number.isFinite))];
  return <div className="r-billing-summary" style={{scrollMarginBlock:120}} aria-label="Bill tax breakdown"><h2>Bill summary</h2>{discount>0&&<div className="r-billing-row"><span>Items before bill discount</span><span>{money(taxable+discount)}</span></div>}{discount>0&&<div className="r-billing-row"><span>Discount</span><span>− {money(discount)}</span></div>}<div className="r-billing-row"><span>Subtotal before GST</span><span>{money(taxable)}</span></div><div className="r-billing-row"><span>GST{unique.length===1&&unique[0]>0?' ('+unique[0]+'%)':''}</span><span>{money(tax)}</span></div><div className="r-billing-row r-billing-row--total"><span>Total Payable</span><span>{money(Number(quote.grand_total))}</span></div></div>;
}
export default function BillTaxSummary({onQuote}:{onQuote?:(quote:any)=>void}){
  const mode=useBillStore(s=>s.discountMode),charge=useBillStore(s=>s.serviceCharge);
  const items=useBillStore(s=>s.items),discount=useBillStore(s=>s.discount),customer=useBillStore(s=>s.customer),date=useBillStore(s=>s.details.date);
  const [quote,setQuote]=useState<any>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{let active=true;setQuote(null);onQuote?.(null);setFailed(false);if(!items.length)return;const timer=setTimeout(()=>{api.post('/retail/bills/quote',{items:items.map(billLinePayload),...billOptionsPayload(),date,payment_splits:[]}).then(r=>{if(active){setQuote(r.data);onQuote?.(r.data);}}).catch(()=>{if(active)setFailed(true);});},200);return()=>{active=false;clearTimeout(timer);};},[items,discount,mode,charge,customer?.id,date,onQuote]);
  if(!items.length)return null;
  return quote?<TaxBreakdown quote={quote} rates={[...items.map(i=>Number(i.tax_rate||0)),...(charge?[charge.gst_rate]:[])]}/>:<p role="status">{failed?'Totals unavailable. Complete the price check before posting.':'Checking subtotal, GST and payable…'}</p>;
}
