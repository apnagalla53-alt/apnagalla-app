import { ui, useUiLanguage } from "../../i18n";
import { MoreHorizontal, Package, Check, ShoppingCart, ChevronRight } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import type { RetailItem } from "../retailApi";
import ItemPhoto from './ItemPhoto';
export default function InventoryCard({
  item,
  onOpen,
  onActions,
  selecting,
  selected,
  onSelect,
}: {
  item: RetailItem;
  onOpen: () => void;
  onActions: () => void;
  selecting: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  useUiLanguage();
  const navigate=useNavigate();
  const physical =
    item.inventory_tracking !== false &&
    item.item_type !== "SERVICE" &&
    !item.is_bundle;
  const status = !physical
    ? item.inventory_tracking === false
      ? "Stock not counted"
      : item.is_bundle
        ? "Bundle"
        : "Service"
    : item.current_stock <= 0
      ? "Out of stock"
      : item.current_stock <= (item.low_stock_threshold || 0)
        ? "Low stock"
        : "In Stock";
  return (
    <article
      className="r-card r-inventory-card r-list-item"
      id={"item-" + item.id}
    >
      {!item.active&&<span className="r-badge">{ui('Removed')}</span>}
      <button
        className="r-inventory-card-main"
        type="button"
        onClick={selecting ? onSelect : onOpen}
        aria-label={
          selecting
            ? (selected ? "Unselect " : "Select ") + item.name
            : "Open " + item.name
        }
        aria-pressed={selecting ? selected : undefined}
      >
        <div className="r-inventory-card-heading">
          <span className="r-inventory-card-identity">{item.image ? <ItemPhoto id={item.image.id} name={item.name} /> : <span className="r-ledger-icon"><Package size={24}/></span>}<span><strong title={item.name}>{item.name}</strong><small>{item.unit} · {item.sku}</small></span></span>
          <strong>₹{Number(item.selling_price).toLocaleString("en-IN")}</strong>
        </div>
        <div className="r-inventory-card-meta">
          <span
            className={
              "r-badge " +
              (status === "Low stock"
                ? "r-badge--warning"
                : status === "Out of stock"
                  ? "r-badge--danger"
                  : "")
            }
          >
            {ui(status)}
          </span>
        </div>
        <div className="r-inventory-card-tags">
          <span>
            <Package size={14} />
            {item.item_type === "SERVICE"
              ? ui("Service")
              : item.is_bundle
                ? "Bundle"
                : ui("Product")}
          </span>
          {item.has_variants && <span>Variants</span>}
          {item.track_batch && <span>Batch / Expiry</span>}
          {item.track_serial && <span>Serial / Warranty</span>}
        </div>
      </button>
      <div className="r-inventory-card-stock"><span>{physical ? <><strong>{ui('Stock')}: {item.current_stock} {item.unit}</strong><small>{ui('Minimum Level')}: {item.low_stock_threshold||0}</small></> : ui(item.inventory_tracking===false?'Receive stock to start counting':item.is_bundle?'Uses component stock':'No physical stock')}</span>{item.item_type!=='SERVICE'&&!item.is_bundle?<button type="button" className="r-btn" disabled={!item.active} onClick={()=>navigate('/retail/purchases/new?item='+item.id)}><ShoppingCart size={18}/>{ui('Buy Stock')}</button>:<button type="button" className="r-btn r-btn--icon" aria-label={'Open '+item.name} onClick={onOpen}><ChevronRight size={22}/></button>}</div>
      <button
        type="button"
        className="r-btn r-btn--icon"
        aria-label={
          selecting
            ? (selected ? "Unselect " : "Select ") + item.name
            : "Actions for " + item.name
        }
        onClick={selecting ? onSelect : onActions}
      >
        {selecting && selected ? (
          <Check size={21} />
        ) : (
          <MoreHorizontal size={21} />
        )}
      </button>
    </article>
  );
}
