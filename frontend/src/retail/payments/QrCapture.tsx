import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus } from 'lucide-react';
import { Sheet } from '../components/MobileControls';
import { readUpiQr } from './readUpiQr';
export default function QrCapture({open,onClose,onRead}:{open:boolean;onClose:()=>void;onRead:(data:{upi_id:string;payee_name:string})=>void}){
  const [scanning,setScanning]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),video=useRef<HTMLVideoElement>(null),input=useRef<HTMLInputElement>(null);
  const generation=useRef(0),controls=useRef<{stop:()=>void}|null>(null);
  const stop=()=>{generation.current++;controls.current?.stop();controls.current=null;const stream=video.current?.srcObject;if(stream&&'getTracks' in stream)(stream as MediaStream).getTracks().forEach(t=>t.stop());};
  useEffect(()=>{if(!open){stop();setScanning(false);setError('');setBusy(false);}return stop;},[open]);
  useEffect(()=>{if(!scanning||!open)return;let active=true;const token=++generation.current;
    void import('@zxing/browser').then(async({BrowserQRCodeReader})=>{
      const control=await new BrowserQRCodeReader().decodeFromVideoDevice(undefined,video.current!, (result,_error,ctrl)=>{if(!active||generation.current!==token)return;if(result){try{const data=readUpiQr(result.getText());ctrl.stop();stop();onRead(data);}catch(e){setError((e as Error).message);}}});
      if(!active||generation.current!==token)control.stop();else controls.current=control;
    }).catch(()=>{if(active){setError('Camera unavailable or permission declined. Use a QR image from your gallery.');setScanning(false);}});
    return()=>{active=false;stop();};
  },[scanning,open]);
  async function readFile(file:File){if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){setError('Choose a PNG, JPG or WebP image smaller than 10 MB.');return;}
    setBusy(true);setError('');const token=++generation.current,url=URL.createObjectURL(file);
    try{const {BrowserQRCodeReader}=await import('@zxing/browser');const result=await new BrowserQRCodeReader().decodeFromImageUrl(url);if(token===generation.current)onRead(readUpiQr(result.getText()));}catch(e){if(token===generation.current)setError(e instanceof Error&&e.message.includes('QR')?e.message:'Could not read the QR. Try a clearer image or enter the UPI ID.');}finally{URL.revokeObjectURL(url);if(token===generation.current)setBusy(false);}}
  return <Sheet open={open} onClose={onClose} title="Add your receiving QR"><p>The image is read on this device. Check the extracted UPI ID and displayed name before saving.</p><div className="r-quick-action-list"><button type="button" className="r-btn" disabled={busy} onClick={()=>{setError('');setScanning(true);}}><Camera/>Scan your QR</button><button type="button" className="r-btn" disabled={busy} onClick={()=>{stop();setScanning(false);input.current?.click();}}><ImagePlus/>Add from gallery</button></div><input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{if(e.target.files?.[0])void readFile(e.target.files[0]);e.target.value='';}}/>{scanning&&<><video ref={video} autoPlay playsInline muted style={{width:'100%',maxHeight:320}}/><button type="button" className="r-btn" onClick={()=>{stop();setScanning(false);}}>Stop camera</button></>}{busy&&<p role="status">Reading QR…</p>}{error&&<p role="alert">{error}</p>}</Sheet>;
}
