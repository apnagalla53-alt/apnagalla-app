import { ui, useUiLanguage } from "../../i18n";
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** A readable group of related fields without hiding the underlying controls. */
export default function RetailFormSection({ title, description, Icon, children }: {
  title: string; description?: string; Icon: LucideIcon; children: ReactNode;
}) {
  useUiLanguage();
  return <section className="r-form-section">
    <header className="r-form-section-heading">
      <span className="r-soft-icon"><Icon size={21} aria-hidden="true" /></span>
      <div><h2>{ui(title)}</h2>{description && <p>{ui(description)}</p>}</div>
    </header>
    <div className="r-form-section-fields">{children}</div>
  </section>;
}
