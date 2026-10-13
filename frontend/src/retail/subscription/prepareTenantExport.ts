import api from '../../shared/api';

export async function prepareTenantExport(kind:string,filters:Record<string,unknown>={},allPages=false){
  let offset=Number(filters.offset)||0;
  let headers:string[]|undefined;
  const rows:unknown[][]=[];
  let last:any;
  for(;;){
    const {data}=await api.get('/retail/account/exports/'+kind,{params:{...filters,offset,limit:1000}});
    if(!Array.isArray(data.headers)||!Array.isArray(data.rows))throw Error('Invalid export response');
    if(!headers)headers=data.headers;
    else if(data.rows.length&&JSON.stringify(headers)!==JSON.stringify(data.headers))throw Error('Export columns changed');
    rows.push(...data.rows);last=data;
    if(!allPages||!data.hasMore)break;
    if(!Number.isInteger(data.nextOffset)||data.nextOffset<=offset)throw Error('Invalid export pagination');
    offset=data.nextOffset;
  }
  return {...last,headers:headers||[],rows,filename:'EVOLIX-'+kind.toLowerCase()+(allPages?'':'-'+(Number(filters.offset||0)+1))+'.csv'};
}
