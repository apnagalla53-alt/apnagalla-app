import StitchHeader from '../design/StitchHeader';
import { MobileSelect } from '../components/MobileControls';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Volume2 } from 'lucide-react';
import api, { getApiErrorMessage } from '../../shared/api';
import { playGreeting, type VoiceSettings } from '../payments/paymentVoice';
import { ui, useUiLanguage } from '../../i18n';

export default function RetailVoiceSettings() {
  useUiLanguage();
  const [settings, setSettings] = useState<VoiceSettings | null>(null), [error, setError] = useState('');
  const [message, setMessage] = useState(''), [saving, setSaving] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const load = () => { setError(''); api.get('/retail/checkout-voice').then(r => setSettings(r.data)).catch(e => setError(getApiErrorMessage(e))); };
  useEffect(load, []);
  useEffect(() => {
    const engine = window.speechSynthesis; if (!engine) return;
    const update = () => setVoices(engine.getVoices()); update();
    engine.addEventListener('voiceschanged', update);
    return () => engine.removeEventListener('voiceschanged', update);
  }, []);
  const available = settings && voices.some(voice => voice.lang.toLowerCase().split('-')[0] === settings.language.split('-')[0]);
  return <>
    <StitchHeader className="r-page-header" hasBack><Link className="r-back-btn" aria-label={ui('Back to Settings')} to="/retail/more/settings"><ArrowLeft size={22}/></Link><h1>{ui('Payment voice greeting')}</h1></StitchHeader>
    <main className="r-section r-stitch-voice">
      <p className="r-caption"><Volume2 size={18}/>{ui('You can turn the greeting off, edit the words, choose Hindi or English and preview it.')}</p>
      <section className="r-card r-stitch-intro"><span className="r-ledger-icon"><Volume2 size={28}/></span><div><h2>{ui('Shop payment greeting')}</h2><p className="r-caption">{ui('A clear thank-you after a confirmed payment.')}</p></div></section>
      {error && <p role="alert">{error}<button className="r-btn" onClick={load}>{ui('Retry')}</button></p>}
      {!settings && !error && <p role="status">{ui('Loading greeting…')}</p>}
      {settings && <form className="r-page-with-sticky" onSubmit={async e => {
        e.preventDefault(); if (saving) return; setSaving(true); setError(''); setMessage('');
        try { const { shop_name, ...body } = settings; setSettings((await api.post('/retail/checkout-voice', body)).data); setMessage(ui('Greeting saved for this shop.')); }
        catch (failure) { setError(getApiErrorMessage(failure)); } finally { setSaving(false); }
      }}>
        <section className="r-card"><h2>{ui('Payment Announcement')}</h2><label className="r-toggle-row"><input id="greeting-enabled" type="checkbox" checked={settings.enabled} onChange={e => setSettings({ ...settings, enabled: e.target.checked })}/>{ui('Play after a confirmed customer payment')}</label>
        <p className="r-caption">{ui('Only after money is received')}</p>
        <p className="r-stitch-ledger-note">{ui('An unpaid Udhar bill never triggers a payment greeting.')}</p></section>
        <section className="r-card"><h2>{ui('Greeting Message')}</h2>
        <label htmlFor="greeting-text">{ui('Greeting')}</label>
        <textarea className="r-input" id="greeting-text" required maxLength={300} value={settings.text} onChange={e => setSettings({ ...settings, text: e.target.value })}/>
        <p className="r-caption">{ui('Use {shop} for your business name.')}</p>
        <div className="r-stitch-greeting-presets"><button type="button" className="r-btn r-btn--outline" id="greeting-preset-en" onClick={() => setSettings({ ...settings, language: 'en-IN', text: 'Thank you for visiting {shop}. Please visit again.' })}><Volume2 size={20}/>{ui('Use English message')}</button><button type="button" className="r-btn r-btn--outline" id="greeting-preset-hi" onClick={() => setSettings({ ...settings, language: 'hi-IN', text: '{shop} में आने के लिए धन्यवाद। फिर ज़रूर आइए।' })}><Volume2 size={20}/>{ui('Use Hindi message')}</button></div></section>
        <section className="r-card"><h2>{ui('Voice Language')}</h2>
        <label htmlFor="greeting-language">{ui('Language')}</label>
        <MobileSelect id="greeting-language" className="r-select" value={settings.language} onChange={e => setSettings({ ...settings, language: e.target.value })} presentation="segments"><option value="en-IN">{ui('English (India)')}</option><option value="hi-IN">{ui('Hindi')}</option></MobileSelect>
        </section><section className="r-card"><h2>{ui('Speaking speed')}</h2><label className="r-visually-hidden" htmlFor="greeting-speed">{ui('Speaking speed')}</label>
        <MobileSelect id="greeting-speed" className="r-select" value={settings.rate} onChange={e => setSettings({ ...settings, rate: Number(e.target.value) })} presentation="segments"><option value={0.7}>{ui('Slow')}</option><option value={0.9}>{ui('Comfortable')}</option><option value={1}>{ui('Normal')}</option></MobileSelect>
        </section><p className="r-card r-caption" id="voice-availability">{ui('Voice on this device')}: {ui(available ? 'Matching voice available' : 'A matching voice has not loaded. Try Preview; Hindi may need an installed device voice.')}</p>
        <div className="r-sticky-footer r-stitch-dual-cta"><button type="button" className="r-btn r-btn--outline" onClick={() => setMessage(ui(playGreeting(settings) ? 'Preview requested. Check device volume.' : 'Voice playback is unavailable on this device.'))}><Volume2 size={20}/>{ui('Preview greeting')}</button><button disabled={saving} className="r-btn r-btn--primary">{ui(saving ? 'Saving…' : 'Save Greeting')}</button></div>
        {message && <p role="status">{message}</p>}
        <p className="r-caption">{ui("Uses your device's voice and volume. Browsers may require a tap before playback. An unpaid Udhar bill never triggers a payment greeting.")}</p>
      </form>}
    </main>
  </>;
}
