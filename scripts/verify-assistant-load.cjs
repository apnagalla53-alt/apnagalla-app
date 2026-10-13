// Run against an explicitly authorized disposable tenant; token stays in environment.
const fs=require('fs'),path=require('path'),{performance}=require('node:perf_hooks');
const origin=process.env.ASSISTANT_LOAD_ORIGIN||'http://localhost:8010/api/v1';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('This local pilot load runner requires a loopback API.');
const headers={'Content-Type':'application/json',Authorization:'Bearer '+process.env.ASSISTANT_LOAD_TOKEN,'X-Company-Id':process.env.ASSISTANT_LOAD_COMPANY,'X-Branch-Id':process.env.ASSISTANT_LOAD_BRANCH,'X-Financial-Year-Id':process.env.ASSISTANT_LOAD_FY};
if(Object.values(headers).some(v=>!v||v.includes('undefined')))throw Error('Supply disposable authenticated scope through environment.');
const querySets={
  simple:['Aaj ki sale','Aaj ka galla','Maggi stock','customer Ramesh balance'],
  diagnosis:['Sale kam kyu hai?','Profit kam kyu hua?','Sale badhi lekin profit kyu gira?','Business me problem kaha hai?'],
};
const percentile=(values,p)=>{const a=[...values].sort((a,b)=>a-b);return +(a[Math.max(0,Math.ceil(a.length*p)-1)]||0).toFixed(2);};
async function main(){const scenarios=[];
  for(const [query_class,queries] of Object.entries(querySets))for(const concurrency of [10,25,50]){const latencies=[],processing=[],failures=[];const start=performance.now();
    const results=await Promise.all(Array.from({length:concurrency},async(_,i)=>{const before=performance.now();try{const response=await fetch(origin+'/assistant/query',{method:'POST',headers,body:JSON.stringify({message:queries[i%queries.length],language:'en'}),signal:AbortSignal.timeout(15000)});const body=await response.json();latencies.push(performance.now()-before);if(response.ok&&body.status==='SUCCESS'){processing.push(body.timings.total_ms);return true;}failures.push({http:response.status,status:body.status||'ERROR'});return false;}catch{latencies.push(performance.now()-before);failures.push({http:0,status:'TRANSPORT_ERROR'});return false;}}));
    const seconds=(performance.now()-start)/1000;scenarios.push({query_class,concurrency,requests:results.length,success:results.filter(Boolean).length,errors:failures.length,throughput_per_second:+(results.length/seconds).toFixed(2),http_ms:{p50:percentile(latencies,.5),p95:percentile(latencies,.95),p99:percentile(latencies,.99)},processing_ms:{p50:percentile(processing,.5),p95:percentile(processing,.95),p99:percentile(processing,.99)},failures});
  }
  const report={measured_at:new Date().toISOString(),environment:'Local Windows NestJS/PostgreSQL disposable tenant; burst sample, not a production capacity guarantee',latency_definition:'HTTP includes authentication, DB session/log persistence and local transport. Processing ends before query-log write.',scenarios};const file=process.env.ASSISTANT_LOAD_REPORT||path.resolve(__dirname,'../output/assistant-load.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(scenarios.some(s=>s.errors))process.exitCode=1;
}
main().catch(()=>{console.error('Assistant load verification failed; no credentials printed.');process.exitCode=1;});
