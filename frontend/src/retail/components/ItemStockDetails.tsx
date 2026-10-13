import { ui, useUiLanguage } from "../../i18n";
import { useState } from "react";
import { Sheet, SearchField, LoadingState } from "./MobileControls";
import api, { getApiErrorMessage } from "../../shared/api";
export default function ItemStockDetails({ item }: { item: any }) {
  useUiLanguage();
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState<any[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [search, setSearch] = useState("");
  const movements = async () => {
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const r = await api.get("/inventory/movements", {
        params: { item_id: item.id },
      });
      setRows(r.data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
  return (
    <>
      {item.inventory_tracking !== false &&
        item.item_type !== "SERVICE" &&
        !item.is_bundle && (
          <button
            className="r-btn r-btn--outline r-w-full"
            onClick={() => void movements()}
          >
            View Stock Movements
          </button>
        )}
      {item.track_batch && (
        <details className="r-card">
          <summary>Batch & Expiry</summary>
          {!item.batches.length ? (
            <p>No batches received yet. Use Buy Stock to receive a batch.</p>
          ) : (
            item.batches.map((b: any) => (
              <div className="r-card" key={b.id}>
                <strong>{b.batch_number}</strong>
                <p className="r-caption">
                  {b.expiry_date
                    ? "Expires " + b.expiry_date.slice(0, 10)
                    : "No expiry date"}
                  {b.expiry_date && b.expiry_date.slice(0, 10) < today
                    ? " · Expired"
                    : ""}
                </p>
                <p>
                  Stock:{" "}
                  {item.stock_balance_projection
                    .filter((s: any) => s.batch_id === b.id)
                    .reduce(
                      (n: number, s: any) => n + Number(s.quantity),
                      0,
                    )}{" "}
                  {item.primary_unit.code}
                </p>
              </div>
            ))
          )}
        </details>
      )}
      {item.track_serial && (
        <details className="r-card">
          <summary>Serial Numbers & Warranty</summary>
          <SearchField
            label="Search item serials"
            value={search}
            onChange={setSearch}
            placeholder="Serial number…"
          />
          {item.serials
            .filter((s: any) =>
              s.serial_number.toLowerCase().includes(search.toLowerCase()),
            )
            .map((s: any) => (
              <div className="r-card" key={s.id}>
                <strong>{s.serial_number}</strong>
                <p>{s.status.replaceAll("_", " ")}</p>
                <p className="r-caption">
                  {s.warranty_end
                    ? "Warranty until " + s.warranty_end.slice(0, 10)
                    : "Warranty starts when sold, if configured"}
                </p>
              </div>
            ))}
          {!item.serials.length && (
            <p>
              No serials received yet. Use Buy Stock to receive serial numbers.
            </p>
          )}
        </details>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Stock Movements"
        subtitle="Up to 100 recorded movements"
      >
        <>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <p role="alert">
              {error}
              <button className="r-btn" onClick={() => void movements()}>{ui("Try Again")}</button>
            </p>
          ) : !rows.length ? (
            <p>No stock movements recorded yet.</p>
          ) : (
            rows.map((r) => (
              <article className="r-card" key={r.id}>
                <strong>
                  {r.movement_type?.replaceAll("_", " ") || r.direction}
                </strong>
                <p>
                  {String(r.business_date || r.created_at).slice(0, 10)} ·{" "}
                  {Number(r.quantity)} {item.primary_unit.code}
                </p>
                <p className="r-caption">
                  {r.reference_document_number || r.narration}
                </p>
              </article>
            ))
          )}
        </>
      </Sheet>
    </>
  );
}
