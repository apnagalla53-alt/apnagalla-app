import { ui, useUiLanguage } from "../../i18n";
import { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../../shared/api';
import { MobileSelect, Sheet } from './MobileControls';

export type RetailUnitChoice = { id?: string; code: string; name: string; selling_mode?: string };
export const unitLabel = (unit: { code: string; name?: string }) => unit.name && unit.name !== unit.code ? `${unit.name} (${unit.code})` : unit.code;
export const sellingModeLabel = (mode: string, unit: string) => mode === 'WEIGHT' && ['LTR', 'ML'].includes(unit) ? 'Liquid quantity (litres / ml)' : mode === 'VOLUME' ? 'Volume (measurements)' : mode === 'AREA' ? 'Area (measurements)' : mode[0] + mode.slice(1).toLowerCase();

export default function UnitPicker({ id, value, onChange, disabled = false, title = 'Unit', allowedModes }: {
  id: string; value: string; onChange: (unit: RetailUnitChoice) => void; disabled?: boolean; title?: string; allowedModes?: string[];
}) {
  useUiLanguage();
  const [units, setUnits] = useState<RetailUnitChoice[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [custom, setCustom] = useState(false), [code, setCode] = useState(''), [name, setName] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setUnits((await api.get('/retail/units')).data); } catch (e) { setError(getApiErrorMessage(e)); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const choices = units.some(unit => unit.code === value) ? units : [{ code: value, name: value }, ...units];
  const available = (unit: RetailUnitChoice) => !allowedModes || !unit.selling_mode || allowedModes.includes(unit.selling_mode);
  const customMatch = units.find(unit => unit.code === code);
  return <>
    <MobileSelect id={id} title={ui(title)} value={value} disabled={disabled} loading={loading} error={error} onRetry={load}
      onAdd={() => { setCode(''); setName(''); setCustom(true); }} addLabel={ui("Add custom unit")}
      onChange={event => { const found = choices.find(unit => unit.code === event.target.value); if (found && available(found)) onChange(found); }}>
      {choices.map(unit => <option key={unit.code} value={unit.code} disabled={!available(unit)}>{unitLabel(unit)}{!available(unit) ? ' · enable ' + unit.selling_mode?.toLowerCase() + ' in shop features' : ''}</option>)}
    </MobileSelect>
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
