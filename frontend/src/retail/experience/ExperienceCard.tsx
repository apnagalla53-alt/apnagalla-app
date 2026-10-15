import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ui } from "../../i18n";
export type ExperienceTone =
  "brand" | "info" | "warning" | "danger" | "special" | "neutral";
export default function ExperienceCard({
  title,
  description,
  Icon,
  tone = "neutral",
  children,
  action,
}: {
  title: string;
  description?: string;
  Icon?: LucideIcon;
  tone?: ExperienceTone;
  children?: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <section className="xp-card" data-accent={tone}>
      <div className="xp-card-heading">
        {Icon && (
          <span className="xp-icon">
            <Icon size={23} aria-hidden="true" />
          </span>
        )}
        <div>
          <h2>{ui(title)}</h2>
          {description && <p>{ui(description)}</p>}
        </div>
      </div>
      {children}
      {action && (
        <button
          type="button"
          className="r-btn r-btn--outline xp-card-action"
          onClick={action.onClick}
        >
          {ui(action.label)}
        </button>
      )}
    </section>
  );
}
