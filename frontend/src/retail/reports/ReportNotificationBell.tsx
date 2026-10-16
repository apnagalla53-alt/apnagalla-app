import { formatDateTime } from '../../shared/dateFormat';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, CheckCheck, Volume2, CircleCheck, TriangleAlert, CircleAlert, Info } from 'lucide-react';
import api, { getApiErrorMessage } from '../../shared/api';
import { useAuthStore } from '../../shared/store/authStore';
import { Sheet } from '../components/MobileControls';

type Alert={id:string;title:string;body:string;path:string;at:string;tone?:Tone};
type Tone='success'|'danger'|'warning'|'info';
const removedUpdates=new Set(['Item removed','Item archived','Item permanently deleted','Supplier removed','Customer removed','Staff access disabled']);
const warningUpdates=new Set(['Stock adjustment reversed','Staff password reset']);
function notificationTone(row:Alert):Tone {
  if(row.tone&&['success','danger','warning','info'].includes(row.tone))return row.tone;
  if(row.id.startsWith('update:'))return removedUpdates.has(row.body)?'danger':warningUpdates.has(row.body)?'warning':'success';
  if(row.id.startsWith('due-')||row.id.startsWith('task-'))return 'warning';
  if(row.id.startsWith('need:')&&row.body.endsWith(' · Cancelled'))return 'warning';
  return row.id.startsWith('report:')?'info':'success';
}
const toneIcons={success:CircleCheck,danger:CircleAlert,warning:TriangleAlert,info:Info};
type Preferences={enabled:boolean;sound:boolean;read:string[];delivered:string[];dismissed:boolean};
const initial:Preferences={enabled:false,sound:true,read:[],delivered:[],dismissed:false};
function readPreferences(key:string):Preferences {
  try {const p=JSON.parse(localStorage.getItem(key)||'null');return {...initial,...p,read:Array.isArray(p?.read)?p.read:[],delivered:Array.isArray(p?.delivered)?p.delivered:[]};}catch{return initial;}
}
export default function ReportNotificationBell() {
  const user=useAuthStore(s=>s.user),tenant=useAuthStore(s=>s.tenantContext),navigate=useNavigate();
  const location=useLocation();
  const key=`evolix-notifications:${user?.id}:${tenant?.company_id}:${tenant?.branch_id}`;
  const [prefs,setPrefs]=useState<Preferences>(()=>readPreferences(key)),preferences=useRef(prefs);
  const [rows,setRows]=useState<Alert[]>([]),[open,setOpen]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [layer,setLayer]=useState<HTMLElement|null>(null);
  useEffect(()=>{setLayer(document.querySelector('.r-shell'));},[]);
  const [permission,setPermission]=useState<NotificationPermission|'unsupported'>(()=>'Notification' in window?Notification.permission:'unsupported');
  const [toast,setToast]=useState<Alert|null>(null),audio=useRef<AudioContext|null>(null);
  const worker=useRef<Promise<ServiceWorkerRegistration|null>|null>(null);
  const notificationWorker=()=>{
    worker.current ||= 'serviceWorker' in navigator ? navigator.serviceWorker.register('/shop-notifications-sw.js').then(()=>navigator.serviceWorker.ready).catch(()=>null) : Promise.resolve(null);
    return worker.current;
  };
  const beep=async()=>{
    try {
      audio.current ||= new AudioContext();await audio.current.resume();
      const oscillator=audio.current.createOscillator(),gain=audio.current.createGain(),now=audio.current.currentTime;
      oscillator.connect(gain);gain.connect(audio.current.destination);oscillator.frequency.value=740;
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.12,now+.02);gain.gain.exponentialRampToValueAtTime(.0001,now+.25);
      oscillator.start(now);oscillator.stop(now+.26);
    } catch { /* Silent when this browser/device blocks audio. */ }
  };
  const save=(next:Preferences)=>{preferences.current=next;setPrefs(next);try{localStorage.setItem(key,JSON.stringify(next));}catch{/* Current tab still works without persistent storage. */}};
  useEffect(()=>{setPrefs(readPreferences(key));preferences.current=readPreferences(key);setRows([]);setToast(null);setOpen(false);},[key]);
  useEffect(()=>{
    if(!user||!tenant?.company_id||!tenant.branch_id)return;
    let active=true,first=true,inFlight=false,timer:number|undefined;
    const load=async()=>{
      if(inFlight||document.visibilityState==='hidden')return;inFlight=true;
      try {
        const result=await api.get('/retail/account/notifications');if(!active)return;
        const alerts:Alert[]=result.data.rows;setRows(alerts);setError('');
        const current=preferences.current,fresh=alerts.filter(r=>!current.delivered.includes(r.id));
        save({...current,delivered:[...new Set([...alerts.map(r=>r.id),...current.delivered])].slice(0,500)});
        // Do not replay old activity when a shop opens or a session is restored.
        if(!first&&fresh.length){
          if(current.enabled)setToast(fresh[0]);
          if(current.enabled&&current.sound)void beep();
          if(current.enabled&&'Notification' in window&&Notification.permission==='granted'&&document.hidden){
            void notificationWorker().then(registration=>{
              if(!active)return;
              const title=fresh.length===1?fresh[0].title:`${fresh.length} new shop updates`,options={body:'Open Apna Galla to view your shop updates.',icon:'/brand/apna-galla-app-192.png',badge:'/brand/apna-galla-favicon-32.png',tag:'evolix-shop-updates',data:{path:fresh[0].path}};
              if(registration)void registration.showNotification(title,options).catch(()=>{});
              else try {const notification=new Notification(title,options);notification.onclick=()=>{notification.close();window.focus();navigate(fresh[0].path);};}catch{/* The in-app inbox remains available. */}
            });
          }
        }
        first=false;
      }catch(e){if(active)setError(getApiErrorMessage(e));}finally{inFlight=false;if(active)setLoading(false);}
    };
    setLoading(true);void load();
    const changed=()=>{if(timer)clearTimeout(timer);timer=window.setTimeout(()=>void load(),500);};
    const focused=()=>void load();
    const poll=window.setInterval(()=>void load(),30000);
    window.addEventListener('evolix-data-changed',changed);window.addEventListener('focus',focused);document.addEventListener('visibilitychange',focused);
    return()=>{active=false;clearInterval(poll);clearTimeout(timer);window.removeEventListener('evolix-data-changed',changed);window.removeEventListener('focus',focused);document.removeEventListener('visibilitychange',focused);};
  },[key,user?.id,tenant?.company_id,tenant?.branch_id]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),6000);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>()=>{void audio.current?.close();},[]);
  const enable=async()=>{
    // Permission and audio unlock both originate in a deliberate button tap.
    if(preferences.current.sound)void beep();
    let status:NotificationPermission|'unsupported'='unsupported';
    if('Notification' in window){try{status=await Notification.requestPermission();}catch{status=Notification.permission;}}
    setPermission(status);save({...preferences.current,enabled:true,dismissed:true});
    if(status==='granted')void notificationWorker();
  };
  const unread=rows.filter(row=>!prefs.read.includes(row.id)).length;
  const toastTone=toast?notificationTone(toast):'info',ToastIcon=toneIcons[toastTone];
  const visit=(row:Alert)=>{save({...preferences.current,read:[...new Set([...preferences.current.read,row.id])].slice(-500)});setOpen(false);setToast(null);navigate(row.path);};
  return <>
    <button className="r-btn r-btn--icon r-notification-trigger" aria-label={`Shop notifications${unread?' · '+unread+' unread':''}`} onClick={()=>setOpen(true)}><Bell size={28}/>{unread>0&&<span className="r-notification-count" aria-hidden="true">{Math.min(unread,99)}</span>}</button>
    {layer&&createPortal(<>
    {!prefs.dismissed&&tenant?.company_id&&location.pathname==='/retail/home'&&<aside className="r-notification-prompt" aria-label="Enable shop alerts"><span>Stay updated on bills, Udhar and shop activity.</span><button type="button" className="r-btn r-btn--primary" onClick={()=>void enable()}>Enable alerts & sound</button><button type="button" className="r-btn" onClick={()=>save({...prefs,dismissed:true})}>Later</button></aside>}
    {toast&&<div className="r-shop-update-toast" role="status" data-tone={toastTone}><ToastIcon size={20} aria-hidden="true"/><button type="button" onClick={()=>visit(toast)}>{toast.title}<small>{toast.id.startsWith('update:')?toast.body:'Open update'}</small></button><button type="button" className="r-btn" aria-label="Dismiss update" onClick={()=>setToast(null)}>×</button></div>}
    <Sheet open={open} onClose={()=>setOpen(false)} title="Shop notifications">
      <p className="r-caption">Recent sales, purchases, payments, stock and need-list updates, today's collections and tasks. Updates refresh while Apna Galla is open.</p>
      <div className="r-notification-settings"><label className="r-toggle-row"><input type="checkbox" checked={prefs.enabled} onChange={e=>e.target.checked?void enable():save({...prefs,enabled:false})}/>Enable alerts</label><label className="r-toggle-row"><input type="checkbox" checked={prefs.sound} onChange={e=>save({...prefs,sound:e.target.checked})}/>Notification sound</label><button type="button" className="r-btn" onClick={()=>void beep()}><Volume2 size={18}/>Test sound</button></div>
      {permission==='denied'&&<p role="status">Browser notifications are blocked. Allow them in browser site settings to receive desktop alerts. Your inbox still works.</p>}
      {permission==='unsupported'&&<p role="status">This browser supports the in-app inbox and sound. Desktop notifications are unavailable.</p>}
      {permission==='default'&&prefs.enabled&&<button className="r-btn" onClick={()=>void enable()}>Allow browser notifications</button>}
      <button type="button" className="r-btn r-btn--outline" onClick={()=>save({...prefs,read:[...new Set([...prefs.read,...rows.map(r=>r.id)])].slice(-500)})}><CheckCheck size={18}/>Mark all read</button>
      {loading&&<p role="status">Loading shop updates…</p>}{error&&<p role="alert">{error}</p>}
      {!loading&&!error&&!rows.length&&<p>No shop updates yet. Your next saved bill or payment will appear here.</p>}
      {rows.map(row=>{const tone=notificationTone(row),Icon=toneIcons[tone];return <button key={row.id} type="button" data-tone={tone} className={'r-notification-row'+(!prefs.read.includes(row.id)?' is-unread':'')} onClick={()=>visit(row)}><strong><Icon size={17} aria-hidden="true"/> {row.title}</strong><span>{row.body}</span><small>{formatDateTime(row.at)}</small></button>;})}
    </Sheet>
    </>,layer)}
  </>;
}
