import { useEffect,useRef,useState } from 'react';
import { Sheet } from './MobileControls';
import { useAuthStore } from '../../shared/store/authStore';
import { CorrectionCancelled } from '../../shared/correctionIdentity';
export default function CorrectionPrompt(){
  const [pending,setPending]=useState<any>(null),[name,setName]=useState(''),[reason,setReason]=useState('');
  const active=useRef<any>(null);
  useEffect(()=>{const handler=(event:Event)=>{const next=(event as CustomEvent).detail;if(active.current){next.reject(new CorrectionCancelled());return;}active.current=next;setPending(next);setName(useAuthStore.getState().user?.display_name||'');setReason('');};window.addEventListener('apna-galla-correction',handler);return()=>{window.removeEventListener('apna-galla-correction',handler);active.current?.reject(new CorrectionCancelled());active.current=null;};},[]);
  return <Sheet open={!!pending} onClose={()=>{pending?.reject(new CorrectionCancelled());active.current=null;setPending(null);}} title="Who is making this change?"><p>Your name and reason are saved with the signed-in account in the audit history.</p><label>Your name<input className="r-input" maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>Reason<textarea className="r-input" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button type="button" className="r-btn r-btn--primary r-w-full" disabled={name.trim().length<2||reason.trim().length<3} onClick={()=>{pending.resolve({name:name.trim(),reason:reason.trim()});active.current=null;setPending(null);}}>Continue with change</button></Sheet>;
}

