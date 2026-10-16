const zone = 'Asia/Kolkata';
const dateFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:zone,day:'2-digit',month:'2-digit',year:'numeric'});
const timeFormatter=new Intl.DateTimeFormat('en-IN',{timeZone:zone,hour:'2-digit',minute:'2-digit',hour12:true});
const todayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
export function formatDate(value: string | number | Date | null | undefined = new Date()): string {
  if (!value) return '—';
  // Business dates are calendar dates, not timestamps to shift across timezones.
  const iso = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  if (iso) return iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4);
  const date = new Date(value); if (!Number.isFinite(date.getTime())) return '—';
  return dateFormatter.format(date);
}
export function formatTime(value: string | number | Date | null | undefined = new Date()): string {
  if (!value) return '—'; const date=new Date(value); if(!Number.isFinite(date.getTime()))return '—';
  return timeFormatter.format(date);
}
export const formatDateTime=(value:string|number|Date|null|undefined=new Date())=>formatDate(value)+' · '+formatTime(value);
export const indiaToday=()=>todayFormatter.format(new Date());
