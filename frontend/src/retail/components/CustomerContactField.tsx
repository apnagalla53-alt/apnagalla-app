import { useEffect, useState } from 'react';
import { ContactRound } from 'lucide-react';
import { ui } from '../../i18n';
import { browserContactPicker, chosenContact } from './contactPicker';
import './customer-contact.css';

export default function CustomerContactField({ value, onChange, onContact, disabled = false }: {
  value: string; onChange: (value: string) => void;
  onContact: (name: string, mobile: string) => void; disabled?: boolean;
}) {
  const [properties, setProperties] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [choice, setChoice] = useState<{ name: string; phones: string[] } | null>(null);
  useEffect(() => {
    let active = true;
    const picker = browserContactPicker();
    if (picker) void (picker.getProperties?.() || Promise.resolve(['name', 'tel']))
      .then(props => { if (active && props.includes('tel')) setProperties(['name', 'tel'].filter(p => props.includes(p))); })
      .catch(() => { /* Manual entry remains available. */ });
    return () => { active = false; };
  }, []);
  async function selectContact() {
    const picker = browserContactPicker();
    if (!picker || !properties || busy) return;
    setBusy(true); setNotice(''); setChoice(null);
    try {
      // Call directly from the click: selecting contacts requires a fresh user gesture.
      const contacts = await picker.select(properties, { multiple: false });
      if (!contacts[0]) return;
      const selected = chosenContact(contacts[0]);
      if (!selected.phones.length) setNotice('No phone number was shared. Enter it manually.');
      else if (selected.phones.length === 1) onContact(selected.name, selected.phones[0]);
      else setChoice(selected);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setNotice('Could not open contacts. You can enter the number manually.');
    } finally { setBusy(false); }
  }
  return <div className="form-group r-customer-mobile">
    <div className="r-contact-label"><label htmlFor="customer-mobile">{ui('Mobile (optional)')}</label>
      {properties && <button type="button" className="r-btn r-btn--outline r-contact-pick" onClick={selectContact} disabled={disabled || busy}>
        <ContactRound size={18} aria-hidden="true" />{ui(busy ? 'Opening contacts…' : 'Choose contact')}
      </button>}
    </div>
    <input id="customer-mobile" className="r-input" type="tel" inputMode="tel" autoComplete="tel" value={value} disabled={disabled}
      onChange={event => { onChange(event.target.value); setChoice(null); setNotice(''); }} />
    {choice && <div className="r-contact-numbers"><label htmlFor="customer-contact-number">{ui('Choose mobile number')}</label>
      <select id="customer-contact-number" className="r-input" defaultValue="" onChange={event => {
        if (event.target.value) { onContact(choice.name, event.target.value); setChoice(null); }
      }}><option value="" disabled>{ui('Select a number')}</option>{choice.phones.map(phone => <option value={phone} key={phone}>{phone}</option>)}</select>
    </div>}
    {notice && <p className="r-caption" role="status">{ui(notice)}</p>}
  </div>;
}
