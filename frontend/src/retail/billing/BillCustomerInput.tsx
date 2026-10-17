import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { khataApi } from '../retailApi';
import { useBillStore } from '../retailStore';
export default function BillCustomerInput(){
 const customer=useBillStore(s=>s.customer),name=useBillStore(s=>s.customerName),setName=useBillStore(s=>s.setCustomerName),setCustomer=useBillStore(s=>s.setCustomer);
 const [matches,setMatches]=useState<any[]>([]),[error,setError]=useState(''),[focused,setFocused]=useState(false);
 useEffect(()=>{let active=true;setMatches([]);setError('');if(!name.trim()||customer)return;const timer=setTimeout(()=>{khataApi.getCustomers(name).then(r=>{if(active)setMatches(r.data.data.filter((c:any)=>!c.is_walkin&&c.active!==false).slice(0,6));}).catch(()=>{if(active)setError('Customer search unavailable. Retry before choosing an existing customer.');});},200);return()=>{active=false;clearTimeout(timer);};},[name,customer]);
 return <section className="r-section r-bill-customer"><label htmlFor="bill-customer-name">Customer name <span className="r-caption">· optional</span></label><div className="r-search-bar"><span className="r-search-icon"><Search size={20}/></span><input id="bill-customer-name" className="r-input" value={customer?.name||name} autoComplete="off" maxLength={255} placeholder="Type or find a customer" onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),160)} onChange={e=>{setCustomer(null);setName(e.target.value);}}/>{(customer||name)&&<button type="button" className="r-btn r-btn--icon" aria-label="Clear customer" onClick={()=>{setCustomer(null);setName('');}}><X size={18}/></button>}</div>
 {focused&&!!matches.length&&<div className="r-quick-matches">{matches.map(c=><button type="button" className="r-sheet-option" key={c.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{setCustomer({...c,balance:Number(c.outstanding_amount||0)});setName('');setFocused(false);}}><strong>{c.name}</strong><small>{c.mobile||'No mobile'}</small></button>)}</div>}
 {error&&<p role="alert">{error}</p>}<p className="r-caption">{customer?'Saved customer selected.':name.trim()?'This name will be saved when the bill succeeds.':'Leave blank for a walk-in bill.'}</p></section>;
}
