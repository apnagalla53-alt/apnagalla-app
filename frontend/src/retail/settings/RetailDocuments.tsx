import { formatDate } from '../../shared/dateFormat';
import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import { MobileSelect } from '../components/MobileControls';
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileImage, Download, Eye, X } from 'lucide-react';
import api, { getApiErrorMessage } from '../../shared/api';

type Document = { id: string; original_file_name: string; category: string; entity_type: string; created_at: string; file_size: number; mime_type: string };
export default function RetailDocuments() {
  useUiLanguage();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [more, setMore] = useState(false);
  const version = useRef(0);
  const load = async (append = false) => {
    const request = ++version.current; if (!append) setLoading(true); setError('');
    try {
      const response = await api.get('/attachments', { params: { search: search || undefined, category: category || undefined, limit: 50, offset: append ? documents.length : 0 } });
      const rows = Array.isArray(response.data) ? response.data : response.data.data || [];
      if (request === version.current) { setDocuments(previous => append ? [...previous, ...rows] : rows); setMore(rows.length === 50); }
    } catch (err) { if (request === version.current) setError(getApiErrorMessage(err)); }
    finally { if (request === version.current) setLoading(false); }
  };
  useEffect(() => { const timer = setTimeout(() => load(), 250); return () => { clearTimeout(timer); version.current++; }; }, [search, category]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  const open = async (document: Document, download = false) => {
    setBusy(document.id); setError('');
    try {
      const response = await api.get('/attachments/' + encodeURIComponent(document.id) + '/content', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      if (download) { const link = window.document.createElement('a'); link.href = url; link.download = document.original_file_name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 150) || 'EVOLIX-document'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      else setPreview({ url, name: document.original_file_name });
    } catch (err) { setError(getApiErrorMessage(err)); } finally { setBusy(''); }
  };
  return <><StitchHeader className="r-page-header" hasBack><button className="r-btn r-btn--icon" aria-label={ui("Back to More")} onClick={() => navigate('/retail/more')}><ArrowLeft size={22} /></button><h1>{ui("My Documents")}</h1><FileImage size={24} /></StitchHeader><main className="r-section r-account-page"><p className="r-caption">Bills and payment photos saved in this shop. Add photos from the related bill, purchase, expense or payment.</p><label htmlFor="documents-search">Search documents</label><input id="documents-search" className="r-input" placeholder="File name" value={search} onChange={event => setSearch(event.target.value)} /><label htmlFor="documents-category">Document type</label><MobileSelect id="documents-category" className="r-select" value={category} onChange={event => setCategory(event.target.value)}><option value="">All documents</option>{[['PURCHASE_BILL', 'Purchase bills'], ['SALE_PROOF', 'Sales photos'], ['EXPENSE_BILL', 'Expense bills'], ['CUSTOMER_PAYMENT_PROOF', 'Customer payment proofs'], ['SUPPLIER_PAYMENT_PROOF', 'Supplier payment proofs'], ['ITEM_IMAGE', 'Item images'], ['NEED_PHOTO', 'Need photos']].map(([value, label]) => <option key={value} value={value}>{ui(label)}</option>)}</MobileSelect>{loading && <p role="status">Loading documents…</p>}{error && <div className="r-state-message" role="alert"><p>{error}</p><button className="r-btn r-btn--outline" onClick={() => load()}>{ui("Try Again")}</button></div>}{!loading && !error && !documents.length && <div className="r-empty"><FileImage size={42} /><h2>No documents found</h2><p>Save a bill photo with your next purchase or expense.</p><button className="r-btn r-btn--primary" onClick={() => navigate('/retail/purchases/new')}>{ui("Add Purchase")}</button></div>}{documents.map(document => <article className="r-card" key={document.id}><h2>{document.original_file_name}</h2><p className="r-caption">{document.category.replaceAll('_', ' ')} · {formatDate(document.created_at)} · {Math.ceil(document.file_size / 1024)} KB</p><div className="r-form-grid"><button className="r-btn r-btn--outline" disabled={!!busy} onClick={() => open(document)}><Eye size={20} />{busy === document.id ? ui("Loading…") : 'View'}</button><button className="r-btn r-btn--outline" disabled={!!busy} onClick={() => open(document, true)}><Download size={20} />Download</button></div></article>)}{more && <button className="r-btn r-btn--outline r-btn--full" onClick={() => load(true)}>Load More Documents</button>}</main>{preview && <div className="r-document-preview" role="dialog" aria-modal="true" aria-label="Document preview" onKeyDown={event => { if (event.key === 'Escape') setPreview(null); }}><button className="r-btn r-btn--secondary" autoFocus onClick={() => setPreview(null)}><X size={22} />{ui("Close")}</button><h2>{preview.name}</h2><img src={preview.url} alt={preview.name} /></div>}</>;
}
