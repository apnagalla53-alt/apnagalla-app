import type { InputHTMLAttributes } from 'react';
import { formatDate } from '../dateFormat';
import './date-input.css';
/** Keep the native accessible date picker and ISO payload, with consistent shop-facing DD/MM/YYYY. */
export default function DateInput(props:InputHTMLAttributes<HTMLInputElement>){
  const value=String(props.value||props.defaultValue||'');
  return <span className="shop-date-field"><input {...props} type="date" lang="en-GB" className={(props.className||'')+' shop-date-native'}/><span className="shop-date-display" aria-hidden="true">{value?formatDate(value):'DD/MM/YYYY'}</span></span>;
}
