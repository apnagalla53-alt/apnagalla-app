import { Body, Controller, ForbiddenException, NotFoundException, BadRequestException, Get, Post, Param, Req, Res, UseGuards } from '@nestjs/common';
import { IsBoolean, IsNumber, Min, Max, Matches, MinLength, IsIn, IsOptional, IsString, MaxLength, isUUID } from 'class-validator';
import { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { EntitlementService } from '../../common/entitlement.service';
import { throttleOperation } from '../../common/operation-throttle';
import { featureMetadata, PLAN_ORDER } from '../../common/retail-plan-catalog';
import { presetForBusiness } from '../../auth/business-types';

class ServiceChargePreferenceDto {
 @IsString() @MinLength(1) @MaxLength(80) name:string;
 @IsNumber() @Min(0.01) @Max(999999999) amount:number;
 @IsNumber() @Min(0) @Max(100) gst_rate:number;
 @IsOptional() @IsString() @Matches(/^\d{6}$/) sac?:string;
 @IsBoolean() auto_apply:boolean;
}
class PrivacyRequestDto {
  @IsIn(['DELETE_ACCOUNT','DATA_PORTABILITY']) type: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
class MigrationChoiceDto { @IsIn(['IMPORT','FRESH']) choice: string; }
class BackupRequestDto { @IsString() @MaxLength(64) request_key: string; }
class ShopFeatureDto { @IsBoolean() enabled:boolean; }
class BillingPreferencesDto { @IsBoolean() barcode_scanning_enabled:boolean; }

@Controller('api/v1/retail/account')
@UseGuards(AuthGuard)
export class RetailAccountController {
  constructor(private db: PrismaService, private entitlements: EntitlementService) {}
  private backupConfiguration() {
    const configured=process.env.BACKUP_PROVIDER==='s3'&&!!process.env.BACKUP_S3_BUCKET&&!!process.env.BACKUP_S3_REGION&&Buffer.from(process.env.BACKUP_ENCRYPTION_KEY||'','base64').length===32;
    return {configured,provider:process.env.BACKUP_PROVIDER||'none',included_in_all_paid_plans:true,restore_scope:'whole-database'};
  }
  private owner(req: any) {
    if (!['ADMIN','OWNER','TENANT_ADMIN'].includes(req.user.role)) throw new ForbiddenException('Only the shop owner can manage migration and backups');
  }
  @Get('entitlements')
  entitlementsForShop(@Req() req:any) { return this.entitlements.resolve(req.user.organization_id,this.db,req.user.company_id); }
  @Get('service-charge-preference')
  async serviceChargePreference(@Req() req:any){
    const config=await this.db.companyConfiguration.findUnique({where:{company_id:req.user.company_id}});
    return {charge:(config?.shop_feature_settings as any)?.service_charge||null};
  }
  @Post('service-charge-preference')
  async saveServiceChargePreference(@Req() req:any,@Body() dto:ServiceChargePreferenceDto){
    this.owner(req);if(!dto.name.trim())throw new BadRequestException('Enter a charge name');
    return this.db.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-features:${req.user.company_id}`}))`;
      const config=await tx.companyConfiguration.findUnique({where:{company_id:req.user.company_id}});
      const charge={...dto,name:dto.name.trim()},settings={...(config?.shop_feature_settings as object||{}),service_charge:charge};
      await tx.companyConfiguration.upsert({where:{company_id:req.user.company_id},create:{company_id:req.user.company_id,shop_feature_settings:settings},update:{shop_feature_settings:settings}});
      await tx.auditLog.create({data:{company_id:req.user.company_id,user_id:req.user.id,action:'SERVICE_CHARGE_PREFERENCE_UPDATED',details:JSON.stringify(charge)}});
      return {charge};
    });
  }
  @Get('billing-preferences')
  async billingPreferences(@Req() req:any){
    const config=await this.db.companyConfiguration.findUnique({where:{company_id:req.user.company_id}});
    return {barcode_scanning_enabled:(config?.shop_feature_settings as any)?.barcode_scanning_enabled===true};
  }
  @Post('billing-preferences')
  async saveBillingPreferences(@Req() req:any,@Body() dto:BillingPreferencesDto){
    this.owner(req);
    return this.db.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-features:${req.user.company_id}`}))`;
      const config=await tx.companyConfiguration.findUnique({where:{company_id:req.user.company_id}});
      const settings={...(config?.shop_feature_settings as object||{}),barcode_scanning_enabled:dto.barcode_scanning_enabled};
      await tx.companyConfiguration.upsert({where:{company_id:req.user.company_id},create:{company_id:req.user.company_id,shop_feature_settings:settings},update:{shop_feature_settings:settings}});
      await tx.auditLog.create({data:{company_id:req.user.company_id,user_id:req.user.id,action:'BILLING_PREFERENCES_UPDATED',details:JSON.stringify(dto)}});
      return dto;
    });
  }
  @Post('features/:code')
  async toggleFeature(@Req() req:any,@Param('code') code:string,@Body() dto:ShopFeatureDto) {
    this.owner(req);
    return this.db.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-features:${req.user.company_id}`}))`;
      const effective=await this.entitlements.resolve(req.user.organization_id,tx,req.user.company_id);
      const feature=effective.features.find(f=>f.code===code);
      if(!feature)throw new NotFoundException('Feature not found');
      if(feature.core)throw new BadRequestException('Core shop features are always included and have no toggle');
      if(!feature.plan_entitled)throw new ForbiddenException({code:'FEATURE_NOT_ENTITLED',feature:code,required_plan:feature.required_plan,message:'This feature is not included in your plan.'});
      if(!effective.subscription_active)throw new ForbiddenException('Renew your subscription before changing shop features');
      if(!feature.rollout_enabled)throw new ForbiddenException('This feature is currently unavailable');
      const existing=await tx.companyConfiguration.findUnique({where:{company_id:req.user.company_id}});
      const settings={...(existing?.shop_feature_settings as object||{}),[code]:dto.enabled};
      await tx.companyConfiguration.upsert({where:{company_id:req.user.company_id},create:{company_id:req.user.company_id,shop_feature_settings:settings},update:{shop_feature_settings:settings}});
      if(feature.shop_enabled!==dto.enabled)await tx.auditLog.create({data:{company_id:req.user.company_id,branch_id:req.user.branch_id,user_id:req.user.id,action:dto.enabled?'SHOP_FEATURE_ENABLED':'SHOP_FEATURE_DISABLED',details:JSON.stringify({feature:code,enabled:dto.enabled,previous:feature.shop_enabled})}});
      return this.entitlements.resolve(req.user.organization_id,tx,req.user.company_id);
    });
  }
  @Get('subscription')
  async subscription(@Req() req:any) {
    const [effective,plans,payments,organization]=await Promise.all([
      this.entitlementsForShop(req),
      this.db.plan.findMany({where:{code:{in:[...PLAN_ORDER]},is_active:true},include:{plan_features:{include:{feature:true}}}}),
      this.db.subscriptionPayment.findMany({where:{organization_id:req.user.organization_id},orderBy:{paid_at:'desc'},take:50,select:{id:true,plan_name:true,amount:true,tax:true,discount:true,status:true,method:true,reference:true,paid_at:true,refund_amount:true}}),
      this.db.organization.findFirst({where:{id:req.user.organization_id},select:{business_type:true}}),
    ]);
    return {current:this.entitlements.subscriptionSummary(effective),entitlements:effective,business_type:organization?.business_type,business_preset:presetForBusiness(organization?.business_type),
      plans:plans.sort((a,b)=>PLAN_ORDER.indexOf(a.code as any)-PLAN_ORDER.indexOf(b.code as any)).map(p=>({id:p.id,code:p.code,name:p.name,monthly_price:Number(p.monthly_price),description:p.description,limits:p.limits,features:p.plan_features.map(f=>({code:f.feature.code,name:f.feature.name,...featureMetadata(f.feature.code)}))})),
      payments:['OWNER','ADMIN','TENANT_ADMIN'].includes(req.user.role)?payments:[],payment_provider:{status:'NOT_CONFIGURED',checkout_available:false},voice_provider:{status:'NOT_CONFIGURED',available:false},
      backup_provider:this.backupConfiguration()};
  }
  @Get('migration')
  migration(@Req() req:any) {
    this.owner(req);
    return this.db.retailMigrationChoice.findUnique({where:{company_id_user_id:{company_id:req.user.company_id,user_id:req.user.id}}});
  }
  @Post('migration')
  chooseMigration(@Req() req:any,@Body() dto:MigrationChoiceDto) {
    this.owner(req);
    const scope={company_id:req.user.company_id,user_id:req.user.id};
    return this.db.retailMigrationChoice.upsert({where:{company_id_user_id:scope},create:{...scope,choice:dto.choice},update:{choice:dto.choice}});
  }
  @Get('backup-requests')
  backupRequests(@Req() req:any) {
    this.owner(req);
    return this.db.retailDataBackupRequest.findMany({where:{company_id:req.user.company_id},orderBy:{created_at:'desc'},take:30});
  }
  @Post('backup-requests')
  async backupRequest(@Req() req:any,@Body() dto:BackupRequestDto) {
    this.owner(req); await throttleOperation('backup-request:'+req.user.id,5);
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(dto.request_key)) throw new ForbiddenException('Use a valid request identifier');
    return this.db.runAtomic(async()=>{
      const scope={company_id:req.user.company_id,user_id:req.user.id,request_key:dto.request_key};
      await this.db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(scope)},0))::text`;
      const prior=await this.db.retailDataBackupRequest.findUnique({where:{company_id_user_id_request_key:scope}});
      if(prior)return prior;
      const request=await this.db.retailDataBackupRequest.create({data:scope});
      await this.db.auditLog.create({data:{company_id:req.user.company_id,branch_id:req.user.branch_id,user_id:req.user.id,action:'TENANT_DATA_BACKUP_REQUESTED',details:JSON.stringify({request_id:request.id})}});
      return request;
    });
  }
  @Get()
  async summary(@Req() req: any) {
    const ctx = req.user;
    const [profile, business, branch, effective] = await Promise.all([
      this.db.user.findUniqueOrThrow({ where: { id: ctx.id }, select: { id: true, username: true, display_name: true, email: true, phone: true, email_verified_at: true, google_subject: true } }),
      this.db.company.findFirstOrThrow({ where: { id: ctx.company_id, organization_id: ctx.organization_id }, select: { id: true, legal_name: true, trade_name: true, address: true, phone: true, email: true, gstin: true } }),
      ctx.branch_id ? this.db.branch.findFirst({ where: { id: ctx.branch_id, company_id: ctx.company_id }, select: { id: true, name: true, code: true } }) : null,
      this.entitlements.resolve(ctx.organization_id,this.db,ctx.company_id),
    ]);
    const { email_verified_at, google_subject, ...safe } = profile;
    return { profile: { ...safe, email_verified: !!email_verified_at, google_linked: !!google_subject },
      business: { ...business, name: business.trade_name || business.legal_name }, branch,
      subscription: this.entitlements.subscriptionSummary(effective),
      features: effective.features.map(f => ({ ...f, key: f.code })),
      entitlements:effective,
      backup: this.backupConfiguration() };
  }

  @Get('privacy-requests')
  requests(@Req() req: any) {
    return this.db.privacyRequest.findMany({ where: { user_id: req.user.id, organization_id: req.user.organization_id }, orderBy: { created_at: 'desc' }, take: 50 });
  }
  @Post('privacy-requests')
  async request(@Req() req: any, @Body() dto: PrivacyRequestDto) {
    if(dto.type==='DATA_PORTABILITY')this.owner(req);
    await throttleOperation('privacy:' + req.user.id, 5);
    return this.db.runAtomic(async () => {
      // One outstanding request per user/type survives browser retries.
      await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${req.user.id + ':privacy'}, 0))`;
      const existing = await this.db.privacyRequest.findFirst({ where: { user_id: req.user.id, company_id:req.user.company_id, type: dto.type, status: 'PENDING' } });
      return existing || this.db.privacyRequest.create({ data: { user_id: req.user.id, company_id: req.user.company_id,
        organization_id: req.user.organization_id, type: dto.type, note: dto.note } });
    });
  }

  @Get('export')
  async export(@Req() req: any, @Res() res: Response) {
    if (!['ADMIN', 'OWNER', 'TENANT_ADMIN'].includes(req.user.role) && !req.user.permissions?.includes('identity.admin')) throw new ForbiddenException('Only the business owner can export all business records');
    await throttleOperation('export:' + req.user.id, 5);
    const company = req.user.company_id;
    const portability=await this.db.privacyRequest.findFirst({where:{company_id:company,user_id:req.user.id,type:{in:['DELETE_ACCOUNT','DATA_PORTABILITY']},status:'PENDING'}});
    if(!portability)await this.entitlements.require(req.user.organization_id,['EXPORT_FULL_BUSINESS'],company);
    await this.db.auditLog.create({data:{company_id:company,branch_id:req.user.branch_id,user_id:req.user.id,action:'BUSINESS_DATA_EXPORT',details:JSON.stringify({mode:portability?'ACCOUNT_EXIT_PORTABILITY':'PRO_CONVENIENCE',portability_request_id:portability?.id||null})}});
    const requestId=req.query.request_id;
    if(requestId && (typeof requestId!=='string'||!isUUID(requestId)||!await this.db.retailDataBackupRequest.findFirst({where:{id:requestId,company_id:company,user_id:req.user.id}}))) throw new NotFoundException('Backup request not found');
    // Explicit delegates/scopes only. Credentials, sessions, tokens and filesystem keys are never exported.
    const resources: [string, any][] = [
      ['company', { id: company }], ['branch', { company_id: company }], ['godown', { branch: { company_id: company } }],
      ['financialYear', { company_id: company }], ['unit', { company_id: company }], ['taxClass', { company_id: company }],
      ['item', { company_id: company }], ['itemVariant', { item: { company_id: company } }],
      ['itemBarcode',{company_id:company}], ['variantOptionDefinition',{company_id:company}], ['serialAllocation',{company_id:company}],
      ['itemBundleComponent', { bundle_item: { company_id: company } }], ['itemModifierGroup', { item: { company_id: company } }],
      ['itemModifierOption', { group: { item: { company_id: company } } }],
      ['itemUnitConversion', { item: { company_id: company } }], ['itemBatch', { company_id: company }], ['itemSerial', { company_id: company }],
      ['party', { company_id: company }], ['salesInvoice', { company_id: company }], ['salesInvoiceLine', { sales_invoice: { company_id: company } }],
      ['retailCalendarTask', { company_id: company }],
      ['salesReturn', { company_id: company }], ['salesReturnLine', { sales_return: { company_id: company } }],
      ['purchaseOrder', { company_id: company }], ['purchaseOrderLine', { purchase_order: { company_id: company } }],
      ['goodsReceipt', { company_id: company }], ['goodsReceiptLine', { goods_receipt: { company_id: company } }],
      ['purchaseInvoice', { company_id: company }], ['purchaseInvoiceLine', { purchase_invoice: { company_id: company } }],
      ['purchaseReturn', { company_id: company }], ['purchaseReturnLine', { purchase_return: { company_id: company } }],
      ['stockMovement', { company_id: company }], ['stockBalanceProjection', { company_id: company }],
      ['openingStock',{company_id:company}], ['openingStockLine',{opening_stock:{company_id:company}}],
      ['stockAdjustment',{company_id:company}], ['stockAdjustmentLine',{stock_adjustment:{company_id:company}}],
      ['stockTransfer',{company_id:company}], ['stockTransferLine',{stock_transfer:{company_id:company}}],
      ['stockCount',{company_id:company}], ['stockCountLine',{stock_count:{company_id:company}}],
      ['dailyCashCount',{company_id:company}], ['expenseCategory',{company_id:company}],
      ['priceList',{company_id:company}], ['priceListItem',{price_list:{company_id:company}}], ['customerItemPrice',{company_id:company}], ['promotionScheme',{company_id:company}],
      ['bankAccount',{company_id:company}], ['cheque',{company_id:company}], ['posHeldBill',{company_id:company}], ['posHeldBillLine',{pos_held_bill:{company_id:company}}],
      ['ledgerAccount', { company_id: company }], ['voucher', { company_id: company }], ['voucherLine', { voucher: { company_id: company } }],
      ['billAllocation', { company_id: company }], ['expense', { company_id: company }], ['needList', { company_id: company }], ['attachment', { company_id: company }],
      ['retailImportJob',{company_id:company}], ['retailImportRow',{job:{company_id:company}}], ['retailImportIdentity',{company_id:company}],
      ['retailMigrationChoice',{company_id:company}], ['retailReportPreference',{company_id:company}], ['retailReportNotification',{company_id:company}], ['retailDataBackupRequest',{company_id:company}],
      ['retailGstInvoice',{company_id:company}], ['retailGstSequence',{company_id:company}],
      ['user',{organization_id:req.user.organization_id,roles:{some:{company_id:company}}}],
    ];
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="evolix-business-export.ndjson"');
    res.setHeader('Cache-Control', 'no-store');
    const write = async (row: any) => {
      if (res.destroyed) return false;
      if (!res.write(JSON.stringify(row, (_k, v) => typeof v === 'bigint' ? v.toString() : v) + '\n')) return new Promise<boolean>(resolve => {
        const cleanup = () => { res.off('drain', drained); res.off('close', closed); res.off('error', closed); };
        const drained = () => { cleanup(); resolve(!res.destroyed); };
        const closed = () => { cleanup(); resolve(false); };
        res.once('drain', drained); res.once('close', closed); res.once('error', closed);
        if (res.destroyed) closed();
      });
      return true;
    };
    await write({ format: 'EVOLIX_PORTABILITY_V1', company_id: company, exported_at: new Date().toISOString(),
      consistency: 'Live paginated export. This is not a transaction-consistent database backup. Attachment bytes are available through authorized downloads.' });
    try {
      const configuration=await this.db.companyConfiguration.findUnique({where:{company_id:company}});
      if(configuration&&!await write({resource:'companyConfiguration',record:configuration}))return;
      for (const [resource, where] of resources) {
        let cursor: string | undefined;
        while (!res.destroyed) {
          // GST sequences use a company/FY primary key rather than an id.
          const compositeKey = resource === 'retailGstSequence';
          const rows = await (this.db as any)[resource].findMany({ where, take: 500,
            ...(resource==='user'?{select:{id:true,username:true,display_name:true,email:true,phone:true,is_active:true,language:true,roles:{where:{company_id:company},select:{company_id:true,branch_id:true,role:{select:{name:true}}}}}}:{}),
            orderBy: compositeKey ? { financial_year: 'asc' } : { id: 'asc' },
            ...(cursor ? { cursor: compositeKey ? { company_id_financial_year: { company_id: company, financial_year: cursor } } : { id: cursor }, skip: 1 } : {}) });
          for (const record of rows) {
            if (resource === 'attachment') { delete record.storage_key; delete record.file_path; }
            if (!await write({ resource, record })) return;
          }
          if (rows.length < 500) break;
          cursor = resource === 'retailGstSequence' ? rows[rows.length - 1].financial_year : rows[rows.length - 1].id;
        }
      }
      if (!res.destroyed) {
        if(requestId)await this.db.retailDataBackupRequest.update({where:{id:requestId},data:{status:'EXPORT_PREPARED'}});
        await write({ complete: true }); res.end();
      }
    } catch {
      if (!res.destroyed) { await write({ complete: false, error: 'Export interrupted. Please retry.' }); res.end(); }
    }
  }
}
