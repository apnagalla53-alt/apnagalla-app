import { trackExperience } from '../experience/experienceEvents';
import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import QuickBillCandidate from './QuickBillCandidate';
import {
  MobileSelect,
  Sheet,
  LoadingState,
} from "../components/MobileControls";
/**
 * EVOLIX Retail V1 — New Bill / POS Screen
 *
 * The MOST IMPORTANT screen. Must feel extremely fast.
 * Search/scan → Add items → Qty controls → Sticky total → PAY
 */
import { useState, useRef, useEffect } from "react";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { useBillStore, useSaleCompleteStore } from "../retailStore";
import { useBillingPreferences } from '../settings/useBillingPreferences';
import RetailLineConfigurator from "./RetailLineConfigurator";
import BillTaxSummary from './BillTaxSummary';
import {stockWarning} from './stockWarning';
import QuickCreateItemSheet from '../experience/QuickCreateItemSheet';
import api from '../../shared/api';
import { AttachmentPicker } from "../../shared/components/AttachmentPicker";
import {
  itemApi,
  khataApi,
  posApi,
  type RetailItem,
  type RetailCustomer,
} from "../retailApi";
import {
  Search,
  Minus,
  Plus,
  ChevronRight,
  User,
  Trash2,
  Pause,
  Receipt,
} from "lucide-react";

const RetailNewBill = ({ quick = false }: { quick?: boolean }) => {
  useUiLanguage();
  const navigate = useNavigate();
  const billingPrefs = useBillingPreferences();
  const enterLock = useRef(false);
  useEffect(() => { if (!useBillStore.getState().savedSale) useSaleCompleteStore.getState().clearCompletedSale(); }, []);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const requestedCustomer = searchParams.get('customer');
  const gstRequested = searchParams.get('gst') === '1';
  useEffect(()=>{if(gstRequested)useBillStore.getState().setGstWorkflow(true);},[gstRequested]);
  useEffect(()=>{trackExperience('first_bill_started',{workflow:'BILL'});if(useBillStore.getState().items.length)trackExperience('bill_resumed',{workflow:'BILL'});},[]);
  const [customerPrefillLoading, setCustomerPrefillLoading] = useState(false);
  const [customerPrefillError, setCustomerPrefillError] = useState('');
  const [customerPrefillRetry, setCustomerPrefillRetry] = useState(0);

  useEffect(() => {
    if (!requestedCustomer || useBillStore.getState().customer?.id === requestedCustomer) { setCustomerPrefillLoading(false); setCustomerPrefillError(''); return; }
    let active = true;
    setCustomerPrefillLoading(true); setCustomerPrefillError('');
    useBillStore.getState().setCustomer(null);
    khataApi.getTimeline(requestedCustomer).then(response => {
      if (!active) return;
      const party = response.data.data.customer;
      if (party.id !== requestedCustomer || party.active === false) throw new Error('Customer unavailable');
      useBillStore.getState().setCustomer({ ...party, balance: Number(response.data.data.balance) });
    }).catch(() => { if (active) setCustomerPrefillError('Could not load this customer. Retry or open Khata to choose a customer.'); })
      .finally(() => { if (active) setCustomerPrefillLoading(false); });
    return () => { active = false; };
  }, [requestedCustomer, customerPrefillRetry]);

  // Bill state from store
  const {
    items: billItems,
    customer,
    savedSale,
    details,
    setDetails,
    setAttachment,
    discount: billDiscount,
    addItem,
    removeItem,
    updateQuantity,
    setCustomer,
    getTotal,
    getItemCount,
    clearBill,
  } = useBillStore();

  // Local UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RetailItem[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showCustomerSheet, setShowCustomerSheet] = useState(false);
  const [showItemEdit, setShowItemEdit] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<RetailCustomer[]>([]);
  const [itemOffset, setItemOffset] = useState(0),
    [itemMore, setItemMore] = useState(false),
    [customerOffset, setCustomerOffset] = useState(0),
    [customerMore, setCustomerMore] = useState(false),
    [customerError, setCustomerError] = useState(""),
    [customerRetry, setCustomerRetry] = useState(0);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerMobile, setNewCustomerMobile] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchRetry, setSearchRetry] = useState(0);
  const [editingCandidate,setEditingCandidate]=useState<import('../retailStore').BillLineItem|null>(null);
  const [quickItem,setQuickItem]=useState(false),[unknownBarcode,setUnknownBarcode]=useState<string|undefined>();
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [configure, setConfigure] = useState<{
    itemId: string;
    rowId?: string;
    initialQuantity?:number;
  } | null>(null);
  const [stockDetails,setStockDetails]=useState<Record<string,any>>({}),[draftQuote,setDraftQuote]=useState<any>(null);
  const stockIds=[...new Set(billItems.filter(i=>!i.new_item).map(i=>i.item_id))].sort().join(',');
  useEffect(()=>{let active=true;const ids=stockIds.split(',').filter(Boolean);if(ids.length)void Promise.all(ids.map(async id=>{try{return [id,(await api.get('/retail/items/'+id+'/options')).data] as const;}catch{return [id,null] as const;}})).then(entries=>{if(active)setStockDetails(Object.fromEntries(entries));});return()=>{active=false;};},[stockIds]);

  // Remove autofocus on mount to prevent keyboard from popping up on mobile
  useEffect(() => {
    // Focus manually when user taps search
  }, []);

  // Debounced search for items
  useEffect(() => {
    let active = true;
    setSearchLoading(true);
    setSearchError("");
    const fetchItems = async () => {
      if (!showSearchResults) {
        setSearchLoading(false);
        return;
      }
      try {
        const res = await itemApi.getItems(searchQuery, itemOffset);
        if(searchQuery.trim()&&itemOffset===0){trackExperience('item_search_used',{workflow:'BILL'});if(!res.data.data.length)trackExperience('item_search_no_result',{workflow:'BILL'});}
        if (active) {
          setSearchResults((p) =>
            itemOffset ? [...p, ...res.data.data] : res.data.data,
          );
          setItemMore(res.data.data.length === 100);
        }
      } catch (e) {
        if (active) {
          setSearchResults([]);
          setSearchError("Could not load items. Try searching again.");
        }
      } finally {
        if (active) setSearchLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchItems, 300);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [searchQuery, searchRetry, showSearchResults, itemOffset]);

  // Debounced search for customers
  useEffect(() => {
    let active = true;
    const fetchCustomers = async () => {
      try {
        const res = await khataApi.getCustomers(customerSearch, customerOffset);
        if (active) {
          setCustomers((p) =>
            customerOffset ? [...p, ...res.data.data] : res.data.data,
          );
          setCustomerMore(res.data.data.length === 100);
        }
      } catch (e) {
        if (active)
          setCustomerError(
            "Could not load customers. Check your connection and try again.",
          );
      } finally {
        if (active) setLoadingCustomers(false);
      }
    };

    if (showCustomerSheet) {
      setLoadingCustomers(true);
      setCustomerError("");
      const timeoutId = setTimeout(fetchCustomers, 300);
      return () => {
        active = false;
        clearTimeout(timeoutId);
      };
    }
    return undefined;
  }, [customerSearch, showCustomerSheet, customerOffset, customerRetry]);

  const handleAddItem = (item: RetailItem,quantity=1) => {
    if (
      item.inventory_tracking !== false &&
      item.current_stock <= 0 &&
      !item.is_bundle &&
      item.item_type !== "SERVICE" &&
      item.selling_mode !== "SERVICE"
    ) {
      // Do not allow adding out-of-stock items
      return;
    }
    if (
      item.is_bundle ||
      item.has_modifiers ||
      item.has_variants ||
      item.has_unit_conversions ||
      item.track_batch ||
      item.track_serial ||
      ["AREA", "VOLUME", "WEIGHT", "LENGTH"].includes(item.selling_mode || "")
    )
      setConfigure({ itemId: item.id,initialQuantity:quantity });
    else addItem(item,quantity);
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const handleCustomerSelect = (c: RetailCustomer) => {
    setCustomer(c as any); // temporary cast if store expects old interface
    setShowCustomerSheet(false);
    setCustomerSearch("");
  };

  const enterSearch = async () => {
    const query = searchQuery.trim();
    if (!query || enterLock.current) return;
    enterLock.current = true;
    setSearchError('');
    try {
      const response = await itemApi.getItems(query);
      const matches: RetailItem[] = response.data.data;
      const exact = billingPrefs.enabled ? matches.filter(item => item.barcode === query) : [];
      if (exact.length === 1) handleAddItem(exact[0]);
      else if (matches.length === 1) handleAddItem(matches[0]);
      else { setUnknownBarcode(billingPrefs.enabled&&matches.length===0&&/^[0-9]{8,14}$/.test(query)?query:undefined);setSearchResults(matches); setItemOffset(0); setShowSearchResults(true); }
    } catch { setSearchError('Could not load items. Try searching again.'); setShowSearchResults(true); }
    finally { enterLock.current = false; }
  };

  const handleNewCustomerSave = async () => {
    if (!newCustomerName.trim()) return;
    try {
      const res = await khataApi.createCustomer({
        name: newCustomerName.trim(),
        mobile: newCustomerMobile.trim(),
      });
      if (res.data?.data) {
        setCustomer(res.data.data as any);
      }
    } catch (e) {
      // The shared API banner displays the request failure without logging tokens.
      return;
    }
    setShowCustomerSheet(false);
    setShowNewCustomerForm(false);
    setNewCustomerName("");
    setNewCustomerMobile("");
    setCustomerSearch("");
  };

  const total = draftQuote?Number(draftQuote.grand_total):getTotal();
  const itemCount = getItemCount();

  // Get the currently editing bill item
  const editingItem = showItemEdit
    ? billItems.find((i) => i.item_id === showItemEdit)
    : null;

  if (savedSale) return <Navigate to="/retail/payment" replace />;

  return (
    <div className="r-stitch-bill-layout" style={{paddingBottom:140}}>
      {/* Header */}
      <StitchHeader className="r-page-header">
        <h1>{ui(gstRequested ? 'New GST Bill' : quick ? 'Quick Bill' : 'New Bill')}</h1>
        <div className="r-page-header-action">
          {billItems.length > 0 && (
            <button
              className="r-btn r-btn--ghost r-btn--sm"
              onClick={async () => {
                try {
                  if(billItems.some(i=>i.new_item)){navigate("/retail/home");return;}
                  await posApi.holdBill("default-branch", billItems, {
                    customer_id: customer?.id,
                    bill_discount: billDiscount,
                    note: details.note,
                  });
                  clearBill();
                  navigate("/retail/home");
                } catch (e) {
                  // The shared API banner displays the request failure without logging tokens.
                  alert("Failed to hold bill");
                }
              }}
              id="hold-bill-btn"
            >
              <Pause size={16} />{ui(billItems.some(i=>i.new_item)?'Save device draft':'Hold')}</button>
          )}
        </div>
      </StitchHeader>
      {gstRequested && <p className="r-caption">{ui('Use items with the correct GST rate and HSN/SAC configured in Items. Tax comes from those settings; it cannot be added to a saved bill later.')}</p>}
      {/* Customer Selector */}
      <div className="r-section">
        {customerPrefillLoading && <p role="status">{ui("Loading customer…")}</p>}
        {customerPrefillError && <div className="r-card" role="alert"><p>{customerPrefillError}</p><button className="r-btn r-btn--outline" onClick={() => setCustomerPrefillRetry(value => value + 1)}>{ui("Retry Customer")}</button></div>}
        <button
          className="r-card r-card--tappable r-flex r-items-center r-gap-md r-w-full"
          onClick={() => setShowCustomerSheet(true)}
          id="customer-selector"
          style={{ textAlign: "left" }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--r-bg-grey)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--r-text-muted)",
              flexShrink: 0,
            }}
          >
            <User size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--r-text-base)", fontWeight: 500 }}>
              {customer ? customer.name : ui("Walk-in Customer")}
            </div>
            {customer?.mobile && (
              <div
                style={{
                  fontSize: "var(--r-text-sm)",
                  color: "var(--r-text-muted)",
                }}
              >
                {customer.mobile}
              </div>
            )}
          </div>
          <ChevronRight size={18} style={{ color: "var(--r-text-hint)" }} />
        </button>
      </div>
      <div className="r-section r-search-filter">
        <input
          ref={searchRef}
          id="item-search-input"
          className="r-input"
          type="search"
          aria-label="Search bill items"
          placeholder={billingPrefs.enabled ? "Search item / barcode" : "Search item name or SKU"}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void enterSearch(); } }}
          value={searchQuery}
          onChange={(e) => {
            setUnknownBarcode(undefined);setSearchQuery(e.target.value);
            setItemOffset(0);
            setShowSearchResults(true);
          }}
        />
        <button
          className="r-btn r-btn--outline"
          onClick={() => {
            setItemOffset(0);
            setShowSearchResults(true);
          }}
        >
          <Search size={21} />
          Browse
        </button>
      </div>
      {showSearchResults && <section className={'r-card r-inline-item-picker'+(!searchLoading&&!searchError&&!searchResults.length&&searchQuery.trim()&&!unknownBarcode?' r-inline-item-picker--new':'')} aria-label="Choose Item">
        <div className="r-section-heading"><h2>Choose Item</h2><button type="button" className="r-btn" onClick={()=>setShowSearchResults(false)}>Close</button></div>
        {searchLoading ? (
          <LoadingState label="Searching items…" />
        ) : searchError ? (
          <div role="alert">
            <p>{searchError}</p>
            <button
              className="r-btn"
              onClick={() => setSearchRetry((n) => n + 1)}
            >
              Retry Search
            </button>
          </div>
        ) : (
          <div className="r-sheet-options">
            {searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className="r-sheet-option r-list-item"
                disabled={
                  item.inventory_tracking !== false &&
                  item.current_stock <= 0 &&
                  !item.is_bundle &&
                  item.item_type !== "SERVICE"
                }
                onClick={() => handleAddItem(item)}
              >
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.item_type === 'SERVICE'
                      ? 'Service · ' + item.unit
                      : item.is_bundle
                      ? 'Bundle · component stock'
                      : item.inventory_tracking === false
                      ? "Stock not counted"
                      : item.current_stock + " " + item.unit}
                  </small>
                </span>
                <strong>₹{item.selling_price}</strong>
              </button>
            ))}
          </div>
        )}
        {!searchLoading && !searchError && !searchResults.length && (
          <div className={searchQuery.trim()&&!unknownBarcode?'r-new-bill-item':'r-empty'}>
            {(!searchQuery.trim()||unknownBarcode)&&<><h3>No items found</h3><p>Enter quantity, unit and price below. Stock setup can wait.</p></>}
            {searchQuery.trim() && !unknownBarcode && <QuickBillCandidate key={searchQuery.trim()} name={searchQuery.trim()} onAdded={()=>{setSearchQuery('');setShowSearchResults(false);}}/>}
            {searchQuery.trim() && unknownBarcode && <button className="r-btn r-btn--primary" onClick={()=>{setShowSearchResults(false);setQuickItem(true);}}>+ Add & Sell</button>}
            <button
              className="r-btn"
              onClick={() =>
                navigate(
                  "/retail/needs?name=" + encodeURIComponent(searchQuery),
                )
              }
            >
              Add to Need List
            </button>
          </div>
        )}
        {itemMore && !searchLoading && !searchError && (
          <button
            className="r-btn r-w-full"
            onClick={() => setItemOffset((n) => n + 100)}
          >
            Load More Items
          </button>
        )}
      </section>}
      {quickItem&&<QuickCreateItemSheet name={unknownBarcode?'':searchQuery.trim()} barcode={unknownBarcode} onClose={()=>setQuickItem(false)} onCreated={({item,quantity})=>{handleAddItem(item,quantity);setQuickItem(false);setUnknownBarcode(undefined);}}/>}
      {editingCandidate&&<Sheet open onClose={()=>setEditingCandidate(null)} title="Edit bill item"><QuickBillCandidate name={editingCandidate.name} existing={editingCandidate} onAdded={()=>setEditingCandidate(null)}/></Sheet>}
      {quick&&<button type="button" className="r-btn r-btn--outline" onClick={()=>navigate("/retail/amount-sale")}>Amount-only sale</button>}
      {/* Bill Items */}

      <div className="r-section">
<h2 className="r-stitch-active-bill">{ui("Active Bill Items")} <span>{billItems.length} {ui("lines")} · {itemCount} {ui("units")}</span></h2>
        {billItems.length === 0 ? (
          <div className="r-empty" style={{ paddingTop: "var(--r-space-2xl)" }}>
            <Receipt size={48} style={{ color: "var(--r-text-hint)" }} />
            <p style={{ marginTop: "var(--r-space-md)" }}>
              {billingPrefs.enabled ? 'Search or scan items to start billing' : 'Search items to start billing'}
            </p>
          </div>
        ) : (
          billItems.map((item) => (
            <div
              className="r-bill-item"
              key={item.row_id || item.item_id}
              id={`bill-item-${item.row_id || item.item_id}`}
            >
              <div
                className="r-bill-item-info"
                style={{
                  minWidth: 0,
                  flex: 1,
                  paddingRight: "var(--r-space-sm)",
                }}
              >
                <div className="r-bill-item-name r-truncate">{item.name}</div>
                <button
                  className="r-btn r-btn--sm"
                  onClick={() =>
                    item.new_item ? setEditingCandidate(item) : setConfigure({ itemId: item.item_id, rowId: item.row_id })
                  }
                >{ui("Edit line")}</button>
                <div className="r-bill-item-price">
                  ₹{item.rate} × {item.quantity} {item.unit}
                  {item.discount_amount > 0 && (
                    <span style={{ color: "var(--r-success)", marginLeft: 4 }}>
                      (-₹{item.discount_amount})
                    </span>
                  )}
                </div>
                {Number(item.tax_rate)>0&&<p className="r-caption">Tax Exclusive · GST {item.tax_rate}% added</p>}
                {stockWarning(stockDetails[item.item_id],item,billItems.filter(l=>l.item_id===item.item_id&&l.row_id!==item.row_id))&&<p className="r-text-danger" role="alert" data-tone="warning">{stockWarning(stockDetails[item.item_id],item,billItems.filter(l=>l.item_id===item.item_id&&l.row_id!==item.row_id))}</p>}
              </div>
              <div className="r-bill-item-right">
                <div className="r-bill-item-total">
                  ₹{item.total.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}
                </div>
                <div className="r-qty-control">
                  <button
                    className="r-qty-btn"
                    aria-label={"Decrease quantity of " + item.name}
                    onClick={() =>
                      updateQuantity(
                        item.row_id || item.item_id,
                        item.quantity - 1,
                      )
                    }
                  >
                    <Minus size={16} />
                  </button>
                  <span className="r-qty-value">{item.quantity}</span>
                  <button
                    className="r-qty-btn"
                    aria-label={"Increase quantity of " + item.name}
                    onClick={() =>
                      updateQuantity(
                        item.row_id || item.item_id,
                        item.quantity + 1,
                      )
                    }
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
<div className="r-section r-stitch-bill-totals"><BillTaxSummary onQuote={setDraftQuote}/></div>
<div className="r-section">
        <details className="r-card">
          <summary>{ui("Bill details & photo")}</summary>
          <div className="r-form-grid">
            <div>
              <label htmlFor="invoice-bill-date">{ui("Bill Date")}</label>
              <input
                id="invoice-bill-date"
                className="r-input"
                type="date"
                value={details.date}
                required
                onChange={(event) => setDetails({ date: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="invoice-due-date">Due Date (optional)</label>
              <input
                id="invoice-due-date"
                className="r-input"
                type="date"
                value={details.due_date}
                onChange={(event) =>
                  setDetails({ due_date: event.target.value })
                }
              />
            </div>
          </div>
          <label htmlFor="invoice-channel">Sales Channel</label>
          <MobileSelect
            id="invoice-channel"
            className="r-select"
            value={details.sales_channel}
            onChange={(event) =>
              setDetails({
                sales_channel: event.target
                  .value as typeof details.sales_channel,
              })
            }
            presentation="segments"
          >
            {["COUNTER", "PHONE", "WHATSAPP", "ONLINE", "OTHER"].map(
              (value) => (
                <option key={value} value={value}>
                  {value[0] + value.slice(1).toLowerCase()}
                </option>
              ),
            )}
          </MobileSelect>
          <label htmlFor="invoice-note">Note (optional)</label>
          <textarea
            id="invoice-note"
            className="r-input"
            maxLength={4000}
            value={details.note}
            onChange={(event) => setDetails({ note: event.target.value })}
          />
          <AttachmentPicker onFileSelect={setAttachment} />
        </details>
      </div>
      {/* Sticky Billing Summary + PAY button */}
      <div className="r-sticky-footer" id="billing-footer">
        <div className="r-counter-total"><small>{ui("Total")} ({billItems.length} {ui("lines")} · {itemCount} {ui("units")})</small><strong>₹{total.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>
        <button
          className="r-btn r-btn--primary-lg"
          onClick={() => navigate("/retail/payment")}
          id="pay-btn"
          style={{ marginTop: billItems.length > 0 ? "var(--r-space-sm)" : 0 }}
          disabled={billItems.length === 0 || customerPrefillLoading || !!customerPrefillError}
        >
          {ui("PAY ₹")}{total.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}
        </button>
      </div>
      {configure && (
        <RetailLineConfigurator
          itemId={configure.itemId}
          existing={billItems.find((i) => i.row_id === configure.rowId)}
          initialQuantity={configure.initialQuantity}
          close={() => setConfigure(null)}
        />
      )}
      {/* ── Customer Bottom Sheet ─────────────────────── */}
      {showCustomerSheet && (
        <Sheet
          open
          onClose={() => {
            setShowCustomerSheet(false);
            setShowNewCustomerForm(false);
          }}
          title={showNewCustomerForm ? "New Customer" : ui("Select Customer")}
        >
          {!showNewCustomerForm ? (
            <>
              {/* Search */}
              <input
                type="text"
                className="r-input r-input--search"
                placeholder="Search customer / mobile"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setCustomerOffset(0);
                }}
                id="customer-search-input"
              />

              {/* Walk-in option */}
              <button
                className="r-list-item"
                onClick={() => {
                  setCustomer(null);
                  setShowCustomerSheet(false);
                }}
                style={{
                  border: "none",
                  background: "none",
                  width: "100%",
                  cursor: "pointer",
                  marginTop: "var(--r-space-sm)",
                }}
              >
                <div className="r-list-item-left">
                  <div className="r-list-item-title">{ui("Walk-in Customer")}</div>
                  <div className="r-list-item-subtitle">
                    No customer details
                  </div>
                </div>
              </button>

              {/* Customer list */}
              {loadingCustomers && <p role="status">Loading customers…</p>}
              {customerError && (
                <p role="alert">
                  {customerError}
                  <button
                    className="r-btn"
                    onClick={() => setCustomerRetry((n) => n + 1)}
                  >{ui("Try Again")}</button>
                </p>
              )}
              {!loadingCustomers &&
                !customerError &&
                customers.length === 0 && (
                  <p>No customers yet. Add a customer below.</p>
                )}
              {customers.filter(c=>c.active!==false).map((c) => (
                <button
                  key={c.id}
                  className="r-list-item"
                  onClick={() => handleCustomerSelect(c)}
                  style={{
                    border: "none",
                    background: "none",
                    width: "100%",
                    cursor: "pointer",
                  }}
                >
                  <div className="r-list-item-left">
                    <div className="r-list-item-title">{c.name}</div>
                    <div className="r-list-item-subtitle">
                      {c.mobile || ui("No mobile")}
                    </div>
                  </div>
                  {c.outstanding_amount > 0 && (
                    <div className="r-list-item-right">
                      <div
                        className="r-list-item-amount"
                        style={{ color: "var(--r-danger)" }}
                      >
                        ₹{c.outstanding_amount.toLocaleString("en-IN")}
                      </div>
                      <span className="r-badge r-badge--danger">Due</span>
                    </div>
                  )}
                </button>
              ))}

              {customerMore && !loadingCustomers && !customerError && (
                <button
                  className="r-btn r-w-full"
                  onClick={() => setCustomerOffset((n) => n + 100)}
                >
                  Load More Customers
                </button>
              )}
              {/* Add new */}
              <div style={{ padding: "var(--r-space-md) 0" }}>
                <button
                  className="r-btn r-btn--outline r-btn--full"
                  onClick={() => setShowNewCustomerForm(true)}
                  id="add-new-customer-btn"
                >
                  <Plus size={18} />
                  Add New Customer
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Quick customer creation */}
              <div className="r-input-group">
                <label className="r-label" htmlFor="new-customer-name">{ui("Customer Name")}</label>
                <input
                  type="text"
                  className="r-input"
                  placeholder="Enter customer name"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  id="new-customer-name"
                />
              </div>
              <div className="r-input-group">
                <label className="r-label" htmlFor="new-customer-mobile">
                  Mobile Number{" "}
                  <span
                    style={{ color: "var(--r-text-muted)", fontWeight: 400 }}
                  >
                    optional
                  </span>
                </label>
                <input
                  type="tel"
                  className="r-input"
                  placeholder="Enter mobile number"
                  value={newCustomerMobile}
                  onChange={(e) => setNewCustomerMobile(e.target.value)}
                  id="new-customer-mobile"
                />
              </div>
              <button
                className="r-btn r-btn--primary-lg"
                onClick={handleNewCustomerSave}
                disabled={!newCustomerName.trim()}
                id="save-select-customer-btn"
                style={{ marginTop: "var(--r-space-md)" }}
              >
                SAVE & SELECT
              </button>
              <button
                className="r-btn r-btn--ghost r-btn--full"
                onClick={() => setShowNewCustomerForm(false)}
                style={{ marginTop: "var(--r-space-sm)" }}
              >
                Back to search
              </button>
            </>
          )}
        </Sheet>
      )}
      {/* ── Item Edit Bottom Sheet ────────────────────── */}
      {showItemEdit && editingItem && (
        <Sheet
          open
          onClose={() => setShowItemEdit(null)}
          title={editingItem.name}
        >
          <div className="r-bottom-sheet-body">
            <div className="r-input-group">
              <span className="r-label">{ui("Quantity")}</span>
              <div className="r-qty-control" style={{ width: "fit-content" }}>
                <button
                  className="r-qty-btn"
                  onClick={() =>
                    updateQuantity(
                      editingItem.item_id,
                      editingItem.quantity - 1,
                    )
                  }
                >
                  <Minus size={16} />
                </button>
                <span className="r-qty-value">{editingItem.quantity}</span>
                <button
                  className="r-qty-btn"
                  onClick={() =>
                    updateQuantity(
                      editingItem.item_id,
                      editingItem.quantity + 1,
                    )
                  }
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="r-input-group">
              <span className="r-label">Rate</span>
              <div style={{ fontSize: "var(--r-text-lg)", fontWeight: 600 }}>
                ₹{editingItem.rate}
              </div>
            </div>

            <div className="r-input-group">
              <label className="r-label" htmlFor="line-discount">{ui("Discount")}</label>
              <input
                type="number"
                className="r-input"
                id="line-discount"
                placeholder="0"
                value={editingItem.discount_amount || ""}
                onChange={(e) => {
                  const disc = parseFloat(e.target.value) || 0;
                  useBillStore
                    .getState()
                    .updateDiscount(editingItem.item_id, disc);
                }}
              />
            </div>

            <button
              className="r-btn r-btn--danger-ghost r-btn--full"
              onClick={() => {
                removeItem(editingItem.item_id);
                setShowItemEdit(null);
              }}
              style={{ marginTop: "var(--r-space-md)" }}
            >
              <Trash2 size={16} />
              Remove Item
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
};

export default RetailNewBill;
