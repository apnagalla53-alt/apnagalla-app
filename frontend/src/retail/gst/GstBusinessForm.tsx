import type { ReactNode } from 'react';
import { Building2, MapPin, FileText, ShieldCheck } from 'lucide-react';
import { ui } from '../../i18n';
import { MobileSelect } from '../components/MobileControls';
import RetailFormSection from '../components/RetailFormSection';
import type { GstProfile } from './types';

export default function GstBusinessForm({form,states,update,text}: {
  form:GstProfile; states:Record<string,string>; update:(key:keyof GstProfile,value:any)=>void;
  text:(key:'legal_name'|'trade_name'|'gstin'|'address'|'phone'|'email'|'invoice_prefix'|'signatory'|'terms',label:string,required?:boolean,area?:boolean)=>ReactNode;
}) {
  return <>
    <RetailFormSection title="Business identity" description="The registered name printed on each tax invoice." Icon={Building2}>
      <div className="gst-grid">{text('legal_name','Registered Legal Name',true)}{text('trade_name','Business / Trade Name')}</div>
      <details className="gst-disclosure"><summary>{ui('Contact details · optional')}</summary><div className="gst-grid">{text('phone','Phone')}{text('email','Email')}</div></details>
    </RetailFormSection>
    <RetailFormSection title="GST registration" Icon={ShieldCheck}>
      <div className="gst-grid">{text('gstin','GSTIN',true)}<div className="gst-field"><label htmlFor="gst-profile-state">{ui('Registered State')} *</label><MobileSelect id="gst-profile-state" value={form.state_code} onChange={e=>update('state_code',e.target.value)}><option value="">{ui('Select State')}</option>{Object.entries(states).map(([code,name])=><option key={code} value={code}>{name} ({code})</option>)}</MobileSelect></div></div>
      <label className="gst-check"><input type="checkbox" checked={form.regular_registration} onChange={e=>update('regular_registration',e.target.checked)} required/><span>{ui('This business has regular GST registration. It is not unregistered or under the composition scheme.')}</span></label>
      <p className="r-caption">{ui('GSTIN format and checksum are checked. Government registration verification is not connected.')}</p>
    </RetailFormSection>
    <RetailFormSection title="Registered address" Icon={MapPin}><div className="gst-grid">{text('address','Registered Address',true,true)}</div></RetailFormSection>
    <RetailFormSection title="Invoice Settings" Icon={FileText}>
      <div className="gst-grid">{text('invoice_prefix','Invoice Series',true)}{text('signatory','Authorised Signatory',true)}</div>
      <details className="gst-disclosure"><summary>{ui('HSN policy & invoice notes')}</summary><div className="gst-grid"><div className="gst-field"><label htmlFor="gst-hsn-policy">{ui('HSN Digit Policy')} *</label><MobileSelect id="gst-hsn-policy" value={String(form.hsn_digits)} onChange={e=>update('hsn_digits',Number(e.target.value))}><option value="6">{ui('6 digits')}</option><option value="4">{ui('4 digits — confirm eligibility')}</option></MobileSelect></div>{text('terms','Invoice Terms / Notes',false,true)}</div></details>
      <p className="r-caption">{ui('A financial-year invoice number is assigned when you issue the invoice. Printouts include a signature space.')}</p>
    </RetailFormSection>
    <RetailFormSection title="Electronic reporting eligibility" Icon={ShieldCheck}>
      <div className="gst-field"><label htmlFor="gst-reporting-policy">{ui('Government Electronic Reporting')} *</label><MobileSelect id="gst-reporting-policy" value={form.electronic_reporting} onChange={e=>update('electronic_reporting',e.target.value)}><option value="UNSURE">{ui('Not sure — confirm first')}</option><option value="NOT_REQUIRED">{ui('IRN / statutory dynamic QR not required')}</option><option value="REQUIRED">{ui('Required for this business')}</option></MobileSelect></div>
      <p className="r-caption">{ui('Confirm your HSN and electronic-reporting requirements with your accountant. If reporting is required or uncertain, invoice issuance stays unavailable until a real provider is connected.')}</p>
    </RetailFormSection>
  </>;
}
