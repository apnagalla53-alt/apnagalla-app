import { ui } from '../../i18n';
import type { Workflow } from '../workflowTheme';
export default function WorkflowBanner({workflow,detail}:{workflow:Workflow;detail?:string}) {
  const Icon=workflow.Icon;
  return <section className="workflow-banner" aria-label="Current task">
    <span className="workflow-banner-icon"><Icon size={23} aria-hidden="true"/></span>
    <div><span className="workflow-family">{ui(workflow.family)}</span><strong>{ui(workflow.title)}</strong></div>
    <span className="workflow-hint">{detail||ui(workflow.hint)}</span>
  </section>;
}
