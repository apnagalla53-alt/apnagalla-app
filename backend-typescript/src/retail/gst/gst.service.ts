import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BillingService } from '../billing/billing.service';
import { businessDate } from '../../common/business-date';
import { GstInvoiceDto, GstProfileDto } from './gst.dto';
import { defaultUqc, GST_STATES, GST_UQC, localTaxName, requireGstin, requireState, stateCode } from './gst-rules';

const money=(value:Prisma.Decimal|number|string)=>new Prisma.Decimal(value).toFixed(2);
const decimal=(value:Prisma.Decimal|number|string)=>new Prisma.Decimal(value);

@Injectable()
export class RetailGstService {
  constructor(private db:PrismaService,private billing:BillingService) {}
  private async lock(company:string) {
    await this.db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${company+':retail-gst'},0))::text`;
  }
  async profile(company:string) {
    const [configuration,business]=await Promise.all([
      this.db.companyConfiguration.findUnique({where:{company_id:company}}),
      this.db.company.findUniqueOrThrow({where:{id:company},select:{legal_name:true,trade_name:true,address:true,state:true,gstin:true,phone:true,email:true}}),
    ]);
    const profile=(configuration?.tax_configuration as any)?.retail_gst||null;
    return {profile,defaults:{...business,state_code:business.gstin?.slice(0,2)||stateCode(business.state),invoice_prefix:'GST',hsn_digits:6,electronic_reporting:'UNSURE',regular_registration:false,signatory:'',terms:''},
      states:GST_STATES,uqc:GST_UQC,registration_verification:'FORMAT_AND_CHECKSUM_ONLY',electronic_provider:'NOT_CONFIGURED'};
  }
  async saveProfile(company:string,branch:string,user:string,dto:GstProfileDto) {
    requireGstin(dto.gstin,dto.state_code);
    if(!dto.regular_registration)throw new BadRequestException('GST tax invoices require regular GST registration. Unregistered and composition businesses must use their applicable bill of supply / receipt.');
    if(!dto.legal_name.trim()||!dto.address.trim()||!dto.signatory.trim())throw new BadRequestException('Complete the registered name, address and authorised signatory');
    return this.db.runAtomic(async()=>{
      await this.lock(company);
      const configuration=await this.db.companyConfiguration.findUnique({where:{company_id:company}});
      const taxConfiguration=(configuration?.tax_configuration||{}) as any;
      const prior=taxConfiguration.retail_gst;
      const issued=await this.db.retailGstInvoice.count({where:{company_id:company}});
      if(issued&&prior&&(prior.gstin!==dto.gstin||prior.state_code!==dto.state_code||prior.invoice_prefix!==dto.invoice_prefix))throw new BadRequestException('GSTIN, state and invoice series cannot change after an invoice is issued. Use the correct business registration.');
      const profile={...dto,legal_name:dto.legal_name.trim(),address:dto.address.trim(),signatory:dto.signatory.trim()};
      const data={tax_configuration:{...taxConfiguration,retail_gst:profile}};
      await this.db.companyConfiguration.upsert({where:{company_id:company},create:{company_id:company,...data},update:data});
      await this.db.company.update({where:{id:company},data:{legal_name:profile.legal_name,trade_name:profile.trade_name||null,address:profile.address,state:GST_STATES[profile.state_code],gstin:profile.gstin,phone:profile.phone||null,email:profile.email||null}});
      await this.db.auditLog.create({data:{company_id:company,branch_id:branch,user_id:user,action:'GST_PROFILE_UPDATED',details:JSON.stringify({electronic_reporting:profile.electronic_reporting})}});
      return {profile};
    });
  }
  async bills(company:string,branch:string,query:any) {
    const result=await this.billing.getBills(company,branch,query);
    const documents=await this.db.retailGstInvoice.findMany({where:{company_id:company,branch_id:branch,sales_invoice_id:{in:result.data.map(b=>b.id)}},select:{id:true,sales_invoice_id:true,document_number:true}});
    const byBill=new Map(documents.map(document=>[document.sales_invoice_id,document]));
    return {...result,data:result.data.map(bill=>({...bill,gst_invoice:byBill.get(bill.id)||null}))};
  }
  private async bill(company:string,branch:string,id:string) {
    const bill=await this.db.salesInvoice.findFirst({
      where:{id,company_id:company,branch_id:branch},
      include:{party:true,lines:{orderBy:{id:'asc'},include:{
        item:{select:{name:true,sku:true,item_type:true,is_system:true,hsn_sac:true}},
        unit:true,entered_unit:true,variant:{select:{attributes:true}},
        serial_allocations:{include:{serial:{select:{serial_number:true}}}},
      }}},
    });
    if(!bill)throw new NotFoundException('Bill not found');
    return bill;
  }
  async draft(company:string,branch:string,id:string) {
    const issued=await this.db.retailGstInvoice.findFirst({where:{company_id:company,branch_id:branch,sales_invoice_id:id}});
    if(issued)return {issued};
    const bill=await this.bill(company,branch,id);
    const profile=await this.profile(company);
    const recipientState=bill.party.gstin?.slice(0,2)||stateCode(bill.party.state)||profile.profile?.state_code||'';
    return {bill:{id:bill.id,number:bill.document_number,date:bill.document_date.toISOString().slice(0,10),status:bill.status,total:money(bill.grand_total),tax:money(bill.tax_amount)},profile:profile.profile,states:GST_STATES,uqc:GST_UQC,
      recipient:{name:bill.walkin_name||bill.party.name,address:bill.party.address||'',state_code:recipientState,gstin:bill.party.gstin||'',delivery_address:bill.party.address||'',delivery_state_code:recipientState},
      place_of_supply:recipientState,reverse_charge:false,
      lines:bill.lines.map(line=>{let tax:any;try{tax=JSON.parse(line.tax_snapshot_json||'null');}catch{tax=null;}
        return {line_id:line.id,description:line.item.name,hsn:tax?.hsn||line.item.hsn_sac||'',uqc:defaultUqc((line.entered_unit||line.unit).code),quantity:(line.entered_quantity||line.quantity).toString(),unit:(line.entered_unit||line.unit).code,taxable:money(line.taxable_value),tax:money(line.tax_amount),tax_rate:tax?.rate??null};}),
    };
  }
  private async build(company:string,branch:string,id:string,dto:GstInvoiceDto) {
    const {profile}=await this.profile(company);
    if(!profile)throw new BadRequestException('Save your GST business details first');
    requireGstin(profile.gstin,profile.state_code);
    if(!profile.regular_registration)throw new BadRequestException('Regular GST registration is required');
    if(profile.electronic_reporting!=='NOT_REQUIRED')throw new BadRequestException('Confirm that IRN / statutory dynamic QR reporting is not required for this business. A government reporting provider is not configured.');
    if(!dto.recipient||!dto.lines?.length)throw new BadRequestException('Complete recipient and item details');
    requireState(dto.recipient.state_code);requireState(dto.recipient.delivery_state_code);requireState(dto.place_of_supply);
    if(dto.recipient.gstin)requireGstin(dto.recipient.gstin,dto.recipient.state_code);
    const bill=await this.bill(company,branch,id);
    if(!dto.recipient.name.trim())throw new BadRequestException('Complete the recipient name');
    // Rule 46 requires recipient addresses for registered recipients and larger
    // unregistered supplies. Small walk-in sales can omit an unknown address.
    if((dto.recipient.gstin||bill.grand_total.gte(50000))&&(!dto.recipient.address.trim()||!dto.recipient.delivery_address.trim()))throw new BadRequestException('Recipient and delivery addresses are required for registered customers and bills of ₹50,000 or more');
    if(dto.recipient.delivery_state_code!==dto.recipient.state_code&&!dto.recipient.delivery_address.trim())throw new BadRequestException('Enter the different delivery address');
    if(dto.reverse_charge)throw new BadRequestException('This template supports forward-charge domestic sales. Reverse-charge invoices require a separate tax workflow.');
    if(bill.status!=='POSTED')throw new BadRequestException('Only a posted bill can have a GST invoice');
    if(bill.lines.length>200)throw new BadRequestException('This GST invoice supports up to 200 item lines');
    if(bill.lines.some(line=>line.item.is_system && !line.item.sku?.startsWith('RETAIL-SERVICE-')))throw new BadRequestException('Amount-only quick sales need an itemized bill with descriptions, HSN/SAC and GST. Tax is not added to a past bill.');
    if(bill.tax_amount.lte(0))throw new BadRequestException('This bill has no GST charged. Use its existing receipt / applicable bill of supply. Tax is not added retrospectively.');
    const metadata=new Map(dto.lines.map(line=>[line.line_id,line]));
    if(metadata.size!==dto.lines.length||metadata.size!==bill.lines.length||bill.lines.some(line=>!metadata.has(line.id)))throw new BadRequestException('Item details must exactly match this bill');
    const interstate=profile.state_code!==dto.place_of_supply;
    const localName=localTaxName(profile.state_code);
    const summaries=new Map<string,any>();
    let taxable=decimal(0),taxTotal=decimal(0),cgstTotal=decimal(0),localTotal=decimal(0),igstTotal=decimal(0);
    const lines=bill.lines.map((line,index)=>{
      const details=metadata.get(line.id)!;
      if(!GST_UQC.includes(details.uqc))throw new BadRequestException('Choose a valid UQC unit code');
      const minimum=line.item.item_type==='SERVICE'?6:profile.hsn_digits;
      if(!/^(?:\d{4}|\d{6}|\d{8})$/.test(details.hsn)||details.hsn.length<minimum||line.item.item_type==='SERVICE'&&details.hsn.length!==6)throw new BadRequestException('HSN must have 4, 6 or 8 digits and meet the configured digit policy; service SAC must have 6 digits');
      if(!details.description.trim())throw new BadRequestException('Enter each item description');
      let savedTax:any;try{savedTax=JSON.parse(line.tax_snapshot_json||'null');}catch{savedTax=null;}
      if(savedTax?.rate===undefined||!Number.isFinite(Number(savedTax.rate)))throw new BadRequestException('A saved GST rate is missing on this bill. Create a correctly taxed itemized bill; current item tax is not used to rewrite historical tax.');
      const rate=decimal(savedTax.rate),base=line.taxable_value,tax=line.tax_amount;
      if(rate.lt(0)||rate.gt(100)||tax.lt(0)||base.lt(0)||base.mul(rate).div(100).toDecimalPlaces(2).sub(tax).abs().gt('0.01'))throw new BadRequestException('Saved GST amount does not reconcile with its taxable value and rate');
      const quantity=line.entered_quantity||line.quantity;
      if(quantity.lte(0))throw new BadRequestException('Item quantity is missing');
      // Distribute saved paise; never recompute or add tax to the posted bill.
      const cgst=interstate?decimal(0):tax.div(2).toDecimalPlaces(2),local=interstate?decimal(0):tax.sub(cgst),igst=interstate?tax:decimal(0);
      taxable=taxable.add(base);taxTotal=taxTotal.add(tax);cgstTotal=cgstTotal.add(cgst);localTotal=localTotal.add(local);igstTotal=igstTotal.add(igst);
      const key=details.hsn+'|'+rate.toString();
      const group=summaries.get(key)||{hsn:details.hsn,rate:rate.toString(),taxable:decimal(0),cgst:decimal(0),local:decimal(0),igst:decimal(0)};
      group.taxable=group.taxable.add(base);group.cgst=group.cgst.add(cgst);group.local=group.local.add(local);group.igst=group.igst.add(igst);summaries.set(key,group);
      return {number:index+1,description:details.description.trim(),hsn:details.hsn,quantity:quantity.toString(),unit:(line.entered_unit||line.unit).code,uqc:details.uqc,net_rate:base.div(quantity).toFixed(6),discount:money(line.discount_amount),taxable:money(base),rate:rate.toString(),cgst_rate:interstate?'0':rate.div(2).toString(),local_rate:interstate?'0':rate.div(2).toString(),igst_rate:interstate?rate.toString():'0',cgst:money(cgst),local:money(local),igst:money(igst),tax:money(tax),total:money(line.line_total),dimensions:line.dimensions,variant:line.variant?.attributes||null,serials:line.serial_allocations.map(allocation=>allocation.serial.serial_number)};
    });
    if(taxable.sub(bill.taxable_amount).abs().gt('0.00001')||taxTotal.sub(bill.tax_amount).abs().gt('0.00001'))throw new BadRequestException('Bill tax totals do not reconcile with its saved item lines');
    const roundOff=bill.grand_total.sub(taxable).sub(taxTotal);
    if(roundOff.abs().gt(1))throw new BadRequestException('Bill total has an unsupported adjustment');
    const date=businessDate(),year=Number(date.slice(0,4))-(Number(date.slice(5,7))<4?1:0),financialYear=year+'-'+(year+1);
    const fy=await this.db.financialYear.findFirst({where:{company_id:company,is_closed:false,start_date:{lte:new Date(date)},end_date:{gte:new Date(date)}}});
    if(!fy)throw new BadRequestException('An open financial year is required for the invoice issue date');
    return {version:1,supply_kind:bill.lines.every(line=>line.item.item_type==='SERVICE')?'SERVICES':'GOODS',document_number:null,issue_date:date,financial_year:financialYear,source_bill:{id:bill.id,number:bill.document_number,date:bill.document_date.toISOString().slice(0,10)},
      supplier:{...profile,state:GST_STATES[profile.state_code]},recipient:{...dto.recipient,state:GST_STATES[dto.recipient.state_code],delivery_state:GST_STATES[dto.recipient.delivery_state_code]},
      place_of_supply:{code:dto.place_of_supply,name:GST_STATES[dto.place_of_supply]},interstate,local_tax_name:localName,reverse_charge:false,
      lines,summary:[...summaries.values()].map(group=>({...group,taxable:money(group.taxable),cgst:money(group.cgst),local:money(group.local),igst:money(group.igst)})),
      totals:{taxable:money(taxable),cgst:money(cgstTotal),local:money(localTotal),igst:money(igstTotal),tax:money(taxTotal),round_off:money(roundOff),grand_total:money(bill.grand_total),paid_at_issue:money(bill.paid_amount),balance_at_issue:money(bill.outstanding_amount)},
      limitations:['Domestic forward-charge GST invoice; electronic reporting not required, as declared by business.','HSN classification, GST registration status and legal applicability are not government-verified.'],
    };
  }
  async preview(company:string,branch:string,id:string,dto:GstInvoiceDto) {
    const prior=await this.db.retailGstInvoice.findFirst({where:{company_id:company,branch_id:branch,sales_invoice_id:id}});
    return prior?{issued:prior}:{snapshot:await this.build(company,branch,id,dto)};
  }
  async issue(company:string,branch:string,user:string,id:string,dto:GstInvoiceDto) {
    return this.db.runAtomic(async()=>{
      await this.lock(company);
      const prior=await this.db.retailGstInvoice.findFirst({where:{company_id:company,branch_id:branch,sales_invoice_id:id}});
      if(prior)return prior;
      if(!dto.confirmed||!dto.no_previous_gst_invoice)throw new BadRequestException('Confirm the details and that this bill has no GST invoice issued outside EVOLIX');
      const snapshot=await this.build(company,branch,id,dto);
      const sequence=await this.db.retailGstSequence.upsert({where:{company_id_financial_year:{company_id:company,financial_year:snapshot.financial_year}},create:{company_id:company,financial_year:snapshot.financial_year,last_number:1},update:{last_number:{increment:1}}});
      if(sequence.last_number>999999)throw new BadRequestException('Invoice series limit reached');
      const series=snapshot.financial_year.slice(2,4)+snapshot.financial_year.slice(7,9);
      const number=snapshot.supplier.invoice_prefix+'/'+series+'/'+String(sequence.last_number).padStart(6,'0');
      const document=await this.db.retailGstInvoice.create({data:{company_id:company,branch_id:branch,sales_invoice_id:id,financial_year:snapshot.financial_year,document_number:number,issue_date:new Date(snapshot.issue_date),created_by:user,snapshot:JSON.parse(JSON.stringify({...snapshot,document_number:number}))}});
      await this.db.auditLog.create({data:{company_id:company,branch_id:branch,user_id:user,action:'GST_INVOICE_ISSUED',details:JSON.stringify({gst_invoice_id:document.id,bill_id:id,document_number:number})}});
      return document;
    });
  }
}
