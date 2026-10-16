import DateInput from '../../shared/components/DateInput';
import { formatDateTime } from '../../shared/dateFormat';
import { ui, useUiLanguage } from "../../i18n";
import { MobileSelect } from "../components/MobileControls";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api, { getApiErrorMessage } from "../../shared/api";
import { useAuthStore } from "../../shared/store/authStore";
const root = "/retail/reports/assistant";
export default function ReportAssistant() {
  useUiLanguage();
  const location = useLocation();
  useEffect(() => {
    if (location.hash === "#report-inbox")
      document
        .getElementById("report-inbox")
        ?.scrollIntoView({ block: "start" });
  }, [location.hash]);
  const user = useAuthStore((s) => s.user),
    owner = ["ADMIN", "OWNER", "TENANT_ADMIN"].includes(user?.role || "");
  const [query, setQuery] = useState(""),
    [date, setDate] = useState(new Date().toLocaleDateString("en-CA")),
    [language, setLanguage] = useState("hi");
  const [answer, setAnswer] = useState<any>(null),
    [inbox, setInbox] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [pref, setPref] = useState({
      enabled: false,
      time: "19:30",
      language: "hi",
    }),
    [notice, setNotice] = useState("");
  const load = async () => {
    setInboxLoading(true);
    try {
      setInbox((await api.get(root + "/notifications")).data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setInboxLoading(false);
    }
  };
  useEffect(() => {
    void load();
    if (owner)
      api
        .get(root + "/preference")
        .then((r) => {
          if (r.data)
            setPref({
              enabled: r.data.enabled,
              time: r.data.time,
              language: r.data.language,
            });
        })
        .catch((e) => setError(getApiErrorMessage(e)));
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    return () => clearInterval(timer);
  }, [owner]);
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setAnswer(null);
    try {
      setAnswer(
        (await api.post(root + "/query", { query, date, language })).data,
      );
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const detail = (r: any) => (
    <div>
      <p lang={r.language}>{r.text}</p>
      <p className="r-caption">
        {r.definition} · Generated{" "}
        {formatDateTime(r.generated_at)}
      </p>
      <details>
        <summary>View exact totals and details</summary>
        {Object.entries(r.totals)
          .filter(([, v]) => typeof v === "number")
          .map(([k, v]) => (
            <div className="r-detail-row" key={k}>
              <span>{k.replaceAll("_", " ")}</span>
              <strong>
                {Number(v).toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
          ))}
        {r.rows?.map((row: any, i: number) => (
          <p key={i}>
            {Object.entries(row)
              .map(([k, v]) => k.replaceAll("_", " ") + ": " + v)
              .join(" · ")}
          </p>
        ))}
        {r.rows?.length === r.detail_limit && (
          <p>
            First {r.detail_limit} details shown. Open the corresponding report
            for more.
          </p>
        )}
      </details>
    </div>
  );
  return (
    <>
      {error && (
        <div className="r-state-message" role="alert">
          {error}
          <button
            className="r-btn r-btn--outline"
            onClick={() => {
              setError("");
              void load();
            }}
          >
            Retry inbox
          </button>
        </div>
      )}
      <div className="r-card">
        <h2>Ask about your shop</h2>
        <p className="r-caption">
          Hindi, Hinglish or English. Answers use posted shop records.
          Supported: sales, udhar, new stock, expenses and daily galla.
        </p>
        <form className="r-import-form" onSubmit={ask}>
          <label>
            Your question
            <input
              required
              maxLength={500}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Aaj kitne logo ko udhaar diya?"
            />
          </label>
          <label>
            Business date
            <DateInput
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)} lang="en-GB"
            />
          </label>
          <div>
            <span className="r-label">Answer language</span>
            <MobileSelect
              presentation="segments"
              title="Answer language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="hi">हिन्दी</option>
              <option value="en">{ui("English")}</option>
            </MobileSelect>
          </div>
          <button className="r-btn r-btn--primary" disabled={busy}>
            {busy ? "Reading your records…" : "Get report answer"}
          </button>
        </form>
        {answer && <div role="status">{detail(answer)}</div>}
      </div>
      {owner && (
        <div className="r-card">
          <h2>Daily report notification</h2>
          <p className="r-caption">
            Automatically prepared on the server. Read here when you open the
            app. No WhatsApp, email or browser messages are sent.
          </p>
          <form
            className="r-import-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api.post(root + "/preference", pref);
                setNotice("Daily report preference saved");
              } catch (err) {
                setError(getApiErrorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              <input
                type="checkbox"
                checked={pref.enabled}
                onChange={(e) =>
                  setPref({ ...pref, enabled: e.target.checked })
                }
              />
              Enable daily summaries
            </label>
            <label>
              Summary time (India)
              <input
                type="time"
                required
                value={pref.time}
                onChange={(e) => setPref({ ...pref, time: e.target.value })}
              />
            </label>
            <div>
              <span className="r-label">Summary language</span>
              <MobileSelect
                title="Summary language"
                presentation="segments"
                value={pref.language}
                onChange={(e) => setPref({ ...pref, language: e.target.value })}
              >
                <option value="hi">हिन्दी</option>
                <option value="en">{ui("English")}</option>
              </MobileSelect>
            </div>
            <button className="r-btn r-btn--outline" disabled={busy}>
              Save notification preference
            </button>
          </form>
          {notice && <p role="status">{notice}</p>}
        </div>
      )}
      <div className="r-card" id="report-inbox">
        <h2>Report inbox {inbox?.unread ? `(${inbox.unread} unread)` : ""}</h2>
        {inboxLoading && !inbox ? (
          <p role="status">Loading reports…</p>
        ) : !inbox ? (
          <p>Reports could not be loaded. Use Retry inbox to try again.</p>
        ) : !inbox.rows.length ? (
          <p>
            No summaries yet. Enable daily notifications to receive a report
            after your chosen time.
          </p>
        ) : (
          inbox.rows.map((n: any) => (
            <article className="r-import-inbox" key={n.id}>
              <h3>
                {n.day} {n.read_at ? "" : "· New"}
              </h3>
              {detail(n.summary)}
              {!n.read_at && (
                <button
                  className="r-btn r-btn--outline"
                  onClick={async () => {
                    try {
                      await api.post(root + "/notifications/" + n.id + "/read");
                      await load();
                    } catch (e) {
                      setError(getApiErrorMessage(e));
                    }
                  }}
                >
                  Mark read
                </button>
              )}
            </article>
          ))
        )}
      </div>
    </>
  );
}
