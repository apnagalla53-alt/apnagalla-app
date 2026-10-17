import { useState } from 'react';
import { Calculator, Minus, X } from 'lucide-react';
import { useBillStore } from '../retailStore';
import { calculate } from './calculator';
export default function BillCalculator(){
 const [open,setOpen]=useState(false),[minimized,setMinimized]=useState(false),[error,setError]=useState('');
 const draft=useBillStore(s=>s.draft_id),value=useBillStore(s=>s.calculator),set=useBillStore(s=>s.setCalculator);
 const press=(key:string)=>{setError('');if(key==='AC'){set({expression:'',history:value.history});return;}if(key==='⌫'){set({...value,expression:value.expression.slice(0,-1)});return;}
  if(key==='='){try{const result=calculate(value.expression);set({expression:result,history:[...value.history,{expression:value.expression,result}].slice(-20)});}catch(e){setError((e as Error).message);}return;}
  if(value.expression.length<160)set({...value,expression:value.expression+key});
 };
 return <><button type="button" className="r-btn r-btn--icon" aria-label="Open calculator" onClick={()=>{setOpen(true);setMinimized(false);}}><Calculator size={22}/></button>
 {open&&<aside key={draft} className={'r-bill-calculator'+(minimized?' is-minimized':'')} aria-label="Bill calculator">
  <header><button type="button" className="r-btn r-btn--ghost" onClick={()=>setMinimized(false)}><Calculator size={18}/> Calculator</button><div><button type="button" className="r-btn r-btn--icon" aria-label={minimized?'Restore calculator':'Minimize calculator'} onClick={()=>setMinimized(!minimized)}><Minus size={18}/></button><button type="button" className="r-btn r-btn--icon" aria-label="Close calculator" onClick={()=>setOpen(false)}><X size={18}/></button></div></header>
  {!minimized&&<><div className="r-calculator-history" aria-label="Calculation history">{value.history.map((h,i)=><button type="button" key={i} onClick={()=>set({...value,expression:h.result})}>{h.expression} = <strong>{h.result}</strong></button>)}</div>
  <label className="r-sr-only" htmlFor="bill-calculation">Calculation</label><input id="bill-calculation" className="r-input" value={value.expression} placeholder="0" autoComplete="off" inputMode="decimal" onChange={e=>set({...value,expression:e.target.value.slice(0,160)})} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();press('=');}if(e.key==='Escape')setOpen(false);}}/>
  {error&&<p role="alert" className="r-text-danger">{error}</p>}<div className="r-calculator-keys">{['AC','⌫','(',')','7','8','9','÷','4','5','6','×','1','2','3','−','%','0','.','+','='].map(k=><button type="button" key={k} className={'r-btn'+(k==='='?' r-btn--primary':'')} style={k==='='?{gridColumn:'1/-1'}:undefined} onClick={()=>press(k==='−'?'-':k)}>{k}</button>)}</div><p className="r-caption">History belongs to this bill. A new bill starts fresh.</p></>}
 </aside>}</>;
}
