import DateInput from '../../shared/components/DateInput';
import { formatDate } from '../../shared/dateFormat';
import StitchHeader from '../design/StitchHeader';
import BillCorrection from './BillCorrection';
import AuditHistoryLink from '../components/AuditHistoryLink';
import { ui, useUiLanguage } from "../../i18n";
import WhatsAppCustomer from '../payments/WhatsAppCustomer';
import BillLineDescription from './BillLineDescription';
import {getApiErrorMessage as calendarError} from '../../shared/api';
import api from '../../shared/api';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Share2, Undo2 } from 'lucide-react';
import { posApi } from '../retailApi';
import { getApiErrorMessage } from '../../shared/api';

const RetailBillDetail = () => {
  useUiLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBill = async () => {
      try {
        const res = await posApi.getBillDetail(id!);
        setBill(res.data || null);
      } catch (e) {
        setError(getApiErrorMessage(e));
      }
    };
    if (id) fetchBill();
  }, [id]);

  if (error) return <div className="r-section" role="alert"><p>{error}</p><button className="r-btn" onClick={() => window.location.reload()}>{ui("Try Again")}</button><button className="r-btn" onClick={() => navigate('/retail/bills')}>{ui("Bill History")}</button></div>;
  if (!bill) return <div className="r-page" role="status" style={{ padding: 20 }}>{ui("Loading...")}</div>;

  return (
    <div className="r-page-with-sticky" style={{ paddingBottom: 160 }}>
      <StitchHeader className="r-page-header" hasBack>
        <button className="r-btn r-btn--icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </button>
        <h1>Bill Details</h1>
        <div style={{ width: 48 }} />
      </StitchHeader>

      <div style={{ padding: 'var(--r-space-xl) var(--r-space-base)', textAlign: 'center', borderBottom: '1px solid var(--r-divider)' }}>
        <div style={{ fontSize: 'var(--r-text-4xl)', fontWeight: 800, letterSpacing: '-0.03em' }}>
          ₹{Number(bill.grand_total).toLocaleString('en-IN')}
        </div>
        {!!bill.returns?.length && <p className="r-caption">{ui('Original bill total')}</p>}
        <div style={{ color: 'var(--r-text-muted)', marginTop: 4 }}>
          {bill.document_number} • {formatDate(bill.document_date)}
        </div>
      </div>

      {Number(bill.outstanding_amount)>0&&<section className="r-section r-card"><label htmlFor="bill-promise-date">Customer promised payment on</label><DateInput className="r-input" id="bill-promise-date" type="date" min={bill.document_date.slice(0,10)} value={(bill.due_date||'').slice(0,10)} onChange={async e=>{if(!e.target.value)return;try{await api.patch('/retail/calendar/receivables/'+bill.id,{title:'Customer repayment promise',date:e.target.value});setBill({...bill,due_date:e.target.value});}catch(error){setError(calendarError(error));}}} lang="en-GB"/><p className="r-caption">Shown under Calendar → Receivables while this bill is unpaid.</p></section>}
      <div className="r-section"><button className="r-btn r-btn--outline r-w-full" onClick={()=>navigate('/retail/gst/bills/'+bill.id)}><Printer size={18}/>{ui('A4 GST Invoice')}</button></div>
      <div className="r-section" style={{ marginTop: 'var(--r-space-lg)' }}>
        <div className="r-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--r-space-sm)' }}>
            <span style={{ color: 'var(--r-text-muted)' }}>{ui("Customer")}</span>
            <span style={{ fontWeight: 600 }}>{bill.party?.name || ui("Walk-in Customer")}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--r-space-sm)' }}>
            <span style={{ color: 'var(--r-text-muted)' }}>{ui("Status")}</span>
            <span style={{ fontWeight: 600 }}>{bill.return_status==='FULL'?ui('Fully returned'):bill.return_status==='PARTIAL'?ui('Partially returned'):bill.status}</span>
          </div>
          <p>Paid: ₹{Number(bill.paid_amount).toLocaleString('en-IN')}</p><p>Due: ₹{Number(bill.outstanding_amount).toLocaleString('en-IN')}</p>
          {bill.payments?.map((p: any, index: number) => <p key={index}>{p.method}: ₹{p.amount}{p.receiving_upi_id?' · '+p.receiving_label+' · '+p.receiving_upi_id:p.received_on_mobile?' · Received on '+p.received_on_mobile:''}</p>)}
        </div>
      </div>

      {!!bill.returns?.length && <section className="r-section r-card" aria-label={ui('Returns and settlement')}>
        <h2>{ui('Returns and settlement')}</h2>
        <p className="r-caption">{ui('The original posted bill is preserved. The amounts below include its posted returns and recorded payments.')}</p>
        {[['Return value',bill.settlement.return_value],['Net bill after returns',bill.settlement.net_total],['Payments recorded',bill.settlement.received_total],['Cash refunded',bill.settlement.cash_refunded],['Payment retained after refunds',bill.settlement.net_received],['Current amount due',bill.settlement.due],...(bill.settlement.customer_credit>0?[['Customer credit',bill.settlement.customer_credit]]:[])].map(([label,amount])=><div className="r-detail-row" key={String(label)}><span>{ui(String(label))}</span><strong>₹{Number(amount).toLocaleString('en-IN',{maximumFractionDigits:2})}</strong></div>)}
        <h3>{ui('Return history')}</h3>
        {bill.returns.map((r:any)=><article key={r.id} className="r-card">
          <strong>{r.document_number}</strong><p>{formatDate(r.document_date)} · {ui(r.refund_method==='CASH'?'Cash refund':'Khata credit')} · ₹{Number(r.grand_total).toLocaleString('en-IN')}</p>
          {r.lines.map((line:any)=><p className="r-caption" key={line.id}>{line.item_name} · {ui('Returned')}: {line.quantity} {line.unit}{line.batch_number?' · '+line.batch_number:''}</p>)}
          {r.refunds.map((refund:any)=><p className="r-caption" key={refund.id}>{ui('Cash refunded')}: ₹{refund.amount.toLocaleString('en-IN')} · {formatDate(refund.date)}</p>)}
          {r.credit_adjusted>0&&<p className="r-caption">{ui('Khata credit')}: ₹{r.credit_adjusted.toLocaleString('en-IN')}</p>}
        </article>)}
      </section>}

      <div className="r-section" style={{ marginTop: 'var(--r-space-lg)' }}>
        <h3 style={{ fontSize: 'var(--r-text-lg)', fontWeight: 600, marginBottom: 'var(--r-space-md)' }}>{ui("Items")}</h3>
        <div className="r-card">
          {bill.sales_invoice_line?.map((line: any) => (
            <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--r-space-md)', paddingBottom: 'var(--r-space-md)', borderBottom: '1px solid var(--r-divider)' }}>
              <div style={{ minWidth: 0, flex: 1, paddingRight: 12 }}>
                <div style={{ fontWeight: 500 }}>{line.item?.name}</div>
                <div style={{ fontSize: 'var(--r-text-sm)', color: 'var(--r-text-muted)' }}>
                  <BillLineDescription line={line} />
                  {line.returned_quantity>0&&<p className="r-caption">{ui('Returned')}: {line.returned_quantity} · {ui('Remaining quantity')}: {line.remaining_quantity}</p>}
                </div>
              </div>
              <div style={{ fontWeight: 600 }}>
                ₹{Number(line.line_total).toLocaleString('en-IN')}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, paddingTop: 'var(--r-space-sm)' }}>
            <span>{ui("Total")}</span>
            <span>₹{Number(bill.grand_total).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {bill.sales_invoice_line?.some((l:any)=>'cost_status' in l)&&<section className="r-section r-card"><h2>Saved bill profit</h2><p className="r-caption">Original posted costs; Output GST is excluded. Returns appear in Profit Reports.</p>{bill.sales_invoice_line.map((l:any)=><div key={l.id}><strong>{l.item?.name}</strong><p>Net revenue: ₹{Number(l.net_revenue??l.taxable_value).toFixed(2)} · COGS: {l.cogs_total==null?'Unknown':'₹'+Number(l.cogs_total).toFixed(2)}</p><p>Profit: {l.gross_profit==null?'Incomplete — cost not known':'₹'+Number(l.gross_profit).toFixed(2)}</p></div>)}<button className="r-btn r-btn--outline" onClick={()=>navigate('/retail/reports/financial/bills?bill_id='+bill.id+'&from='+bill.document_date.slice(0,10))}>View Bill Profit Report</button></section>}
      <BillCorrection bill={bill}/><div className="r-section"><AuditHistoryLink sourceId={bill.id}/><WhatsAppCustomer billId={bill.id}/></div>
      <div className="r-sticky-bottom">
        <div style={{ display: 'flex', gap: 'var(--r-space-md)' }}>
          <button className="r-btn r-btn--ghost r-flex-1" onClick={() => navigator.clipboard.writeText(`${bill.document_number}: ₹${bill.grand_total}`).then(()=>alert('Bill summary copied')).catch(()=>alert('Could not copy bill.'))}>
            <Share2 size={20} />{ui("Share")}</button>
          <button 
            className="r-btn r-btn--primary r-flex-1"
            onClick={() => navigate(`/retail/bills/${id}/print`, { state: { bill } })}
          >
            <Printer size={20} />{ui("Print")}</button>
        </div>
        {bill.status === 'POSTED' && (
          <button className="r-btn r-btn--outline r-w-full" style={{ marginTop: 'var(--r-space-md)', color: 'var(--r-danger)', borderColor: 'var(--r-danger)' }} onClick={() => navigate(`/retail/bills/${id}/return`)}>
            <Undo2 size={20} />
            Sale Return
          </button>
        )}
      </div>
    </div>
  );
};

export default RetailBillDetail;
