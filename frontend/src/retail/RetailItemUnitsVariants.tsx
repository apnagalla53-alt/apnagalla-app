import { ui, useUiLanguage } from "../i18n";
import { useState } from 'react';
import { Layers, PackagePlus } from 'lucide-react';
import api, { getApiErrorMessage } from '../shared/api';
import ItemBaseUnitEditor from './components/ItemBaseUnitEditor';
import { unitLabel } from './components/UnitPicker';

export default function RetailItemUnitsVariants({ item, features, reload }: { item: any; features: string[]; reload: () => Promise<void> }) {
  useUiLanguage();
  const [size, setSize] = useState(''), [colour, setColour] = useState(''), [sku, setSku] = useState(''), [price, setPrice] = useState('');
  const [unit, setUnit] = useState('BOX'), [factor, setFactor] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const save = async (path: string, body: object) => {
    setBusy(true); setError('');
    try { await api.post(`/retail/items/${item.id}/${path}`, body); await reload(); setSize(''); setColour(''); setSku(''); setPrice(''); setFactor(''); }
    catch (e) { setError(getApiErrorMessage(e)); } finally { setBusy(false); }
  };
  return <><ItemBaseUnitEditor key={item.primary_unit_id + item.selling_mode} item={item} features={features} reload={reload}/>{error && <p role="alert">{error}</p>}
    {item.has_variants && <details className="r-card"><summary><Layers size={18} /> Variants</summary>
      <p>Receive and sell each size or colour separately.</p>
      {item.variants.map((v: any) => <p key={v.id}>{Object.values(v.attributes).join(' · ')}{v.sku ? ` · ${v.sku}` : ''}</p>)}
      {!item.variants.length && <p>No variants yet. Add your first size or colour.</p>}
      {features.includes('VARIANTS') && <form onSubmit={e => { e.preventDefault(); void save('variants', { attributes: { ...(size.trim() && { Size: size.trim() }), ...(colour.trim() && { Colour: colour.trim() }) }, ...(sku.trim() && { sku: sku.trim() }), ...(price !== '' && { default_sale_rate: Number(price) }) }); }}>
        <label htmlFor="variant-size">Size / option</label><input id="variant-size" className="r-input" maxLength={100} value={size} onChange={e => setSize(e.target.value)} placeholder="e.g. Large" />
        <label htmlFor="variant-colour">Colour (optional)</label><input id="variant-colour" className="r-input" maxLength={100} value={colour} onChange={e => setColour(e.target.value)} placeholder="e.g. Blue" />
        <label htmlFor="variant-sku">Variant SKU (optional)</label><input id="variant-sku" className="r-input" maxLength={100} value={sku} onChange={e => setSku(e.target.value)} />
        <label htmlFor="variant-price">Selling price (optional, ₹)</label><input id="variant-price" className="r-input" type="number" min="0" step=".01" value={price} onChange={e => setPrice(e.target.value)} />
        <button className="r-btn r-btn--primary" disabled={busy || !size.trim() && !colour.trim()}>Add Variant</button>
      </form>}
    </details>}
    {item.item_type !== 'SERVICE' && !item.is_bundle && <details className="r-card"><summary><PackagePlus size={18} />{ui("Units & packs")}</summary>
      <p>Base unit: {unitLabel(item.primary_unit)}. Stock always stays in this unit.</p>
      {item.unit_conversions.map((c: any) => <p key={c.id}>1 {c.from_unit.code} = {Number(c.conversion_factor)} {item.primary_unit.code}</p>)}
      {features.includes('MULTI_UNIT') ? <form onSubmit={e => { e.preventDefault(); void save('unit-conversions', { unit_code: unit, conversion_factor: Number(factor) }); }}>
        <label htmlFor="pack-unit">Pack / selling unit</label><input id="pack-unit" className="r-input" required maxLength={20} pattern="[A-Z][A-Z0-9_]{0,19}" value={unit} onChange={e => setUnit(e.target.value.toUpperCase())} placeholder="BOX" />
        <label htmlFor="pack-factor">1 {unit || 'pack'} contains how many {item.primary_unit.code}?</label><input id="pack-factor" className="r-input" type="number" required min={item.selling_mode === 'PIECE' ? 1 : .000001} step={item.selling_mode === 'PIECE' ? 1 : .000001} value={factor} onChange={e => setFactor(e.target.value)} />
        <p className="r-caption">Saved conversion factors cannot be overwritten. This protects past bills and stock records.</p>
        <button className="r-btn r-btn--primary" disabled={busy}>Add Unit</button>
      </form> : <p>Your plan does not enable new pack units. Existing records stay available.</p>}
    </details>}
  </>;
}
