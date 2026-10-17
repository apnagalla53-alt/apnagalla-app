import UpiAccountBreakdown from '../payments/UpiAccountBreakdown';
import DateInput from '../../shared/components/DateInput';
import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import { Sheet } from "../components/MobileControls";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Wallet,
  Banknote,
  Smartphone,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  History,
} from "lucide-react";
import api, { getApiErrorMessage } from "../../shared/api";
import { downloadCsv } from "../csv";
const today = () => new Date().toLocaleDateString("en-CA");
const rupee = (n: number) =>
  "₹" +
  Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export default function RetailGalla() {
  useUiLanguage();
  const nav = useNavigate(),
    [date, setDate] = useState(today()),
    [data, setData] = useState<any>(null),
    [history, setHistory] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [opening, setOpening] = useState(""),
    [actual, setActual] = useState(""),
    [note, setNote] = useState("");
  const [custom, setCustom] = useState(false),
    [draftDate, setDraftDate] = useState(date);
  const loadVersion = useRef(0);
  const load = async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    try {
      const [r, h] = await Promise.all([
        api.get("/retail/galla", { params: { date } }),
        api.get("/retail/galla/history", { params: { before: date } }),
      ]);
      if (version !== loadVersion.current) return;
      setData(r.data);
      setHistory(h.data);
      setOpening(r.data.opening_override ? String(r.data.opening_cash) : "");
      setActual(r.data.actual_cash == null ? "" : String(r.data.actual_cash));
      setNote(r.data.note);
    } catch (e) {
      if (version === loadVersion.current) setError(getApiErrorMessage(e));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [date]);
  const exportCsv = () =>
    downloadCsv(
      "EVOLIX-Galla-" + date + ".csv",
      ["Field", "Value"],
      Object.entries(data).filter(([, v]) =>
        ["string", "number"].includes(typeof v),
      ),
    );
  return (
    <>
      <StitchHeader className="r-page-header" hasBack>
        <button
          className="r-btn r-btn--icon"
          aria-label={ui("Back")}
          onClick={() => nav("/retail/home")}
        >
          <ArrowLeft />
        </button>
        <h1>{ui("Daily Galla")}</h1>
        <Wallet />
      </StitchHeader>
      {data&&<div className="r-section"><p className="r-caption">Amount-only sales: ₹{Number(data.amount_only_sales||0).toFixed(2)} · Service charges: ₹{Number(data.service_charges||0).toFixed(2)} · Billed before returns</p><UpiAccountBreakdown rows={data.upi_accounts}/></div>}
      <div className="r-section">
        <div className="r-segmented" aria-label="Galla date">
          <button
            className={date === today() ? "active" : ""}
            onClick={() => setDate(today())}
          >{ui("Today")}</button>
          <button
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 1);
              setDate(d.toLocaleDateString("en-CA"));
            }}
          >{ui("Yesterday")}</button>
          <button
            onClick={() => {
              setDraftDate(date);
              setCustom(true);
            }}
          >{ui("Custom Date")}</button>
        </div>
        <p className="r-caption">Showing {date}</p>
        <Sheet
          open={custom}
          onClose={() => setCustom(false)}
          title="Choose Galla Date"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setDate(draftDate);
              setCustom(false);
            }}
          >
            <label htmlFor="galla-date">{ui("Custom Date")}</label>
            <DateInput
              id="galla-date"
              type="date"
              className="r-input"
              required
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)} lang="en-GB"
            />
            <button className="r-btn r-btn--primary r-w-full">
              Show Galla
            </button>
          </form>
        </Sheet>
        {loading && <p role="status">Counting recorded money movements…</p>}
        {error && (
          <div className="r-card" role="alert">
            {error}
            <button className="r-btn" onClick={load}>{ui("Try Again")}</button>
          </div>
        )}
        {!loading && data && (
          <>
            <div className="r-galla-hero">
              <span>{ui("Expected Galla Cash")}</span>
              <strong data-testid="galla-expected">
                {rupee(data.expected_cash)}
              </strong>
              <p>Opening cash + cash received − cash paid out</p>
              <small>UPI and card stay outside the physical drawer.</small>
            </div>
            <div className="r-counter-grid">
              {[
                [Receipt, "Today's Sales", data.total_sales],
                [Banknote, "Cash Received", data.cash_received],
                [Smartphone, "UPI Sales", data.upi_sales],
                [Wallet, "Udhar Given", data.udhar_sales],
                [
                  ArrowDownLeft,
                  "Old Udhar Collected",
                  data.old_customer_dues_received,
                ],
                [ArrowUpRight, "Cash Paid Out", data.cash_paid_out],
              ].map(([Icon, label, value]: any) => (
                <div className="r-card" key={label}>
                  <Icon size={22} />
                  <span>{ui(label)}</span>
                  <strong>{rupee(value)}</strong>
                </div>
              ))}
            </div>
            <section className="r-card">
              <h2>Business & money details</h2>
              {[
                ["Bills", data.bill_count],
                ["Cash Sales", data.cash_sales],
                ["Card Sales", data.card_sales],
                ["Bank Sales", data.bank_sales],
                ["Old Dues Received in Cash", data.old_dues_cash],
                ["Supplier Payments", data.supplier_payments],
                ["Supplier Payments in Cash", data.supplier_cash],
                ["Business Expenses", data.business_expenses],
                ["Owner Withdrawals", data.owner_withdrawals],
                ["Refunds", data.refunds],
                ["Cash Refunds", data.cash_refunds],
                ["Other Cash In", data.other_cash_in],
                ["Other Cash Out", data.other_cash_out],
              ].map(([label, value]) => (
                <div className="r-galla-row" key={String(label)}>
                  <span>{ui(label)}</span>
                  <strong>
                    {label === "Bills" ? value : rupee(Number(value))}
                  </strong>
                </div>
              ))}
              <button className="r-btn" onClick={exportCsv}>
                <Download size={18} />{ui("Export Galla CSV")}</button>
            </section>
            <form
              className="r-card"
              onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                setError("");
                try {
                  const r = await api.post("/retail/galla/count", {
                    date,
                    opening_cash: opening === "" ? undefined : Number(opening),
                    actual_cash: actual === "" ? undefined : Number(actual),
                    note,
                  });
                  setData(r.data);
                  await load();
                } catch (err) {
                  setError(getApiErrorMessage(err));
                } finally {
                  setSaving(false);
                }
              }}
            >
              <h2>Count the counter</h2>
              <label htmlFor="galla-opening">{ui("Opening Cash · optional")}</label>
              <input
                id="galla-opening"
                className="r-input"
                type="number"
                min="0"
                step=".01"
                placeholder={
                  "Ledger opening " + rupee(data.ledger_opening_cash)
                }
                value={opening}
                onChange={(e) => setOpening(e.target.value)} inputMode="decimal"
              />
              <label htmlFor="galla-actual">{ui("Actual Cash Count · optional")}</label>
              <input
                id="galla-actual"
                className="r-input"
                type="number"
                min="0"
                step=".01"
                value={actual}
                onChange={(e) => setActual(e.target.value)} inputMode="decimal"
              />
              <label htmlFor="galla-note">{ui("Note")}</label>
              <textarea
                id="galla-note"
                className="r-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <p>
                Difference:{" "}
                {data.difference == null
                  ? "Not counted"
                  : rupee(data.difference)}{" "}
                · {data.status.replaceAll("_", " ")}
              </p>
              <p className="r-caption">
                Saving a count does not change your accounts. A difference helps
                you investigate.
              </p>
              <button
                className="r-btn r-btn--primary r-w-full"
                disabled={saving}
              >
                {saving ? ui("Saving…") : ui("Save Cash Count")}
              </button>
            </form>
            <section className="r-card">
              <h2>
                <History size={20} />{ui("Galla History")}</h2>
              <p className="r-caption">
                Previous seven days. Choose a custom date for older records.
              </p>
              {history.map((h) => (
                <button
                  key={h.date}
                  className="r-galla-history"
                  onClick={() => setDate(h.date)}
                >
                  <strong>{h.date}</strong>
                  <span>{ui("Sales")} {rupee(h.total_sales)} · UPI {rupee(h.upi_sales)}
                  </span>
                  <span>{ui("Cash")} {rupee(h.cash_sales)} · Expenses{" "}
                    {rupee(h.business_expenses)}
                  </span>
                  <span>
                    Expected {rupee(h.expected_cash)}{" "}
                    {h.difference != null
                      ? " · Difference " + rupee(h.difference)
                      : ""}
                  </span>
                </button>
              ))}
            </section>
            {data.bill_count === 0 && (
              <div className="r-empty">
                <Receipt />
                <h2>No sales recorded for this date</h2>
                <p>Cash movements and counts remain visible above.</p>
                <button
                  className="r-btn r-btn--primary"
                  onClick={() => nav("/retail/bill")}
                >
                  Make a Bill
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
