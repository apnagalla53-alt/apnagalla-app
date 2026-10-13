import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import {prepareTenantExport} from '../subscription/prepareTenantExport';
import {useCsvDownload,CsvDownloadStatus} from '../subscription/useCsvDownload';
import {getApiErrorMessage} from '../../shared/api';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download } from 'lucide-react';
import { reportsApi } from '../retailApi';
import ReportPeriodFilter from './components/ReportPeriodFilter';

const RetailPurchaseReport = () => {
  useUiLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,setError]=useState('');
  const csv=useCsvDownload();
  const [filters, setFilters] = useState<{ from?: string, to?: string }>({});

  useEffect(() => {
    fetchReport();
  }, [filters]);

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.getPurchases(filters);
      setData(res.data);
    } catch (err) {
      setData(null);setError(getApiErrorMessage(err));
    }
    setLoading(false);
  };

  const handleExport = () => { void csv.start(()=>prepareTenantExport('PURCHASES',filters,true)); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--r-background)' }}>
      <StitchHeader className="r-page-header" hasBack>
        <button className="r-back-btn" onClick={() => navigate('/retail/reports')}>
          <ChevronLeft size={24} />
        </button>
        <div className="r-header-title">Purchases Report</div>
        <button className="r-back-btn" aria-label={ui("Export CSV")} onClick={handleExport} disabled={csv.busy}>
          <Download size={20} />
        </button>
      </StitchHeader>

      <main style={{ flex: 1, overflowY: 'auto', padding: '1rem', paddingBottom: '5rem' }}>
        <ReportPeriodFilter value={filters} onChange={setFilters} />
        <CsvDownloadStatus state={csv}/>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>{ui("Loading...")}</div>
        ) : !data ? (
          <div className="r-state-message" role="alert"><p>{error||ui('Unable to load summary')}</p><button className="r-btn r-btn--outline" onClick={fetchReport}>{ui('Try Again')}</button></div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="r-card r-card--primary" style={{ gridColumn: 'span 2' }}>
                <div className="r-card-title">Total Purchases</div>
                <div className="r-card-value">₹{(data.summary?.total_purchases || 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="r-card">
                <div className="r-card-title">Paid Amount</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--r-success)' }}>₹{(data.summary?.paid_amount || 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="r-card">
                <div className="r-card-title">Amount Due</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--r-warning)' }}>₹{(data.summary?.outstanding_amount || 0).toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div className="r-section-title">Purchase Bills ({data.summary?.purchase_count || 0})</div>
            {data.purchases?.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No purchases in this period.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.purchases?.map((p: any) => (
                  <div key={p.id} className="r-card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.supplier_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--r-text-muted)' }}>{p.document_number} • {new Date(p.document_date).toLocaleDateString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>₹{p.grand_total.toLocaleString('en-IN')}</div>
                      {p.outstanding_amount > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--r-warning)' }}>Due: ₹{p.outstanding_amount.toLocaleString('en-IN')}</div>
                      )}
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

export default RetailPurchaseReport;
