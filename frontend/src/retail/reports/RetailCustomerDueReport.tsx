import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import {downloadTenantExport} from '../subscription/downloadTenantExport';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download } from 'lucide-react';
import { reportsApi } from '../retailApi';

const RetailCustomerDueReport = () => {
  useUiLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getCustomerDue();
      setData(res.data);
    } catch (err) {
      // The shared API banner displays the request failure without logging tokens.
    }
    setLoading(false);
  };

  const handleExport = () => { void downloadTenantExport('CUSTOMERS',{}); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--r-background)' }}>
      <StitchHeader className="r-page-header" hasBack>
        <button className="r-back-btn" onClick={() => navigate('/retail/reports')}>
          <ChevronLeft size={24} />
        </button>
        <div className="r-header-title">Customers Who Owe You</div>
        <button className="r-back-btn" aria-label={ui("Export CSV")} onClick={handleExport}>
          <Download size={20} />
        </button>
      </StitchHeader>

      <main style={{ flex: 1, overflowY: 'auto', padding: '1rem', paddingBottom: '5rem' }}>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>{ui("Loading...")}</div>
        ) : !data ? (
          <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Unable to load summary</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="r-card r-card--primary">
                <div className="r-card-title">Total Pending Receivable</div>
                <div className="r-card-value">₹{(data.summary?.total_due || 0).toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div className="r-section-title">Customers ({data.customers?.length || 0})</div>
            {data.customers?.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No customers owe you money.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.customers?.map((c: any) => (
                  <div key={c.id} className="r-card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => navigate(`/retail/khata/${c.id}`)}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--r-text-muted)' }}>{c.phone || 'No phone'}</div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--r-warning)' }}>₹{c.due.toLocaleString('en-IN')}</div>
                      <ChevronLeft size={16} style={{ transform: 'rotate(180deg)', opacity: 0.5 }} />
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

export default RetailCustomerDueReport;
