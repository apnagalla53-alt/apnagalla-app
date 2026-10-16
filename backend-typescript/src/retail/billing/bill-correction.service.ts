import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InventoryPostingService } from '../../inventory/posting.service';
import { PostingService } from '../../accounting/posting.service';
import { BillingService } from './billing.service';
import { businessDate } from '../../common/business-date';
import { BillCorrectionDto,EditRetailBillDto } from './bill-correction.dto';
@Injectable()
export class BillCorrectionService {
  constructor(private db:PrismaService,private inventory:InventoryPostingService,private accounting:PostingService,private billing:BillingService){}
  async correct(companyId:string,branchId:string,userId:string,id:string,dto:BillCorrectionDto|EditRetailBillDto,replace=false){
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id=${id}::uuid AND company_id=${companyId}::uuid FOR UPDATE`;
      const invoice=await tx.salesInvoice.findFirst({where:{id,company_id:companyId,branch_id:branchId,is_pos:true},include:{lines:true,gst_invoice:true,financial_year:true}});
      if(!invoice)throw new NotFoundException('Bill not found.');
      if(invoice.status!=='POSTED')throw new BadRequestException('This bill was already cancelled or replaced.');
      if(invoice.gst_invoice)throw new BadRequestException('An issued GST invoice is preserved. Use the GST correction process rather than editing this bill.');
      if(invoice.financial_year.is_closed)throw new BadRequestException('This bill belongs to a closed financial year.');
      if(await tx.salesReturn.count({where:{company_id:companyId,original_invoice_id:id,status:'POSTED'}}))throw new BadRequestException('This bill already has a return. Review its return history before making another correction.');
      const receipts=await tx.voucher.findMany({where:{company_id:companyId,source_document_type:'POS_RECEIPT',source_document_id:id,voucher_type:'RECEIPT',status:'POSTED'},include:{lines:true}});
      const receiptTotal=receipts.reduce((sum,v)=>sum+v.lines.filter(l=>l.party_id===invoice.party_id).reduce((a,l)=>a+Number(l.credit)-Number(l.debit),0),0);
      if(Math.abs(receiptTotal-Number(invoice.paid_amount))>.005)throw new BadRequestException('Later customer payments exist on this bill. Correct those payments before cancelling or replacing it.');
      await tx.$queryRaw`SELECT id FROM parties WHERE id=${invoice.party_id}::uuid AND company_id=${companyId}::uuid FOR UPDATE`;
      await this.inventory.reverseMovement(tx,companyId,'SALES_INVOICE',id,'SALES_INVOICE_CANCELLATION');
      const vouchers=await tx.voucher.findMany({where:{company_id:companyId,source_document_id:id,source_document_type:{in:['SALES_INVOICE','POS_RECEIPT','INVENTORY_COST_SALES_INVOICE']},status:'POSTED',voucher_type:{not:'REVERSAL'}},include:{lines:true}});
      // Preserve both sides as posted journals. Every ledger/report sees original + contra = zero.
      // Marking the original journal non-posted would incorrectly leave only its negative entry.
      for(const original of vouchers){
        const contra=await this.accounting.postVoucher(tx,{company_id:companyId,branch_id:branchId,financial_year_id:invoice.financial_year_id,voucher_type:'REVERSAL',document_number:original.document_number+'-CANCEL',voucher_date:new Date(businessDate()),source_document_type:(original.source_document_type||'BILL')+'_CANCEL',source_document_id:id,payment_method:original.payment_method||undefined,narration:`Bill correction by ${dto.editor_name}: ${dto.reason}`,posted_by:userId,lines:original.lines.map(l=>({ledger_account_id:l.ledger_account_id,party_id:l.party_id||undefined,debit:l.credit,credit:l.debit}))});
        for(const line of contra.lines.filter(l=>l.party_id===invoice.party_id))await tx.billAllocation.create({data:{company_id:companyId,party_id:invoice.party_id,voucher_line_id:line.id,reference_document_type:'SALES_INVOICE',reference_document_id:id,allocation_type:Number(line.debit)>0?'NEW_REFERENCE':'AGAINST_REFERENCE',amount:Number(line.debit)>0?line.debit:line.credit}});
      }
      await tx.salesInvoice.update({where:{id},data:{status:'CANCELLED',outstanding_amount:0}});
      let replacement:any=null;
      if(replace){const {editor_name,reason,...bill}=dto as EditRetailBillDto;replacement=await this.billing.createBill(companyId,branchId,userId,bill);}
      await tx.auditLog.create({data:{company_id:companyId,branch_id:branchId,user_id:userId,action:replace?'BILL_REPLACED':'BILL_CANCELLED',source_document_type:'SALES_INVOICE',source_document_id:id,details:JSON.stringify({editor_name:dto.editor_name.trim(),reason:dto.reason.trim(),before:{number:invoice.document_number,total:invoice.grand_total,paid:invoice.paid_amount,due:invoice.outstanding_amount,lines:invoice.lines.map(l=>({item_id:l.item_id,quantity:l.quantity,rate:l.rate,total:l.line_total}))},after:{status:'CANCELLED',replacement_id:replacement?.id||null,replacement_number:replacement?.document_number||null,total:replacement?.grand_total||null},money_transfer_performed:false})}});
      return {success:true,cancelled_invoice_id:id,replacement,retained_for_audit:true};
    },{timeout:30000});
  }
}

