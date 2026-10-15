import { trackExperience } from "./experienceEvents";
import { useEffect, useState } from "react";
import { AlertTriangle, Package, Wallet, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Sheet } from "../components/MobileControls";
import { ui } from "../../i18n";
import type { HomeSuggestion } from "./useHomeExperience";
export default function SuggestionCard({
  suggestion: r,
  onSnooze,
}: {
  suggestion: HomeSuggestion;
  onSnooze: (id: string) => void;
}) {
  const [why, setWhy] = useState(false),
    navigate = useNavigate(),
    Icon =
      r.kind.includes("STOCK") || r.kind.includes("COST")
        ? Package
        : r.kind.includes("DUE") || r.kind.includes("GALLA")
          ? Wallet
          : r.critical
            ? AlertTriangle
            : Sparkles;
  useEffect(() => {
    trackExperience("home_suggestion_shown", { workflow: "HOME" });
  }, [r.id]);
  return (
    <article className="xp-card xp-suggestion xp-tinted" data-accent={r.tone}>
      <div className="xp-card-heading">
        <span className="xp-icon">
          <Icon size={22} aria-hidden="true" />
        </span>
        <div>
          <h3>{r.title}</h3>
          <p>{r.description}</p>
        </div>
      </div>
      <div className="xp-suggestion-actions">
        <button
          className="r-btn r-btn--outline"
          onClick={() => {
            trackExperience("home_suggestion_actioned", { workflow: "HOME" });
            navigate(r.action.path);
          }}
        >
          {ui(r.action.label)}
        </button>
        <button className="xp-why" onClick={() => setWhy(true)}>
          {ui("Why this?")}
        </button>
      </div>
      <Sheet
        open={why}
        onClose={() => setWhy(false)}
        title={ui("Why this suggestion?")}
      >
        <p className="xp-muted">{r.why}</p>
        {!r.critical && (
          <button
            className="r-btn r-btn--outline r-w-full"
            onClick={() => {
              trackExperience("home_suggestion_dismissed", {
                workflow: "HOME",
              });
              onSnooze(r.id);
              setWhy(false);
            }}
          >
            {ui("Remind me in 7 days")}
          </button>
        )}
        {r.critical && (
          <p className="xp-muted">
            {ui("This reminder stays visible while the recorded risk remains.")}
          </p>
        )}
      </Sheet>
    </article>
  );
}
