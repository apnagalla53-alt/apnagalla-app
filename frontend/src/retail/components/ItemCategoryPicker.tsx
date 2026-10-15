import { ui, useUiLanguage } from "../../i18n";
import { useEffect, useState } from "react";
import api, { getApiErrorMessage } from "../../shared/api";
import {
  ChevronDown,
  ShoppingBasket,
  Sparkles,
  Pill,
  Shirt,
  Wrench,
  Plus,
} from "lucide-react";
import { SelectionSheet, Sheet } from "./MobileControls";
import { useBusinessPreset } from '../experience/useBusinessPreset';
const groups = [
  {group: 'Health & Medicines', Icon: Pill, names: ['Pharmacy / Medicines', 'Medical Devices', 'Health Supplements']},
  {
    group: "Food & Grocery",
    Icon: ShoppingBasket,
    names: [
      "Groceries",
      "Noodles & Pasta",
      "Sauces & Ketchup",
      "Ready to Cook",
      "Canned Foods",
      "Jams & Spreads",
      "Vinegar",
      "Snacks",
      "Beverages",
      "Dairy",
    ],
  },
  {
    group: "Personal Care",
    Icon: Sparkles,
    names: [
      "Personal Care",
      "Soap & Shampoo",
      "Toothpaste & Oral Care",
      "Hair Care",
    ],
  },
  {
    group: "Clothing & Home",
    Icon: Shirt,
    names: ["Clothing", "Footwear", "Home & Kitchen", "Stationery"],
  },
  {
    group: "Other",
    Icon: Wrench,
    names: ["Electronics", "Hardware", "Services", "Other"],
  },
];
export default function ItemCategoryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  useUiLanguage();
  const preset=useBusinessPreset();
  const [open, setOpen] = useState(false),
    [adding, setAdding] = useState(false),
    [custom, setCustom] = useState(""),
    [recent, setRecent] = useState<string[]>([]);
  const [savedCategories, setSavedCategories] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    const t = setTimeout(async () => {
      try {
        const r = await api.get<string[]>("/retail/item-categories", {
          params: { search: query, offset, limit: 100 },
        });
        if (active) {
          setSavedCategories((p) => (offset ? [...p, ...r.data] : r.data));
          setMore(r.data.length === 100);
        }
      } catch (e) {
        if (active) setError(getApiErrorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [open, query, offset, retry]);
  const options = groups.flatMap((g) =>
    g.names.map((label) => ({
      value: label,
      label,
      group: g.group,
      Icon: g.Icon,
    })),
  );
  for(const category of [...preset.recommendedCategories].reverse()){
    const existing=options.findIndex(o=>o.value===category.name);if(existing>=0)options.splice(existing,1);
    options.unshift({value:category.name,label:category.name,group:ui('Suggested for your shop'),Icon:ShoppingBasket});
  }
  for (const label of savedCategories)
    if (!options.some((o) => o.value === label))
      options.unshift({
        value: label,
        label,
        group: "Your categories",
        Icon: ShoppingBasket,
      });
  if (value && !options.some((o) => o.value === value))
    options.unshift({
      value,
      label: value,
      group: "Your categories",
      Icon: ShoppingBasket,
    });
  return (
    <>
      <label className="r-label" htmlFor="item-category">{ui("Category")} <span className="r-caption">optional</span>
      </label>
      <button
        id="item-category"
        type="button"
        className="r-selection-field"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen(true)}
      >
        <span>{value || "Select category"}</span>
        <ChevronDown size={20} />
      </button>
      <SelectionSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Select Product Category"
        options={options.filter(
          (o) => !query || o.label.toLowerCase().includes(query.toLowerCase()),
        )}
        onSearch={(s) => {
          setQuery(s);
          setOffset(0);
        }}
        loading={loading}
        error={error}
        onRetry={() => setRetry((n) => n + 1)}
        onMore={more && !loading ? () => setOffset((n) => n + 100) : undefined}
        value={value}
        recent={recent}
        onSelect={(v) => {
          onChange(v);
          setRecent((p) => [v, ...p.filter((x) => x !== v)].slice(0, 3));
        }}
        onClear={() => onChange("")}
        onAdd={() => {
          setCustom("");
          setAdding(true);
        }}
        addLabel="Add New Category"
      />
      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Add Category"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) {
              onChange(custom.trim());
              setAdding(false);
            }
          }}
        >
          <label htmlFor="category-name">Category name</label>
          <input
            id="category-name"
            className="r-input"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            required
            maxLength={100}
          />
          <p className="r-caption">
            Saved with this item when you tap Save Item.
          </p>
          <button className="r-btn r-btn--primary r-w-full">
            <Plus size={20} />
            Use Category
          </button>
        </form>
      </Sheet>
    </>
  );
}
