import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import {downloadTenantExport} from '../subscription/downloadTenantExport';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download } from 'lucide-react';
import { reportsApi } from '../retailApi';

const RetailStockReport = () => {
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
      const res = await reportsApi.getStock();
      setData(res.data);
    } catch (err) {
      // The shared API banner displays the request failure without logging tokens.
    }
    setLoading(false);
  };

  const handleExport = () => { void downloadTenantExport('STOCK',{}); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--r-background)' }}>
      <StitchHeader className="r-page-header" hasBack>
        <button className="r-back-btn" onClick={() => navigate('/retail/reports')}>
          <ChevronLeft size={24} />
        </button>
        <div className="r-header-title">{ui("Stock Report")}</div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="r-card r-card--primary" style={{ gridColumn: 'span 2' }}>
                <div className="r-card-title">Total Items in Inventory</div>
                <div className="r-card-value">{data.summary?.total_items || 0}</div>
              </div>
              <div className="r-card">
                <div className="r-card-title">{ui("Low Stock")}</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--r-warning)' }}>{data.summary?.low_stock_count || 0}</div>
              </div>
              <div className="r-card">
                <div className="r-card-title">Out of Stock</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--r-danger)' }}>{data.summary?.out_of_stock_count || 0}</div>
              </div>
            </div>

            <div className="r-section-title">Current Inventory Levels</div>
            {data.items?.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No inventory items found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.items?.map((item: any) => (
                  <div key={item.item_id} className="r-card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', borderLeft: item.quantity <= 0 ? '4px solid var(--r-danger)' : 'none' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.name}{item.archived&&<small className="r-caption"> · Archived / Stop Selling</small>}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--r-text-muted)' }}>{item.sku || 'No SKU'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: item.quantity <= 0 ? 'var(--r-danger)' : 'var(--r-text)' }}>{item.quantity} Qty</div>
                      {item.quantity <= 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--r-text-muted)', cursor: 'pointer', textDecoration: 'underline' }} onClick={(e) => {
                            e.stopPropagation();
                            navigate('/retail/needs');
                        }}>
                          Add to Need List
                        </div>
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

export default RetailStockReport;
