import { readReport } from './reports/reportReads';
import { ui, useUiLanguage } from '../i18n';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Wallet, EyeOff, ChevronRight, ArrowRight, Receipt, Banknote, Mic, ClipboardList, AlertTriangle, Package } from 'lucide-react';
import { getApiErrorMessage } from '../shared/api';
import { useAuthStore } from '../shared/store/authStore';
import { reportsApi } from './retailApi';
import RetailHomeTools from './components/RetailHomeTools';
import { LoadingState } from './components/MobileControls';
import { LedgerMetric } from './design/StitchComponents';
import './assistant/assistant.css';
import './design/stitch-home.css';
import {useRetailEntitlements} from './subscription/useRetailEntitlements';

const periods = [['TODAY','Today'],['YESTERDAY','Yesterday'],['WEEK','This Week'],['MONTH','This Month']];
export default function RetailHome() {
  useUiLanguage();
  const access=useRetailEntitlements();
  const profitEnabled=access.isFeatureEffective('PROFIT_REPORTING');
  const user=useAuthStore(s=>s.user), tenant=useAuthStore(s=>s.tenantContext), navigate=useNavigate();
  const [dashboard,setDashboard]=useState<any>(null),[profit,setProfit]=useState<any>(null),[galla,setGalla]=useState<any>(null);
  const [loading,setLoading]=useState(true),[range,setRange]=useState('TODAY'),[error,setError]=useState(''),[profitError,setProfitError]=useState(''),[gallaError,setGallaError]=useState('');
  const [retry,setRetry]=useState(0),[privateTotals,setPrivateTotals]=useState(false);
  const money=(value:number)=>privateTotals?'••••':'₹'+Number(value).toLocaleString('en-IN');
  useEffect(()=>{
    let active=true;
    const from=new Date(),to=new Date();
    if(range==='YESTERDAY'){from.setDate(from.getDate()-1);to.setDate(to.getDate()-1);}
    if(range==='WEEK')from.setDate(from.getDate()-((from.getDay()+6)%7));
    if(range==='MONTH')from.setDate(1);
    const filters={from:from.toLocaleDateString('en-CA'),to:to.toLocaleDateString('en-CA')};
    setLoading(true);setError('');setDashboard(null);setProfit(null);setProfitError('');
    reportsApi.getDashboard(filters).then(r=>{if(active)setDashboard(r.data);}).catch(e=>{if(active)setError(getApiErrorMessage(e));}).finally(()=>{if(active)setLoading(false);});
    const permitted=['OWNER','ADMIN','TENANT_ADMIN'].includes(user?.role||'')||user?.permissions?.includes('reports.read');
    if(permitted&&profitEnabled)readReport('/retail/reports/financial/summary',filters).then(r=>{if(active)setProfit(r.data);}).catch(e=>{if(active&&e.response?.status!==403)setProfitError('Profit summary could not load. Open Reports to retry.');});
    return()=>{active=false;};
  },[range,retry,tenant?.company_id,user?.id,profitEnabled]);
  useEffect(()=>{
    let active=true;setGalla(null);setGallaError('');
    readReport('/retail/galla',{date:new Date().toLocaleDateString('en-CA')}).then(r=>{if(active)setGalla(r.data);}).catch(e=>{if(active)setGallaError(getApiErrorMessage(e));});
    return()=>{active=false;};
  },[tenant?.company_id,retry]);
  const actions=[
    {id:'qa-customer-payment',title:'Customer Paid Me',desc:'Collect an old due',path:'/retail/receive-payment',Icon:Banknote},
    {id:'qa-add-purchase',title:'Buy Stock',desc:'Buy stock',path:'/retail/purchases/new',Icon:ShoppingCart},
    {id:'qa-add-expense',title:'Add Expense',desc:'Record money out',path:'/retail/expenses/add',Icon:Wallet},
    {id:'qa-needs',title:'Mangwana Hai',desc:'Add to Need List',path:'/retail/needs',Icon:ClipboardList},
  ];
  return <div className="r-stitch-home r-home-refresh">
    <nav className="r-home-periods" aria-label={ui('Summary period')}>{periods.map(([key,label])=><button key={key} aria-pressed={range===key} className={range===key?'active':''} onClick={()=>setRange(key)}>{ui(label)}</button>)}</nav>
    <div className="r-home-bill-tray"><button id="qa-new-bill" onClick={()=>navigate('/retail/bill')}><span className="r-home-bill-icon"><Receipt size={26} aria-hidden="true"/></span><span><strong>{ui('Make Bill')}</strong><small>{ui('Sell items')}</small></span></button><button id="qa-quick-sale" aria-label={ui('Quick Sale')} onClick={()=>navigate('/retail/quick-sale')}>{ui('Quick')}<ArrowRight size={20} aria-hidden="true"/></button></div>
    {error&&<div className="r-state-message" role="alert"><p>{error}</p><button className="r-btn r-btn--outline" onClick={()=>setRetry(n=>n+1)}>{ui('Try Again')}</button></div>}
    {loading&&<LoadingState label="Loading shop summary…"/>}
    {dashboard&&<>
      <section className="r-home-sale r-ledger-metric"><div className="r-ledger-metric-label"><span>{ui(range==='TODAY'?"Today's Sale":'Net Sales for Selected Period')}</span><button className="r-home-private" aria-label={ui(privateTotals?'Show amounts':'Hide amounts')} onClick={()=>setPrivateTotals(v=>!v)}>{privateTotals?<EyeOff size={16}/>:<span>{dashboard.bills_count||0} {ui('Bills')}</span>}</button></div><strong className="r-ledger-amount">{money(dashboard.net_sales)}</strong><div className="r-home-payment-metrics"><div><span>{ui('Cash')}</span><strong>{money(dashboard.cash_received)}</strong></div><div><span>{ui('UPI')}</span><strong>{money(dashboard.upi_received)}</strong></div><div><span>{ui('Udhar')}</span><strong>{money(dashboard.udhar_sales)}</strong></div></div></section>
      <section className="r-home-dues" aria-label={ui('Khata Balance')}><div className="r-home-due-card"><span><i/>{ui('Customer Due')}</span><small>{ui('Money to receive')}</small><strong>{money(dashboard.customer_due)}</strong><button aria-label={ui('View Khata')} onClick={()=>navigate('/retail/khata')}>{ui('View')}</button></div><div className="r-home-due-card r-home-due-card--supplier"><span><i/>{ui('Supplier Due')}</span><small>{ui('Money to pay')}</small><strong>{money(dashboard.supplier_due)}</strong><button aria-label={ui('Pay Supplier')} onClick={()=>navigate('/retail/pay-supplier')}>{ui('View')}</button></div></section>
    </>}
    <section className="r-home-galla r-card"><span className="r-ledger-icon"><Wallet size={28} aria-hidden="true"/></span><div><span>{ui('Cash in Counter (Galla)')}</span><strong>{galla?money(galla.expected_cash):ui(gallaError?'Open Daily Galla to retry':'Loading…')}</strong></div><button onClick={()=>navigate('/retail/galla')}>{ui('Check Galla')}</button></section>
    {dashboard&&<section className="r-home-attention"><h2>{ui('Needs Attention')}</h2><button onClick={()=>navigate('/retail/stock?view=low')}><span className="r-ledger-icon"><AlertTriangle size={23}/></span><span><strong>{dashboard.low_stock_count||0} {ui('Low Stock')}</strong><small>{ui('Review items to reorder')}</small></span><ChevronRight size={18}/></button><button onClick={()=>navigate('/retail/needs')}><span className="r-ledger-icon"><Package size={23}/></span><span><strong>{dashboard.needs_pending||0} {ui('Pending Needs')}</strong><small>{ui('Open your buying list')}</small></span><ChevronRight size={18}/></button></section>}
    <section className="r-home-operations" aria-labelledby="home-actions"><div className="r-home-section-title"><h2 id="home-actions">{ui('Quick Tools')}</h2><button onClick={()=>navigate('/retail/more')}>{ui('All Tools')}<ChevronRight size={18}/></button></div><div className="r-home-operation-grid" id="quick-actions">{actions.map(({id,title,desc,path,Icon})=><button id={id} key={id} onClick={()=>navigate(path)} aria-label={ui(title)}><span className="r-ledger-icon"><Icon size={23} aria-hidden="true"/></span><span><strong>{ui(title)}</strong><small>{ui(desc)}</small></span></button>)}</div></section>
    <button className="r-assistant-home-entry" onClick={()=>navigate('/retail/assistant')}><span className="r-home-ask-icon"><Mic size={24} aria-hidden="true"/></span><span><strong>{ui('Ask EVOLIX')}</strong><small>{ui('Aaj ki sale kitni hai?')}</small></span><span className="r-home-ask-action">{ui('Ask')}</span></button>
    <RetailHomeTools/>
    <details className="r-home-financial" role="region" aria-label="Authoritative profit summary"><summary>{ui('Business Summary')}<ChevronRight size={18}/></summary>{dashboard&&<LedgerMetric title={range==='TODAY'?"Today's Expenses":'Expenses in Period'} value={money(dashboard.business_expenses)} Icon={Wallet}/>}{profit&&<div className="r-card"><h2>{ui('Business profit')}</h2><div className="r-summary-pair"><p>{ui('Gross profit · known costs')}<strong>{money(profit.gross_profit)}</strong></p><p>{ui('Net business profit · known costs')}<strong>{money(profit.net_business_profit)}</strong></p></div><p className="r-caption">{ui('Product cost coverage')} {profit.cost_coverage}%. {profit.warning||ui('All posted profit lines have known costs.')}</p><button className="r-btn r-btn--outline" onClick={()=>navigate('/retail/reports/financial/profit')}>{ui('Open Profit & Loss')}</button></div>}{profitError&&<p role="alert">{ui(profitError)}</p>}</details>
  </div>;
}
