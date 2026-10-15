import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { ui } from '../../i18n';
import { useAuthStore } from '../../shared/store/authStore';
import { useRetailEntitlements } from '../subscription/useRetailEntitlements';
import { Sheet } from './MobileControls';
import { canShowDrawerItem, drawerGroups, drawerQuickLinks, type DrawerNavItem } from './retailNavigation';

const ids = ['quick-sale','bill','inventory','khata','suppliers','receive','pay-supplier','purchases','expenses','needs','items','low-stock','bills','held','galla','reports','calendar','assistant'];
const all = [...drawerQuickLinks, ...drawerGroups.flatMap(g=>g.children)];
const catalog = ids.map(id=>all.find(item=>item.id===id)!).filter(Boolean);
const eventName = 'evolix-quick-access';
export function useQuickAccess() {
  const access=useRetailEntitlements(), user=useAuthStore(s=>s.user), company=useAuthStore(s=>s.tenantContext?.company_id);
  const key=`evolix-quick-access:${user?.id}:${company}`;
  const [revision,setRevision]=useState(0);
  useEffect(()=>{const update=()=>setRevision(n=>n+1);window.addEventListener(eventName,update);window.addEventListener('storage',update);return()=>{window.removeEventListener(eventName,update);window.removeEventListener('storage',update);};},[]);
  const canEdit=['SMART','PRO'].includes(access.data?.entitlements.plan?.code||'');
  const features=access.data?new Set(access.data.entitlements.features.filter(f=>f.enabled).map(f=>f.code)):null;
  const available=catalog.filter(item=>canShowDrawerItem(item,{user,features}));
  let saved:string[]|null=null;
  try {const stored=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(stored))saved=[...new Set(stored.filter(id=>typeof id==='string'&&ids.includes(id)))].slice(0,8);} catch { /* corrupted preferences use defaults */ }
  void revision;
  const selection=canEdit&&saved?saved:access.data?.business_preset?.defaultQuickActions||['receive','purchases','expenses','needs','suppliers'];
  const home=selection.map(id=>available.find(item=>item.id===id)).filter((item):item is DrawerNavItem=>!!item);
  const sidebar=canEdit&&saved ? [drawerQuickLinks[0],...home] : drawerQuickLinks.filter(item=>canShowDrawerItem(item,{user,features}));
  const save=(next:string[]|null)=>{if(!canEdit)return;if(next===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(next.slice(0,8)));window.dispatchEvent(new Event(eventName));};
  return {canEdit,available,selection,home,sidebar,save};
}
export function QuickAccessEditor({open,onClose}:{open:boolean;onClose:()=>void}) {
  const access=useQuickAccess(),[chosen,setChosen]=useState<string[]>([]),[error,setError]=useState('');
  useEffect(()=>{if(open){setChosen(access.selection.filter(id=>access.available.some(item=>item.id===id)));setError('');}},[open]);
  if(!access.canEdit)return null;
  const move=(index:number,by:number)=>setChosen(current=>{const next=[...current];[next[index],next[index+by]]=[next[index+by],next[index]];return next;});
  return <Sheet open={open} onClose={onClose} title="Edit Quick Access">
    <p>Choose up to 8 shortcuts for Home and the shop sidebar. Home and Quick Bill stay easy to reach.</p><p className="r-caption">Saved for your account and shop on this device.</p>
    <div className="r-quick-access-options">{access.available.map(item=><label className="r-toggle-row" key={item.id}><input type="checkbox" checked={chosen.includes(item.id)} disabled={!chosen.includes(item.id)&&chosen.length>=8} onChange={e=>setChosen(current=>e.target.checked?[...current,item.id]:current.filter(id=>id!==item.id))}/>{ui(item.label)}</label>)}</div>
    <h3>Shortcut order</h3>{chosen.map((id,index)=>{const item=access.available.find(i=>i.id===id);if(!item)return null;return <div className="r-quick-access-order" key={id}><span>{ui(item.label)}</span><button type="button" className="r-btn r-btn--icon" disabled={index===0} aria-label={'Move '+item.label+' up'} onClick={()=>move(index,-1)}><ArrowUp size={18}/></button><button type="button" className="r-btn r-btn--icon" disabled={index===chosen.length-1} aria-label={'Move '+item.label+' down'} onClick={()=>move(index,1)}><ArrowDown size={18}/></button></div>;})}
    {error&&<p role="alert">{error}</p>}<div className="r-form-grid"><button type="button" className="r-btn r-btn--outline" onClick={()=>{try{access.save(null);onClose();}catch{setError('Could not save shortcuts. Check browser storage permissions.');}}}>Reset defaults</button><button type="button" className="r-btn r-btn--primary" onClick={()=>{try{access.save(chosen);onClose();}catch{setError('Could not save shortcuts. Check browser storage permissions.');}}}>Save Quick Access</button></div>
  </Sheet>;
}
