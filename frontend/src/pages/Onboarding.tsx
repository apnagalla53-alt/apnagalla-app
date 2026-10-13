import { useEffect,useRef,useState } from 'react';
import { Link,Navigate,useNavigate } from 'react-router-dom';
import { ArrowLeft,ArrowRight,Check,ChevronDown,FileUp,MapPin,RefreshCw,ShieldCheck,Store,Wallet,Layers } from 'lucide-react';
import api from '../shared/api';
import { useAuthStore } from '../shared/store/authStore';
import BusinessTypeSheet from './BusinessTypeSheet';
import { onboardingPlanBenefits,onboardingPlanDescriptions,onboardingPlanNames } from './onboardingPresentation';
import './Onboarding.css';
type Profile={owner_name:string;name:string;mobile:string;business_type:string;custom_business_type:string;address:string;city:string;state:string;postal_code:string};
const emptyProfile:Profile={owner_name:'',name:'',mobile:'',business_type:'',custom_business_type:'',address:'',city:'',state:'',postal_code:''};
const localPhone=(phone:string)=>phone.replace(/^\+91/,'').replace(/\D/g,'');
const device=()=>localStorage.getItem('evolix-device-id')||undefined;
export default function Onboarding(){
 const user=useAuthStore(s=>s.user),navigate=useNavigate();
 const [data,setData]=useState<any>(null),[profile,setProfile]=useState<Profile>(emptyProfile),[view,setView]=useState(''),[error,setError]=useState(''),[errorCode,setErrorCode]=useState(''),[busy,setBusy]=useState(false),[sheet,setSheet]=useState(false),[gps,setGps]=useState<{latitude:number;longitude:number}|null>(null),[locationStatus,setLocationStatus]=useState(''),[locating,setLocating]=useState(false);
 const loaded=useRef(false),mounted=useRef(true);
 const step=view||data?.state;
 async function install(result:any,hydrate=false){
  if(result.session_mode==='cookie'||result.access_token){useAuthStore.getState().login(result.access_token,result.user,result.csrf_token);if(result.tenant_context)useAuthStore.getState().setTenantContext(result.tenant_context);navigate(result.next,{replace:true});return;}
  if(result.state==='READY'){
   if(user?.onboarding_state!=='READY'){
    const completed=(await api.post('/auth/account/onboarding/migration',{choice:result.data?.migration_choice==='IMPORT'?'IMPORT':'FRESH',device_id:device()})).data;
    await install(completed);return;
   }
   if(result.tenant_context)useAuthStore.getState().setTenantContext(result.tenant_context);
   useAuthStore.setState(s=>({user:s.user?{...s.user,onboarding_state:'READY'}:null}));
   navigate('/retail/home',{replace:true});return;
  }
  setData(result);setView('');
  if(hydrate){const saved=result.data?.profile||{};setProfile({...emptyProfile,...saved,owner_name:saved.owner_name||result.owner_name||'',name:saved.name||result.business?.name||'',mobile:localPhone(saved.mobile||result.phone||''),business_type:saved.business_type||result.business?.business_type||'',address:saved.address||result.business?.address||'',city:saved.city||result.business?.city||'',state:saved.state||result.business?.state||'',postal_code:saved.postal_code||result.business?.postal_code||''});if(result.data?.location)setGps(result.data.location);}
 }
 async function reload(){setError('');setBusy(true);try{const result=(await api.get('/auth/account/onboarding')).data;if(mounted.current)await install(result,true);}catch(e:any){if(mounted.current)setError(e.response?.data?.message||'Cannot load your setup. Please retry.');}finally{if(mounted.current)setBusy(false);}}
 useEffect(()=>{mounted.current=true;if(!loaded.current&&!user?.is_platform){loaded.current=true;void reload();}return()=>{mounted.current=false;};},[]);
 async function save(path:string,body:any){if(busy)return;setError('');setErrorCode('');setBusy(true);try{await install((await api.post('/auth/account/onboarding/'+path,body)).data);}catch(e:any){const m=e.response?.data?.message;setError(Array.isArray(m)?m.join('. '):m||'Could not save. Your details are still here; please retry.');setErrorCode(e.response?.data?.code||'');}finally{setBusy(false);}}
 function field(key:keyof Profile,value:string){setProfile(p=>({...p,[key]:value}));}
 function locate(){
  setLocationStatus('');if(!navigator.geolocation){setLocationStatus('Location is unavailable. Enter your address below.');return;}
  setLocating(true);navigator.geolocation.getCurrentPosition(position=>{if(mounted.current){setGps({latitude:position.coords.latitude,longitude:position.coords.longitude});setLocationStatus('Location saved. Please enter your street address below; automatic address lookup is not connected.');setLocating(false);}},()=>{if(mounted.current){setLocationStatus('Location permission was not granted. You can continue with a manual address.');setLocating(false);}},{timeout:10000,maximumAge:300000,enableHighAccuracy:false});
 }
 if(user?.is_platform)return <Navigate to="/platform/dashboard" replace/>;
 const profileStep=['OWNER_PROFILE_REQUIRED','BUSINESS_PROFILE_REQUIRED'].includes(step),planStep=step==='PLAN_REQUIRED',migrationStep=step==='MIGRATION_OFFERED',pendingStep=step==='ACCESS_PENDING';
 const category=data?.business_types.find((t:any)=>t.code===profile.business_type);
 const stepNumber=profileStep?1:planStep?2:3;
 return <main className="ob-page">
  <header className="ob-brand"><span aria-hidden="true"><Store size={25}/></span><strong>Apna Galla</strong><small>by Evolix Studio</small></header>
  <section className="ob-card" aria-busy={busy}>
   <ol className="ob-progress" aria-label="Setup progress">{['Business','Plan','Your data'].map((label,i)=><li key={label} aria-current={stepNumber===i+1?'step':undefined}><span>{stepNumber>i+1?<Check size={15}/>:i+1}</span>{label}</li>)}</ol>
   {!data&&!error&&<div className="ob-loading" role="status">Loading your saved progress…</div>}
   {error&&<div className="ob-error" role="alert">{error}{errorCode==='MOBILE_ALREADY_LINKED'&&<Link to="/support">Contact Support</Link>}{!data&&<button type="button" onClick={()=>void reload()}>Retry setup</button>}</div>}
   {profileStep&&<form onSubmit={event=>{event.preventDefault();void save('profile',{...profile,mobile:'+91'+localPhone(profile.mobile),...(gps||{})});}}>
    <div className="ob-intro-icon"><Store size={27}/></div><h1>Set Up Your Business</h1><p className="ob-subtitle">Bas kuch details batayein, phir Apna Galla aapki dukaan ke liye ready ho jayega.</p>
    <label htmlFor="ob-owner">Owner Name <span>*</span></label><input id="ob-owner" autoComplete="name" required maxLength={255} value={profile.owner_name} onChange={e=>field('owner_name',e.target.value)} placeholder="Your full name"/>
    <label htmlFor="ob-shop">Shop / Business Name <span>*</span></label><input id="ob-shop" autoComplete="organization" required maxLength={255} value={profile.name} onChange={e=>field('name',e.target.value)} placeholder="Shree Ganesh General Store"/>
    <label htmlFor="ob-mobile">Mobile Number <span>*</span></label><div className="ob-phone"><span>+91</span><input id="ob-mobile" type="tel" autoComplete="tel-national" inputMode="tel" required pattern="[6-9][0-9 ]{9,13}" maxLength={14} value={profile.mobile} onChange={e=>field('mobile',e.target.value)} placeholder="98765 43210"/></div><p className="ob-field-note">For shop contact. {data.mobile_verified&&localPhone(data.phone||'')===localPhone(profile.mobile)?'Your saved number is verified.':'This number is not verified; no OTP will be sent.'}</p>
    <label id="ob-type-label">Business Type <span>*</span></label><button type="button" aria-labelledby="ob-type-label ob-type-value" className="ob-category-control" aria-haspopup="dialog" onClick={()=>setSheet(true)}><span id="ob-type-value">{category?.name||'Select business type'}</span><ChevronDown size={21}/></button>
    {profile.business_type==='PHARMACY'&&<p className="ob-field-note">Recommended: Batch &amp; Expiry with FEFO, Multi-unit and GST. Availability follows your selected plan. Tracking is configured per item; general goods and services do not need batch tracking.</p>}
    {profile.business_type==='OTHER'&&<><label htmlFor="ob-custom">Describe your business <small>(optional)</small></label><input id="ob-custom" maxLength={100} value={profile.custom_business_type} onChange={e=>field('custom_business_type',e.target.value)} placeholder="e.g. Horse accessories"/></>}
    <label htmlFor="ob-address">Address <span>*</span></label><textarea id="ob-address" autoComplete="street-address" required maxLength={1000} rows={3} value={profile.address} onChange={e=>field('address',e.target.value)} placeholder="Main Market, Khargone, Madhya Pradesh"/>
    <button type="button" className="ob-location" onClick={locate} disabled={locating}><MapPin size={18}/>{locating?'Getting location…':gps?'Update My Location':'Use My Location'}<small>Optional</small></button>{locationStatus&&<p className="ob-field-note" role="status">{locationStatus}</p>}
    <details className="ob-address-more"><summary>City, state & PIN code <span>(optional)</span></summary><label htmlFor="ob-city">City</label><input id="ob-city" autoComplete="address-level2" maxLength={100} value={profile.city} onChange={e=>field('city',e.target.value)}/><label htmlFor="ob-state">State</label><input id="ob-state" autoComplete="address-level1" maxLength={100} value={profile.state} onChange={e=>field('state',e.target.value)}/><label htmlFor="ob-pin">PIN code</label><input id="ob-pin" autoComplete="postal-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" value={profile.postal_code} onChange={e=>field('postal_code',e.target.value)}/></details>
    {data.business&&<button type="button" className="ob-back" disabled={busy} onClick={()=>setView('')}><ArrowLeft size={18}/>Back to setup</button>}
    <button className="ob-primary" disabled={busy||!profile.business_type} type="submit">{busy?'Saving your details…':'Continue'}<ArrowRight size={20}/></button>
   </form>}
   {planStep&&<><div className="ob-intro-icon"><Wallet size={27}/></div><h1>Choose Your Plan</h1><p className="ob-subtitle">Choose the tools that fit your shop. Your records stay safe if you change plans later.</p>
    <button type="button" className="ob-back" disabled={busy} onClick={()=>setView('BUSINESS_PROFILE_REQUIRED')}><ArrowLeft size={18}/>Edit business profile</button>
    {data.state!=='PLAN_REQUIRED'&&<button type="button" className="ob-back" onClick={()=>setView(data.state)}>Back to your data choice</button>}
    {data.access_active&&<p className="ob-provider-note">Your access is already active. Continue to your data choice; future plan changes are available in Subscription.</p>}
    <div className="ob-plans">{data.plans.filter((plan:any)=>['STARTER','SMART','PRO'].includes(plan.code)).map((plan:any)=><article key={plan.code} className={'ob-plan '+(plan.code==='SMART'?'ob-plan-popular':'')}>
     {plan.code==='SMART'&&<span className="ob-popular">MOST POPULAR</span>}<div className="ob-plan-heading"><div><h2>{onboardingPlanNames[plan.code]||plan.name}</h2><p>{onboardingPlanDescriptions[plan.code]}</p></div><strong>₹{Number(plan.monthly_price)}<small>/ month</small></strong></div>
     <ul>{onboardingPlanBenefits[plan.code]?.map(benefit=><li key={benefit}><Check size={17}/>{benefit}</li>)}</ul>{plan.code==='SMART'&&<p className="ob-field-note">For ₹45/month more than Starter, add photos, GST, profit, insights, advanced inventory and 2 staff.</p>}
     <button type="button" disabled={busy||data.access_active} onClick={()=>void save('plan',{choice:'REQUEST',plan_code:plan.code})}>Choose {plan.code[0]+plan.code.slice(1).toLowerCase()}</button>
    </article>)}</div>
    <p className="ob-provider-note"><ShieldCheck size={19}/>Online payments are not connected. Choosing a plan saves your request; support must confirm activation.</p>
    {data.trial.trial_enabled&&!data.access_active&&<button type="button" className="ob-primary" disabled={busy} onClick={()=>void save('plan',{choice:'TRIAL'})}>Start {data.trial.trial_days}-day {data.trial.trial_plan.toLowerCase()} trial</button>}
   </>}
   {migrationStep&&<><div className="ob-intro-icon"><Layers size={27}/></div><h1>Bring Your Existing Data?</h1><p className="ob-subtitle">A fresh start, or the records you already have. You can import later too.</p>
    {!data.access_active&&<p className="ob-provider-note">Your {data.data?.requested_plan_code?.toLowerCase()} plan request is saved. Access is pending confirmation; no payment has been recorded.</p>}
    <button type="button" className="ob-back" disabled={busy} onClick={()=>setView('PLAN_REQUIRED')}><ArrowLeft size={18}/>Review or change plan</button>
    <div className="ob-migration"><button type="button" disabled={busy} onClick={()=>void save('migration',{choice:'FRESH',device_id:device()})}><span className="ob-choice-icon"><Store size={27}/></span><strong>Start fresh</strong><span>Apna Galla mein nayi shuruaat kijiye.</span><ArrowRight size={21}/></button><button type="button" disabled={busy} onClick={()=>void save('migration',{choice:'IMPORT',device_id:device()})}><span className="ob-choice-icon"><FileUp size={27}/></span><strong>Import existing data</strong><span>Supported Excel/CSV files se existing records import kijiye.</span><ArrowRight size={21}/></button></div>
    <p className="ob-field-note">Items, customers, suppliers, opening stock and opening dues. Upload → map → validate → preview → import. Supported formats: {data.import_formats.join(', ')}. Source guides help you prepare exports; a direct connection to other apps is not provided.</p>
   </>}
   {pendingStep&&<><div className="ob-intro-icon"><ShieldCheck size={27}/></div><h1>Your setup is saved</h1><p className="ob-subtitle">Your {data.data?.requested_plan_code?.toLowerCase()} plan is awaiting activation. Once support confirms it, you can {data.data?.migration_choice==='IMPORT'?'import your records':'open your shop'}.</p><div className="ob-pending-summary"><strong>{data.business?.name}</strong><span>{profile.mobile?'+91 '+profile.mobile:''}</span><span>{data.data?.migration_choice==='IMPORT'?'Import existing data':'Start fresh'} selected</span><span>Payment status: pending · No payment confirmed</span></div><button type="button" className="ob-primary" disabled={busy} onClick={()=>void reload()}><RefreshCw size={19}/>Check activation status</button><button type="button" className="ob-back" onClick={()=>setView('MIGRATION_OFFERED')}>Change data choice</button><button type="button" className="ob-back" onClick={()=>setView('PLAN_REQUIRED')}>Review or change plan</button><button type="button" className="ob-back" onClick={()=>setView('BUSINESS_PROFILE_REQUIRED')}>Edit business profile</button><Link className="ob-support" to="/support">Contact Support</Link></>}
   {data&&!profileStep&&!planStep&&!migrationStep&&!pendingStep&&<div role="alert"><p>We couldn’t find your next setup step. Your records are safe.</p><button type="button" onClick={()=>void reload()}>Reload setup</button><Link to="/support">Contact Support</Link></div>}
  </section>
  <footer className="ob-footer"><p><ShieldCheck size={16}/>Your progress is saved securely</p><button disabled={busy} type="button" onClick={async()=>{try{await api.post('/auth/account/logout');}finally{useAuthStore.getState().logout();}}}>Sign out</button><Link to="/privacy">Privacy</Link><Link to="/support">Help</Link></footer>
  {sheet&&<BusinessTypeSheet types={data.business_types} value={profile.business_type} onSelect={value=>field('business_type',value)} onClose={()=>setSheet(false)}/>}
 </main>;
}
