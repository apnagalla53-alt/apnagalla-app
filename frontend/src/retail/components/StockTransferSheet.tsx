import { ui, useUiLanguage } from "../../i18n";
import { useState } from "react";
import { Sheet, MobileSelect } from "./MobileControls";
import PurchaseItemSearch from "./PurchaseItemSearch";
import { type RetailItem } from "../retailApi";
import api, { getApiErrorMessage } from "../../shared/api";
export default function StockTransferSheet({
  locations,
  close,
  onSaved,
}: {
  locations: { id: string; name: string }[];
  close: () => void;
  onSaved: () => void;
}) {
  useUiLanguage();
  const [source, setSource] = useState(locations[0]?.id || ""),
    [destination, setDestination] = useState(""),
    [items, setItems] = useState<RetailItem[]>([]),
    [itemId, setItemId] = useState(""),
    [quantity, setQuantity] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const item = items.find((i) => i.id === itemId),
    unsupported =
      !!item &&
      (item.has_variants ||
        item.track_batch ||
        item.track_serial ||
        item.is_bundle ||
        item.item_type === "SERVICE" ||
        item.inventory_tracking === false);
  return (
    <Sheet
      open
      onClose={close}
      title="Transfer Stock"
      subtitle="Move counted stock between your locations"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (busy || !item || unsupported) return;
          setBusy(true);
          setError("");
          api
            .post("/inventory/transfers", {
              source_godown_id: source,
              destination_godown_id: destination,
              narration: note,
              lines: [
                {
                  item_id: item.id,
                  unit_id: item.primary_unit_id,
                  quantity: Number(quantity),
                },
              ],
            })
            .then(() => {
              onSaved();
              close();
            })
            .catch((e) => setError(getApiErrorMessage(e)))
            .finally(() => setBusy(false));
        }}
      >
        <fieldset className="r-fieldset" disabled={busy}>
          <label htmlFor="transfer-from">From Location</label>
          <MobileSelect
            id="transfer-from"
            required
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </MobileSelect>
          <label htmlFor="transfer-to">To Location</label>
          <MobileSelect
            id="transfer-to"
            required
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value="">Choose destination</option>
            {locations
              .filter((l) => l.id !== source)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </MobileSelect>
          <PurchaseItemSearch
            index={0}
            value={itemId}
            selected={item}
            onSelect={setItemId}
            onLoaded={(rows) =>
              setItems((p) => [
                ...p.filter((i) => !rows.some((r) => r.id === i.id)),
                ...rows,
              ])
            }
          />
          {unsupported && (
            <p role="status">
              This transfer service supports counted items without variant,
              batch or serial tracking. Tracked stock needs a transfer service
              that preserves those exact identities.
            </p>
          )}
          <label htmlFor="transfer-quantity">{ui("Quantity")}{item ? " (" + item.unit + ")" : ""}
          </label>
          <input
            id="transfer-quantity"
            className="r-input"
            type="number"
            min="0.000001"
            step="any"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)} inputMode="decimal"
          />
          <label htmlFor="transfer-note">Note (optional)</label>
          <textarea
            id="transfer-note"
            className="r-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <button
          className="r-btn r-btn--primary r-w-full"
          disabled={
            busy ||
            unsupported ||
            !itemId ||
            !destination ||
            source === destination
          }
        >
          {busy ? "Transferring…" : "Confirm Transfer"}
        </button>
      </form>
    </Sheet>
  );
}
