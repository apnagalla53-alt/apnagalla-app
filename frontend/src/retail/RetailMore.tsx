import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ui, useUiLanguage } from '../i18n';
import { useAuthStore } from '../shared/store/authStore';
import StitchHeader from './design/StitchHeader';
import { useRetailEntitlements } from './subscription/useRetailEntitlements';
import { canShowDrawerItem, drawerGroups, type DrawerNavItem } from './components/retailNavigation';
import { QuickAccessEditor, useQuickAccess } from './components/QuickAccess';

/** Secondary destinations stay on a page, leaving the daily drawer flat. */
export default function RetailMore() {
  useUiLanguage();
  const user=useAuthStore(state=>state.user),access=useRetailEntitlements();
  const quick=useQuickAccess(),[editingQuick,setEditingQuick]=useState(false);
  const features=access.data?new Set(access.data.entitlements.features.filter(feature=>feature.enabled).map(feature=>feature.code)):null;
  const registry=drawerGroups.flatMap(group=>group.children);
  const groups=[
    {label:'Settings & Help',ids:['settings','profile','upi','printer','voice','devices','security','help','privacy','terms','about']},
    {label:'Other shop tools',ids:['held','needs','calendar','documents','locations','import','backup','audit','assistant']},
  ];
  const visible=(ids:string[])=>ids.map(id=>registry.find(item=>item.id===id)).filter((item):item is DrawerNavItem=>!!item&&canShowDrawerItem(item,{user,features}));
  return <><StitchHeader><h1>{ui('Settings & Help')}</h1></StitchHeader><main className="r-section r-settings-hub">
    {groups.map(group=>{const items=visible(group.ids);return items.length>0&&<section key={group.label} className="r-card"><h2>{ui(group.label)}</h2><div className="r-settings-hub-links">{items.map(item=><Link key={item.id} className="r-drawer-link" to={item.route}><item.icon size={21} aria-hidden="true"/><span>{ui(item.label)}</span></Link>)}</div></section>;})}
    {quick.canEdit&&<button type="button" className="r-btn r-btn--outline r-w-full" onClick={()=>setEditingQuick(true)}>{ui('Edit Quick Access')}</button>}
    {access.error&&<p role="alert">{ui('Some tools could not be refreshed. Reopen the menu to retry.')}</p>}
  </main><QuickAccessEditor open={editingQuick} onClose={()=>setEditingQuick(false)}/></>;
}
