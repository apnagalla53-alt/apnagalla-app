import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
import { Sheet } from "./components/MobileControls";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supplierApi, type RetailSupplier } from "./retailApi";
import "./retail.css";
import RetailPartyForm from "./RetailPartyForm";
import { getApiErrorMessage } from "../shared/api";
import { Building2, Plus, Wallet } from "lucide-react";

export default function RetailSuppliers({embedded=false}:{embedded?:boolean}) {
  useUiLanguage();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<RetailSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [offset, setOffset] = useState(0),
    [more, setMore] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");
  const loadVersion = useRef(0);
  useEffect(() => {
    if (showAdd) {
      const previous = document.activeElement as HTMLElement | null;
      const timer = setTimeout(
        () => document.querySelector<HTMLElement>('[aria-label="Close Add Supplier"]')?.focus(),
        0,
      );
      return () => {
        clearTimeout(timer);
        previous?.focus();
      };
    }
    return undefined;
  }, [showAdd]);

  useEffect(() => {
    const delay = setTimeout(() => {
      loadSuppliers();
    }, 300);
    return () => clearTimeout(delay);
  }, [search, offset]);

  const loadSuppliers = async (position = offset) => {
    const version = ++loadVersion.current;
    try {
      setLoading(true);
      setError("");
      const res = await supplierApi.getSuppliers(search, position);
      if (version !== loadVersion.current) return;
      setSuppliers((p) =>
        position ? [...p, ...res.data.data] : res.data.data,
      );
      setMore(res.data.data.length === 100);
    } catch (err) {
      if (version === loadVersion.current) setError(getApiErrorMessage(err));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  };

  return (
    <div className="retail-page">
      {!embedded&&<StitchHeader><h1>{ui('Suppliers')}</h1></StitchHeader>}
      <div className="retail-content">
        {error && (
          <p role="alert">
            {error}
            <button
              className="r-btn"
              onClick={() => {
                setError("");
                loadSuppliers();
              }}
            >{ui("Try Again")}</button>
          </p>
        )}
        <section className="r-card r-party-overview" aria-busy={loading}><span className="r-caption">{ui('Total Payable in Loaded Results')}</span>{loading?<span role="status">{ui('Loading supplier balances…')}</span>:error?<span>{ui('Supplier balances unavailable')}</span>:<><strong>₹{suppliers.reduce((sum,s)=>sum+Math.max(0,Number(s.outstanding_amount)),0).toLocaleString('en-IN')}</strong><small>{suppliers.filter(s=>s.outstanding_amount>0).length} {ui('Suppliers with pending dues')}</small></>}</section>
        <div className="r-form-grid r-party-quick-actions"><button className="r-btn r-btn--primary" onClick={()=>setShowAdd(true)}><Plus size={20}/>{ui('Add Supplier')}</button><button className="r-btn r-btn--outline" onClick={()=>navigate('/retail/pay-supplier')}><Wallet size={20}/>{ui('Make Payment')}</button></div>
        <label className="r-visually-hidden" htmlFor="supplier-search">{ui('Search suppliers')}</label><input id="supplier-search" className="r-input" type="search" placeholder={ui('Search supplier name or mobile')} value={search} onChange={e=>{setLoading(true);setSearch(e.target.value);setOffset(0);}}/>
        <div className="r-segmented r-party-filters"><button className={dueOnly?'active':''} aria-pressed={dueOnly} onClick={()=>setDueOnly(true)}>{ui('Pending Only')}</button><button className={!dueOnly?'active':''} aria-pressed={!dueOnly} onClick={()=>setDueOnly(false)}>{ui('All suppliers')}</button></div>
        {loading ? (
          <div className="empty-state" role="status">
            Loading suppliers…
          </div>
        ) : suppliers.filter(
            (supplier) => !dueOnly || supplier.outstanding_amount > 0,
          ).length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Building2 size={42} />
            </div>
            <p>{ui("No suppliers found")}</p>
            <p className="r-caption">
              Add who you buy from to keep bills and dues together.
            </p>
            <button
              className="r-btn r-btn--primary"
              onClick={() => setShowAdd(true)}
            >{ui("Add Supplier")}</button>
          </div>
        ) : (
          <div className="item-list">
            {suppliers
              .filter((supplier) => !dueOnly || supplier.outstanding_amount > 0)
              .map((sup) => (
                <button
                  key={sup.id}
                  className="item-card r-party-card"
                  onClick={() => navigate(`/retail/suppliers/${sup.id}`)}
                >
                  <div className="item-info">
                    <div className="item-name">{sup.name}</div>
                    <div className="item-meta">{sup.mobile || "No phone"}</div>
                  </div>
                  <div
                    className="item-price"
                    style={{
                      color:
                        sup.outstanding_amount > 0
                          ? "var(--r-danger)"
                          : "var(--r-text-secondary)",
                      textAlign: "right",
                    }}
                  >
                    <div className="r-caption">You Have to Pay</div>₹
                    {Math.abs(sup.outstanding_amount).toFixed(2)}
                    {sup.outstanding_amount <= 0 && (
                      <span className="r-status-badge is-enabled">No due</span>
                    )}
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>

      {more && (
        <button
          className="r-btn r-w-full"
          disabled={loading}
          onClick={() => setOffset((n) => n + 100)}
        >
          Load More Suppliers
        </button>
      )}
      {showAdd && (
        <Sheet open onClose={() => setShowAdd(false)} title={ui("Add Supplier")}>
          <RetailPartyForm
            supplier
            onSaved={() => {
              setShowAdd(false);
              setOffset(0);
              void loadSuppliers(0);
            }}
          />
        </Sheet>
      )}

      <button
        className="fab"
        aria-label={ui("Add Supplier")}
        onClick={() => setShowAdd(true)}
      >
        <Plus size={22} />{ui("Supplier")}</button>
    </div>
  );
}
