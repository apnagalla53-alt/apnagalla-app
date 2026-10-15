import { ui, useUiLanguage } from "../../i18n";
import { MobileSelect } from "./MobileControls";
import { useEffect, useState } from "react";
import { itemApi, type RetailItem } from "../retailApi";
export default function PurchaseItemSearch({
  index,
  value,
  selected,
  onSelect,
  onLoaded,
  onCreate,
}: {
  index: number;
  value: string;
  selected?: RetailItem;
  onSelect: (id: string) => void;
  onLoaded: (items: RetailItem[]) => void;
  onCreate?: (query:string) => void;
}) {
  useUiLanguage();
  const [query, setQuery] = useState(""),
    [rows, setRows] = useState<RetailItem[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      setError("");
      try {
        const response = await itemApi.getItems(query, offset);
        if (active) {
          const items = response.data.data.filter(
            (i) => i.active && !i.is_bundle,
          );
          setRows((p) => (offset ? [...p, ...items] : items));
          setMore(response.data.data.length === 100);
          onLoaded(items);
        }
      } catch {
        if (active) setError("Could not search items. Try again.");
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, offset, retry]);
  const choices =
    selected && !rows.some((i) => i.id === selected.id)
      ? [selected, ...rows]
      : rows;
  const id = index === 0 ? "purchase-item" : "purchase-item-" + index;
  return (
    <div className="r-purchase-search">
      <label htmlFor={id}>Item</label>
      <MobileSelect
        id={id}
        className="r-select"
        required
        value={value}
        onChange={(e) => onSelect(e.target.value)}
        onSearch={(s) => {
          setQuery(s);
          setOffset(0);
        }}
        loading={loading}
        error={error}
        onRetry={() => setRetry((n) => n + 1)}
        onMore={more && !loading ? () => setOffset((n) => n + 100) : undefined}
        onAdd={onCreate?() => onCreate(query):undefined}
        addLabel={ui("Add Item")}
      >
        <option value="">Choose Item</option>
        {choices.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </MobileSelect>
    </div>
  );
}
