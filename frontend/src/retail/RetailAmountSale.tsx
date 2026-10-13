import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
import RemotePartySelect from './components/RemotePartySelect';
import { MobileSelect } from './components/MobileControls';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../shared/api';
import { khataApi } from './retailApi';
import { AttachmentPicker } from '../shared/components/AttachmentPicker';
import { useOptionalPhotoUpload } from '../shared/useOptionalPhotoUpload';
import {notifyPayment} from './payments/paymentVoice';
import UpiQr from './payments/UpiQr';
import ManualUpiConfirmation from './payments/ManualUpiConfirmation';
import PaymentChoices from './components/PaymentChoices';
import { ArrowLeft, Plus } from 'lucide-react';
import './retail-entry-forms.css';
export default function RetailAmountSale({ udhar=false }: { udhar?: boolean }) {
  useUiLanguage();
  const navigate=useNavigate();const [customers,setCustomers]=useState<any[]>([]);
  const [amount,setAmount]=useState('');const [method,setMethod]=useState('CASH');const [customer,setCustomer]=useState('');
  const [date,setDate]=useState(new Date().toLocaleDateString('en-CA'));const [due,setDue]=useState('');const [note,setNote]=useState('');const [channel,setChannel]=useState('COUNTER');
  const photoUpload = useOptionalPhotoUpload();const [invoice,setInvoice]=useState<any>(null);const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  const [upiConfirmed,setUpiConfirmed]=useState(false);
  useEffect(()=>{setUpiConfirmed(false);},[method,amount]);
  useEffect(()=>{khataApi.getCustomers().then(r=>setCustomers(r.data.data)).catch(e=>setError(getApiErrorMessage(e)));},[]);
  return <div className="r-page-with-sticky r-entry-page r-stitch-amount-sale">
    <StitchHeader className="r-page-header r-entry-header" hasBack><div className="r-entry-heading"><button type="button" className="r-back-btn" aria-label={ui("Back")} onClick={()=>navigate('/retail/home')}><ArrowLeft size={22}/></button><h1>{udhar?ui("Udhar Entry"):ui("Quick Sale")}</h1></div></StitchHeader>
    <div className="r-section"><div className="r-entry-intro"><div><strong>{ui('Amount-only Sale')}</strong><p>{ui('No item is selected, so item stock will not update and exact profit cannot be calculated.')}</p></div><button type="button" className="r-btn r-btn--outline" onClick={()=>navigate('/retail/bill')}><Plus size={18}/>{ui("New Bill")}</button></div>
    {error&&<p role="alert">{photoUpload.failed?'Bill saved; photo upload needs retry. ':''}{error}</p>}
    <form onSubmit={async e=>{e.preventDefault();if(saving||!udhar&&method==='UPI'&&!invoice&&!upiConfirmed)return;setSaving(true);setError('');try{let sale=invoice;if(!sale){sale=(await api.post('/retail/bills/amount-sale',{amount:Number(amount),payment_method:udhar?'UDHAR':method,customer_id:customer||undefined,date,due_date:due||undefined,note,sales_channel:channel})).data;setInvoice(sale);if(!udhar)void notifyPayment(sale.id);}
      await photoUpload.upload('SALES_INVOICE', sale.id, 'SALE_PROOF');navigate('/retail/bills/'+sale.id);}catch(err){setError(getApiErrorMessage(err));}finally{setSaving(false);}}}>
      <fieldset className="r-fieldset" disabled={saving||!!invoice}>
      {udhar&&<section className="r-card r-sale-customer"><label htmlFor="amount-sale-customer">{ui('Customer')} <span aria-hidden='true'>*</span></label><RemotePartySelect id="amount-sale-customer" className="r-select" value={customer} onChange={e=>setCustomer(e.target.value)} required records={customers} onLoaded={rows=>setCustomers(prev=>[...prev.filter(p=>!rows.some(r=>r.id===p.id)),...rows])} filter={p=>p.active!==false&&!!p.credit_allowed}><option value="">{ui('Select customer')}</option>{customers.filter(c=>c.active&&c.credit_allowed).map(c=><option key={c.id} value={c.id}>{c.name} {c.mobile}</option>)}</RemotePartySelect></section>}
      <section className="r-card r-sale-amount"><label htmlFor="amount-sale-amount">{ui('Amount (₹)')} <span aria-hidden='true'>*</span></label><input id="amount-sale-amount" className="r-input r-currency-input" type="number" min=".01" step="any" value={amount} placeholder="0" onChange={e=>setAmount(e.target.value)} required/>{!udhar&&<div className="r-amount-shortcuts">{[50,100,200,500].map(n=><button type="button" key={n} onClick={()=>setAmount(String((Number(amount)||0)+n))}>+₹{n}</button>)}</div>}</section>
      {!udhar&&<section className="r-card r-sale-customer"><label htmlFor="amount-sale-customer">{ui('Customer')} · {ui('optional')}</label><RemotePartySelect id="amount-sale-customer" className="r-select" value={customer} onChange={e=>setCustomer(e.target.value)} records={customers} onLoaded={rows=>setCustomers(prev=>[...prev.filter(p=>!rows.some(r=>r.id===p.id)),...rows])} filter={p=>p.active!==false}><option value="">{ui('Walk-in Customer')}</option>{customers.filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.name} {c.mobile}</option>)}</RemotePartySelect></section>}
      {!udhar&&<section className="r-card"><PaymentChoices id="amount-sale-method" value={method} onChange={setMethod}/>{method==='UPI'&&Number(amount)>0&&<><UpiQr amount={Number(amount)}/><ManualUpiConfirmation checked={upiConfirmed} onChange={setUpiConfirmed}/></>}</section>}
      <section className="r-card"><label htmlFor="amount-sale-date">{ui(udhar?'Bill Date':'Date')}</label><input id="amount-sale-date" className="r-input" type="date" required value={date} onChange={e=>setDate(e.target.value)}/>{udhar&&<><label htmlFor="amount-sale-due">{ui('Due Date')}</label><input id="amount-sale-due" className="r-input" type="date" value={due} onChange={e=>setDue(e.target.value)}/><p className="r-caption">{ui('When will the customer pay? The date appears in Calendar.')}</p></>}</section>
      <details className="r-card"><summary>{ui('Optional Details')}</summary><label htmlFor="amount-sale-channel">{ui('Sales Channel')}</label><MobileSelect id="amount-sale-channel" className="r-select" value={channel} onChange={e=>setChannel(e.target.value)} presentation="segments">{['COUNTER','PHONE','WHATSAPP','ONLINE','OTHER'].map(m=><option key={m}>{m}</option>)}</MobileSelect><label htmlFor="amount-sale-note">{ui('Note')}</label><textarea id="amount-sale-note" className="r-input" value={note} onChange={e=>setNote(e.target.value)}/><AttachmentPicker onFileSelect={photoUpload.select}/></details>
      <section className="r-card r-sale-guarantee"><h2>{ui(udhar?'Ledger Confirmation':'Daily Galla')}</h2><p className="r-caption">{ui(udhar?'This records an unpaid customer due. No money-received greeting plays.':'The payment updates your recorded money movements. This amount-only sale does not deduct item stock.')}</p></section>
      </fieldset>
      {photoUpload.failed&&<button type="button" className="r-btn" onClick={()=>navigate('/retail/bills/'+invoice.id)}>{ui('Continue without photo')}</button>}
      <div className="r-sticky-footer r-entry-footer"><button type="submit" className="r-btn r-btn--primary r-w-full" disabled={saving||Number(amount)<=0||udhar&&!customer||!udhar&&method==='UPI'&&!invoice&&!upiConfirmed}>{saving?ui("Saving…"):photoUpload.failed?ui("Retry Photo Upload"):udhar?'Save Udhar':'Save Quick Sale'}</button></div>
    </form></div></div>;
}
