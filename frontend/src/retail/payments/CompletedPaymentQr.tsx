import { useEffect,useState } from 'react';
import {posApi} from '../retailApi';
import UpiQr from './UpiQr';
export default function CompletedPaymentQr({id}:{id:string}){
  const [amount,setAmount]=useState(0),[error,setError]=useState(false);
  useEffect(()=>{let active=true;posApi.getBillDetail(id).then(r=>{if(active)setAmount((r.data.payments||[]).filter((p:any)=>p.method==='UPI').reduce((sum:number,p:any)=>sum+Number(p.amount),0));}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[id]);
  if(error)return <p className="r-caption">Your bill is saved. Open Bill Details to retry the payment QR.</p>;
  return amount>0?<UpiQr amount={amount} paid/>:null;
}
