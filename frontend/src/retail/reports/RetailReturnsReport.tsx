import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import { downloadReturnsExport } from './returns-export';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download } from 'lucide-react';
import { reportsApi } from '../retailApi';
import ReportPeriodFilter from './components/ReportPeriodFilter';
import { getApiErrorMessage } from '../../shared/api';

const RetailReturnsReport = () => {
  useUiLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<{ from?: string, to?: string }>({});

  useEffect(() => {
    fetchReport();
  }, [filters]);

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.getReturns(filters);
      setData(res.data);
    } catch (err) {
      setData(null); setError(getApiErrorMessage(err));
    }
    setLoading(false);
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError('');
    try { await downloadReturnsExport(filters); }
    catch { setExportError(ui('Unable to export returns. Please retry.')); }
    finally { setExporting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--r-background)' }}>
      <StitchHeader className="r-page-header" hasBack>
        <button className="r-back-btn" onClick={() => navigate('/retail/reports')}>
          <ChevronLeft size={24} />
        </button>
        <div className="r-header-title">Sales Returns</div>
        <button className="r-back-btn" aria-label={ui("Export CSV")} onClick={handleExport} disabled={exporting}>
          <Download size={20} />
        </button>
      </StitchHeader>

      <main style={{ flex: 1, overflowY: 'auto', padding: '1rem', paddingBottom: '5rem' }}>
        <ReportPeriodFilter value={filters} onChange={setFilters} />
        {exportError && <p className="r-error" role="alert">{exportError}</p>}

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>{ui("Loading...")}</div>
        ) : !data ? (
          <div className="r-state-message" role="alert"><p>{error || ui('Unable to load summary')}</p><button className="r-btn r-btn--outline" onClick={fetchReport}>{ui('Try Again')}</button></div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="r-card r-card--primary">
                <div className="r-card-title">{ui('Total Return Value')}</div>
                <div className="r-card-value">₹{Number(data.summary?.total_returns ?? 0).toLocaleString('en-IN')}</div>
                <p className="r-caption">{ui('Includes cash refunds and credit adjustments. This is the value of posted return invoices.')}</p>
              </div>
            </div>

            <div className="r-section-title">Return Invoices ({data.summary?.returns_count || 0})</div>
            {data.returns?.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No returns in this period.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.returns?.map((r: any) => (
                  <div key={r.id} className="r-card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', gap:12 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.customer_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--r-text-muted)' }}>{r.document_number} • {new Date(r.document_date).toLocaleDateString()}</div>
                      {r.lines?.map((line:any)=><p className="r-caption" key={line.id}>{line.item_name} · {line.quantity} {line.unit}{line.batch_number?' · '+line.batch_number:''}</p>)}
                      <p className="r-caption">{ui(r.refund_method==='CASH'?'Cash refund':'Khata credit')} · ₹{Number(r.cash_refunded || r.credit_adjusted || 0).toLocaleString('en-IN')}</p>
                      {r.original_invoice_id&&<button className="r-btn r-btn--ghost" onClick={()=>navigate('/retail/bills/'+r.original_invoice_id)}>{ui('View original bill')}</button>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: 'var(--r-warning)' }}>₹{r.grand_total.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default RetailReturnsReport;
