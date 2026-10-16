import { readWorkflowDraft,useWorkflowDraft } from '../experience/workflowDraft';
import { gstInputMode,gstInputError } from './gstInput';
import GstProfilePreview from './GstProfilePreview';
import { safeReturnTo } from '../components/returnNavigation';
import { formatDate } from '../../shared/dateFormat';
import StitchHeader from '../design/StitchHeader';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, FileText, Plus, Receipt, Settings2, ShieldCheck } from 'lucide-react';
import api, { getApiErrorMessage } from '../../shared/api';
import { useAuthStore } from '../../shared/store/authStore';
import { useBillStore } from '../retailStore';
import { EmptyState, LoadingState, SearchField } from '../components/MobileControls';
import GstBusinessForm from './GstBusinessForm';
import GstReportingStatus from './GstReportingStatus';
import { StatusCard } from '../design/StitchComponents';
import { ui, useUiLanguage } from '../../i18n';
import type { GstProfile } from './types';
import './gst.css';

type Bill={id:string;document_number:string;document_date:string;grand_total:string;tax_amount:string;status:string;party:{name:string};gst_invoice:{document_number:string}|null};
export default function RetailGst() {
  useUiLanguage();const navigate=useNavigate(),location=useLocation(),returnTo=safeReturnTo(location.state,'/retail/gst');
  const [recovered]=useState(()=>readWorkflowDraft<GstProfile>('gst-profile'));

  const company=useAuthStore(state=>state.tenantContext?.company_id);
  const user=useAuthStore(state=>state.user);
  const canConfigure=['ADMIN','OWNER','TENANT_ADMIN'].includes(user?.role||'')||!!user?.permissions.includes('settings.write');
  const canRead=['ADMIN','OWNER','TENANT_ADMIN'].includes(user?.role||'')||!!user?.permissions?.includes('sales.read');
  const canWrite=['ADMIN','OWNER','TENANT_ADMIN'].includes(user?.role||'')||!!user?.permissions?.includes('sales.write');
  const [profile,setProfile]=useState<GstProfile|null>(null),[form,setForm]=useState<GstProfile|null>(null),[states,setStates]=useState<Record<string,string>>({});
  const draft=useWorkflowDraft('gst-profile',form||recovered);
  const [loading,setLoading]=useState(true),[setup,setSetup]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [search,setSearch]=useState(''),[offset,setOffset]=useState(0),[bills,setBills]=useState<Bill[]>([]),[total,setTotal]=useState(0),[billsLoading,setBillsLoading]=useState(false),[billError,setBillError]=useState('');
  useEffect(()=>{
    if(!canRead){setLoading(false);return;}let active=true;setLoading(true);setError('');setProfile(null);setBills([]);
    api.get('/retail/gst/profile').then(response=>{if(!active)return;const data=response.data;setProfile(data.profile);setForm(recovered||{...data.defaults,...data.profile,email:data.profile?.email||data.defaults.email||'',phone:data.profile?.phone||data.defaults.phone||'',trade_name:data.profile?.trade_name||data.defaults.trade_name||'',gstin:data.profile?.gstin||data.defaults.gstin||'',address:data.profile?.address||data.defaults.address||''});setStates(data.states);setSetup(!data.profile);}).catch(error=>{if(active)setError(getApiErrorMessage(error));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[company,retry,canRead]);
  useEffect(()=>{
    if(!profile)return;let active=true;setBillsLoading(true);setBillError('');
    const timer=setTimeout(()=>{api.get('/retail/gst/bills',{params:{search,limit:20,offset}}).then(response=>{if(active){setBills(previous=>offset?[...previous,...response.data.data]:response.data.data);setTotal(response.data.total);}}).catch(error=>{if(active)setBillError(getApiErrorMessage(error));}).finally(()=>{if(active)setBillsLoading(false);});},250);
    return()=>{active=false;clearTimeout(timer);};
  },[profile,search,offset,retry]);
  const update=(key:keyof GstProfile,value:string|number|boolean)=>{draft.resume();setError('');setForm(current=>current?{...current,[key]:value,...(key==='gstin'&&!current.state_code&&states[String(value).slice(0,2)]?{state_code:String(value).slice(0,2)}:{})}:current);};
  const text=(key:'legal_name'|'trade_name'|'address'|'gstin'|'phone'|'email'|'invoice_prefix'|'signatory'|'terms',label:string,required=false,area=false)=>
    <div className={'gst-field'+(area?' gst-field--wide':'')}><label htmlFor={'gst-profile-'+key}>{ui(label)}{required?' *':' · '+ui('Optional')}</label>{area?<textarea id={'gst-profile-'+key} className="r-input" required={required} maxLength={1000} value={form?.[key]||''} onChange={event=>update(key,event.target.value)}/>:<input id={'gst-profile-'+key} className="r-input" required={required} type={key==='email'?'email':key==='phone'?'tel':'text'} inputMode={key==='gstin'?gstInputMode(form?.gstin||''):key==='phone'?'tel':'text'} autoCapitalize={key==='gstin'||key==='invoice_prefix'?'characters':'sentences'} spellCheck={key==='gstin'?false:undefined} maxLength={key==='gstin'?15:key==='invoice_prefix'?4:255} value={form?.[key]||''} onChange={event=>update(key,['gstin','invoice_prefix'].includes(key)?event.target.value.toUpperCase().trim():event.target.value)}/>}</div>;
  async function save(event:React.FormEvent) {
    event.preventDefault();if(!form||saving)return;setSaving(true);setError('');
    try{const issue=gstInputError(form.gstin,form.state_code);if(issue){setError(issue);return;}const payload={...form};delete (payload as any).state;
      // Defaults come from the Company read model; send only the GST settings DTO.
      const allowed=['legal_name','trade_name','address','state_code','gstin','phone','email','invoice_prefix','hsn_digits','electronic_reporting','regular_registration','signatory','terms'];
      const body=Object.fromEntries(Object.entries(payload).filter(([key,value])=>allowed.includes(key)&&value!==null&&!(key==='email'&&!value)));
      const response=await api.put('/retail/gst/profile',body);setProfile(response.data.profile);setForm(response.data.profile);setSetup(false);draft.clear();if(returnTo!=='/retail/gst')navigate(returnTo,{replace:true});
    }catch(error){setError(getApiErrorMessage(error));}finally{setSaving(false);}
  }
  if(loading)return <div className="gst-page"><LoadingState label="Loading GST details…"/></div>;
  if(!canRead)return <div className="gst-page"><StatusCard Icon={ShieldCheck} title="Permission required" description="Your account does not have permission to view GST invoices."/></div>;
  return <div className="gst-page"><StitchHeader className="r-page-header" onBack={()=>navigate(returnTo==="/retail/gst"?"/retail/home":returnTo,{replace:true})}><h1><Receipt size={24}/> {ui('GST Invoices')}</h1>{profile&&canConfigure&&<button className="r-btn r-btn--outline" onClick={()=>setSetup(value=>!value)}><Settings2 size={18}/>{ui('Business Details')}</button>}</StitchHeader>
    {error&&<div className="r-card" role="alert"><p>{error}</p>{!form&&<button className="r-btn" onClick={()=>setRetry(value=>value+1)}>{ui('Try Again')}</button>}</div>}
    {setup&&form?<><p className="r-caption">{ui('Set up your registered business once. These details appear on your A4 GST invoices.')}</p>{!canConfigure?<div className="r-card"><p>{ui('Ask your shop owner to complete GST setup.')}</p></div>:<form onSubmit={save}><fieldset disabled={saving} style={{border:0,padding:0,margin:0}}>
      <GstBusinessForm form={form} states={states} update={update} text={text}/><GstProfilePreview profile={form} states={states}/>
    </fieldset><button id="save-gst-profile" className="r-btn r-btn--primary r-w-full" disabled={saving}>{saving?ui('Saving…'):ui('Save GST Details')}</button></form>}</>:profile&&<>
      <StatusCard Icon={Building2} tone="success" title={profile.trade_name||profile.legal_name}><p>{profile.gstin} · {states[profile.state_code]}</p><p className="r-caption">{ui('Business GST details saved')}</p></StatusCard>
      <GstReportingStatus profile={profile}/>
      <div className="gst-actions"><button className="r-btn r-btn--primary" id="new-gst-bill" disabled={!canWrite} onClick={()=>{useBillStore.getState().setGstWorkflow(true);navigate('/retail/bill?gst=1');}}><Plus size={20}/>{ui('Make New GST Bill')}</button></div>
      <section aria-labelledby="gst-past-heading"><h2 id="gst-past-heading">{ui('Choose a Past Bill')}</h2><p className="r-caption">{ui('Select an itemized bill with GST already charged. This does not create another sale or change its tax.')}</p><SearchField label={ui('Search bill number or customer')} value={search} onChange={value=>{setSearch(value);setOffset(0);}}/>
      {billError&&<div role="alert" className="r-card">{billError}<button className="r-btn" onClick={()=>setRetry(value=>value+1)}>{ui('Try Again')}</button></div>}
      {billsLoading&&!offset?<LoadingState label="Loading bills…"/>:!billError&&!bills.length?<EmptyState title={ui('No matching bills')} description={ui('Create an itemized GST bill to get started.')} action={ui('Make New GST Bill')} onAction={()=>{useBillStore.getState().setGstWorkflow(true);navigate('/retail/bill?gst=1');}}/>:bills.map(bill=><button key={bill.id} className="gst-bill-row" onClick={()=>navigate('/retail/gst/bills/'+bill.id)} disabled={bill.status!=='POSTED'||(!bill.gst_invoice&&!Number(bill.tax_amount))}><FileText size={22}/><div><strong>{bill.party.name}</strong><small>{bill.document_number}</small><small>{formatDate(bill.document_date)} · {bill.gst_invoice?.document_number||(!Number(bill.tax_amount)?ui('No GST charged'):ui('Prepare GST invoice'))}</small></div><strong>₹{Number(bill.grand_total).toLocaleString('en-IN')}</strong></button>)}
      {bills.length<total&&<button className="r-btn r-w-full" disabled={billsLoading} onClick={()=>setOffset(value=>value+20)}>{billsLoading?ui('Loading…'):ui('Load More Bills')}</button>}</section>
    </>}
    <p className="r-caption" style={{marginTop:24}}><a href="https://taxinformation.cbic.gov.in/content-page/explore-rules/1000136/1000001" target="_blank" rel="noreferrer">CBIC Rule 46</a> · {ui('Domestic forward-charge invoices. GST filing, e-invoicing and e-way bills are not connected.')}</p>
  </div>;
}
