import { ui, useUiLanguage } from "../../i18n";
import { useState } from 'react';
import api, { getApiErrorMessage } from '../../shared/api';
import UnitPicker, { unitLabel, sellingModeLabel, type RetailUnitChoice } from './UnitPicker';
import { MobileSelect } from './MobileControls';

export default function ItemBaseUnitEditor({ item, features, reload }: { item: any; features: string[]; reload: () => Promise<void> }) {
  useUiLanguage();
  const [choice, setChoice] = useState<RetailUnitChoice>(item.primary_unit), [mode, setMode] = useState(item.selling_mode);
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  return <details className="r-card"><summary>{ui("Base unit & quantity")}</summary>
    <p>Current unit: {unitLabel(item.primary_unit)}</p>
    {item.base_unit_editable ? <form onSubmit={async event => {
      event.preventDefault(); if (saving) return; setSaving(true); setError('');
      try { await api.post('/retail/items/' + item.id, { unit_code: choice.code, unit_name: choice.name, selling_mode: mode }); await reload(); }
      catch (failure) { setError(getApiErrorMessage(failure)); } finally { setSaving(false); }
    }}><fieldset className="r-fieldset" disabled={saving}>
      <label htmlFor="item-base-unit">{ui("Unit")}</label>
      <UnitPicker id="item-base-unit" value={choice.code} disabled={saving} allowedModes={item.item_type === 'SERVICE' ? undefined : item.track_serial || item.is_bundle ? ['PIECE'] : ['PIECE', ...features]} onChange={unit => {
        setChoice(unit); if (item.item_type === 'SERVICE') setMode(item.selling_mode); else if (!item.track_serial && unit.selling_mode && features.includes(unit.selling_mode)) setMode(unit.selling_mode); else setMode('PIECE');
      }} />
      {item.item_type !== 'SERVICE' && !item.track_serial && !item.is_bundle && <>
        <label htmlFor="item-base-mode">{ui("Sold by")}</label><MobileSelect id="item-base-mode" value={mode} onChange={event => setMode(event.target.value)}>
          <option value="PIECE">{ui("Whole pieces / packs")}</option>{['WEIGHT', 'LENGTH', 'AREA', 'VOLUME'].filter(feature => features.includes(feature)).map(feature => <option key={feature} value={feature}>{sellingModeLabel(feature, choice.code)}</option>)}
        </MobileSelect>
      </>}
      <p className="r-caption">You can choose a base unit before any bill, purchase, stock movement or pack configuration is saved.</p>
      {error && <p role="alert">{error}</p>}<button className="r-btn r-btn--primary" disabled={saving}>{saving ? ui("Saving…") : ui("Save Unit")}</button>
    </fieldset></form> : <p className="r-caption">The base unit is protected because this item has saved records or configuration. {item.item_type === 'SERVICE' ? 'Create a new service if you need a different unit.' : 'Use Units & packs for another selling unit, or create a new item with a different base unit.'}</p>}
  </details>;
}
