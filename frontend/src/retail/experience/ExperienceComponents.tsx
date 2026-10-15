import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { ui } from "../../i18n";
import type { ExperienceTone } from "./ExperienceCard";

export function BrandHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div className={"xp-brand" + (compact ? " xp-brand--compact" : "")}>
      <span className="xp-brand-mark">
        <img src="/brand/apna-galla-app-192.png" width={compact ? 36 : 44} height={compact ? 36 : 44} alt="" />
      </span>
      <div>
        <strong>Apna Galla</strong>
        {!compact && <small>{ui("Dukaan ka hisaab. Bas poochho.")}</small>}
      </div>
    </div>
  );
}
export function PrimaryActionCard({
  title,
  description,
  Icon,
  tone = "brand",
  onClick,
  id,
  badge,
}: {
  title: string;
  description: string;
  Icon: LucideIcon;
  tone?: ExperienceTone;
  onClick: () => void;
  id?: string;
  badge?: string;
}) {
  return (
    <button
      id={id}
      className="xp-action-card xp-tinted"
      data-accent={tone}
      onClick={onClick}
    >
      {badge && <small className="xp-card-badge">{ui(badge)}</small>}
      <span className="xp-icon">
        <Icon size={25} aria-hidden="true" />
      </span>
      <strong>{ui(title)}</strong>
      <span>{ui(description)}</span>
      <ArrowRight size={19} className="xp-card-arrow" aria-hidden="true" />
    </button>
  );
}
export function MetricCard({
  label,
  value,
  context,
  Icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  context?: string;
  Icon: LucideIcon;
  tone: ExperienceTone;
  onClick: () => void;
}) {
  return (
    <button
      className="xp-metric xp-tinted"
      data-accent={tone}
      onClick={onClick}
    >
      <span>
        <Icon size={19} aria-hidden="true" />
        {ui(label)}
      </span>
      <strong>{value}</strong>
      {context && <small>{ui(context)}</small>}
    </button>
  );
}
export function GettingStartedCard({
  billed,
  items,
  customer,
  onBill,
}: {
  billed: boolean;
  items: boolean;
  customer: boolean;
  onBill: () => void;
}) {
  const steps = [
      { label: "Make your first bill", done: billed, optional: false },
      { label: "Add a few items", done: items, optional: true },
      { label: "Add a customer", done: customer, optional: true },
    ],
    done = steps.filter((s) => s.done).length;
  return (
    <section className="xp-card xp-getting-started">
      <div className="xp-section-title">
        <h2>{ui("Getting started")}</h2>
        <span>{done} / 3</span>
      </div>
      <p>{ui("Start with a bill. The other steps are optional.")}</p>
      <progress value={done} max={3} aria-label={ui("Getting started")} />
      <ol>
        {steps.map((s) => (
          <li key={s.label} data-done={s.done}>
            <span className="xp-step-check">
              {s.done ? <Check size={14} aria-hidden="true" /> : null}
            </span>
            {!s.optional && !s.done ? (
              <button onClick={onBill}>{ui(s.label)}</button>
            ) : (
              <span>{ui(s.label)}</span>
            )}
            {s.optional && <small>{ui("Optional")}</small>}
          </li>
        ))}
      </ol>
    </section>
  );
}
export function RecommendationCard({
  title = "Apna Galla Suggests",
  description,
  children,
}: {
  title?: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section
      className="xp-card xp-recommendation xp-tinted"
      data-accent="brand"
    >
      <Sparkles size={21} aria-hidden="true" />
      <div>
        <h2>{ui(title)}</h2>
        <p>{ui(description)}</p>
        {children}
      </div>
    </section>
  );
}
