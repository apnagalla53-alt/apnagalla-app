import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Undo2, AlertCircle } from 'lucide-react';
import { posApi } from '../retailApi';
import { getApiErrorMessage } from '../../shared/api';

const RetailReturn = () => {
  useUiLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<Record<string, number>>({});
  const [returnSerials, setReturnSerials] = useState<Record<string, string[]>>({});
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [saving, setSaving] = useState(false);
  const submission = useRef(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchBill = async () => {
      try {
        const res = await posApi.getBillDetail(id!);
        if (!active) return;
        setBill(res.data || null);
        
        // Default return everything to 0
        const init: Record<string, number> = {};
        res.data?.sales_invoice_line?.forEach((line: any) => {
          init[line.id] = 0;
        });
        setReturnItems(init);
        setReturnSerials({});
      } catch (e) {
        if (!active) return;
        setError(getApiErrorMessage(e));
      }
    };
    if (id) fetchBill();
    return () => { active = false; };
  }, [id]);

  if (error && !bill) return <div className="r-section" role="alert"><p>{error}</p><button className="r-btn" onClick={() => window.location.reload()}>{ui("Try Again")}</button><button className="r-btn" onClick={() => navigate('/retail/bills')}>{ui("Bill History")}</button></div>;
  if (!bill) return <div className="r-page" role="status" style={{ padding: 20 }}>{ui("Loading...")}</div>;

  const handleUpdateReturnQty = (lineId: string, delta: number) => {
    const line = bill.sales_invoice_line.find((l: any) => l.id === lineId);
    if (!line) return;

    setReturnItems(prev => {
      const current = prev[lineId] || 0;
      let next = current + delta;
      if (next < 0) next = 0;
      if (next > Number(line.remaining_quantity)) next = Number(line.remaining_quantity);
      return { ...prev, [lineId]: next };
    });
  };

  const totalReturnAmount = bill.sales_invoice_line?.reduce((sum: number, line: any) => {
    const qty = returnItems[line.id] || 0;
    return sum + (qty * Number(line.line_total) / Number(line.sold_entered_quantity || 1));
  }, 0) || 0;

  const handleSubmitReturn = async () => {
    if (totalReturnAmount === 0 || submission.current || posted) return;
    submission.current = true;
    setSaving(true);
    setError('');

    try {
      const linesToReturn = bill.sales_invoice_line
        .filter((l: any) => returnItems[l.id] > 0)
        .map((l: any) => ({
          item_id: l.item_id,
          original_line_id: l.id,
          unit_id: l.entered_unit_id || l.unit_id,
          quantity: returnItems[l.id],
          ...(l.serial_allocations?.length ? { serial_ids: returnSerials[l.id] || [] } : {}),
          rate: Number(l.rate),
          discount_amount: 0 // Simplification for retail
        }));

      const response = await posApi.postReturn({
        original_invoice_id: bill.id,
        lines: linesToReturn,
        refund_method: refundMethod
      });

      setPosted(true);
      setReturnItems({});
      setReturnSerials({});
      navigate('/retail/bills', { replace:true, state:{returnConfirmation:{
        billId:bill.id,number:response.data.document_number,amount:Number(response.data.grand_total),method:refundMethod,
      }} });
    } catch (e) {
      // The shared API banner displays the request failure without logging tokens.
      setError(getApiErrorMessage(e));
    } finally { submission.current = false; setSaving(false); }
  };

  return (
    <div className="r-page-with-sticky" style={{ paddingBottom: 100 }}>
      {error && <p role="alert" className="r-section">{error}</p>}
      <StitchHeader className="r-page-header" hasBack>
        <button className="r-btn r-btn--icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </button>
        <h1>Sale Return</h1>
        <div style={{ width: 48 }} />
      </StitchHeader>

      <div style={{ padding: 'var(--r-space-md) var(--r-space-base)', background: 'var(--r-warning-light)', color: 'var(--r-warning)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 'var(--r-text-sm)' }}>
          Choose the quantity to return. Stock is restored only for items whose stock was counted on the original bill.
        </div>
      </div>

      <div className="r-section" style={{ marginTop: 'var(--r-space-md)' }}>
        <h3 style={{ fontSize: 'var(--r-text-lg)', fontWeight: 600, marginBottom: 'var(--r-space-sm)' }}>Bill Items</h3>
        <div className="r-card">
          {bill.sales_invoice_line?.map((line: any) => (
            <div key={line.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--r-space-md)', paddingBottom: 'var(--r-space-md)', borderBottom: '1px solid var(--r-divider)' }}>
              <div style={{ minWidth: 0, flex: '1 1 180px', overflowWrap: 'anywhere' }}>
                <div style={{ fontWeight: 500 }}>{line.item?.name}</div>
                <div style={{ fontSize: 'var(--r-text-sm)', color: 'var(--r-text-muted)' }}>
                  Remaining: {Number(line.remaining_quantity)} · Original line total ₹{Number(line.line_total)}
                </div>
                {line.serial_allocations?.length > 0 && <fieldset className="r-fieldset" disabled={saving||posted}><legend>Choose serials to return</legend>{line.serial_allocations.filter((allocation: any)=>!allocation.returned_at).map((allocation: any)=><label key={allocation.serial_id} style={{display:'block',overflowWrap:'anywhere'}}><input type="checkbox" checked={(returnSerials[line.id]||[]).includes(allocation.serial_id)} onChange={event=>{
                  const selected=event.currentTarget.checked?[...(returnSerials[line.id]||[]),allocation.serial_id]:(returnSerials[line.id]||[]).filter(value=>value!==allocation.serial_id);
                  const scale=Number(line.base_quantity||line.quantity)/Number(line.sold_entered_quantity);
                  setReturnSerials(previous=>({...previous,[line.id]:selected}));
                  setReturnItems(previous=>({...previous,[line.id]:selected.length/scale}));
                }}/>{allocation.serial?.serial_number}</label>)}</fieldset>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button 
                  className="r-btn r-btn--icon r-btn--ghost" 
                  disabled={saving || posted || !!line.serial_allocations?.length || (returnItems[line.id]||0)<=0}
                  onClick={() => handleUpdateReturnQty(line.id, -1)}
                  style={{ background: 'var(--r-bg-grey)' }}
                >
                  -
                </button>
                <input aria-label={'Return quantity for '+line.item?.name} disabled={saving || posted || !!line.serial_allocations?.length || Number(line.remaining_quantity)<=0} className="r-input" style={{width:80}} type="number" min="0" max={line.remaining_quantity} step="any" value={returnItems[line.id]||0} onChange={e=>{
                  // Capture before React evaluates the updater; the controlled
                  // DOM value can change between updater invocations.
                  const quantity=Math.min(Number(line.remaining_quantity),Math.max(0,Number(e.currentTarget.value)));
                  setReturnItems(previous=>({...previous,[line.id]:quantity}));
                }} />
                <button 
                  className="r-btn r-btn--icon r-btn--ghost" 
                  disabled={saving || posted || !!line.serial_allocations?.length || (returnItems[line.id]||0)>=Number(line.remaining_quantity)}
                  onClick={() => handleUpdateReturnQty(line.id, 1)}
                  style={{ background: 'var(--r-bg-grey)' }}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="r-section" style={{ marginTop: 'var(--r-space-md)' }}>
        <h3 style={{ fontSize: 'var(--r-text-lg)', fontWeight: 600, marginBottom: 'var(--r-space-sm)' }}>Refund Method</h3>
        <div className="r-card" style={{ display: 'flex', gap: 'var(--r-space-sm)' }}>
          <button 
            className={`r-btn r-flex-1 ${refundMethod === 'CASH' ? 'r-btn--primary' : 'r-btn--outline'}`}
            disabled={saving || posted}
            onClick={() => setRefundMethod('CASH')}
          >
            Cash Refund
          </button>
          <button 
            className={`r-btn r-flex-1 ${refundMethod === 'KHATA' ? 'r-btn--primary' : 'r-btn--outline'}`}
            disabled={saving || posted}
            onClick={() => setRefundMethod('KHATA')}
          >
            Add to Khata
          </button>
        </div>
      </div>

      <div className="r-sticky-bottom">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--r-space-sm)' }}>
          <span style={{ color: 'var(--r-text-muted)' }}>Refund Amount</span>
          <span style={{ fontSize: 'var(--r-text-xl)', fontWeight: 800 }}>₹{totalReturnAmount.toLocaleString('en-IN')}</span>
        </div>
        <button 
          className="r-btn r-btn--primary r-w-full"
          disabled={totalReturnAmount === 0 || saving || posted}
          onClick={handleSubmitReturn}
        >
          <Undo2 size={20} /> {ui(saving?'Saving…':'Process Return')}
        </button>
      </div>
    </div>
  );
};

export default RetailReturn;
