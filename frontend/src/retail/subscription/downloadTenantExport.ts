import api from '../../shared/api';
import {downloadCsv} from '../csv';
/** The server generates and authorizes datasets; browser CSV escaping neutralizes formulas. */
export async function downloadTenantExport(kind:string,filters:Record<string,unknown>={}) {
  try {
    const {data}=await api.get('/retail/account/exports/'+kind,{params:{...filters,limit:1000}});
    downloadCsv('EVOLIX-'+kind.toLowerCase()+'-page.csv',data.headers,data.rows);
    return data;
  } catch(error:any) {
    if(error.response?.data?.code==='FEATURE_NOT_ENTITLED')window.dispatchEvent(new CustomEvent('evolix-upgrade-required',{detail:error.response.data.required_plan||'SMART'}));
    // Shared API error state shows other failures; no unhandled click promise.
    return null;
  }
}
