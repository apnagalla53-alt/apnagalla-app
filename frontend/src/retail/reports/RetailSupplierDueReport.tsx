import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import {downloadTenantExport} from '../subscription/downloadTenantExport';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download } from 'lucide-react';
import { reportsApi } from '../retailApi';

const RetailSupplierDueReport = () => {
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
      const res = await reportsApi.getSupplierDue();
      setData(res.data);
    } catch (err) {
      // The shared API banner displays the request failure without logging tokens.
    }
    setLoading(false);
  };

  const handleExport = () => { void downloadTenantExport('SUPPLIERS',{}); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--r-background)' }}>
      <StitchHeader className="r-page-header" hasBack>
        <button className="r-back-btn" onClick={() => navigate('/retail/reports')}>
          <ChevronLeft size={24} />
        </button>
        <div className="r-header-title">Suppliers You Have to Pay</div>
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
                <div className="r-card-title">Total Pending Payable</div>
                <div className="r-card-value">₹{(data.summary?.total_due || 0).toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div className="r-section-title">Suppliers ({data.suppliers?.length || 0})</div>
            {data.suppliers?.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No pending payments to suppliers.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.suppliers?.map((s: any) => (
                  <div key={s.id} className="r-card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => navigate(`/retail/suppliers/${s.id}`)}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--r-text-muted)' }}>{s.phone || 'No phone'}</div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--r-danger)' }}>₹{s.due.toLocaleString('en-IN')}</div>
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

export default RetailSupplierDueReport;
