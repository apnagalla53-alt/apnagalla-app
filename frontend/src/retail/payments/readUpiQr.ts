export function readUpiQr(text:string){
  let url:URL;try{url=new URL(text.trim());}catch{throw new Error('This image does not contain a receiving UPI QR.');}
  if(url.protocol!=='upi:'||url.hostname!=='pay'||url.username||url.password||url.port||url.hash||!['','/'].includes(url.pathname))throw new Error('Scan a receiving UPI QR from your payment app.');
  if(url.searchParams.getAll('pa').length!==1||url.searchParams.getAll('pn').length>1)throw new Error('This QR has conflicting receiving details.');
  const upi_id=(url.searchParams.get('pa')||'').trim(),payee_name=(url.searchParams.get('pn')||'').trim();
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/.test(upi_id))throw new Error('This QR has no valid UPI address.');
  if((url.searchParams.get('cu')||'INR').toUpperCase()!=='INR'||payee_name.length>100||/[\x00-\x1f\x7f]/.test(payee_name))throw new Error('This QR has unsupported receiving details.');
  return {upi_id,payee_name}; // Never reuse encoded amounts, transaction references or links.
}
