import { formatDate } from '../../shared/dateFormat';
import { trackExperience } from "../experience/experienceEvents";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Camera,
  FileSpreadsheet,
  MessageCircle,
  Mic,
  Plus,
  Rows3,
  Upload,
} from "lucide-react";
import api, { getApiErrorMessage } from "../../shared/api";
import { ui, useUiLanguage } from "../../i18n";
import StitchHeader from "../design/StitchHeader";
import { PrimaryActionCard } from "../experience/ExperienceComponents";
import { useBusinessPreset } from "../experience/useBusinessPreset";
import { MobileSelect } from "../components/MobileControls";
import IntakeReview from "./IntakeReview";
import { browserSpeechProvider, type SpeechLanguage } from "./speechProvider";
import { statusLabel } from "./intakeCopy";
import {
  readWorkflowDraft,
  useWorkflowDraft,
} from "../experience/workflowDraft";
import "./intake.css";
const methods: Record<
  string,
  {
    title: string;
    description: string;
    Icon: typeof Camera;
    tone: "brand" | "info" | "special";
  }
> = {
  SUPPLIER_BILL_IMAGE: {
    title: "Scan Supplier Bill",
    description:
      "Take a supplier bill photo. Review a purchase draft before saving.",
    Icon: Camera,
    tone: "brand",
  },
  EXCEL: {
    title: "Import Excel / CSV",
    description: "Upload your existing item list and review it.",
    Icon: FileSpreadsheet,
    tone: "info",
  },
  VOICE: {
    title: "Speak Items",
    description: "Say the item name, quantity and selling price. Experimental.",
    Icon: Mic,
    tone: "special",
  },
  SHARED_DOCUMENT: {
    title: "Share from WhatsApp",
    description:
      "Receive a supplier bill, or save it on your phone and upload here.",
    Icon: MessageCircle,
    tone: "brand",
  },
};
export default function RetailIntake() {
  useUiLanguage();
  const navigate = useNavigate(),
    [params, setParams] = useSearchParams(),
    preset = useBusinessPreset(),
    source = params.get("source") || "",
    jobId = params.get("job") || "",
    shared = params.get("shared") || "";
  const [job, setJob] = useState<any>(null),
    [caps, setCaps] = useState<any>(null),
    [pendingShare, setPendingShare] = useState(""),
    [history, setHistory] = useState<any[]>([]),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [transcript, setTranscript] = useState(
      () => readWorkflowDraft<string>("intake-voice") || "",
    ),
    [language, setLanguage] = useState<SpeechLanguage>("hi-IN"),
    [listening, setListening] = useState(false),
    [voiceError, setVoiceError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null),
    cameraInput = useRef<HTMLInputElement>(null),
    stop = useRef<(() => void) | null>(null);
  useWorkflowDraft("intake-voice", transcript);
  useEffect(() => {
    trackExperience("intake_opened", { workflow: "INTAKE" });
    let alive = true;
    Promise.all([
      api.get("/retail/account/intake/capabilities"),
      api.get("/retail/account/intake"),
    ])
      .then(([c, h]) => {
        if (alive) {
          setCaps(c.data);
          setHistory(h.data);
        }
      })
      .catch((e) => {
        if (alive) setError(getApiErrorMessage(e));
      });
    return () => {
      alive = false;
      stop.current?.();
    };
  }, []);
  useEffect(() => {
    if ("caches" in window)
      void caches
        .open("apna-intake-share-v1")
        .then((c) => c.keys())
        .then((keys) => {
          const key = keys.at(-1);
          if (key)
            setPendingShare(new URL(key.url).pathname.split("/").pop() || "");
        })
        .catch(() => {});
  }, []);
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!shared || !navigator.serviceWorker) return;
    let alive = true;
    fetch("/_intake_share/" + encodeURIComponent(shared))
      .then(async (r) => {
        if (!r.ok)
          throw Error(
            "Shared file expired. Save it from WhatsApp and upload it here.",
          );
        const blob = await r.blob();
        if (alive) {
          trackExperience("whatsapp_share_received", { workflow: "INTAKE" });
          setFile(
            new File(
              [blob],
              "shared-bill." +
                (blob.type === "image/png"
                  ? "png"
                  : blob.type === "image/webp"
                    ? "webp"
                    : "jpg"),
              { type: blob.type },
            ),
          );
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [shared]);
  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    let alive = true;
    api
      .get("/retail/account/intake/" + jobId, { params: { page } })
      .then((r) => {
        if (alive) setJob(r.data);
      })
      .catch((e) => {
        if (alive) setError(getApiErrorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [jobId, page]);
  useEffect(() => {
    if (!jobId || !["RECEIVED", "PROCESSING"].includes(job?.status)) return;
    let alive = true;
    const timer = setInterval(() => {
      if (!document.hidden)
        api
          .get("/retail/account/intake/" + jobId)
          .then((r) => {
            if (alive) setJob(r.data);
          })
          .catch(() => {});
    }, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [jobId, job?.status]);
  const update = (next: any) => {
    setJob(next);
    if (next.id !== jobId) {
      setPage(1);
      setParams({ job: next.id });
    }
  };
  const select = (value: string) => {
    trackExperience("intake_method_selected", {
      workflow: "INTAKE",
      count:
        ["SUPPLIER_BILL_IMAGE", "EXCEL", "VOICE", "SHARED_DOCUMENT"].indexOf(
          value,
        ) + 1,
    });
    stop.current?.();
    setFile(null);
    setError("");
    setParams({ source: value });
  };
  const chooseFile = (selected: File | undefined) => {
    if (!selected) return;
    if (!selected.size || selected.size > 5 * 1024 * 1024) {
      setError(ui("Choose a non-empty file up to 5 MB."));
      return;
    }
    setError("");
    setFile(selected);
  };
  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      let result: any;
      if (source === "VOICE") {
        trackExperience("voice_parsed", { workflow: "INTAKE" });
        result = await api.post("/retail/account/intake/voice", { transcript });
      } else {
        trackExperience(
          source === "EXCEL"
            ? "excel_upload_started"
            : "supplier_bill_capture_started",
          { workflow: "INTAKE" },
        );
        if (!file) throw Error("Choose a file first.");
        const form = new FormData();
        form.append("file", file);
        if (source === "SHARED_DOCUMENT")
          form.append("source", "SHARED_DOCUMENT");
        result = await api.post(
          "/retail/account/intake/" +
            (source === "EXCEL" ? "spreadsheet" : "photo"),
          form,
        );
      }
      update(result.data);
      if (shared)
        await caches
          .open("apna-intake-share-v1")
          .then((c) => c.delete("/_intake_share/" + shared))
          .catch(() => {});
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const current = methods[source];
  return (
    <div className="r-page-with-sticky">
      <StitchHeader
        onBack={() =>
          source || jobId ? setParams({}) : navigate("/retail/items")
        }
      >
        <h1>
          {ui(
            jobId
              ? "Review Before Saving"
              : current?.title || "Add Items Faster",
          )}
        </h1>
      </StitchHeader>
      <main className="r-section xp-stack xp-intake">
        {error && (
          <p className="r-state-message" role="alert">
            {error}
          </p>
        )}
        {!source && !jobId && (
          <>
            <p className="xp-muted">
              {ui("Start with the information you already have.")}
            </p>
            <div className="xp-action-grid">
              {(
                preset.intakeOrder || [
                  "SUPPLIER_BILL_IMAGE",
                  "EXCEL",
                  "VOICE",
                  "SHARED_DOCUMENT",
                ]
              ).map((key, index) => {
                const m = methods[key];
                return (
                  <PrimaryActionCard
                    key={key}
                    title={m.title}
                    description={m.description}
                    Icon={m.Icon}
                    tone={m.tone}
                    badge={
                      key === "VOICE"
                        ? "Experimental"
                        : index === 0
                          ? "Recommended"
                          : undefined
                    }
                    onClick={() => select(key)}
                  />
                );
              })}
            </div>
            <section className="xp-card">
              <h2>{ui("Prefer doing it manually?")}</h2>
              <div className="xp-suggestion-actions">
                <button
                  className="r-btn r-btn--outline"
                  onClick={() => navigate("/retail/items/add")}
                >
                  <Plus size={20} />
                  {ui("Add One Item")}
                </button>
                <button
                  className="r-btn r-btn--outline"
                  onClick={() => navigate("/retail/items/bulk")}
                >
                  <Rows3 size={20} />
                  {ui("Add Many Items")}
                </button>
              </div>
            </section>
            {pendingShare && (
              <button
                className="r-btn r-btn--outline"
                onClick={() =>
                  setParams({ source: "SHARED_DOCUMENT", shared: pendingShare })
                }
              >
                {ui("Continue a shared bill")}
              </button>
            )}
            {!!history.length && (
              <details className="xp-card">
                <summary>{ui("Your saved intakes")}</summary>
                <div className="xp-stack">
                  {history.map((h) => (
                    <button
                      className="xp-quick-row"
                      key={h.id}
                      onClick={() => setParams({ job: h.id })}
                    >
                      <FileSpreadsheet size={22} />
                      <span>
                        <strong>
                          {ui(methods[h.filename]?.title || "Item intake")}
                        </strong>
                        <small>
                          {ui(statusLabel[h.status] || h.status)} ·{" "}
                          {formatDate(h.created_at)}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
        {!!current && !jobId && (
          <>
            {source === "VOICE" ? (
              <section className="xp-card">
                <p>
                  {ui(
                    "Experimental. Check the transcript before creating a draft. Your browser may use its speech service; no paid AI service is added by Apna Galla.",
                  )}
                </p>
                <p className="xp-muted">
                  {ui("Example")}:{" "}
                  {preset.voiceExample || "Biscuit 20 packet price 14 rupees"}
                </p>
                <label>{ui("Speaking language")}</label>
                <MobileSelect
                  title="Speaking language"
                  value={language}
                  onChange={(e) =>
                    setLanguage(e.target.value as SpeechLanguage)
                  }
                >
                  <option value="hi-IN">हिन्दी / Hinglish</option>
                  <option value="en-IN">English (India)</option>
                </MobileSelect>
                {browserSpeechProvider.supported ? (
                  <button
                    className="r-btn r-btn--outline r-w-full"
                    onClick={() => {
                      if (listening) {
                        stop.current?.();
                        setListening(false);
                        return;
                      }
                      setVoiceError("");
                      trackExperience("voice_started", { workflow: "INTAKE" });
                      setListening(true);
                      try {
                        stop.current = browserSpeechProvider.start(
                          language,
                          (text) =>
                            setTranscript((old) =>
                              old ? old + "\n" + text : text,
                            ),
                          setVoiceError,
                          () => setListening(false),
                        );
                      } catch {
                        setVoiceError(
                          "Microphone unavailable. Type items instead.",
                        );
                        setListening(false);
                      }
                    }}
                  >
                    <Mic size={21} />
                    {ui(listening ? "Stop listening" : "Tap and Speak")}
                  </button>
                ) : (
                  <p className="xp-muted">
                    {ui(
                      "Voice input isn't supported on this device yet. Type Items Instead.",
                    )}
                  </p>
                )}
                {voiceError && <p role="status">{voiceError}</p>}
                <label htmlFor="intake-transcript">
                  {ui("You said / type items")}
                </label>
                <textarea
                  id="intake-transcript"
                  className="r-input"
                  rows={5}
                  maxLength={16000}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                />
                <p className="xp-muted">
                  {ui(
                    "One item per line: name, quantity, unit, price. Hindi digits and common unit words are supported; other words need correction.",
                  )}
                </p>
              </section>
            ) : (
              <section className="xp-card">
                <p>
                  {ui(
                    source === "EXCEL"
                      ? "Choose a CSV, XLS or XLSX item list. Familiar headings are matched automatically."
                      : "Keep the complete supplier bill straight and inside the frame.",
                  )}
                </p>
                {source === "SHARED_DOCUMENT" && (
                  <p className="xp-muted">
                    {ui(
                      "On supported installed Android/PWA devices, share a bill image to Apna Galla. Otherwise save the WhatsApp invoice to your phone and upload it here. PDF is not supported yet.",
                    )}
                  </p>
                )}
                {source !== "EXCEL" && !caps?.ocr_enabled && (
                  <p className="xp-muted">
                    {ui(
                      "The bill reader needs a configured worker. You can keep this photo as a draft or enter the purchase manually.",
                    )}
                  </p>
                )}
                <input
                  hidden
                  ref={fileInput}
                  type="file"
                  accept={
                    source === "EXCEL"
                      ? ".csv,.xls,.xlsx"
                      : "image/jpeg,image/png,image/webp"
                  }
                  onChange={(e) => chooseFile(e.target.files?.[0])}
                />
                <input
                  hidden
                  ref={cameraInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={(e) => chooseFile(e.target.files?.[0])}
                />
                {preview ? (
                  <>
                    <img
                      className="xp-document-preview"
                      src={preview}
                      alt={ui("Supplier bill preview")}
                    />
                    <div className="xp-suggestion-actions">
                      <button
                        className="r-btn r-btn--outline"
                        onClick={() => cameraInput.current?.click()}
                      >
                        {ui("Retake Photo")}
                      </button>
                      <button
                        className="r-btn r-btn--outline"
                        onClick={() => fileInput.current?.click()}
                      >
                        {ui("Choose Another Photo")}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="xp-stack">
                    {source !== "EXCEL" && (
                      <button
                        className="r-btn r-btn--outline"
                        onClick={() => cameraInput.current?.click()}
                      >
                        <Camera size={21} />
                        {ui("Take Photo")}
                      </button>
                    )}
                    <button
                      className="r-btn r-btn--outline"
                      onClick={() => fileInput.current?.click()}
                    >
                      <Upload size={21} />
                      {ui(
                        source === "EXCEL"
                          ? "Choose File"
                          : "Choose from Gallery",
                      )}
                    </button>
                  </div>
                )}
                {file && !preview && <p>{file.name}</p>}
                <p className="xp-muted">
                  {ui(
                    source === "EXCEL"
                      ? "Up to 5 MB and 2,000 rows. Review opening stock before saving."
                      : "Up to 5 MB. A photo is document evidence, not an item image.",
                  )}
                </p>
              </section>
            )}
            <button
              className="r-btn r-btn--primary r-w-full"
              disabled={
                busy ||
                listening ||
                (source === "VOICE" ? !transcript.trim() : !file)
              }
              onClick={() => void start()}
            >
              {ui(
                busy
                  ? "Preparing review…"
                  : source === "VOICE" || source === "EXCEL"
                    ? "Review Items"
                    : "Use Photo",
              )}
            </button>
            {source !== "VOICE" && source !== "EXCEL" && (
              <button
                className="r-btn r-btn--outline"
                onClick={() => navigate("/retail/purchases/new")}
              >
                {ui("Enter Purchase Manually")}
              </button>
            )}
            <button
              className="r-btn r-btn--outline"
              onClick={() => setParams({})}
            >
              {ui("All intake methods")}
            </button>
          </>
        )}
        {jobId && !job && (
          <p role="status">{ui("Loading your saved review…")}</p>
        )}
        {job && ["RECEIVED", "PROCESSING"].includes(job.status) && (
          <section className="xp-card" role="status">
            <h2>{ui(statusLabel[job.status])}</h2>
            <p>
              {ui(job.configuration.stage || "Waiting for the bill reader")}
            </p>
            <p className="xp-muted">
              {ui(
                "No stock or money has changed. You may leave this screen and reopen this intake later.",
              )}
            </p>
            {!job.configuration.ocr_enabled && (
              <p>
                {ui(
                  "The OCR worker is not enabled on this server. Use the manual purchase form, or ask your administrator to configure it.",
                )}
              </p>
            )}
            <button
              className="r-btn r-btn--outline"
              onClick={() => navigate("/retail/purchases/new")}
            >
              {ui("Enter Purchase Manually")}
            </button>
          </section>
        )}
        {job?.status === "FAILED" && (
          <section className="xp-card">
            <h2>{ui("We couldn't read enough details from this bill.")}</h2>
            <p>{job.configuration.error}</p>
            <button
              className="r-btn r-btn--outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  update(
                    (
                      await api.post(
                        "/retail/account/intake/" + job.id + "/retry",
                      )
                    ).data,
                  );
                } catch (e) {
                  setError(getApiErrorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {ui("Read photo again")}
            </button>
            <button
              className="r-btn r-btn--outline"
              onClick={() => select("SUPPLIER_BILL_IMAGE")}
            >
              {ui("Choose Another Photo")}
            </button>
            <button
              className="r-btn r-btn--primary"
              onClick={() => navigate("/retail/purchases/new")}
            >
              {ui("Enter Purchase Manually")}
            </button>
          </section>
        )}
        {job &&
          ["NEEDS_REVIEW", "READY", "PARTIAL", "CONFIRMED"].includes(
            job.status,
          ) && (
            <IntakeReview
              key={job.id}
              job={job}
              onUpdate={update}
              onPage={setPage}
            />
          )}
        {job?.status === "CANCELLED" && (
          <p role="status">
            {ui("This draft was cancelled. Saved records remain in your shop.")}
          </p>
        )}
        {job && (
          <button
            className="r-btn r-btn--outline"
            onClick={() => setParams({})}
          >
            {ui("All intake methods")}
          </button>
        )}
        {job && !["CONFIRMED", "CANCELLED"].includes(job.status) && (
          <details className="xp-card">
            <summary>{ui("Discard this draft")}</summary>
            <p>
              {ui(
                "Unsaved rows will be removed. Already saved items stay in your shop.",
              )}
            </p>
            <button
              className="r-btn r-btn--danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.post(
                    "/retail/account/intake/" + job.id + "/cancel",
                  );
                  trackExperience("intake_abandoned", { workflow: "INTAKE" });
                  setParams({});
                } catch (e) {
                  setError(getApiErrorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {ui("Discard unsaved draft")}
            </button>
          </details>
        )}
      </main>
    </div>
  );
}
