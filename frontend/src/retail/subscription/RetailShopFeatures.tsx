import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, LockKeyhole, SlidersHorizontal, Package, ChartNoAxesCombined, MessageCircle, UsersRound, ReceiptText, Mic, DatabaseBackup } from 'lucide-react';
import { ui, useUiLanguage } from '../../i18n';
import api, { getApiErrorMessage } from '../../shared/api';
import StitchHeader from '../design/StitchHeader';
import { LoadingState, SearchField, Sheet } from '../components/MobileControls';
import { featureGroups, featureAvailability, planName } from './planPresentation';
import { useRetailEntitlements, type ShopFeature } from './useRetailEntitlements';
import './subscription.css';
const groupIcons=[ReceiptText,Package,ChartNoAxesCombined,MessageCircle,UsersRound];
export default function RetailShopFeatures(){
  useUiLanguage();const access=useRetailEntitlements(),{data}=access;
  const [search,setSearch]=useState(''),[selected,setSelected]=useState<ShopFeature|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const features=(data?.entitlements.features||[]).filter(f=>featureAvailability(f)!=='LEGACY');
  const current=data?.entitlements.plan;
  const selectedLive=features.find(f=>f.code===selected?.code)||selected;
  const providerUnavailable=(feature:ShopFeature)=>feature.code==='ASSISTANT_VOICE'?!data?.voice_provider.available:feature.code==='BACKUP'?!data?.backup_provider.configured:false;
  const label=(feature:ShopFeature)=>{
    const state=featureAvailability(feature);
    if(feature.code==='ASSISTANT_VOICE'||feature.code==='EXPORT_SCHEDULED'||state==='COMING_SOON')return 'Coming Soon';
    if(state==='FUTURE_PREMIUM'&&!feature.plan_entitled)return 'Future Premium';
    return !feature.plan_entitled?('Locked — '+(feature.required_plan==='PRO'?'Pro':'Smart')):!feature.rollout_enabled?'Unavailable':!data?.entitlements.subscription_active?'Subscription inactive':providerUnavailable(feature)?'Not configured':feature.core?'Included':feature.enabled?'Enabled':'Available to enable';
  };
  const toggle=async(feature:ShopFeature)=>{setBusy(feature.code);setError('');setNotice('');try{await api.post('/retail/account/features/'+feature.code,{enabled:!feature.shop_enabled});await access.refresh(true);setNotice(ui(feature.shop_enabled?'Shop feature disabled. Existing records are safe.':'Shop feature enabled.'));}catch(e){setError(getApiErrorMessage(e));}finally{setBusy('');}};
  const controls=(feature:ShopFeature)=>{
    const state=featureAvailability(feature);
    if(state==='COMING_SOON'||feature.code==='EXPORT_SCHEDULED'||state==='FUTURE_PREMIUM'&&!feature.plan_entitled)return <span className="r-caption">{ui(label(feature))}</span>;
    return !feature.plan_entitled?<Link className="r-feature-upgrade" to={'/retail/more/subscription?plan='+feature.required_plan}>{ui(feature.required_plan==='PRO'?'Upgrade to Pro':'Upgrade to Smart')}<LockKeyhole size={15}/></Link>:!feature.core?<button type="button" role="switch" aria-label={ui(feature.name)} aria-checked={feature.shop_enabled} className={'r-feature-switch '+(feature.shop_enabled?'is-on':'')} disabled={!!busy||!access.canManage||!feature.rollout_enabled||!data?.entitlements.subscription_active} onClick={()=>void toggle(feature)}><span/></button>:<Check size={20} aria-label={ui('Included')}/>;
  };
  return <>
    <StitchHeader><h1>{ui('Shop Features')}</h1><SlidersHorizontal size={22}/></StitchHeader>
    <main className="r-section r-shop-features">
      <p className="r-caption">{ui('Your plan gives access. Choose which optional tools your shop uses.')}</p>
      {current&&<Link to="/retail/more/subscription" className="r-card r-feature-plan"><strong>{planName(current.code)}</strong><span>{ui('Manage Plan')}</span></Link>}
      {access.loading&&!data&&<LoadingState label={ui('Loading features…')}/>}
      {(access.error||error)&&<div className="r-card" role="alert"><p>{error||access.error}</p><button className="r-btn r-btn--outline" onClick={()=>void access.refresh(true)}>{ui('Try Again')}</button></div>}
      {notice&&<p role="status" className="r-plan-notice">{notice}</p>}
      {data&&<>{data.business_type==='PHARMACY'&&<section className="r-card"><h2>Recommended for Pharmacy</h2><p>Batch &amp; Expiry with FEFO, Multi-unit and GST help with medicines. Configure tracking per item; general goods, devices and services do not need medicine tracking.</p>{[['BATCH_TRACKING','Batch & Expiry · FEFO'],['MULTI_UNIT','Multi-unit'],['GST_INVOICES','GST']].map(([code,name])=>{const feature=features.find(f=>f.code===code);return <p key={code}>{name}: {feature?ui(label(feature)):'Unavailable'}</p>;})}</section>}<SearchField value={search} onChange={setSearch} label={ui('Search features')} placeholder={ui('Search features…')}/>
        {featureGroups.map((group,index)=>{const items=features.filter(f=>f.group===group&&(!search||[ui(f.name),f.name,ui(f.description),f.description].join(' ').toLowerCase().includes(search.toLowerCase())));const Icon=groupIcons[index];return items.length?<details className="r-feature-group r-card" key={group} open={!!search||undefined}>
          <summary><Icon size={21}/><span>{ui(group)}</span><small>{items.length}</small></summary>
          <div>{items.map(feature=><article key={feature.code} className="r-feature-card"><button className="r-feature-info" onClick={()=>{setSelected(feature);setError('');}}><span className="r-feature-symbol">{feature.code==='ASSISTANT_VOICE'?<Mic size={22}/>:feature.code==='BACKUP'?<DatabaseBackup size={22}/>:<Icon size={22}/>}</span><span><strong>{ui(feature.name)}</strong><small>{ui(feature.description)}</small><b className={!feature.plan_entitled?'is-locked':''}>{ui(label(feature))}</b></span></button>{controls(feature)}</article>)}</div>
        </details>:null;})}
        {!features.some(f=>[f.name,ui(f.name),f.description,ui(f.description)].join(' ').toLowerCase().includes(search.toLowerCase()))&&<p className="r-card">{ui('No matches found')}</p>}
        <Link className="r-btn r-btn--outline r-btn--full" to="/retail/more/backup">{ui('Backup, exports & data portability')}</Link>
        <p className="r-caption">{ui('Turning a tool off restricts new use. Existing bills, stock and history remain safe.')}</p>
      </>}
    </main>
    <Sheet open={!!selectedLive} onClose={()=>setSelected(null)} title={ui(selectedLive?.name||'Shop Features')}>
      {selectedLive&&<><p>{ui(selectedLive.description)}</p><div className="r-detail-row"><span>{ui('Current Plan')}</span><strong>{planName(current?.code)}</strong></div><div className="r-detail-row"><span>{ui('Plan access')}</span><strong>{ui(selectedLive.plan_entitled?'Included':'Not included')}</strong></div><div className="r-detail-row"><span>{ui('Shop state')}</span><strong>{ui(label(selectedLive))}</strong></div>{providerUnavailable(selectedLive)&&<p className="r-plan-notice">{ui(selectedLive.code==='ASSISTANT_VOICE'?'Voice is not included in current plans. Text Ask Apna Galla remains available.':'Operator backup is not configured. You can still export your shop records.')}</p>}
      {selectedLive.code==='STAFF'&&<p>{ui('Extra staff limit')}: {access.getFeatureLimit('staff')}</p>}{selectedLive.code==='MULTIPLE_STOCK_LOCATIONS'&&<p>{ui('Stock locations')}: {access.getFeatureLimit('stock_locations')}</p>}
      <div className="r-feature-detail-action">{controls(selectedLive)}{selectedLive.plan_entitled&&!selectedLive.core&&!['COMING_SOON','FUTURE_PREMIUM'].includes(featureAvailability(selectedLive))&&<span>{ui(selectedLive.shop_enabled?'Enabled':'Available to enable')}</span>}</div>{error&&<p role="alert">{error}</p>}
      {(selectedLive.code==='BACKUP'||selectedLive.code.startsWith('EXPORT_'))&&<Link className="r-btn r-btn--outline r-btn--full" to="/retail/more/backup">{ui('Backup, exports & data portability')}</Link>}
      <p className="r-caption">{ui('Existing business records remain safe.')}</p></>}
    </Sheet>
  </>;
}
