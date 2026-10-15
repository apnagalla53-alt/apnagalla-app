import { trackExperience } from "./experienceEvents";
import { useEffect, useState } from "react";
import api, { getApiErrorMessage } from "../../shared/api";
import { ui } from "../../i18n";
import InlineEntitySheet from "./InlineEntitySheet";
import UnitPicker, { type RetailUnitChoice } from "../components/UnitPicker";
import { useBusinessPreset } from "./useBusinessPreset";
import { useRetailEntitlements } from "../subscription/useRetailEntitlements";
import type { RetailItem } from "../retailApi";
export type QuickCreatedItem = {
  item: RetailItem;
  quantity: number;
  purchasePrice?: number;
  purchaseUnitId?: string;
};
export default function QuickCreateItemSheet({
  name: initialName = "",
  barcode,
  context = "bill",
  initialQuantity = "1",
  initialCost = "",
  onClose,
  onCreated,
}: {
  name?: string;
  barcode?: string;
  context?: "bill" | "purchase";
  initialQuantity?: string;
  initialCost?: string;
  onClose: () => void;
  onCreated: (created: QuickCreatedItem) => void;
}) {
  const preset = useBusinessPreset(),
    access = useRetailEntitlements();
  const allowed = [
    "PIECE",
    ...["WEIGHT", "LENGTH"].filter((mode) => access.isFeatureEffective(mode)),
  ];
  const initialUnit = preset.unitSuggestions.find((u) =>
    allowed.includes(u.selling_mode),
  ) || { code: "PCS", name: "Pieces", selling_mode: "PIECE" };
  const [name, setName] = useState(initialName),
    [price, setPrice] = useState(""),
    [quantity, setQuantity] = useState(initialQuantity),
    [cost, setCost] = useState(initialCost);
  const [unit, setUnit] = useState<RetailUnitChoice>(initialUnit),
    [buyUnit, setBuyUnit] = useState<RetailUnitChoice | null>(null),
    [factor, setFactor] = useState("");
  useEffect(() => {
    trackExperience("inline_item_started", {
      workflow: context === "purchase" ? "PURCHASE" : "BILL",
    });
  }, []);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const mode =
    unit.selling_mode && allowed.includes(unit.selling_mode)
      ? unit.selling_mode
      : "PIECE";
  return (
    <InlineEntitySheet
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={
        context === "purchase" ? "Add item to this purchase" : "Add & Sell"
      }
      context={
        context === "purchase"
          ? "Your purchase stays here. Stock and cost update when you save the purchase."
          : "Your bill stays here. Stock and cost can be set up later."
      }
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const response = await api.post("/retail/items/inline", {
              name: name.trim(),
              selling_price: Number(price),
              inventory_tracking: false,
              unit_code: unit.code,
              unit_name: unit.name,
              selling_mode: mode,
              ...(barcode ? { barcode } : {}),
              ...(context === "purchase" &&
              buyUnit &&
              buyUnit.code !== unit.code
                ? {
                    purchase_unit_code: buyUnit.code,
                    purchase_unit_factor: Number(factor),
                  }
                : {}),
            });
            trackExperience(
              context === "purchase"
                ? "purchase_inline_item_created"
                : "inline_item_created",
              { workflow: context === "purchase" ? "PURCHASE" : "BILL" },
            );
            onCreated({
              item: response.data,
              quantity: Number(quantity),
              ...(context === "purchase"
                ? {
                    purchasePrice: Number(cost),
                    purchaseUnitId: response.data.purchase_unit_id,
                  }
                : {}),
            });
          } catch (err) {
            setError(getApiErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="r-fieldset" disabled={busy}>
          <label htmlFor="inline-item-name">{ui("Item Name *")}</label>
          <input
            id="inline-item-name"
            className="r-input"
            required
            maxLength={255}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {barcode && (
            <p className="xp-muted">
              {ui("Barcode")} · {barcode}
            </p>
          )}
          <div className="xp-form-grid">
            <div>
              <label htmlFor="inline-item-price">
                {ui("Selling Price (₹) *")}
              </label>
              <input
                id="inline-item-price"
                className="r-input"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="inline-item-quantity">{ui("Quantity")}</label>
              <input
                id="inline-item-quantity"
                className="r-input"
                type="number"
                required
                min={mode === "PIECE" ? "1" : "0.000001"}
                step={mode === "PIECE" ? "1" : "0.000001"}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>
          <label htmlFor="inline-item-unit">
            {ui(
              context === "purchase"
                ? "How do you sell it?"
                : "How do you sell it?",
            )}
          </label>
          <UnitPicker
            id="inline-item-unit"
            value={unit.code}
            onChange={setUnit}
            allowedModes={allowed}
          />
          {context === "purchase" && (
            <>
              <label htmlFor="inline-purchase-cost">
                {ui("Purchase price per purchase unit (₹)")}
              </label>
              <input
                id="inline-purchase-cost"
                className="r-input"
                type="number"
                required
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
              <details>
                <summary>{ui(preset.itemPrompts.multiUnit)}</summary>
                {access.isFeatureEffective("MULTI_UNIT") ? (
                  <>
                    <label htmlFor="inline-buy-unit">
                      {ui("How do you BUY this?")}
                    </label>
                    <UnitPicker
                      id="inline-buy-unit"
                      value={buyUnit?.code || unit.code}
                      onChange={setBuyUnit}
                      allowedModes={allowed}
                    />
                    {buyUnit && buyUnit.code !== unit.code && (
                      <>
                        <label htmlFor="inline-pack-factor">
                          {ui("How many")} {unit.name} {ui("in 1")}{" "}
                          {buyUnit.name}?
                        </label>
                        <input
                          id="inline-pack-factor"
                          className="r-input"
                          type="number"
                          min={mode === "PIECE" ? "1" : "0.000001"}
                          step={mode === "PIECE" ? "1" : "0.000001"}
                          required
                          value={factor}
                          onChange={(e) => setFactor(e.target.value)}
                        />
                        <p>
                          1 {buyUnit.code} = {factor || "…"} {unit.code}
                        </p>
                        <p className="xp-muted">
                          {ui(
                            "Quantity and purchase price above are for the purchase unit.",
                          )}
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  <p>
                    {ui("Multi-unit packs follow your plan and shop features.")}
                  </p>
                )}
              </details>
            </>
          )}
          <p className="xp-muted">
            {ui(
              "Stock not set up yet. Exact profit stays unknown until cost is recorded.",
            )}
          </p>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <button
          className="r-btn r-btn--primary r-w-full"
          disabled={busy || !name.trim() || !price || !quantity}
        >
          {ui(
            busy
              ? "Saving…"
              : context === "purchase"
                ? "Add to Purchase"
                : "Add to Bill",
          )}
        </button>
      </form>
    </InlineEntitySheet>
  );
}
