import { ui, useUiLanguage } from "../../i18n";
import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { readReport } from '../reports/reportReads';
import { useAuthStore } from '../../shared/store/authStore';
export default function RetailHomeTools(){
  useUiLanguage();
  const [calendar,setCalendar]=useState<any>(null),[error,setError]=useState(false);
  const user=useAuthStore(s=>s.user),tenant=useAuthStore(s=>s.tenantContext);
  const allowed=['OWNER','ADMIN','TENANT_ADMIN'].includes(user?.role||'')||!!user?.permissions?.includes('accounting.read');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  useEffect(()=>{let active=true;setCalendar(null);setError(false);if(allowed)readReport('/retail/calendar',{month:today.slice(0,7)}).then(r=>{if(active)setCalendar(r.data);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[today,allowed,tenant?.company_id,tenant?.branch_id]);
  const visits=calendar?.visits.filter((r:any)=>r.date===today)||[],dues=calendar?.receivables.filter((r:any)=>r.due_date.slice(0,10)===today)||[],tasks=calendar?.tasks.filter((r:any)=>r.date.slice(0,10)===today&&!r.completed)||[];
  const credit=calendar?.credit_sales?.filter((r:any)=>r.date.slice(0,10)===today)||[];
  if(!allowed)return null;
  return <section className="r-section"><Link className="r-home-calendar r-card" to="/retail/calendar"><CalendarDays size={28}/><span><strong>Today's Calendar</strong><small>{error?'Open Calendar to retry':!calendar?'Loading visits and reminders…':`${credit.length} Udhar bills · ${visits.length} supplier visits · ${dues.length} dues to collect · ${tasks.length} tasks`}</small></span></Link>
    {visits.length>0&&<div className="r-card"><h2>Supplier visits today</h2>{visits.slice(0,3).map((r:any)=><p key={r.id}><Link to={'/retail/suppliers/'+r.party_id}>{ui(r.title)}</Link></p>)}</div>}
  </section>;
}
