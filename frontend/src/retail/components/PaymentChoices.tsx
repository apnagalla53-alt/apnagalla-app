import { ui, useUiLanguage } from "../../i18n";
import { Banknote, Smartphone, CreditCard, Landmark } from 'lucide-react';

const methods = [
  { value: 'CASH', label: 'Cash', Icon: Banknote },
  { value: 'UPI', label: 'UPI', Icon: Smartphone },
  { value: 'CARD', label: 'Card', Icon: CreditCard },
  { value: 'BANK', label: 'Bank', Icon: Landmark },
];

/** Direct payment choices for touch, keyboard and assistive technology. */
export default function PaymentChoices({ id, value, onChange }: {
  id: string; value: string; onChange: (value: string) => void;
}) {
  useUiLanguage();
  return <div className="r-payment-choice-group">
    <span id={id+'-label'} className="r-label">{ui("Payment Method")}</span>
    <div id={id} data-mobile-select data-selection-value={value} className="r-payment-choices" role="group" aria-labelledby={id+'-label'}>
      {methods.map(({ value: method, label, Icon }) => <button key={method} type="button"
        className={'r-payment-choice' + (value === method ? ' is-selected' : '')}
        data-choice-value={method} aria-pressed={value === method} onClick={() => onChange(method)}>
        <Icon size={22} aria-hidden="true" /><span>{ui(label)}</span>
      </button>)}
    </div>
</div>;
}
