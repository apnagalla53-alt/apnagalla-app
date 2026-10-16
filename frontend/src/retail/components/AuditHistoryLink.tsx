import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { useAuthStore } from '../../shared/store/authStore';
export default function AuditHistoryLink({sourceId}:{sourceId?:string}){const user=useAuthStore(s=>s.user);return ['OWNER','ADMIN','TENANT_ADMIN'].includes(user?.role||'')||user?.permissions?.includes('settings.write')?<Link className="r-btn r-btn--outline" to={'/retail/audit'+(sourceId?'?source_id='+encodeURIComponent(sourceId):'')}><History size={18}/>Audit history</Link>:null;}
