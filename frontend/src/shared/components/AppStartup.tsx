import { useEffect, useState } from 'react';
import './AppStartup.css';

/** Eagerly styled: this screen must work before any lazy page or page CSS arrives. */
export default function AppStartup({ phase = 'account', error = '', onRetry }: {
  phase?: 'account' | 'page';
  error?: string;
  onRetry?: () => void;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, []);
  return <main className="app-startup" aria-busy={!error}>
    <section className="app-startup-content" aria-labelledby="app-startup-title">
      <div className="app-startup-logo"><img src="/brand/apna-galla-app-192.png" width="88" height="88" alt="" fetchPriority="high" /></div>
      <p className="app-startup-brand">Apna Galla</p>
      <h1 id="app-startup-title">{error ? 'Let’s try that again' : 'Opening your shop'}</h1>
      {error ? <>
        <p className="app-startup-message" role="alert">{error}</p>
        {onRetry && <button type="button" className="app-startup-retry" onClick={onRetry}>Try again <span aria-hidden="true">→</span></button>}
      </> : <>
        <p className="app-startup-message" role="status" aria-live="polite">{slow ? 'Connecting is taking a little longer. Please keep this window open.' : phase === 'account' ? 'Checking your sign-in securely…' : 'Getting your workspace ready…'}</p>
        <div className="app-startup-progress" aria-hidden="true"><span /></div>
      </>}
      <p className="app-startup-tagline">Har dukaan ka apna hisaab.</p>
    </section>
    <footer className="app-startup-footer"><svg width="14" height="16" viewBox="0 0 16 18" fill="none" aria-hidden="true"><path d="M3 8V5a5 5 0 0 1 10 0v3M2 8h12v8H2V8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 11v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> Your shop. Your private workspace.</footer>
  </main>;
}
