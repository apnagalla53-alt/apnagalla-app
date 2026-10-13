import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
import { FilterSheet, SearchField, MobileSelect } from './components/MobileControls';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Receipt, SlidersHorizontal } from 'lucide-react';
import { expenseApi } from './retailApi';
import { getApiErrorMessage } from '../shared/api';

export default function RetailExpenses() {
  useUiLanguage();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [type, setType] = useState('BUSINESS_EXPENSE');
  const [categories, setCategories] = useState<any[]>([]);
  const [category, setCategory] = useState('');
  const [filterOpen,setFilterOpen]=useState(false),[draft,setDraft]=useState({category:'',from:'',to:''});
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestVersion = useRef(0);
  const params = { type, category_id: category || undefined, startDate: from || undefined, endDate: to ? to + 'T23:59:59.999Z' : undefined, limit: 50 };
  const load = async () => {
    const version = ++requestVersion.current; setLoading(true); setError('');
    try {
      const [list, totals, categoryList] = await Promise.all([expenseApi.getExpenses(params), expenseApi.getSummary(), expenseApi.getCategories()]);
      if (version !== requestVersion.current) return;
      setExpenses(list.data?.data || []); setTotal(list.data?.total || 0); setSummary(totals.data); setCategories(categoryList.data || []);
    } catch (err) { if (version === requestVersion.current) setError(getApiErrorMessage(err)); }
    finally { if (version === requestVersion.current) setLoading(false); }
  };
  useEffect(() => { load(); return () => { requestVersion.current++; }; }, [type, category, from, to]);
  const loadMore = async () => {
    const version = requestVersion.current; setLoadingMore(true);
    try { const response = await expenseApi.getExpenses({ ...params, offset: expenses.length }); if (version === requestVersion.current) setExpenses(previous => [...previous, ...(response.data?.data || [])]); }
    catch (err) { setError(getApiErrorMessage(err)); } finally { setLoadingMore(false); }
  };
  const cancel = async (id: string) => {
    if (!window.confirm('Cancel this expense? The original payment will be reversed.')) return;
    try { await expenseApi.cancelExpense(id); await load(); } catch (err) { setError(getApiErrorMessage(err)); }
  };
  const visible = expenses.filter(expense => [expense.note, expense.paid_to, expense.category?.name].some(value => String(value || '').toLowerCase().includes(search.toLowerCase())));
  const ownerSubtotal = expenses.filter(expense => expense.status === 'POSTED').reduce((sum, expense) => sum + Number(expense.amount), 0);
  return <div className="r-screen r-expenses-screen">
    <StitchHeader className="r-page-header" hasBack><button className="r-btn r-btn--icon" aria-label={ui("Back to Home")} onClick={() => navigate('/retail/home')}><ArrowLeft size={24} /></button><h1>{ui("Expenses")}</h1><span className="r-header-spacer" /></StitchHeader>
    <main className="r-content">
      <p className="r-module-intro">Track everyday spending and money taken by the owner.</p>
      <div className="r-segmented" role="group" aria-label="Expense history type"><button className={type === 'BUSINESS_EXPENSE' ? 'active' : ''} aria-pressed={type === 'BUSINESS_EXPENSE'} onClick={() => { setType('BUSINESS_EXPENSE'); setCategory(''); }}>{ui("Business Expenses")}</button><button className={type === 'OWNER_WITHDRAWAL' ? 'active' : ''} aria-pressed={type === 'OWNER_WITHDRAWAL'} onClick={() => { setType('OWNER_WITHDRAWAL'); setCategory(''); }}>{ui("Owner Withdrawals")}</button></div>
      {summary && type === 'BUSINESS_EXPENSE' && <div className="r-card r-stitch-expense-summary"><span className="r-caption">{ui('This Month')}</span><strong>₹{Number(summary.month_business_expenses||0).toLocaleString('en-IN')}</strong><p className="r-caption">{ui("Today's Expenses")}: ₹{Number(summary.today_business_expenses||0).toLocaleString('en-IN')}</p></div>}
      {type === 'OWNER_WITHDRAWAL' && !loading && <div className="r-card"><span className="r-caption">Owner Money Taken · Loaded Records</span><div className="r-card-value">₹{ownerSubtotal.toLocaleString('en-IN')}</div><p className="r-caption">Subtotal of the {expenses.length} loaded records. Expense Report has the full period summary.</p></div>}
      <div className="r-stitch-expense-add"><button className="r-btn r-btn--primary r-btn--full" onClick={() => navigate('/retail/expenses/add')}><Plus size={20} />Record Expense</button></div><div className="r-search-filter"><SearchField id="expenses-search" label="Search loaded expenses" placeholder="Note, category or paid to" value={search} onChange={setSearch}/><button className="r-btn r-btn--outline" aria-label="Filter expenses" onClick={()=>{setDraft({category,from,to});setFilterOpen(true);}}><SlidersHorizontal size={22}/>{[category,from,to].filter(Boolean).length||''}</button></div><FilterSheet open={filterOpen} onClose={()=>setFilterOpen(false)} count={[category,from,to].filter(Boolean).length} onClear={()=>{setDraft({category:'',from:'',to:''});setCategory('');setFrom('');setTo('');}} onApply={()=>{setCategory(draft.category);setFrom(draft.from);setTo(draft.to);}}><div className="r-form-grid"><div><label htmlFor="expenses-from">From date</label><input id="expenses-from" className="r-input" type="date" value={draft.from} onChange={event => setDraft({...draft,from:event.target.value})} /></div><div><label htmlFor="expenses-to">To date</label><input id="expenses-to" className="r-input" type="date" value={draft.to} onChange={event => setDraft({...draft,to:event.target.value})} /></div></div>{type === 'BUSINESS_EXPENSE' && <><label htmlFor="expenses-category">{ui("Category")}</label><MobileSelect id="expenses-category" className="r-select" value={draft.category} onChange={event => setDraft({...draft,category:event.target.value})}><option value="">All categories</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</MobileSelect></>}</FilterSheet>
      {error && <div className="r-state-message" role="alert"><p>{error}</p><button className="r-btn r-btn--outline" onClick={load}>Retry expenses</button></div>}
      <div className="r-history-heading"><h2>{type==='OWNER_WITHDRAWAL'?'Withdrawal history':'Expense history'}</h2><span className="r-caption">{loading?ui("Loading…"):`${visible.length} shown`}</span></div>
      {loading ? <div className="r-state-message" role="status">Loading expenses…</div> : error ? null : !visible.length ? <div className="r-empty"><Receipt size={42} /><h2>{search ? 'No matching expenses' : type === 'OWNER_WITHDRAWAL' ? 'No owner withdrawals yet' : 'No expenses yet'}</h2><p>Record money paid out of your shop so your cash stays clear.</p><button className="r-btn r-btn--primary" onClick={() => navigate('/retail/expenses/add')}>{ui("Add Expense")}</button></div> : <div className="r-list r-expense-history-list">{visible.map(expense => <article key={expense.id} className="r-list-item" style={{ opacity: expense.status === 'CANCELLED' ? .65 : 1 }}><div className="r-list-item-content"><div className="r-list-item-title">{expense.type === 'OWNER_WITHDRAWAL' ? ui("Owner Withdrawal") : expense.category?.name || 'Expense'}{expense.status === 'CANCELLED' && ' (Cancelled)'}</div><div className="r-list-item-subtitle">{new Date(expense.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {expense.payment_method}</div>{expense.note && <div className="r-list-item-subtitle">{expense.note}</div>}{expense.paid_to&&<div className="r-list-item-subtitle">Paid to {expense.paid_to}</div>}</div><div className="r-list-item-right"><div className="r-list-item-value r-text-danger">₹{Number(expense.amount).toLocaleString('en-IN')}</div>{expense.status === 'POSTED' && <button className="r-btn r-btn--icon" aria-label={'Cancel ' + (expense.category?.name || 'expense')} onClick={() => cancel(expense.id)}><Trash2 size={18} /></button>}</div></article>)}</div>}
      {!loading && expenses.length < total && <button className="r-btn r-btn--outline r-btn--full" disabled={loadingMore} onClick={loadMore}>{loadingMore ? ui("Loading…") : 'Load More Expenses'}</button>}
      {!loading && total > 0 && <p className="r-caption">{expenses.length} of {total} records loaded</p>}
    </main>
  </div>;
}
