import { useState } from 'react';
import { Sheet } from '../../components/MobileControls';
interface ReportPeriodFilterProps {
  value: { from?: string; to?: string };
  onChange: (value: { from?: string; to?: string }) => void;
  allowAllTime?: boolean;
  weekLabel?: boolean;
}
export default function ReportPeriodFilter({ value, onChange, allowAllTime = true, weekLabel=false }: ReportPeriodFilterProps) {
  const [custom,setCustom]=useState(false),[from,setFrom]=useState(''),[to,setTo]=useState('');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const daysAgo = (count: number) => { const date = new Date(today + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() - count); return date.toISOString().slice(0, 10); };
  const choices = [
    { name: 'Today', from: today, to: today },
    { name: 'Yesterday', from: daysAgo(1), to: daysAgo(1) },
    { name: weekLabel?'This Week':'Last 7 Days', from: daysAgo(weekLabel?(new Date(today+'T12:00:00Z').getUTCDay()+6)%7:6), to: today },
    { name: 'This Month', from: today.slice(0, 8) + '01', to: today },
    ...(allowAllTime ? [{ name: 'All Time', from: undefined, to: undefined }] : []),
  ];
  return <><div className="r-report-periods" role="group" aria-label="Report period">{choices.map(choice => {
    const selected = value.from?.slice(0, 10) === choice.from && value.to?.slice(0, 10) === choice.to;
    return <button className={'r-btn ' + (selected ? 'r-btn--primary' : 'r-btn--secondary')} key={choice.name} aria-pressed={selected} onClick={() => onChange({ from: choice.from, to: choice.to })}>{choice.name}</button>;
  })}<button className="r-btn r-btn--secondary" onClick={()=>{setFrom(value.from||today);setTo(value.to||today);setCustom(true);}}>Custom</button></div><Sheet open={custom} onClose={()=>setCustom(false)} title="Custom Report Dates"><form onSubmit={e=>{e.preventDefault();onChange({from,to});setCustom(false);}}><label htmlFor="report-custom-from">From date</label><input id="report-custom-from" type="date" className="r-input" value={from} onChange={e=>setFrom(e.target.value)} max={to||undefined} required/><label htmlFor="report-custom-to">To date</label><input id="report-custom-to" type="date" className="r-input" value={to} onChange={e=>setTo(e.target.value)} min={from||undefined} required/><button className="r-btn r-btn--primary r-w-full">Apply Dates</button></form></Sheet></>;
}
