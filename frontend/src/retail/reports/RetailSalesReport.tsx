import { formatDate } from '../../shared/dateFormat';
import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import {downloadTenantExport} from '../subscription/downloadTenantExport';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download } from 'lucide-react';
import { reportsApi } from '../retailApi';
import ReportPeriodFilter from './components/ReportPeriodFilter';

const RetailSalesReport = () => {
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
      const res = await reportsApi.getSales(filters);
      setData(res.data);
    } catch (err) {
      // The shared API banner displays the request failure without logging tokens.
    }
    setLoading(false);
  };

  const handleExport = () => { void downloadTenantExport('SALES',filters); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--r-background)' }}>
      <StitchHeader className="r-page-header" hasBack>
        <button className="r-back-btn" onClick={() => navigate('/retail/reports')}>
          <ChevronLeft size={24} />
        </button>
        <div className="r-header-title">{ui("Sales Report")}</div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="r-card r-card--primary" style={{ gridColumn: 'span 2' }}>
                <div className="r-card-title">Net Sales</div>
                <div className="r-card-value">₹{(data.summary?.net_sales || 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="r-card">
                <div className="r-card-title">Gross Sales</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>₹{(data.summary?.gross_sales || 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="r-card">
                <div className="r-card-title">{ui("Returns")}</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--r-danger)' }}>₹{(data.summary?.returns || 0).toLocaleString('en-IN')}</div>
              </div>
              
              <div className="r-card" style={{ gridColumn: 'span 2' }}>
                <div className="r-card-title" style={{ marginBottom: '0.5rem' }}>Payment Breakdown</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>{ui('Cash Received from Sales')}: ₹{(data.summary?.cash_received || 0).toLocaleString('en-IN')}</span>
                  <span>UPI: ₹{(data.summary?.upi_received || 0).toLocaleString('en-IN')}</span>
                  <span>Udhar: ₹{(data.summary?.udhar_sales || 0).toLocaleString('en-IN')}</span>
                </div>
                <p className="r-caption">{ui('This is cash received from sales before refunds, expenses, supplier payments and owner withdrawals.')}</p>
                <button type="button" className="r-btn r-btn--outline" onClick={() => navigate('/retail/galla')}>{ui('View Daily Galla')}</button>
              </div>
            </div>

            <div className="r-section-title">Sales Bills ({data.bills?.length || 0})</div>
            {data.bills?.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No sales in this period.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.bills?.map((bill: any) => (
                  <div key={bill.id} className="r-card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{bill.customer_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--r-text-muted)' }}>{bill.document_number} • {formatDate(bill.document_date)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>₹{bill.grand_total.toLocaleString('en-IN')}</div>
                      {bill.outstanding_amount > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--r-warning)' }}>Due: ₹{bill.outstanding_amount.toLocaleString('en-IN')}</div>
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

export default RetailSalesReport;
