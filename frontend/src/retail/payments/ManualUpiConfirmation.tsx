import { ui } from '../../i18n';

export default function ManualUpiConfirmation({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="r-state-message">
    <strong>{ui('Record UPI already received')}</strong>
    <p className="r-caption">{ui('This only records a payment received outside EVOLIX. It does not transfer money or verify your bank account.')}</p>
    <label className="r-list-item"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/>{ui('I checked my UPI or bank app and received this payment.')}</label>
  </div>;
}
