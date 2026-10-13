import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { ui } from '../../i18n';

export function StatusCard({ title, description, Icon, tone='neutral', children }: {
  title:string; description?:string; Icon:LucideIcon; tone?:'neutral'|'success'|'warning'|'danger'; children?:ReactNode;
}) {
  return <section className={'r-ledger-status r-ledger-status--'+tone}>
    <span className="r-ledger-icon"><Icon size={23} aria-hidden="true"/></span>
    <div><h2>{ui(title)}</h2>{description&&<p>{ui(description)}</p>}{children}</div>
  </section>;
}
export function LedgerMetric({ title, value, Icon, tone='neutral', children, action, onAction }: {
  title:string; value:string; Icon:LucideIcon; tone?:'neutral'|'success'|'warning'; children?:ReactNode; action?:string; onAction?:()=>void;
}) {
  return <section className={'r-ledger-metric r-ledger-metric--'+tone}>
    <div className="r-ledger-metric-label"><span>{ui(title)}</span><Icon size={20} aria-hidden="true"/></div>
    <strong className="r-ledger-amount">{value}</strong>{children}
    {action&&onAction&&<button className="r-ledger-link" onClick={onAction}>{ui(action)}<ChevronRight size={17} aria-hidden="true"/></button>}
  </section>;
}
