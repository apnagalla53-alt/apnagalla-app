import { Prisma } from '@prisma/client';

export function shopInitials(name: string) {
  const words=name.normalize('NFKC').split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean);
  const meaningful=words.filter(word=>!['and','the','of','a','an','aur'].includes(word.toLowerCase()));
  return (meaningful.length?meaningful:words).map(word=>Array.from(word)[0]).join('').toUpperCase().slice(0,12)||'BILL';
}

/** Locked and updated inside the existing sale transaction; failures consume no number. */
export async function nextShopBillNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${companyId+':shop-bill-number'},0))::text`;
  const [company,config]=await Promise.all([
    tx.company.findUniqueOrThrow({where:{id:companyId},select:{trade_name:true,legal_name:true}}),
    tx.companyConfiguration.findUnique({where:{company_id:companyId},select:{invoice_configuration:true}}),
  ]);
  const previous=(config?.invoice_configuration||{}) as Record<string,any>;
  const series=previous.shop_bill_series;
  const prefix=typeof series?.prefix==='string'?series.prefix:shopInitials(company.trade_name||company.legal_name);
  // Include older invoices when starting the readable series; do not rename them.
  let last=Number.isSafeInteger(series?.last_number)&&series.last_number>=0?series.last_number:await tx.salesInvoice.count({where:{company_id:companyId,is_pos:true}});
  let number:string;
  do {number=prefix+'-'+String(++last).padStart(3,'0');} while(await tx.salesInvoice.findFirst({where:{company_id:companyId,document_number:number},select:{id:true}}));
  const invoice_configuration={...previous,shop_bill_series:{prefix,last_number:last}};
  await tx.companyConfiguration.upsert({where:{company_id:companyId},create:{company_id:companyId,invoice_configuration},update:{invoice_configuration}});
  return number;
}
