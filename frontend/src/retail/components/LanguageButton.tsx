import { useState } from 'react';
import { Languages } from 'lucide-react';
import { setUiLanguage, useUiLanguage } from '../../i18n';
import { Sheet } from './MobileControls';
export default function LanguageButton(){
  const language=useUiLanguage(),[open,setOpen]=useState(false),[error,setError]=useState('');
  return <><button type="button" className="r-btn r-btn--icon" aria-label="Change language / भाषा बदलें" title="Language / भाषा" onClick={()=>setOpen(true)}><Languages size={21}/></button>
    <Sheet open={open} onClose={()=>setOpen(false)} title="Language / भाषा">{(['en','hi'] as const).map(value=><button type="button" className="r-btn r-w-full" aria-pressed={language===value} key={value} onClick={()=>{setError('');void setUiLanguage(value).then(()=>setOpen(false)).catch(()=>setError('Could not load this language. Please retry.'));}}>{value==='en'?'English':'हिन्दी'}{language===value?' ✓':''}</button>)}{error&&<p role="alert">{error}</p>}</Sheet></>;
}
