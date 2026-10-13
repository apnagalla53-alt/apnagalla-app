import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle, MessageCircle, ShieldCheck } from 'lucide-react';

export default function RetailHelp() {
  useUiLanguage();
  const navigate = useNavigate();
  const guides = [
    { question: 'How do I make a bill?', answer: 'Tap Bill at the bottom. Find an item, set its quantity, then tap Pay. Choose Cash, UPI, Udhar or Split and confirm only after checking the payment.', to: '/retail/bill', action: 'Make a Bill' },
    { question: 'A customer paid old udhar. What do I do?', answer: 'Use Customer Paid Me on Home. Select the customer and record the amount you actually received. This reduces their old due.', to: '/retail/receive-payment', action: 'Receive Payment' },
    { question: 'How much cash should be in my counter?', answer: 'Daily Galla separates cash from UPI and card money. Add opening cash and an actual cash count to check the difference. Counting cash does not create an accounting entry.', to: '/retail/galla', action: 'Open Daily Galla' },
    { question: 'How do I add new stock?', answer: 'Add the item first. Then use Purchase, select the supplier, and enter the items and quantities you received. Quick Bill Record saves a supplier bill without adding item stock.', to: '/retail/purchases/new', action: 'Buy Stock' },
    { question: 'Does scanning a UPI QR confirm payment?', answer: 'No. Check that money arrived in your UPI or bank app before you confirm the payment in EVOLIX.', to: '/retail/more/payments', action: 'UPI & Payments' },
    { question: 'What if the internet stops while saving?', answer: 'Keep the screen open and retry the same action when your connection returns. EVOLIX protects supported payment and billing retries from duplicate posting. Full offline billing is not available.', to: '/retail/bills', action: 'Check Bill History' },
  ];
  return <><StitchHeader className="r-page-header" hasBack><button className="r-btn r-btn--icon" aria-label={ui("Back to More")} onClick={() => navigate('/retail/more')}><ArrowLeft size={22} /></button><h1>{ui("Help & Support")}</h1><HelpCircle size={24} /></StitchHeader><main className="r-section r-account-page"><div className="r-card"><h2>Let's make shop work easier</h2><p>Find a quick answer below, or contact EVOLIX support for your account.</p><Link className="r-btn r-btn--primary r-btn--full" to="/support"><MessageCircle size={20} />Contact Support</Link></div>{guides.map(guide => <details className="r-card r-help-detail" key={guide.question}><summary>{guide.question}</summary><p>{guide.answer}</p><Link className="r-btn r-btn--outline" to={guide.to}>{guide.action}</Link></details>)}<div className="r-card"><h2><ShieldCheck size={22} /> Your account & data</h2><div className="r-form-grid"><Link className="r-btn r-btn--outline" to="/privacy">{ui("Privacy")}</Link><Link className="r-btn r-btn--outline" to="/terms">{ui("Terms")}</Link><Link className="r-btn r-btn--outline" to="/delete-account">Account deletion</Link></div></div></main></>;
}
