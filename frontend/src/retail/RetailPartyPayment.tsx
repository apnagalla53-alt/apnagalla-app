import DateInput from '../shared/components/DateInput';
import { indiaToday } from '../shared/dateFormat';
import { readWorkflowDraft,useWorkflowDraft } from './experience/workflowDraft';
import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
import RemotePartySelect from './components/RemotePartySelect';
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { khataApi, supplierApi } from './retailApi';
import { getApiErrorMessage } from '../shared/api';
import { AttachmentPicker } from '../shared/components/AttachmentPicker';
import { useOptionalPhotoUpload } from '../shared/useOptionalPhotoUpload';
import UpiQr from './payments/UpiQr';
import ManualUpiConfirmation from './payments/ManualUpiConfirmation';
import {notifyPayment} from './payments/paymentVoice';
import PaymentChoices from './components/PaymentChoices';
import { ArrowLeft } from 'lucide-react';
import './retail-entry-forms.css';
export default function RetailPartyPayment({ supplier=false }: { supplier?: boolean }) {
  useUiLanguage();
  const navigate=useNavigate();const {id}=useParams();const [query]=useSearchParams();
  const flow=(supplier?'supplier-payment:':'customer-payment:')+(id||query.get('customer')||'new');const [seed]=useState(()=>readWorkflowDraft<any>(flow));
  const [parties,setParties]=useState<any[]>([]);const [selected,setSelected]=useState(seed?.selected||(supplier?id||'':query.get('customer')||''));
  const [amount,setAmount]=useState(seed?.amount||'');const [method,setMethod]=useState(seed?.method||'CASH');const [date,setDate]=useState(seed?.date||indiaToday());const [note,setNote]=useState(seed?.note||'');
  const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [paymentId,setPaymentId]=useState(seed?.paymentId||'');
  const photoUpload=useOptionalPhotoUpload(flow);const party=parties.find(p=>p.id===selected);
  const [upiConfirmed,setUpiConfirmed]=useState(false);const draft=useWorkflowDraft(flow,{selected,amount,method,date,note,paymentId});
  useEffect(()=>{setUpiConfirmed(false);},[method,amount,selected]);
  const load=async()=>{setLoading(true);setError('');try{const r=await(supplier?supplierApi.getSuppliers():khataApi.getCustomers());setParties(r.data.data);}catch(err){setError(getApiErrorMessage(err));}finally{setLoading(false);}};
  useEffect(()=>{load();},[supplier]);
  const destination=supplier?'/retail/suppliers/'+selected:'/retail/khata/'+selected;
  return <div className={'r-page-with-sticky r-entry-page r-stitch-party-payment'+(supplier?' r-stitch-party-payment--supplier':'')}><StitchHeader className="r-page-header r-entry-header" hasBack><div className="r-entry-heading"><button type="button" className="r-back-btn" aria-label={ui("Back")} onClick={()=>navigate(-1)}><ArrowLeft size={22}/></button><h1>{supplier?ui("Pay Supplier"):ui("Customer Paid Me")}</h1></div></StitchHeader><div className="r-section">
    {loading&&<p role="status">Loading {supplier?'suppliers':'customers'}…</p>}{error&&<p role="alert">{photoUpload.failed?'Payment recorded; photo upload needs retry. ':''}{error}</p>}
    <form onSubmit={async e=>{e.preventDefault();if(saving||!supplier&&method==='UPI'&&!paymentId&&!upiConfirmed)return;setSaving(true);setError('');try{let receipt=paymentId;
      if(!receipt){const r=await(supplier?supplierApi.paySupplier(selected,{amount:Number(amount),payment_method:method,date,note}):khataApi.receivePayment(selected,{amount:Number(amount),payment_method:method,date,note}));receipt=r.data.payment_id;setPaymentId(receipt);if(!supplier&&receipt)void notifyPayment(receipt);}
      await photoUpload.upload(supplier?'SUPPLIER_PAYMENT':'CUSTOMER_PAYMENT',receipt,supplier?'SUPPLIER_PAYMENT_PROOF':'CUSTOMER_PAYMENT_PROOF');
      draft.clear();navigate(destination,{replace:true});
    }catch(err){setError(getApiErrorMessage(err));}finally{setSaving(false);}}}>
      <fieldset className="r-fieldset" disabled={saving||!!paymentId}><section className="r-card r-stitch-payment-party"><label htmlFor="party-payment-party">{supplier?ui("Supplier"):ui("Customer")}</label><RemotePartySelect id="party-payment-party" className="r-select" required value={selected} onChange={e=>{setSelected(e.target.value);setAmount('');}} records={parties} onLoaded={rows=>setParties(prev=>[...prev.filter(p=>!rows.some(r=>r.id===p.id)),...rows])} supplier={supplier} filter={p=>Number(p.outstanding_amount)>0}><option value="">{ui("Select")} {supplier?'supplier':'customer'}</option>{parties.filter(p=>p.outstanding_amount>0||p.id===selected).map(p=><option key={p.id} value={p.id}>{p.name} · ₹{p.outstanding_amount}</option>)}</RemotePartySelect>
      {!loading&&!parties.some(p=>p.outstanding_amount>0)&&<p>No pending dues.</p>}
      {party&&<div className="r-stitch-party-outstanding"><span>{supplier?ui('You have to pay'):ui('Current Udhar')}</span><strong>₹{Number(party.outstanding_amount).toLocaleString('en-IN',{maximumFractionDigits:2})}</strong></div>}</section>
      <section className="r-card"><label htmlFor="party-payment-amount">{ui("Amount (₹)")}</label><input id="party-payment-amount" className="r-input r-currency-input" type="number" min=".01" max={party?.outstanding_amount||undefined} step="any" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)} required inputMode="decimal"/>
      {party&&<><div className="r-stitch-amount-shortcuts"><button className="r-btn r-btn--outline" type="button" onClick={()=>setAmount(String(party.outstanding_amount))}>{ui("Pay Full Amount")}</button>{[supplier?5000:500,supplier?10000:1000].filter(v=>v<Number(party.outstanding_amount)).map(v=><button className="r-btn r-btn--outline" type="button" key={v} onClick={()=>setAmount(String(v))}>₹{v.toLocaleString('en-IN')}</button>)}</div><p className="r-stitch-remaining">{ui('Remaining dues')}: <strong>₹{Math.max(0,Number(party.outstanding_amount)-Number(amount||0)).toLocaleString('en-IN',{maximumFractionDigits:2})}</strong></p></>}</section>
      <section className="r-card"><PaymentChoices id="party-payment-method" value={method} onChange={setMethod}/>{supplier&&<p className="r-caption">{ui('Record the payment sent to your supplier.')}</p>}
      {!supplier&&method==='UPI'&&Number(amount)>0&&<UpiQr amount={Number(amount)}/>}</section>
      {!supplier&&method==='UPI'&&<ManualUpiConfirmation checked={upiConfirmed} onChange={setUpiConfirmed}/>}
      <section className="r-card"><label htmlFor="party-payment-date">{ui("Payment Date")}</label><DateInput id="party-payment-date" className="r-input" type="date" value={date} onChange={e=>setDate(e.target.value)} required lang="en-GB"/></section>
      <details className="r-card"><summary>{ui('Optional Details')}</summary><label htmlFor="party-payment-note">{ui("Note")}</label><textarea id="party-payment-note" className="r-input" value={note} onChange={e=>setNote(e.target.value)}/><AttachmentPicker onFileSelect={photoUpload.select}/></details></fieldset>
      {photoUpload.failed&&<p role="status">Payment saved. <button className="r-btn" type="button" onClick={()=>{photoUpload.select(null);draft.clear();navigate(destination);}}>Continue without photo</button></p>}
      <p className="r-caption r-stitch-ledger-note">{ui('Confirm only after payment. This updates the account and recorded money movement.')}</p>
      <div className="r-sticky-footer r-entry-footer"><button type="submit" id={supplier?'pay-supplier-save-btn':'receive-payment-save-btn'} className="r-btn r-btn--primary r-w-full" disabled={saving||loading||!selected||Number(amount)<=0||!supplier&&method==='UPI'&&!paymentId&&!upiConfirmed}>{saving?ui("Saving…"):photoUpload.failed?ui("Retry Photo Upload"):supplier?'Record Payment':ui("Receive Payment")}</button></div>
    </form></div></div>;
}
