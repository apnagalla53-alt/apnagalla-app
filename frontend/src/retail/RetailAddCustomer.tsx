import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
import { useNavigate } from 'react-router-dom';
import RetailPartyForm from './RetailPartyForm';
import { ArrowLeft } from 'lucide-react';
import './retail-entry-forms.css';
export default function RetailAddCustomer() {
  useUiLanguage();
  const navigate = useNavigate();
  return <div className="r-page-with-sticky r-entry-page"><StitchHeader className="r-page-header r-entry-header" hasBack><div className="r-entry-heading"><button type="button" className="r-back-btn" aria-label={ui("Back to Khata")} onClick={() => navigate('/retail/khata')}><ArrowLeft size={22}/></button><h1>{ui("Add Customer")}</h1></div></StitchHeader>
    <div className="r-section"><RetailPartyForm stickyActions onSaved={id => navigate('/retail/khata/' + id)} /></div></div>;
}
