import DateInput from '../../shared/components/DateInput';
import { trackExperience } from "../experience/experienceEvents";
import { useState, useEffect } from "react";
import { CheckCircle2, ChevronRight, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ui } from "../../i18n";
import api, { getApiErrorMessage } from "../../shared/api";
import { useAuthStore } from "../../shared/store/authStore";
import {
  readWorkflowDraft,
  useWorkflowDraft,
} from "../experience/workflowDraft";
import RemotePartySelect from "../components/RemotePartySelect";
import { MobileSelect, Sheet } from "../components/MobileControls";
import RetailPartyForm from "../RetailPartyForm";
import IntakeRowEditor from "./IntakeRowEditor";
import IntakeMapping from "./IntakeMapping";
export default function IntakeReview({
  job,
  onUpdate,
  onPage,
}: {
  job: any;
  onUpdate: (data: any) => void;
  onPage: (page: number) => void;
}) {
  const navigate = useNavigate(),
    tenant = useAuthStore((s) => s.tenantContext),
    purchase = job.kind === "INTAKE_PURCHASE",
    header = job.configuration.header || {},
    [seed] = useState(() => readWorkflowDraft<any>("intake-header-" + job.id)),
    [supplier, setSupplier] = useState(seed?.supplier || ""),
    [invoice, setInvoice] = useState(
      seed?.invoice || header.invoice_number || "",
    ),
    [date, setDate] = useState(
      seed?.date ||
        header.invoice_date ||
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
          new Date(),
        ),
    ),
    [invoiceTotal, setInvoiceTotal] = useState(
      seed?.invoiceTotal ??
        (header.detected_total === undefined
          ? ""
          : String(header.detected_total)),
    ),
    [existingPurchase, setExistingPurchase] = useState(false),
    [status, setStatus] = useState(seed?.status || ""),
    [method, setMethod] = useState(seed?.method || "CASH"),
    [paid, setPaid] = useState(seed?.paid || ""),
    [ack, setAck] = useState(false),
    [accept, setAccept] = useState(false),
    [editing, setEditing] = useState<any>(null),
    [mapping, setMapping] = useState(false),
    [addSupplier, setAddSupplier] = useState(false),
    [parties, setParties] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useWorkflowDraft("intake-header-" + job.id, {
    supplier,
    invoice,
    date,
    invoiceTotal,
    status,
    method,
    paid,
  });
  const counts = job.counts,
    ready = Number(counts.READY || 0),
    attention = Number(counts.NEEDS_REVIEW || 0),
    added = Number(counts.IMPORTED || 0),
    skipped = Number(counts.SKIPPED || 0),
    done = job.status === "CONFIRMED",
    total = Object.values(counts).reduce<number>(
      (sum, n) => sum + Number(n),
      0,
    );
  useEffect(
    () => setAck(false),
    [job.rows, supplier, invoice, date, invoiceTotal, status, method, paid],
  );
  useEffect(() => {
    trackExperience("intake_review_opened", {
      workflow: "INTAKE",
      count: total,
    });
  }, [job.id]);
  const mutate = async (path: string, body: any) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const next = (
        await api.post("/retail/account/intake/" + job.id + path, body)
      ).data;
      onUpdate(next);
      trackExperience(
        purchase || job.configuration.source === "VOICE"
          ? "intake_confirmed"
          : "excel_import_confirmed",
        {
          workflow: "INTAKE",
          count: Math.min(2000, Number(next.counts.IMPORTED || 0)),
        },
      );
    } catch (e: any) {
      setError(getApiErrorMessage(e));
      if (e.response?.data?.existing_purchase_id) setExistingPurchase(true);
    } finally {
      setBusy(false);
    }
  };
  const rowCard = (row: any) => {
    const r = row.normalized,
      needs = row.status === "NEEDS_REVIEW";
    return (
      <button
        className="xp-quick-row"
        key={row.id}
        onClick={() => setEditing(row)}
        disabled={busy || ["IMPORTED", "SKIPPED"].includes(row.status)}
      >
        <span className="xp-icon" data-accent={needs ? "warning" : "brand"}>
          {needs ? <TriangleAlert size={20} /> : <CheckCircle2 size={20} />}
        </span>
        <span>
          <strong>{r.name || ui("Item name needed")}</strong>
          <small>
            {r.quantity == null
              ? ui("Quantity needs review")
              : r.quantity + " " + (r.unit_code || ui("Unit needed"))}
            {typeof (purchase ? r.purchase_price : r.selling_price) ===
              "number" &&
            Number.isFinite(purchase ? r.purchase_price : r.selling_price)
              ? " · ₹" + (purchase ? r.purchase_price : r.selling_price)
              : " · " + ui("Price needed")}
          </small>
          <small>
            {ui(
              row.status === "IMPORTED"
                ? "Added"
                : row.status === "SKIPPED"
                  ? "Kept / skipped"
                  : r.match_status === "EXISTING"
                    ? "Existing"
                    : r.match_status === "POSSIBLE"
                      ? "Possible Match"
                      : "New Item",
            )}
          </small>
          {needs && <small className="xp-row-error">{row.errors?.[0]}</small>}
        </span>
        <ChevronRight size={18} />
      </button>
    );
  };
  return (
    <div className="xp-stack">
      <section className="xp-card">
        <h2>{ui(done ? "Your intake is saved" : "Review Before Saving")}</h2>
        <p className="xp-muted">{tenant?.company_name}</p>
        <div className="xp-intake-counts">
          <span>
            {total} {ui("found")}
          </span>
          <span>
            {ready} {ui("ready")}
          </span>
          <span>
            {attention} {ui("need review")}
          </span>
          {added > 0 && (
            <span>
              {added} {ui(purchase ? "rows received" : "added")}
            </span>
          )}
          {skipped > 0 && (
            <span>
              {skipped} {ui("kept / skipped")}
            </span>
          )}
        </div>
        <p className="xp-muted">
          {done
            ? ui(
                purchase
                  ? "Purchase saved. Stock and Supplier Khata were updated."
                  : "Ready items were saved. Existing items were kept.",
              )
            : job.configuration.notice}
        </p>
        {job.configuration.purchase_id && (
          <button
            className="r-btn r-btn--primary"
            onClick={() => navigate("/retail/purchases")}
          >
            {ui("View Purchases")}
          </button>
        )}
        {done && !purchase && (
          <button
            className="r-btn r-btn--primary"
            onClick={() => navigate("/retail/items")}
          >
            {ui("View Items")}
          </button>
        )}
      </section>
      {!!job.configuration.headers?.length && !done && (
        <section className="xp-card">
          <p>{ui("Familiar columns were matched automatically.")}</p>
          <button
            className="r-btn r-btn--outline"
            onClick={() => setMapping(true)}
          >
            {ui("Check column choices")}
          </button>
          {!!job.configuration.unmapped?.length && (
            <>
              <p className="xp-muted">
                {ui("Unrecognized columns")}:{" "}
                {job.configuration.unmapped.join(", ")}
              </p>
              <label className="r-toggle-row">
                <input
                  type="checkbox"
                  checked={accept}
                  onChange={(e) => setAccept(e.target.checked)}
                />
                {ui(
                  "I reviewed these columns. They will stay in the draft and will not be posted.",
                )}
              </label>
            </>
          )}
        </section>
      )}
      {purchase && !done && (
        <section className="xp-card">
          <h2>{ui("Supplier bill")}</h2>
          {job.has_photo && <IntakePhoto id={job.id} />}
          {header.detected_total !== undefined && (
            <p>
              {ui("Total read from photo")} · ₹{header.detected_total}
            </p>
          )}
          <p className="xp-muted">
            {ui(
              "Check the photo, item quantities, purchase prices and GST. Discounts or extra charges need the manual purchase form.",
            )}
          </p>
          <label htmlFor="intake-total">{ui("Supplier bill total")} *</label>
          <input
            id="intake-total"
            className="r-input"
            type="number"
            min="0"
            step=".01"
            value={invoiceTotal}
            onChange={(e) => setInvoiceTotal(e.target.value)} inputMode="decimal"
          />
          <label htmlFor="intake-supplier">{ui("Supplier")} *</label>
          <RemotePartySelect
            id="intake-supplier"
            title="Supplier"
            supplier
            records={parties}
            onLoaded={(rows) => setParties(rows)}
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            onAdd={() => setAddSupplier(true)}
            addLabel="Add Supplier"
          >
            <option value="">{ui("Select Supplier")}</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </RemotePartySelect>
          <button
            className="r-btn r-btn--outline"
            onClick={() => setAddSupplier(true)}
          >
            {ui("Add Supplier")}
          </button>
          <label htmlFor="intake-invoice">
            {ui("Supplier invoice number")} *
          </label>
          <input
            id="intake-invoice"
            className="r-input"
            value={invoice}
            maxLength={100}
            onChange={(e) => setInvoice(e.target.value)}
          />
          <label htmlFor="intake-date">{ui("Invoice date")} *</label>
          <DateInput
            id="intake-date"
            className="r-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)} lang="en-GB"
          />
        </section>
      )}
      {attention > 0 && (
        <section>
          <h2 className="xp-list-heading">{ui("Needs Your Attention")}</h2>
          <div className="xp-stack">
            {job.rows
              .filter((r: any) => r.status === "NEEDS_REVIEW")
              .map(rowCard)}
          </div>
        </section>
      )}
      {ready > 0 && (
        <details className="xp-card">
          <summary>
            {ready} {ui("Ready Items")} · {ui("View all")}
          </summary>
          <div className="xp-stack">
            {job.rows.filter((r: any) => r.status === "READY").map(rowCard)}
          </div>
        </details>
      )}
      {added + skipped > 0 && (
        <details className="xp-card">
          <summary>{ui("Saved / kept rows")}</summary>
          <div className="xp-stack">
            {job.rows
              .filter((r: any) => ["IMPORTED", "SKIPPED"].includes(r.status))
              .map(rowCard)}
          </div>
        </details>
      )}
      {(job.has_more || job.page > 1) && (
        <div className="xp-suggestion-actions">
          <button
            className="r-btn r-btn--outline"
            disabled={job.page <= 1 || busy}
            onClick={() => onPage(job.page - 1)}
          >
            {ui("Previous")}
          </button>
          <span>
            {ui("Page")} {job.page}
          </span>
          <button
            className="r-btn r-btn--outline"
            disabled={!job.has_more || busy}
            onClick={() => onPage(job.page + 1)}
          >
            {ui("Next")}
          </button>
        </div>
      )}
      {!done && (
        <section className="xp-card">
          <h2>{ui("What happens when you save?")}</h2>
          {purchase && job.purchase_preview?.complete && (
            <div className="xp-intake-counts">
              <span>
                {ui("Purchase subtotal")} · ₹{job.purchase_preview.subtotal}
              </span>
              <span>GST · ₹{job.purchase_preview.gst}</span>
              <strong>
                {ui("Estimated total")} · ₹{job.purchase_preview.total}
              </strong>
            </div>
          )}
          {purchase &&
            job.purchase_preview &&
            !job.purchase_preview.complete && (
              <p className="xp-row-error">
                {ui(
                  "Complete missing quantities and prices to see the purchase total.",
                )}
              </p>
            )}
          <p>
            {ui(
              purchase
                ? "The complete purchase receives actual stock and records supplier payment or due through the existing purchase system."
                : "Ready new items are created. Existing items are kept. A quantity changes stock only when you chose counted opening stock on that row.",
            )}
          </p>
          {!purchase && (
            <p className="xp-muted">
              {ui(
                "Up to 25 ready rows save together. Other rows stay here for correction; retries keep saved rows.",
              )}
            </p>
          )}
          {purchase && (
            <>
              <label>{ui("Payment status")}</label>
              <MobileSelect
                title="Payment status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">{ui("Choose payment")}</option>
                <option value="CREDIT">{ui("Credit")}</option>
                <option value="PAID">{ui("Paid")}</option>
                <option value="PARTIAL">{ui("Partial")}</option>
              </MobileSelect>
              {status && status !== "CREDIT" && (
                <>
                  <label>{ui("Payment method")}</label>
                  <MobileSelect
                    title="Payment method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    {["CASH", "UPI", "BANK", "CARD"].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </MobileSelect>
                </>
              )}
              {status === "PARTIAL" && (
                <>
                  <label htmlFor="intake-paid">{ui("Amount paid")}</label>
                  <input
                    id="intake-paid"
                    className="r-input"
                    type="number"
                    min="0"
                    step=".01"
                    value={paid}
                    onChange={(e) => setPaid(e.target.value)} inputMode="decimal"
                  />
                </>
              )}
              {job.purchase_preview?.complete && status && (
                <p>
                  <strong>
                    {ui("Supplier due added")} · ₹
                    {Math.max(
                      0,
                      job.purchase_preview.total -
                        (status === "CREDIT"
                          ? 0
                          : status === "PAID"
                            ? job.purchase_preview.total
                            : Number(paid) || 0),
                    ).toFixed(2)}
                  </strong>
                </p>
              )}
              <p className="xp-muted">
                {ui(
                  status === "CREDIT"
                    ? "The supplier is owed the full purchase amount."
                    : status === "PAID"
                      ? "The full purchase amount is recorded as paid."
                      : status === "PARTIAL"
                        ? "The unpaid amount remains in Supplier Khata."
                        : "Choose how the purchase is paid.",
                )}
              </p>
            </>
          )}
          <label className="r-toggle-row">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            {ui(
              purchase
                ? "I checked every bill row, the total, GST and payment. Receive stock and save this purchase."
                : "I reviewed the ready rows and their stock effect. Save these items.",
            )}
          </label>
          {error && (
            <p className="r-state-message" role="alert">
              {error} {ui("Your unsaved review is still here.")}
            </p>
          )}
          {existingPurchase && (
            <button
              className="r-btn r-btn--outline"
              onClick={() => navigate("/retail/purchases")}
            >
              {ui("View existing purchases")}
            </button>
          )}
          <button
            className="r-btn r-btn--primary r-w-full"
            disabled={
              busy ||
              !ready ||
              !ack ||
              (!!job.configuration.unmapped?.length && !accept) ||
              (purchase &&
                (!supplier ||
                  invoiceTotal === "" ||
                  !invoice ||
                  !date ||
                  !status ||
                  attention > 0))
            }
            onClick={async () => {
              await mutate("/confirm", {
                acknowledge_effects: true,
                accept_unmapped: accept,
                ...(purchase
                  ? {
                      supplier_id: supplier,
                      invoice_number: invoice,
                      invoice_date: date,
                      ...(invoiceTotal !== ""
                        ? { invoice_total: Number(invoiceTotal) }
                        : {}),
                      payment_status: status,
                      ...(status !== "CREDIT"
                        ? { payment_method: method }
                        : {}),
                      ...(status === "PARTIAL"
                        ? { paid_amount: Number(paid) }
                        : {}),
                    }
                  : {}),
              });
            }}
          >
            {ui(
              busy
                ? "Saving…"
                : purchase
                  ? "Confirm Purchase"
                  : "Import next ready items",
            )}{" "}
            {!purchase ? Math.min(25, ready) : ""}
          </button>
        </section>
      )}
      {editing && (
        <IntakeRowEditor
          job={job}
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={onUpdate}
        />
      )}
      {mapping && (
        <IntakeMapping
          job={job}
          onClose={() => setMapping(false)}
          onSaved={onUpdate}
        />
      )}
      {addSupplier && (
        <Sheet open onClose={() => setAddSupplier(false)} title="Add Supplier">
          <RetailPartyForm
            supplier
            stickyActions={false}
            onSaved={async (id) => {
              setSupplier(id);
              setAddSupplier(false);
              const result = await api.get(
                "/retail/suppliers/" + id + "/khata",
              );
              setParties((old) => [
                ...old.filter((p) => p.id !== id),
                result.data.supplier,
              ]);
            }}
          />
        </Sheet>
      )}
    </div>
  );
}
function IntakePhoto({ id }: { id: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true,
      created = "";
    api
      .get("/retail/account/intake/" + id + "/photo", { responseType: "blob" })
      .then((r) => {
        created = URL.createObjectURL(r.data);
        if (alive) setUrl(created);
        else URL.revokeObjectURL(created);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [id]);
  return url ? (
    <details>
      <summary>{ui("View bill photo")}</summary>
      <img
        className="xp-document-preview"
        src={url}
        alt={ui("Supplier bill for your review")}
      />
    </details>
  ) : null;
}
