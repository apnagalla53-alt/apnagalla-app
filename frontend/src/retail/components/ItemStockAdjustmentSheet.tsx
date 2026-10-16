import {useEffect,useState} from 'react';
import {useAuthStore} from '../../shared/store/authStore';
import api,{getApiErrorMessage} from '../../shared/api';
import {MobileSelect,Sheet} from './MobileControls';
export default function ItemStockAdjustmentSheet({id,onClose,onSaved}:{id:string;onClose:()=>void;onSaved:()=>void}){
  const branch=useAuthStore(s=>s.tenantContext?.branch_id);
  const [item,setItem]=useState<any>(null),[locations,setLocations]=useState<any[]>([]),[location,setLocation]=useState(''),[quantity,setQuantity]=useState(''),[type,setType]=useState('OUT'),[note,setNote]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;Promise.all([api.get('/retail/items/'+id+'/options'),api.get('/godowns')]).then(([detail,places])=>{if(!active)return;setItem(detail.data);const rows=(Array.isArray(places.data)?places.data:places.data.data||[]).filter((g:any)=>g.branch_id===branch&&g.is_active!==false);setLocations(rows);setLocation(rows[0]?.id||'');}).catch(e=>{if(active)setError(getApiErrorMessage(e));});return()=>{active=false;};},[id,branch]);
  const tracked=item?.has_variants||item?.track_batch||item?.track_serial||item?.is_bundle||item?.item_type==='SERVICE'||item?.inventory_tracking===false;
  return <Sheet open title={'Adjust Stock'+(item?' · '+item.name:'')} onClose={()=>{if(!busy)onClose();}}><p>Stock adjustment is a separate recorded action. Archiving alone does not change stock.</p>{error&&<p role="alert">{error}</p>}{!item&&!error&&<p role="status">Loading stock…</p>}
    {tracked?<p role="alert" data-tone="warning">This item uses tracked components, variants, batches or serials. Use its existing tracked stock workflow; a generic adjustment would lose that detail.</p>:item&&<form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await api.post('/inventory/adjustments',{adjustment_type:type,narration:note.trim(),lines:[{item_id:id,godown_id:location,unit_id:item.primary_unit_id,quantity:Number(quantity),reason:note.trim()}]});onSaved();}catch(err){setError(getApiErrorMessage(err));}finally{setBusy(false);}}}>
      {locations.length>1&&<><label htmlFor="adjust-location">Stock location</label><MobileSelect id="adjust-location" value={location} onChange={e=>setLocation(e.target.value)}>{locations.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</MobileSelect></>}
      <label htmlFor="adjust-type">Adjustment</label><MobileSelect id="adjust-type" value={type} onChange={e=>setType(e.target.value)} presentation="segments"><option value="OUT">Reduce / Write off</option><option value="IN">Add stock</option></MobileSelect>
      <label htmlFor="adjust-quantity">Quantity ({item.primary_unit.code})</label><input id="adjust-quantity" className="r-input" type="number" min="0.000001" step="any" required value={quantity} onChange={e=>setQuantity(e.target.value)} inputMode="decimal"/>
      <label htmlFor="adjust-reason">Reason</label><input id="adjust-reason" className="r-input" required maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/>
      <button className="r-btn r-btn--primary r-w-full" data-tone={type==='OUT'?'warning':'success'} disabled={busy||!location||!(Number(quantity)>0)||!note.trim()}>{busy?'Saving…':'Post Stock Adjustment'}</button>
    </form>}
    <button className="r-btn r-w-full" disabled={busy} onClick={onClose}>Back to item actions</button>
  </Sheet>;
}
