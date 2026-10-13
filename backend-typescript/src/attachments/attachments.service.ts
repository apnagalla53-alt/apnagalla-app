import { Inject, Injectable, NotFoundException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from './storage/storage.interface';
import { v4 as uuidv4 } from 'uuid';
import { cleanUploadedImage } from './image-validation';

@Injectable()
export class AttachmentsService {
  private requireStorageProvider(provider: string) {
    if (provider !== (process.env.STORAGE_PROVIDER || 'local')) throw new ServiceUnavailableException('This photo needs storage migration before it can be accessed. Contact support.');
  }
  constructor(
    private readonly prisma: PrismaService,
    @Inject('StorageService') private readonly storage: StorageService
  ) {}
  async list(company:string,query:any={}) {
    const limit=Math.min(100,Math.max(1,Math.floor(Number(query.limit)||50))),offset=Math.max(0,Math.floor(Number(query.offset)||0));
    return this.prisma.attachment.findMany({where:{company_id:company,...(query.category?{category:String(query.category).slice(0,50)}:{}),...(query.search?{original_file_name:{contains:String(query.search).slice(0,255),mode:'insensitive' as const}}:{})},take:limit,skip:offset,orderBy:[{created_at:'desc'},{id:'asc'}],select:{id:true,original_file_name:true,mime_type:true,file_size:true,category:true,entity_type:true,entity_id:true,created_at:true}});
  }

  async uploadAttachment(
    organizationId: string,
    companyId: string,
    branchId: string,
    userId: string,
    entityType: string,
    entityId: string,
    category: string,
    file: any
  ) {
    const bytes:Buffer=file?.buffer;
    if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>5*1024*1024) throw new BadRequestException('Photo must contain 1 byte to 5 MB');
    const valid=file.mimetype==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      :file.mimetype==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255
      :file.mimetype==='image/webp'?bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP':false;
    if(!valid)throw new BadRequestException('Photo content does not match its file type');
    const cleaned=await cleanUploadedImage(bytes,file.mimetype);
    if (!/^[a-f0-9-]{36}$/i.test(entityId)) throw new BadRequestException('Invalid document ID');
    const models: Record<string, { model: string; categories: string[] }> = {
      PURCHASE: { model: 'purchaseInvoice', categories: ['PURCHASE_BILL'] },
      NEED: { model: 'needList', categories: ['NEED_PHOTO'] },
      SUPPLIER_PAYMENT: { model: 'voucher', categories: ['SUPPLIER_PAYMENT_PROOF'] },
      CUSTOMER_PAYMENT: { model: 'voucher', categories: ['CUSTOMER_PAYMENT_PROOF'] },
      EXPENSE: { model: 'expense', categories: ['EXPENSE_BILL','EXPENSE_PROOF'] },
      ITEM: { model: 'item', categories: ['ITEM_IMAGE'] },
      SALES_INVOICE: { model: 'salesInvoice', categories: ['SALE_PROOF'] },
    };
    const entity = models[entityType];
    if (!entity || !entity.categories.includes(category)) throw new BadRequestException('Unsupported attachment category');
    const document = await (this.prisma as any)[entity.model].findFirst({ where: { id: entityId, company_id: companyId } });
    if (!document) throw new NotFoundException('Document not found');
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as any)[file.mimetype];
    if (!ext) throw new BadRequestException('Unsupported photo type');
    const storedFileName = `${uuidv4()}.${ext}`;
    const storageKey = `${companyId}/${category}/${storedFileName}`;

    let stored=false;
    try { return await this.prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${companyId+':attachments'},0))`;
      // Item deletion uses this same company lock. Recheck after acquiring it so
      // a concurrent upload can never attach to a permanently deleted item.
      if(entityType==='ITEM'&&!await tx.item.findFirst({where:{id:entityId,company_id:companyId}}))throw new NotFoundException('Item not found');
      const usage=await tx.attachment.aggregate({where:{company_id:companyId},_sum:{file_size:true}});
      if((usage._sum.file_size||0)+cleaned.length>Number(process.env.TENANT_UPLOAD_QUOTA_BYTES||1073741824))throw new BadRequestException('Your photo storage limit has been reached. Remove unused photos or contact support.');
      await this.storage.save(storageKey,cleaned);stored=true;
      return tx.attachment.create({
      data: {
        organization_id: organizationId,
        company_id: companyId,
        branch_id: branchId,
        entity_type: entityType,
        entity_id: entityId,
        category: category,
        original_file_name: String(file.originalname||'photo').split(/[\\/]/).pop()!.replace(/[\x00-\x1f\x7f]/g,'').slice(0,255)||'photo',
        stored_file_name: storedFileName,
        mime_type: file.mimetype,
        file_size: cleaned.length,
        storage_provider: process.env.STORAGE_PROVIDER||'local',
        storage_key: storageKey,
        created_by: userId
      }
      });
    }); } catch (error) { if(stored)await this.storage.delete(storageKey); throw error; }
  }

  async getMetadata(companyId:string,id:string){
    const attachment=await this.prisma.attachment.findFirst({where:{id,company_id:companyId}});
    if(!attachment)throw new NotFoundException('Attachment not found');
    return attachment;
  }
  async getAttachment(companyId: string, id: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id, company_id: companyId }
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    this.requireStorageProvider(attachment.storage_provider);
    const buffer = await this.storage.get(attachment.storage_key);
    return { attachment, buffer };
  }

  async deleteAttachment(companyId: string, id: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id, company_id: companyId }
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    this.requireStorageProvider(attachment.storage_provider);
    await this.storage.delete(attachment.storage_key);
    await this.prisma.attachment.delete({ where: { id } });
  }
}
