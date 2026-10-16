import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid2X2 } from 'lucide-react';
import { Sheet } from './MobileControls';
import { drawerGroups, canShowDrawerItem } from './retailNavigation';
import { useAuthStore } from '../../shared/store/authStore';
import { useRetailEntitlements } from '../subscription/useRetailEntitlements';
import { ui } from '../../i18n';
export default function QuickActionsButton(){
  const [open,setOpen]=useState(false),nav=useNavigate(),user=useAuthStore(s=>s.user),entitlements=useRetailEntitlements();
  const ids=['suppliers','udhar','galla','upi','bills'],all=drawerGroups.flatMap(g=>g.children);
  const features=new Set(entitlements.data?.entitlements.features.filter(f=>f.enabled).map(f=>f.code)||[]);
  const actions=ids.map(id=>all.find(item=>item.id===id)!).filter(item=>canShowDrawerItem(item,{user,features}));
  return <><button type="button" id="nav-quick-actions" className={'r-nav-item'+(open?' active':'')} onClick={()=>setOpen(true)} aria-expanded={open}><Grid2X2/><span>{ui('Quick Actions')}</span></button>
    <Sheet open={open} onClose={()=>setOpen(false)} title={ui('Quick Actions')}>{entitlements.loading&&<p role="status">Loading your tools…</p>}{entitlements.error&&<p role="alert">{entitlements.error}</p>}<div className="r-quick-action-list">{actions.map(({id,route,icon:Icon,label})=><button type="button" key={id} className="r-btn r-w-full" onClick={()=>{setOpen(false);nav(route);}}><Icon size={21}/>{ui(id==='galla'?'Aaj ka Galla':id==='upi'?'Payments':id==='bills'?'Sales History':label)}</button>)}</div></Sheet></>;
}
