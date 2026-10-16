import { useEffect,useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import api,{getApiErrorMessage} from '../shared/api';
import StitchHeader from './design/StitchHeader';
import { formatDateTime } from '../shared/dateFormat';
export default function RetailAudit(){
  const [params]=useSearchParams(),[rows,setRows]=useState<any[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;api.get('/retail/audit',{params:{source_id:params.get('source_id')||undefined}}).then(r=>{if(active)setRows(r.data.rows);}).catch(e=>{if(active)setError(getApiErrorMessage(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[params]);
  return <><StitchHeader><h1>Audit history</h1></StitchHeader><main className="r-section">{loading&&<p role="status">Loading changes…</p>}{error&&<p role="alert">{error}</p>}{!loading&&!error&&!rows.length&&<p>No recorded changes yet.</p>}{rows.map(row=>{let details:any;try{details=JSON.parse(row.details||'null');}catch{details=null;}return <article key={row.id} className="r-card"><strong>{row.action.replaceAll('_',' ')}</strong>{row.source_document_type?.startsWith('SALES_INVOICE')&&row.source_document_id&&<p><Link to={'/retail/bills/'+row.source_document_id}>Open original bill</Link></p>}<p>{formatDateTime(row.created_at)} · {row.user.display_name} ({row.user.username})</p>{details?.editor_name&&<p>Entered name: {details.editor_name}</p>}{details?.reason&&<p>Reason: {details.reason}</p>}{details?<details><summary>Change details</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(details,null,2)}</pre></details>:<p>{row.details}</p>}</article>;})}</main></>;
}
