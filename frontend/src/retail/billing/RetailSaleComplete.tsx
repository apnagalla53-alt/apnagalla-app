import { ui, useUiLanguage } from "../../i18n";
import CompletedPaymentQr from '../payments/CompletedPaymentQr';
import WhatsAppCustomer from '../payments/WhatsAppCustomer';
/**
 * EVOLIX Retail V1 — Sale Complete / Success Screen
 * 
 * Simple success screen showing amount received,
 * invoice number, and payment mode.
 * Actions: New Bill, Print, Share
 */
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Check, Plus, Printer, Share2, Eye
} from 'lucide-react';
import { useBillStore, useSaleCompleteStore } from '../retailStore';
import {useState} from 'react';
import {playGreeting} from '../payments/paymentVoice';
import api from '../../shared/api';
import { useEffect } from 'react';
import { posApi } from '../retailApi';

type Settlement = {
  invoiceId: string;
  total: number;
  received: number;
  outstanding: number;
  payments: { method: string; amount: number }[];
};
const money = (amount: number) => '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const paymentLabel = (method: string) => ({ CASH: 'Cash', UPI: 'UPI', CARD: 'Card', BANK: 'Bank' })[method as 'CASH' | 'UPI' | 'CARD' | 'BANK'] || method;

const RetailSaleComplete = () => {
  useUiLanguage();
  const navigate = useNavigate();
  const [voiceMessage,setVoiceMessage]=useState('');
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [settlementError, setSettlementError] = useState(false);
  const [settlementRetry, setSettlementRetry] = useState(0);
  const { completedSale } = useSaleCompleteStore();
  useEffect(() => { if (completedSale) useBillStore.getState().clearBill(); }, [completedSale]);
  const invoiceId = completedSale?.invoice_id;
  useEffect(() => {
    if (!invoiceId) return;
    let active = true;
    setSettlement(null);
    setSettlementError(false);
    posApi.getBillDetail(invoiceId).then(({ data: invoice }) => {
      const total = Number(invoice.grand_total), received = Number(invoice.paid_amount), outstanding = Number(invoice.outstanding_amount);
      if (![total, received, outstanding].every(amount => Number.isFinite(amount) && amount >= 0)) throw new Error('Payment summary missing');
      const payments = (Array.isArray(invoice.payments) ? invoice.payments : []).map((payment: { method: string; amount: number | string }) => ({ method: String(payment.method), amount: Number(payment.amount) })).filter((payment: { method: string; amount: number }) => Number.isFinite(payment.amount) && payment.amount > 0);
      if (active) setSettlement({ invoiceId, total, received, outstanding, payments });
    }).catch(() => { if (active) setSettlementError(true); });
    return () => { active = false; };
  }, [invoiceId, settlementRetry]);

  // Redirect if no completed sale
  if (!completedSale) {
    return <Navigate to="/retail/home" replace />;
  }

  const handleNewBill = () => {
    useBillStore.getState().clearBill();
    navigate('/retail/bill', { replace: true });
  };
  const savedSettlement = settlement?.invoiceId === completedSale.invoice_id ? settlement : null;
  const hasUdhar = !!savedSettlement && savedSettlement.outstanding > 0;

  return (
    <div className="r-success-screen">
      {/* Success Icon */}
      <div className="r-success-icon" id="success-indicator">
        <Check strokeWidth={3} />
      </div>

      {/* Amount */}
      {hasUdhar && <div className="r-caption">{ui("Bill total")}</div>}
      <div className="r-success-amount">
        {money(savedSettlement?.total ?? completedSale.amount)}
      </div>
      <div className="r-success-label">
        <div>{ui("Sale successful")}</div>
        {savedSettlement ? hasUdhar ? savedSettlement.received > 0 ? ui("Part payment received") : ui("Saved as Udhar") : ui("Payment Received") : <span role="status">{settlementError ? 'Your bill is saved. Payment summary is unavailable.' : 'Loading saved payment details…'}</span>}
      </div>
      {settlementError && <button className="r-btn r-btn--outline" onClick={() => setSettlementRetry(retry => retry + 1)}>Retry Payment Summary</button>}

      {/* Details */}
      <div className="r-success-details">
        <div className="r-success-detail-row">
          <span>{ui("Invoice")}</span>
          <span>{completedSale.invoice_number}</span>
        </div>
        <div className="r-success-detail-row">
          <span>{ui("Customer")}</span>
          <span>{completedSale.customer_name}</span>
        </div>
        <div className="r-success-detail-row">
          <span>{ui("Units")}</span>
          <span>{completedSale.items_count}</span>
        </div>
        {completedSale.lines_count !== undefined && <div className="r-success-detail-row"><span>{ui('Product lines')}</span><span>{completedSale.lines_count}</span></div>}
        <div className="r-success-detail-row">
          <span>{ui("Payment")}</span>
          <span>{completedSale.payment_mode}</span>
        </div>
        {hasUdhar && savedSettlement && <>
          <div className="r-success-detail-row"><span>{ui("Money received")}</span><span>{money(savedSettlement.received)}</span></div>
          {savedSettlement.payments.map((payment, index) => <div className="r-success-detail-row" key={payment.method + index}><span>{paymentLabel(payment.method)} received</span><span>{money(payment.amount)}</span></div>)}
          <div className="r-success-detail-row"><span>{ui("Udhar remaining")}</span><span>{money(savedSettlement.outstanding)}</span></div>
        </>}
        <div className="r-success-detail-row">
          <span>{ui("Time")}</span>
          <span>{completedSale.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {savedSettlement && savedSettlement.received > 0 && <div className="r-section"><button className="r-btn r-btn--outline" onClick={async()=>{try{const settings=(await api.get('/retail/checkout-voice')).data;setVoiceMessage(settings.enabled?(playGreeting(settings)?'Greeting requested.':'Voice is unavailable on this device.'):'Turn on Payment voice greeting in Settings.');}catch{setVoiceMessage('Could not load the greeting.');}}}>{ui("Play thank-you greeting")}</button>{voiceMessage&&<p role="status">{voiceMessage}</p>}</div>}
      <div className="r-section"><CompletedPaymentQr id={completedSale.invoice_id}/></div>
      {/* Actions */}
      <div className="r-success-actions">
        {completedSale.gst_workflow&&<button className="r-btn r-btn--primary-lg" id="prepare-gst-after-sale" onClick={()=>navigate('/retail/gst/bills/'+completedSale.invoice_id)}><Printer size={20}/>{ui('Prepare A4 GST Invoice')}</button>}
        <WhatsAppCustomer billId={completedSale.invoice_id}/>
        <button
          className="r-btn r-btn--primary-lg"
          onClick={handleNewBill}
          id="new-bill-btn"
        >
          <Plus size={20} />{ui("New Bill")}</button>

        <div style={{ display: 'flex', gap: 'var(--r-space-md)' }}>
          <button className="r-btn r-btn--secondary" style={{ flex: 1 }} id="print-btn" onClick={() => navigate(`/retail/bills/${completedSale.invoice_id}/print`)}>
            <Printer size={18} />{ui("Print")}</button>
          <button className="r-btn r-btn--secondary" style={{ flex: 1 }} id="share-btn" onClick={() => {
            const text = `${completedSale.invoice_number}: ${money(savedSettlement?.total ?? completedSale.amount)} (${completedSale.payment_mode})${hasUdhar && savedSettlement ? ` · Received ${money(savedSettlement.received)} · Udhar ${money(savedSettlement.outstanding)}` : ''}`;
            if (navigator.share) navigator.share({ text }).catch(error => { if (error.name !== 'AbortError') alert('Could not share bill. Please try again.'); });
            else navigator.clipboard.writeText(text).then(() => alert('Bill summary copied')).catch(() => alert(text));
          }}>
            <Share2 size={18} />{ui("Share")}</button>
        </div>

        <button
          className="r-btn r-btn--ghost r-btn--full"
          onClick={() => {
            navigate(`/retail/bills/${completedSale.invoice_id}`);
          }}
          id="view-bill-btn"
          style={{ color: 'var(--r-primary)' }}
        >
          <Eye size={16} />{ui("View Bill")}</button>
      </div>
    </div>
  );
};

export default RetailSaleComplete;
