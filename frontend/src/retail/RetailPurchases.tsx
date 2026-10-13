import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ShoppingCart, Wallet, Image, ChevronDown, Search } from 'lucide-react';
import { purchaseApi, type RetailPurchase } from './retailApi';
import { AttachmentPicker } from '../shared/components/AttachmentPicker';
import { getApiErrorMessage } from '../shared/api';
import './retail-compact-lists.css';

export default function RetailPurchases() {
  useUiLanguage();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<RetailPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [canLoadMore, setCanLoadMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const version = useRef(0);
  const loadPurchases = async (append = false) => {
    const request = ++version.current;
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const response = await purchaseApi.getPurchases({ search: search || undefined, offset: append ? purchases.length : 0, limit: 50 });
      if (request !== version.current) return;
      setPurchases(previous => append ? [...previous, ...response.data.data] : response.data.data); setCanLoadMore(response.data.data.length === 50);
    } catch (err) { if (request === version.current) setError(getApiErrorMessage(err)); }
    finally { if (request === version.current) { setLoading(false); setLoadingMore(false); } }
  };
  useEffect(() => { const timer = setTimeout(() => loadPurchases(), 250); return () => { clearTimeout(timer); version.current++; }; }, [search]);
  return <>
    <StitchHeader className="r-page-header" hasBack><button className="r-btn r-btn--icon" aria-label={ui("Back to Home")} onClick={() => navigate('/retail/home')}><ArrowLeft size={24} /></button><h1>{ui("Purchases")}</h1><span className="r-header-spacer" /></StitchHeader>
    <main className="r-section">
      <div className="r-form-grid"><button className="r-btn r-btn--primary" onClick={() => navigate('/retail/purchases/new')}><Plus size={20} />{ui("Add Purchase")}</button><button className="r-btn r-btn--outline" onClick={() => navigate('/retail/suppliers')}><Wallet size={20} />{ui("Make Payment")}</button></div>
      <p className="r-caption">Bought stock? Add a purchase. Paying an old bill? Open the supplier and choose Pay.</p>
      <div className="r-section-heading"><h2>{ui("Purchase History")}</h2></div>
      <label className="r-search-label" htmlFor="purchase-history-search"><Search size={18} /> Search bills or supplier</label><input id="purchase-history-search" className="r-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Supplier or bill number" />
      {loading && <div className="r-state-message" role="status">Loading purchases…</div>}
      {error && <div className="r-state-message" role="alert"><p>{error}</p><button className="r-btn r-btn--outline" onClick={() => loadPurchases()}>{ui("Try Again")}</button></div>}
      {!loading && !error && !purchases.length && <div className="r-empty"><ShoppingCart size={44} /><h2>{search ? 'No matching purchases' : 'No purchases yet'}</h2><p>Record supplier bills and receive items into your shop.</p><button className="r-btn r-btn--primary" onClick={() => navigate('/retail/purchases/new')}>{ui("Add Purchase")}</button></div>}
      <div className="r-purchase-history r-purchase-history--compact">{purchases.map(purchase => {
        const expanded = expandedId === purchase.id;
        const supplierName = purchase.party?.name || 'Supplier';
        return <article key={purchase.id} className="r-card">
          <button className="r-purchase-row item-card" aria-expanded={expanded} aria-controls={'purchase-details-' + purchase.id} onClick={() => setExpandedId(expanded ? null : purchase.id)}>
            <span className="item-info">
              <span className="item-name" title={supplierName}>{supplierName}</span>
              <span className="r-caption r-purchase-reference"><span>{new Date(purchase.document_date).toLocaleDateString('en-IN')}</span><span aria-hidden="true">·</span><span title={purchase.document_number}>{purchase.document_number}</span></span>
              {purchase.attachment && <span className="r-caption r-purchase-photo"><Image size={14} />{ui("Bill photo attached")}</span>}
            </span>
            <span className="r-list-item-right">
              <strong>₹{Number(purchase.grand_total).toLocaleString('en-IN')}</strong>
              <span className="r-purchase-state"><span className={'r-status-badge ' + (Number(purchase.outstanding_amount) <= 0 ? 'is-enabled' : '')}>{Number(purchase.outstanding_amount) > 0 ? '₹' + Number(purchase.outstanding_amount).toLocaleString('en-IN') + ' Due' : ui("Paid")}</span><ChevronDown size={16} className={expanded ? 'is-expanded' : ''} /></span>
            </span>
          </button>
          {expanded && <div className="r-purchase-details" id={'purchase-details-' + purchase.id}>
            <dl className="r-purchase-identifiers"><div><dt>{ui("Supplier")}</dt><dd>{supplierName}</dd></div><div><dt>Bill number</dt><dd>{purchase.document_number}</dd></div></dl>
            <button className="r-btn r-btn--outline r-btn--full" onClick={() => navigate('/retail/suppliers/' + purchase.party.id)}>Open Supplier Account</button>
            <AttachmentPicker existingAttachmentUrl={purchase.attachment ? `/api/v1/attachments/${purchase.attachment.id}/content` : undefined} uploadImmediately={{ entityType: 'PURCHASE', entityId: purchase.id, category: 'PURCHASE_BILL' }} onUploadSuccess={() => loadPurchases()} onRemove={() => loadPurchases()} />
          </div>}
        </article>;
      })}</div>
      {canLoadMore && <button className="r-btn r-btn--outline r-btn--full" disabled={loadingMore} onClick={() => loadPurchases(true)}>{loadingMore ? ui("Loading…") : 'Load More Purchases'}</button>}
    </main>
  </>;
}
