import DateInput from '../shared/components/DateInput';
import { readWorkflowDraft,useWorkflowDraft } from './experience/workflowDraft';
import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
import { MobileSelect } from './components/MobileControls';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Wallet, CalendarDays, IndianRupee } from 'lucide-react';
import api, { getApiErrorMessage } from '../shared/api';
import { AttachmentPicker } from '../shared/components/AttachmentPicker';
import { useOptionalPhotoUpload } from '../shared/useOptionalPhotoUpload';
import { expenseApi } from './retailApi';

import RetailFormSection from './components/RetailFormSection';
import PaymentChoices from './components/PaymentChoices';

const RetailAddExpense = () => {
  useUiLanguage();
  const navigate = useNavigate(); const [params]=useSearchParams();
  const [seed]=useState(()=>readWorkflowDraft<any>('expense'));
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [formData, setFormData] = useState<Record<string,string>>(seed?.formData||{
    type: params.get('type')==='OWNER_WITHDRAWAL'?'OWNER_WITHDRAWAL':'BUSINESS_EXPENSE',
    category_id: '',
    amount: '',
    payment_method: 'CASH',
    date: new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Kolkata'}),
    note: ''
    , paid_to: '', bill_number: ''
  });

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const photoUpload = useOptionalPhotoUpload('expense');
  const [savedId,setSavedId]=useState(seed?.savedId||'');
  const [error,setError]=useState('');const draft=useWorkflowDraft('expense',{formData,savedId});

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(()=>{setFormData(p=>({...p,type:params.get('type')==='OWNER_WITHDRAWAL'?'OWNER_WITHDRAWAL':'BUSINESS_EXPENSE'}));},[params]);
  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const res = await expenseApi.getCategories();
      setCategories(res.data || []);
      if (res.data?.length > 0 && !formData.category_id) {
        setFormData(prev => ({ ...prev, category_id: res.data[0].id }));
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally { setLoadingCategories(false); }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName) return;
    try {
      await expenseApi.createCategory({ name: newCategoryName });
      setNewCategoryName('');
      setShowAddCategory(false);
      await fetchCategories();
    } catch (err: any) {
      setError(getApiErrorMessage(err));
    }
  };

  const initializeDefaults = async () => {
    setLoadingCategories(true); setError('');
    try { await api.post('/retail/expense-categories/initialize-defaults'); await fetchCategories(); }
    catch (err) { setError(getApiErrorMessage(err)); }
    finally { setLoadingCategories(false); }
  };

  const handleSubmit = async () => {
    if(loading)return;
    if (!formData.amount || Number(formData.amount) <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (formData.type === 'BUSINESS_EXPENSE' && !formData.category_id) {
      setError('Choose an expense category first.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      let id=savedId;
      if (!id) { const saved=await expenseApi.createExpense({
        ...formData,
        amount: Number(formData.amount)
      }); id=saved.data.id;setSavedId(id); }
      await photoUpload.upload('EXPENSE', id, 'EXPENSE_BILL');
      draft.clear();
      navigate('/retail/expenses');
    } catch (err: any) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="r-screen r-expense-form">
      <StitchHeader className="r-page-header" hasBack>
        <button className="r-btn r-btn--icon" aria-label="Back to Expenses" onClick={()=>navigate('/retail/expenses')}><ArrowLeft size={24}/></button>
        <h1>{ui("Add Expense")}</h1><span className="r-header-spacer"/>
      </StitchHeader>
      <div className="r-content">
        <p className="r-module-intro">Keep a clear record of money leaving your shop.</p>
        {error&&<p className="r-state-message" role="alert">{photoUpload.failed?'Expense saved; photo upload needs retry. ':''}{error}</p>}
        <fieldset className="r-fieldset" disabled={loading||!!savedId}>
          <div className="r-segmented" role="group" aria-label="Expense type">
            <button className={formData.type==='BUSINESS_EXPENSE'?'active':''} aria-pressed={formData.type==='BUSINESS_EXPENSE'} onClick={()=>setFormData({...formData,type:'BUSINESS_EXPENSE'})}>Shop Expense</button>
            <button className={formData.type==='OWNER_WITHDRAWAL'?'active':''} aria-pressed={formData.type==='OWNER_WITHDRAWAL'} onClick={()=>setFormData({...formData,type:'OWNER_WITHDRAWAL'})}>Owner Took Money</button>
          </div>
          <RetailFormSection title={formData.type==='OWNER_WITHDRAWAL'?'Money taken by owner':'Expense details'} description={formData.type==='OWNER_WITHDRAWAL'?'Personal withdrawals stay separate from business expenses.':'Choose what you paid for and enter the amount.'} Icon={IndianRupee}>
            {loadingCategories&&<p role="status">Loading expense categories…</p>}
            {formData.type==='BUSINESS_EXPENSE'&&<div className="r-form-group">
              <label className="r-label" htmlFor="expense-category">{ui("Category")} *</label>
              <div className="r-category-entry"><MobileSelect id="expense-category" className="r-input" value={formData.category_id} onChange={e=>setFormData({...formData,category_id:e.target.value})}><option value="">Select Category...</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</MobileSelect><button className="r-btn r-btn--outline" aria-label="Add expense category" aria-expanded={showAddCategory} aria-controls="new-expense-category" onClick={()=>setShowAddCategory(!showAddCategory)}><Plus size={20}/>{ui('Add Category')}</button></div>
              {!loadingCategories && !categories.length && <div className="r-state-message"><p>{ui('No expense categories yet.')}</p><button className="r-btn r-btn--outline" onClick={initializeDefaults}>{ui('Use default categories')}</button></div>}
              {showAddCategory&&<div id="new-expense-category" className="r-form-group"><label className="r-label" htmlFor="new-category-name">New Category Name</label><div className="r-category-entry"><input id="new-category-name" className="r-input" placeholder="New Category Name" value={newCategoryName} onChange={e=>setNewCategoryName(e.target.value)}/><button className="r-btn r-btn--primary" onClick={handleCreateCategory}>{ui("Save")}</button></div></div>}
            </div>}
          </RetailFormSection>
          <RetailFormSection title={ui('Amount (₹)')} Icon={IndianRupee}>
            <div className="r-form-group"><label className="r-label r-visually-hidden" htmlFor="expense-amount">{ui("Amount (₹)")}</label><input id="expense-amount" className="r-input r-currency-input" type="number" inputMode="decimal" min="0.01" step="any" placeholder="0.00" value={formData.amount} onChange={e=>setFormData({...formData,amount:e.target.value})} required/></div>
            <div className="r-stitch-amount-shortcuts">{[100,200,500,1000].map(v=><button key={v} type="button" className="r-btn r-btn--outline" onClick={()=>setFormData({...formData,amount:String(Number(formData.amount||0)+v)})}>+₹{v.toLocaleString('en-IN')}</button>)}</div>
          </RetailFormSection>
          <RetailFormSection title={ui('Date')} Icon={CalendarDays}>
            <div className="r-form-group"><label className="r-label r-visually-hidden" htmlFor="expense-date">{ui("Date")}</label><DateInput id="expense-date" className="r-input" type="date" value={formData.date} onChange={e=>setFormData({...formData,date:e.target.value})} lang="en-GB"/></div>
          </RetailFormSection>
          <RetailFormSection title={ui("Payment")} description="Select how the money was paid out." Icon={Wallet}>
            <PaymentChoices id="expense-payment-method" value={formData.payment_method} onChange={value=>setFormData({...formData,payment_method:value})}/>
          </RetailFormSection>
          <details className="r-card"><summary>{ui('More Details / Bill & Receipt')}</summary>
            <div className="r-form-group"><label className="r-label" htmlFor="expense-paid-to">Paid To (optional)</label><input id="expense-paid-to" className="r-input" placeholder="Person or business name" value={formData.paid_to} onChange={e=>setFormData({...formData,paid_to:e.target.value})}/></div>
            <div className="r-form-group"><label className="r-label" htmlFor="expense-note">Note (Optional)</label><input id="expense-note" className="r-input" placeholder="What was this for?" value={formData.note} onChange={e=>setFormData({...formData,note:e.target.value})}/></div>
            <div className="r-form-group"><label className="r-label" htmlFor="expense-bill-number">Bill Number (optional)</label><input id="expense-bill-number" className="r-input" placeholder="Supplier bill or reference" value={formData.bill_number} onChange={e=>setFormData({...formData,bill_number:e.target.value})}/></div>
            <AttachmentPicker onFileSelect={photoUpload.select}/>
          </details>
        </fieldset>
        <p className="r-caption r-stitch-ledger-note">{ui('Shop expenses and owner withdrawals stay separate. Saving updates the recorded money movement.')}</p>
        {photoUpload.failed&&<button className="r-btn" onClick={()=>{photoUpload.select(null);draft.clear();navigate('/retail/expenses');}}>Continue without photo</button>}
      </div>
      <div className="r-bottom-action"><button className="r-btn r-btn--primary r-btn--full" onClick={handleSubmit} disabled={loading}>{loading?'Saving...':photoUpload.failed?ui("Retry Photo Upload"):ui("Save Expense")}</button></div>
    </div>
  );
};

export default RetailAddExpense;
