import DateInput from '../../shared/components/DateInput';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, LockKeyhole } from 'lucide-react';
import { ui, useUiLanguage } from '../../i18n';
import api, { getApiErrorMessage } from '../../shared/api';
import {useCsvDownload,CsvDownloadStatus} from './useCsvDownload';
import {prepareTenantExport} from './prepareTenantExport';
import { SelectionSheet } from '../components/MobileControls';
import { useRetailEntitlements } from './useRetailEntitlements';
import { featureAvailability } from './planPresentation';
import './subscription.css';

const formats=[['ITEMS','Item Master Export'],['STOCK','Stock Export'],['CUSTOMERS','Customer Export'],['SUPPLIERS','Supplier Export'],['KHATA','Khata Export'],['SALES','Sales Export'],['PURCHASES','Purchase Export'],['EXPENSES','Expense Export'],['GST','GST Export'],['PROFIT','Profit Export'],['STAFF','Staff Export'],['LOCATIONS','Stock Location Export'],['DOCUMENTS','Document Metadata Export']];
export default function RetailDataExports(){
  useUiLanguage();const access=useRetailEntitlements();
  const [kind,setKind]=useState('ITEMS'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[offset,setOffset]=useState(0),[next,setNext]=useState<number|null>(null);
  const csv=useCsvDownload(),busy=csv.busy;
  const [partyType,setPartyType]=useState('CUSTOMER'),[party,setParty]=useState<{id:string;name:string}|null>(null),[picker,setPicker]=useState(false),[search,setSearch]=useState(''),[options,setOptions]=useState<any[]>([]),[optionLoading,setOptionLoading]=useState(false),[optionError,setOptionError]=useState('');
  const feature=access.data?.entitlements.features.find(f=>f.code==='EXPORT_'+kind);
  useEffect(()=>{setOffset(0);setNext(null);csv.clear();},[kind,from,to,party,partyType]);
  useEffect(()=>{if(!picker)return;let active=true;setOptionLoading(true);const timer=setTimeout(()=>api.get('/retail/'+(partyType==='CUSTOMER'?'customers':'suppliers'),{params:{search,limit:100}}).then(r=>{if(active){setOptions(r.data.map((p:any)=>({value:p.id,label:p.name})));setOptionError('');}}).catch(e=>{if(active)setOptionError(getApiErrorMessage(e));}).finally(()=>{if(active)setOptionLoading(false);}),200);return()=>{active=false;clearTimeout(timer);};},[picker,partyType,search]);
  const download=async(page=offset)=>{
    const data=await csv.start(()=>prepareTenantExport(kind,{offset:page,...(from?{from}:{}),...(to?{to}:{}),...(kind==='KHATA'?{party_id:party?.id,party_type:partyType}:{}),...(kind==='PROFIT'?{group:'summary'}:{})}));
    if(data){setOffset(page);setNext(data.nextOffset??null);}
  };
  return <section className="r-card r-data-exports" aria-label={ui('Data Export')}>
    <h2>{ui('Data Export')}</h2><p className="r-caption">{ui('Manual exports depend on your plan. CSV exports are separate from configured database backups.')}</p>
    <label className="r-field">{ui('Export format')}<select className="r-input" disabled={busy} value={kind} onChange={e=>setKind(e.target.value)}>{formats.map(([code,label])=><option value={code} key={code}>{ui(label)}</option>)}</select></label>
    {feature?.plan_entitled?<>
      {['SALES','PURCHASES','EXPENSES','GST','PROFIT','KHATA'].includes(kind)&&<div className="r-export-dates"><label className="r-field">{ui('From date')}<DateInput className="r-input" disabled={busy} type="date" value={from} onChange={e=>setFrom(e.target.value)} lang="en-GB"/></label><label className="r-field">{ui('To date')}<DateInput className="r-input" disabled={busy} type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)} lang="en-GB"/></label></div>}
      {kind==='KHATA'&&<><label className="r-field">{ui('Account type')}<select className="r-input" disabled={busy} value={partyType} onChange={e=>{setPartyType(e.target.value);setParty(null);}}><option value="CUSTOMER">{ui('Customer')}</option><option value="SUPPLIER">{ui('Supplier')}</option></select></label><button className="r-btn r-btn--outline r-btn--full" disabled={busy} onClick={()=>setPicker(true)}>{party?.name||ui('Choose account')}</button></>}
      {kind==='DOCUMENTS'&&<p className="r-plan-notice">{ui('This export contains document details. Attachment files and a complete document archive are not included.')}</p>}
      <button className="r-btn r-btn--outline r-btn--full" onClick={()=>void download()} disabled={busy||!feature.enabled||(kind==='KHATA'&&!party)}><Download size={18}/>{ui(busy?'Preparing data…':'Download CSV')}</button>
      {next!==null&&<button className="r-btn r-btn--outline r-btn--full" disabled={busy} onClick={()=>void download(next)}>{ui('Download next page')}</button>}
      <p className="r-caption">{ui('Exports are paginated. Download each page when more records are available. Keep these files private.')}</p>
    </>:feature&&(featureAvailability(feature)==='FUTURE_PREMIUM'?<p className="r-plan-notice">{ui('Future Premium')}</p>:<Link className="r-btn r-btn--outline r-btn--full" to={'/retail/more/subscription?plan='+feature.required_plan}><LockKeyhole size={18}/>{ui(feature.required_plan==='PRO'?'Available in Pro':'Available in Smart')}</Link>)}
    <CsvDownloadStatus state={csv}/>
    <p className="r-caption">{ui('Scheduled exports are not implemented yet.')}</p>
    <SelectionSheet open={picker} onClose={()=>setPicker(false)} title={ui('Choose account')} value={party?.id||''} options={options} onSearch={setSearch} loading={optionLoading} error={optionError} onRetry={()=>setSearch(s=>s+' ')} onSelect={id=>{setParty({id,name:options.find(o=>o.value===id)?.label||''});setPicker(false);}}/>
  </section>;
}
