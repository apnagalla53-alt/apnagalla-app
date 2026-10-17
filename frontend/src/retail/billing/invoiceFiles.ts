import { formatDate } from '../../shared/dateFormat';
import { billLineQuantity } from './BillLineDescription';
const rupee=(n:unknown)=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const blob=(canvas:HTMLCanvasElement,type:string)=>new Promise<Blob>((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error('Could not prepare invoice file')),type,.94));
const bytes=(value:string)=>new TextEncoder().encode(value);

/** An image-backed PDF with real page objects and byte-accurate cross references. */
export async function invoicePdf(canvas:HTMLCanvasElement):Promise<Blob>{
 const streams:Uint8Array[]=[],height=1414;
 for(let y=0;y<canvas.height;y+=height){const page=document.createElement('canvas');page.width=1000;page.height=height;const c=page.getContext('2d');if(!c)throw new Error('PDF rendering is unavailable');c.fillStyle='#fff';c.fillRect(0,0,1000,height);c.drawImage(canvas,0,y,1000,Math.min(height,canvas.height-y),0,0,1000,Math.min(height,canvas.height-y));streams.push(new Uint8Array(await (await blob(page,'image/jpeg')).arrayBuffer()));}
 const objects:Uint8Array[]=[];const count=streams.length;
 objects.push(bytes('<< /Type /Catalog /Pages 2 0 R >>'));
 objects.push(bytes(`<< /Type /Pages /Count ${count} /Kids [${streams.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`));
 streams.forEach((jpg,i)=>{const id=3+i*3;objects.push(bytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im${i} ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`));objects.push(join([bytes(`<< /Type /XObject /Subtype /Image /Width 1000 /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`),jpg,bytes('\nendstream')]));const draw=`q\n595.28 0 0 841.89 0 0 cm\n/Im${i} Do\nQ`;objects.push(bytes(`<< /Length ${bytes(draw).length} >>\nstream\n${draw}\nendstream`));});
 const chunks=[bytes('%PDF-1.4\n')],offsets=[0];let length=chunks[0].length;
 objects.forEach((obj,i)=>{offsets.push(length);const part=join([bytes(`${i+1} 0 obj\n`),obj,bytes('\nendobj\n')]);chunks.push(part);length+=part.length;});
 const start=length;chunks.push(bytes(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`));
 return new Blob([join(chunks).buffer as ArrayBuffer],{type:'application/pdf'});
}
function join(parts:Uint8Array[]){const merged=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let offset=0;for(const part of parts){merged.set(part,offset);offset+=part.length;}return merged;}

export async function prepareInvoiceFiles(bill:any,shop:string){
 if(bill.status!=='POSTED')throw new Error('Open the cancelled bill in audit history.');
 await document.fonts.ready;
 const lines=bill.sales_invoice_line||bill.lines||[],canvas=document.createElement('canvas');canvas.width=1000;
 const c=canvas.getContext('2d');if(!c)throw new Error('Invoice images are unavailable in this browser');
 function write(value:string,x:number,y:number,size=24,bold=false,color='#18372c',align:CanvasTextAlign='left',maxWidth=900){c!.fillStyle=color;c!.font=`${bold?700:400} ${size}px "DM Sans Variable","Segoe UI",sans-serif`;c!.textAlign=align;c!.fillText(value,x,y,maxWidth);}
 function wrap(value:string,width:number){const result:string[]=[];let row='';for(const word of String(value).split(/\s+/)){if(c!.measureText(word).width>width){if(row){result.push(row);row='';}for(const letter of word){if(c!.measureText(row+letter).width>width){result.push(row);row='';}row+=letter;}continue;}const candidate=row?row+' '+word:word;if(c!.measureText(candidate).width>width&&row){result.push(row);row=word;}else row=candidate;}if(row)result.push(row);return result;}
 function rule(y:number){c!.strokeStyle='#dce6df';c!.beginPath();c!.moveTo(48,y);c!.lineTo(952,y);c!.stroke();}
 const prepared=lines.map((line:any)=>{c.font='600 24px "Segoe UI",sans-serif';const names=wrap(line.item?.name||line.description||'Item',430);const details=[line.variant?Object.values(line.variant.attributes||{}).join(' / '):'',line.serial_allocations?.length?'Serial: '+line.serial_allocations.map((a:any)=>a.serial?.serial_number||'').join(', '):'',line.dimensions?'Measurements: '+Object.values(line.dimensions).join(' × '):''].filter(Boolean).join(' · ');c.font='400 18px "Segoe UI",sans-serif';return {line,names,details:wrap(details,900)};});
 const height=800+prepared.reduce((sum:number,row:any)=>sum+Math.max(76,row.names.length*29+20)+row.details.length*24+32,0);
 if(height>24000)throw new Error('This bill is too long for one invoice image. Use Print invoice to save its complete PDF.');
 canvas.height=Math.max(1100,height);c.fillStyle='#ffffff';c.fillRect(0,0,1000,canvas.height);c.fillStyle='#087447';c.fillRect(0,0,1000,12);
 write(shop,48,77,36,true);write('BILL / RECEIPT',952,76,19,true,'#087447','right');write('Bill '+bill.document_number,48,127,25,true);write(formatDate(bill.document_date),952,127,22,false,'#60746b','right');
 const customer=bill.party?.is_walkin?'Walk-in Customer':bill.party?.name||bill.walkin_name||'Walk-in Customer';write(customer,48,178,24,true);if(bill.party?.phone)write(bill.party.phone,48,211,21,false,'#60746b');
 rule(242);write('Item / description',48,285,22,true);write('Qty',610,285,22,true,'#18372c','right');write('Rate',760,285,22,true,'#18372c','right');write('Amount',952,285,22,true,'#18372c','right');
 let y=335;
 for(const row of prepared){const {line,names,details}=row;for(const [i,name] of names.entries())write(name,48,y+i*29,24,true);write(billLineQuantity(line),610,y,19,false,'#18372c','right',140);write(rupee(line.rate),760,y,20,false,'#18372c','right',140);write(rupee(line.line_total),952,y,22,true,'#18372c','right',175);y+=Math.max(76,names.length*29+20);for(const detail of details){write(detail,48,y,18,false,'#60746b');y+=24;}rule(y);y+=32;}
 y+=16;
 const discount=Number(bill.discount_amount||0);if(discount>0){write('Discount included',48,y,23,false,'#60746b');write(rupee(discount),952,y,24,false,'#18372c','right');y+=42;}
 write('Taxable value',48,y,23,false,'#60746b');write(rupee(bill.taxable_amount),952,y,24,false,'#18372c','right');y+=42;write('GST',48,y,23,false,'#60746b');write(rupee(bill.tax_amount),952,y,24,false,'#18372c','right');y+=55;rule(y);y+=47;
 write('Total',48,y,29,true);write(rupee(bill.grand_total),952,y,34,true,'#087447','right');y+=49;write('Paid',48,y,24);write(rupee(bill.paid_amount),952,y,26,false,'#18372c','right');y+=44;write('Is bill ka baaki',48,y,24,true);write(rupee(bill.outstanding_amount),952,y,29,true,'#18372c','right');y+=60;
 if(bill.returns?.length){write('Returns / refunds are recorded separately.',48,y,20,false,'#60746b');y+=35;}
 write('Dhanyavaad! · '+shop,48,y,22,false,'#60746b');
 const cropped=document.createElement('canvas');cropped.width=1000;cropped.height=Math.min(canvas.height,y+65);cropped.getContext('2d')!.drawImage(canvas,0,0);
 const safe=String(bill.document_number||'invoice').replace(/[^A-Za-z0-9_-]/g,'-').slice(0,80);
 return {image:new File([await blob(cropped,'image/png')],safe+'.png',{type:'image/png'}),pdf:new File([await invoicePdf(cropped)],safe+'.pdf',{type:'application/pdf'})};
}
export function downloadInvoiceFile(file:File){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export async function shareInvoiceFile(file:File){if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:file.name});return 'Share menu opened. Choose WhatsApp and the recipient.';}downloadInvoiceFile(file);return 'Invoice downloaded. Attach it in WhatsApp or another app.';}
