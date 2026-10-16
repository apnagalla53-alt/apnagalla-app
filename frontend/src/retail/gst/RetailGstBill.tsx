import { readWorkflowDraft,useWorkflowDraft } from '../experience/workflowDraft';
import { gstInputMode } from './gstInput';
import StitchHeader from '../design/StitchHeader';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Printer, Receipt } from 'lucide-react';
import api, { getApiErrorMessage } from '../../shared/api';
import { printInvoice } from '../../shared/deviceActions';
import { LoadingState, MobileSelect } from '../components/MobileControls';
import RetailFormSection from '../components/RetailFormSection';
import { ui, useUiLanguage } from '../../i18n';
import GstInvoiceView from './GstInvoiceView';
import type { GstDocument, GstDraft, GstRecipient, GstSnapshot } from './types';
import { useAuthStore } from '../../shared/store/authStore';
import GstReportingStatus from './GstReportingStatus';
import './gst.css';

export default function RetailGstBill() {
  useUiLanguage();const {id}=useParams();
  const user=useAuthStore(s=>s.user);
  const canWrite=['ADMIN','OWNER','TENANT_ADMIN'].includes(user?.role||'')||!!user?.permissions?.includes('sales.write');
  const flow='gst-invoice:'+id;const [recovered]=useState(()=>readWorkflowDraft<Pick<GstDraft,'recipient'|'place_of_supply'|'reverse_charge'|'lines'>>(flow));
  const [form,setForm]=useState<GstDraft|null>(null),[issued,setIssued]=useState<GstDocument|null>(null),[preview,setPreview]=useState<GstSnapshot|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[sameAddress,setSameAddress]=useState(true),[confirmed,setConfirmed]=useState(false),[noPrevious,setNoPrevious]=useState(false);
  const draft=useWorkflowDraft(flow,form?{recipient:form.recipient,place_of_supply:form.place_of_supply,reverse_charge:form.reverse_charge,lines:form.lines}:recovered);
  const [copy,setCopy]=useState('Original for Recipient');
  useEffect(()=>{let active=true;setLoading(true);setForm(null);setIssued(null);setPreview(null);setError('');setConfirmed(false);setNoPrevious(false);
    api.get('/retail/gst/bills/'+id).then(response=>{if(!active)return;if(response.data.issued)setIssued(response.data.issued);else {const data=response.data;const incoming=recovered?{...data,recipient:{...data.recipient,...recovered.recipient},place_of_supply:recovered.place_of_supply,reverse_charge:recovered.reverse_charge,lines:data.lines.map((line:any)=>{const old=recovered.lines.find(l=>l.line_id===line.line_id);return old?{...line,hsn:old.hsn,description:old.description,uqc:old.uqc}:line;})}:data;setForm(incoming);setSameAddress(incoming.recipient.address===incoming.recipient.delivery_address&&incoming.recipient.state_code===incoming.recipient.delivery_state_code);}}).catch(error=>{if(active)setError(getApiErrorMessage(error));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
  },[id,retry]);
  const invalidate=()=>{setPreview(null);setConfirmed(false);};
  function recipient(key:keyof GstRecipient,value:string) {
    invalidate();setForm(current=>{if(!current)return current;const next={...current.recipient,[key]:key==='gstin'?value.toUpperCase().trim():value};if(sameAddress&&key==='address')next.delivery_address=value;if(sameAddress&&key==='state_code')next.delivery_state_code=value;return {...current,recipient:next};});
  }
  const body=()=>form&&{recipient:{...form.recipient,gstin:form.recipient.gstin||undefined},place_of_supply:form.place_of_supply,reverse_charge:form.reverse_charge,lines:form.lines.map(({line_id,hsn,description,uqc})=>({line_id,hsn,description,uqc})),confirmed,no_previous_gst_invoice:noPrevious};
  const reportingBlocked=!!form?.profile&&form.profile.electronic_reporting!=='NOT_REQUIRED';
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(!form||busy||reportingBlocked)return;setBusy(true);setError('');
    try {const response=await api.post('/retail/gst/bills/'+id+'/preview',body());if(response.data.issued)setIssued(response.data.issued);else setPreview(response.data.snapshot);}catch(error){setError(getApiErrorMessage(error));}finally{setBusy(false);}
  }
  async function issue() {
    if(!preview||!confirmed||!noPrevious||busy||reportingBlocked||!canWrite)return;setBusy(true);setError('');
    try {const response=await api.post('/retail/gst/bills/'+id+'/issue',body());setIssued(response.data);draft.clear();}catch(error){setError(getApiErrorMessage(error));}finally{setBusy(false);}
  }
  const field=(key:'name'|'address'|'gstin'|'delivery_address',label:string,area=false)=> {
    const required=key==='name'||key==='delivery_address'||key==='address'&&(!!form?.recipient.gstin||Number(form?.bill.total)>=50000);
    return <div className={'gst-field'+(area?' gst-field--wide':'')}><label htmlFor={'gst-recipient-'+key}>{ui(label)}{required?' *':' · '+ui('Optional')}</label>{area?<textarea id={'gst-recipient-'+key} className="r-input" required={required} maxLength={1000} value={form?.recipient[key]||''} onChange={event=>recipient(key,event.target.value)}/>:<input id={'gst-recipient-'+key} className="r-input" required={required} autoCapitalize={key==='gstin'?'characters':'sentences'} spellCheck={key==='gstin'?false:undefined} inputMode={key==='gstin'?gstInputMode(form?.recipient.gstin||''):'text'} maxLength={key==='gstin'?15:255} value={form?.recipient[key]||''} onChange={event=>recipient(key,event.target.value)}/>}</div>;
  };
  const state=(key:'state_code'|'delivery_state_code',label:string)=><div className="gst-field"><label htmlFor={'gst-recipient-'+key}>{ui(label)} *</label><MobileSelect id={'gst-recipient-'+key} value={form?.recipient[key]||''} onChange={event=>recipient(key,event.target.value)}><option value="">{ui('Select State')}</option>{Object.entries(form?.states||{}).map(([code,name])=><option key={code} value={code}>{name} ({code})</option>)}</MobileSelect></div>;
  const snapshot=issued?.snapshot||preview;
  return <div className="gst-page"><StitchHeader className="r-page-header gst-no-print" hasBack><Link className="r-btn r-btn--icon" to="/retail/gst" aria-label={ui('Back to GST')}><ArrowLeft size={22}/></Link><h1>{ui(issued?'GST Invoice':'Prepare GST Invoice')}</h1></StitchHeader>
    {form?.profile&&reportingBlocked&&<div className="gst-reporting-block"><GstReportingStatus profile={form.profile}/><Link to="/retail/gst" state={{returnTo:'/retail/gst/bills/'+id}} className="r-btn r-btn--outline">{ui('Review Business Details')}</Link></div>}
    {error&&<div className="r-card gst-no-print" role="alert"><p>{error}</p>{!form&&!issued&&<button className="r-btn" onClick={()=>setRetry(value=>value+1)}>{ui('Try Again')}</button>}</div>}
    {loading?<div className="gst-no-print"><LoadingState label="Loading bill…"/></div>:issued?<div className="gst-no-print"><div className="r-card" role="status"><strong>{issued.document_number}</strong><p>{ui('Issued and saved. Reprints keep the original details and invoice number.')}</p></div><div className="gst-actions"><button className="r-btn r-btn--primary" id="print-gst-invoice" onClick={()=>{void printInvoice().catch(()=>setError('Could not open printing on this device.'));}}><Printer size={20}/>{ui('Print / Save A4 PDF')}</button><Link className="r-btn r-btn--outline" to={'/retail/bills/'+id}>{ui('View Original Bill')}</Link></div></div>:form&&!form.profile?<div className="r-card gst-no-print"><p>{ui('Set up your GST business details first.')}</p><Link className="r-btn r-btn--primary" to="/retail/gst" state={{returnTo:'/retail/gst/bills/'+id}}>{ui('Set Up GST')}</Link></div>:form&&<form onSubmit={submit} className="gst-no-print">
      <p className="r-caption">{ui('Original Bill')}: {form.bill.number} · ₹{form.bill.total}. {ui('Saved amounts cannot be changed here.')}</p>
      <fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
        <RetailFormSection title={ui('Recipient & Delivery')} Icon={Receipt}><div className="gst-grid">{field('name','Recipient Name')}{field('gstin','Recipient GSTIN')}{field('address','Billing Address',true)}{state('state_code','Recipient State')}</div><label className="gst-check"><input type="checkbox" checked={sameAddress} onChange={event=>{invalidate();setSameAddress(event.target.checked);if(event.target.checked)setForm(current=>current?{...current,recipient:{...current.recipient,delivery_address:current.recipient.address,delivery_state_code:current.recipient.state_code}}:current);}}/><span>{ui('Delivery address is the same as billing address')}</span></label>{!sameAddress&&<div className="gst-grid">{field('delivery_address','Delivery Address',true)}{state('delivery_state_code','Delivery State')}</div>}
        <div className="gst-field"><label htmlFor="gst-place-of-supply">{ui('Place of Supply')} *</label><MobileSelect id="gst-place-of-supply" value={form.place_of_supply} onChange={event=>{invalidate();setForm({...form,place_of_supply:event.target.value});}}><option value="">{ui('Select State')}</option>{Object.entries(form.states).map(([code,name])=><option key={code} value={code}>{name} ({code})</option>)}</MobileSelect><p className="r-caption">{ui('Choose the actual place of supply. It determines CGST + SGST / UTGST or IGST.')}</p></div><p className="r-caption">{ui('Reverse Charge')}: {ui('No')} · {ui('Domestic forward-charge sales')}</p></RetailFormSection>
        <h2>{ui('Check Item Details')}</h2><p className="r-caption">{ui('Confirm descriptions, HSN/SAC and UQC. Prices and GST come from the saved bill.')}</p>
        {form.lines.map((line,index)=><section className="r-card" key={line.line_id}><h3>{index+1}. {line.description}</h3><div className="gst-grid"><div className="gst-field gst-field--wide"><label htmlFor={'gst-description-'+index}>{ui('Description')} *</label><input id={'gst-description-'+index} className="r-input" required maxLength={500} value={line.description} onChange={event=>{invalidate();setForm({...form,lines:form.lines.map((row,i)=>i===index?{...row,description:event.target.value}:row)});}}/></div><div className="gst-field"><label htmlFor={'gst-hsn-'+index}>HSN / SAC *</label><input id={'gst-hsn-'+index} className="r-input" inputMode="numeric" required pattern="[0-9]{4}|[0-9]{6}|[0-9]{8}" maxLength={8} value={line.hsn} onChange={event=>{invalidate();setForm({...form,lines:form.lines.map((row,i)=>i===index?{...row,hsn:event.target.value}:row)});}}/></div><div className="gst-field"><label htmlFor={'gst-uqc-'+index}>{ui('UQC Unit')} *</label><MobileSelect id={'gst-uqc-'+index} value={line.uqc} onChange={event=>{invalidate();setForm({...form,lines:form.lines.map((row,i)=>i===index?{...row,uqc:event.target.value}:row)});}}>{form.uqc.map(code=><option key={code} value={code}>{code}</option>)}</MobileSelect></div></div><p className="r-caption">{line.quantity} {line.unit} · {ui('Taxable Value')}: ₹{line.taxable} · GST: ₹{line.tax} ({line.tax_rate??'not saved'}%)</p></section>)}
      </fieldset><button id="preview-gst-invoice" className="r-btn r-btn--primary r-w-full" disabled={busy||reportingBlocked}><Eye size={20}/>{busy?ui('Loading…'):ui('Preview A4 Invoice')}</button>
    </form>}
    {issued&&<div className="gst-field gst-no-print"><label htmlFor="gst-print-copy">{ui('Print Copy')}</label><MobileSelect id="gst-print-copy" value={copy} onChange={event=>setCopy(event.target.value)}>{(issued.snapshot.supply_kind==='SERVICES'?['Original for Recipient','Duplicate for Supplier']:['Original for Recipient','Duplicate for Transporter','Triplicate for Supplier']).map(label=><option key={label} value={label}>{ui(label)}</option>)}</MobileSelect></div>}
    {snapshot&&<><div className="gst-actions gst-no-print"><p className="r-caption">{ui('A4 preview — swipe horizontally on a phone to inspect the full page.')}</p></div><div className="gst-preview-scroll"><GstInvoiceView snapshot={snapshot} draft={!issued} copy={copy}/></div></>}
    {preview&&!issued&&<section className="r-card gst-no-print"><label className="gst-check"><input id="gst-confirm-details" type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/><span>{ui('I checked the business, recipient, place of supply and HSN/SAC details.')}</span></label><label className="gst-check"><input id="gst-confirm-no-previous" type="checkbox" checked={noPrevious} disabled={busy} onChange={event=>setNoPrevious(event.target.checked)}/><span>{ui('This bill has no GST invoice already issued outside EVOLIX.')}</span></label><p className="r-caption">{ui('Issuing saves these details permanently and assigns an invoice number. The original sale, payment, stock and accounting are unchanged. Print and sign the invoice before handing over.')}</p><button id="issue-gst-invoice" className="r-btn r-btn--primary r-w-full" disabled={busy||!confirmed||!noPrevious||reportingBlocked||!canWrite} onClick={issue}>{busy?ui('Saving…'):ui('Issue GST Invoice')}</button></section>}
  </div>;
}
