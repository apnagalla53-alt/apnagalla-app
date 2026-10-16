import { ui } from '../../i18n';

export default function ManualUpiConfirmation({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="r-upi-confirmation"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span><strong>{ui('Payment received · I have checked')}</strong><small>{ui('Confirm only after checking your UPI or bank app.')}</small></span></label>;
}
