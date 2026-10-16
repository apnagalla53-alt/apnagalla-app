import AuditHistoryLink from './components/AuditHistoryLink';
import { formatDate } from '../shared/dateFormat';
import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
/**
 * EVOLIX Retail V1 — Customer Khata Detail
 * 
 * Shows total receivable from customer, primary actions (Receive Payment, New Bill),
 * and a simple timeline of transactions (Sales & Payments).
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, IndianRupee, Plus, Phone
} from 'lucide-react';
import { khataApi, type RetailCustomer, type RetailKhataTransaction } from './retailApi';
import WhatsAppCustomer from './payments/WhatsAppCustomer';
import { useBillStore } from './retailStore';
import { useAuthStore } from '../shared/store/authStore';
import { SegmentedControl, Sheet } from './components/MobileControls';
import MasterRecordActions from './components/MasterRecordActions';
import RetailPartyForm from './RetailPartyForm';

const RetailKhataDetail = () => {
  useUiLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<RetailCustomer | null>(null);
  const [transactions, setTransactions] = useState<RetailKhataTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyView, setHistoryView] = useState('ALL');
  const [editing,setEditing]=useState(false),[revision,setRevision]=useState(0);
  const shop=useAuthStore(s=>s.tenantContext?.company_name||'My Shop');

  useEffect(() => {
    const fetchTimeline = async () => {
      if (!id) return;
      try {
        const res = await khataApi.getTimeline(id);
        const data = res.data?.data;
        if (data) {
          setCustomer(data.customer as any); // Assuming customer info is returned
          setTransactions(data.transactions || []);
        }
      } catch (err) {
        // The shared API banner displays the request failure without logging tokens.
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, [id,revision]);

  if (loading) return <div>{ui("Loading...")}</div>;

  if (!customer) {
    return (
      <StitchHeader className="r-page-header" hasBack>
        <button className="r-btn r-btn--icon" onClick={() => navigate('/retail/khata')}>
          <ArrowLeft size={22} />
        </button>
        <h1>{ui("Customer Not Found")}</h1>
        <div style={{ width: 48 }} />
      </StitchHeader>
    );
  }

  return (
    <div className="r-stitch-customer-account">
      {/* Header */}
      <StitchHeader className="r-page-header" hasBack>
        <button className="r-btn r-btn--icon" aria-label={ui('Back to Khata')} onClick={() => navigate('/retail/khata')}>
          <ArrowLeft size={22} />
        </button>
        <h1>{ui('Customer Account')}</h1>
      </StitchHeader>

      {/* Balance Summary */}
      <div className="r-section" style={{ paddingTop: 'var(--r-space-md)' }}>
        <div className="r-card r-stitch-party-identity"><span className="r-stitch-party-avatar">{customer.name.slice(0,2).toUpperCase()}</span><div><h2>{customer.name}</h2><p className="r-caption">{customer.mobile || ui('No mobile')}</p></div></div>
        <div className="r-card r-stitch-customer-balance">
          <div style={{ fontSize: 'var(--r-text-sm)', color: 'var(--r-text-secondary)', marginBottom: 'var(--r-space-xs)' }}>{ui("You'll Receive")}</div>
          <div className="r-stitch-account-amount">
            ₹{customer.outstanding_amount.toLocaleString('en-IN')}
          </div>

          <div style={{ display: 'flex', gap: 'var(--r-space-sm)', marginTop: 'var(--r-space-lg)' }}>
            <button
              className="r-btn r-btn--primary"
              style={{ flex: 1, padding: 'var(--r-space-sm) var(--r-space-md)' }}
              onClick={() => navigate(`/retail/receive-payment?customer=${customer.id}`)}
              id="receive-payment-btn"
              disabled={customer.active===false}
            >
              <IndianRupee size={16} />{ui("Receive")}</button>
            <button
              className="r-btn r-btn--secondary"
              style={{ flex: 1, padding: 'var(--r-space-sm) var(--r-space-md)' }}
              onClick={() => {
                if (useBillStore.getState().savedSale) useBillStore.getState().clearBill();
                useBillStore.getState().setCustomer({ ...customer, balance: Number(customer.outstanding_amount) });
                navigate(`/retail/bill?customer=${encodeURIComponent(customer.id)}`);
              }}
              id="new-bill-customer-btn"
              disabled={customer.active===false}
            >
              <Plus size={16} />{ui("New Bill")}</button>
          </div>

          {customer.mobile && (
            <div style={{ display: 'flex', gap: 'var(--r-space-sm)', marginTop: 'var(--r-space-sm)' }}>
              <a href={`tel:${customer.mobile}`} className="r-btn r-btn--ghost r-btn--sm r-btn--full">
                <Phone size={16} />{ui("Call")}</a>
            </div>
          )}
          <div style={{marginTop:12}}><WhatsAppCustomer phone={customer.mobile} message={`Hello ${customer.name}, your outstanding balance at ${shop} is ₹${Number(customer.outstanding_amount).toFixed(2)} as of ${new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date())}. Please contact us about payment. Thank you.`}/></div>
        </div>
      </div>

      {/* Timeline */}
      <div className="r-section"><AuditHistoryLink/><MasterRecordActions kind="customers" id={customer.id} name={customer.name} active={customer.active} onEdit={()=>setEditing(true)} onChanged={()=>setRevision(v=>v+1)}/>{customer.active===false&&<p role="status">{ui('Removed. Past records are kept.')}</p>}</div>
      {editing&&<Sheet open title={ui('Edit Customer')} onClose={()=>setEditing(false)}><RetailPartyForm initial={customer} onSaved={()=>{setEditing(false);setRevision(v=>v+1);}}/></Sheet>}
      <div className="r-section">
        <h3 className="r-section-title">{ui("Transaction History")}</h3>
        <SegmentedControl label="Transaction type" value={historyView} onChange={setHistoryView} options={[{value:'ALL',label:'All'},{value:'SALE',label:'Sales'},{value:'PAYMENT',label:'Payments'}]}/>
        
        {transactions.filter(t=>historyView==='ALL'||t.type===historyView).length === 0 ? (
          <div className="r-empty" style={{ padding: 'var(--r-space-xl) 0' }}>
            <p>{ui("No transactions yet")}</p>
          </div>
        ) : (
          <ul className="r-timeline">
            {transactions.filter(t=>historyView==='ALL'||t.type===historyView).map((txn) => (
              <li key={txn.id} className="r-timeline-item">
                <div className={`r-timeline-dot ${txn.type === 'PAYMENT' ? 'r-timeline-dot--green' : txn.type === 'SALE' ? 'r-timeline-dot--red' : 'r-timeline-dot--blue'}`} />
                <div className="r-timeline-content">
                  <div>
                    <div className="r-timeline-text">{txn.reference || txn.type}</div>
                    <div className="r-timeline-date">{formatDate(txn.date)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={`r-timeline-amount ${txn.type === 'SALE' ? 'r-timeline-amount--credit' : txn.type === 'PAYMENT' ? 'r-timeline-amount--debit' : ''}`}>
                      {txn.type === 'PAYMENT' ? '-' : '+'}₹{txn.amount.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 'var(--r-text-xs)', color: 'var(--r-text-muted)' }}>
                      Bal: ₹{txn.balance_after.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
                {txn.type==='SALE'&&txn.invoice_id&&<div style={{marginTop:8}}><WhatsAppCustomer billId={txn.invoice_id} phone={customer.mobile}/></div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default RetailKhataDetail;
