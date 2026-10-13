import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import {downloadTenantExport} from '../subscription/downloadTenantExport';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download } from 'lucide-react';
import { reportsApi } from '../retailApi';
import ReportPeriodFilter from './components/ReportPeriodFilter';

const RetailExpenseReport = () => {
  useUiLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{ from?: string, to?: string }>({});

  useEffect(() => {
    fetchReport();
  }, [filters]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getExpenses(filters);
      setData(res.data);
    } catch (err) {
      // The shared API banner displays the request failure without logging tokens.
    }
    setLoading(false);
  };

  const handleExport = () => { void downloadTenantExport('EXPENSES',filters); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--r-background)' }}>
      <StitchHeader className="r-page-header" hasBack>
        <button className="r-back-btn" onClick={() => navigate('/retail/reports')}>
          <ChevronLeft size={24} />
        </button>
        <div className="r-header-title">Expenses Report</div>
        <button className="r-back-btn" aria-label={ui("Export CSV")} onClick={handleExport}>
          <Download size={20} />
        </button>
      </StitchHeader>

      <main style={{ flex: 1, overflowY: 'auto', padding: '1rem', paddingBottom: '5rem' }}>
        <ReportPeriodFilter value={filters} onChange={setFilters} />

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>{ui("Loading...")}</div>
        ) : !data ? (
          <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Unable to load summary</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="r-card r-card--primary">
                <div className="r-card-title">{ui("Business Expenses")}</div>
                <div className="r-card-value">₹{(data.summary?.business_expenses || 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="r-card" style={{ borderLeft: '4px solid var(--r-warning)' }}>
                <div className="r-card-title">Owner Money Taken</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--r-warning)' }}>₹{(data.summary?.owner_withdrawal || 0).toLocaleString('en-IN')}</div>
              </div>
            </div>

            {data.category_breakdown?.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <div className="r-section-title">Category Breakdown</div>
                    <div className="r-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {data.category_breakdown.map((cb: any, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--r-border)', paddingBottom: '0.5rem' }}>
                                <span>{cb.category}</span>
                                <span style={{ fontWeight: 600 }}>₹{cb.amount.toLocaleString('en-IN')}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="r-section-title">Transactions ({data.expenses?.length || 0})</div>
            {data.expenses?.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No expenses in this period.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.expenses?.map((e: any) => (
                  <div key={e.id} className="r-card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{e.type === 'OWNER_WITHDRAWAL' ? ui("Owner Withdrawal") : e.category || 'Uncategorized'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--r-text-muted)' }}>{new Date(e.date).toLocaleDateString()} {e.paid_to && `• To: ${e.paid_to}`}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: e.type === 'OWNER_WITHDRAWAL' ? 'var(--r-warning)' : 'var(--r-text)' }}>₹{e.amount.toLocaleString('en-IN')}</div>
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

export default RetailExpenseReport;
