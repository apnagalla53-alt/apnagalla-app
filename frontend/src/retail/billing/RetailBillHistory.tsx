import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { posApi } from '../retailApi';
import { getApiErrorMessage } from '../../shared/api';
import { ArrowLeft, Pause, Receipt, ChevronRight } from 'lucide-react';
import { SearchField, EmptyState } from '../components/MobileControls';
import ReportPeriodFilter from '../reports/components/ReportPeriodFilter';
export default function RetailBillHistory() {
  useUiLanguage();
  const navigate=useNavigate();const [bills,setBills]=useState<any[]>([]);const [total,setTotal]=useState(0);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const confirmation=useLocation().state?.returnConfirmation;
  const [search,setSearch]=useState('');const [from,setFrom]=useState('');const [to,setTo]=useState('');
  const load=async(append=false)=>{setLoading(true);setError('');try{const r=await posApi.getBills({from:from||undefined,to:to||undefined,search:search||undefined,offset:append?bills.length:0,limit:50});setBills(append?[...bills,...r.data.data]:r.data.data);setTotal(r.data.total);}catch(err){setError(getApiErrorMessage(err));}finally{setLoading(false);}};
  useEffect(()=>{const timer=setTimeout(()=>load(),250);return()=>clearTimeout(timer);},[from,to,search]);
  return <><StitchHeader className="r-page-header" hasBack><button className="r-btn r-btn--icon" aria-label={ui('Back')} onClick={()=>navigate('/retail/home')}><ArrowLeft size={24}/></button><h1>{ui("Bill History")}</h1><button className="r-btn r-btn--ghost" onClick={()=>navigate('/retail/bills/held')}><Pause size={18}/>{ui('Hold')}</button></StitchHeader><main className="r-section r-stitch-bill-history">
    {confirmation&&<section className="r-card" role="status"><strong>{ui('Return recorded successfully')}</strong><p>{confirmation.number} · ₹{Number(confirmation.amount).toLocaleString('en-IN')} · {ui(confirmation.method==='CASH'?'Cash refund':'Khata credit')}</p><button className="r-btn r-btn--outline" onClick={()=>navigate('/retail/bills/'+confirmation.billId,{replace:true})}>{ui('View updated bill')}</button></section>}
    <SearchField id="bill-search" label="Search by Bill No. or Customer" placeholder="Search bill no. or customer" value={search} onChange={setSearch}/>
    <ReportPeriodFilter value={{from:from||undefined,to:to||undefined}} onChange={p=>{setFrom(p.from||'');setTo(p.to||'');}}/>
    {!loading&&!error&&<div className="r-card r-stitch-history-summary"><span className="r-ledger-icon"><Receipt size={24}/></span><div><small>{ui('Loaded bills')}</small><strong>{bills.length} / {total}</strong></div><div><small>{ui('Loaded sales subtotal')}</small><strong>₹{bills.reduce((s,b)=>s+Number(b.grand_total),0).toLocaleString('en-IN')}</strong></div></div>}
    {error&&<p role="alert">{error}<button className="r-btn" onClick={()=>load()}>{ui("Try Again")}</button></p>}{loading&&<p role="status">Loading bills…</p>}
    {!loading&&!bills.length&&<EmptyState Icon={Receipt} title="No bills found" description="Try another period, or make your first bill." action="Make Bill" onAction={()=>navigate('/retail/bill')}/>}{bills.map(bill=><button className="r-card r-stitch-bill-history-row r-w-full" key={bill.id} onClick={()=>navigate('/retail/bills/'+bill.id)}><div className="r-stitch-history-identity"><span className="r-stitch-party-avatar">{(bill.party?.name||'Walk-in').slice(0,2).toUpperCase()}</span><div><strong>{bill.party?.name||ui('Walk-in Customer')}</strong><small title={bill.document_number}>{bill.document_number}</small><small>{new Date(bill.document_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · {bill.sales_channel}</small></div><div className="r-stitch-history-money"><strong>₹{Number(bill.grand_total).toLocaleString('en-IN')}</strong><span className={'r-badge r-badge--'+(Number(bill.outstanding_amount)>0?'warning':'success')}>{ui(Number(bill.outstanding_amount)>0?Number(bill.paid_amount)>0?'Partial':'Udhar':'Paid')}</span></div></div><div className="r-stitch-history-footer"><span>{ui('Due')}: ₹{Number(bill.outstanding_amount).toLocaleString('en-IN')}</span><span>{ui('Details')} <ChevronRight size={16}/></span></div></button>)}
    {bills.length<total&&<button className="r-btn r-btn--outline r-w-full" disabled={loading} onClick={()=>load(true)}>Load more bills</button>}
  </main></>;
}
