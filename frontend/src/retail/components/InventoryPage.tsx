import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  Package,
  ShoppingCart,
  SlidersHorizontal,
  Download,
  CheckSquare,
} from "lucide-react";
import { itemApi, type RetailItem } from "../retailApi";
import { getApiErrorMessage } from "../../shared/api";
import {
  SearchField,
  FilterSheet,
  SegmentedControl,
  LoadingState,
  EmptyState,
  StickyActionBar,
} from "./MobileControls";
import InventoryCard from "./InventoryCard";
import ItemEditSheet from './ItemEditSheet';
import ItemActionsSheet from './ItemActionsSheet';
import BulkItemRemovalSheet from './BulkItemRemovalSheet';
import {useCanManageMaster} from './MasterRecordActions';
import {useBillingPreferences} from '../settings/useBillingPreferences';
import { downloadTenantExport } from '../subscription/downloadTenantExport';
import "../retail-compact-lists.css";
type StockFilter = "all" | "low" | "out";
export default function InventoryPage({
  stockPage = false,
}: {
  stockPage?: boolean;
}) {
  useUiLanguage();
  const prefs=useBillingPreferences();
  const [editing,setEditing]=useState<string|null>(null),[includeInactive,setIncludeInactive]=useState(false),[bulkReview,setBulkReview]=useState(false);
  const canManage=useCanManageMaster('items');
  const navigate = useNavigate(),
    [params] = useSearchParams();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState<StockFilter>(
      params.get("view") === "low" ? "low" : "all",
    ),
    [draft, setDraft] = useState<StockFilter>("all"),
    [filterOpen, setFilterOpen] = useState(false);
  const [items, setItems] = useState<RetailItem[]>([]),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [selecting, setSelecting] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [actionItem, setActionItem] = useState<RetailItem | null>(null),
    [exporting, setExporting] = useState(false);
  useEffect(() => {
    setFilter(params.get("view") === "low" ? "low" : "all");
    setOffset(0);
    setSelected([]);
  }, [params]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        const r = await itemApi.getItems(search, offset, filter,includeInactive);
        if (active) {
          setItems((p) => (offset ? [...p, ...r.data.data] : r.data.data));
          setMore(r.data.data.length === 100);
        }
      } catch (e) {
        if (active) setError(getApiErrorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, offset, retry, filter,includeInactive]);
  const physical = (i: RetailItem) =>
    i.inventory_tracking !== false && i.item_type !== "SERVICE" && !i.is_bundle;
  const matches = (i: RetailItem) =>
    filter === "all" ||
    (physical(i) &&
      (filter === "out"
        ? i.current_stock <= 0
        : i.current_stock <= (i.low_stock_threshold || 0)));
  const visible = items.filter(matches),
    low = items.filter(
      (i) => physical(i) && i.current_stock <= (i.low_stock_threshold || 0),
    ).length;
  const toggle = (id: string) =>
    setSelected((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length<100?[...p, id]:p,
    );
  const exportItems = async () => {setExporting(true);await downloadTenantExport(stockPage?'STOCK':'ITEMS',{search,...(selecting?{ids:selected.join(',')}:{})});setExporting(false);};
  return (
    <div className={'r-inventory-screen r-stitch-inventory '+(stockPage?'r-stitch-stock':'')}>
      {!stockPage&&<StitchHeader><h1>{ui('Items')}</h1></StitchHeader>}
      {stockPage&&<h1 className="r-visually-hidden">{ui('Stock')}</h1>}
      <main className="r-section">
        {!stockPage&&<button className="xp-card xp-tinted xp-intake-entry" data-accent="brand" onClick={()=>navigate('/retail/items/add-faster')}><strong>{ui('Add Items Faster')}</strong><span>{ui('Use a bill, Excel, voice or WhatsApp to add items quickly.')}</span><Plus size={20}/></button>}
        <div className="r-search-filter">
          <SearchField id="item-search" label={prefs.enabled?'Search items by name, SKU or barcode':'Search items by name or SKU'} value={search} onChange={s=>{setSearch(s);setOffset(0);setSelected([]);}} placeholder={prefs.enabled?'Search item name, SKU or barcode':'Search item name or SKU'}/>
          <button className="r-btn r-btn--icon" aria-label="Filter inventory" onClick={()=>{setDraft(filter);setFilterOpen(true);}}><SlidersHorizontal size={24}/></button>
        </div>
        {!stockPage&&<button className="r-btn r-btn--primary r-w-full r-inventory-new" id="add-item-btn" onClick={()=>navigate('/retail/items/add')}><Plus size={22}/>{ui('Add Item')}</button>}
        {stockPage&&<div className="r-stock-alerts"><button onClick={()=>{setFilter('low');setOffset(0);}}><Package size={24}/><span><strong>{low} {ui('Items')}</strong><small>{ui('Low Stock')} · {ui('loaded')}</small></span></button><button onClick={()=>{setFilter('out');setOffset(0);}}><ShoppingCart size={24}/><span><strong>{items.filter(i=>physical(i)&&i.current_stock<=0).length} {ui('Items')}</strong><small>{ui('Out of stock')} · {ui('loaded')}</small></span></button></div>}
        <SegmentedControl label="Stock status" value={filter} onChange={s=>{setFilter(s as StockFilter);setOffset(0);setSelected([]);}} options={[{value:'all',label:'All Items'},{value:'low',label:'Low Stock'},{value:'out',label:'Out of Stock'}]}/>
        <p className="r-caption r-inventory-count">{items.length} {ui('loaded')} · {ui('Search and filters check the full catalog.')}</p>
        <label className="r-toggle-row"><input type="checkbox" checked={includeInactive} onChange={e=>{setIncludeInactive(e.target.checked);setOffset(0);}}/>{ui('Show removed items')}</label>
        {error && (
          <div className="r-state-message" role="alert">
            <p>{error}</p>
            <button className="r-btn" onClick={() => setRetry((n) => n + 1)}>{ui("Try Again")}</button>
          </div>
        )}
        {loading && offset === 0 ? (
          <LoadingState label="Loading inventory…" />
        ) : !error && !visible.length ? (
          <><EmptyState
            title={
              search
                ? "No matching items"
                : filter === "low"
                  ? "No low stock items"
                  : "No items yet"
            }
            description={
              filter === "low"
                ? "Your counted items are above their minimum stock levels."
                : "Add your first item — or start billing and add items as you sell."
            }
            action={filter === "all" ? "Add Item" : "View Inventory"}
            onAction={() =>
              filter === "all"
                ? navigate("/retail/items/add")
                : setFilter("all")
            }
          />
          {filter==='all'&&<div className="xp-primary-grid"><button className="r-btn r-btn--primary" onClick={()=>navigate('/retail/bill')}>{ui('Make Bill')}</button><button className="r-btn r-btn--outline" onClick={()=>navigate('/retail/items/bulk')}>{ui('Add Many Items')}</button><button className="r-btn r-btn--outline" onClick={()=>navigate('/retail/more/import')}>{ui('Import Existing Data')}</button></div>}</>
        ) : (
          <div className="r-inventory-list">
            {visible.map((i) => (
              <InventoryCard
                key={i.id}
                item={i}
                selecting={selecting}
                selected={selected.includes(i.id)}
                onSelect={() => toggle(i.id)}
                onOpen={() => navigate("/retail/items/" + i.id)}
                onActions={() => setActionItem(i)}
              />
            ))}
          </div>
        )}
        {more && (
          <button
            className="r-btn r-w-full"
            disabled={loading}
            onClick={() => setOffset((n) => n + 100)}
          >
            {loading ? ui("Loading…") : "Load More Items"}
          </button>
        )}

        <details className="r-inventory-tools"><summary>{ui('Inventory tools')}</summary><div className="r-secondary-workflows"><button onClick={()=>navigate('/retail/items/bulk')}>{ui('Add Many Items')}</button><button onClick={()=>navigate('/retail/more/import')}><Download size={20}/>{ui('Bulk Upload')}</button><button disabled={exporting||(selecting&&!selected.length)} onClick={exportItems}><Download size={20}/>{ui(exporting?'Exporting…':selecting?'Export Selected':'Export Items')}</button><button aria-pressed={selecting} onClick={()=>{setSelecting(!selecting);setSelected([]);}}><CheckSquare size={22}/>{ui(selecting?'Finish selecting items':'Select items')}</button></div></details>
        {selecting&&<StickyActionBar><button className="r-btn r-btn--outline" onClick={()=>setSelected(visible.map(i=>i.id).slice(0,100))}>{ui('Select All Loaded')} ({Math.min(100,visible.length)})</button><p>{selected.length} {ui('items selected')}</p>{canManage&&selected.length>0&&<button className="r-btn r-btn--outline" data-tone="danger" onClick={()=>setBulkReview(true)}>Review Archive / Delete</button>}</StickyActionBar>}
      </main>
      {stockPage&&!selecting&&<StickyActionBar><button className="r-btn r-btn--primary" id="add-item-btn" onClick={()=>navigate('/retail/items/add')}><Plus size={22}/>{ui('Add Item')}</button><button className="r-btn r-btn--outline" onClick={()=>navigate('/retail/purchases/new')}><ShoppingCart size={22}/>{ui('Buy Stock')}</button></StickyActionBar>}
      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        count={filter === "all" ? 0 : 1}
        onApply={() => {
          setFilter(draft);
          setOffset(0);
          setSelected([]);
        }}
        onClear={() => {
          setDraft("all");
          setFilter("all");
          setOffset(0);
        }}
      >
        <SegmentedControl
          label="Stock status"
          value={draft}
          onChange={(s) => setDraft(s as StockFilter)}
          options={[
            { value: "all", label: "All Items" },
            { value: "low", label: "Low Stock" },
            { value: "out", label: "Out of Stock" },
          ]}
        />
      </FilterSheet>
      {actionItem&&<ItemActionsSheet id={actionItem.id} name={actionItem.name} onClose={()=>setActionItem(null)} onEdit={()=>{setEditing(actionItem.id);setActionItem(null);}} onChanged={()=>{setOffset(0);setRetry(v=>v+1);}}/>}
      {bulkReview&&<BulkItemRemovalSheet ids={selected} onClose={()=>setBulkReview(false)} onChanged={()=>{setSelected([]);setOffset(0);setRetry(v=>v+1);}}/>}
      {editing&&<ItemEditSheet id={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);setOffset(0);setRetry(v=>v+1);}}/>}
    </div>
  );
}
