import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Play } from 'lucide-react';
import { posApi, itemApi, khataApi } from '../retailApi';
import { useBillStore, estimateLine } from '../retailStore';
import { createUuid } from '../../shared/browserCrypto';

const RetailHeldBills = () => {
  useUiLanguage();
  const navigate = useNavigate();
  const [heldBills, setHeldBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHeldBills = async () => {
      try {
        const res = await posApi.getHeldBills('default-branch'); // Adjust branchId logic if needed
        setHeldBills(res.data?.data || []);
      } catch (e) {
        // The shared API banner displays the request failure without logging tokens.
      } finally { setLoading(false); }
    };
    fetchHeldBills();
  }, []);

  const handleResume = async (bill: any) => {
    if (useBillStore.getState().items.length > 0) {
      alert('Finish or hold your current bill before resuming another bill.');
      return;
    }
    try {
      // Load and validate first so a failed request cannot consume the held bill.
      const itemsRes = await itemApi.getItems();
      const allItems = itemsRes.data?.data || [];
      if (bill.lines.some((line: any) => !allItems.some(item => item.id === line.item_id && (item.current_stock > 0 || item.item_type === 'SERVICE' || item.selling_mode === 'SERVICE')))) {
        alert('A held item is missing or out of stock. This bill is still held.');
        return;
      }
      const customer = bill.customer_id ? (await khataApi.getCustomers()).data.data.find(c=>c.id===bill.customer_id) : null;
      const restored = bill.lines.map((line: any) => {
        const item = allItems.find(i=>i.id===line.item_id)!;
        const entry = { row_id:createUuid(),item_id:item.id,name:item.name,rate:Number(line.rate),quantity:Number(line.entered_quantity||line.quantity),
          discount_amount:Number(line.discount_amount||0),unit:item.unit,unit_id:line.entered_unit_id||line.unit_id,variant_id:line.variant_id||undefined,batch_id:line.batch_id||undefined,
          dimensions:line.dimensions||undefined,serial_ids:line.serial_ids||undefined,modifier_option_ids:line.modifiers?.option_ids||undefined,tax_rate:item.tax_rate,total:0 };
        return { ...entry,total:estimateLine(entry) };
      });
      await posApi.resumeBill(bill.id);

      useBillStore.setState({items:restored,customer:customer ? {...customer,balance:customer.outstanding_amount} : null,discount:Number(bill.bill_discount||0)});
      
      navigate('/retail/bill');
    } catch (e) {
      // The shared API banner displays the request failure without logging tokens.
      alert('Failed to resume bill');
    }
  };

  return (
    <div className="r-page">
      <StitchHeader className="r-page-header" hasBack>
        <button className="r-btn r-btn--icon" aria-label={ui("Back to Home")} onClick={() => navigate('/retail/home')}>
          <ArrowLeft size={22} />
        </button>
        <h1>{ui("Held Bills")}</h1>
        <div style={{ width: 48 }} />
      </StitchHeader>

      <div className="r-section" style={{ marginTop: 'var(--r-space-md)' }}>
        {loading ? <p role="status">Loading held bills…</p> : heldBills.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--r-text-muted)', marginTop: 40 }}>
            <Clock size={48} style={{ margin: '0 auto', opacity: 0.2, marginBottom: 16 }} />
            <div>No bills on hold</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--r-space-sm)' }}>
            {heldBills.map(bill => (
              <div key={bill.id} className="r-card r-card--elevated" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Held {bill.created_at ? new Date(bill.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'}) : 'time unavailable'}</div>
                  <div style={{ fontSize: 'var(--r-text-sm)', color: 'var(--r-text-muted)' }}>
                    {bill.lines.length} items
                  </div>
                </div>
                <button className="r-btn r-btn--primary r-btn--sm" onClick={() => handleResume(bill)}>
                  <Play size={16} />
                  Resume
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RetailHeldBills;
