import { useEffect,useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../../shared/api';
import { useAuthStore } from '../../shared/store/authStore';
export default function ReportNotificationBell(){
  const user=useAuthStore(s=>s.user),navigate=useNavigate(),[count,setCount]=useState(0);
  const allowed=['ADMIN','OWNER','TENANT_ADMIN'].includes(user?.role||'')||user?.permissions?.includes('reports.read');
  useEffect(()=>{if(!allowed)return;let active=true;const load=()=>api.get('/retail/reports/assistant/notifications').then(r=>{if(active)setCount(r.data.unread);}).catch(()=>{/* Shared API banner provides the error and retry. */});void load();const timer=setInterval(()=>{if(!document.hidden)void load();},60000);return()=>{active=false;clearInterval(timer);};},[allowed]);
  if(!allowed)return null;
  return <button className="r-btn r-btn--icon" aria-label={`Report notifications${count?' · '+count+' unread':''}`} onClick={()=>navigate('/retail/reports#report-inbox')}><Bell size={22}/>{count>0&&<span className="r-status-badge">{count}</span>}</button>;
}
