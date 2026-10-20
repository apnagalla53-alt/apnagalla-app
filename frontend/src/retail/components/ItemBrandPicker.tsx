import { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../../shared/api';
import { Sheet } from './MobileControls';
import { ui } from '../../i18n';

export default function ItemBrandPicker({value,onChange}:{value:string;onChange:(id:string)=>void}) {
 const [brands,setBrands]=useState<{id:string;name:string}[]>([]),[open,setOpen]=useState(false),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[loading,setLoading]=useState(false),[offset,setOffset]=useState(0),[more,setMore]=useState(false);
 useEffect(()=>{let active=true;setLoading(true);api.get('/retail/item-brands',{params:{limit:100,offset}}).then(r=>{if(active){setBrands(current=>offset?[...current,...r.data].filter((b,index,all)=>all.findIndex(v=>v.id===b.id)===index):r.data);setMore(r.data.length===100);}}).catch(e=>{if(active)setError(getApiErrorMessage(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[revision,offset]);
 return <div className="r-input-group"><label htmlFor="item-brand">{ui('Brand')} <small>· {ui('Optional')}</small></label>
  <div className="r-form-grid"><select id="item-brand" className="r-input" value={value} onChange={e=>onChange(e.target.value)}><option value="">{loading?'Loading brands…':'No brand / Unbranded'}</option>{brands.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select><button type="button" className="r-btn r-btn--outline" onClick={()=>{setName('');setError('');setOpen(true);}}>+ {ui('Add Brand')}</button></div>
  {more&&<button type="button" className="r-btn" disabled={loading} onClick={()=>setOffset(n=>n+100)}>More brands</button>}
  {error&&!open&&<p role="alert">{error}<button type="button" className="r-btn" onClick={()=>setRevision(r=>r+1)}>{ui('Try Again')}</button></p>}
  <Sheet open={open} title="Add Brand" onClose={()=>{if(!busy)setOpen(false);}}>
   <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const r=await api.post('/retail/item-brands',{name:name.trim()});setBrands(current=>[...current.filter(b=>b.id!==r.data.id),r.data].sort((a,b)=>a.name.localeCompare(b.name)));onChange(r.data.id);setOpen(false);}catch(e){setError(getApiErrorMessage(e));}finally{setBusy(false);}}}>
    <label htmlFor="new-brand-name">{ui('Brand Name')}</label><input id="new-brand-name" className="r-input" autoFocus required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/>{error&&<p role="alert">{error}</p>}
    <button type="submit" className="r-btn r-btn--primary r-mt-lg" disabled={busy||!name.trim()}>{ui(busy?'Saving…':'Save Brand')}</button>
   </form>
  </Sheet>
 </div>;
}
