import { ui, useUiLanguage } from "../../i18n";
import { useEffect,useState,useRef } from 'react';
import QRCode from 'qrcode';
import { QrCode, Download, Share2, Printer, Maximize2, X, Copy } from 'lucide-react';
import api,{getApiErrorMessage} from '../../shared/api';
import { nativeDeviceActions, printShopQr, shareShopQr } from '../../shared/deviceActions';
export default function UpiQr({amount,invoice=false,paid=false}:{amount?:number;invoice?:boolean;paid?:boolean}) {
  useUiLanguage();
  const [qr,setQr]=useState(''),[profile,setProfile]=useState<any>(null),[error,setError]=useState(''),[full,setFull]=useState(false),[message,setMessage]=useState('');
  const card=useRef<HTMLElement>(null),expandButton=useRef<HTMLButtonElement>(null);
  const close=()=>{setFull(false);expandButton.current?.focus();};
  const print=async()=>{document.body.classList.add('evolix-print-qr');card.current?.setAttribute('data-qr-print','true');try{await printShopQr(qr,profile.payee_name,profile.upi_id+(amount?' · ₹'+amount.toFixed(2):''));}catch{setMessage('Could not open printing. Try Share QR.');}finally{document.body.classList.remove('evolix-print-qr');card.current?.removeAttribute('data-qr-print');}};
  const load=async()=>{setError('');try{
    const p=(await api.get('/retail/payments/upi')).data;setProfile(p);
    if(!p.configured||invoice&&!p.show_on_invoice)return;
    const r=await api.get('/retail/payments/upi/qr',{params:amount&&amount>0?{amount}:{}});
    setQr(await QRCode.toDataURL(r.data.uri,{width:600,margin:3,errorCorrectionLevel:'M',color:{dark:'#10241a',light:'#ffffff'}}));
  }catch(e){setError(getApiErrorMessage(e));}};
  useEffect(()=>{setQr('');load();},[amount,invoice]);
  if(invoice&&(!profile?.configured||!profile?.show_on_invoice))return null;
  if(error)return <div className="r-card" role="alert">{error}<button className="r-btn" onClick={load}>Retry QR</button></div>;
  if(!profile)return <p role="status">Loading payment QR…</p>;
  if(!profile.configured)return <div className="r-card"><QrCode size={24}/><p>{ui('Shop UPI is not configured.')}</p><p className="r-caption">{ui('Set up shop UPI to display a receiving QR. Recording an existing UPI payment is separate and requires your manual confirmation.')}</p><a className="r-btn" href="/retail/more/payments">{ui('Set up receiving UPI')}</a></div>;
  const share=async()=>{try{if(nativeDeviceActions()){await shareShopQr(qr,profile.payee_name);return;}const blob=await(await fetch(qr)).blob();const file=new File([blob],'evolix-upi.png',{type:'image/png'});
    if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:profile.payee_name,text:profile.upi_id+(amount?' · ₹'+amount.toFixed(2):'')});
    else {await navigator.clipboard.writeText(profile.upi_id);setMessage('Sharing images is unavailable here. UPI ID copied.');}
  }catch{setMessage('Sharing was cancelled or unavailable. Use Download QR.');}};
  const content=<><h3>{paid?'UPI portion · ₹'+Number(amount||0).toFixed(2):amount&&amount>0?'Pay ₹'+amount.toFixed(2)+' via UPI':ui("Shop UPI QR")}</h3><p>{profile.payee_name}</p>
    {qr&&<img className="r-upi-image" src={qr} alt={'UPI QR for '+profile.payee_name+(amount?' amount ₹'+amount.toFixed(2):'')}/>}
    <p className="r-upi-id">{profile.upi_id}</p>{paid?<p className="r-caption">Payment already recorded. Reference QR only; do not pay again.</p>:!invoice&&<p className="r-caption">Confirm receipt in your UPI app before marking a payment received. This QR does not confirm payment.</p>}</>;
  return <section ref={card} className="r-card r-upi-card">{content}{message&&<p role="status">{message}</p>}
    {!invoice&&qr&&<div className="r-qr-actions"><button ref={expandButton} className="r-btn" type="button" onClick={()=>setFull(true)}><Maximize2 size={17}/>{ui("Full Screen")}</button>
    <button className="r-btn" type="button" onClick={share}><Share2 size={17}/>{ui("Share QR")}</button>{nativeDeviceActions()?<button className="r-btn" type="button" onClick={share}><Download size={17}/>Save or Share QR</button>:<a className="r-btn" href={qr} download="evolix-upi.png"><Download size={17}/>{ui("Download QR")}</a>}
    <button className="r-btn" type="button" onClick={print}><Printer size={17}/>{ui("Print QR")}</button><button className="r-btn" type="button" onClick={async()=>{try{await navigator.clipboard.writeText(profile.upi_id);setMessage('UPI ID copied');}catch{setMessage('Select the UPI ID to copy it.');}}}><Copy size={17}/>{ui("Copy UPI ID")}</button></div>}
    {full&&<div className="r-qr-full" role="dialog" aria-modal="true" aria-label={ui("Shop UPI QR")} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){e.preventDefault();}}}><button autoFocus className="r-btn" onClick={close}><X size={18}/>{ui("Close")}</button>{content}</div>}
  </section>;
}
