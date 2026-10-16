import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { uiLanguageReady } from './i18n';

void uiLanguageReady.then(() => ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
));

// Register the existing worker for installed-device share handling; no API/offline cache.
if('serviceWorker' in navigator&&window.isSecureContext)void navigator.serviceWorker.register('/shop-notifications-sw.js').catch(()=>{});
