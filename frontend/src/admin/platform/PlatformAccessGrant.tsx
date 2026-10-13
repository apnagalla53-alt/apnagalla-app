import { useState } from 'react';
import { Field, money } from './platform-ui';

export default function PlatformAccessGrant({ org, plans, reason, busy, grant }: { org: any; plans: any[]; reason: string; busy: boolean; grant: (body: object) => Promise<unknown> }) {
  const [planId, setPlanId] = useState(org.plan_id || '');
  const [days, setDays] = useState(30);
  const [complimentary, setComplimentary] = useState(true);
  const [paymentId, setPaymentId] = useState('');
  const plan = plans.find(p => p.id === planId);
  const requested = org.users.find((u: any) => u.onboarding_data?.activation_requested_at)?.onboarding_data;
  const payments = org.payments.filter((p: any) => p.status === 'PAID' && p.plan_name === plan?.name && Number(p.refund_amount) === 0);
  return <section className="platform-card" aria-labelledby="grant-access-title">
    <h2 id="grant-access-title">Grant access</h2>
    <p>{requested ? `Requested ${requested.requested_plan_code} plan. ` : ''}This shop is waiting for subscription approval.</p>
    <form className="platform-form" onSubmit={e => { e.preventDefault(); void grant({ action: 'approve_access', plan_id: planId, free_days: days, complimentary, ...(!complimentary && { payment_id: paymentId }) }); }}>
      <Field label="Access plan"><select required value={planId} onChange={e => { setPlanId(e.target.value); setPaymentId(''); }}><option value="">Choose plan</option>{plans.filter(p => p.is_active && ['STARTER','SMART','PRO'].includes(p.code)).map(p => <option key={p.id} value={p.id}>{p.name} · {money(p.monthly_price)} / month</option>)}</select></Field>
      <Field label="Access type"><select value={complimentary ? 'FREE' : 'PAID'} onChange={e => { setComplimentary(e.target.value === 'FREE'); setPaymentId(''); }}><option value="FREE">Complimentary / temporary access</option><option value="PAID">Verified manual payment</option></select></Field>
      <Field label="Access days"><input required type="number" min="1" max="3650" value={days} onChange={e => setDays(Number(e.target.value))}/></Field>
      {!complimentary && <Field label="Verified payment"><select required value={paymentId} onChange={e => setPaymentId(e.target.value)}><option value="">Choose recorded paid receipt</option>{payments.map((p: any) => <option key={p.id} value={p.id}>{p.reference} · {money(Number(p.amount) + Number(p.tax) - Number(p.discount))}</option>)}</select></Field>}
      <button className="primary" disabled={busy || reason.trim().length < 3 || !planId || !Number.isInteger(days) || days < 1 || days > 3650 || (!complimentary && !paymentId)}>{busy ? 'Granting access…' : 'Grant access'}</button>
    </form>
    <p className="platform-muted">{reason.trim().length < 3 ? 'Enter a reason above to enable approval. ' : ''}{complimentary ? 'This grants access without recording revenue or claiming payment.' : 'Record the actual receipt in Billing first. Select that receipt here after checking payment.'}</p>
    <p className="platform-muted">After approval, the owner can choose “Check activation status” and continue into the shop. Online payment confirmation is not configured.</p>
  </section>;
}
