import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Archive,Pencil,ShoppingCart,SlidersHorizontal,Trash2,RotateCcw,MoreHorizontal,ClipboardList} from 'lucide-react';
import api,{getApiErrorMessage} from '../../shared/api';
import {useAuthStore} from '../../shared/store/authStore';
import {Sheet,LoadingState} from './MobileControls';
import ItemStockAdjustmentSheet from './ItemStockAdjustmentSheet';
export type RemovalInfo={id:string;name:string;sku:string;unit:string;active:boolean;item_type:string;is_bundle:boolean;current_stock:string;can_permanently_delete:boolean;protected_references:string[]};
export default function ItemActionsSheet({id,name,onClose,onEdit,onChanged}:{id:string;name:string;onClose:()=>void;onEdit:()=>void;onChanged:()=>void}){
  const navigate=useNavigate(),user=useAuthStore(s=>s.user);
  const canManage=!!user&&(['OWNER','ADMIN','TENANT_ADMIN'].includes(user.role||'')||user.permissions?.includes('inventory.write'));
  const [info,setInfo]=useState<RemovalInfo|null>(null),[mode,setMode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[adjust,setAdjust]=useState(false);
  const load=async()=>{setError('');try{setInfo((await api.get('/retail/items/'+id+'/removal')).data);}catch(e){setError(getApiErrorMessage(e));}};
  useEffect(()=>{if(canManage)void load();},[id,canManage]);
  const change=async()=>{if(busy)return;setBusy(true);setError('');try{
    if(mode==='restore')await api.post('/retail/items/'+id,{active:true});
    else await api.post('/retail/items/removal',{ids:[id],action:mode==='delete'?'DELETE':'ARCHIVE',...(mode==='delete'?{confirmation:'DELETE PERMANENTLY'}:{})});
    onChanged();onClose();if(mode==='delete')navigate('/retail/items');
  }catch(e){setError(getApiErrorMessage(e));}finally{setBusy(false);}};
  if(adjust)return <ItemStockAdjustmentSheet id={id} onClose={()=>setAdjust(false)} onSaved={()=>{setAdjust(false);setInfo(null);void load();onChanged();}}/>;
  return <Sheet open onClose={()=>{if(!busy)onClose();}} title={mode==='delete'?'Delete item permanently?':mode==='archive'?'Archive / Stop Selling':mode==='restore'?'Restore item':name}>
    {error&&<p role="alert">{error}<button className="r-btn" onClick={()=>void load()}>Retry</button></p>}
    {!mode&&<><button className="r-btn r-btn--outline r-w-full" onClick={()=>navigate('/retail/items/'+id)}>View Item &amp; Features</button>{canManage&&<>{!info&&!error?<LoadingState label="Checking item history…"/>:<>
      <button className="r-btn r-w-full" onClick={onEdit}><Pencil size={18}/>Edit</button>
      <button className="r-btn r-w-full" disabled={!info?.active||info.item_type==='SERVICE'||info.is_bundle} onClick={()=>navigate('/retail/purchases/new?item='+id)}><ShoppingCart size={18}/>Buy Stock</button>
      <button className="r-btn r-w-full" onClick={()=>navigate('/retail/needs?name='+encodeURIComponent(name))}><ClipboardList size={18}/>Add to Need List</button>
      <button className="r-btn r-w-full" onClick={()=>setAdjust(true)}><SlidersHorizontal size={18}/>Adjust Stock</button>
      {info&&<><button className="r-btn r-w-full" data-tone={info.active?'danger':'success'} onClick={()=>setMode(info.active?'archive':'restore')}>{info.active?<Archive size={18}/>:<RotateCcw size={18}/>} {info.active?'Archive / Stop Selling':'Restore'}</button>
      {info.can_permanently_delete?<button className="r-btn r-w-full r-text-danger" data-tone="danger" onClick={()=>setMode('delete')}><Trash2 size={18}/>Delete Permanently</button>:<p className="r-caption">Permanent delete unavailable: this item has stock, history or protected references. Archive keeps these records.</p>}</>}
    </>}</>}</>}
    {mode&&info&&<><p><strong>{info.name}</strong></p><p>SKU: {info.sku}</p>
      {mode==='delete'?<><p>This item has no transaction history and zero stock.</p><p className="r-text-danger">This action cannot be undone.</p></>:mode==='archive'?Number(info.current_stock)>0?<p role="alert" data-tone="warning">This item still has {info.current_stock} {info.unit} in stock. Archiving will stop new sales, but stock and valuation will remain until you adjust or write off the stock.</p>:<p>New sales and active catalog suggestions will stop. Past bills, stock, costs and reports remain intact.</p>:<p>This item will be available for new transactions again.</p>}
      {mode==='archive'&&Number(info.current_stock)>0&&<button className="r-btn r-btn--outline r-w-full" disabled={busy} onClick={()=>setAdjust(true)}>Adjust Stock First</button>}
      <button className={'r-btn r-w-full '+(mode==='delete'?'r-text-danger':'r-btn--primary')} data-tone={mode==='restore'?'success':'danger'} disabled={busy} onClick={()=>void change()}>{busy?'Saving…':mode==='delete'?'Delete Permanently':mode==='archive'?Number(info.current_stock)>0?'Archive Anyway':'Confirm Archive':'Confirm Restore'}</button>
      <button className="r-btn r-w-full" disabled={busy} onClick={()=>setMode('')}>Cancel</button>
    </>}
  </Sheet>;
}
export function ItemActionsLauncher({id,name,onEdit,onChanged}:{id:string;name:string;onEdit:()=>void;onChanged:()=>void}){
  const [open,setOpen]=useState(false);
  return <><button className="r-btn r-btn--outline" onClick={()=>setOpen(true)}><MoreHorizontal size={20}/>Actions</button>{open&&<ItemActionsSheet id={id} name={name} onClose={()=>setOpen(false)} onEdit={()=>{setOpen(false);onEdit();}} onChanged={onChanged}/>}</>;
}
