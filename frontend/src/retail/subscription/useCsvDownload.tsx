import { useEffect, useRef, useState } from 'react';
import { downloadCsv } from '../csv';
import { getApiErrorMessage } from '../../shared/api';
import { ui } from '../../i18n';

type Prepared={filename:string;headers:unknown[];rows:unknown[][];[key:string]:any};
export function useCsvDownload(){
  const working=useRef(false),active=useRef(true);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [download,setDownload]=useState<{filename:string;url:string;count:number}|null>(null);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>()=>{if(download)URL.revokeObjectURL(download.url);},[download]);
  const clear=()=>{setError('');setDownload(null);};
  async function start(prepare:()=>Promise<Prepared>){
    if(working.current)return null;
    working.current=true;setBusy(true);clear();
    try{const data=await prepare();if(!active.current)return null;const file=downloadCsv(data.filename,data.headers,data.rows,true);setDownload({...file,count:data.rows.length});return data;}
    catch(error){if(active.current)setError(getApiErrorMessage(error));return null;}
    finally{working.current=false;if(active.current)setBusy(false);}
  }
  return {busy,error,download,start,clear};
}
export function CsvDownloadStatus({state}:{state:ReturnType<typeof useCsvDownload>}){
  return <>{state.error&&<p role="alert">{state.error}</p>}{state.download&&<div role="status" className="r-state-message"><p>{ui('CSV prepared')}: <strong>{state.download.filename}</strong> · {state.download.count} {ui('records')}</p><p className="r-caption">{ui('The browser download was requested. If it did not start, use the link below.')}</p><a className="r-btn r-btn--outline" href={state.download.url} download={state.download.filename}>{ui('Download again')}: {state.download.filename}</a></div>}</>;
}
