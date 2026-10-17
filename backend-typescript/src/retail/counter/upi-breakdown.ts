export type UpiAccountRow={key:string;profile_id:string|null;label:string;upi_id:string|null;mobile:string|null;sales_received:number;dues_received:number;refunds:number;total_received:number;net_received:number};
const money=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
/** Only saved recipient snapshots identify an account; never use today's default. */
export function addUpiReceipt(rows:Map<string,UpiAccountRow>,snapshot:any,amount:number,kind:'sales_received'|'dues_received'|'refunds'){
 const key=snapshot?.receiving_profile_id?'profile:'+snapshot.receiving_profile_id+':'+(snapshot.receiving_upi_id?.toLowerCase()||'unrecorded'):snapshot?.received_on_mobile?'mobile:'+snapshot.received_on_mobile:'unrecorded';
 const row=rows.get(key)||{key,profile_id:snapshot?.receiving_profile_id||null,label:snapshot?.receiving_label||(snapshot?.received_on_mobile?'Another receiving number':'Account not recorded'),upi_id:snapshot?.receiving_upi_id||null,mobile:snapshot?.received_on_mobile||null,sales_received:0,dues_received:0,refunds:0,total_received:0,net_received:0};
 row[kind]=money(row[kind]+amount);row.total_received=money(row.sales_received+row.dues_received);row.net_received=money(row.total_received-row.refunds);rows.set(key,row);
}
