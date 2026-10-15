import {useEffect,useState} from 'react';
import api,{getApiErrorMessage} from '../../shared/api';
import {Sheet} from './MobileControls';
import type {RemovalInfo} from './ItemActionsSheet';
export default function BulkItemRemovalSheet({ids,onClose,onChanged}:{ids:string[];onClose:()=>void;onChanged:()=>void}){
  const [rows,setRows]=useState<RemovalInfo[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false);
  useEffect(()=>{let active=true;Promise.all(ids.map(id=>api.get('/retail/items/'+id+'/removal').then(r=>r.data))).then(r=>{if(active)setRows(r);}).catch(e=>{if(active)setError(getApiErrorMessage(e));});return()=>{active=false;};},[ids]);
  const eligible=rows?.filter(r=>r.can_permanently_delete).length||0;
  const apply=async(action:'ARCHIVE'|'DELETE')=>{if(busy)return;setBusy(true);setError('');try{await api.post('/retail/items/removal',{ids,action,...(action==='DELETE'?{confirmation:'DELETE PERMANENTLY'}:{})});onChanged();onClose();}catch(e){setError(getApiErrorMessage(e));}finally{setBusy(false);}};
  return <Sheet open title={confirm?'Delete selected items permanently?':'Review selected items'} onClose={()=>{if(!busy)onClose();}}><p>{ids.length} selected</p>{error&&<p role="alert">{error}</p>}{!rows&&!error&&<p role="status">Checking stock and history…</p>}{rows&&<>
    <p>{eligible} can be permanently deleted · {rows.length-eligible} must be archived because they have stock, history or protected references.</p>
    {rows.map(r=><p key={r.id}>{r.name} · {r.sku}{Number(r.current_stock)>0?' · '+r.current_stock+' '+r.unit+' stock will remain':''}</p>)}
    {confirm?<><p className="r-text-danger">All selected items have zero stock and no protected history. This action cannot be undone.</p><button className="r-btn r-w-full r-text-danger" disabled={busy} data-tone="danger" onClick={()=>void apply('DELETE')}>Delete Permanently</button></>:<><button className="r-btn r-btn--primary r-w-full" disabled={busy} data-tone="danger" onClick={()=>void apply('ARCHIVE')}>Archive All {rows.length}</button>{eligible===rows.length&&<button className="r-btn r-text-danger r-w-full" disabled={busy} data-tone="danger" onClick={()=>setConfirm(true)}>Review Permanent Delete</button>}</>}
    <p className="r-caption">Mixed selections are never partly deleted. Adjust stock separately or review items individually.</p>
  </>}<button className="r-btn r-w-full" disabled={busy} onClick={onClose}>Cancel / Review individually</button></Sheet>;
}
