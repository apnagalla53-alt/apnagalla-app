// Optional headed acceptance fixtures. Never point this script at a customer/application database.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const environmentFile=process.argv[2];
if(environmentFile){Object.assign(process.env,JSON.parse(fs.readFileSync(path.resolve(environmentFile),'utf8')));}
const target=new URL(process.env.DATABASE_URL||'');
if(process.env.NODE_ENV!=='test'||!['localhost','127.0.0.1'].includes(target.hostname)||!target.pathname.endsWith('_test')){
  throw new Error('NODE_ENV=test and an explicit localhost *_test database are mandatory.');
}
const {NestFactory}=require('@nestjs/core'),{AppModule}=require('../dist/app.module'),{PrismaService}=require('../dist/database/prisma.service'),{TenantProvisioningService}=require('../dist/platform/provisioning/tenant-provisioning.service'),bcrypt=require('bcrypt');
async function main(){
  const app=await NestFactory.createApplicationContext(AppModule,{logger:false});
  try{
    const db=app.get(PrismaService),provisioner=app.get(TenantProvisioningService),suffix=crypto.randomUUID();
    const password=crypto.randomBytes(24).toString('base64url')+'A1!',fixtures={password,shops:{}};
    for(const code of ['STARTER','SMART','PRO']){
      const plan=await db.plan.findUniqueOrThrow({where:{code}});
      const shop=await provisioner.provisionTenant({planId:plan.id,organizationName:'Disposable Launch '+code+' '+suffix,adminName:'Launch Owner',adminEmail:code.toLowerCase()+'-'+suffix+'@test.invalid',adminPassword:password});
      fixtures.shops[code]={username:shop.user.username,organizationId:shop.organization.id,companyId:shop.company.id,branchId:shop.branch.id,financialYearId:shop.financialYear.id};
    }
    const role=await db.platformRole.upsert({where:{name:'SUPER_ADMIN'},update:{},create:{name:'SUPER_ADMIN'}});
    const username='launch-operator-'+suffix;
    await db.platformUser.create({data:{username,display_name:'Launch Operator',password_hash:await bcrypt.hash(password,12),roles:{create:{role_id:role.id}}}});
    fixtures.platform={username};
    const onboarding=await provisioner.provisionTenant({organizationName:'Disposable Onboarding '+suffix,adminName:'Onboarding Owner',adminEmail:'onboarding-'+suffix+'@test.invalid',adminPassword:password});
    await db.$transaction(async tx=>{
      await tx.user.update({where:{id:onboarding.user.id},data:{google_subject:'synthetic-launch-'+suffix,onboarding_state:'PLAN_REQUIRED'}});
      await tx.tenantSubscription.updateMany({where:{organization_id:onboarding.organization.id},data:{status:'PENDING'}});
    });
    fixtures.onboarding={username:onboarding.user.username};
    const output=path.join(root,'output/launch-plans/private-fixtures.json');fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,JSON.stringify(fixtures,null,2),{mode:0o600});
    console.log('Disposable launch-plan browser fixtures saved under ignored output/launch-plans. No credentials printed.');
  }finally{await app.close();}
}
main().catch(error=>{console.error('Disposable launch-plan fixture creation failed. Check the test-only environment and migrated schema.',{kind:error.name,code:error.code,at:String(error.stack||'').split('\n').filter(line=>/^\s+at /.test(line)).slice(0,3)});process.exitCode=1;});
