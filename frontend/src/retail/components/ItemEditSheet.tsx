import { useEffect, useState, useRef } from "react";
import api, { getApiErrorMessage } from "../../shared/api";
import { ui } from "../../i18n";
import { Sheet, LoadingState } from "./MobileControls";
import UnitPicker from "./UnitPicker";
import { useBillingPreferences } from "../settings/useBillingPreferences";
import { AttachmentPicker } from "../../shared/components/AttachmentPicker";
import { useOptionalPhotoUpload } from "../../shared/useOptionalPhotoUpload";
export default function ItemEditSheet({
  id,
  onClose,
  onSaved,
}: {
  id: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [item, setItem] = useState<any>(),
    [form, setForm] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  const prefs = useBillingPreferences(),
    photo = useOptionalPhotoUpload(),
    lock = useRef(false),
    [recordSaved, setRecordSaved] = useState(false);
  useEffect(() => {
    let active = true;
    api
      .get("/retail/items/" + id + "/options")
      .then((r) => {
        if (!active) return;
        const i = r.data;
        setItem(i);
        setForm({
          name: i.name,
          sku: i.sku,
          selling_price: String(i.default_sale_rate),
          purchase_price: String(i.purchase_rate),
          mrp: String(i.mrp),
          category: i.category || "",
          gst_rate: String(i.tax_rate || 0),
          hsn_sac: i.hsn_sac || "",
          low_stock_threshold: String(i.low_stock_threshold),
          unit_code: i.primary_unit.code,
          unit_name: i.primary_unit.name,
          barcode: i.barcodes?.[0]?.barcode || "",
          description: i.custom_attributes?.description || "",
        });
        setError("");
      })
      .catch((e) => {
        if (active) setError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, retry]);
  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (!recordSaved) {
        const payload: any = {
          name: form.name.trim(),
          sku: form.sku.trim(),
          selling_price: Number(form.selling_price),
          purchase_price: Number(form.purchase_price),
          mrp: Number(form.mrp),
          category: form.category,
          gst_rate: Number(form.gst_rate),
          hsn_sac: form.hsn_sac,
          low_stock_threshold: Number(form.low_stock_threshold),
          custom_attributes: {
            ...(item.custom_attributes || {}),
            description: form.description,
          },
        };
        if (prefs.enabled) payload.barcode = form.barcode;
        if (item.base_unit_editable) {
          payload.unit_code = form.unit_code;
          payload.unit_name = form.unit_name;
        }
        await api.post("/retail/items/" + id, payload);
        setRecordSaved(true);
      }
      await photo.upload("ITEM", id, "ITEM_IMAGE");
      onSaved();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const field = (key: string, label: string, type = "text") => (
    <label className="r-field" key={key}>
      {ui(label)}
      <input
        className="r-input"
        type={type}
        min={type === "number" ? 0 : undefined}
        step="any"
        max={key === "gst_rate" ? 100 : undefined}
        required={["name", "sku", "selling_price"].includes(key)}
        value={form[key] || ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <Sheet open title={ui("Edit Item")} onClose={() => !busy && onClose()}>
      {loading ? (
        <LoadingState label="Loading item…" />
      ) : item ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset className="r-fieldset" disabled={busy || recordSaved}>
            {field("name", "Item Name *")}
            {field("selling_price", "Selling Price (₹)", "number")}
            <p className="r-caption">Selling price before GST · Tax Exclusive.</p>
            <label htmlFor="edit-item-unit">{ui("Unit")}</label>
            <UnitPicker
              id="edit-item-unit"
              disabled={!item.base_unit_editable}
              value={form.unit_code}
              onChange={(choice) =>
                setForm({
                  ...form,
                  unit_code: choice.code,
                  unit_name: choice.name,
                })
              }
              allowedModes={
                item.selling_mode === "PIECE" ? ["PIECE"] : [item.selling_mode]
              }
            />
            {!item.base_unit_editable && (
              <p className="r-caption">
                {ui(
                  "Base unit is protected after saved stock or bills. Use Units & packs for conversions.",
                )}
              </p>
            )}
            <details>
              <summary>{ui("More Details")}</summary>
              {field("purchase_price", "Purchase Price (₹)", "number")}
              {field("mrp", "MRP (₹)", "number")}
              {field("low_stock_threshold", "Minimum Level", "number")}
              {field("category", "Category")}
              {field("gst_rate", "GST Rate (%)", "number")}
              {field("hsn_sac", "HSN / SAC")}
              {field("sku", "SKU")}
              {prefs.enabled && field("barcode", "Barcode")}
              {field("description", "Description")}
              <p className="r-caption">
                {ui(
                  "Price and tax changes apply to new bills. Past bills and received stock costs are kept.",
                )}
              </p>
            </details>
            <AttachmentPicker
              onFileSelect={photo.select}
              existingAttachmentUrl={
                item.image
                  ? "/api/v1/attachments/" + item.image.id + "/content"
                  : undefined
              }
            />
          </fieldset>
          {error && (
            <p role="alert">
              {photo.failed
                ? ui(
                    "Item saved. Photo upload failed. Retry or continue without the photo.",
                  ) + " "
                : ""}
              {error}
            </p>
          )}
          {photo.failed && (
            <button type="button" className="r-btn" onClick={onSaved}>
              {ui("Continue without photo")}
            </button>
          )}
          <button
            className="r-btn r-btn--primary r-w-full"
            disabled={busy || !form.name?.trim()}
          >
            {ui(
              busy
                ? "Saving…"
                : photo.failed
                  ? "Retry Photo Upload"
                  : "Save Changes",
            )}
          </button>
        </form>
      ) : (
        <p role="alert">
          {error}
          <button
            className="r-btn"
            onClick={() => {
              setLoading(true);
              setRetry((v) => v + 1);
            }}
          >
            {ui("Try Again")}
          </button>
        </p>
      )}
    </Sheet>
  );
}
