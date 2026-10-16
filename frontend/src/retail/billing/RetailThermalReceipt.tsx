import { formatDate, formatTime } from '../../shared/dateFormat';
import { ui, useUiLanguage } from "../../i18n";
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../shared/store/authStore';
import { posApi } from '../retailApi';
import { getApiErrorMessage } from '../../shared/api';
import UpiQr from '../payments/UpiQr';
import BillLineDescription, { billLineQuantity } from './BillLineDescription';
import { printInvoice } from '../../shared/deviceActions';
import { shareBill } from './shareBill';
import { useRetailEntitlements } from '../subscription/useRetailEntitlements';

const RetailThermalReceipt = () => {
  useUiLanguage();
  const access=useRetailEntitlements();
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantContext } = useAuthStore();
  const { id } = useParams();
  const [bill, setBill] = useState<any>(location.state?.bill || null);
  const [error, setError] = useState('');
  const [message,setMessage]=useState('');
  useEffect(() => { if (!bill && id) posApi.getBillDetail(id).then(res=>setBill(res.data)).catch(e=>setError(getApiErrorMessage(e))); }, [id]);


  if (error) return <div className="r-section" role="alert"><p>{error}</p><button className="r-btn" onClick={() => window.location.reload()}>{ui("Try Again")}</button></div>;
  if (!bill) {
    return <p className="r-section" role="status">Loading bill for printing…</p>;
  }

  return (
    <div className="r-thermal-receipt" style={{ width: '80mm', padding: '5mm', margin: '0 auto', fontSize: '12px', fontFamily: 'monospace', color: '#000', background: '#fff' }}>
      <div className="r-receipt-controls"><button type="button" className="r-btn r-btn--primary" onClick={()=>{void printInvoice().catch(()=>setMessage('Could not open printing on this device.'));}}>{ui("Print invoice")}</button><button type="button" className="r-btn" onClick={()=>void shareBill(bill).then(setMessage).catch(()=>setMessage('Sharing cancelled or unavailable.'))}>Share</button>{access.isFeatureEffective('GST_INVOICES')&&<button type="button" className="r-btn" onClick={()=>navigate('/retail/gst/bills/'+bill.id)}>GST bill</button>}<button type="button" className="r-btn" onClick={()=>navigate('/retail/home')}>Home</button><button type="button" className="r-btn" onClick={()=>navigate('/retail/quick-sale')}>New bill</button><button type="button" className="r-btn" onClick={()=>navigate('/retail/bills/'+bill.id)}>Bill details</button>{message&&<p role="status">{message}</p>}</div>
      {/* Print-specific CSS */}
      <style>
        {`
          @media print {
            .r-receipt-controls { display:none; }
            body * { visibility: hidden; }
            .r-thermal-receipt, .r-thermal-receipt * { visibility: visible; }
            .r-thermal-receipt { position: absolute; left: 0; top: 0; width: 80mm; margin: 0; padding: 0; }
          }
        `}
      </style>

      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <h2 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{tenantContext?.company_name || 'EVOLIX RETAIL'}</h2>
        <div style={{ fontSize: '10px' }}>BILL / RECEIPT</div>
        {bill.status!=='POSTED'&&<p style={{fontWeight:800,color:'#b42318'}}>CANCELLED · ORIGINAL RECORD FOR AUDIT</p>}
      </div>

      <div style={{ borderBottom: '1px dashed #000', marginBottom: '10px', paddingBottom: '5px' }}>
        <div>Bill No: {bill.document_number}</div>
        <div>Date: {formatDate(bill.document_date)} · {formatTime(bill.posted_at || bill.created_at)}</div>
        <div>Customer: {bill.party?.name || 'Walk-in'}</div>
      </div>

      <table style={{ width: '100%', marginBottom: '10px', fontSize: '11px' }}>
        <thead>
          <tr style={{ borderBottom: '1px dashed #000' }}>
            <th style={{ textAlign: 'left', paddingBottom: '5px' }}>Item</th>
            <th style={{ textAlign: 'right', paddingBottom: '5px' }}>Qty</th>
            <th style={{ textAlign: 'right', paddingBottom: '5px' }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {bill.sales_invoice_line?.map((line: any) => (
            <tr key={line.id}>
              <td style={{ paddingTop: '5px', overflowWrap: 'anywhere' }}>{line.item?.name}<BillLineDescription line={line} /></td>
              <td style={{ textAlign: 'right', paddingTop: '5px' }}>{billLineQuantity(line)}</td>
              <td style={{ textAlign: 'right', paddingTop: '5px' }}>{Number(line.line_total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #000', paddingTop: '5px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
          <span>{ui("TOTAL")}</span>
          <span>₹{Number(bill.grand_total).toFixed(2)}</span>
        </div>
        {Number(bill.tax_amount) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
            <span>Includes GST:</span>
            <span>₹{Number(bill.tax_amount).toFixed(2)}</span>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '20px' }}>
        {bill.payments?.filter((p:any)=>p.method==='UPI').map((p:any,i:number)=><p key={i}>UPI ₹{Number(p.amount).toFixed(2)}{p.receiving_upi_id?' · '+p.receiving_upi_id:p.received_on_mobile?' · Received on '+p.received_on_mobile:''}</p>)}
        {Number(bill.outstanding_amount)>0&&<UpiQr invoice amount={Number(bill.outstanding_amount)}/>}
        Thank you for your visit!<br />
        Powered by Apna Galla
      </div>
    </div>
  );
};

export default RetailThermalReceipt;
