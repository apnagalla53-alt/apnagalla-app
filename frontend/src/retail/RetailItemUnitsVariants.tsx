import { useUiLanguage } from "../i18n";
import { useState } from 'react';
import { Layers } from 'lucide-react';
import api, { getApiErrorMessage } from '../shared/api';
import ItemBaseUnitEditor from './components/ItemBaseUnitEditor';

import ContextualVariants from './components/ContextualVariants';
import ItemUnitSetup from './components/ItemUnitSetup';

export default function RetailItemUnitsVariants({ item, features, reload }: { item: any; features: string[]; reload: () => Promise<void> }) {
  useUiLanguage();
  const [size, setSize] = useState(''), [colour, setColour] = useState(''), [sku, setSku] = useState(''), [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const save = async (path: string, body: object) => {
    setBusy(true); setError('');
    try { await api.post(`/retail/items/${item.id}/${path}`, body); await reload(); setSize(''); setColour(''); setSku(''); setPrice('');  }
    catch (e) { setError(getApiErrorMessage(e)); } finally { setBusy(false); }
  };
  return <><ContextualVariants key={item.id} item={item} features={features} reload={reload}/><ItemBaseUnitEditor key={item.primary_unit_id + item.selling_mode} item={item} features={features} reload={reload}/>{error && <p role="alert">{error}</p>}
    {item.has_variants && <details className="r-card"><summary><Layers size={18} /> Variants</summary>
      <p>Receive and sell each size or colour separately.</p>
      {item.variants.map((v: any) => <p key={v.id}>{Object.values(v.attributes).join(' · ')}{v.sku ? ` · ${v.sku}` : ''}</p>)}
      {!item.variants.length && <p>No variants yet. Add your first size or colour.</p>}
      {features.includes('VARIANTS') && <form onSubmit={e => { e.preventDefault(); void save('variants', { attributes: { ...(size.trim() && { Size: size.trim() }), ...(colour.trim() && { Colour: colour.trim() }) }, ...(sku.trim() && { sku: sku.trim() }), ...(price !== '' && { default_sale_rate: Number(price) }) }); }}>
        <label htmlFor="variant-size">Size / option</label><input id="variant-size" className="r-input" maxLength={100} value={size} onChange={e => setSize(e.target.value)} placeholder="e.g. Large" />
        <label htmlFor="variant-colour">Colour (optional)</label><input id="variant-colour" className="r-input" maxLength={100} value={colour} onChange={e => setColour(e.target.value)} placeholder="e.g. Blue" />
        <label htmlFor="variant-sku">Variant SKU (optional)</label><input id="variant-sku" className="r-input" maxLength={100} value={sku} onChange={e => setSku(e.target.value)} />
        <label htmlFor="variant-price">Selling price (optional, ₹)</label><input id="variant-price" className="r-input" type="number" min="0" step=".01" value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" />
        <button className="r-btn r-btn--primary" disabled={busy || !size.trim() && !colour.trim()}>Add Variant</button>
      </form>}
    </details>}
    <ItemUnitSetup item={item} features={features} reload={reload}/>
  </>;
}
