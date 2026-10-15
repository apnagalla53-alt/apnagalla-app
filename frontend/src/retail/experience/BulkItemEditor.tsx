import { trackExperience } from "./experienceEvents";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { createUuid } from "../../shared/browserCrypto";
import api, { getApiErrorMessage } from "../../shared/api";
import { ui, useUiLanguage } from "../../i18n";
import StitchHeader from "../design/StitchHeader";
import UnitPicker, { type RetailUnitChoice } from "../components/UnitPicker";
import { useBusinessPreset } from "./useBusinessPreset";
import { useRetailEntitlements } from "../subscription/useRetailEntitlements";
import { readWorkflowDraft, useWorkflowDraft } from "./workflowDraft";
type Row = {
  id: string;
  name: string;
  price: string;
  stock: string;
  unit: RetailUnitChoice;
};
const empty = (): Row => ({
  id: createUuid(),
  name: "",
  price: "",
  stock: "",
  unit: { code: "PCS", name: "Pieces", selling_mode: "PIECE" },
});
export default function BulkItemEditor() {
  useUiLanguage();
  const navigate = useNavigate(),
    preset = useBusinessPreset(),
    access = useRetailEntitlements();
  const [rows, setRows] = useState<Row[]>(
      () =>
        readWorkflowDraft<Row[]>("bulk-items") || [empty(), empty(), empty()],
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [rowErrors, setRowErrors] = useState<Record<string, string>>({}),
    [paste, setPaste] = useState("");
  useEffect(() => {
    trackExperience("bulk_item_started", { workflow: "BULK" });
  }, []);
  const draft = useWorkflowDraft("bulk-items", rows),
    allowed = [
      "PIECE",
      ...["WEIGHT", "LENGTH", "AREA", "VOLUME"].filter((c) =>
        access.isFeatureEffective(c),
      ),
    ];
  const update = (id: string, values: Partial<Row>) =>
    setRows((current) =>
      current.map((r) => (r.id === id ? { ...r, ...values } : r)),
    );
  const save = async () => {
    if (busy) return;
    const active = rows.filter((r) => r.name.trim() || r.price || r.stock),
      issues: Record<string, string> = {};
    for (const r of active) {
      if (
        !r.name.trim() ||
        !r.price ||
        !Number.isFinite(Number(r.price)) ||
        Number(r.price) < 0 ||
        (r.stock !== "" &&
          (!Number.isFinite(Number(r.stock)) || Number(r.stock) < 0))
      )
        issues[r.id] = ui(
          "Enter a name, valid price and optional non-negative stock.",
        );
    }
    if (!active.length) {
      setError(ui("Add at least one item."));
      return;
    }
    setRowErrors(issues);
    if (Object.keys(issues).length) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/retail/items/bulk", {
        items: active.map((r) => ({
          name: r.name.trim(),
          selling_price: Number(r.price),
          unit_code: r.unit.code,
          unit_name: r.unit.name,
          selling_mode: r.unit.selling_mode || "PIECE",
          inventory_tracking: r.stock !== "",
          ...(r.stock !== ""
            ? { opening_stock: Number(r.stock), skip_opening_cost: true }
            : {}),
        })),
      });
      trackExperience("bulk_item_saved", {
        workflow: "BULK",
        count: active.length,
      });
      draft.clear();
      navigate("/retail/items");
    } catch (err: any) {
      setError(getApiErrorMessage(err));
      const index = err.response?.data?.row_index;
      if (Number.isInteger(index) && active[index])
        setRowErrors({ [active[index].id]: getApiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="r-page-with-sticky">
      <StitchHeader>
        <h1>{ui("Add Many Items")}</h1>
      </StitchHeader>
      <main className="r-section xp-stack">
        <button
          type="button"
          className="r-btn r-btn--outline"
          onClick={() => navigate("/retail/more/import")}
        >
          {ui("Import existing data")}
        </button>
        <p>{ui("Add a few items now. You can add the rest as you sell.")}</p>
        <p className="xp-muted">
          {ui(
            "Leave stock blank if you have not counted it. Exact profit stays unknown until purchase cost is recorded.",
          )}
        </p>
        <p className="xp-unit-hint">
          {ui("Suggested for your shop")}: {ui(preset.displayName)}
        </p>
        <details className="xp-card">
          <summary>{ui("Paste rows (optional)")}</summary>
          <p className="xp-muted">
            {ui(
              "One item per line: name | selling price | stock (optional). Choose units below.",
            )}
          </p>
          <label htmlFor="bulk-paste">{ui("Rows to paste")}</label>
          <textarea
            id="bulk-paste"
            className="r-input"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <button
            type="button"
            className="r-btn"
            disabled={busy || !paste.trim()}
            onClick={() => {
              const parsed = paste
                .split(/\r?\n/)
                .filter((l) => l.trim())
                .map((line) => {
                  const [name, price, stock] = line
                    .split(/\t|\|/)
                    .map((s) => s.trim());
                  return {
                    ...empty(),
                    name,
                    price: (price || "").replace(/[₹,]/g, ""),
                    stock: stock || "",
                  };
                });
              if (
                parsed.length +
                  rows.filter((r) => r.name.trim() || r.price || r.stock)
                    .length >
                50
              ) {
                setError(ui("Use up to 50 rows at a time."));
                return;
              }
              setRows((current) => [
                ...current.filter((r) => r.name.trim() || r.price || r.stock),
                ...parsed,
              ]);
              setPaste("");
            }}
          >
            {ui("Add pasted rows")}
          </button>
        </details>
        {rows.map((row, index) => (
          <fieldset key={row.id} className="xp-card r-fieldset" disabled={busy}>
            <div className="xp-section-title">
              <h2>
                {ui("Item")} {index + 1}
              </h2>
              <button
                type="button"
                className="r-btn r-btn--icon"
                data-tone="danger"
                aria-label={ui("Remove row") + " " + (index + 1)}
                onClick={() =>
                  setRows((current) => current.filter((r) => r.id !== row.id))
                }
              >
                <Trash2 size={19} />
              </button>
            </div>
            <label htmlFor={"bulk-name-" + row.id}>{ui("Item Name *")}</label>
            <input
              id={"bulk-name-" + row.id}
              className="r-input"
              maxLength={255}
              value={row.name}
              onChange={(e) => update(row.id, { name: e.target.value })}
            />
            <div className="xp-form-grid">
              <div>
                <label htmlFor={"bulk-price-" + row.id}>
                  {ui("Selling Price (₹) *")}
                </label>
                <input
                  id={"bulk-price-" + row.id}
                  className="r-input"
                  type="number"
                  min="0"
                  step=".01"
                  value={row.price}
                  onChange={(e) => update(row.id, { price: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor={"bulk-stock-" + row.id}>
                  {ui("Stock (optional)")}
                </label>
                <input
                  id={"bulk-stock-" + row.id}
                  className="r-input"
                  type="number"
                  min="0"
                  step="any"
                  value={row.stock}
                  onChange={(e) => update(row.id, { stock: e.target.value })}
                />
              </div>
            </div>
            <label htmlFor={"bulk-unit-" + row.id}>{ui("Unit")}</label>
            <UnitPicker
              id={"bulk-unit-" + row.id}
              value={row.unit.code}
              onChange={(unit) => update(row.id, { unit })}
              allowedModes={allowed}
            />
            {rowErrors[row.id] && <p role="alert">{rowErrors[row.id]}</p>}
          </fieldset>
        ))}
        <button
          className="r-btn r-btn--outline"
          disabled={busy || rows.length >= 50}
          onClick={() => setRows((current) => [...current, empty()])}
        >
          <Plus size={20} />
          {ui("Add Row")}
        </button>
        {error && <p role="alert">{error}</p>}
        <p className="xp-muted">
          {ui(
            "All rows save together. If a row fails, your entries stay here for correction.",
          )}
        </p>
      </main>
      <div className="r-sticky-footer">
        <button
          className="r-btn r-btn--primary r-w-full"
          disabled={busy || !rows.length}
          onClick={() => void save()}
        >
          {ui(busy ? "Saving…" : "Save All")}
        </button>
      </div>
    </div>
  );
}
