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
import { useState } from "react";
import { useRetailEntitlements } from './subscription/useRetailEntitlements';
import {useBillingPreferences} from './settings/useBillingPreferences';
import { useNavigate } from "react-router-dom";
import { itemApi } from "./retailApi";
import { getApiErrorMessage } from "../shared/api";
import { useOptionalPhotoUpload } from '../shared/useOptionalPhotoUpload';
import { AttachmentPicker } from '../shared/components/AttachmentPicker';
import {
  ChevronDown,
  Check,
  Package,
  Boxes,
  SlidersHorizontal,
  ShoppingCart,
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
  const [showAdvanced, setShowAdvanced] = useState(false);
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
  const access=useRetailEntitlements();
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

    setSaving(true);

    setError("");
    let itemId = savedItemId;
    try {
      if (!itemId) {
      const response = await itemApi.createItem({
        name: name.trim(),
        selling_price: Number(sellingPrice),
        opening_stock: tracked ? 0 : Number(openingStock) || 0,
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
      itemId = response.data.data.id;
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
      <section className="r-stitch-entry-intro"><span className="r-ledger-icon"><ShoppingCart size={24}/></span><div><strong>{ui('Counter Fast-Entry')}</strong><small>{ui('Quick setup for instant billing')}</small></div><span className="r-badge">{ui('Step 1 of 1')}</span></section>
      {error&&<p className="r-state-message" role="alert">{photoUpload.failed ? ui('Item saved. Photo upload failed. Retry or continue without the photo.') + ' ' : ''}{error}</p>}
      <fieldset className="r-fieldset" disabled={saving||!!savedItemId}>
        <section className="r-card r-stitch-quick-entry"><h2>{ui('Quick Item Entry')}<span className="r-dot"/></h2><p className="r-caption">{ui('Enter essential details to bill.')}</p>
          <div className="r-input-group">
              <label className="r-label" htmlFor="item-name-input">{ui("Item Name *")}</label>
              <input
                id="item-name-input"
                className="r-input"
                placeholder="e.g. Dairy Milk Silk"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
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
          <div className="r-stitch-unit-choices"><label>{ui('Unit')} *</label><div>{[['KG','Kilogram','WEIGHT'],['POUCH','Pouch','PIECE'],['PCS','Piece / Pcs','PIECE'],['LTR','Litre','WEIGHT'],['PKT','Packet','PIECE'],['BOX','Box','PIECE']].filter(([, ,m])=>m==='PIECE'||features.includes(m)).map(([code,label,mode])=><button type="button" key={code} aria-pressed={unit===code} className={unit===code?'active':''} onClick={()=>{setUnit(code);setUnitName(label);if(kind==='STOCK'&&!serial)setSellingMode(mode);}}>{ui(label)}</button>)}</div></div>
          <div className="r-input-group">
              <label className="r-label" htmlFor="item-unit">{ui("Unit")}</label>
              <UnitPicker id="item-unit" value={unit} allowedModes={kind === 'SERVICE' ? undefined : serial ? ['PIECE'] : ['PIECE', ...features]} onChange={choice => {
                setUnit(choice.code); setUnitName(choice.name);
                if (kind === 'STOCK' && !serial && choice.selling_mode && (choice.selling_mode==='PIECE'||features.includes(choice.selling_mode))) setSellingMode(choice.selling_mode);
              }} />
            </div>
          <div className="r-input-group">
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

          <button type="button" className="r-btn r-btn--primary r-w-full" disabled={!name.trim()||!sellingPrice||saving} onClick={handleSave}><Check size={22}/>{ui('Save Item')}</button>
        </section>
        <button type="button" className="r-stitch-disclosure" id="more-details-toggle" aria-expanded={showAdvanced} aria-controls="item-advanced-fields" onClick={()=>setShowAdvanced(!showAdvanced)}><span className="r-ledger-icon"><SlidersHorizontal size={24}/></span><span><strong>{ui('More Details')}</strong><small>{ui(billingPrefs.enabled?'Purchase price, MRP, Barcode, Tax & HSN':'Purchase price, MRP, Tax & HSN')}</small></span><ChevronDown size={22}/></button>
        {showAdvanced&&<section id="item-advanced-fields" className="r-card"><h2>{ui('More Details')}</h2><div className="r-input-group">
              <ItemCategoryPicker value={category} onChange={setCategory} />
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
        <button type="button" className="r-stitch-disclosure" aria-expanded={showAdvanced} onClick={()=>setShowAdvanced(!showAdvanced)}><span className="r-ledger-icon"><Boxes size={24}/></span><span><strong>{ui('Advanced Item Features')}</strong><small>{ui('Variants, Batch, Expiry, Serial')}</small></span><ChevronDown size={22}/></button>
        {showAdvanced&&<section className="r-card"><label htmlFor="item-kind">Item type</label>
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
                    {features.includes("VARIANTS") && (
                      <label className="r-list-item">
                        <input
                          type="checkbox"
                          checked={variants}
                          onChange={(e) => {
                            setVariants(e.target.checked);
                            setOpeningStock("");
                          }}
                        />
                        Variants (size, colour or other choices)
                      </label>
                    )}
                    {features.includes("BATCH_TRACKING") && (
                      <label className="r-list-item">
                        <input
                          type="checkbox"
                          checked={batch}
                          onChange={(e) => {
                            setBatch(e.target.checked);
                            setOpeningStock("");
                          }}
                        />
                        Batch & expiry tracking
                      </label>
                    )}
                    {features.includes("SERIAL_TRACKING") && (
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
      {access.isFeatureEffective('ITEM_IMAGES')&&<details id="item-photo-picker" className="r-card r-stitch-photo"><summary><Package size={22}/>{ui('Item photo')} · {ui('optional')}</summary><AttachmentPicker label="Item photo" imageLabel="item" disabled={saving} onFileSelect={photoUpload.select}/></details>}
      {photoUpload.failed&&<button type="button" className="r-btn r-btn--outline r-w-full" disabled={saving} onClick={finishSave}>{ui('Continue without photo')}</button>}
    </main>
    <div className="r-sticky-footer r-stitch-two-actions"><button className="r-btn r-btn--secondary" disabled={saving} onClick={()=>navigate('/retail/items')}>{ui('Cancel')}</button><button className="r-btn r-btn--primary-lg" disabled={!name.trim()||!sellingPrice||saving} onClick={handleSave} id="save-item-btn"><Check size={22}/>{saving?ui('Saving…'):photoUpload.failed?ui('Retry Photo Upload'):ui('SAVE ITEM')}</button></div>
  </div>;
};
export default RetailAddItem;
