import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import {useEffect,useState,useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {ArrowLeft,ShieldCheck,Smartphone} from 'lucide-react';
import api,{getApiErrorMessage} from '../../shared/api';
import UpiQr from './UpiQr';
export default function RetailUpiSettings(){
  useUiLanguage();
  const nav=useNavigate(),[form,setForm]=useState({upi_id:'',payee_name:'',mobile:'',show_on_invoice:true}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[version,setVersion]=useState(0);
  const loadVersion=useRef(0);
  const load=async()=>{const current=++loadVersion.current;setError('');setLoading(true);try{const r=await api.get('/retail/payments/upi');if(current!==loadVersion.current)return;if(r.data.configured){setForm({upi_id:r.data.upi_id,payee_name:r.data.payee_name,mobile:r.data.mobile||'',show_on_invoice:r.data.show_on_invoice});setSaved(true);}}catch(e){if(current===loadVersion.current)setError(getApiErrorMessage(e));}finally{if(current===loadVersion.current)setLoading(false);}};
  useEffect(()=>{load();},[]);
  return <><StitchHeader className="r-page-header" hasBack><button className="r-btn r-btn--icon" aria-label={ui("Back")} onClick={()=>nav('/retail/more')}><ArrowLeft/></button><h1>{ui("UPI & Payments")}</h1></StitchHeader>
    <div className="r-section">{loading?<p role="status">Loading payment settings…</p>:<><div className="r-card"><Smartphone size={26}/><h2>Receive into your shop</h2><p>One primary UPI profile for counter payments and customer dues.</p></div>
    {error&&<div className="r-card" role="alert">{error}<button className="r-btn" onClick={load}>{ui("Try Again")}</button></div>}
    <form className="r-card" onSubmit={async e=>{e.preventDefault();if(saving)return;setSaving(true);setError('');try{await api.post('/retail/payments/upi',{...form,mobile:form.mobile||undefined});setSaved(true);setVersion(v=>v+1);}catch(err){setError(getApiErrorMessage(err));}finally{setSaving(false);}}}>
      <h2>Primary receiving account</h2><label htmlFor="upi-id">{ui("UPI ID *")}</label><input id="upi-id" className="r-input" value={form.upi_id} onChange={e=>setForm({...form,upi_id:e.target.value})} autoCapitalize="none" spellCheck={false} required/>
      <label htmlFor="upi-payee">{ui("Payee / Business Name *")}</label><input id="upi-payee" className="r-input" maxLength={100} value={form.payee_name} onChange={e=>setForm({...form,payee_name:e.target.value})} required/>
      <label htmlFor="upi-mobile">Mobile · optional</label><input id="upi-mobile" className="r-input" type="tel" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})}/>
      <label className="r-list-item"><input type="checkbox" checked={form.show_on_invoice} onChange={e=>setForm({...form,show_on_invoice:e.target.checked})}/>{ui("Show UPI QR on Invoice")}</label>
      <p className="r-caption"><ShieldCheck size={16}/>Format validation only. Your bank account has not been verified. Payment confirmation remains manual.</p>
      <button className="r-btn r-btn--primary r-w-full" disabled={saving}>{saving?ui("Saving…"):ui("Save UPI Profile")}</button></form>
      {saved&&<UpiQr key={version}/>}</>}</div></>;
}
