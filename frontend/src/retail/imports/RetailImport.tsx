import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import { MobileSelect } from "../components/MobileControls";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Upload, FileSpreadsheet, ArrowLeft } from "lucide-react";
import api, { getApiErrorMessage } from "../../shared/api";
import { useAuthStore } from "../../shared/store/authStore";

export default function RetailImport() {
  useUiLanguage();
  const user = useAuthStore((s) => s.user);
  const owner = ["ADMIN", "OWNER", "TENANT_ADMIN"].includes(user?.role || "");
  const [catalog, setCatalog] = useState<any>(null),
    [history, setHistory] = useState<any[]>([]),
    [job, setJob] = useState<any>(null);
  const [kind, setKind] = useState("ITEMS"),
    [preset, setPreset] = useState("VYAPAR"),
    [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA")),
    [sheet, setSheet] = useState(""),
    [header, setHeader] = useState(1);
  const [mapping, setMapping] = useState<Record<string, string>>({}),
    [defaults, setDefaults] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [accept, setAccept] = useState(false),
    [page, setPage] = useState(1);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (owner)
      Promise.all([
        api.get("/retail/imports/presets"),
        api.get("/retail/imports"),
      ])
        .then(([c, h]) => {
          setCatalog(c.data);
          setHistory(h.data);
        })
        .catch((e) => setError(getApiErrorMessage(e)));
  }, [owner]);
  const preview = async (remap = false) => {
    if (!file) {
      setError("Choose an exported file first");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);
      body.append("preset", preset);
      body.append("date", date);
      body.append("header_row", String(header));
      if (sheet) body.append("sheet", sheet);
      if (remap) {
        body.append("mapping", JSON.stringify(mapping));
        body.append("defaults", JSON.stringify(defaults));
      }
      const { data } = await api.post("/retail/imports/preview", body);
      setJob(data);
      setMapping(data.configuration.mapping);
      setDefaults(data.configuration.defaults);
      setAccept(false);
      setPage(1);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const commit = async () => {
    setBusy(true);
    setError("");
    try {
      let result = job;
      // Server commits at most 25 rows atomically one row at a time. Never
      // automatically retry failed rows or loop forever on validation errors.
      do {
        result = (
          await api.post("/retail/imports/" + job.id + "/commit", {
            accept_unmapped: accept,
          })
        ).data;
        setJob(result);
      } while (result.counts.READY > 0);
      setHistory((await api.get("/retail/imports")).data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const template = () => {
    const fields = catalog.fields[kind];
    const blob = new Blob([fields.join(",") + "\r\n"], {
        type: "text/csv;charset=utf-8",
      }),
      url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "EVOLIX-" + kind.toLowerCase() + "-template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const reset = () => {
    setJob(null);
    setMapping({});
    setDefaults({});
    setSheet("");
    setAccept(false);
  };
  const openJob = async (id: string, nextPage = 1, fromHistory = false) => {
    setBusy(true);
    setError("");
    try {
      const data = (
        await api.get("/retail/imports/" + id, { params: { page: nextPage } })
      ).data;
      setJob(data);
      setPage(nextPage);
      if (fromHistory) {
        setKind(data.kind);
        setPreset(data.preset);
        setDate(data.configuration.date);
        setSheet(data.configuration.source_sheet || "");
        setHeader(data.configuration.header_row || 1);
        setMapping(data.configuration.mapping);
        setDefaults(data.configuration.defaults);
        setAccept(false);
        setFile(null);
        if (fileInput.current) fileInput.current.value = "";
      }
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <StitchHeader className="r-page-header" hasBack>
        <Link
          className="r-btn r-btn--icon"
          to="/retail/more"
          aria-label={ui("Back to More")}
        >
          <ArrowLeft />
        </Link>
        <h1>{ui("Import your data")}</h1>
        <Upload aria-hidden="true" />
      </StitchHeader>
      <main className="r-section r-stitch-import">
        {!owner ? (
          <div className="r-card">
            Ask your shop owner to migrate business records.
          </div>
        ) : (
          <>
            <div className="r-card r-stitch-intro">
              <span className="r-ledger-icon"><FileSpreadsheet size={28}/></span><div>
              <h2>Bring your existing shop to EVOLIX</h2>
              <p>
                1. Export from your old app. 2. Review columns and errors. 3.
                Confirm the import.
              </p>
              <p className="r-caption">
                Start with items, customers, suppliers, stock and opening dues.
                Choose one cutover date and avoid entering the same opening
                stock or dues twice. Existing matching records are skipped,
                never overwritten.
              </p>
            </div></div>
            <nav className="r-card r-stitch-import-progress" aria-label="Import workflow">{['Source','File','Scope','Match','Verify','Ready'].map((label,index)=><span key={label} className={index===(job?.status==='COMPLETE'?5:job?4:file?2:0)?'is-current':''}><i/>{index+1}. {ui(label)}</span>)}</nav>
            {error && (
              <p className="r-state-message" role="alert">
                {error}
              </p>
            )}
            {!catalog && !error && <p role="status">Loading import options…</p>}
            {catalog && (
              <div className="r-card r-import-form">
                <div className="r-field">
                  <span>Previous app</span>
                  <MobileSelect
                    title="Previous app"
                    presentation="segments"
                    value={preset}
                    disabled={busy}
                    onChange={(e) => {
                      setPreset(e.target.value);
                      reset();
                    }}
                  >
                    {catalog.presets.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </MobileSelect>
                </div>
                <div className="r-import-guide">
                  <h3>How to export</h3>
                  <p>
                    {catalog.presets.find((p: any) => p.id === preset)?.guide}
                  </p>
                  {catalog.presets.find((p: any) => p.id === preset)?.url && (
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={
                        catalog.presets.find((p: any) => p.id === preset).url
                      }
                    >
                      Official export guide
                    </a>
                  )}
                </div>
                <label>
                  Data type
                  <MobileSelect
                    title="Data type"
                    value={kind}
                    disabled={busy}
                    onChange={(e) => {
                      setKind(e.target.value);
                      reset();
                    }}
                  >
                    <option value="ITEMS">
                      Items & optional opening stock
                    </option>
                    <option value="CUSTOMERS">
                      Customers & opening receivables
                    </option>
                    <option value="SUPPLIERS">
                      Suppliers & opening payables
                    </option>
                    <option value="STOCK">
                      Opening stock for existing items
                    </option>
                  </MobileSelect>
                </label>
                <label>
                  Cutover date
                  <input
                    type="date"
                    value={date}
                    disabled={busy}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setJob(null);
                    }}
                  />
                </label>
                <label>
                  Exported file
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".csv,.tsv,.txt,.xls,.xlsx,.xlsm,.xlsb,.ods,.json,.ndjson,.xml"
                    disabled={busy}
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      reset();
                    }}
                  />
                </label>
                <p className="r-caption">
                  Up to 5 MB / 10,000 rows. CSV, spreadsheets, flat JSON/NDJSON
                  and Tally master XML/JSON. PDF, photos, DAT and
                  encrypted/proprietary backup files require a structured
                  export. Macros are not executed.
                </p>
                <details>
                  <summary>Spreadsheet options</summary>
                  <label>
                    Sheet name (blank = first)
                    <input
                      value={sheet}
                      onChange={(e) => {
                        setSheet(e.target.value);
                        setJob(null);
                      }}
                    />
                  </label>
                  <label>
                    Header row
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={header}
                      onChange={(e) => {
                        setHeader(Number(e.target.value));
                        setJob(null);
                      }}
                    />
                  </label>
                </details>
                <div className="r-import-actions">
                  <button className="r-btn r-btn--outline" onClick={template}>
                    <FileSpreadsheet size={18} />
                    Download template
                  </button>
                  <button
                    className="r-btn r-btn--primary"
                    disabled={busy || !file}
                    onClick={() => preview()}
                  >
                    {busy ? "Working…" : "Preview file"}
                  </button>
                </div>
              </div>
            )}
            {job && (
              <>
                <div className="r-card">
                  <h2>Column mapping</h2>
                  <p className="r-caption">
                    Select the correct source column for each EVOLIX field. A
                    default is used only when no column is selected. Stock needs
                    actual purchase cost; do not substitute selling price.
                  </p>
                  <div className="r-import-mappings">
                    {catalog.fields[job.kind].map((field: string) => (
                      <div key={field}>
                        <label>
                          {field.replaceAll("_", " ")}
                          <MobileSelect
                            title={field.replaceAll("_", " ")}
                            disabled={busy}
                            value={mapping[field] || ""}
                            onChange={(e) =>
                              setMapping({
                                ...mapping,
                                [field]: e.target.value,
                              })
                            }
                          >
                            <option value="">Not mapped</option>
                            {job.headers.map((h: string) => (
                              <option key={h}>{h}</option>
                            ))}
                          </MobileSelect>
                        </label>
                        <label>
                          Default for {field.replaceAll("_", " ")}
                          <input
                            disabled={busy || !!mapping[field]}
                            value={defaults[field] || ""}
                            onChange={(e) =>
                              setDefaults({
                                ...defaults,
                                [field]: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                  {!file && (
                    <p className="r-caption">
                      To change a historical mapping, select the original export
                      file again and preview it. Existing imported rows are
                      skipped.
                    </p>
                  )}
                  <button
                    className="r-btn r-btn--outline"
                    disabled={busy || !file}
                    onClick={() => preview(true)}
                  >
                    Validate updated mapping
                  </button>
                </div>
                <div className="r-card">
                  <h2>Review before importing</h2>
                  <p role="status">
                    {Object.entries(job.counts)
                      .map(([s, n]) => s + ": " + n)
                      .join(" · ")}
                  </p>
                  <p>Status: {job.status}</p>
                  {!!job.configuration.unmapped.length && (
                    <label>
                      <input
                        type="checkbox"
                        checked={accept}
                        onChange={(e) => setAccept(e.target.checked)}
                      />
                      I reviewed unmapped columns:{" "}
                      {job.configuration.unmapped.join(", ")}. These remain in
                      the source audit and are not posted to business tables.
                    </label>
                  )}
                  <div className="r-import-preview">
                    {job.rows.map((r: any) => (
                      <article key={r.id}>
                        <strong>
                          Row {r.number} · {r.status}
                        </strong>
                        <p>
                          {r.normalized.name ||
                            r.normalized.sku ||
                            r.normalized.code}
                        </p>
                        <p>{r.errors.join(" · ")}</p>
                        <details>
                          <summary>Source & normalized fields</summary>
                          <pre>
                            {JSON.stringify(
                              { source: r.source, normalized: r.normalized },
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      </article>
                    ))}
                  </div>
                  <div className="r-import-actions">
                    <button
                      className="r-btn r-btn--outline"
                      disabled={busy || page <= 1}
                      onClick={() => void openJob(job.id, page - 1)}
                    >
                      Previous
                    </button>
                    <span>Page {page}</span>
                    <button
                      className="r-btn r-btn--outline"
                      disabled={busy || job.rows.length < 50}
                      onClick={() => void openJob(job.id, page + 1)}
                    >{ui("Next")}</button>
                  </div>
                  <p className="r-caption">
                    Each valid row is posted independently. Invalid rows stay
                    out of business tables. Imported rows survive a retry
                    without duplicating opening balances.
                  </p>
                  <button
                    className="r-btn r-btn--primary r-btn--full"
                    disabled={
                      busy ||
                      !(job.counts.READY || job.counts.FAILED) ||
                      (!!job.configuration.unmapped.length && !accept) ||
                      JSON.stringify(mapping) !==
                        JSON.stringify(job.configuration.mapping) ||
                      JSON.stringify(defaults) !==
                        JSON.stringify(job.configuration.defaults)
                    }
                    onClick={commit}
                  >
                    {busy
                      ? "Importing…"
                      : "Confirm valid rows / retry failed rows"}
                  </button>
                  {job.status === 'COMPLETE' && <Link className="r-btn r-btn--primary r-btn--full" to="/retail/home">Continue to Home</Link>}
                </div>
              </>
            )}
            <div className="r-card">
              <h2>Import history</h2>
              {history.length ? (
                history.map((h) => (
                  <button
                    key={h.id}
                    className="r-btn r-btn--outline r-btn--full"
                    disabled={busy}
                    onClick={() => void openJob(h.id, 1, true)}
                  >
                    {h.filename} · {h.kind} · {h.status}
                  </button>
                ))
              ) : (
                <p>No imports yet. Your current shop records remain safe.</p>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
