import DateInput from '../../shared/components/DateInput';
import { readWorkflowDraft, useWorkflowDraft } from '../experience/workflowDraft';
import { trackExperience } from '../experience/experienceEvents';
import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
/**
 * EVOLIX Retail V1 — Payment Screen
 *
 * Large amount at top → Payment methods → Cash/UPI/Udhar/Split flows
 * Single CTA: COMPLETE SALE / SAVE AS UDHAR
 */
import { useState, useEffect, useRef } from "react";
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
  billLinePayload, billOptionsPayload,
  useBillStore,
  useSaleCompleteStore,
  type PaymentSplit,
} from "../retailStore";
import { khataApi, posApi, type RetailCustomer } from "../retailApi";
import RetailPartyForm from '../RetailPartyForm';
import InlineEntitySheet from '../experience/InlineEntitySheet';

type PaymentMode = "CASH" | "UPI" | "UDHAR" | "SPLIT";

const RetailPayment = ({embedded=false}: {embedded?:boolean}) => {
  useUiLanguage();
  const navigate = useNavigate();
  const completedReceipt = useRef<string | null>(null);
  const {
    draft_id,
    items,
    discount: billDiscount, discountMode, setDiscountMode, customerName, serviceCharge,
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

  const signature=JSON.stringify([draft_id,items.map(i=>[i.row_id,i.item_id,i.new_item?.client_id,i.quantity,i.rate,i.discount_amount,i.unit_id,i.variant_id,i.batch_id,i.dimensions])]);
  const [recovered]=useState(()=>{const saved=readWorkflowDraft<any>('bill-payment');return saved?.signature===signature?saved:null;});
  const [receivingProfile,setReceivingProfile]=useState(recovered?.receivingProfile||'');
  const [alternate,setAlternate]=useState(!!recovered?.alternate),[receivingMobile,setReceivingMobile]=useState(recovered?.receivingMobile||'');
  const [selectedMode, setSelectedMode] = useState<PaymentMode | null>(
    savedSale
      ? savedSale.mode === "Cash"
        ? "CASH"
        : savedSale.mode === "UPI"
          ? "UPI"
          : savedSale.mode === "Udhar"
            ? "UDHAR"
            : "SPLIT"
      : recovered?.selectedMode || null,
  );

  // Cash state
  const [cashReceived, setCashReceived] = useState(recovered?.cashReceived||"");
  const cashAmount = parseFloat(cashReceived) || 0;
  const cashChange = Math.max(0, cashAmount - total);

  // UPI state (simple confirmation)

  // Udhar state
  const [showUdharCustomerSelect, setShowUdharCustomerSelect] = useState(false);
  const [addingCustomer,setAddingCustomer]=useState(false);

  // Split state
  const [splitCash, setSplitCash] = useState(recovered?.splitCash||"");
  const [splitUPI, setSplitUPI] = useState(recovered?.splitUPI||"");
  const [splitUdhar, setSplitUdhar] = useState(!!recovered?.splitUdhar);
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
  const draft=useWorkflowDraft('bill-payment',{signature,selectedMode,cashReceived,splitCash,splitUPI,splitUdhar,receivingProfile,alternate,receivingMobile});
  useEffect(()=>{photoUpload.select(attachment || null);},[attachment]);
  useEffect(()=>{setUpiConfirmed(false);},[selectedMode, quote, splitUPI,receivingProfile,alternate,receivingMobile]);

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
      items: items.map(billLinePayload),
      customer_id: customer?.id,
      date: details.date,
      payment_splits: [],
      ...billOptionsPayload(),
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
  }, [items, customer?.id, details.date, savedSale, billDiscount, discountMode, serviceCharge]);

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
  if (completedReceipt.current) return <Navigate to={completedReceipt.current} replace />;
  if (items.length === 0) {
    return <Navigate to="/retail/bill" replace />;
  }

  const handleCompleteSale = async (
    mode: string,
    payments?: PaymentSplit[],
  ) => {
    if (saving || quoteLoading || quote === null) return;
    if((selectedMode==='UPI'||selectedMode==='SPLIT'&&splitUPIAmt>0)&&alternate&&!/^[6-9]\d{9}$/.test(receivingMobile)){setError('Enter the 10-digit number that received payment.');return;}
    if (!savedSale && (selectedMode==='UPI' || selectedMode==='SPLIT' && splitUPIAmt>0) && !upiConfirmed) return;
    setSaving(true);
    setError("");
    let posted=!!savedSale;
    if(!posted)trackExperience('bill_save_attempted',{workflow:'PAYMENT'});
    try {
      // POST to actual backend POS endpoint
      const res = savedSale
        ? { data: savedSale.invoice }
        : await posApi.postSale({
            items: items.map(billLinePayload),
            customer_id: customer?.id,
            payment_splits: (payments || (mode === "Udhar" ? [] : [{method:mode.toUpperCase(),amount:total}])).map(payment=>({...payment,...(payment.method==='UPI'?{receipt_confirmed:upiConfirmed,...(alternate?{received_on_mobile:receivingMobile}:receivingProfile?{receiving_profile_id:receivingProfile}:{})}:{})})),
            total_amount: total,
            discount: items.reduce((acc, i) => acc + i.discount_amount, 0),
            ...billOptionsPayload(),
            date: details.date,
            due_date: (mode === "Udhar" || (selectedMode === "SPLIT" && splitHasCredit)) ? details.due_date || undefined : undefined,
            note: details.note || undefined,
            sales_channel: details.sales_channel,
          },draft_id);
      if (!res.data?.id || !res.data?.document_number)
        throw new Error("Sale confirmation missing");
      posted=true;
      const completedMode = savedSale?.mode || mode;
      if(!savedSale)trackExperience('bill_saved',{workflow:'PAYMENT'});
      setSavedSale({ invoice: res.data, mode: completedMode });
      if (completedMode !== "Udhar") void notifyPayment(res.data.id, Number(res.data.paid_amount));
      await photoUpload.upload('SALES_INVOICE',res.data.id,'SALE_PROOF');
      setCompletedSale({
        gst_workflow: useBillStore.getState().gstWorkflow,
        invoice_id: res.data.id,
        invoice_number: res.data.document_number,
        amount: Number(res.data.grand_total),
        payment_mode: completedMode,
        customer_name: customer?.name || customerName || "Walk-in Customer",
        items_count: itemCount,
        lines_count: items.length,
        timestamp: new Date(),
      });

      // Clearing the shared draft synchronously renders this screen again.
      // Commit the receipt target first so its empty-cart redirect cannot win.
      completedReceipt.current='/retail/bills/'+res.data.id+'/print';
      draft.clear();useBillStore.getState().clearBill();navigate(completedReceipt.current, { replace: true });
    } catch (e) {
      if(!posted)trackExperience('bill_failed',{workflow:'PAYMENT'});
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
                  customer_name: customer?.name || customerName || "Walk-in Customer",
                  items_count: itemCount,
                  lines_count: items.length,
                  timestamp: new Date(),
                });
                completedReceipt.current='/retail/bills/'+savedSale.invoice.id+'/print';
                draft.clear();useBillStore.getState().clearBill();navigate(completedReceipt.current,{replace:true});
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
      {!embedded&&<StitchHeader className="r-page-header" hasBack>
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
      </StitchHeader>}

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
          ₹{total.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}
        </div>
        <div
          style={{
            fontSize: "var(--r-text-sm)",
            color: "var(--r-text-muted)",
            marginTop: 4,
          }}
        >
          {items.length} lines · {itemCount} units · {customer?.name || customerName || "Walk-in"}
        </div>
      </div>

      {/* Payment Methods */}

      {!savedSale && <div className="r-section r-input-group">
        <label className="r-label" htmlFor="bill-discount">Bill discount (optional)</label>
        <div className="r-discount-control"><input id="bill-discount" className="r-input" type="number" min="0" max={discountMode==='PERCENT'?100:undefined} step="0.01" disabled={saving} value={billDiscount} onChange={e=>setBillDiscount(Number(e.target.value)||0)} inputMode="decimal"/><select className="r-input" aria-label="Discount type" disabled={saving} value={discountMode} onChange={e=>setDiscountMode(e.target.value as 'AMOUNT'|'PERCENT')}><option value="AMOUNT">Amount ₹</option><option value="PERCENT">Percentage %</option></select></div>
      </div>}
      {!savedSale && (
        <div className="r-stitch-payment-method-wrap">
          <div className="r-payment-methods">
            {paymentMethods.map(({ mode, label, icon: Icon, color }) => (
              <button
                key={mode}
                className={'r-payment-method'+(selectedMode===mode?' is-selected':'')}
                aria-pressed={selectedMode===mode}
                disabled={saving||quoteLoading||quote===null}
                onClick={() => {
                  if (mode === "UDHAR" && !customer && !customerName.trim()) {
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

      {!embedded&&<div className="r-section r-payment-final-summary"><TaxBreakdown quote={taxQuote} rates={[...items.map(i=>Number(i.tax_rate||0)),...(serviceCharge?[serviceCharge.gst_rate]:[])]}/></div>}
      {/* ── CASH Flow ─────────────────────────────────── */}
      {selectedMode === "UPI" && quote !== null && !alternate && (
        <div className="r-section">
          <UpiQr amount={total} selectedProfileId={receivingProfile} onProfileChange={setReceivingProfile}/>
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
              id="cash-received-input" inputMode="decimal"
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

      {selectedMode === "UPI" && <div className="r-section"><button type="button" className="r-btn r-btn--ghost" disabled={saving||!!savedSale} onClick={()=>setSelectedMode(null)}><ArrowLeft size={16}/>Change method</button>{!savedSale&&<ManualUpiConfirmation checked={upiConfirmed} onChange={setUpiConfirmed}/>}</div>}

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
              <span style={{ fontWeight: 600 }}>{customer?.name||customerName}</span>
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
                ₹{total.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}
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
              id="split-cash-input" inputMode="decimal"
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
              id="split-upi-input" inputMode="decimal"
            />
          </div>

          {validSplitAmounts && splitUPIAmt > 0 && splitPaidPaise <= totalPaise && !alternate && (
            <UpiQr amount={splitUPIAmt} selectedProfileId={receivingProfile} onProfileChange={setReceivingProfile}/>
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
                {customer?.name || customerName || ui("Select Customer")}
              </button>
              {customer ? <p className="r-caption">Existing due: ₹{customerBalance.toLocaleString("en-IN")} · After this bill: ₹{(customerBalance + splitRemaining).toLocaleString("en-IN")}</p>
                : <p className="r-caption">{customerName?'This new customer will be saved with the bill.':'Choose a customer to save the unpaid amount in Khata.'}</p>}
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
          <DateInput id="payment-promise-date" className="r-input" type="date"
            min={details.date || undefined} value={details.due_date} disabled={saving || !!savedSale}
            onChange={e => setDetails({ due_date: e.target.value })} lang="en-GB" />
          <p className="r-caption">Unpaid bills appear on this date in Calendar.</p>
        </div>
      )}

      {(selectedMode==='UPI'||selectedMode==='SPLIT'&&splitUPIAmt>0)&&!savedSale&&<div className="r-section"><label className="r-upi-confirmation"><input type="checkbox" checked={alternate} onChange={e=>setAlternate(e.target.checked)}/><span>Received payment on another number<small>Use when payment went to an account without a saved QR.</small></span></label>{alternate&&<label>Receiving mobile number<input className="r-input" type="tel" inputMode="numeric" maxLength={10} value={receivingMobile} onChange={e=>setReceivingMobile(e.target.value.replace(/\D/g,''))}/></label>}</div>}
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
                  : ui('Save bill')}
            </button>
          )}
          {selectedMode === "UDHAR" && (
            <button
              className="r-btn r-btn--primary-lg"
              onClick={() => handleCompleteSale("Udhar")}
              id="save-as-udhar"
              disabled={saving || quoteLoading || quote === null || !customer && !customerName.trim()}
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
                    (splitRemaining > 0 && (!splitUdhar || !customer && !customerName.trim()))))
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
        onAdd={() => {setShowUdharCustomerSelect(false);setAddingCustomer(true);}}
        addLabel={ui("Add Customer")}
        onSelect={(id) => {
          const chosen = customers.find((c) => c.id === id);
          if (!chosen) return;
          setCustomer({ ...chosen, balance: chosen.outstanding_amount });
          setShowUdharCustomerSelect(false);
          setSelectedMode(selectedMode === "SPLIT" ? "SPLIT" : "UDHAR");
        }}
      />
      <InlineEntitySheet open={addingCustomer} onClose={()=>setAddingCustomer(false)} title="Add Customer" context="Your payment and bill stay here.">{addingCustomer&&<RetailPartyForm initialName={customerSearch} onSaved={async id=>{trackExperience('customer_inline_created',{workflow:'PAYMENT'});try{const response=await khataApi.getTimeline(id);const chosen=response.data.data.customer;setCustomer({...chosen,balance:Number(response.data.data.balance)});setAddingCustomer(false);setSelectedMode(selectedMode==='SPLIT'?'SPLIT':'UDHAR');}catch(err){setCustomerError(getApiErrorMessage(err));}}}/>}</InlineEntitySheet>
    </div>
  );
};

export default RetailPayment;
