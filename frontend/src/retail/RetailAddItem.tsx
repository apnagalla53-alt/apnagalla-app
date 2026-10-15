import api from '../shared/api';
import { RecommendationCard } from './experience/ExperienceComponents';
import { categorySuggestion } from './experience/categorySuggestion';
import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
import ItemCategoryPicker from "./components/ItemCategoryPicker";
import UnitPicker, { sellingModeLabel } from './components/UnitPicker';
import { MobileSelect } from "./components/MobileControls";
/**
 * EVOLIX Retail V1 — Quick Add Item
 *
 * Extremely simple form by default: Item Name, Selling Price, Opening Stock
 * "More Details" expands to advanced fields.
 */
import { useState,useEffect,useRef } from "react";
import {useBusinessPreset} from './experience/useBusinessPreset';
import { useRetailEntitlements } from './subscription/useRetailEntitlements';
import {useBillingPreferences} from './settings/useBillingPreferences';
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../shared/api";
import { useOptionalPhotoUpload } from '../shared/useOptionalPhotoUpload';
import { AttachmentPicker } from '../shared/components/AttachmentPicker';
import {
  ChevronDown,
  Check,
  Package,
  Boxes,
  SlidersHorizontal,
  ArrowRight,
  Minus,
  Plus,
} from "lucide-react";


const RetailAddItem = () => {
  useUiLanguage();
  const navigate = useNavigate();
  const billingPrefs=useBillingPreferences();

  // Default fields
  const [name, setName] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [openingStock, setOpeningStock] = useState("");
  const [openingCost,setOpeningCost]=useState('');
  const [skipOpeningCost,setSkipOpeningCost]=useState(false);

  // Advanced fields
  const [showAdvanced, setShowAdvanced] = useState(false),[showCapabilities,setShowCapabilities]=useState(false),[allCapabilities,setAllCapabilities]=useState(false),[trackStock,setTrackStock]=useState(false);
  const unitTouched=useRef(false),categoryTouched=useRef(false);
  const [buyUnit,setBuyUnit]=useState<{code:string;name:string}|null>(null),[packQuantity,setPackQuantity]=useState(''),[packSellingPrice,setPackSellingPrice]=useState('');
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("PCS");
  const [unitName, setUnitName] = useState('');
  const [purchasePrice, setPurchasePrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [gstRate, setGstRate] = useState("");
  const [customGstRate, setCustomGstRate] = useState(false);
  const [hsn, setHsn] = useState("");
  const [lowStockAlert, setLowStockAlert] = useState("");
  const [kind, setKind] = useState("STOCK"),
    [sellingMode, setSellingMode] = useState("PIECE"),
    [batch, setBatch] = useState(false),
    [serial, setSerial] = useState(false),
    [variants, setVariants] = useState(false),
    [warranty, setWarranty] = useState("0");
  const access=useRetailEntitlements(),preset=useBusinessPreset(category);
  const recommended=(code:string)=>allCapabilities||preset.recommendedCapabilities.includes(code)||preset.categoryCapabilities.includes(code);
  useEffect(()=>{if(unitTouched.current)return;const suggested=preset.recommendedUnits.map(code=>preset.unitSuggestions.find(u=>u.code===code)).find(u=>u&&(u.selling_mode==='PIECE'||access.isFeatureEffective(u.selling_mode)));if(suggested){setUnit(suggested.code);setUnitName(suggested.name);setSellingMode(suggested.selling_mode);}},[preset.key,preset.recommendedUnits.join(','),access.data]);
  useEffect(()=>{if(categoryTouched.current)return;setCategory(categorySuggestion(name,preset.recommendedCategories)||'');},[name,preset.key]);
  const features=access.data?.entitlements.features.filter(f=>f.enabled).map(f=>f.code)||[];
  const tracked = kind !== "STOCK" || batch || serial || variants;

  // Save state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const photoUpload = useOptionalPhotoUpload();
  const [savedItemId, setSavedItemId] = useState('');

  const finishSave = () => {
    setSaved(true);
    if(!variants)setTimeout(() => navigate('/retail/items'), 700);
  };

  const handleSave = async () => {
    if (saving || saved || !name.trim() || !sellingPrice) return;

    if(kind==='STOCK'&&access.isFeatureEffective('MULTI_UNIT')&&buyUnit&&buyUnit.code!==unit&&(!Number.isFinite(Number(packQuantity))||Number(packQuantity)<=0)){setError(ui('Enter how many selling units are in one purchase unit.'));return;}
    if(trackStock&&!tracked&&openingStock===''){setError(ui('Enter your counted stock, or leave stock setup for later.'));return;}
    setSaving(true);

    setError("");
    let itemId = savedItemId;
    try {
      if (!itemId) {
      const response = await api.post('/retail/items/inline',{
        name: name.trim(),
        ...(buyUnit&&buyUnit.code!==unit&&kind==='STOCK'&&access.isFeatureEffective('MULTI_UNIT')?{purchase_unit_code:buyUnit.code,purchase_unit_factor:Number(packQuantity),...(packSellingPrice!==''?{purchase_unit_selling_price:Number(packSellingPrice)}:{})}:{}),
        selling_price: Number(sellingPrice),
        inventory_tracking:tracked||trackStock,
        ...(trackStock&&!tracked?{opening_stock:Number(openingStock)||0}:{}),
        skip_opening_cost:skipOpeningCost,
        ...(Number(openingStock)>0&&!tracked&&openingCost!==''?{opening_cost:Number(openingCost)}:{}),
        selling_mode: kind === "SERVICE" ? "SERVICE" : sellingMode,
        is_bundle: kind === "BUNDLE",
        has_variants: kind === "STOCK" && variants,
        track_batch: kind === "STOCK" && batch,
        track_serial: kind === "STOCK" && serial,
        warranty_days: serial ? Number(warranty) : undefined,
        ...(sku && { sku }),
        ...(barcode && { barcode }),
        ...(category && { category }),
        ...(purchasePrice && { purchase_price: Number(purchasePrice) }),
        ...(mrp && { mrp: Number(mrp) }),
        ...(hsn && { hsn_sac: hsn }),
        ...(lowStockAlert && { low_stock_threshold: Number(lowStockAlert) }),
        unit_code: unit,
        ...(unitName && { unit_name: unitName }),
        ...(description.trim() && {
          custom_attributes: { description: description.trim() },
        }),
        ...(gstRate !== "" && { gst_rate: Number(gstRate) }),
      });
      itemId = response.data.id;
      setSavedItemId(itemId);
      }
      await photoUpload.upload('ITEM', itemId, 'ITEM_IMAGE');
      finishSave();
    } catch (error) {
      setError(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="r-success-screen" style={{ minHeight: "60vh" }}>
        <div className="r-success-icon">
          <Check strokeWidth={3} />
        </div>
        <div
          style={{
            fontSize: "var(--r-text-xl)",
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          Item Saved!
        </div>
        <div style={{ color: "var(--r-text-muted)" }}>{name}</div>
        {variants&&<div className="r-card"><h2>Item created successfully.</h2><p>Next: configure each size/colour, then receive stock for each variant.</p><button className="r-btn r-btn--outline" onClick={()=>navigate('/retail/items/'+savedItemId)}>Set up variants</button><button className="r-btn r-btn--primary" onClick={()=>navigate('/retail/purchases/new?item='+savedItemId)}>Buy Stock</button><button className="r-btn" onClick={()=>navigate('/retail/items')}>Back to Items</button></div>}
      </div>
    );
  }

  return <div className="r-page-with-sticky r-item-form r-stitch-item-form">
    <StitchHeader><h1>{ui('Add Item')}</h1></StitchHeader>
    <main className="r-section">
      <RecommendationCard title={ui('Recommended for')+' '+ui(preset.displayName)} description="We've suggested settings for your shop. You can change them."/>
      {error&&<p className="r-state-message" role="alert">{photoUpload.failed ? ui('Item saved. Photo upload failed. Retry or continue without the photo.') + ' ' : ''}{error}</p>}
      <fieldset className="r-fieldset" disabled={saving||!!savedItemId}>
        <section className="r-card r-stitch-quick-entry">
          <div className="r-input-group">
              <label className="r-label" htmlFor="item-name-input">{ui("Item Name *")}</label>
              <input
                id="item-name-input"
                className="r-input"
                placeholder={ui("e.g. Item sold in your shop")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div><div className="r-input-group">
              <label className="r-label" htmlFor="selling-price-input">
                Selling Price (₹) *
              </label>
              <input
                id="selling-price-input"
                className="r-input r-input--lg"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                required
              />
              <p className="r-caption">Selling price before GST · Tax Exclusive. GST is added using this item's saved tax rate.</p>
            </div>

          <div className="r-input-group xp-unit-section">
              <label className="r-label" htmlFor="item-unit">{ui('How do you sell it?')}</label><small>{ui('To customers')}</small>
              <UnitPicker id="item-unit" title="How do you sell it?" category={category} value={unit} allowedModes={kind === 'SERVICE' ? undefined : serial ? ['PIECE'] : ['PIECE', ...features]} onChange={choice => {
                unitTouched.current=true;setUnit(choice.code); setUnitName(choice.name);
                if (kind === 'STOCK' && !serial && choice.selling_mode && (choice.selling_mode==='PIECE'||features.includes(choice.selling_mode))) setSellingMode(choice.selling_mode);
              }} />
            </div>
          {kind==='STOCK'&&access.isFeatureEffective('MULTI_UNIT')&&<section className="xp-unit-section"><label htmlFor="item-buy-unit">{ui('How do you buy it?')}</label><small>{ui('From supplier')}</small><UnitPicker id="item-buy-unit" title="How do you buy it?" category={category} value={buyUnit?.code||unit} allowedModes={serial?['PIECE']:['PIECE',...features]} onChange={choice=>setBuyUnit(choice)}/>{buyUnit&&buyUnit.code!==unit&&<div className="xp-conversion"><label htmlFor="item-pack-quantity">{ui('How many')} {unitName||unit} {ui('in 1')} {buyUnit.name}?</label><div className="xp-conversion-stepper"><button type="button" aria-label={ui('Decrease pack quantity')} disabled={Number(packQuantity)<=1} onClick={()=>setPackQuantity(String(Math.max(1,Number(packQuantity)-1)))}><Minus size={18}/></button><input id="item-pack-quantity" className="r-input" inputMode="decimal" type="number" min="0.000001" step="any" value={packQuantity} onChange={e=>setPackQuantity(e.target.value)}/><button type="button" aria-label={ui('Increase pack quantity')} onClick={()=>setPackQuantity(String(Number(packQuantity)+1))}><Plus size={18}/></button></div><label htmlFor="item-pack-selling-price">Selling price per {buyUnit.name} · optional</label><input id="item-pack-selling-price" className="r-input" type="number" min="0" step=".01" value={packSellingPrice} onChange={e=>setPackSellingPrice(e.target.value)}/><p className="xp-unit-hint">{ui('Helps keep stock and purchase costs correct.')}</p></div>}</section>}
          {['CLOTHING','FOOTWEAR'].includes(preset.family)&&<section className="r-card"><p id="item-size-question">{ui(preset.itemPrompts.variants)}</p><div className="r-form-grid" role="group" aria-labelledby="item-size-question"><button type="button" className="r-btn r-btn--outline" aria-pressed={!variants} onClick={()=>{setVariants(false);setOpeningStock('');}}>{ui('No')}</button><button type="button" className="r-btn r-btn--outline" disabled={!access.isFeatureEffective('VARIANTS')} aria-pressed={variants} onClick={()=>{setVariants(true);setOpeningStock('');}}>{ui('Yes')}</button></div><p className="r-caption">{access.isFeatureEffective('VARIANTS')?ui('Choose Yes only for items sold in different sizes or colours.'):ui('Sizes and colours require a plan with this feature.')}</p></section>}
          {preset.family==='PHARMACY'&&<section className="r-card"><label className="r-toggle-row"><input type="checkbox" disabled={!access.isFeatureEffective('BATCH_TRACKING')} checked={batch} onChange={e=>{setBatch(e.target.checked);setOpeningStock('');}}/>{ui('Track Batch & Expiry?')}</label>{!access.isFeatureEffective('BATCH_TRACKING')&&<p className="r-caption">{ui('Your current plan does not include batch and expiry tracking.')}</p>}</section>}
          {preset.family==='ELECTRONICS'&&<section className="r-card"><label className="r-toggle-row"><input type="checkbox" disabled={!access.isFeatureEffective('SERIAL_TRACKING')} checked={serial} onChange={e=>{setSerial(e.target.checked);setUnit('PCS');setSellingMode('PIECE');setOpeningStock('');}}/>{ui('Track serial numbers and warranty?')}</label>{serial&&<label>Warranty in days<input className="r-input" type="number" min="0" max="36500" value={warranty} onChange={e=>setWarranty(e.target.value)}/></label>}{!access.isFeatureEffective('SERIAL_TRACKING')&&<p className="r-caption">{ui('Serial and warranty tracking require a plan with this feature.')}</p>}</section>}
          {preset.family==='EATERY'&&access.isFeatureEffective('MODIFIERS')&&<p className="xp-unit-hint">Any options or add-ons? You can add sugar choices or extras in Item Details after saving.</p>}
          <label className="r-toggle-row"><input type="checkbox" checked={trackStock||tracked} disabled={tracked} onChange={e=>{setTrackStock(e.target.checked);if(!e.target.checked){setOpeningStock('');setOpeningCost('');}}}/>{ui('I want to count stock for this item')}</label>
          {(trackStock||tracked)&&<>          <div className="r-input-group">
              <label className="r-label" htmlFor="opening-stock-input">{ui("Opening Stock")} <span className="r-caption">optional</span>
              </label>
              <input
                id="opening-stock-input"
                className="r-input"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="0"
                value={openingStock}
                onChange={(e) => setOpeningStock(e.target.value)}
                disabled={tracked}
                aria-describedby="opening-stock-help"
              />
              <p id="opening-stock-help" className="r-caption">
                {tracked
                  ? kind === "SERVICE"
                    ? "Services do not use physical stock."
                    : kind === "BUNDLE"
                      ? "Stock comes from the configured components."
                      : variants ? "Variant stock is received separately so each size/colour has its own correct quantity." : "Use Buy Stock to receive exact batches or serial numbers."
                  : "You can receive more stock later through Buy Stock."}
              </p>
            </div>
          {Number(openingStock)>0&&!tracked&&<div className="r-input-group"><label className="r-label" htmlFor="opening-cost-input">Opening purchase cost · optional</label><p className="r-caption">Aapne ye opening stock lagbhag kitne mein kharida tha?</p><input id="opening-cost-input" className="r-input" type="number" inputMode="decimal" min="0" step="any" placeholder={'₹ per '+unit} value={openingCost} onChange={e=>{setOpeningCost(e.target.value);setSkipOpeningCost(false);}}/><button type="button" className="r-btn r-btn--secondary" onClick={()=>{setOpeningCost('');setSkipOpeningCost(true);}}>Skip for Now</button>{skipOpeningCost&&<p className="r-caption">Stock can be used. Profit will show missing cost until you confirm it.</p>}</div>}

</>}
          {!trackStock&&!tracked&&<p className="xp-muted">{ui('Stock not set up yet. You can sell this item now and receive stock later.')}</p>}

        </section>
        <button type="button" className="r-stitch-disclosure" id="more-details-toggle" aria-expanded={showAdvanced} aria-controls="item-advanced-fields" onClick={()=>setShowAdvanced(!showAdvanced)}><span className="r-ledger-icon"><SlidersHorizontal size={24}/></span><span><strong>{ui('Additional Details')}</strong><small>{ui('Optional · cost, MRP, tax and more')}</small></span><ChevronDown size={22}/></button>
        {showAdvanced&&<section id="item-advanced-fields" className="r-card"><h2>{ui('Additional Details')}</h2>          <div className="r-input-group"><ItemCategoryPicker value={category} onChange={v=>{categoryTouched.current=true;setCategory(v);}}/>{category&&!categoryTouched.current&&<p className="xp-unit-hint">{ui('Auto-suggested from your item name. Change it if needed.')}</p>}</div><div className="r-input-group">

            </div><div className="r-form-columns">
              <div className="r-input-group">
                <label className="r-label" htmlFor="item-purchase-price">
                  Purchase Price (₹)
                </label>
                <input
                  id="item-purchase-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  className="r-input"
                  placeholder="0"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                />
              </div>
              <div className="r-input-group">
                <label className="r-label" htmlFor="item-mrp">
                  MRP (₹)
                </label>
                <input
                  id="item-mrp"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  className="r-input"
                  placeholder="0"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                />
              </div>
            </div><div className="r-input-group">
            <label htmlFor="item-description">{ui("Description")} <span className="r-caption">optional</span>
            </label>
            <textarea
              id="item-description"
              className="r-input"
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="r-input-group">
                  <label className="r-label" htmlFor="item-sku">{ui("SKU")}</label>
                  <input
                    id="item-sku"
                    className="r-input"
                    placeholder="Auto-generated if empty"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  />
                </div>{billingPrefs.enabled&&<div className="r-input-group">
                  <label className="r-label" htmlFor="item-barcode">{ui("Barcode")}</label>
                  <input
                    id="item-barcode"
                    className="r-input"
                    placeholder="Enter barcode"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                  />
                </div>}<div className="r-form-columns">
                  <div className="r-input-group">
                    <label className="r-label" htmlFor="item-gst">
                      GST Rate (%)
                    </label>
                    <MobileSelect
                      id="item-gst"
                      className="r-select"
                      value={customGstRate ? 'CUSTOM' : gstRate}
                      onChange={(e) => {
                        setCustomGstRate(e.target.value === 'CUSTOM');
                        setGstRate(e.target.value === 'CUSTOM' ? '' : e.target.value);
                      }}
                      presentation="segments"
                    >
                      <option value="">None</option>
                      {["0", "5", "12", "18", "28", "40"].map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}%
                        </option>
                      ))}
                      <option value="CUSTOM">{ui('Custom Rate')}</option>
                    </MobileSelect>
                    {customGstRate && <><label className="r-label" htmlFor="item-gst-custom">{ui('Custom GST Rate (%)')} *</label><input id="item-gst-custom" className="r-input" type="number" min="0" max="100" step="0.01" required value={gstRate} onChange={event=>setGstRate(event.target.value)}/></>}
                  </div>
                  <div className="r-input-group">
                    <label className="r-label" htmlFor="item-hsn">
                      HSN/SAC
                    </label>
                    <input
                      id="item-hsn"
                      className="r-input"
                      value={hsn}
                      onChange={(e) => setHsn(e.target.value)}
                    />
                  </div>
                </div><div className="r-input-group">
            <label className="r-label" htmlFor="low-stock-alert-input">
              Low Stock Alert
            </label>
            <input
              id="low-stock-alert-input"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              className="r-input"
              placeholder="10"
              value={lowStockAlert}
              onChange={(e) => setLowStockAlert(e.target.value)}
            />
          </div>
          </section>}
        {preset.recommendedCapabilities.filter(code=>!access.isFeatureEffective(code)).map(code=>{const feature=access.data?.entitlements.features.find(f=>f.code===code);return <p key={code} className="xp-unit-hint">{ui(feature?.name||code.replaceAll('_',' '))} · {feature?.plan_entitled?ui('Enable in Shop Features'):ui('Available with')+' '+(feature?.required_plan||'a higher plan')}</p>;})}
        <button type="button" className="r-stitch-disclosure" aria-expanded={showCapabilities} onClick={()=>setShowCapabilities(!showCapabilities)}><span className="r-ledger-icon"><Boxes size={24}/></span><span><strong>{ui('Advanced Item Features')}</strong><small>{ui('Options suggested for your shop')}</small></span><ChevronDown size={22}/></button>
        {showCapabilities&&<section className="r-card"><button type="button" className="r-btn r-btn--outline" aria-expanded={allCapabilities} onClick={()=>setAllCapabilities(v=>!v)}>{ui(allCapabilities?'Suggested options':'Other item options')}</button><label htmlFor="item-kind">Item type</label>
          <MobileSelect
            id="item-kind"
            className="r-select"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setSellingMode("PIECE");
              setBatch(false);
              setSerial(false);
              setVariants(false);
              setOpeningStock("");
            }}
            presentation="segments"
          >
            <option value="STOCK">{ui("Product")}</option>
            {features.includes("SERVICES") && (
              <option value="SERVICE">{ui("Service")}</option>
            )}
            {features.includes("BUNDLES") && (
              <option value="BUNDLE">Bundle / kit</option>
            )}
          </MobileSelect>

          {kind === "STOCK" && (
                  <>
                    <label htmlFor="selling-mode">{ui("Sold by")}</label>
                    <MobileSelect
                      id="selling-mode"
                      className="r-select"
                      value={sellingMode}
                      disabled={serial}
                      onChange={(e) => {
                        setSellingMode(e.target.value);
                        if(e.target.value!=='PIECE'&&e.target.value!==sellingMode){setUnitName('');setUnit(
                          (
                            {
                              WEIGHT: "KG",
                              LENGTH: "MTR",
                              AREA: "SQFT",
                              VOLUME: "CBM",
                            } as any
                          )[e.target.value] || "PCS",
                        );}
                      }}
                      presentation="segments"
                    >
                      <option value="PIECE">{ui("Pieces")}</option>
                      {["WEIGHT", "LENGTH", "AREA", "VOLUME"]
                        .filter((f) => features.includes(f))
                        .map((f) => (
                          <option key={f} value={f}>
                            {sellingModeLabel(f, unit)}
                          </option>
                        ))}
                    </MobileSelect>
                    {features.includes("VARIANTS") && recommended('VARIANTS') && !['CLOTHING','FOOTWEAR'].includes(preset.family) && (
                      <label className="r-list-item">
                        <input
                          type="checkbox"
                          checked={variants}
                          onChange={(e) => {
                            setVariants(e.target.checked);
                            setOpeningStock("");
                          }}
                        />
                        {ui(preset.itemPrompts.variants)}
                      </label>
                    )}
                    {features.includes("BATCH_TRACKING") && recommended('BATCH_TRACKING') && preset.family!=='PHARMACY' && (
                      <label className="r-list-item">
                        <input
                          type="checkbox"
                          checked={batch}
                          onChange={(e) => {
                            setBatch(e.target.checked);
                            setOpeningStock("");
                          }}
                        />
                        {ui(preset.itemPrompts.batch)}
                      </label>
                    )}
                    {features.includes("SERIAL_TRACKING") && recommended('SERIAL_TRACKING') && preset.family!=='ELECTRONICS' && (
                      <>
                        <label className="r-list-item">
                          <input
                            type="checkbox"
                            checked={serial}
                            onChange={(e) => {
                              setSerial(e.target.checked);
                              setSellingMode("PIECE");
                              setUnit("PCS");
                              setUnitName('');
                              setOpeningStock("");
                            }}
                          />
                          Serial numbers & warranty
                        </label>
                        {serial && (
                          <>
                            <label htmlFor="warranty-days">
                              Warranty in days
                            </label>
                            <input
                              id="warranty-days"
                              className="r-input"
                              type="number"
                              min="0"
                              max="36500"
                              step="1"
                              value={warranty}
                              onChange={(e) => setWarranty(e.target.value)}
                            />
                          </>
                        )}
                      </>
                    )}
                  </>
                )}<p className="r-caption">
                  After saving, open Item Details to configure variants, units,
                  bundle contents or choices.
                </p></section>}
      </fieldset>
      {showAdvanced&&access.isFeatureEffective('ITEM_IMAGES')&&<details id="item-photo-picker" className="r-card r-stitch-photo"><summary><Package size={22}/>{ui('Item photo')} · {ui('optional')}</summary><AttachmentPicker label="Item photo" imageLabel="item" disabled={saving} onFileSelect={photoUpload.select}/></details>}
      {photoUpload.failed&&<button type="button" className="r-btn r-btn--outline r-w-full" disabled={saving} onClick={finishSave}>{ui('Continue without photo')}</button>}
    </main>
    <div className="r-sticky-footer r-stitch-two-actions"><button className="r-btn r-btn--secondary" disabled={saving} onClick={()=>navigate('/retail/items')}>{ui('Cancel')}</button><button className="r-btn r-btn--primary-lg" disabled={!name.trim()||!sellingPrice||saving} onClick={handleSave} id="save-item-btn">{saving?ui('Saving…'):photoUpload.failed?ui('Retry Photo Upload'):ui('Save Item')}<ArrowRight size={20}/></button></div>
  </div>;
};
export default RetailAddItem;
