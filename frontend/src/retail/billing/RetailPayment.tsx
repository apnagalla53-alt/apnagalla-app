import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
/**
 * EVOLIX Retail V1 — Payment Screen
 *
 * Large amount at top → Payment methods → Cash/UPI/Udhar/Split flows
 * Single CTA: COMPLETE SALE / SAVE AS UDHAR
 */
import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { getApiErrorMessage } from "../../shared/api";
import api from "../../shared/api";
import { notifyPayment } from "../payments/paymentVoice";
import UpiQr from "../payments/UpiQr";
import {TaxBreakdown} from './BillTaxSummary';
import ManualUpiConfirmation from '../payments/ManualUpiConfirmation';
import { useOptionalPhotoUpload } from '../../shared/useOptionalPhotoUpload';
import { SelectionSheet } from "../components/MobileControls";
import {
  ArrowLeft,
  Banknote,
  Smartphone,
  Clock,
  Divide,
  Check,
} from "lucide-react";
import {
  useBillStore,
  useSaleCompleteStore,
  type PaymentSplit,
} from "../retailStore";
import { khataApi, posApi, type RetailCustomer } from "../retailApi";

type PaymentMode = "CASH" | "UPI" | "UDHAR" | "SPLIT";

const RetailPayment = () => {
  useUiLanguage();
  const navigate = useNavigate();
  const {
    items,
    discount: billDiscount,
    setBillDiscount,
    customer,
    details,
    attachment,
    savedSale,
    setSavedSale,
    getTotal,
    getItemCount,
    setCustomer,
    setDetails,
  } = useBillStore();
  const { setCompletedSale } = useSaleCompleteStore();

  const [quote, setQuote] = useState<number | null>(null);
  const [taxQuote,setTaxQuote]=useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const total = quote ?? getTotal();
  const itemCount = getItemCount();

  const [selectedMode, setSelectedMode] = useState<PaymentMode | null>(
    savedSale
      ? savedSale.mode === "Cash"
        ? "CASH"
        : savedSale.mode === "UPI"
          ? "UPI"
          : savedSale.mode === "Udhar"
            ? "UDHAR"
            : "SPLIT"
      : null,
  );

  // Cash state
  const [cashReceived, setCashReceived] = useState("");
  const cashAmount = parseFloat(cashReceived) || 0;
  const cashChange = Math.max(0, cashAmount - total);

  // UPI state (simple confirmation)

  // Udhar state
  const [showUdharCustomerSelect, setShowUdharCustomerSelect] = useState(false);

  // Split state
  const [splitCash, setSplitCash] = useState("");
  const [splitUPI, setSplitUPI] = useState("");
  const [splitUdhar, setSplitUdhar] = useState(false);
  const splitCashAmt = Math.round((Number(splitCash) || 0) * 100) / 100;
  const splitUPIAmt = Math.round((Number(splitUPI) || 0) * 100) / 100;
  const splitPaidPaise = Math.round(splitCashAmt * 100) + Math.round(splitUPIAmt * 100);
  const totalPaise = Math.round(total * 100);
  const splitRemaining = Math.max(0, totalPaise - splitPaidPaise) / 100;
  const validSplitAmounts = [splitCash, splitUPI].every(value => {
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001;
  });
  const splitHasCredit = splitUdhar && splitRemaining > 0;
  const customerBalance = Number(customer?.balance || 0);
  const [customers, setCustomers] = useState<RetailCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOffset, setCustomerOffset] = useState(0);
  const [moreCustomers, setMoreCustomers] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [customerRetry, setCustomerRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const photoUpload = useOptionalPhotoUpload();
  const [upiConfirmed, setUpiConfirmed] = useState(false);
  useEffect(()=>{photoUpload.select(attachment || null);},[attachment]);
  useEffect(()=>{setUpiConfirmed(false);},[selectedMode, quote, splitUPI]);

  useEffect(() => {
    let active = true;
    setQuoteLoading(true);
    setQuote(null);
    setTaxQuote(null);
    if (savedSale) {
      setQuote(Number(savedSale.invoice.grand_total));
      setTaxQuote(savedSale.invoice);
      setQuoteLoading(false);
      return;
    }
    if (!items.length) {
      setQuoteLoading(false);
      return;
    }
    const body = {
      items: items.map((i) => ({
        item_id: i.item_id,
        variant_id: i.variant_id,
        batch_id: i.batch_id,
        unit_id: i.unit_id,
        dimensions: i.dimensions,
        serial_ids: i.serial_ids,
        modifier_option_ids: i.modifier_option_ids,
        quantity: i.quantity,
        rate: i.rate,
        discount_amount: i.discount_amount,
      })),
      customer_id: customer?.id,
      date: details.date,
      payment_splits: [],
      bill_discount: billDiscount,
    };
    api
      .post("/retail/bills/quote", body)
      .then((r) => {
        if (active) {
          setQuote(Number(r.data.grand_total));
          setTaxQuote(r.data);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (active) setQuoteLoading(false);
      });
    return () => {
      active = false;
    };
  }, [items, customer?.id, details.date, savedSale, billDiscount]);

  useEffect(() => {
    if (!showUdharCustomerSelect) return;
    let active = true;
    setLoadingCustomers(true);
    setCustomerError("");
    const timer = setTimeout(() => {
      khataApi
        .getCustomers(customerSearch, customerOffset)
        .then((res) => {
          if (!active) return;
          const rows = res.data?.data || [];
          setCustomers((previous) =>
            customerOffset ? [...previous, ...rows] : rows,
          );
          setMoreCustomers(rows.length === 100);
        })
        .catch((e) => {
          if (active) setCustomerError(getApiErrorMessage(e));
        })
        .finally(() => {
          if (active) setLoadingCustomers(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [showUdharCustomerSelect, customerSearch, customerOffset, customerRetry]);

  // Redirect if no items
  if (items.length === 0) {
    return <Navigate to="/retail/bill" replace />;
  }

  const handleCompleteSale = async (
    mode: string,
    payments?: PaymentSplit[],
  ) => {
    if (saving || quoteLoading || quote === null) return;
    if (!savedSale && (selectedMode==='UPI' || selectedMode==='SPLIT' && splitUPIAmt>0) && !upiConfirmed) return;
    setSaving(true);
    setError("");
    try {
      // POST to actual backend POS endpoint
      const res = savedSale
        ? { data: savedSale.invoice }
        : await posApi.postSale({
            items: items.map((i) => ({
              item_id: i.item_id,
              variant_id: i.variant_id,
              batch_id: i.batch_id,
              unit_id: i.unit_id,
              dimensions: i.dimensions,
              serial_ids: i.serial_ids,
              modifier_option_ids: i.modifier_option_ids,
              quantity: i.quantity,
              rate: i.rate,
              discount_amount: i.discount_amount,
            })),
            customer_id: customer?.id,
            payment_splits:
              payments ||
              (mode === "Udhar"
                ? []
                : [{ method: mode.toUpperCase(), amount: total }]),
            total_amount: total,
            discount: items.reduce((acc, i) => acc + i.discount_amount, 0),
            bill_discount: billDiscount,
            date: details.date,
            due_date: (mode === "Udhar" || (selectedMode === "SPLIT" && splitHasCredit)) ? details.due_date || undefined : undefined,
            note: details.note || undefined,
            sales_channel: details.sales_channel,
          });
      if (!res.data?.id || !res.data?.document_number)
        throw new Error("Sale confirmation missing");
      const completedMode = savedSale?.mode || mode;
      setSavedSale({ invoice: res.data, mode: completedMode });
      if (completedMode !== "Udhar") void notifyPayment(res.data.id, Number(res.data.paid_amount));
      await photoUpload.upload('SALES_INVOICE',res.data.id,'SALE_PROOF');
      setCompletedSale({
        gst_workflow: useBillStore.getState().gstWorkflow,
        invoice_id: res.data.id,
        invoice_number: res.data.document_number,
        amount: Number(res.data.grand_total),
        payment_mode: completedMode,
        customer_name: customer?.name || "Walk-in Customer",
        items_count: itemCount,
        lines_count: items.length,
        timestamp: new Date(),
      });

      navigate("/retail/sale-complete", { replace: true });
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const paymentMethods = [
    {
      mode: "CASH" as PaymentMode,
      label: "Cash",
      icon: Banknote,
      color: "var(--r-success)",
    },
    {
      mode: "UPI" as PaymentMode,
      label: "UPI",
      icon: Smartphone,
      color: "var(--r-info)",
    },
    {
      mode: "UDHAR" as PaymentMode,
      label: "Udhar",
      icon: Clock,
      color: "var(--r-warning)",
    },
    {
      mode: "SPLIT" as PaymentMode,
      label: "Split",
      icon: Divide,
      color: "var(--r-primary)",
    },
  ];

  return (
    <div
      className="r-page-with-sticky r-stitch-payment"
      style={{ paddingBottom: selectedMode ? 100 : 16 }}
    >
      {error && (
        <div className="r-card" role="alert">
          {photoUpload.failed ? "Bill saved. Photo upload needs retry. " : ""}
          {error}
          {photoUpload.failed && savedSale && (
            <button
              className="r-btn r-btn--outline"
              onClick={() => {
                setCompletedSale({
                  gst_workflow: useBillStore.getState().gstWorkflow,
                  invoice_id: savedSale.invoice.id,
                  invoice_number: savedSale.invoice.document_number,
                  amount: Number(savedSale.invoice.grand_total),
                  payment_mode: savedSale.mode,
                  customer_name: customer?.name || "Walk-in Customer",
                  items_count: itemCount,
                  lines_count: items.length,
                  timestamp: new Date(),
                });
                navigate("/retail/sale-complete", { replace: true });
              }}
            >
              Continue without photo
            </button>
          )}
        </div>
      )}
      {quoteLoading && (
        <p className="r-section" role="status">
          Checking bill prices and tax…
        </p>
      )}
      {/* Header */}
      <StitchHeader className="r-page-header" hasBack>
        <button
          className="r-btn r-btn--icon"
          aria-label="Back to bill"
          disabled={saving || !!savedSale}
          onClick={() => navigate("/retail/bill")}
        >
          <ArrowLeft size={22} />
        </button>
        <h1>{ui("Payment")}</h1>
        <div style={{ width: 48 }} />
      </StitchHeader>

      {/* Amount to Pay */}
      <div className="r-card r-stitch-payment-total">
        <div
          style={{
            fontSize: "var(--r-text-sm)",
            color: "var(--r-text-muted)",
            marginBottom: 4,
          }}
        >
          Amount to Pay
        </div>
        <div
          style={{
            fontSize: "var(--r-text-4xl)",
            fontWeight: 800,
            color: "var(--r-text)",
            letterSpacing: "-0.03em",
          }}
        >
          ₹{total.toLocaleString("en-IN")}
        </div>
        <div
          style={{
            fontSize: "var(--r-text-sm)",
            color: "var(--r-text-muted)",
            marginTop: 4,
          }}
        >
          {items.length} lines · {itemCount} units · {customer?.name || "Walk-in"}
        </div>
      </div>

      {/* Payment Methods */}
      <div className="r-section"><TaxBreakdown quote={taxQuote} rates={items.map(i=>Number(i.tax_rate||0))}/></div>
      {!savedSale && <div className="r-section r-input-group">
        <label className="r-label" htmlFor="bill-discount">Bill discount (optional)</label>
        <input id="bill-discount" className="r-input" type="number" min="0" step="0.01"
          disabled={saving} value={billDiscount || ''} placeholder="₹0"
          onChange={e => setBillDiscount(Math.max(0, Number(e.target.value) || 0))}/>
        <p className="r-caption">Applied across the items before tax. The bill total updates after checking prices.</p>
      </div>}
      {!savedSale && (
        <div className="r-stitch-payment-method-wrap">
          <div className="r-payment-methods">
            {paymentMethods.map(({ mode, label, icon: Icon, color }) => (
              <button
                key={mode}
                className={'r-payment-method'+(selectedMode===mode?' is-selected':'')}
                aria-pressed={selectedMode===mode}
                disabled={saving}
                onClick={() => {
                  if (mode === "UDHAR" && !customer) {
                    setShowUdharCustomerSelect(true);
                    return;
                  }
                  setSelectedMode(mode);
                }}
                id={`pay-${mode.toLowerCase()}`}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "var(--r-radius)",
                    background: `${color}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={24} style={{ color }} />
                </div>
                <span>{ui(label)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── CASH Flow ─────────────────────────────────── */}
      {selectedMode === "UPI" && quote !== null && (
        <div className="r-section">
          <UpiQr amount={total} />
        </div>
      )}
      {selectedMode === "CASH" && (
        <div className="r-card r-stitch-cash-payment">
          <button
            className="r-btn r-btn--ghost r-btn--sm r-stitch-change-method"
            onClick={() => {
              if (!savedSale) setSelectedMode(null);
            }}
            disabled={saving || !!savedSale}
            style={{ marginBottom: "var(--r-space-lg)" }}
          >
            <ArrowLeft size={16} /> Change method
          </button>

          <div className="r-input-group">
            <label className="r-label" htmlFor="cash-received-input">Amount Received</label>
            <input
              type="number"
              className="r-input r-input--lg"
              placeholder={total.toString()}
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              autoFocus
              id="cash-received-input"
            />
          </div>

          {cashAmount > 0 && cashAmount >= total && (
            <div
              className="r-card r-card--primary-light"
              style={{ marginTop: "var(--r-space-md)" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{ color: "var(--r-text-secondary)", fontWeight: 500 }}
                >
                  Change to return
                </span>
                <span
                  style={{
                    fontSize: "var(--r-text-xl)",
                    fontWeight: 700,
                    color: "var(--r-primary)",
                  }}
                >
                  ₹{cashChange.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          )}

          {/* Quick amount buttons */}
          <div
            style={{
              display: "flex",
              gap: "var(--r-space-sm)",
              marginTop: "var(--r-space-lg)",
              flexWrap: "wrap",
            }}
          >
            {[
              total,
              Math.ceil(total / 100) * 100,
              Math.ceil(total / 500) * 500,
              2000,
            ]
              .filter((v, i, a) => a.indexOf(v) === i && v >= total)
              .slice(0, 4)
              .map((amt) => (
                <button
                  key={amt}
                  className={`r-chip ${cashAmount === amt ? "r-chip--active" : ""}`}
                  onClick={() => setCashReceived(amt.toString())}
                >
                  ₹{amt.toLocaleString("en-IN")}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* ── UPI Flow ──────────────────────────────────── */}
      {selectedMode === "UPI" && (
        <div style={{ padding: "var(--r-space-lg) var(--r-space-base)" }}>
          <button
            className="r-btn r-btn--ghost r-btn--sm"
            onClick={() => {
              if (!savedSale) setSelectedMode(null);
            }}
            disabled={saving || !!savedSale}
            style={{ marginBottom: "var(--r-space-lg)" }}
          >
            <ArrowLeft size={16} /> Change method
          </button>

          <div
            className="r-card"
            style={{ textAlign: "center", padding: "var(--r-space-2xl)" }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--r-info-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto var(--r-space-lg)",
              }}
            >
              <Smartphone size={28} style={{ color: "var(--r-info)" }} />
            </div>
            <div
              style={{
                fontSize: "var(--r-text-lg)",
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              {ui('Record UPI already received')}
            </div>
            <div
              style={{
                color: "var(--r-text-muted)",
                fontSize: "var(--r-text-sm)",
              }}
            >
              Confirm the customer has paid ₹{total.toLocaleString("en-IN")} via
              UPI
            </div>
          </div>
          {!savedSale && <ManualUpiConfirmation checked={upiConfirmed} onChange={setUpiConfirmed}/>}
        </div>
      )}

      {/* ── UDHAR Flow ────────────────────────────────── */}
      {selectedMode === "UDHAR" && (
        <div style={{ padding: "var(--r-space-lg) var(--r-space-base)" }}>
          <button
            className="r-btn r-btn--ghost r-btn--sm"
            onClick={() => {
              if (!savedSale) setSelectedMode(null);
            }}
            disabled={saving || !!savedSale}
            style={{ marginBottom: "var(--r-space-lg)" }}
          >
            <ArrowLeft size={16} /> Change method
          </button>

          <div className="r-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "var(--r-space-md)",
              }}
            >
              <span style={{ color: "var(--r-text-secondary)" }}>{ui("Customer")}</span>
              <span style={{ fontWeight: 600 }}>{customer?.name}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "var(--r-space-md)",
              }}
            >
              <span style={{ color: "var(--r-text-secondary)" }}>
                Existing Balance
              </span>
              <span
                style={{
                  fontWeight: 600,
                  color: customerBalance
                    ? "var(--r-danger)"
                    : "var(--r-text)",
                }}
              >
                ₹
                {customerBalance.toLocaleString(
                  "en-IN",
                )}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "var(--r-space-md)",
              }}
            >
              <span style={{ color: "var(--r-text-secondary)" }}>
                This Bill
              </span>
              <span style={{ fontWeight: 600 }}>
                ₹{total.toLocaleString("en-IN")}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: "var(--r-space-md)",
                borderTop: "1px solid var(--r-divider)",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--r-danger)" }}>
                New Balance
              </span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "var(--r-text-xl)",
                  color: "var(--r-danger)",
                }}
              >
                ₹
                {(
                  customerBalance + total
                ).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── SPLIT Flow ────────────────────────────────── */}
      {selectedMode === "SPLIT" && (
        <div style={{ padding: "var(--r-space-lg) var(--r-space-base)" }}>
          <button
            className="r-btn r-btn--ghost r-btn--sm"
            onClick={() => setSelectedMode(null)}
            disabled={saving || !!savedSale}
            style={{ marginBottom: "var(--r-space-lg)" }}
          >
            <ArrowLeft size={16} /> Change method
          </button>

          <div className="r-input-group">
            <label className="r-label" htmlFor="split-cash-input">
              <Banknote
                size={14}
                style={{ marginRight: 4, verticalAlign: "middle" }}
              />{ui("Cash Amount")}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={saving || !!savedSale}
              className="r-input"
              placeholder="0"
              value={splitCash}
              onChange={(e) => setSplitCash(e.target.value)}
              autoFocus
              id="split-cash-input"
            />
          </div>

          <div className="r-input-group">
            <label className="r-label" htmlFor="split-upi-input">
              <Smartphone
                size={14}
                style={{ marginRight: 4, verticalAlign: "middle" }}
              />{ui("UPI Amount")}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={saving || !!savedSale}
              className="r-input"
              placeholder="0"
              value={splitUPI}
              onChange={(e) => setSplitUPI(e.target.value)}
              id="split-upi-input"
            />
          </div>

          {validSplitAmounts && splitUPIAmt > 0 && splitPaidPaise <= totalPaise && (
            <UpiQr amount={splitUPIAmt} />
          )}
          {!savedSale && splitUPIAmt>0 && <ManualUpiConfirmation checked={upiConfirmed} onChange={setUpiConfirmed}/>}
          <label className="r-card" style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
            <input id="split-udhar-toggle" type="checkbox" checked={splitUdhar}
              disabled={saving || !!savedSale} onChange={e => setSplitUdhar(e.target.checked)} />
            <Clock size={20} aria-hidden="true" />
            <span><strong>{ui("Remaining on Udhar")}</strong><span className="r-caption" style={{display:'block'}}>Collect the unpaid amount later.</span></span>
          </label>
          {splitRemaining > 0 && (
            <div className="r-card r-card--primary-light">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{ color: "var(--r-text-secondary)", fontWeight: 500 }}
                >
                  {splitHasCredit ? "Udhar to collect later" : "Amount still to cover"}
                </span>
                <span
                  style={{
                    fontSize: "var(--r-text-xl)",
                    fontWeight: 700,
                    color: "var(--r-danger)",
                  }}
                >
                  <span id="split-udhar-amount">₹{splitRemaining.toLocaleString("en-IN")}</span>
                </span>
              </div>
            </div>
          )}

          {splitHasCredit && (
            <div className="r-card">
              <span className="r-label">Customer for Udhar</span>
              <button className="r-btn r-btn--outline r-w-full" id="split-customer-select"
                disabled={saving || !!savedSale} onClick={() => setShowUdharCustomerSelect(true)}>
                {customer?.name || ui("Select Customer")}
              </button>
              {customer ? <p className="r-caption">Existing due: ₹{customerBalance.toLocaleString("en-IN")} · After this bill: ₹{(customerBalance + splitRemaining).toLocaleString("en-IN")}</p>
                : <p className="r-caption">Choose a customer to save the unpaid amount in Khata.</p>}
            </div>
          )}
          {!validSplitAmounts && <p className="r-caption" role="alert">Enter non-negative amounts with up to two decimal places.</p>}
          {validSplitAmounts && splitPaidPaise > totalPaise && <p className="r-caption" role="alert">Cash and UPI together cannot exceed the bill total.</p>}

          {validSplitAmounts && splitPaidPaise === totalPaise && (
            <div className="r-card r-card--primary-light">
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "var(--r-space-sm)",
                }}
              >
                <Check size={18} style={{ color: "var(--r-success)" }} />
                <span style={{ color: "var(--r-success)", fontWeight: 600 }}>
                  Amount fully covered
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {(selectedMode === "UDHAR" || (selectedMode === "SPLIT" && splitHasCredit)) && (
        <div className="r-section r-input-group">
          <label className="r-label" htmlFor="payment-promise-date">When will the customer pay? (optional)</label>
          <input id="payment-promise-date" className="r-input" type="date"
            min={details.date || undefined} value={details.due_date} disabled={saving || !!savedSale}
            onChange={e => setDetails({ due_date: e.target.value })} />
          <p className="r-caption">Unpaid bills appear on this date in Calendar.</p>
        </div>
      )}

      {/* ── Sticky CTA ────────────────────────────────── */}
      {selectedMode && (
        <div className="r-sticky-footer">
          {selectedMode === "CASH" && (
            <button
              className="r-btn r-btn--primary-lg"
              onClick={() => handleCompleteSale("Cash")}
              disabled={
                saving ||
                quoteLoading ||
                quote === null ||
                (cashAmount < total && cashReceived !== "")
              }
              id="complete-sale-cash"
            >
              {saving
                ? ui("Saving…")
                : photoUpload.failed
                  ? ui("Retry Photo Upload")
                  : "COMPLETE SALE"}
            </button>
          )}
          {selectedMode === "UPI" && (
            <button
              className="r-btn r-btn--primary-lg"
              onClick={() => handleCompleteSale("UPI")}
              id="complete-sale-upi"
              disabled={saving || quoteLoading || quote === null || !savedSale && !upiConfirmed}
            >
              {saving
                ? ui("Saving…")
                : photoUpload.failed
                  ? ui("Retry Photo Upload")
                  : ui('Record UPI received')}
            </button>
          )}
          {selectedMode === "UDHAR" && (
            <button
              className="r-btn r-btn--primary-lg"
              onClick={() => handleCompleteSale("Udhar")}
              id="save-as-udhar"
              disabled={saving || quoteLoading || quote === null || !customer}
              style={{ background: "var(--r-warning)" }}
            >
              {saving
                ? ui("Saving…")
                : photoUpload.failed
                  ? ui("Retry Photo Upload")
                  : "SAVE AS UDHAR"}
            </button>
          )}
          {selectedMode === "SPLIT" && (
            <button
              className="r-btn r-btn--primary-lg"
              onClick={() =>
                handleCompleteSale(
                  splitPaidPaise === 0 && splitHasCredit ? "Udhar" :
                    [splitCashAmt > 0 ? `Cash ₹${splitCashAmt}` : "", splitUPIAmt > 0 ? `UPI ₹${splitUPIAmt}` : "", splitHasCredit ? `Udhar ₹${splitRemaining}` : ""].filter(Boolean).join(" + ") || "Cash",
                  [
                    { method: "CASH", amount: splitCashAmt },
                    { method: "UPI", amount: splitUPIAmt },
                  ].filter((p) => p.amount > 0) as PaymentSplit[],
                )
              }
              disabled={
                saving ||
                quoteLoading ||
                quote === null ||
                (!savedSale &&
                  (!validSplitAmounts || splitPaidPaise > totalPaise || splitUPIAmt>0 && !upiConfirmed ||
                    (splitRemaining > 0 && (!splitUdhar || !customer))))
              }
              id="complete-sale-split"
            >
              {saving
                ? ui("Saving…")
                : photoUpload.failed
                  ? ui("Retry Photo Upload")
                  : splitHasCredit ? "SAVE SALE + UDHAR" : "COMPLETE SALE"}
            </button>
          )}
        </div>
      )}

      {/* ── Udhar: Customer Select Sheet ──────────────── */}
      <SelectionSheet
        open={showUdharCustomerSelect}
        onClose={() => setShowUdharCustomerSelect(false)}
        title="Select Customer for Udhar"
        subtitle="Choose who will pay this bill later."
        options={customers.filter(c=>c.active!==false).map((c) => ({
          value: c.id,
          label: c.name,
          description: [c.mobile || "No mobile", c.credit_allowed === false ? "Udhar disabled" : ""].filter(Boolean).join(" · "),
          disabled: c.credit_allowed === false,
        }))}
        value={customer?.id || ""}
        loading={loadingCustomers}
        error={customerError}
        onRetry={() => setCustomerRetry((n) => n + 1)}
        onSearch={(query) => {
          setCustomerSearch(query);
          setCustomerOffset(0);
        }}
        onMore={
          moreCustomers && !loadingCustomers
            ? () => setCustomerOffset((n) => n + 100)
            : undefined
        }
        onAdd={() => navigate("/retail/customers/add")}
        addLabel={ui("Add Customer")}
        onSelect={(id) => {
          const chosen = customers.find((c) => c.id === id);
          if (!chosen) return;
          setCustomer({ ...chosen, balance: chosen.outstanding_amount });
          setShowUdharCustomerSelect(false);
          setSelectedMode(selectedMode === "SPLIT" ? "SPLIT" : "UDHAR");
        }}
      />
    </div>
  );
};

export default RetailPayment;
