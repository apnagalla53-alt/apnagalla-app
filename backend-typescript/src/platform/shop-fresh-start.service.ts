import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { throttleSensitiveAuth } from '../auth/sensitive-auth-throttle';
import { initializeExpenseCategories } from '../retail/expenses/categories/default-expense-categories';
/** A fresh workspace archives the original intact. No ledger, identity or credential is deleted. */
@Injectable()
export class ShopFreshStartService {
  constructor(private db:PrismaService){}
  async preview(organizationId:string){
    const org=await this.db.organization.findUnique({where:{id:organizationId}});if(!org)throw new NotFoundException('Business not found.');
    const companies=await this.db.company.findMany({where:{organization_id:organizationId,is_active:true},select:{id:true,trade_name:true,legal_name:true,_count:{select:{sales_invoices:true,purchase_invoices:true,items:true,parties:true}}}});
    return {companies,legal_hold:org.legal_hold,confirmation:'FRESH '+org.code,retained:'The original shop and all transactions are archived intact for recovery. Usernames, passwords, Google identities, staff roles and the subscription are preserved.'};
  }
  private async verify(actor:string,password:string){
    await throttleSensitiveAuth('shop-fresh-start:'+actor,5);
    const admin=await this.db.platformUser.findUnique({where:{id:actor}});
    if(!admin?.is_active||admin.is_locked||!await bcrypt.compare(password,admin.password_hash))throw new BadRequestException('Platform administrator password is incorrect.');
  }
  async start(orgId:string,companyId:string,confirmation:string,password:string,reason:string,actor:string){
    await this.verify(actor,password);
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${orgId}::uuid FOR UPDATE`;
      const org=await tx.organization.findUnique({where:{id:orgId}}),old=await tx.company.findFirst({where:{id:companyId,organization_id:orgId,is_active:true}});
      if(!org||!old)throw new BadRequestException('Choose an active shop in this business.');
      if(org.legal_hold||org.archived_at||!org.is_active)throw new BadRequestException('A held, archived or inactive business cannot start fresh.');
      if(confirmation!=='FRESH '+org.code||reason.trim().length<3)throw new BadRequestException('Enter the displayed confirmation and a reason.');
      const memberships=await tx.userRole.findMany({where:{company_id:old.id}});
      if(await tx.retailGstInvoice.count({where:{company_id:old.id}}))throw new BadRequestException('This shop has issued GST invoices. Keep its statutory series and use audited corrections instead of a fresh start.');
      if(!memberships.length)throw new BadRequestException('Assign a shop owner before starting fresh.');
      const config=await tx.companyConfiguration.findUnique({where:{company_id:old.id}});
      const archivedBranches=await tx.branch.findMany({where:{company_id:old.id},select:{id:true,is_active:true}});
      const {id,created_at,updated_at,...identity}=old;
      const company=await tx.company.create({data:{...identity,code:'FRESH-'+randomUUID().slice(0,8)}});
      const branch=await tx.branch.create({data:{company_id:company.id,name:'Main Shop',code:'HQ'}});
      await tx.godown.create({data:{branch_id:branch.id,code:'MAIN',name:'Shop Stock'}});
      await tx.unit.create({data:{company_id:company.id,code:'PCS',name:'Pieces'}});
      const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),year=Number(date.slice(0,4))-(Number(date.slice(5,7))<4?1:0);
      await tx.financialYear.create({data:{company_id:company.id,label:`${year}-${year+1}`,start_date:new Date(`${year}-04-01`),end_date:new Date(`${year+1}-03-31`),is_active:true}});
      const ledgers:Record<string,string>={};
      for(const [code,name,type,normal] of [['CASH_IN_HAND','Cash in Hand','ASSET','DEBIT'],['DEFAULT_BANK','Default Bank','ASSET','DEBIT'],['SALES_REVENUE','Sales Revenue','REVENUE','CREDIT'],['OUTPUT_GST','Output GST','LIABILITY','CREDIT'],['DIR-EXP','Direct Expenses','EXPENSE','DEBIT'],['PURCH','Purchase Account','EXPENSE','DEBIT'],['OWNER_CAPITAL','Owner Capital','EQUITY','CREDIT']]){
        ledgers[code]=(await tx.ledgerAccount.create({data:{company_id:company.id,branch_id:branch.id,code,name,account_type:type,normal_balance:normal,is_system:true}})).id;
      }
      await tx.companyConfiguration.create({data:{company_id:company.id,default_branch_id:branch.id,default_cash_ledger_id:ledgers.CASH_IN_HAND,default_bank_ledger_id:ledgers.DEFAULT_BANK,
        ...(config?.tax_configuration?{tax_configuration:config.tax_configuration}:{}),...(config?.payment_configuration?{payment_configuration:config.payment_configuration}:{}),...(config?.shop_feature_settings?{shop_feature_settings:config.shop_feature_settings}:{}),
        invoice_configuration:{fresh_start:{archived_branches:archivedBranches,archived_company_id:old.id,memberships:memberships.map(m=>({user_id:m.user_id,role_id:m.role_id,company_id:m.company_id,branch_id:m.branch_id})),created_at:new Date().toISOString(),actor}}}});
      await tx.retailCapabilitySettings.create({data:{company_id:company.id}});
      await initializeExpenseCategories(tx,orgId,company.id,branch.id);
      for(const member of memberships)await tx.userRole.update({where:{user_id_role_id:{user_id:member.user_id,role_id:member.role_id}},data:{company_id:company.id,branch_id:branch.id}});
      await tx.company.update({where:{id:old.id},data:{is_active:false}});await tx.branch.updateMany({where:{company_id:old.id},data:{is_active:false}});
      await tx.session.updateMany({where:{user_id:{in:memberships.map(m=>m.user_id)},revoked_at:null},data:{revoked_at:new Date()}});
      await tx.platformAuditLog.create({data:{user_id:actor,action:'SHOP_FRESH_START',resource_type:'Organization',resource_id:orgId,details:JSON.stringify({reason,archived_company_id:old.id,new_company_id:company.id,recovery:'Original company preserved intact; restore through fresh-start recovery.'})}});
      return {success:true,company_id:company.id,archived_company_id:old.id,credentials_preserved:true,recovery_available:true};
    },{timeout:30000});
  }
  async restore(orgId:string,companyId:string,password:string,reason:string,actor:string){
    await this.verify(actor,password);
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${orgId}::uuid FOR UPDATE`;
      const org=await tx.organization.findUnique({where:{id:orgId}}),company=await tx.company.findFirst({where:{id:companyId,organization_id:orgId,is_active:true}}),config=await tx.companyConfiguration.findUnique({where:{company_id:companyId}});
      const recovery:any=(config?.invoice_configuration as any)?.fresh_start;
      if(!org||org.legal_hold||!company||!recovery)throw new BadRequestException('No eligible fresh-start recovery was found.');
      if(reason.trim().length<3)throw new BadRequestException('Enter the reason for recovery.');
      if(await tx.retailGstInvoice.count({where:{company_id:companyId}}))throw new BadRequestException('The newer shop has issued GST invoices. Preserve its statutory series and review recovery with your accountant.');
      if(!await tx.company.findFirst({where:{id:recovery.archived_company_id,organization_id:orgId,is_active:false}}))throw new ConflictException('The archived shop is not available for recovery.');
      if(await tx.userRole.count({where:{company_id:companyId}})!==recovery.memberships.length)throw new ConflictException('Shop membership changed. Review recovery first.');
      for(const member of recovery.memberships){const current=await tx.userRole.findFirst({where:{user_id:member.user_id,role_id:member.role_id,company_id:companyId}});if(!current)throw new ConflictException('Shop memberships changed. Review recovery before continuing.');await tx.userRole.update({where:{user_id_role_id:{user_id:member.user_id,role_id:member.role_id}},data:{company_id:member.company_id,branch_id:member.branch_id}});}
      await tx.company.update({where:{id:companyId},data:{is_active:false}});await tx.branch.updateMany({where:{company_id:companyId},data:{is_active:false}});await tx.company.update({where:{id:recovery.archived_company_id},data:{is_active:true}});for(const branch of recovery.archived_branches||[])await tx.branch.updateMany({where:{id:branch.id,company_id:recovery.archived_company_id},data:{is_active:branch.is_active}});
      const users=await tx.userRole.findMany({where:{company_id:recovery.archived_company_id},select:{user_id:true}});await tx.session.updateMany({where:{user_id:{in:users.map(u=>u.user_id)},revoked_at:null},data:{revoked_at:new Date()}});
      await tx.platformAuditLog.create({data:{user_id:actor,action:'SHOP_FRESH_START_RESTORED',resource_type:'Organization',resource_id:orgId,details:JSON.stringify({reason,restored_company_id:recovery.archived_company_id,archived_company_id:companyId})}});
      return {success:true,company_id:recovery.archived_company_id,new_workspace_preserved:true};
    },{timeout:30000});
  }
}
