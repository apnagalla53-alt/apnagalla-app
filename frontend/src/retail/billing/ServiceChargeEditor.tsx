import { useState } from 'react';
import api, { getApiErrorMessage } from '../../shared/api';
import { useBillStore, type ServiceCharge } from '../retailStore';
import { useAuthStore } from '../../shared/store/authStore';
export default function ServiceChargeEditor({close}:{close:()=>void}){
 const current=useBillStore(s=>s.serviceCharge),set=useBillStore(s=>s.setServiceCharge);
 const owner=['OWNER','ADMIN','TENANT_ADMIN'].includes(useAuthStore(s=>s.user?.role)||'');
 const [form,update]=useState<ServiceCharge>(current||{name:'Service charge',amount:0,gst_rate:0}),[remember,setRemember]=useState(owner),[auto,setAuto]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const change=(value:Partial<ServiceCharge>)=>update({...form,...value});
 return <form className="r-service-charge-editor" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{if(remember)await api.post('/retail/account/service-charge-preference',{...form,auto_apply:auto});set(form);close();}catch(e){setError(getApiErrorMessage(e));}finally{setBusy(false);}}}>
 <label htmlFor="service-name">Charge name</label><input id="service-name" className="r-input" required maxLength={80} value={form.name} onChange={e=>change({name:e.target.value})}/>
 <div className="r-form-grid"><div><label htmlFor="service-amount">Amount (₹)</label><input id="service-amount" className="r-input" type="number" required min="0.01" max="999999999" step=".01" inputMode="decimal" value={form.amount||''} placeholder="0" onChange={e=>change({amount:Number(e.target.value)})}/></div><div><label htmlFor="service-gst">GST %</label><input id="service-gst" className="r-input" type="number" min="0" max="100" step=".01" inputMode="decimal" value={form.gst_rate||0} onChange={e=>change({gst_rate:Number(e.target.value)})}/></div></div>
 {!!form.gst_rate&&<><label htmlFor="service-sac">SAC · required for GST</label><input id="service-sac" className="r-input" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={form.sac||''} onChange={e=>change({sac:e.target.value.replace(/\D/g,'')})}/></>}
 {owner&&<><label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Remember this charge for my shop</label>{remember&&<label><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/> Apply to new bills automatically</label>}</>}
 <button type="button" className="r-btn r-btn--outline" onClick={async()=>{try{const {data}=await api.get('/retail/account/service-charge-preference');if(data.charge){update(data.charge);setAuto(data.charge.auto_apply===true);}else setError('No saved charge yet.');}catch(e){setError(getApiErrorMessage(e));}}}>Use saved charge</button>
 {error&&<p role="alert" className="r-text-danger">{error}</p>}<button className="r-btn r-btn--primary" disabled={busy}>{busy?'Saving…':'Apply service charge'}</button>{current&&<button type="button" className="r-btn" onClick={()=>{set(null);close();}}>Remove from this bill</button>}
 </form>;
}
