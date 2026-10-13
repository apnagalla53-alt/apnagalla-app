import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
/**
 * EVOLIX Retail V1 — Khata Screen
 *
 * Customer credit tracking.
 * Shows total receivable and customer cards with balances.
 * Simple language: "You'll Receive" instead of "Accounts Receivable"
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, BookOpen } from "lucide-react";
import { khataApi, type RetailCustomer } from "./retailApi";
import RetailSuppliers from "./RetailSuppliers";
import { getApiErrorMessage } from "../shared/api";
import { EmptyState } from "./components/MobileControls";

const RetailKhata = () => {
  useUiLanguage();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<RetailCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("CUSTOMERS");
  const [dueOnly, setDueOnly] = useState(false);
  const [offset, setOffset] = useState(0),
    [more, setMore] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await khataApi.getCustomers(searchQuery, offset);
        if (active) {
          setCustomers((p) => (offset ? [...p, ...r.data.data] : r.data.data));
          setMore(r.data.data.length === 100);
          setError("");
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
  }, [searchQuery, offset]);

  const customersWithBalance = customers.filter(
    (c) => c.outstanding_amount > 0,
  );
  const totalReceivable = customersWithBalance.reduce(
    (sum, c) => sum + c.outstanding_amount,
    0,
  );

  const filtered = searchQuery.trim()
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.code &&
            c.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (c.mobile && c.mobile.includes(searchQuery)),
      )
    : customers;
  const visibleCustomers = filtered.filter(
    (c) => !dueOnly || c.outstanding_amount > 0,
  );

  return (
    <div className="r-stitch-khata">
      <StitchHeader><h1>{ui("Khata")}</h1></StitchHeader>
      <div className="r-section r-segmented r-party-tabs">
        <button
          className={
            "r-btn " +
            (tab === "CUSTOMERS" ? "r-btn--primary" : "r-btn--outline")
          }
          onClick={() => setTab("CUSTOMERS")}
        >{ui("Customers")}</button>
        <button
          className={
            "r-btn " +
            (tab === "SUPPLIERS" ? "r-btn--primary" : "r-btn--outline")
          }
          onClick={() => setTab("SUPPLIERS")}
        >{ui("Suppliers")}</button>
      </div>
      {tab === "SUPPLIERS" ? (
        <RetailSuppliers embedded />
      ) : (
        <>
          {error && (
            <p className="r-section" role="alert">
              {error}
              <button
                className="r-btn"
                onClick={() => window.location.reload()}
              >{ui("Try Again")}</button>
            </p>
          )}
          {loading && (
            <p className="r-section" role="status">
              Loading customers…
            </p>
          )}
          {/* Header */}


          {/* Summary Card */}
          <div className="r-section">
            <label>
              <input
                type="checkbox"
                checked={dueOnly}
                onChange={(e) => setDueOnly(e.target.checked)}
              />{" "}
              Pending dues only
            </label>
            <div className="r-card r-card--primary" id="khata-summary">
              <div className="r-card-title">Due in Loaded Results</div>
              <div className="r-card-value">
                ₹{totalReceivable.toLocaleString("en-IN")}
              </div>
              <div
                style={{
                  fontSize: "var(--r-text-sm)",
                  color: "var(--r-text-secondary)",
                  marginTop: 4,
                }}
              >
                {customersWithBalance.length} customers with pending dues
              </div>
            </div>
          </div>

          <div className="r-section r-party-quick-actions"><button id="add-customer-btn" className="r-btn r-btn--primary" onClick={()=>navigate('/retail/customers/add')}><Plus size={20}/>{ui('Add Customer')}</button><button className="r-btn r-btn--outline" onClick={()=>navigate('/retail/receive-payment')}>{ui('Customer Paid Me')}</button></div>
          {/* Search */}
          <div className="r-search-bar">
            <span className="r-search-icon">
              <Search size={20} />
            </span>
            <input
              type="text"
              placeholder="Search customer"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setOffset(0);
              }}
              id="khata-search"
            />
          </div>

          {/* Customer List */}
          <div className="r-section">
            {!loading && visibleCustomers.length === 0 ? (
              <EmptyState
                Icon={BookOpen}
                title={
                  dueOnly ? "No pending customer dues" : "No customers found"
                }
                description={
                  dueOnly
                    ? "No customer in these results has money left to pay."
                    : searchQuery
                      ? `Try another search or add a customer for "${searchQuery}".`
                      : "Add your first customer to keep their bills and dues together."
                }
                action={dueOnly ? "Show All Customers" : "Add Customer"}
                onAction={() =>
                  dueOnly
                    ? setDueOnly(false)
                    : navigate("/retail/customers/add")
                }
              />
            ) : (
              visibleCustomers.map((customer) => (
                <button
                  type="button"
                  aria-label={"Open " + customer.name}
                  key={customer.id}
                  className="r-list-item"
                  onClick={() => navigate(`/retail/khata/${customer.id}`)}
                  id={`khata-${customer.id}`}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--r-space-md)",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "var(--r-primary-light)",
                        color: "var(--r-primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "var(--r-text-base)",
                        flexShrink: 0,
                      }}
                    >
                      {customer.name[0].toUpperCase()}
                    </div>
                    <div className="r-list-item-left">
                      <div className="r-list-item-title">{customer.name}</div>
                      <div className="r-list-item-subtitle">
                        {customer.mobile || ui("No mobile")}
                      </div>
                    </div>
                  </div>
                  <div className="r-list-item-right">
                    <div
                      style={{
                        fontSize: "var(--r-text-xs)",
                        color: "var(--r-text-muted)",
                      }}
                    >{ui("You'll Receive")}</div>
                    <div
                      className="r-list-item-amount"
                      style={{ color: "var(--r-danger)" }}
                    >
                      ₹{customer.outstanding_amount.toLocaleString("en-IN")}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          {more && (
            <button
              className="r-btn r-w-full"
              disabled={loading}
              onClick={() => setOffset((n) => n + 100)}
            >
              Load More Customers
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default RetailKhata;
