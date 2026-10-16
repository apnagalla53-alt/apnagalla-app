import { formatDate } from '../../shared/dateFormat';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, CircleUserRound, CreditCard, ShieldCheck, Wallet, ChevronRight } from 'lucide-react';
import { ui, useUiLanguage } from '../../i18n';
import StitchHeader from '../design/StitchHeader';
import { Sheet, LoadingState } from '../components/MobileControls';
import { useRetailEntitlements, type RetailPlan } from './useRetailEntitlements';
import { featureGroups, planHighlights, planPosition, planName, launchPlanCodes, featureAvailability } from './planPresentation';
import './subscription.css';

export default function RetailSubscription(){
  useUiLanguage();const navigate=useNavigate(),[params]=useSearchParams();
  const access=useRetailEntitlements(),{data}=access;
  const [sheet,setSheet]=useState<'billing'|'compare'|'change'|'unavailable'|null>(null),[target,setTarget]=useState<RetailPlan|null>(null),[confirmed,setConfirmed]=useState(false);
  const plansRef=useRef<HTMLElement>(null);
  const current=data?.entitlements.plan,currentCode=current?.code,currentPrice=current?.monthly_price??0;
  const plans=data?.plans.filter(plan=>launchPlanCodes.includes(plan.code))||[];
  const order=['STARTER','SMART','PRO'];
  const expired=data?.current?.status==='EXPIRED',downgrade=!!target&&order.indexOf(target.code)<order.indexOf(currentCode||'');
  const currentFeatures=data?.plans.find(p=>p.code===currentCode)?.features||data?.entitlements.features.filter(f=>f.plan_entitled)||[];
  const money=(value:number)=>'₹'+value.toLocaleString('en-IN');
  useEffect(()=>{if(!data||!params.get('plan'))return;const next=data.plans.find(p=>p.code===params.get('plan'));if(next&&next.code!==currentCode){setTarget(next);setSheet('change');}},[data,params,currentCode]);
  const choose=(plan:RetailPlan)=>{setTarget(plan);setConfirmed(false);setSheet('change');};
  const continueChange=()=>{setSheet('unavailable');};
  const statusLabels:Record<string,string>={ACTIVE:'Active',TRIAL:'Trial',COMPLIMENTARY:'Complimentary',EXPIRED:'Plan expired',SUSPENDED:'Access temporarily suspended',CANCELLED:'Cancelled',PENDING:'Pending',NOT_CONFIGURED:'No subscription assigned'};
  const allFeatures=data?Array.from(new Map(data.entitlements.features.map(f=>[f.code,f])).values()).filter(f=>featureAvailability(f)!=='LEGACY'):[];
  return <>
    <StitchHeader hasBack trailing={<Link className="r-stitch-account" to="/retail/more/profile" aria-label={ui('Profile')}><CircleUserRound size={20}/></Link>}>
      <button type="button" className="r-btn r-btn--icon" aria-label={ui('Back')} onClick={()=>navigate('/retail/more')}><ArrowLeft size={23}/></button>
      <h1>{ui('Subscription')}</h1><button className="r-btn r-btn--icon" aria-label={ui('Billing & Payments')} onClick={()=>setSheet('billing')}><Wallet size={22}/></button>
    </StitchHeader>
    <main className="r-section r-subscription-page">
      {access.loading&&!data&&<LoadingState label={ui('Loading subscription…')}/>}
      {access.error&&<div role="alert" className="r-card"><p>{access.error}</p><button className="r-btn r-btn--outline" onClick={()=>void access.refresh(true)}>{ui('Try Again')}</button></div>}
      {data&&<>
        <section className="r-card r-current-plan" aria-label={ui('Current Plan')}>
          <div className="r-plan-eyebrow"><span>{ui('Current Plan')}</span><span className="r-status-badge">{ui(statusLabels[data.current?.status||'NOT_CONFIGURED']||data.current?.status||'No subscription assigned')}</span></div>
          <h2>{current?planName(currentCode):ui('No plan assigned')}</h2>{launchPlanCodes.includes(currentCode||'')&&<p className="r-plan-price">{money(currentPrice)}<span> / {ui('month')}</span></p>}
          {data.current?.expires_at&&<p className="r-caption">{ui(expired?'Access ended':'Plan active until')} {formatDate(data.current.expires_at)}</p>}
          {expired&&<p className="r-plan-notice">{ui('Your plan has ended. Your business records are safe. Renew to continue protected features.')}</p>}
          {!expired&&data.current?.expires_at&&new Date(data.current.expires_at).getTime()-Date.now()<7*86400000&&<p className="r-caption">{ui('Renewal due soon')}</p>}
          <ul className="r-plan-benefits">{(planHighlights[currentCode||'']||[]).slice(0,4).map(label=><li key={label}><Check size={16}/>{ui(label)}</li>)}</ul>
          <div className="r-plan-actions"><button className="r-btn r-btn--primary" onClick={()=>expired?setSheet('billing'):plansRef.current?.scrollIntoView({behavior:'smooth'})}>{ui(expired?'Renew Plan':'Manage Plan')}</button><Link className="r-btn r-btn--outline" to="/retail/more/features">{ui('Manage Shop Features')}</Link></div>
          <p className="r-caption">{ui('Extra staff limit')}: {data.entitlements.limits.staff??ui('Not specified')} · {ui('Stock locations')}: {data.entitlements.limits.stock_locations??ui('Not specified')}</p>
        </section>
        <section ref={plansRef} aria-label={ui('Available plans')}><h2>{ui('Choose the plan that fits your shop')}</h2>
          <div className="r-plan-grid">{plans.map(plan=>{
            const selected=plan.code===currentCode;
            return <article className={'r-card r-plan-card '+(plan.code==='SMART'?'is-recommended ':'')+(selected?'is-current':'')} key={plan.code} aria-label={planName(plan.code)}>
              <div className="r-plan-eyebrow"><span>{plan.code}</span>{plan.code==='SMART'&&<span className="r-plan-popular">{ui('MOST POPULAR')}</span>}</div>
              <h3>{planName(plan.code)}</h3><p className="r-plan-price">{money(plan.monthly_price)}<span> / {ui('month')}</span></p><p className="r-caption">{ui(planPosition[plan.code]||plan.description)}</p>
              <ul className="r-plan-benefits">{(planHighlights[plan.code]||[]).map(label=><li key={label}><Check size={17}/><span>{ui(label)}</span></li>)}</ul>
              {plan.code==='SMART'&&<p className="r-plan-notice">{ui('For ₹45/month more than Starter: photos, GST, profit, insights, advanced inventory and 2 staff.')}</p>}
              {plan.code==='STARTER'&&<p className="r-caption">{ui('GST and Profit Reports are available in Smart.')}</p>}
              <button className="r-btn r-btn--primary r-btn--full" disabled={selected||!access.canManage} onClick={()=>choose(plan)}>{ui(selected?'Current Plan':order.indexOf(plan.code)<order.indexOf(currentCode||'')?'Switch to':'Upgrade to')} {!selected&&planName(plan.code)}</button>
              <button className="r-btn r-btn--ghost r-btn--full" onClick={()=>setSheet('compare')}>{ui('View all features')}<ChevronRight size={17}/></button>
            </article>;
          })}</div>
        </section>
        <button className="r-btn r-btn--outline r-btn--full" onClick={()=>setSheet('compare')}>{ui('Compare all features')}</button>
        <section className="r-card"><h2><CreditCard size={21}/>{ui('Billing & Support')}</h2><p>{ui('Online subscription payments are not available yet.')}</p><p className="r-caption">{ui('Please contact support for plan changes or renewal.')}</p><Link className="r-btn r-btn--outline" to="/support">{ui('Contact Support')}</Link></section>
        <p className="r-caption"><ShieldCheck size={16}/> {ui('Changing your plan never deletes historical business records.')}</p>
      </>}
    </main>
    <Sheet open={sheet==='billing'||sheet==='unavailable'} onClose={()=>setSheet(null)} title={ui(sheet==='billing'?'Billing & Payments':'Plan change')}>
      <p>{ui(sheet==='billing'?'Online subscription payments are not available yet.':'Online upgrades are not available yet.')}</p><p>{ui('Please contact support for plan changes or renewal.')}</p><Link className="r-btn r-btn--primary r-btn--full" to="/support">{ui('Contact Support')}</Link>
      {data&&launchPlanCodes.includes(currentCode||'')&&<p className="r-caption">{planName(currentCode)} · {money(currentPrice)} / {ui('month')}</p>}
      {data?.payments.length?<><h3>{ui('Recorded payments')}</h3>{data.payments.map(payment=><div className="r-payment-history" key={payment.id}><strong>{payment.plan_name} · {money(Number(payment.amount)+Number(payment.tax)-Number(payment.discount))}</strong><span>{formatDate(payment.paid_at)} · {ui(payment.status)} · {payment.method}</span><small>{payment.reference}</small></div>)}</>:<p className="r-caption">{ui('No subscription payments recorded.')}</p>}
    </Sheet>
    <Sheet open={sheet==='change'} onClose={()=>setSheet(null)} title={ui(downgrade?'Confirm plan downgrade':'Upgrade your plan')} footer={<button className="r-btn r-btn--primary r-btn--full" disabled={!access.canManage||(downgrade&&!confirmed)} onClick={continueChange}>{ui('Continue')}</button>}>
      {target&&<><h3>{planName(target.code)}</h3><div className="r-plan-change-prices"><p>{ui('Current')}<strong>{money(currentPrice)} / {ui('month')}</strong></p><p>{ui('New plan')}<strong>{money(target.monthly_price)} / {ui('month')}</strong></p></div>
        {!downgrade&&<p>{ui('Additional')}: {money(target.monthly_price-currentPrice)} / {ui('month')}</p>}
        {downgrade?<><p>{ui('You may lose access to some advanced features.')}</p><ul className="r-plan-benefits">{currentFeatures.filter(f=>!target.features.some(t=>t.code===f.code)).map(f=><li key={f.code}>{ui(f.name)}</li>)}</ul><p className="r-plan-notice">{ui('Existing locations, serials, transactions, staff and prices remain safe.')}</p><label className="r-plan-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{ui('I understand the access changes. Keep my existing data.')}</label></>:<ul className="r-plan-benefits">{(planHighlights[target.code]||[]).map(label=><li key={label}><Check size={16}/>{ui(label)}</li>)}</ul>}
      </>}
    </Sheet>
    <Sheet open={sheet==='compare'} onClose={()=>setSheet(null)} title={ui('Compare all features')}>
      {featureGroups.map(group=><details className="r-feature-comparison" key={group} open={group==='Daily Business'}><summary>{ui(group)}</summary>{allFeatures.filter(f=>f.group===group).map(feature=>{
        const state=featureAvailability(feature);
        return <div className="r-comparison-row" key={feature.code}><strong>{ui(feature.name)}</strong><div>{plans.map(plan=><span key={plan.code}>{plan.code}<b>{ui(state==='FUTURE_PREMIUM'?'Future Premium':feature.code==='ASSISTANT_VOICE'?'Coming Soon':!plan.features.some(f=>f.code===feature.code)?'Not included':state==='COMING_SOON'?'Coming Soon':state==='PARTIAL'?'Limited model metadata':'Included')}</b></span>)}</div></div>;
      })}</details>)}
    </Sheet>
  </>;
}
