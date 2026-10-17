import { ui, useUiLanguage } from "../../i18n";
import { MobileSelect, Sheet } from '../components/MobileControls';
import UnitPicker, { unitLabel, sellingModeLabel, type RetailUnitChoice } from '../components/UnitPicker';
import { useState, useEffect } from 'react';
import api, { getApiErrorMessage } from '../../shared/api';
import { useBillStore, type BillLineItem } from '../retailStore';
import {stockWarning} from './stockWarning';

export default function RetailLineConfigurator({ itemId, existing, close,initialQuantity=1, initialGstRate=0 }: { itemId: string; existing?: BillLineItem; close: () => void;initialGstRate?:number; initialQuantity?:number }) {
  useUiLanguage();
  const [gst,setGst]=useState(String(existing?.gst_rate??existing?.tax_rate??initialGstRate));
  const [item, setItem] = useState<any>(null), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const [features, setFeatures] = useState<string[]>([]), [baseChoice, setBaseChoice] = useState<RetailUnitChoice | null>(null), [sellingMode, setSellingMode] = useState('PIECE');
  const [quantity, setQuantity] = useState(String(existing?.quantity || initialQuantity)), [rate, setRate] = useState(existing ? String(existing.rate) : '');
  const [discount, setDiscount] = useState(String(existing?.discount_amount || 0)), [unit, setUnit] = useState(existing?.unit_id || '');
  const [variant, setVariant] = useState(existing?.variant_id || ''), [batch, setBatch] = useState(existing?.batch_id || '');
  const [serials, setSerials] = useState<string[]>(existing?.serial_ids || []), [dimensions, setDimensions] = useState<any>(existing?.dimensions || {});
  const [modifiers, setModifiers] = useState<string[]>(existing?.modifier_option_ids || []);
  const load = async () => {
    setError('');
    try {
      const [detail, account] = await Promise.all([api.get('/retail/items/' + itemId + '/options'), api.get('/retail/account')]);
      setItem(detail.data); setSellingMode(detail.data.selling_mode); setBaseChoice(detail.data.primary_unit);
      setFeatures(account.data.features.filter((feature: any) => feature.enabled).map((feature: any) => feature.key));
      if (!existing) { setRate(String(detail.data.default_sale_rate)); setUnit(detail.data.primary_unit_id); }
    } catch (err) { setError(getApiErrorMessage(err)); }
  };
  useEffect(() => { void load(); }, [itemId]);
  const canChooseBase = item?.inventory_tracking === false && item?.base_unit_editable;
  const mode = canChooseBase ? sellingMode : item?.selling_mode;
  const measured = ['AREA', 'VOLUME'].includes(mode);
  const allowedUnits = item ? [item.primary_unit, ...item.unit_conversions.map((conversion: any) => conversion.from_unit)] : [];
  const dimensionUnit = canChooseBase ? baseChoice?.code : allowedUnits.find((choice: any) => choice.id === unit)?.code || item?.primary_unit.code;
  const dimensionMeasure = ['SQFT', 'CFT'].includes(dimensionUnit || '') ? 'feet' : dimensionUnit === 'SQIN' ? 'inches' : ['SQM', 'CBM'].includes(dimensionUnit || '') ? 'metres' : `the measure represented by ${dimensionUnit}`;
  const warning=stockWarning(item,{quantity:Number(quantity),unit_id:unit,variant_id:variant,batch_id:batch,dimensions:measured?dimensions:undefined},useBillStore.getState().items.filter(l=>l.item_id===itemId&&l.row_id!==existing?.row_id));
  const unitRate=(unitId:string,variantId=variant)=>{const base=item.variants.find((v:any)=>v.id===variantId)?.default_sale_rate??item.default_sale_rate;const conversion=item.unit_conversions.find((c:any)=>c.from_unit_id===unitId);return String(conversion?.selling_price??(Number(base)*Number(conversion?.conversion_factor||1)));};
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (saving) return; setError('');
    const groups = item.modifier_groups || [];
    if (groups.some((group: any) => { const count = group.options.filter((option: any) => modifiers.includes(option.id)).length; return count < group.min_select || count > group.max_select; })) {
      setError('Choose the required options for each group.'); return;
    }
    if (mode === 'PIECE' && item.item_type !== 'SERVICE' && !Number.isInteger(Number(quantity))) { setError('Use whole pieces or choose a measured selling mode.'); return; }
    setSaving(true);
    try {
      let selectedUnit = allowedUnits.find((choice: any) => choice.id === unit) || item.primary_unit;
      if (canChooseBase && baseChoice && (baseChoice.code !== item.primary_unit.code || sellingMode !== item.selling_mode)) {
        await api.post('/retail/items/' + item.id, { unit_code: baseChoice.code, unit_name: baseChoice.name, selling_mode: sellingMode });
        const updated = (await api.get('/retail/items/' + item.id + '/options')).data;
        selectedUnit = updated.primary_unit;
        const store = useBillStore.getState();
        store.items.filter(line => line.item_id === item.id && line.row_id !== existing?.row_id).forEach(line => store.putLine({ ...line, unit: selectedUnit.code, unit_id: selectedUnit.id }));
      }
      const delta = groups.flatMap((group: any) => group.options).filter((option: any) => modifiers.includes(option.id)).reduce((sum: number, option: any) => sum + Number(option.price_delta), 0);
      useBillStore.getState().putLine({ row_id: existing?.row_id, item_id: item.id,
        name: item.name + (variant ? ' · ' + (item.variants.find((choice: any) => choice.id === variant)?.name || 'Variant') : ''),
        rate: Number(rate), quantity: Number(quantity), discount_amount: Number(discount), unit: selectedUnit.code, unit_id: selectedUnit.id,
        variant_id: variant || undefined, batch_id: batch || undefined, serial_ids: serials.length ? serials : undefined,
        modifier_option_ids: modifiers, modifier_unit_delta: delta, dimensions: measured ? dimensions : undefined, gst_rate:Number(gst),tax_rate:Number(gst), total: 0 });
      close();
    } catch (err) { setError(getApiErrorMessage(err)); } finally { setSaving(false); }
  };
  return <Sheet open onClose={() => { if (!saving) close(); }} title={item?.name || ui("Item details")}>
    {error && <p role="alert">{error}{!item && <button className="r-btn" onClick={load}>{ui("Try Again")}</button>}</p>}
    {!item && !error && <p role="status">Loading item options…</p>}
    {item && <form onSubmit={save}><fieldset className="r-fieldset" disabled={saving}>
      {item.is_bundle && <div className="r-card"><h3>Included in this kit</h3>{item.bundle_components.length ? item.bundle_components.map((component: any) => <p key={component.id}>{component.component_item.name} × {Number(component.quantity)}</p>) : <p role="alert">Set up the bundle components in Item Details before billing.</p>}</div>}
      {(item.modifier_groups || []).map((group: any) => <fieldset key={group.id} className="r-fieldset"><legend>{group.name} · choose {group.min_select}–{group.max_select}</legend>{group.options.map((option: any) => <label className="r-list-item" key={option.id}><input type="checkbox" checked={modifiers.includes(option.id)} onChange={event => setModifiers(event.target.checked ? [...modifiers, option.id] : modifiers.filter(id => id !== option.id))} />{option.name} · {Number(option.price_delta) >= 0 ? '+' : ''}₹{Number(option.price_delta)}</label>)}</fieldset>)}
      {item.has_variants && <><label htmlFor="line-variant">Variant</label><MobileSelect id="line-variant" required value={variant} onChange={event => { setVariant(event.target.value); setRate(unitRate(unit,event.target.value)); setSerials([]); }}><option value="">Select variant</option>{item.variants.map((choice: any) => <option key={choice.id} value={choice.id}>{Object.values(choice.attributes || {}).join(' / ') || choice.sku}</option>)}</MobileSelect></>}
      <label htmlFor="line-unit">{ui("Unit")}</label>
      {canChooseBase && baseChoice ? <>
        <UnitPicker id="line-unit" value={baseChoice.code} disabled={saving} allowedModes={['PIECE', ...features]} onChange={choice => {
          setBaseChoice(choice); setSellingMode(choice.selling_mode && features.includes(choice.selling_mode) ? choice.selling_mode : 'PIECE'); setDimensions({});
        }} />
        <label htmlFor="line-selling-mode">{ui("Sold by")}</label>
        <MobileSelect id="line-selling-mode" value={sellingMode} onChange={event => { setSellingMode(event.target.value); setDimensions({}); }}>
          <option value="PIECE">{ui("Whole pieces / packs")}</option>{['WEIGHT', 'LENGTH', 'AREA', 'VOLUME'].filter(feature => features.includes(feature)).map(feature => <option key={feature} value={feature}>{sellingModeLabel(feature, baseChoice.code)}</option>)}
        </MobileSelect>
        <p className="r-caption">Choose the base unit before this item's first saved bill or purchase. Stock remains uncounted until you receive it.</p>
      </> : <>
        <MobileSelect id="line-unit" value={unit} onChange={event => {setUnit(event.target.value);setRate(unitRate(event.target.value));}}>{allowedUnits.map((choice: any) => <option key={choice.id} value={choice.id}>{unitLabel(choice)} · ₹{unitRate(choice.id)}</option>)}</MobileSelect>
        {allowedUnits.length === 1 && <p className="r-caption">This item's base unit is {unitLabel(item.primary_unit)}. Add selling packs in Item Details → Units &amp; packs.</p>}
      </>}
      <label htmlFor="line-quantity">{mode === 'WEIGHT' ? ['LTR', 'ML'].includes(baseChoice?.code || item.primary_unit.code) ? ui("Volume / quantity") : ui("Weight / quantity") : mode === 'LENGTH' ? ui("Length / quantity") : ui("Quantity")}</label>
      <input id="line-quantity" className="r-input" type="number" enterKeyHint="done" onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();event.currentTarget.form?.requestSubmit();}}} min={mode === 'PIECE' && item.item_type !== 'SERVICE' ? 1 : .000001} step={mode === 'PIECE' && item.item_type !== 'SERVICE' ? '1' : 'any'} value={quantity} onChange={event => setQuantity(event.target.value)} required inputMode="decimal" />
      {measured && <><p className="r-caption">Enter dimensions in {dimensionMeasure}. Quantity is the number of pieces.</p><div className="r-form-grid">{(mode === 'AREA' ? ['length', 'width'] : ['length', 'width', 'height']).map(key => <div key={key}><label htmlFor={'line-' + key}>{key[0].toUpperCase() + key.slice(1)}</label><input id={'line-' + key} className="r-input" type="number" min=".000001" step="any" value={dimensions[key] || ''} onChange={event => setDimensions({ ...dimensions, [key]: Number(event.target.value) })} required inputMode="decimal" /></div>)}</div></>}
      {warning&&<p role="alert" className="r-text-danger">{warning}</p>}
      <label htmlFor="line-rate">{ui("Rate (₹ per selected unit)")}</label><input id="line-rate" className="r-input" type="number" enterKeyHint="done" onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();event.currentTarget.form?.requestSubmit();}}} min="0" step="any" value={rate} onChange={event => setRate(event.target.value)} required inputMode="decimal" /><p className="r-caption">Tax Exclusive · selling price before GST{Number(gst)>0?' ('+gst+'%)':''}.</p>
      <label htmlFor="line-gst">GST %</label><input id="line-gst" className="r-input" type="number" inputMode="decimal" min="0" max="100" step=".01" value={gst} onChange={e=>setGst(e.target.value)}/>
      <label htmlFor="line-discount">{ui("Line Discount (₹)")}</label><input id="line-discount" className="r-input" type="number" min="0" step="any" value={discount} onChange={event => setDiscount(event.target.value)} inputMode="decimal" />
      {item.track_batch && <><label htmlFor="line-batch">Batch</label><MobileSelect id="line-batch" value={batch} onChange={event => setBatch(event.target.value)}><option value="">Automatic FEFO</option>{item.batches.map((choice: any) => <option key={choice.id} value={choice.id}>{choice.batch_number} {choice.expiry_date ? ' · Exp ' + choice.expiry_date.slice(0, 10) : ''}</option>)}</MobileSelect></>}
      {item.track_serial && <fieldset className="r-fieldset"><legend>Serial numbers · selected {serials.length}</legend>{item.serials.filter((serial: any) => serial.status === 'AVAILABLE' && (!variant || serial.variant_id === variant)).map((serial: any) => <label className="r-list-item" key={serial.id}><input type="checkbox" checked={serials.includes(serial.id)} onChange={event => setSerials(event.target.checked ? [...serials, serial.id] : serials.filter(id => id !== serial.id))} />{serial.serial_number}</label>)}</fieldset>}
      <p className="r-caption">Availability, pricing and tax are checked when you complete the bill.</p>
      <button className="r-btn r-btn--primary r-w-full" disabled={saving || item.track_serial && serials.length !== Number(quantity)}>{saving ? ui("Saving…") : ui("Save Line")}</button>
    </fieldset></form>}
  </Sheet>;
}
