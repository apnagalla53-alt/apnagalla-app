import { trackExperience } from "../experience/experienceEvents";
import { useState } from "react";
import { ui } from "../../i18n";
import api, { getApiErrorMessage } from "../../shared/api";
import { Sheet } from "../components/MobileControls";
import UnitPicker from "../components/UnitPicker";
import { useRetailEntitlements } from "../subscription/useRetailEntitlements";
import { fieldLabels } from "./intakeCopy";
export default function IntakeRowEditor({
  job,
  row,
  onClose,
  onSaved,
}: {
  job: any;
  row: any;
  onClose: () => void;
  onSaved: (data: any) => void;
}) {
  const initial = row.normalized,
    purchase = job.kind === "INTAKE_PURCHASE",
    access = useRetailEntitlements(),
    [values, setValues] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        Object.keys(fieldLabels).map((k) => [
          k,
          initial[k] === undefined || initial[k] === null
            ? ""
            : String(initial[k]),
        ]),
      ),
    ),
    [match, setMatch] = useState(initial.matched_item_id || ""),
    [createNew, setCreateNew] = useState(initial.match_status === "NEW"),
    [stock, setStock] = useState(!!initial.use_quantity_as_stock),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (key: string, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  const numeric = [
      "quantity",
      "conversion",
      "purchase_price",
      "selling_price",
      "mrp",
      "gst_rate",
    ],
    field = (key: string, required = false) => (
      <div className="r-input-group" key={key}>
        <label htmlFor={"intake-row-" + key}>
          {ui(fieldLabels[key])}
          {required ? " *" : ""}
        </label>
        <input
          id={"intake-row-" + key}
          className="r-input"
          value={values[key] || ""}
          required={required}
          type={
            numeric.includes(key)
              ? "number"
              : key.endsWith("_date")
                ? "date"
                : "text"
          }
          min={numeric.includes(key) ? 0 : undefined}
          step="any"
          maxLength={255}
          onChange={(e) => change(key, e.target.value)}
        />
      </div>
    );
  const modes = [
    "PIECE",
    ...["WEIGHT", "LENGTH", "AREA", "VOLUME"].filter((c) =>
      access.isFeatureEffective(c),
    ),
  ];
  return (
    <Sheet
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Check item"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const fields = Object.fromEntries(
              Object.entries({
                ...values,
                unit_code: values.unit_code || "PCS",
              })
                .filter(([, v]) => v !== "")
                .map(([k, v]) => [k, numeric.includes(k) ? Number(v) : v]),
            );
            const r = await api.patch(
              "/retail/account/intake/" + job.id + "/rows/" + row.id,
              {
                ...fields,
                clear_fields: Object.keys(values).filter(
                  (k) => values[k] === "" && k !== "unit_code",
                ),
                ...(match
                  ? { matched_item_id: match }
                  : { create_new: createNew }),
                confirmed,
                use_quantity_as_stock: stock,
              },
            );
            trackExperience("intake_row_corrected", { workflow: "INTAKE" });
            if (job.configuration.source === "VOICE")
              trackExperience("voice_corrected", { workflow: "INTAKE" });
            onSaved(r.data);
            onClose();
          } catch (err) {
            setError(getApiErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="xp-muted">
          {ui(
            purchase
              ? "Check this row against your supplier bill. The purchase is not saved yet."
              : "Check what was understood. Stock changes only when you choose to import an opening count.",
          )}
        </p>
        <fieldset className="r-fieldset" disabled={busy}>
          {field("name", true)}
          {!!initial.candidates?.length && (
            <div className="xp-stack">
              <strong>{ui("Which item is this?")}</strong>
              {initial.candidates.map((c: any) => (
                <button
                  type="button"
                  className="xp-unit-chip"
                  aria-pressed={match === c.id}
                  key={c.id}
                  onClick={() => {
                    setMatch(c.id);
                    setCreateNew(false);
                  }}
                >
                  {c.name} · {c.unit}
                </button>
              ))}
              <button
                type="button"
                className="xp-unit-chip"
                aria-pressed={createNew}
                onClick={() => {
                  setMatch("");
                  setCreateNew(true);
                }}
              >
                {ui("Create New Item")}
              </button>
            </div>
          )}
          <div className="xp-form-grid">
            {field("quantity", purchase)}
            {field(
              purchase ? "purchase_price" : "selling_price",
              purchase || !match,
            )}
          </div>
          {purchase && !match && field("selling_price", true)}
          <label>
            {ui(purchase ? "How do you buy it?" : "How do you sell it?")}
          </label>
          <UnitPicker
            id="intake-unit"
            title="Unit"
            value={values.unit_code || "PCS"}
            onChange={(u) => change("unit_code", u.code)}
            allowedModes={modes}
          />
          {purchase && (
            <details>
              <summary>{ui("Different selling unit / pack size")}</summary>
              <label>{ui("How do you sell it?")}</label>
              <UnitPicker
                id="intake-sale-unit"
                title="Selling unit"
                value={values.sale_unit || values.unit_code || "PCS"}
                onChange={(u) => change("sale_unit", u.code)}
                allowedModes={modes}
              />
              {field("conversion")}
            </details>
          )}
          {!purchase && values.quantity !== "" && (
            <label className="r-toggle-row">
              <input
                type="checkbox"
                checked={stock}
                onChange={(e) => setStock(e.target.checked)}
              />
              {ui("Import this quantity as counted opening stock")}
            </label>
          )}
          <details open={!!initial.batch_number || !!initial.expiry_date}>
            <summary>{ui("Additional Details")}</summary>
            <div className="xp-form-grid">
              {[
                "sku",
                "barcode",
                "mrp",
                "gst_rate",
                "hsn_sac",
                "batch_number",
                "expiry_date",
                "manufacturing_date",
              ].map((k) => field(k))}
            </div>
          </details>
          {!!initial.warnings?.length && (
            <ul className="xp-muted">
              {initial.warnings.map((w: string) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <label className="r-toggle-row">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {ui("I checked the item, units, quantity and prices.")}
          </label>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <button
          className="r-btn r-btn--primary r-w-full"
          disabled={busy || !confirmed}
        >
          {ui(busy ? "Saving…" : "Save correction")}
        </button>
        {!purchase && (
          <details className="xp-card">
            <summary>{ui("Skip this row")}</summary>
            <p>
              {ui(
                "This row will not create an item or change stock. Other ready rows can still be imported.",
              )}
            </p>
            <button
              type="button"
              className="r-btn r-btn--danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const response = await api.patch(
                    "/retail/account/intake/" + job.id + "/rows/" + row.id,
                    { ignore: true, confirmed: true },
                  );
                  onSaved(response.data);
                  onClose();
                } catch (e) {
                  setError(getApiErrorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {ui("Skip without saving")}
            </button>
          </details>
        )}
      </form>
    </Sheet>
  );
}
