import { formatDateTime } from '../../shared/dateFormat';
import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import { MobileSelect, Sheet } from "../components/MobileControls";
import { useRetailEntitlements } from '../subscription/useRetailEntitlements';
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Send,
  RotateCcw,
  ChevronRight,
  ShieldCheck,
  Mic,
} from "lucide-react";
import api, { getApiErrorMessage } from "../../shared/api";
import "./assistant.css";
type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  reply?: any;
};
const chips = [
  "Sale kam kyu hai?",
  "Profit kam kyu hua?",
  "Sale badhi lekin profit kyu gira?",
  "Paisa kidhar gaya?",
  "Aaj ki sale?",
  "Aaj ka galla?",
  "Cash kitna aaya?",
  "Low stock?",
  "Customer ka udhar?",
  "Supplier total due?",
  "Aaj ka expense?",
  "Need list?",
];
const title = (s: string) =>
  s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const amount = (value: unknown, key: string) =>
  ['gross_margin','cost_coverage','margin'].includes(key)&&value!=null?String(value)+'%':
  typeof value==='string'&&/^[-\d.]+$/.test(value)&&/sales|profit|cogs|expenses|revenue/.test(key)?'₹'+Number(value).toLocaleString('en-IN',{maximumFractionDigits:2}):
  typeof value === "number" &&
  !/count|bills|items|needs|lots|records|quantity|days|threshold/.test(key)
    ? "₹" + value.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : String(value ?? "Not counted");
function MetricCards({ summary }: { summary: Record<string, unknown> }) {
  useUiLanguage();
  const priority = [
    "net_sales",
    "bills_count",
    "cash_sales",
    "upi_sales",
    "udhar_sales",
    "returns",
    "total_sales",
    "cash_received",
    "old_customer_dues_received",
    "cash_paid_out",
    "expected_cash",
  ];
  const entries = Object.entries(summary),
    keys =
      summary.gross_profit!==undefined?['net_sales','cogs','gross_profit','gross_margin','net_business_profit','cost_coverage']:
      summary.expected_cash !== undefined
        ? [
            "total_sales",
            "cash_received",
            "upi_sales",
            "old_customer_dues_received",
            "cash_paid_out",
            "expected_cash",
          ]
        : priority,
    main =
      entries.length > 6
        ? keys
            .filter((key) => key in summary)
            .slice(0, 6)
            .map((key) => [key, summary[key]] as [string, unknown])
        : entries;
  const shown = main.length ? main : entries.slice(0, 6),
    more = entries.filter(([key]) => !shown.some(([k]) => k === key));
  const cards = (rows: [string, unknown][]) => (
    <dl>
      {rows.map(([key, value]) => (
        <div key={key}>
          <dt>{title(key)}</dt>
          <dd>{amount(value, key)}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <>
      {cards(shown)}
      {!!more.length && (
        <details>
          <summary>More business details</summary>
          {cards(more)}
        </details>
      )}
    </>
  );
}
function InsightCard({ insight, summary, onFollowUp, disabled }: { insight:any;summary:Record<string,unknown>;onFollowUp:(q:string)=>void;disabled:boolean }) {
  useUiLanguage();
  const current=summary.current_value,previous=summary.previous_value,change=summary.change,percent=summary.change_percent;
  const metric=String(summary.metric||'business').replaceAll('_',' ');
  const format=(v:any)=>v==null?'Not available':typeof v==='number'?(metric==='gross margin'?`${Math.abs(v).toFixed(2)}%`:'₹'+Math.abs(v).toLocaleString('en-IN',{maximumFractionDigits:2})):String(v);
  const deltaLabel=metric==='gross margin'?`${Math.abs(Number(change||0)).toFixed(2)} points`:format(change);
  return <section className="r-insight-card" data-direction={Number(change)<0?'negative':'positive'} aria-label="Business comparison">
    <div className="r-insight-heading"><div><small>{insight.confidence==='LIMITED'?'PARTIAL COST COVERAGE':insight.confidence==='INSUFFICIENT'?'NEEDS MORE DATA':'SHOP RECORDS'}</small><h3>{metric}</h3></div>
      <strong className={Number(change)<0?'is-down':Number(change)>0?'is-up':''}>{Number(change)<0?'↓':Number(change)>0?'↑':'•'} {deltaLabel}{percent==null?'':` (${Number(percent).toFixed(1)}%)`}</strong></div>
    <div className="r-insight-periods"><div><small>Selected period</small><strong>{format(current)}</strong><span>{insight.current_period?.from} – {insight.current_period?.to}</span></div><div><small>Previous equal period</small><strong>{format(previous)}</strong><span>{insight.comparison_period?.from} – {insight.comparison_period?.to}</span></div></div>
    {!!insight.drivers?.length&&<div className="r-insight-drivers"><h4>Main signals</h4>{insight.drivers.slice(0,6).map((d:any,i:number)=><article key={`${d.type}-${i}`} className="r-insight-driver"><span className="xp-reason-rank" aria-label={ui('Reason')+' '+(i+1)}>{i+1}</span><div><strong>{ui(d.title)}</strong><span className={`r-evidence r-evidence--${String(d.evidence_type).toLowerCase()}`}>{d.evidence_type==='DIRECT'?'Direct':d.evidence_type==='CORRELATED'?'Related signal':'Estimate'}</span></div><p>{d.description}</p></article>)}</div>}
    {insight.confidence==='LIMITED'&&<p className="r-insight-warning">{String(summary.profit_warning||'Some historical costs are unknown. Profit is a known-cost subtotal.')}</p>}
    {!!insight.follow_ups?.length&&<div className="r-assistant-chips r-insight-followups" aria-label="Suggested follow-up questions">{insight.follow_ups.slice(0,5).map((q:string)=><button key={q} className="r-btn r-btn--outline" disabled={disabled} onClick={()=>onFollowUp(q)}>{q}</button>)}</div>}
  </section>;
}
export default function RetailAssistant({ embedded = false }: { embedded?: boolean }) {
  useUiLanguage();
  const access=useRetailEntitlements(),[params]=useSearchParams();
  const [voiceInfo,setVoiceInfo]=useState(false);
  const [messages, setMessages] = useState<Message[]>([]),
    [draft, setDraft] = useState(()=>String(params.get('q')||'').slice(0,1000)),
    [language, setLanguage] = useState("hinglish"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState("");
  const session = useRef<{ id: string; version: number } | null>(null),
    tail = useRef<HTMLDivElement>(null),
    nextId = useRef(0),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    tail.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, busy]);
  async function ask(message: string, fresh = false) {
    if (busy || !message.trim()) return;
    setBusy(true);
    setError("");
    setRetry(message);
    setDraft("");
    if (fresh) session.current = null;
    setMessages((m) => [
      ...m.slice(-58),
      { id: nextId.current++, role: "user", text: message },
    ]);
    try {
      const { data } = await api.post(
        "/assistant/query",
        {
          message,
          language,
          ...(session.current
            ? {
                session_id: session.current.id,
                session_version: session.current.version,
              }
            : {}),
        },
        { timeout: 20000 },
      );
      if (!alive.current) return;
      session.current = { id: data.session_id, version: data.session_version };
      setMessages((m) => [
        ...m,
        {
          id: nextId.current++,
          role: "assistant",
          text: data.text,
          reply: data,
        },
      ]);
      setRetry("");
    } catch (err) {
      if (alive.current) {
        setError(getApiErrorMessage(err));
        session.current = null;
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(draft.trim());
  }
  const latest = messages.filter((m) => m.role === "assistant").at(-1)?.id;
  const Header = embedded ? 'header' : StitchHeader;
  const Page = embedded ? 'section' : 'main';
  return (
    <Page className="r-assistant-page">
      <Header className="r-page-header r-assistant-header">
        <div>
          <h1>{ui("Ask Apna Galla")}</h1>
          <p>Apke dukaan ke data se seedhe jawab.</p>
        </div>
        <button
          className="r-btn r-btn--icon"
          aria-label="Start new conversation"
          disabled={busy}
          onClick={() => {
            session.current = null;
            setMessages([]);
            setError("");
            setRetry("");
            setDraft("");
          }}
        >
          <RotateCcw size={21} />
        </button>
      </Header>
      <p className="r-assistant-trust">
        <ShieldCheck size={16} aria-hidden="true" />
        Your shop records · Read-only · No external AI calls
      </p>
      <div className="r-assistant-language">
        <span>Answer language</span>
        <MobileSelect
          presentation="segments"
          title="Answer language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={busy}
        >
          <option value="hinglish">Hinglish</option>
          <option value="hi">हिन्दी</option>
          <option value="en">{ui("English")}</option>
        </MobileSelect>
      </div>
      {!messages.length && (
        <section className="r-assistant-welcome">
          <h2>Your shop, explained simply</h2>
          <p>
            Ask about sales, counter cash, stock, dues or expenses. Apna Galla reads
            your recorded business data.
          </p>
          <div className="r-assistant-chips">
            {(access.isFeatureEffective('BUSINESS_INSIGHTS')?chips:['Aaj ki sale kitni hai?','Aaj ka expense?','Low stock kya hai?']).map((q) => (
              <button
                className="r-btn r-btn--outline"
                key={q}
                onClick={() => void ask(q)}
                disabled={busy}
              >
                {q}
              </button>
            ))}
          </div>
        </section>
      )}
      <section
        className="r-assistant-messages"
        aria-label="Conversation"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((m) => (
          <article
            key={m.id}
            className={"r-assistant-message r-assistant-message--" + m.role}
            aria-label={m.role === "user" ? "Your question" : "Apna Galla answer"}
          >
            <span className="r-assistant-speaker">
              {m.role === "user" ? "You" : "Apna Galla"}
            </span>
            <p>{m.text}</p>
            {m.reply?.period && (
              <small>
                {ui(m.reply.period.label)} · {m.reply.period.timezone}
              </small>
            )}
            {m.reply?.result && (
              <div className="r-assistant-result">
                {m.reply.result.insight?<InsightCard insight={m.reply.result.insight} summary={m.reply.result.summary} onFollowUp={(q)=>void ask(q)} disabled={busy}/>:<MetricCards summary={m.reply.result.summary} />}
                {!!m.reply.result.rows?.length && (
                  <div className="r-assistant-table-wrap">
                    <table>
                      <caption>{ui(m.reply.result.title)}</caption>
                      <thead>
                        <tr>
                          {Object.keys(m.reply.result.rows[0]).map((k) => (
                            <th key={k} scope="col">
                              {title(k)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {m.reply.result.rows.map((row: any, i: number) => (
                          <tr key={i}>
                            {Object.entries(row).map(([key, value]) => (
                              <td key={key}>{amount(value, key)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <details>
                  <summary>How this is calculated</summary>
                  <p>{m.reply.result.definition}</p>
                  <p>
                    Generated{" "}
                    {formatDateTime(m.reply.generated_at)}
                  </p>
                </details>
                {m.reply.result.link && (
                  <Link
                    className="r-assistant-report-link"
                    to={m.reply.result.link}
                  >
                    Open related page
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                )}
                {m.reply.result.hasMore && m.id === latest && (
                  <button
                    className="r-btn r-btn--outline"
                    disabled={busy}
                    onClick={() => void ask("Aur dikhao")}
                  >{ui("Show more")}</button>
                )}
              </div>
            )}
            {m.reply?.choices && m.id === latest && (
              <div className="r-assistant-choices">
                {m.reply.choices.map((c: any) => (
                  <button
                    key={c.value}
                    className="r-btn r-btn--outline"
                    disabled={busy}
                    onClick={() => void ask(c.value)}
                  >
                    {ui(c.label)}
                  </button>
                ))}
              </div>
            )}
            {m.reply?.status === "PERMISSION_DENIED" && (
              <p className="r-caption">Ask your shop owner about access.</p>
            )}
          </article>
        ))}
        {busy && (
          <p className="r-state-message" role="status">
            Reading your shop records…
          </p>
        )}
        {error && (
          <div className="r-state-message" role="alert">
            <p>{error}</p>
            <p>
              Retry starts a fresh context. No business records were changed.
            </p>
            <button
              className="r-btn r-btn--outline"
              onClick={() => void ask(retry, true)}
              disabled={busy}
            >
              Retry question
            </button>
          </div>
        )}
        <div ref={tail} />
      </section>
      <form className="r-assistant-composer" onSubmit={submit}>
        <label htmlFor="assistant-question">Ask about your shop</label>
        <div>
          <input
            id="assistant-question"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={400}
            placeholder="Aaj ki sale kitni hui?"
            disabled={busy}
          />
          <button type="button" className="r-btn r-btn--outline" aria-label={ui('Voice assistant coming soon')} onClick={()=>setVoiceInfo(true)}><Mic size={20}/></button>
          <button
            type="submit"
            className="r-btn r-btn--primary"
            aria-label="Send question"
            disabled={busy || !draft.trim()}
          >
            <Send size={20} />
          </button>
        </div>
        <small>
          Answers use recorded data. V1 cannot create bills or change stock.
        </small>
      </form>
      <Sheet open={voiceInfo} onClose={()=>setVoiceInfo(false)} title={ui('Voice assistant — Coming Soon')}>
        <p>{ui('Voice is not included in the current plans. Text Ask Apna Galla remains available.')}</p>
      </Sheet>
    </Page>
  );
}
