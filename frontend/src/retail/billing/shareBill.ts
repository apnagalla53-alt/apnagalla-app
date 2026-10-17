import { prepareInvoiceFiles,shareInvoiceFile } from './invoiceFiles';
export async function shareBill(bill:any,shop?:string){
 const files=await prepareInvoiceFiles(bill,shop||bill.company?.trade_name||bill.company?.legal_name||'Apna Galla');
 return shareInvoiceFile(files.image);
}
