// Repair only the repository's existing DEFAULT localhost development shop.
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const dbUrl = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(dbUrl.hostname) || dbUrl.pathname !== '/evolix_trade_dev' || process.env.NODE_ENV === 'production') {
  throw new Error('Local Retail setup requires localhost/evolix_trade_dev in a non-production environment.');
}
const p = new PrismaClient();
(async () => {
  const company = await p.company.findFirst({where:{code:'DEF-COMP', organization:{code:'DEFAULT'}}});
  const user = await p.user.findUnique({where:{username:'admin'}});
  if (!company || !user || user.organization_id !== company.organization_id) throw new Error('Existing default admin/shop not found. Run the backend bootstrap first.');
  const branch = await p.branch.findFirst({where:{company_id:company.id,code:'HQ'}});
  if (!branch) throw new Error('Existing HQ branch not found.');
  const role = await p.role.upsert({where:{uix_roles_org_name:{organization_id:company.organization_id,name:'ADMIN'}},update:{},create:{organization_id:company.organization_id,name:'ADMIN',system_role:true}});
  await p.userRole.upsert({where:{user_id_role_id:{user_id:user.id,role_id:role.id}},update:{company_id:company.id,branch_id:branch.id},create:{user_id:user.id,role_id:role.id,company_id:company.id,branch_id:branch.id}});
  for(const [code,name] of [['RETAIL_POS','Retail POS'],['KHATA','Khata'],['PURCHASING','Purchases'],['EXPENSES','Expenses'],['REPORTS','Reports'],['INVENTORY','Inventory'],['SALES','Sales'],['ACCOUNTING','Accounting']]){
    const feature = await p.feature.upsert({where:{code},update:{},create:{code,name}});
    await p.tenantEntitlement.upsert({where:{uix_tenant_entitlements:{organization_id:company.organization_id,feature_id:feature.id}},update:{},create:{organization_id:company.organization_id,feature_id:feature.id}});
  }
  if (!await p.unit.findFirst({where:{company_id:company.id}})) await p.unit.create({data:{company_id:company.id,code:'PCS',name:'Pieces'}});
  if (!await p.godown.findFirst({where:{branch_id:branch.id}})) await p.godown.create({data:{branch_id:branch.id,code:'MAIN',name:'Shop Stock'}});
  const now = new Date(); const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear()-1;
  await p.financialYear.upsert({where:{uix_fy_company_label:{company_id:company.id,label:`${year}-${year+1}`}},update:{},create:{company_id:company.id,label:`${year}-${year+1}`,start_date:new Date(`${year}-04-01`),end_date:new Date(`${year+1}-03-31`),is_active:true}});
  for (const [code,name,type] of [['DIR-EXP','Direct Expenses','EXPENSE']]) {
    if (!await p.ledgerAccount.findFirst({where:{company_id:company.id,code}})) await p.ledgerAccount.create({data:{company_id:company.id,code,name,account_type:type}});
  }
  const paymentLedgers = {};
  for (const [code,name] of [['CASH_IN_HAND','Cash in Hand'],['DEFAULT_BANK','Default Bank']]) {
    paymentLedgers[code] = await p.ledgerAccount.findFirst({where:{company_id:company.id,code}}) || await p.ledgerAccount.create({data:{company_id:company.id,branch_id:branch.id,code,name,account_type:'ASSET',normal_balance:'DEBIT',is_system:true}});
  }
  const config = await p.companyConfiguration.findUnique({where:{company_id:company.id}});
  await p.companyConfiguration.upsert({where:{company_id:company.id},create:{company_id:company.id,default_branch_id:branch.id,default_cash_ledger_id:paymentLedgers.CASH_IN_HAND.id,default_bank_ledger_id:paymentLedgers.DEFAULT_BANK.id},update:{
    ...(!config?.default_branch_id && {default_branch_id:branch.id}), ...(!config?.default_cash_ledger_id && {default_cash_ledger_id:paymentLedgers.CASH_IN_HAND.id}), ...(!config?.default_bank_ledger_id && {default_bank_ledger_id:paymentLedgers.DEFAULT_BANK.id}),
  }});
  console.log('Default local Retail membership, entitlement, unit, stock location and financial year ready. Existing data/password preserved.');
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>p.$disconnect());
