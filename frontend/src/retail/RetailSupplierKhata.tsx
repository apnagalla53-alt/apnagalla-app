import { formatDate } from '../shared/dateFormat';
import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
import { useEffect, useState } from 'react';
import SupplierVisitSettings from './components/SupplierVisitSettings';
import { useNavigate, useParams } from 'react-router-dom';
import { supplierApi, type RetailKhataTransaction, type RetailSupplier } from './retailApi';
import { AttachmentPicker } from '../shared/components/AttachmentPicker';
import './retail.css';
import MasterRecordActions from './components/MasterRecordActions';
import {Sheet} from './components/MobileControls';
import RetailPartyForm from './RetailPartyForm';

export default function RetailSupplierKhata() {
  useUiLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<RetailSupplier | null>(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<RetailKhataTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTxnId, setExpandedTxnId] = useState<string | null>(null);
  const [editing,setEditing]=useState(false);

  useEffect(() => {
    if (id) loadKhata();
  }, [id]);

  const loadKhata = async () => {
    try {
      setLoading(true);
      const res = await supplierApi.getTimeline(id!);
      setSupplier(res.data.data.supplier);
      setBalance(res.data.data.balance);
      setTransactions(res.data.data.transactions);
    } catch (err) {
      // The shared API banner displays the request failure without logging tokens.
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="retail-page"><div className="empty-state">{ui("Loading...")}</div></div>;
  }

  return (
    <div className="retail-page">
      <StitchHeader><h1>{ui('Supplier Account')}</h1></StitchHeader><section className="r-section"><div className="r-card r-party-identity"><span className="r-party-avatar">{supplier?.name?.slice(0,2).toUpperCase()}</span><div><strong>{supplier?.name}</strong><small>{supplier?.mobile||ui('No phone')}</small></div></div></section>
      <div className="khata-summary" style={{ backgroundColor: 'var(--r-warning-light)' }}>
        <div className="khata-title" style={{ color: 'var(--r-warning)' }}>You Have to Pay</div>
        <div className="khata-amount" style={{ color: 'var(--r-warning)' }}>₹{Math.abs(balance).toFixed(2)}</div>
        
        <div className="khata-actions">
          <button className="retail-button primary" disabled={supplier?.active===false} onClick={() => navigate(`/retail/suppliers/${id}/pay`)} >{ui("Pay Supplier")}</button>
          <button className="retail-button outline" disabled={supplier?.active===false} onClick={() => navigate('/retail/purchases/new')}>
            New Purchase
          </button>
        </div>
      </div>

      <div className="retail-content" style={{ padding: '0 16px' }}>
        {supplier&&<MasterRecordActions kind="suppliers" id={supplier.id} name={supplier.name} active={supplier.active} onEdit={()=>setEditing(true)} onChanged={()=>void loadKhata()}/>}
        {editing&&supplier&&<Sheet open title={ui('Edit Supplier')} onClose={()=>setEditing(false)}><RetailPartyForm supplier initial={supplier} onSaved={()=>{setEditing(false);void loadKhata();}}/></Sheet>}
        {supplier&&<SupplierVisitSettings supplier={supplier}/>}
        <h3 style={{ margin: '16px 0', fontSize: '16px', color: 'var(--r-text-muted)' }}>Timeline</h3>
        
        {transactions.length === 0 ? (
          <div className="empty-state">{ui("No transactions yet")}</div>
        ) : (
          <div className="timeline">
            {transactions.map(t => (
              <div key={t.id} className="timeline-item-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <div 
                  className="timeline-item" 
                  style={{ margin: 0, cursor: 'pointer' }}
                  onClick={() => setExpandedTxnId(expandedTxnId === t.id ? null : t.id)}
                >
                  <div className="timeline-icon" style={{ backgroundColor: t.type === 'PURCHASE' ? 'var(--r-warning-light)' : 'var(--r-success-light)', color: t.type === 'PURCHASE' ? 'var(--r-warning)' : 'var(--r-success)' }}>
                    {t.type === 'PURCHASE' ? '🛒' : '💸'}
                  </div>
                  <div className="timeline-details">
                    <div className="timeline-title">
                      {t.type === 'PURCHASE' ? ui("Purchase") : ui("Payment")}
                      {t.attachment && <span> 📸</span>}
                    </div>
                    <div className="timeline-date">{formatDate(t.date)}</div>
                  </div>
                  <div className="timeline-amounts">
                    <div className="timeline-amount" style={{ color: t.type === 'PURCHASE' ? 'var(--r-warning)' : 'var(--r-success)' }}>
                      {t.type === 'PURCHASE' ? '+' : '-'}₹{t.amount.toFixed(2)}
                    </div>
                    <div className="timeline-balance">Bal: ₹{Math.abs(t.balance_after).toFixed(2)}</div>
                  </div>
                </div>
                {expandedTxnId === t.id && (
                  <div style={{ paddingLeft: '48px' }}>
                    <AttachmentPicker 
                      existingAttachmentUrl={t.attachment ? `/api/v1/attachments/${t.attachment.id}/content` : undefined}
                      uploadImmediately={{
                        entityType: t.type === 'PURCHASE' ? 'PURCHASE' : 'SUPPLIER_PAYMENT',
                        entityId: t.reference_id || t.id,
                        category: t.type === 'PURCHASE' ? 'PURCHASE_BILL' : 'SUPPLIER_PAYMENT_PROOF'
                      }}
                      onUploadSuccess={() => loadKhata()}
                      onRemove={() => loadKhata()}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
