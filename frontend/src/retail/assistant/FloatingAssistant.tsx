import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';
import { ui } from '../../i18n';
import RetailErrorBoundary from '../RetailErrorBoundary';
import './floating-assistant.css';

const Assistant = lazy(() => import('./RetailAssistant'));

/** One tenant-scoped conversation, opened without unmounting the current transaction. */
export default function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  return <>
    <button ref={launcher} type="button" className="r-assistant-fab" id="floating-assistant"
      aria-label={ui('Ask Apna Galla')} title={ui('AI Assistant')}
      aria-haspopup="dialog" aria-controls="floating-assistant-panel" aria-expanded={open}
      onClick={() => { setLoaded(true); setOpen(true); }}>
      <MessageCircle size={27} aria-hidden="true" />
    </button>
    <dialog ref={dialog} id="floating-assistant-panel" className="r-assistant-panel"
      aria-labelledby="floating-assistant-title"
      onCancel={event => { event.preventDefault(); setOpen(false); }}
      onClose={() => { setOpen(false); launcher.current?.focus({ preventScroll: true }); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false);
      }}>
      <header className="r-assistant-panel-bar">
        <strong id="floating-assistant-title">{ui('AI Assistant')}</strong>
        <button type="button" className="r-btn r-btn--icon" aria-label={ui('Close AI Assistant')}
          autoFocus onClick={() => setOpen(false)}><X size={23} aria-hidden="true" /></button>
      </header>
      {loaded && <RetailErrorBoundary><Suspense fallback={<p role="status">{ui('Loading assistant…')}</p>}>
        <Assistant embedded />
      </Suspense></RetailErrorBoundary>}
    </dialog>
  </>;
}
