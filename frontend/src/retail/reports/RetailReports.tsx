import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Wallet, ShoppingCart, Package, Users, ArrowRightLeft, ChevronLeft, ChevronRight, Banknote } from 'lucide-react';
import { useAuthStore } from '../../shared/store/authStore';
import { reportsApi } from '../retailApi';
import { getApiErrorMessage } from '../../shared/api';
import ReportPeriodFilter from './components/ReportPeriodFilter';
import ReportAssistant from './ReportAssistant';
import {useRetailEntitlements} from '../subscription/useRetailEntitlements';
import {financialReports} from './RetailFinancialReport';

const reports = [
  { name: 'Sales Report', Icon: TrendingUp, path: '/retail/reports/sales', desc: 'Sales, returns, and payment breakdown' },
  { name: 'Expense Report', Icon: Wallet, path: '/retail/reports/expenses', desc: 'Business expenses and owner withdrawals' },
  { name: 'Purchases Report', Icon: ShoppingCart, path: '/retail/reports/purchases', desc: 'Supplier bills and purchase history' },
  { name: 'Stock Report', Icon: Package, path: '/retail/reports/stock', desc: 'Available stock and low stock alerts' },
  { name: 'Customer Due', Icon: Users, path: '/retail/reports/customers', desc: 'Customers who owe you money' },
  { name: 'Supplier Due', Icon: Users, path: '/retail/reports/suppliers', desc: 'Suppliers you have to pay' },
  { name: 'Returns Report', Icon: ArrowRightLeft, path: '/retail/reports/returns', desc: 'Returned items and refunds' },
  { name: 'Daily Galla', Icon: Banknote, path: '/retail/galla', desc: 'Actual money in, money out and counter cash' },
];
export default function RetailReports() {
  useUiLanguage();
  const navigate = useNavigate();
  const access=useRetailEntitlements();
  const tenant = useAuthStore(s => s.tenantContext);
  const [filters, setFilters] = useState<{ from?: string; to?: string }>({ from: new Date().toLocaleDateString('en-CA'), to: new Date().toLocaleDateString('en-CA') });
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setSummary(null);
    Promise.allSettled([reportsApi.getDashboard(filters), reportsApi.getPurchases(filters)])
      .then(([dashboard, purchases]) => {
        if(!active)return;
        const failures=[dashboard,purchases].filter(r=>r.status==='rejected').map(r=>getApiErrorMessage((r as PromiseRejectedResult).reason));
        setError([...new Set(failures)].join(' '));
        setSummary(dashboard.status==='fulfilled'||purchases.status==='fulfilled'?{
          ...(dashboard.status==='fulfilled'?dashboard.value.data:{}),
          purchases:purchases.status==='fulfilled'?purchases.value.data.summary?.total_purchases:null,
        }:null);
      })
      .catch(err => { if (active) setError(getApiErrorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, retry]);
  return <><StitchHeader className="r-page-header" hasBack><button className="r-btn r-btn--icon" aria-label={ui("Back to More")} onClick={() => navigate('/retail/more')}><ChevronLeft size={24} /></button><h1>{ui("Reports")}</h1><span className="r-header-spacer" /></StitchHeader><main className="r-section">
    <p className="r-caption">{tenant?.company_name || ui("My Shop")} · Understand your business</p>
    <ReportPeriodFilter value={filters} onChange={setFilters} allowAllTime={false}/>
    {loading && <div className="r-state-message" role="status">Loading business summary…</div>}
    {error && <div className="r-state-message" role="alert"><p>{error}</p><button className="r-btn r-btn--outline" onClick={() => setRetry(value => value + 1)}>{ui("Try Again")}</button></div>}
    {summary && <div className="r-counter-grid">{[['Net Sales', summary.net_sales], ['Purchases', summary.purchases], ['Cash & UPI Received', summary.cash_received==null||summary.upi_received==null?null:Number(summary.cash_received) + Number(summary.upi_received)], ['Business Expenses', summary.business_expenses]].map(([label, value]) => <div className="r-card" key={String(label)}><span>{ui(label)}</span><strong>{value==null?ui('Unavailable'):'₹'+Number(value).toLocaleString('en-IN')}</strong></div>)}</div>}
    <div className="r-section-heading"><h2>Business reports</h2></div>
    <div className="r-report-discovery">{reports.map(({ name, Icon, path, desc }) => <button key={path} className="r-card r-report-link" onClick={() => navigate(path)}><span className="r-menu-icon"><Icon size={24} /></span><span className="r-menu-text"><span>{name}</span><small>{ui(desc)}</small></span><ChevronRight size={20} /></button>)}</div>
    <p className="r-caption">Download CSV from an individual report to keep or share your records.</p>
    <div className="r-section-heading"><h2>Profit & Financial</h2></div>
    <div className="r-report-discovery">{financialReports.map(([key,name,desc])=><button key={key} className="r-card r-report-link" onClick={()=>navigate(access.isFeatureEffective('PROFIT_REPORTING')?'/retail/reports/financial/'+key:'/retail/more/subscription?plan=SMART')}><span className="r-menu-icon"><TrendingUp size={24}/></span><span className="r-menu-text"><span>{ui(name)}</span><small>{ui(desc)}{!access.hasEntitlement("PROFIT_REPORTING")&&" · "+ui("Available in Smart")}</small></span><ChevronRight size={20}/></button>)}</div>
    <ReportAssistant/>
  </main></>;
}
