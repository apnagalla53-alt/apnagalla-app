import UpiAccountBreakdown from './payments/UpiAccountBreakdown';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Eye, EyeOff, PackagePlus, Receipt, ShoppingCart, Sparkles, UserPlus, Users, Wallet } from 'lucide-react';
import { ui, useUiLanguage } from '../i18n';
import { useAuthStore } from '../shared/store/authStore';
import { getApiErrorMessage } from '../shared/api';
import { preloadInitialRoute } from '../shared/initialRoute';
import { reportsApi } from './retailApi';
import { readReport } from './reports/reportReads';
import { useRetailEntitlements } from './subscription/useRetailEntitlements';
import { QuickAccessEditor, useQuickAccess } from './components/QuickAccess';
import { LoadingState } from './components/MobileControls';
import RetailHomeTools from './components/RetailHomeTools';
import { GettingStartedCard, MetricCard, PrimaryActionCard, RecommendationCard } from './experience/ExperienceComponents';
import { useHomeExperience } from './experience/useHomeExperience';
import SuggestionCard from './experience/SuggestionCard';
import './experience/experience-layout.css';

const shopDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export default function RetailHome() {
 useUiLanguage();
 const navigate=useNavigate(),user=useAuthStore(s=>s.user),tenant=useAuthStore(s=>s.tenantContext),access=useRetailEntitlements(),quick=useQuickAccess();
 const [retry,setRetry]=useState(0),[editing,setEditing]=useState(false),[hidden,setHidden]=useState(false),[question,setQuestion]=useState('');
 const experience=useHomeExperience(retry),data=experience.data,isNew=data?.maturity==='NEW';
 const [dashboard,setDashboard]=useState<any>(null),[galla,setGalla]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const owner=['OWNER','ADMIN','TENANT_ADMIN'].includes(user?.role||''),can=(p:string)=>owner||!!user?.permissions?.includes(p);
 const canMoney=can('accounting.read'),canSummary=can('reports.read');
 useEffect(()=>{
  if(!data?.can.sell||loading||(!isNew&&canSummary&&!dashboard))return;
  const connection=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection;
  if(connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType||''))return;
  // Warm only billing code after Home is usable. No item, price or account reads.
  const warm=()=>preloadInitialRoute('/retail/quick-sale');
  if('requestIdleCallback' in window){const id=window.requestIdleCallback(warm,{timeout:1500});return()=>window.cancelIdleCallback(id);}
  const id=globalThis.setTimeout(warm,1000);return()=>globalThis.clearTimeout(id);
 },[data?.can.sell,isNew,canSummary,!!dashboard,loading]);
 useEffect(()=>{let alive=true;setDashboard(null);setGalla(null);setError('');setLoading(false);
  if(!data||data.maturity==='NEW')return()=>{alive=false;};
  const date=shopDate();setLoading(true);
  const requests:Promise<unknown>[]=[];
  if(canSummary)requests.push(reportsApi.getDashboard({from:date,to:date}).then(r=>{if(alive)setDashboard(r.data);}));
  if(canMoney&&access.isFeatureEffective('DAILY_GALLA'))requests.push(readReport('/retail/galla',{date}).then(r=>{if(alive)setGalla(r.data);}));
  Promise.all(requests).catch(e=>{if(alive)setError(getApiErrorMessage(e));}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};
 },[data?.maturity,retry,tenant?.company_id,tenant?.branch_id,canMoney,canSummary,access.isFeatureEffective('DAILY_GALLA')]);
 const money=(value:unknown)=>hidden?'••••':'₹'+Number(value).toLocaleString('en-IN',{maximumFractionDigits:2});
 const name=(user as any)?.name||(user as any)?.display_name||ui('Shopkeeper'),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',hourCycle:'h23'}).format(new Date())),greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
 const ask=(q:string)=>navigate('/retail/assistant'+(q?'?q='+encodeURIComponent(q):''));
 const canAsk=access.isFeatureEffective('ASSISTANT_TEXT');
 const assistantFeature=access.data?.entitlements.features.find(f=>/ASSISTANT/.test(f.code)&&f.enabled);
 const makeBill=()=>navigate('/retail/quick-sale');
 const actions=<>
   <section aria-label={ui('Shop actions')} className="xp-action-grid">
    {data?.can.sell&&<PrimaryActionCard id="qa-new-bill" title={isNew?'Make First Bill':'Quick Bill'} description={isNew?'Start billing in seconds. No setup needed.':'Choose items, then collect payment.'} Icon={Receipt} onClick={makeBill}/>}
    {data?.can.buy&&<PrimaryActionCard id="qa-add-purchase" title="Buy Stock" description="Add a purchase and manage stock." Icon={ShoppingCart} tone="warning" onClick={()=>navigate('/retail/purchases/new')}/>}
    {isNew&&data?.can.manageItems&&<PrimaryActionCard title="Add Many Items" description="Add items together or import a list." Icon={PackagePlus} tone="info" onClick={()=>navigate('/retail/items/bulk')}/>}
    {isNew&&data?.can.receive&&<PrimaryActionCard title={data?.activity.customers?'Add Customer':'Add First Customer'} description="Save details for faster billing." Icon={UserPlus} tone="special" onClick={()=>navigate('/retail/customers/add')}/>}

   </section>
   {data?.can.sell&&<button id="qa-amount-sale" className="r-btn r-btn--outline" onClick={()=>navigate('/retail/amount-sale')}>Amount-only Sale<ArrowRight size={18}/></button>}
   {data?.can.sell&&<button id="qa-quick-sale" className="r-btn r-btn--outline" onClick={()=>navigate('/retail/quick-sale')}>{ui('Quick Bill')} · {ui('Add items as you sell')}<ArrowRight size={18}/></button>}
 </>;
 return <div className="xp-home">
  <section className="xp-greeting"><p>{ui(greeting)},</p><h2>{name}</h2><small>{tenant?.company_name||ui('Your shop')}</small></section>
  {experience.error&&<div className="r-state-message" role="alert"><p>{experience.error}</p><button className="r-btn r-btn--outline" onClick={()=>setRetry(v=>v+1)}>{ui('Try Again')}</button></div>}
  {!data&&!experience.error&&<LoadingState label="Loading your shop…"/>}
  {data&&<>
   {isNew&&<GettingStartedCard billed={data.activity.sales>0} items={!!data.activity.items} customer={!!data.activity.customers} onBill={makeBill}/>}
   {isNew&&actions}
   {isNew&&<RecommendationCard description="You can start billing without adding full inventory."><small>{ui('Just add items as you sell. You can add more details later.')}</small></RecommendationCard>}
   {!isNew&&(canSummary||canMoney)&&<section aria-label={ui("Today's Summary")}><div className="xp-section-title"><h2>{ui("Today's Summary")}</h2><button aria-label={ui(hidden?'Show amounts':'Hide amounts')} onClick={()=>setHidden(v=>!v)}>{hidden?<Eye size={20}/>:<EyeOff size={20}/>}</button></div>
    {loading&&<LoadingState label="Loading shop summary…"/>}
    {error&&<p role="alert">{error} <button className="r-btn r-btn--outline" onClick={()=>setRetry(v=>v+1)}>{ui('Try Again')}</button></p>}
    <div className="xp-metric-grid">
     {dashboard&&<MetricCard label="Today's Sales" value={money(dashboard.net_sales)} context={dashboard.bills_count+' '+ui('Bills')} Icon={Receipt} tone="brand" onClick={()=>navigate('/retail/bills')}/>}
     {galla&&<MetricCard label="Expected Cash" value={money(galla.expected_cash)} context="From recorded cash movements" Icon={Wallet} tone="warning" onClick={()=>navigate('/retail/galla')}/>}
     {dashboard&&canMoney&&<MetricCard label="Customer Due" value={money(dashboard.customer_due)} context="Money to receive" Icon={Users} tone="danger" onClick={()=>navigate('/retail/khata')}/>}
     {dashboard&&can('purchase.read')&&<MetricCard label="Supplier Due" value={money(dashboard.supplier_due)} context="Money to pay" Icon={BookOpen} tone="info" onClick={()=>navigate('/retail/suppliers')}/>}
    </div>
   </section>}
   {!isNew&&dashboard&&<UpiAccountBreakdown rows={dashboard.upi_accounts} hidden={hidden}/>}
   {!isNew&&actions}
   {!!data.suggestions.length&&<section><div className="xp-section-title"><h2>{ui("Today's Suggestions")}</h2></div><div className="xp-stack">{data.suggestions.map(r=><SuggestionCard key={r.id} suggestion={r} onSnooze={experience.snooze}/>)}</div></section>}
   {!isNew&&<section><div className="xp-section-title"><h2>{ui('Quick Access')}</h2>{quick.canEdit&&<button onClick={()=>setEditing(true)}>{ui('Edit Quick Access')}</button>}</div><div className="xp-quick-grid" id="quick-actions">{quick.home.map(a=><button id={'qa-'+a.id} key={a.id} onClick={()=>navigate(a.route)}><a.icon size={22} aria-hidden="true"/>{ui(a.label)}</button>)}</div></section>}
   {(canAsk||assistantFeature)&&<section className="xp-ask"><h2><Sparkles size={20} aria-hidden="true"/>{ui('Ask Apna Galla')}</h2><form onSubmit={e=>{e.preventDefault();ask(question.trim());}}><label className="r-sr-only" htmlFor="home-question">{ui('Your question')}</label><input id="home-question" className="r-input" placeholder={ui('e.g. How do I make a bill?')} value={question} maxLength={1000} onChange={e=>setQuestion(e.target.value)}/><button aria-label={ui('Ask Apna Galla')}><ArrowRight size={23}/></button></form><div className="xp-ask-chips">{['Aaj ki sale?','Low stock?','Supplier total due?'].map(q=><button key={q} onClick={()=>ask(q)}>{ui(q)}</button>)}</div></section>}
   {!isNew&&<RetailHomeTools/>}
  </>}
  <QuickAccessEditor open={editing} onClose={()=>setEditing(false)}/>
 </div>;
}
