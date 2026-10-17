import { Check } from 'lucide-react';
import { ui, useUiLanguage } from "../../i18n";
import { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../../shared/api';
import { MobileSelect, Sheet } from './MobileControls';
import { useBusinessPreset } from '../experience/useBusinessPreset';
import { useAuthStore } from '../../shared/store/authStore';

export type RetailUnitChoice = { id?: string; code: string; name: string; selling_mode?: string };
export const unitLabel = (unit: { code: string; name?: string }) => unit.name && unit.name !== unit.code ? `${unit.name} (${unit.code})` : unit.code;
export const sellingModeLabel = (mode: string, unit: string) => mode === 'WEIGHT' && ['LTR', 'ML'].includes(unit) ? 'Liquid quantity (litres / ml)' : mode === 'VOLUME' ? 'Volume (measurements)' : mode === 'AREA' ? 'Area (measurements)' : mode[0] + mode.slice(1).toLowerCase();
let cacheKey='',cached:RetailUnitChoice[]|null=null,loadedAt=0,pending:Promise<RetailUnitChoice[]>|null=null;
async function unitChoices(){const state=useAuthStore.getState(),key=state.user?.id+':'+state.tenantContext?.company_id;if(cacheKey!==key){cacheKey=key;cached=null;pending=null;loadedAt=0;}if(cached&&Date.now()-loadedAt<60000)return cached;
 if(!pending){const request=api.get<RetailUnitChoice[]>('/retail/units').then(r=>{if(cacheKey===key){cached=r.data;loadedAt=Date.now();}return r.data;}).finally(()=>{if(cacheKey===key)pending=null;});pending=request;}return pending;
}

export default function UnitPicker({ id, value, onChange, disabled = false, title = 'Unit', allowedModes, category, recommendedUnits, dropdown = false }: {
  id: string; value: string; onChange: (unit: RetailUnitChoice) => void; disabled?: boolean; title?: string; allowedModes?: string[];category?:string;recommendedUnits?:string[];dropdown?:boolean;
}) {
  useUiLanguage();
  const preset=useBusinessPreset(category),recommended=recommendedUnits||preset.recommendedUnits;
  const [showAll,setShowAll]=useState(false);
  const [units, setUnits] = useState<RetailUnitChoice[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [custom, setCustom] = useState(false), [code, setCode] = useState(''), [name, setName] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setUnits(await unitChoices()); } catch (e) { setError(getApiErrorMessage(e)); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const choices = units.some(unit => unit.code === value) ? units : [{ code: value, name: value }, ...units];
  const available = (unit: RetailUnitChoice) => !allowedModes || !unit.selling_mode || allowedModes.includes(unit.selling_mode);
  const customMatch = units.find(unit => unit.code === code);
  const shown=choices.filter(u=>showAll||recommended.includes(u.code)||u.code===value).sort((a,b)=>{const rank=(code:string)=>{const i=recommended.indexOf(code);return i<0?1000:i;};return rank(a.code)-rank(b.code);});
  const chips=shown.filter(u=>available(u)).slice(0,6);
  if(dropdown)return <div><select id={id} aria-label={title} className="r-input" value={value} disabled={disabled||loading} onChange={event=>{if(event.target.value==='__custom'){setCode('');setName('');setCustom(true);return;}const choice=choices.find(u=>u.code===event.target.value);if(choice&&available(choice))onChange(choice);}}>{choices.filter(available).map(choice=><option key={choice.code} value={choice.code}>{unitLabel(choice)}</option>)}</select>{error&&<p role="alert">{error}<button type="button" onClick={load}>Retry</button></p>}</div>;
  return <>
    {!!chips.length&&<div className="xp-unit-chips" role="group" aria-label={ui(title)}>{chips.map(choice=><button key={choice.code} type="button" disabled={disabled} className="xp-unit-chip" aria-pressed={value===choice.code} onClick={()=>onChange(choice)}>{ui(choice.name)}{value===choice.code&&<Check size={17} aria-hidden="true"/>}</button>)}</div>}
    {(showAll||loading||!!error||!chips.length)&&<MobileSelect id={id} title={ui(title)} value={value} disabled={disabled} loading={loading} error={error} onRetry={load}
      onAdd={() => { setCode(''); setName(''); setCustom(true); }} addLabel={ui("Add custom unit")}
      onChange={event => { const found = choices.find(unit => unit.code === event.target.value); if (found && available(found)) onChange(found); }}>
      {shown.map(unit => <option key={unit.code} value={unit.code} disabled={!available(unit)}>{unitLabel(unit)}{!available(unit) ? ' · enable ' + unit.selling_mode?.toLowerCase() + ' in shop features' : ''}</option>)}
    </MobileSelect>}
    <button type="button" className="r-btn r-btn--outline xp-more-units" disabled={disabled} aria-expanded={showAll} onClick={()=>setShowAll(v=>!v)}>{ui(showAll?'Suggested units':'More units')}</button>
    <Sheet open={custom} onClose={() => setCustom(false)} title={ui("Add custom unit")}>
      <p className="r-caption">Use a familiar unit for your shop. This selects a base unit; pack conversions are configured in Item Details.</p>
      <label htmlFor={id + '-custom-name'}>{ui("Unit name")}</label>
      <input id={id + '-custom-name'} className="r-input" value={name} onChange={event => setName(event.target.value)} maxLength={100} placeholder="e.g. Carton" />
      <label htmlFor={id + '-custom-code'}>{ui("Short code")}</label>
      <input id={id + '-custom-code'} className="r-input" value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} maxLength={20} placeholder="e.g. CARTON" />
      {customMatch && !available(customMatch) && <p role="alert">This unit requires {customMatch.selling_mode?.toLowerCase()} in your shop features and plan.</p>}
      <button type="button" className="r-btn r-btn--primary r-w-full" disabled={!name.trim() || !/^[A-Z][A-Z0-9_]{0,19}$/.test(code) || !!customMatch && !available(customMatch)}
        onClick={() => { const option = units.find(unit => unit.code === code) || { code, name: name.trim(), selling_mode: 'PIECE' }; setUnits(previous => previous.some(unit => unit.code === code) ? previous : [...previous, option]); onChange(option); setCustom(false); }}>{ui("Use This Unit")}</button>
    </Sheet>
  </>;
}
